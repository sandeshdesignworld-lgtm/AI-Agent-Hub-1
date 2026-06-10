import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { db, adminsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { AdminLoginBody, AdminLoginResponse, AdminLogoutResponse, GetAuthMeResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password } = parsed.data;

  const [admin] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.username, username));

  if (!admin) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  (req.session as any).adminId = admin.id;
  req.log.info({ adminId: admin.id }, "Admin logged in");

  res.json(AdminLoginResponse.parse({ id: admin.id, username: admin.username }));
});

router.post("/auth/logout", requireAuth, async (req, res): Promise<void> => {
  req.session.destroy((err) => {
    if (err) {
      req.log.error({ err }, "Error destroying session");
      res.status(500).json({ error: "Failed to logout" });
      return;
    }
    res.json(AdminLogoutResponse.parse({ success: true }));
  });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const adminId = (req.session as any).adminId as number;
  const [admin] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.id, adminId));

  if (!admin) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  res.json(GetAuthMeResponse.parse({ id: admin.id, username: admin.username }));
});

export default router;
