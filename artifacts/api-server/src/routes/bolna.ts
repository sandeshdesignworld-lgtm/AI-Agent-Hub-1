import { Router, type IRouter } from "express";
import { db, campusConciergeCallLogTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const BOLNA_BASE = "https://api.bolna.ai";

function getBolnaHeaders(): Record<string, string> {
  const key = process.env.BOLNA_API_KEY;
  if (!key) throw new Error("BOLNA_API_KEY environment variable is not set");
  return {
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

const webhookCache = new Map<string, Record<string, unknown>>();

/* ── GET /bolna/call-status/:executionId ── */
router.get("/bolna/call-status/:executionId", async (req, res): Promise<void> => {
  const { executionId } = req.params;
  if (!executionId) {
    res.status(400).json({ error: "executionId is required" });
    return;
  }

  const cached = webhookCache.get(executionId);

  try {
    let headers: Record<string, string>;
    try {
      headers = getBolnaHeaders();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
      return;
    }

    const bolnaRes = await fetch(`${BOLNA_BASE}/executions/${executionId}`, {
      headers,
      signal: AbortSignal.timeout(15_000),
    });

    const text = await bolnaRes.text();
    let apiData: Record<string, unknown> = {};
    try { apiData = JSON.parse(text); } catch { apiData = { raw: text }; }

    const merged: Record<string, unknown> = { ...apiData, ...cached };

    res.json({
      executionId,
      status:     merged.status     ?? merged.call_status     ?? "unknown",
      transcript: merged.transcript ?? merged.call_transcript ?? null,
      summary:    merged.summary    ?? merged.call_summary     ?? null,
      duration:   merged.duration   ?? merged.call_duration    ?? null,
      recording_url: merged.recording_url ?? null,
    });
  } catch (err: unknown) {
    if (cached) {
      res.json({
        executionId,
        status:     cached.status     ?? "unknown",
        transcript: cached.transcript ?? null,
        summary:    cached.summary    ?? null,
        duration:   cached.duration   ?? null,
        recording_url: cached.recording_url ?? null,
      });
      return;
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Bolna] call-status error executionId=${executionId}: ${msg}`);
    res.status(502).json({ error: `Failed to fetch call status: ${msg}` });
  }
});

/* ── POST /bolna/webhook ── */
router.post("/bolna/webhook", (req, res): void => {
  const body = req.body as Record<string, unknown>;
  console.log("[Bolna] Webhook received:", JSON.stringify(body).slice(0, 500));

  const execId = (body.execution_id ?? body.executionId ?? body.call_id) as string | undefined;
  if (execId) {
    const existing = webhookCache.get(execId) ?? {};
    webhookCache.set(execId, { ...existing, ...body });

    const merged: Record<string, unknown> = { ...existing, ...body };
    const status = (merged.status ?? merged.call_status) as string | undefined;
    const rawDuration = merged.duration ?? merged.call_duration;
    const duration = rawDuration != null ? parseInt(String(rawDuration), 10) || null : null;
    const summary = (merged.summary ?? merged.call_summary) as string | undefined;
    const transcript = (merged.transcript ?? merged.call_transcript) as string | undefined;

    const updateData: Partial<typeof campusConciergeCallLogTable.$inferInsert> = {};
    if (status) updateData.status = status;
    if (duration != null) updateData.duration = duration;
    if (summary) updateData.summary = summary;
    if (transcript) updateData.transcript = transcript;

    if (Object.keys(updateData).length > 0) {
      db.update(campusConciergeCallLogTable)
        .set(updateData)
        .where(eq(campusConciergeCallLogTable.executionId, execId))
        .catch(err => console.error("[Bolna] call-log update failed:", err));
    }
  }

  res.status(200).json({ received: true });
});

export default router;
