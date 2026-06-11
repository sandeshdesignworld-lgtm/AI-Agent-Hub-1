import { Router, type IRouter } from "express";
import multer from "multer";
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

/* ── HR Bot — file upload route (must be declared before the generic :slug route) ── */
router.post("/agents/hr-agent/trigger", requireAuth, upload.single("resume"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No resume file uploaded" });
    return;
  }

  const [agent] = await db
    .select({ webhookUrl: agentsTable.webhookUrl })
    .from(agentsTable)
    .where(eq(agentsTable.slug, "hr-agent"));

  if (!agent?.webhookUrl) {
    res.status(400).json({ error: "No webhook configured for HR Bot" });
    return;
  }

  const formData = new FormData();
  const blob = new Blob([req.file.buffer], { type: "application/pdf" });
  formData.append("resume", blob, req.file.originalname || "resume.pdf");

  req.log.info("Triggering HR Bot webhook");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000);

  try {
    const webhookResponse = await fetch(agent.webhookUrl, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!webhookResponse.ok) {
      const text = await webhookResponse.text();
      req.log.error({ status: webhookResponse.status, body: text }, "HR webhook returned error");
      res.status(502).json({ error: `Webhook error: ${webhookResponse.status}` });
      return;
    }

    const responseText = await webhookResponse.text();
    req.log.info("HR webhook response received");

    let data: unknown;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { raw: responseText };
    }

    res.json({ success: true, data });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      req.log.error("HR webhook timed out after 120s");
      res.status(504).json({ error: "Webhook timed out after 120 seconds" });
    } else {
      req.log.error({ err }, "HR webhook request failed");
      res.status(502).json({ error: "Webhook request failed" });
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
