import { Router, type IRouter } from "express";
import { db, agentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ListAgentsResponse, GetAgentResponse, GetAgentParams } from "@workspace/api-zod";

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

export default router;
