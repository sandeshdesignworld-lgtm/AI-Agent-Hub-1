import { Router, type IRouter } from "express";
import healthRouter from "./health";
import agentsRouter from "./agents";
import authRouter from "./auth";
import bolnaRouter from "./bolna";

const router: IRouter = Router();

router.use(healthRouter);
router.use(agentsRouter);
router.use(authRouter);
router.use(bolnaRouter);

export default router;
