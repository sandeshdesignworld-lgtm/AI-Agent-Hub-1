import { Router, type IRouter } from "express";
import healthRouter from "./health";
import agentsRouter from "./agents";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(agentsRouter);
router.use(authRouter);

export default router;
