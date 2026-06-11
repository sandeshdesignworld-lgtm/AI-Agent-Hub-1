import { Router, type IRouter } from "express";
import { db, agentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ListAgentsResponse, GetAgentResponse, GetAgentParams, TriggerAgentParams, TriggerAgentBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

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

  req.log.info({ slug: params.data.slug, entries: body.data.entries.length }, "Triggering agent webhook");

  const webhookResponse = await fetch(agent.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entries: body.data.entries }),
  });

  if (!webhookResponse.ok) {
    const text = await webhookResponse.text();
    req.log.error({ status: webhookResponse.status, body: text }, "Webhook returned error");
    res.status(502).json({ error: `Webhook error: ${webhookResponse.status}` });
    return;
  }

  const responseText = await webhookResponse.text();
  req.log.info({ slug: params.data.slug }, "Webhook response received");

  res.json({ success: true, summary: responseText });
});

export default router;
