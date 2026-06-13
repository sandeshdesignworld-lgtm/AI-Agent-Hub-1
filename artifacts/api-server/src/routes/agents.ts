import { Router, type IRouter } from "express";
import multer from "multer";
import { db, agentsTable, hospitalCallLogTable, campusConciergeCallLogTable, linkedinSubmissionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
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
  const HR_WEBHOOK = "https://hook.eu2.make.com/z3htgslpiry2cvi5cxxa133f2uvcycim";
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

  console.log("[HR Agent] file received:", req.file ? `name=${req.file.originalname} size=${req.file.size} bytes mime=${req.file.mimetype}` : "NO FILE — multer did not populate req.file");

  if (!req.file) {
    res.status(400).json({ error: "No resume file uploaded" });
    return;
  }

  console.log("[HR Agent] buffer length:", req.file.buffer.length);

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
  const blob = new Blob([req.file.buffer], { type: req.file.mimetype || "application/pdf" });
  const formData = new FormData();
  formData.append("resume", blob, originalFileName);

  console.log(`[HR Agent] forwarding to Make.com... url=${agent.webhookUrl} fileSize=${req.file.size} filename=${originalFileName}`);
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

/* ── Hospital Receptionist — call log GET ── */
router.get("/agents/hospital-receptionist/call-log", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(hospitalCallLogTable)
    .orderBy(desc(hospitalCallLogTable.calledAt))
    .limit(50);
  res.json({ calls: rows });
});

/* ── Helpers for call-log ── */
function maskPhone(phone: unknown): string | null {
  if (typeof phone !== "string" || !phone.trim()) return null;
  const p = phone.trim();
  if (p.length <= 4) return "****";
  return p.slice(0, 3) + "*".repeat(Math.max(p.length - 5, 2)) + p.slice(-2);
}

const ACTION_OUTCOME: Record<string, string> = {
  patient_lookup:         "info",
  book_appointment:       "booked",
  cancel_appointment:     "cancelled",
  reschedule_appointment: "rescheduled",
};

/* ── Hospital Receptionist — multi-action route ── */
router.post("/agents/hospital-receptionist/trigger", requireAuth, async (req, res): Promise<void> => {
  const { action, args = {} } = req.body as { action?: string; args?: Record<string, unknown> };

  const WEBHOOKS: Record<string, string> = {
    patient_lookup:           "https://n8n.srv1042888.hstgr.cloud/webhook/patient-lookup",
    book_appointment:         "https://n8n.srv1042888.hstgr.cloud/webhook/appintment-booking-retell",
    cancel_appointment:       "https://n8n.srv1042888.hstgr.cloud/webhook/cancellation-booking",
    reschedule_appointment:   "https://n8n.srv1042888.hstgr.cloud/webhook/reschedule-booking",
  };

  if (!action || !WEBHOOKS[action]) {
    res.status(400).json({ error: `Invalid action. Must be one of: ${Object.keys(WEBHOOKS).join(", ")}` });
    return;
  }

  const url = WEBHOOKS[action];
  req.log.info({ action }, "Hospital Receptionist webhook triggered");
  console.log(`[HospitalReceptionist] action=${action} url=${url}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  try {
    const webhookResponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ args }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await webhookResponse.text();
    console.log(`[HospitalReceptionist] action=${action} status=${webhookResponse.status} body=${responseText.slice(0, 300)}`);

    if (!webhookResponse.ok) {
      req.log.error({ action, status: webhookResponse.status, body: responseText }, "Hospital webhook returned error");
      res.status(502).json({ error: `Webhook error ${webhookResponse.status}: ${responseText.slice(0, 200)}` });
      return;
    }

    let data: unknown;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { raw: responseText };
    }

    // Parse nested appointments JSON string if present
    if (data && typeof data === "object" && "appointments" in data) {
      const d = data as Record<string, unknown>;
      if (typeof d.appointments === "string") {
        try { d.appointments = JSON.parse(d.appointments); } catch { /* leave as string */ }
      }
    }

    // Log this call to the call log table (fire-and-forget)
    const rawPhone = args["phone_number"] ?? args["patient_phone"] ?? null;
    const maskedPhone = maskPhone(rawPhone);
    const outcome = ACTION_OUTCOME[action] ?? "info";
    db.insert(hospitalCallLogTable)
      .values({ intent: action, outcome, patientPhone: maskedPhone })
      .catch(err => console.error("[HospitalReceptionist] call-log insert failed:", err));

    res.json({ success: true, data });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[HospitalReceptionist] ERROR action=${action}: ${msg}`);
    if (err instanceof Error && err.name === "AbortError") {
      res.status(504).json({ error: "Webhook timed out after 60 seconds" });
    } else {
      res.status(502).json({ error: `Webhook request failed: ${msg}` });
    }
  }
});

/* ── Campus Concierge — call log GET ── */
router.get("/agents/campus-concierge/call-log", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(campusConciergeCallLogTable)
    .orderBy(desc(campusConciergeCallLogTable.calledAt))
    .limit(50);
  res.json({ calls: rows });
});

