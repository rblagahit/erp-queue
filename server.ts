import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import archiver from "archiver";
import crypto from "crypto";
// @ts-ignore
import nodemailer from 'nodemailer';
// @ts-ignore
import PDFDocument from 'pdfkit';
import os from 'os';
import { promisify } from 'util';
const writeFile = promisify(fs.writeFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VALID_BRANCHES = new Set([
  "Carcar Branch", "Moalboal Branch", "Talisay Branch", "Carbon Branch",
  "Solinea Branch", "Mandaue Branch", "Danao Branch", "Bogo Branch", "Capitol Branch",
]);
const VALID_SERVICES = new Set([
  "Cash/Check Deposit", "Withdrawal", "Account Opening", "Customer Service", "Loans",
]);
const VALID_PRIORITIES = new Set(["Regular", "Priority"]);

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  // Trust proxy headers so req.ip works correctly behind reverse proxies
  app.set("trust proxy", 1);

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is live on port ${PORT}`);
    if (!process.env.ADMIN_PASSWORD) {
      console.warn(`[ADMIN] Warning: Using default admin password. Set ADMIN_EMAIL and ADMIN_PASSWORD env vars for production.`);
    }
  });

  app.use(express.json());

  // ===== DATABASE =====
  const db = new Database(path.join(__dirname, "ssb_queue.db"));
  db.exec(`
    CREATE TABLE IF NOT EXISTS queue (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'default',
      name TEXT,
      branch TEXT,
      service TEXT,
      priority TEXT,
      checkInTime TEXT,
      status TEXT,
      calledTime TEXT,
      completedTime TEXT
    );

    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'default',
      name TEXT,
      branch TEXT,
      service TEXT,
      priority TEXT,
      checkInTime TEXT,
      status TEXT,
      calledTime TEXT,
      completedTime TEXT
    );

    CREATE TABLE IF NOT EXISTS ip_whitelist (
      ip TEXT PRIMARY KEY,
      label TEXT,
      addedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      createdAt TEXT,
      user_id TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'tenant_admin',
      tenant_id TEXT DEFAULT 'default',
      createdAt TEXT,
      lastLoginAt TEXT,
      reset_token TEXT,
      reset_token_expiry TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT,
      slug TEXT,
      settings TEXT,
      createdAt TEXT
    );
  `);

  // Ensure tenant columns exist (for older DBs)
  const hasColumn = (table: string, col: string) => {
    const info = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
    return info.some((r) => r.name === col);
  };
  if (!hasColumn('queue', 'tenant_id')) {
    db.prepare(`ALTER TABLE queue ADD COLUMN tenant_id TEXT DEFAULT 'default'`).run();
  }
  if (!hasColumn('history', 'tenant_id')) {
    db.prepare(`ALTER TABLE history ADD COLUMN tenant_id TEXT DEFAULT 'default'`).run();
  }
  if (!hasColumn('admin_sessions', 'user_id')) {
    db.prepare(`ALTER TABLE admin_sessions ADD COLUMN user_id TEXT`).run();
  }
  if (!hasColumn('users', 'name')) {
    db.prepare(`ALTER TABLE users ADD COLUMN name TEXT DEFAULT ''`).run();
  }
  if (!hasColumn('tenants', 'plan')) {
    db.prepare(`ALTER TABLE tenants ADD COLUMN plan TEXT DEFAULT 'free'`).run();
  }

  // Seed default super_admin user if none exist
  const userCount = (db.prepare('SELECT COUNT(1) as c FROM users').get() as any).c as number;
  if (userCount === 0) {
    const email = process.env.ADMIN_EMAIL || 'admin@ssb.local';
    const rawPassword = process.env.ADMIN_PASSWORD || 'SSBAdmin2025!';
    const hash = await bcrypt.hash(rawPassword, 12);
    db.prepare(
      'INSERT INTO users (id, email, password_hash, role, tenant_id, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(crypto.randomUUID(), email, hash, 'super_admin', 'default', new Date().toISOString());
    console.log(`[AUTH] Seeded default admin: ${email}`);
  }

  // Clean expired sessions on startup and hourly thereafter
  const cleanSessions = () => {
    db.prepare("DELETE FROM admin_sessions WHERE createdAt < datetime('now', '-24 hours')").run();
  };
  cleanSessions();
  setInterval(cleanSessions, 60 * 60 * 1000);

  // ===== HELPERS =====
  const normalizeIP = (ip: string): string => {
    if (!ip) return "";
    if (ip === "::1") return "127.0.0.1";
    return ip.replace("::ffff:", "");
  };

  const getClientIP = (req: express.Request): string => {
    const forwarded = req.headers["x-forwarded-for"];
    const raw = forwarded
      ? (typeof forwarded === "string" ? forwarded : forwarded[0]).split(",")[0].trim()
      : req.socket.remoteAddress || "";
    return normalizeIP(raw);
  };

  const requireAdmin = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const token = req.headers["x-admin-token"] as string;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const session = db.prepare("SELECT token FROM admin_sessions WHERE token = ?").get(token);
    if (!session) return res.status(401).json({ error: "Invalid or expired session" });
    next();
  };

  const requireSuperAdmin = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const token = req.headers["x-admin-token"] as string;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const session = db.prepare("SELECT user_id FROM admin_sessions WHERE token = ?").get(token) as any;
    if (!session) return res.status(401).json({ error: "Invalid or expired session" });
    const user = db.prepare("SELECT role FROM users WHERE id = ?").get(session.user_id) as any;
    if (!user || user.role !== 'super_admin') return res.status(403).json({ error: "Super admin access required" });
    next();
  };

  const getUserFromToken = (token: string) => {
    const session = db.prepare("SELECT user_id FROM admin_sessions WHERE token = ?").get(token) as any;
    if (!session?.user_id) return null;
    return db.prepare("SELECT * FROM users WHERE id = ?").get(session.user_id) as any;
  };

  const checkIPAccess = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const whitelist = (
      db.prepare("SELECT ip FROM ip_whitelist").all() as { ip: string }[]
    ).map((r) => r.ip);

    // If no IPs are configured, allow all (setup mode)
    if (whitelist.length === 0) return next();

    const clientIP = getClientIP(req);
    if (whitelist.includes(clientIP)) return next();

    return res.status(403).json({
      error: `Access denied. IP address ${clientIP} is not authorized to access this queue.`,
    });
  };

  // ===== WEBSOCKET BROADCAST =====
  const broadcast = (data: any) => {
    wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  };

  // ===== UTILITY ROUTES =====

  // Protected: only admins can download the source code
  app.get("/api/download", requireAdmin, (_req, res) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    res.attachment("project_source.zip");
    archive.on("error", (err: Error) => { res.status(500).send({ error: err.message }); });
    archive.pipe(res);
    const rootDir = process.cwd();
    fs.readdirSync(rootDir).forEach((item) => {
      const fullPath = path.join(rootDir, item);
      const isDir = fs.lstatSync(fullPath).isDirectory();
      if (isDir) {
        if (!["node_modules", "dist", ".git", ".next"].includes(item)) {
          archive.directory(fullPath, item);
        }
      } else {
        if (!["project_source.zip", "ssb_queue.db", "ssb_queue.db-journal"].includes(item)) {
          archive.file(fullPath, { name: item });
        }
      }
    });
    archive.finalize();
  });

  app.get("/health", (_req, res) => res.send("OK - Health Check Passed"));

  app.get("/api/diag", (_req, res) => {
    const distPath = path.resolve(__dirname, "dist");
    res.json({
      nodeEnv: process.env.NODE_ENV,
      cwd: process.cwd(),
      dirname: __dirname,
      distExists: fs.existsSync(distPath),
      distFiles: fs.existsSync(distPath) ? fs.readdirSync(distPath) : [],
      indexExists: fs.existsSync(path.join(distPath, "index.html")),
    });
  });

  // ===== ADMIN ROUTES =====

  // Simple in-memory rate limiter for login attempts
  const loginAttempts = new Map<string, { count: number; resetAt: number }>();
  const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  const LOGIN_MAX_ATTEMPTS = 5;

  app.post("/api/admin/login", async (req, res) => {
    const ip = getClientIP(req);
    const now = Date.now();
    const rec = loginAttempts.get(ip);

    if (rec && now < rec.resetAt) {
      if (rec.count >= LOGIN_MAX_ATTEMPTS) {
        return res.status(429).json({ error: "Too many login attempts. Please wait 15 minutes." });
      }
      rec.count++;
    } else {
      loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
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

    loginAttempts.delete(ip);

    const token = crypto.randomBytes(32).toString("hex");
    db.prepare("INSERT INTO admin_sessions (token, createdAt, user_id) VALUES (?, ?, ?)").run(
      token, new Date().toISOString(), user.id
    );
    db.prepare("UPDATE users SET lastLoginAt = ? WHERE id = ?").run(new Date().toISOString(), user.id);

    res.json({ token, role: user.role, email: user.email });
  });

  app.post("/api/admin/logout", requireAdmin, (req, res) => {
    const token = req.headers["x-admin-token"] as string;
    db.prepare("DELETE FROM admin_sessions WHERE token = ?").run(token);
    res.json({ status: "ok" });
  });

  app.get("/api/admin/verify", requireAdmin, (_req, res) => {
    res.json({ valid: true });
  });

  app.get("/api/auth/me", requireAdmin, (req, res) => {
    const token = req.headers["x-admin-token"] as string;
    const session = db.prepare("SELECT user_id FROM admin_sessions WHERE token = ?").get(token) as any;
    if (!session?.user_id) return res.json({ role: 'super_admin', email: 'legacy' });
    const user = db.prepare("SELECT id, email, role, tenant_id FROM users WHERE id = ?").get(session.user_id) as any;
    res.json(user || { role: 'super_admin', email: 'unknown' });
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
    const orgSlug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    db.prepare(
      "INSERT INTO users (id, email, password_hash, role, tenant_id, name, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(userId, (email as string).toLowerCase().trim(), hash, "tenant_admin", tenantId, (name as string).trim(), new Date().toISOString());

    db.prepare(
      "INSERT INTO tenants (id, name, slug, settings, plan, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(tenantId, orgName, orgSlug, JSON.stringify({}), 'free', new Date().toISOString());

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

    // Always return ok to prevent user enumeration
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

  // Returns the calling client's IP address
  app.get("/api/admin/my-ip", (req, res) => {
    res.json({ ip: getClientIP(req) });
  });

  app.get("/api/admin/ips", requireAdmin, (_req, res) => {
    const rows = db.prepare("SELECT * FROM ip_whitelist ORDER BY addedAt DESC").all();
    res.json(rows);
  });

  app.post("/api/admin/ips", requireAdmin, (req, res) => {
    const { ip, label } = req.body;
    if (!ip) return res.status(400).json({ error: "IP address is required" });
    try {
      db.prepare(
        "INSERT OR REPLACE INTO ip_whitelist (ip, label, addedAt) VALUES (?, ?, ?)"
      ).run(normalizeIP(ip.trim()), label?.trim() || "", new Date().toISOString());
      res.json({ status: "ok" });
    } catch {
      res.status(500).json({ error: "Failed to add IP" });
    }
  });

  app.delete("/api/admin/ips/:ip", requireAdmin, (req, res) => {
    db.prepare("DELETE FROM ip_whitelist WHERE ip = ?").run(req.params.ip);
    res.json({ status: "ok" });
  });

  // API Key settings — returns masked key only (never the raw value)
  app.get("/api/admin/settings", requireAdmin, (_req, res) => {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'apiKey'").get() as { value: string } | undefined;
    const key = row?.value ?? "";
    const masked = key.length > 12
      ? `${key.slice(0, 8)}${"•".repeat(key.length - 12)}${key.slice(-4)}`
      : "•".repeat(key.length);
    res.json({ configured: key.length > 0, masked });
  });

  app.post("/api/admin/settings", requireAdmin, (req, res) => {
    const { apiKey } = req.body;
    if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
      return res.status(400).json({ error: "apiKey must be a non-empty string" });
    }
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('apiKey', ?)").run(apiKey.trim());
    res.json({ status: "ok" });
  });

  app.delete("/api/admin/settings/apikey", requireAdmin, (_req, res) => {
    db.prepare("DELETE FROM settings WHERE key = 'apiKey'").run();
    res.json({ status: "ok" });
  });

  // ===== SMTP SETTINGS =====

  app.get("/api/admin/smtp", requireAdmin, (req, res) => {
    const user = getUserFromToken(req.headers["x-admin-token"] as string);
    if (!user) return res.json({});
    const tenant = db.prepare("SELECT settings FROM tenants WHERE id = ?").get(user.tenant_id) as any;
    const settings = tenant?.settings ? JSON.parse(tenant.settings) : {};
    const smtp = settings.smtp || {};
    res.json({
      host: smtp.host || '',
      port: smtp.port || 587,
      secure: smtp.secure || false,
      user: smtp.auth?.user || '',
      from: smtp.from || '',
      to: settings.email_contact || '',
      configured: !!(smtp.host),
    });
  });

  app.post("/api/admin/smtp", requireAdmin, (req, res) => {
    const { host, port, secure, user, pass, from, to } = req.body;
    const dbUser = getUserFromToken(req.headers["x-admin-token"] as string);
    if (!dbUser) return res.status(401).json({ error: "Session invalid" });
    const tenant = db.prepare("SELECT settings FROM tenants WHERE id = ?").get(dbUser.tenant_id) as any;
    const currentSettings = tenant?.settings ? JSON.parse(tenant.settings) : {};
    const smtp: any = { host: host || '', port: Number(port) || 587, secure: !!secure };
    if (user) smtp.auth = { user, pass: pass || currentSettings.smtp?.auth?.pass || '' };
    if (from) smtp.from = from;
    const newSettings = { ...currentSettings, smtp, email_contact: to || currentSettings.email_contact || '' };
    db.prepare("UPDATE tenants SET settings = ? WHERE id = ?").run(JSON.stringify(newSettings), dbUser.tenant_id);
    res.json({ status: "ok" });
  });

  // ===== PDF DOWNLOAD =====

  app.get("/api/admin/report/pdf", requireAdmin, async (req, res) => {
    const { from, to, branch } = req.query;
    const dbUser = getUserFromToken(req.headers["x-admin-token"] as string);
    const tenantId = dbUser?.tenant_id || 'all';
    const fromDate = (from as string) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const toDate = (to as string) || new Date().toISOString().slice(0, 10);
    try {
      const pdfPath = await generatePDF(tenantId, fromDate, toDate, branch as string | undefined);
      const filename = `report-${fromDate}-to-${toDate}.pdf`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/pdf');
      const fileStream = fs.createReadStream(pdfPath);
      fileStream.pipe(res);
      fileStream.on('end', () => { try { fs.unlinkSync(pdfPath); } catch {} });
      fileStream.on('error', () => { try { fs.unlinkSync(pdfPath); } catch {} res.status(500).end(); });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to generate PDF' });
    }
  });

  // ===== SEND REPORT ON-DEMAND =====

  app.post("/api/admin/report/send", requireAdmin, async (req, res) => {
    const { period } = req.body;
    const dbUser = getUserFromToken(req.headers["x-admin-token"] as string);
    const tenantId = dbUser?.tenant_id;
    if (!tenantId) return res.status(400).json({ error: 'No tenant found' });
    try {
      await generateAndSendReport(tenantId, period === 'monthly' ? 'monthly' : 'daily');
      res.json({ status: 'ok' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to send report' });
    }
  });

  // ===== TENANT MANAGEMENT (super_admin only) =====

  app.get("/api/admin/tenants", requireSuperAdmin, (_req, res) => {
    const tenants = db.prepare(`
      SELECT t.id, t.name, t.slug, t.plan, t.createdAt, COUNT(u.id) as userCount
      FROM tenants t
      LEFT JOIN users u ON u.tenant_id = t.id
      GROUP BY t.id
      ORDER BY t.createdAt DESC
    `).all();
    res.json(tenants);
  });

  app.put("/api/admin/tenants/:id", requireSuperAdmin, (req, res) => {
    const { name, plan } = req.body;
    const { id } = req.params;
    if (name) db.prepare("UPDATE tenants SET name = ? WHERE id = ?").run((name as string).trim(), id);
    if (plan) db.prepare("UPDATE tenants SET plan = ? WHERE id = ?").run(plan, id);
    res.json({ status: "ok" });
  });

  app.delete("/api/admin/tenants/:id", requireSuperAdmin, (req, res) => {
    const { id } = req.params;
    if (id === 'default') return res.status(400).json({ error: "Cannot delete the default tenant" });
    db.prepare("DELETE FROM admin_sessions WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)").run(id);
    db.prepare("DELETE FROM users WHERE tenant_id = ?").run(id);
    db.prepare("DELETE FROM tenants WHERE id = ?").run(id);
    res.json({ status: "ok" });
  });

  // ===== USER MANAGEMENT (super_admin only) =====

  app.get("/api/admin/users", requireSuperAdmin, (_req, res) => {
    const users = db.prepare(`
      SELECT u.id, u.email, u.name, u.role, u.tenant_id, u.createdAt, u.lastLoginAt,
             t.name as tenantName
      FROM users u
      LEFT JOIN tenants t ON t.id = u.tenant_id
      ORDER BY u.createdAt DESC
    `).all();
    res.json(users);
  });

  app.put("/api/admin/users/:id", requireSuperAdmin, (req, res) => {
    const { role } = req.body;
    if (!['tenant_admin', 'super_admin'].includes(role)) {
      return res.status(400).json({ error: "Invalid role. Must be tenant_admin or super_admin" });
    }
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, req.params.id);
    res.json({ status: "ok" });
  });

  app.delete("/api/admin/users/:id", requireSuperAdmin, (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM admin_sessions WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
    res.json({ status: "ok" });
  });

  // Filtered history for admin CSV export
  app.get("/api/admin/history", requireAdmin, (req, res) => {
    const { from, to, branch } = req.query;
    let query = "SELECT * FROM history WHERE 1=1";
    const params: string[] = [];

    if (from) {
      query += " AND date(completedTime) >= date(?)";
      params.push(from as string);
    }
    if (to) {
      query += " AND date(completedTime) <= date(?)";
      params.push(to as string);
    }
    if (branch && branch !== "All") {
      query += " AND branch = ?";
      params.push(branch as string);
    }

    query += " ORDER BY completedTime DESC";
    const rows = db.prepare(query).all(...params);
    res.json(rows);
  });

  // ===== REPORTING HELPERS =====
  const getTenant = (tenantId: string) => {
    return db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId) as any;
  };

  const ensureDefaultTenant = () => {
    const count = (db.prepare('SELECT COUNT(1) as c FROM tenants').get() as any).c as number;
    if (count === 0) {
      db.prepare('INSERT INTO tenants (id, name, slug, settings, createdAt) VALUES (?, ?, ?, ?, ?)')
        .run('default', 'Default Tenant', 'default', JSON.stringify({ monthly_quota: 10000 }), new Date().toISOString());
    }
  };
  ensureDefaultTenant();

  const generateCSV = async (tenantId: string, fromDate: string, toDate: string) => {
    const rows = db.prepare('SELECT * FROM history WHERE date(completedTime) >= date(?) AND date(completedTime) <= date(?) AND (tenant_id = ? OR ? = "all") ORDER BY completedTime DESC')
      .all(fromDate, toDate, tenantId, tenantId) as any[];

    const headers = ['id','tenant_id','name','branch','service','priority','checkInTime','calledTime','completedTime'];
    const lines = [headers.join(',')];
    for (const r of rows) {
      lines.push(headers.map(h => (r[h] ?? '').toString().replace(/\n/g,' ')).join(','));
    }
    const csv = lines.join('\n');
    const filePath = path.join(os.tmpdir(), `report-${tenantId}-${Date.now()}.csv`);
    await writeFile(filePath, csv, 'utf8');
    return filePath;
  };

  const generatePDF = async (tenantId: string, fromDate: string, toDate: string, branch?: string) => {
    const filePath = path.join(os.tmpdir(), `report-${tenantId}-${Date.now()}.pdf`);
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    doc.fontSize(14).text(`Tenant Report: ${tenantId}`, { align: 'center' });
    doc.fontSize(10).text(`Period: ${fromDate} -> ${toDate}${branch && branch !== 'All' ? ` | Branch: ${branch}` : ''}`);
    doc.moveDown();
    const rows: any[] = branch && branch !== 'All'
      ? db.prepare('SELECT * FROM history WHERE date(completedTime) >= date(?) AND date(completedTime) <= date(?) AND (tenant_id = ? OR ? = "all") AND branch = ? ORDER BY completedTime DESC')
          .all(fromDate, toDate, tenantId, tenantId, branch) as any[]
      : db.prepare('SELECT * FROM history WHERE date(completedTime) >= date(?) AND date(completedTime) <= date(?) AND (tenant_id = ? OR ? = "all") ORDER BY completedTime DESC')
          .all(fromDate, toDate, tenantId, tenantId) as any[];
    for (const r of rows) {
      doc.fontSize(9).text(`${r.completedTime} | ${r.branch} | ${r.service} | ${r.name}`);
    }
    doc.end();
    await new Promise<void>((resolve) => stream.on('finish', () => resolve()));
    return filePath;
  };

  const sendMailWithAttachments = async (to: string, subject: string, text: string, files: { path: string; filename?: string }[], tenantSettings: any) => {
    const smtp = tenantSettings?.smtp || {
      host: process.env.SMTP_HOST || 'localhost',
      port: Number(process.env.SMTP_PORT || 25),
      secure: (process.env.SMTP_SECURE === 'true') || false,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    };

    const transporter = nodemailer.createTransport(smtp as any);
    await transporter.sendMail({
      from: tenantSettings?.smtp?.from || process.env.SMTP_FROM || 'no-reply@example.com',
      to,
      subject,
      text,
      attachments: files.map(f => ({ filename: f.filename || path.basename(f.path), path: f.path }))
    });
  };

  const generateAndSendReport = async (tenantId: string, period: 'daily' | 'monthly') => {
    const tenant = getTenant(tenantId) || { settings: '{}' };
    const settings = tenant.settings ? JSON.parse(tenant.settings) : {};
    const to = settings?.email_contact || settings?.admin_email || process.env.ADMIN_EMAIL || 'admin@example.com';
    const now = new Date();
    let fromDate: string;
    let toDate: string;
    if (period === 'daily') {
      const d = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      fromDate = d.toISOString().slice(0,10);
      toDate = fromDate;
    } else {
      const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      fromDate = d.toISOString().slice(0,10);
      toDate = now.toISOString().slice(0,10);
    }

    const csvPath = await generateCSV(tenantId, fromDate, toDate);
    const pdfPath = await generatePDF(tenantId, fromDate, toDate);

    const subject = `Usage Report (${period}) for ${tenant?.name || tenantId}`;
    const text = `Attached is the ${period} usage report for ${tenant?.name || tenantId} (${fromDate} to ${toDate}).`;
    await sendMailWithAttachments(to, subject, text, [{ path: csvPath }, { path: pdfPath }], settings);
    try { fs.unlinkSync(csvPath); } catch {};
    try { fs.unlinkSync(pdfPath); } catch {};
  };

  // Schedule daily reports at 01:00 server time
  const scheduleDailyReports = () => {
    const now = new Date();
    const next = new Date();
    next.setHours(1,0,0,0);
    if (next <= now) next.setDate(next.getDate() + 1);
    const delay = next.getTime() - now.getTime();
    setTimeout(() => {
      const tenants = db.prepare('SELECT id FROM tenants').all() as any[];
      for (const t of tenants) {
        generateAndSendReport(t.id, 'daily').catch(e => console.error('Scheduled report failed', e));
      }
      setInterval(() => {
        const tenants = db.prepare('SELECT id FROM tenants').all() as any[];
        for (const t of tenants) {
          generateAndSendReport(t.id, 'daily').catch(e => console.error('Scheduled report failed', e));
        }
      }, 24 * 60 * 60 * 1000);
    }, delay);
  };
  scheduleDailyReports();
  
  // Tenant report trigger (admin) - generates CSV and PDF and emails to tenant contact
  app.post('/api/tenants/:id/report', requireAdmin, async (req, res) => {
    const tenantId = req.params.id;
    const period = req.query.period === 'monthly' ? 'monthly' : 'daily';
    try {
      await generateAndSendReport(tenantId, period as 'daily' | 'monthly');
      res.json({ status: 'ok' });
    } catch (err: any) {
      console.error('Report error', err);
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  // ===== QUEUE API ROUTES =====

  app.get("/api/queue", (req, res) => {
    const token = req.headers["x-admin-token"] as string | undefined;
    const user = token ? getUserFromToken(token) : null;
    const rows = user?.tenant_id
      ? db.prepare("SELECT * FROM queue WHERE tenant_id = ? ORDER BY CASE WHEN priority='Priority' THEN 0 ELSE 1 END, checkInTime ASC").all(user.tenant_id)
      : db.prepare("SELECT * FROM queue ORDER BY CASE WHEN priority='Priority' THEN 0 ELSE 1 END, checkInTime ASC").all();
    res.json(rows);
  });

  // No LIMIT — analytics need complete history
  app.get("/api/history", (req, res) => {
    const token = req.headers["x-admin-token"] as string | undefined;
    const user = token ? getUserFromToken(token) : null;
    const rows = user?.tenant_id
      ? db.prepare("SELECT * FROM history WHERE tenant_id = ? ORDER BY completedTime DESC").all(user.tenant_id)
      : db.prepare("SELECT * FROM history ORDER BY completedTime DESC").all();
    res.json(rows);
  });

  // IP-protected: only whitelisted IPs can add to the queue
  app.post("/api/queue", checkIPAccess, (req, res) => {
    const entry = req.body;

    // Validate all fields
    if (!entry.name || typeof entry.name !== "string" || entry.name.trim().length === 0) {
      return res.status(400).json({ error: "Invalid name" });
    }
    if (!VALID_BRANCHES.has(entry.branch)) {
      return res.status(400).json({ error: "Invalid branch" });
    }
    if (!VALID_SERVICES.has(entry.service)) {
      return res.status(400).json({ error: "Invalid service" });
    }
    if (!VALID_PRIORITIES.has(entry.priority)) {
      return res.status(400).json({ error: "Invalid priority" });
    }

    const tenantId = entry.tenant_id || 'default';
    db.prepare(`
      INSERT INTO queue (id, tenant_id, name, branch, service, priority, checkInTime, status, calledTime, completedTime)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.id, tenantId, entry.name.trim(), entry.branch, entry.service,
      entry.priority, entry.checkInTime, "Waiting",
      null, null
    );
    broadcast({ type: "QUEUE_UPDATED" });
    res.json({ status: "ok" });
  });

  app.post("/api/call", (req, res) => {
    const { id, calledTime } = req.body;
    db.prepare("UPDATE queue SET status = 'Processing', calledTime = ? WHERE id = ?").run(
      calledTime, id
    );
    broadcast({ type: "QUEUE_UPDATED" });
    res.json({ status: "ok" });
  });

  app.post("/api/complete", (req, res) => {
    const { id, completedTime } = req.body;
    const item = db.prepare("SELECT * FROM queue WHERE id = ?").get(id) as any;
    if (item) {
      db.prepare(`
        INSERT INTO history (id, tenant_id, name, branch, service, priority, checkInTime, status, calledTime, completedTime)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.id, item.tenant_id || 'default', item.name, item.branch, item.service, item.priority,
        item.checkInTime, "Completed", item.calledTime, completedTime
      );
      db.prepare("DELETE FROM queue WHERE id = ?").run(id);
      broadcast({ type: "QUEUE_UPDATED" });
      broadcast({ type: "HISTORY_UPDATED" });
    }
    res.json({ status: "ok" });
  });

  // ===== VITE / STATIC =====
  const isDev = process.env.NODE_ENV === "development";
  console.log(`[STARTUP] isDev: ${isDev}`);

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    console.log(`[STARTUP] Serving static from: ${distPath}`);
    app.use(express.static(distPath));
    app.get("*", (req, res, next) => {
      if (req.url.startsWith("/api")) return next();
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

startServer().catch(console.error);
