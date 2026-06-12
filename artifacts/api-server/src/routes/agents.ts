import { Router, type IRouter } from "express";
import multer from "multer";
import NodeFormData from "form-data";
import { db, agentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ListAgentsResponse, GetAgentResponse, GetAgentParams, TriggerAgentParams, TriggerAgentBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are accepted"));
    }
  },
});

type DeadlineEntry = {
  Task: string;
  "Last Date": string;
  Piority: string;
  Status: string;
};

function shapeDeadlineEntry(raw: Record<string, unknown>): DeadlineEntry | null {
  const task = typeof raw["Task"] === "string" ? raw["Task"].trim() : "";
  const lastDate = typeof raw["Last Date"] === "string" ? raw["Last Date"].trim() : "";
  const piority = typeof raw["Piority"] === "string" ? raw["Piority"].trim() : "";
  const status = typeof raw["Status"] === "string" ? raw["Status"].trim() : "";
  if (!task || !lastDate || !piority || !status) return null;
  return { Task: task, "Last Date": lastDate, Piority: piority, Status: status };
}

const router: IRouter = Router();

router.get("/agents", async (req, res): Promise<void> => {
  req.log.info("Listing agents");
  const agents = await db
    .select({
      id: agentsTable.id,
      slug: agentsTable.slug,
      name: agentsTable.name,
      shortDescription: agentsTable.shortDescription,
      order: agentsTable.order,
    })
    .from(agentsTable)
    .orderBy(agentsTable.order);

  res.json(ListAgentsResponse.parse(agents));
});

router.get("/agents/:slug", async (req, res): Promise<void> => {
  const params = GetAgentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [agent] = await db
    .select()
    .from(agentsTable)
    .where(eq(agentsTable.slug, params.data.slug));

  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  res.json(GetAgentResponse.parse(agent));
});

/* ── HR Bot — test route: GET /api/agents/hr-agent/test ── */
router.get("/agents/hr-agent/test", requireAuth, async (req, res): Promise<void> => {
  const HR_WEBHOOK = "https://hook.eu2.make.com/ca8p23nxzh06qnn3b4y5zi5m4h58ftt7";
  console.log("[HR Test] Pinging Make.com webhook with empty POST...");
  try {
    const r = await fetch(HR_WEBHOOK, { method: "POST", signal: AbortSignal.timeout(10_000) });
    const body = await r.text();
    console.log(`[HR Test] Make.com responded: status=${r.status} body=${body.slice(0, 200)}`);
    res.json({ status: r.status, body: body.slice(0, 200) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[HR Test] Error: ${msg}`);
    res.status(502).json({ error: msg });
  }
});

/* ── HR Bot — file upload route (must be declared before the generic :slug route) ── */
router.post("/agents/hr-agent/trigger", requireAuth, upload.single("resume"), async (req, res): Promise<void> => {
  /* Extend socket timeout for this long-running route (Make.com takes 30-90s) */
  req.socket?.setTimeout(150_000);

  console.log("[HR Agent] received file upload:", req.file ? `name=${req.file.originalname} size=${req.file.size}` : "NO FILE");

  if (!req.file) {
    res.status(400).json({ error: "No resume file uploaded" });
    return;
  }

  const [agent] = await db
    .select({ webhookUrl: agentsTable.webhookUrl })
    .from(agentsTable)
    .where(eq(agentsTable.slug, "hr-agent"));

  if (!agent?.webhookUrl) {
    console.error("[HR Agent] No webhook URL in database");
    res.status(400).json({ error: "No webhook configured for HR Bot" });
    return;
  }

  const originalFileName = req.file.originalname || "resume.pdf";
  const formData = new NodeFormData();
  formData.append('resume', req.file.buffer, { filename: originalFileName, contentType: 'application/pdf' });

  console.log(`[HR Agent] forwarding to Make.com... url=${agent.webhookUrl} fileSize=${req.file.size}`);
  req.log.info({ fileSize: req.file.size }, "Triggering HR Bot webhook");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 130_000);

  try {
    const webhookResponse = await fetch(agent.webhookUrl, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log(`[HR Agent] Make.com responded with status ${webhookResponse.status}`);
    req.log.info({ status: webhookResponse.status }, "HR webhook response received");

    const responseText = await webhookResponse.text();
    console.log(`[HR Agent] response body: ${responseText.slice(0, 300)}`);

    if (!webhookResponse.ok) {
      req.log.error({ status: webhookResponse.status, body: responseText }, "HR webhook returned error");
      res.status(502).json({ error: `Webhook error ${webhookResponse.status}: ${responseText.slice(0, 200)}` });
      return;
    }

    let data: unknown;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { status: "completed", raw: responseText };
    }

    res.json({ success: true, data });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[HR Agent] ERROR: ${msg}`);
    if (err instanceof Error && err.name === "AbortError") {
      req.log.error("HR webhook timed out after 130s");
      res.status(504).json({ error: "Webhook timed out — Make.com took longer than 130 seconds" });
    } else {
      req.log.error({ err }, "HR webhook request failed");
      res.status(502).json({ error: `Webhook request failed: ${msg}` });
    }
  }
});

router.post("/agents/:slug/trigger", requireAuth, async (req, res): Promise<void> => {
  const params = TriggerAgentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = TriggerAgentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [agent] = await db
    .select({ webhookUrl: agentsTable.webhookUrl })
    .from(agentsTable)
    .where(eq(agentsTable.slug, params.data.slug));

  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  if (!agent.webhookUrl) {
    res.status(400).json({ error: "No webhook configured for this agent" });
    return;
  }

  const slug = params.data.slug;

  // Extract optional recipient email from body
  const rawEmail = (req.body as Record<string, unknown>)["email"];
  const email = typeof rawEmail === "string" && rawEmail.trim() ? rawEmail.trim() : undefined;

  // For deadline-tracker, enforce exact Google Sheets column shape server-side
  let webhookEntries: unknown[];
  if (slug === "deadline-tracker") {
    const shaped: DeadlineEntry[] = [];
    for (const raw of body.data.entries) {
      const entry = shapeDeadlineEntry(raw as Record<string, unknown>);
      if (!entry) {
        res.status(400).json({ error: "Each deadline entry must have Task, Last Date, Piority, and Status fields" });
        return;
      }
      shaped.push(entry);
    }
    webhookEntries = shaped;
  } else {
    webhookEntries = body.data.entries;
  }

  const webhookPayload: Record<string, unknown> = { entries: webhookEntries, ...(email ? { email } : {}) };

  req.log.info({ slug, entries: webhookEntries.length }, "Triggering agent webhook");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  try {
    const webhookResponse = await fetch(agent.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!webhookResponse.ok) {
      const text = await webhookResponse.text();
      req.log.error({ status: webhookResponse.status, body: text }, "Webhook returned error");
      res.status(502).json({ error: `Webhook error: ${webhookResponse.status}` });
      return;
    }

    const responseText = await webhookResponse.text();
    req.log.info({ slug }, "Webhook response received");

    if (slug === "deadline-tracker") {
      res.json({ success: true, html: responseText });
    } else {
      res.json({ success: true, summary: responseText });
    }
  
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      req.log.error({ slug }, "Webhook timed out after 60s");
      res.status(504).json({ error: "Webhook timed out after 60 seconds" });
    } else {
      req.log.error({ err, slug }, "Webhook request failed");
      res.status(502).json({ error: "Webhook request failed" });
    }
  }
});

export default router;