/* ── Campus Concierge — Bolna outbound call ── */
router.post("/agents/campus-concierge/trigger", requireAuth, async (req, res): Promise<void> => {
  const { phoneNumber } = req.body as { phoneNumber?: string };

  if (!phoneNumber || typeof phoneNumber !== "string") {
    res.status(400).json({ error: "phoneNumber is required" });
    return;
  }

  const digits = phoneNumber.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) {
    res.status(400).json({ error: "phoneNumber must have 10–15 digits" });
    return;
  }

  const normalised = phoneNumber.trim().startsWith("+") ? phoneNumber.trim() : `+91${digits}`;

  const apiKey = process.env.BOLNA_API_KEY;
  const agentId = process.env.BOLNA_AGENT_ID;

  if (!apiKey || !agentId) {
    console.error("[CampusConcierge] Missing BOLNA_API_KEY or BOLNA_AGENT_ID env var");
    res.status(500).json({ error: "Bolna credentials not configured on the server" });
    return;
  }

  req.log.info({ phone: normalised }, "Campus Concierge Bolna call triggered");

  try {
    console.log('Bolna request:', {
      url: 'https://api.bolna.ai/call',
      agent_id: process.env.BOLNA_AGENT_ID,
      apiKeyExists: !!process.env.BOLNA_API_KEY,
      apiKeyPrefix: process.env.BOLNA_API_KEY?.substring(0, 8) + '...',
      recipient_phone_number: normalised,
    });

    const bolnaRes = await fetch("https://api.bolna.ai/call", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: agentId,
        recipient_phone_number: normalised,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const rawText = await bolnaRes.text();
    console.log('Bolna raw response:', { status: bolnaRes.status, body: rawText });

    let data: Record<string, unknown> = {};
    try { data = JSON.parse(rawText); } catch { data = { raw: rawText }; }

    if (!bolnaRes.ok) {
      const errMsg = (data.message ?? data.error ?? rawText).toString().slice(0, 200);
      res.status(502).json({ error: `Bolna error: ${errMsg}` });
      return;
    }

    const executionId = (data.execution_id ?? data.executionId ?? data.call_id ?? data.id) as string | undefined;

    db.insert(campusConciergeCallLogTable)
      .values({ phoneNumber: normalised, executionId: executionId ?? null, status: "triggered" })
      .catch(err => console.error("[CampusConcierge] call-log insert failed:", err));

    res.json({ executionId, status: "triggered" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[CampusConcierge] ERROR: ${msg}`);
    res.status(502).json({ error: `Failed to place call: ${msg}` });
  }
});

/* ── LinkedIn Management — n8n multi-agent content pipeline ── */
router.post("/agents/linkedin-management/trigger", requireAuth, async (req, res): Promise<void> => {
  const body = req.body as { topic?: string; category?: string; audience?: string };

  if (!body.topic || typeof body.topic !== "string" || !body.topic.trim()) {
    res.status(400).json({ error: "topic is required and must be a non-empty string" });
    return;
  }

  const payload = {
    Topic: body.topic.trim(),
    Category: (body.category?.trim()) || "General Professional",
    Audience: (body.audience?.trim()) || "Professionals and business leaders",
    Status: "Pending",
  };

  req.log.info({ topic: payload.Topic }, "LinkedIn Management content pipeline triggered");

  try {
    const n8nRes = await fetch("https://n8n.srv1042888.hstgr.cloud/webhook/linkedin-content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(300_000),
    });

    const responseText = await n8nRes.text();
    console.log(`[LinkedIn] n8n response status=${n8nRes.status} body=${responseText.slice(0, 300)}`);

    let data: Record<string, unknown> = {};
    try { data = JSON.parse(responseText); } catch { /* not JSON — use fallback */ }

    if (!n8nRes.ok) {
      const errMsg = ((data.message ?? data.error ?? responseText) as string).toString().slice(0, 200);
      res.status(502).json({ error: `Pipeline error: ${errMsg}` });
      return;
    }

    db.insert(linkedinSubmissionsTable)
      .values({
        topic: payload.Topic,
        category: payload.Category,
        audience: payload.Audience,
        status: "pending",
      })
      .catch(err => console.error("[LinkedIn] submission-log insert failed:", err));

    if (Object.keys(data).length === 0) {
      res.json({ status: "accepted", topic: payload.Topic, message: "Topic submitted to content pipeline" });
      return;
    }

    res.json({ ...data, status: "accepted", topic: payload.Topic });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[LinkedIn] ERROR: ${msg}`);
    res.status(502).json({ error: `Failed to submit to pipeline: ${msg}` });
  }
});

router.get("/agents/linkedin-management/submissions", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(linkedinSubmissionsTable)
    .orderBy(desc(linkedinSubmissionsTable.submittedAt))
    .limit(50);
  res.json(rows);
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
