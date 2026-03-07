import bcrypt from "bcryptjs";
import crypto from "crypto";
import type express from "express";
// @ts-ignore
import nodemailer from "nodemailer";
import type { RouteDeps } from "../types";

export function registerAuthRoutes({
  app,
  db,
  config,
  state,
  helpers,
}: RouteDeps) {
  const handleAdminLogin = async (
    req: express.Request,
    res: express.Response,
    requiredRole?: "tenant_admin" | "super_admin"
  ) => {
    const ip = helpers.getClientIP(req);
    const now = Date.now();
    const rec = state.loginAttempts.get(ip);

    if (rec && now < rec.resetAt) {
      if (rec.count >= config.loginMaxAttempts) {
        return res.status(429).json({ error: "Too many login attempts. Please wait 15 minutes." });
      }
      rec.count++;
    } else {
      state.loginAttempts.set(ip, { count: 1, resetAt: now + config.loginWindowMs });
    }

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(
      (email as string).toLowerCase().trim()
    ) as any;

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    if (requiredRole && user.role !== requiredRole) {
      return res.status(403).json({
        error: requiredRole === "super_admin"
          ? "Super admin credentials required"
          : "Tenant admin credentials required",
      });
    }

    state.loginAttempts.delete(ip);

    const token = crypto.randomBytes(32).toString("hex");
    db.prepare("INSERT INTO admin_sessions (token, createdAt, user_id) VALUES (?, ?, ?)").run(
      token, new Date().toISOString(), user.id
    );
    db.prepare("UPDATE users SET lastLoginAt = ? WHERE id = ?").run(new Date().toISOString(), user.id);

    res.json({ token, role: user.role, email: user.email });
  };

  app.post("/api/admin/login", async (req, res) => handleAdminLogin(req, res));
  app.post("/api/admin/login/tenant", async (req, res) => handleAdminLogin(req, res, "tenant_admin"));
  app.post("/api/admin/login/super", async (req, res) => handleAdminLogin(req, res, "super_admin"));

  app.post("/api/admin/logout", helpers.requireAdmin, (req, res) => {
    const token = req.headers["x-admin-token"] as string;
    db.prepare("DELETE FROM admin_sessions WHERE token = ?").run(token);
    res.json({ status: "ok" });
  });

  app.get("/api/admin/verify", helpers.requireAdmin, (_req, res) => {
    res.json({ valid: true });
  });

  app.get("/api/auth/me", helpers.requireAdmin, (req, res) => {
    const user = helpers.getUserFromToken(req.headers["x-admin-token"] as string);
    if (!user) return res.status(401).json({ error: "Invalid or expired session" });
    res.json(user);
  });

  app.post("/api/auth/register", async (req, res) => {
    const { name, organization, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }
    if ((password as string).length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(
      (email as string).toLowerCase().trim()
    );
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const hash = await bcrypt.hash(password, 12);
    const userId = crypto.randomUUID();
    const tenantId = crypto.randomUUID();
    const orgName = (organization as string | undefined)?.trim() || (name as string).trim();
    const orgSlug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    db.prepare(
      "INSERT INTO users (id, email, password_hash, role, tenant_id, name, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(userId, (email as string).toLowerCase().trim(), hash, "tenant_admin", tenantId, (name as string).trim(), new Date().toISOString());

    db.prepare(
      "INSERT INTO tenants (id, name, slug, settings, plan, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(tenantId, orgName, orgSlug, JSON.stringify({}), "free", new Date().toISOString());
    helpers.ensureTenantCatalog(tenantId);
    helpers.ensureTenantSubscription(tenantId);

    const token = crypto.randomBytes(32).toString("hex");
    db.prepare("INSERT INTO admin_sessions (token, createdAt, user_id) VALUES (?, ?, ?)").run(
      token, new Date().toISOString(), userId
    );

    res.status(201).json({ token, role: "tenant_admin", email: (email as string).toLowerCase().trim(), organization: orgName });
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(
      (email as string).toLowerCase().trim()
    ) as any;

    if (!user) return res.json({ status: "ok" });

    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    db.prepare("UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?")
      .run(resetToken, expiry, user.id);

    const appUrl = process.env.APP_URL || "https://erp-queue-production.up.railway.app";
    const resetLink = `${appUrl}/?reset_token=${resetToken}`;

    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "localhost",
        port: Number(process.env.SMTP_PORT || 25),
        secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM || "no-reply@ssb.local",
        to: user.email,
        subject: "Password Reset Request",
        text: `You requested a password reset.\n\nClick the link below to reset your password (valid for 1 hour):\n\n${resetLink}\n\nIf you did not request this, you can ignore this email.`,
      });
    } catch (err) {
      console.error("[AUTH] Failed to send reset email:", err);
    }

    res.json({ status: "ok" });
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: "Token and password are required" });
    if ((password as string).length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

    const user = db.prepare("SELECT * FROM users WHERE reset_token = ?").get(token) as any;
    if (!user) return res.status(400).json({ error: "Invalid or expired reset link" });
    if (new Date(user.reset_token_expiry) < new Date()) {
      return res.status(400).json({ error: "Reset link has expired. Please request a new one." });
    }

    const hash = await bcrypt.hash(password, 12);
    db.prepare("UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?")
      .run(hash, user.id);
    db.prepare("DELETE FROM admin_sessions WHERE user_id = ?").run(user.id);

    res.json({ status: "ok" });
  });

  app.get("/api/admin/my-ip", (req, res) => {
    res.json({ ip: helpers.getClientIP(req) });
  });
}
