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
import crypto from "crypto";
// @ts-ignore
import nodemailer from 'nodemailer';
// @ts-ignore
import PDFDocument from 'pdfkit';
import os from 'os';
import { promisify } from 'util';
import { registerAuthRoutes } from "./server/routes/auth";
import { registerAdminRoutes } from "./server/routes/admin";
import { registerBillingRoutes } from "./server/routes/billing";
import { registerQueueRoutes } from "./server/routes/queue";
import type { AppConfig, AppHelpers, AppPaths, CreateAppOptions } from "./server/types";
const writeFile = promisify(fs.writeFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TENANT_LOGO_DIR = path.join(__dirname, "tenant-logos");
if (!fs.existsSync(TENANT_LOGO_DIR)) {
  fs.mkdirSync(TENANT_LOGO_DIR, { recursive: true });
}
const BILLING_FILES_DIR = path.join(__dirname, "billing-files");
const PAYMENT_PROOFS_DIR = path.join(BILLING_FILES_DIR, "proofs");
const RECEIPTS_DIR = path.join(BILLING_FILES_DIR, "receipts");
const BILLING_QR_DIR = path.join(BILLING_FILES_DIR, "qr");
for (const dir of [BILLING_FILES_DIR, PAYMENT_PROOFS_DIR, RECEIPTS_DIR, BILLING_QR_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const DEFAULT_BRANCHES = [
  "Carcar Branch", "Moalboal Branch", "Talisay Branch", "Carbon Branch",
  "Solinea Branch", "Mandaue Branch", "Danao Branch", "Bogo Branch", "Capitol Branch",
];
const DEFAULT_SERVICES = [
  "Cash/Check Deposit", "Withdrawal", "Account Opening", "Customer Service", "Loans",
];
const VALID_PRIORITIES = new Set(["Regular", "Priority"]);
const VALID_CUSTOMER_TERMS = new Set(["customer", "client", "patient", "citizen"]);

const PLAN_LIMITS: Record<string, { maxBranches: number | null; maxServices: number | null }> = {
  free: { maxBranches: 1, maxServices: 5 },
  starter: { maxBranches: 9, maxServices: 15 },
  pro: { maxBranches: null, maxServices: null },
};
const PLAN_PRICES: Record<string, number> = {
  free: 0,
  starter: 999,
  pro: 2499,
};
const isDev = process.env.NODE_ENV === "development";

export async function createSmartQueueServer(options: CreateAppOptions = {}) {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  const shouldListen = options.listen ?? false;
  const serveFrontend = options.serveFrontend ?? true;
  const enableSchedules = options.enableSchedules ?? true;
  const listenHost = options.host || "0.0.0.0";
  const listenPort = options.port ?? (Number(process.env.PORT) || 3000);
  const cleanupTimers: NodeJS.Timeout[] = [];

  // Only trust proxy headers when the deployment explicitly opts in.
  app.set("trust proxy", process.env.TRUST_PROXY === "true");

  app.use(express.json());
  app.use("/tenant-logos", express.static(TENANT_LOGO_DIR));
  app.use("/billing-files", express.static(BILLING_FILES_DIR));

  // ===== DATABASE =====
  const db = new Database(options.dbPath || path.join(__dirname, "ssb_queue.db"));
  db.exec(`
    CREATE TABLE IF NOT EXISTS queue (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'default',
      name TEXT,
      branch TEXT,
      service TEXT,
      priority TEXT,
      source_channel TEXT,
      sla_target_minutes INTEGER DEFAULT 10,
      checkInTime TEXT,
      status TEXT,
      first_called_time TEXT,
      calledTime TEXT,
      completedTime TEXT,
      paused_at TEXT,
      reassign_count INTEGER DEFAULT 0,
      handled_by_user_id TEXT,
      handled_by_email TEXT,
      outcome TEXT,
      breach_reason TEXT,
      no_show_reason TEXT,
      pause_reason TEXT,
      resolution_code TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'default',
      name TEXT,
      branch TEXT,
      service TEXT,
      priority TEXT,
      source_channel TEXT,
      sla_target_minutes INTEGER DEFAULT 10,
      checkInTime TEXT,
      status TEXT,
      first_called_time TEXT,
      calledTime TEXT,
      completedTime TEXT,
      paused_at TEXT,
      reassign_count INTEGER DEFAULT 0,
      handled_by_user_id TEXT,
      handled_by_email TEXT,
      outcome TEXT,
      breach_reason TEXT,
      no_show_reason TEXT,
      pause_reason TEXT,
      resolution_code TEXT,
      notes TEXT
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

    CREATE TABLE IF NOT EXISTS tenant_branches (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      createdAt TEXT,
      UNIQUE(tenant_id, name)
    );

    CREATE TABLE IF NOT EXISTS tenant_services (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      createdAt TEXT,
      UNIQUE(tenant_id, name)
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      tenant_id TEXT PRIMARY KEY,
      plan TEXT NOT NULL DEFAULT 'free',
      status TEXT NOT NULL DEFAULT 'active',
      period_start TEXT,
      period_end TEXT,
      grace_days INTEGER NOT NULL DEFAULT 5,
      amount REAL NOT NULL DEFAULT 0,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS payment_submissions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      desired_plan TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      reference_code TEXT,
      proof_url TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      submittedAt TEXT,
      reviewedAt TEXT,
      reviewed_by TEXT
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      payment_submission_id TEXT,
      receipt_no TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      plan TEXT,
      period_start TEXT,
      period_end TEXT,
      pdf_url TEXT,
      createdAt TEXT,
      created_by TEXT
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
  if (!hasColumn('queue', 'notes')) {
    db.prepare(`ALTER TABLE queue ADD COLUMN notes TEXT`).run();
  }
  if (!hasColumn('history', 'notes')) {
    db.prepare(`ALTER TABLE history ADD COLUMN notes TEXT`).run();
  }
  if (!hasColumn('queue', 'source_channel')) {
    db.prepare(`ALTER TABLE queue ADD COLUMN source_channel TEXT`).run();
  }
  if (!hasColumn('history', 'source_channel')) {
    db.prepare(`ALTER TABLE history ADD COLUMN source_channel TEXT`).run();
  }
  if (!hasColumn('queue', 'sla_target_minutes')) {
    db.prepare(`ALTER TABLE queue ADD COLUMN sla_target_minutes INTEGER DEFAULT 10`).run();
  }
  if (!hasColumn('history', 'sla_target_minutes')) {
    db.prepare(`ALTER TABLE history ADD COLUMN sla_target_minutes INTEGER DEFAULT 10`).run();
  }
  if (!hasColumn('queue', 'first_called_time')) {
    db.prepare(`ALTER TABLE queue ADD COLUMN first_called_time TEXT`).run();
  }
  if (!hasColumn('history', 'first_called_time')) {
    db.prepare(`ALTER TABLE history ADD COLUMN first_called_time TEXT`).run();
  }
  if (!hasColumn('queue', 'reassign_count')) {
    db.prepare(`ALTER TABLE queue ADD COLUMN reassign_count INTEGER DEFAULT 0`).run();
  }
  if (!hasColumn('history', 'reassign_count')) {
    db.prepare(`ALTER TABLE history ADD COLUMN reassign_count INTEGER DEFAULT 0`).run();
  }
  if (!hasColumn('queue', 'handled_by_user_id')) {
    db.prepare(`ALTER TABLE queue ADD COLUMN handled_by_user_id TEXT`).run();
  }
  if (!hasColumn('history', 'handled_by_user_id')) {
    db.prepare(`ALTER TABLE history ADD COLUMN handled_by_user_id TEXT`).run();
  }
  if (!hasColumn('queue', 'handled_by_email')) {
    db.prepare(`ALTER TABLE queue ADD COLUMN handled_by_email TEXT`).run();
  }
  if (!hasColumn('history', 'handled_by_email')) {
    db.prepare(`ALTER TABLE history ADD COLUMN handled_by_email TEXT`).run();
  }
  if (!hasColumn('queue', 'outcome')) {
    db.prepare(`ALTER TABLE queue ADD COLUMN outcome TEXT`).run();
  }
  if (!hasColumn('history', 'outcome')) {
    db.prepare(`ALTER TABLE history ADD COLUMN outcome TEXT`).run();
  }
  if (!hasColumn('queue', 'breach_reason')) {
    db.prepare(`ALTER TABLE queue ADD COLUMN breach_reason TEXT`).run();
  }
  if (!hasColumn('history', 'breach_reason')) {
    db.prepare(`ALTER TABLE history ADD COLUMN breach_reason TEXT`).run();
  }
  if (!hasColumn('queue', 'no_show_reason')) {
    db.prepare(`ALTER TABLE queue ADD COLUMN no_show_reason TEXT`).run();
  }
  if (!hasColumn('history', 'no_show_reason')) {
    db.prepare(`ALTER TABLE history ADD COLUMN no_show_reason TEXT`).run();
  }
  if (!hasColumn('queue', 'paused_at')) {
    db.prepare(`ALTER TABLE queue ADD COLUMN paused_at TEXT`).run();
  }
  if (!hasColumn('history', 'paused_at')) {
    db.prepare(`ALTER TABLE history ADD COLUMN paused_at TEXT`).run();
  }
  if (!hasColumn('queue', 'pause_reason')) {
    db.prepare(`ALTER TABLE queue ADD COLUMN pause_reason TEXT`).run();
  }
  if (!hasColumn('history', 'pause_reason')) {
    db.prepare(`ALTER TABLE history ADD COLUMN pause_reason TEXT`).run();
  }
  if (!hasColumn('queue', 'resolution_code')) {
    db.prepare(`ALTER TABLE queue ADD COLUMN resolution_code TEXT`).run();
  }
  if (!hasColumn('history', 'resolution_code')) {
    db.prepare(`ALTER TABLE history ADD COLUMN resolution_code TEXT`).run();
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

  // Performance indexes — safe to run repeatedly (IF NOT EXISTS)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_history_tenant_completed ON history(tenant_id, completedTime);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_history_branch_completed ON history(branch, completedTime);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_queue_tenant_status ON queue(tenant_id, status);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tenant_branches_tenant ON tenant_branches(tenant_id, name);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tenant_services_tenant ON tenant_services(tenant_id, name);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_payment_submissions_status ON payment_submissions(status, submittedAt);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_payment_submissions_tenant ON payment_submissions(tenant_id, submittedAt);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_receipts_tenant ON receipts(tenant_id, createdAt);`);

  // Seed default super_admin user if none exist
  const userCount = (db.prepare('SELECT COUNT(1) as c FROM users').get() as any).c as number;
  if (userCount === 0) {
    const email = process.env.ADMIN_EMAIL?.trim() || 'admin@ssb.local';
    const rawPassword = process.env.ADMIN_PASSWORD?.trim() || (isDev ? 'dev-admin-change-me' : '');
    if (!rawPassword) {
      throw new Error("ADMIN_PASSWORD env var is required to seed the initial super admin outside development.");
    }
    const hash = await bcrypt.hash(rawPassword, 12);
    db.prepare(
      'INSERT INTO users (id, email, password_hash, role, tenant_id, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(crypto.randomUUID(), email, hash, 'super_admin', 'default', new Date().toISOString());
    console.log(`[AUTH] Seeded default admin: ${email}`);
  }

  // Clean expired sessions on startup and hourly thereafter
  const cleanSessions = () => {
    db.prepare("DELETE FROM admin_sessions WHERE datetime(createdAt) < datetime('now', '-24 hours')").run();
  };
  cleanSessions();
  if (enableSchedules) {
    cleanupTimers.push(setInterval(cleanSessions, 60 * 60 * 1000));
  }

  // ===== HELPERS =====
  const normalizeIP = (ip: string): string => {
    if (!ip) return "";
    if (ip === "::1") return "127.0.0.1";
    return ip.replace("::ffff:", "");
  };

  const getClientIP = (req: express.Request): string => {
    return normalizeIP(req.ip || req.socket.remoteAddress || "");
  };

  const getActiveSession = (token: string | undefined) => {
    if (!token) return null;
    const session = db.prepare(
      "SELECT token, user_id, createdAt FROM admin_sessions WHERE token = ? AND datetime(createdAt) >= datetime('now', '-24 hours')"
    ).get(token) as { token: string; user_id: string | null; createdAt: string } | undefined;
    if (!session) {
      db.prepare("DELETE FROM admin_sessions WHERE token = ?").run(token);
      return null;
    }
    return session;
  };

  const requireAdmin = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const token = req.headers["x-admin-token"] as string;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const session = getActiveSession(token);
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
    const session = getActiveSession(token);
    if (!session) return res.status(401).json({ error: "Invalid or expired session" });
    const user = db.prepare("SELECT role FROM users WHERE id = ?").get(session.user_id) as any;
    if (!user || user.role !== 'super_admin') return res.status(403).json({ error: "Super admin access required" });
    next();
  };

  const getUserFromToken = (token: string) => {
    const session = getActiveSession(token);
    if (!session?.user_id) return null;
    return db.prepare("SELECT * FROM users WHERE id = ?").get(session.user_id) as any;
  };

  const canAccessTenant = (user: any, tenantId: string) => {
    if (!user) return false;
    if (user.role === "super_admin") return true;
    return user.tenant_id === tenantId;
  };

  const normalizeNameList = (items: unknown): string[] => {
    if (!Array.isArray(items)) return [];
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const item of items) {
      if (typeof item !== "string") continue;
      const value = item.trim();
      if (!value) continue;
      const dedupeKey = value.toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      cleaned.push(value);
    }
    return cleaned;
  };

  const getPlanLimits = (planRaw?: string) => {
    const plan = (planRaw || "free").toLowerCase();
    return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  };

  const getPlanPrice = (planRaw?: string) => {
    const plan = (planRaw || "free").toLowerCase();
    return PLAN_PRICES[plan] ?? 0;
  };

  const normalizeSourceChannel = (value: unknown) => {
    if (typeof value !== "string") return "self_service";
    const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_ -]/g, "").replace(/\s+/g, "_");
    return normalized || "self_service";
  };

  const normalizeSlaTarget = (value: unknown) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 10;
    return Math.max(1, Math.min(240, Math.round(parsed)));
  };

  const sanitizeBreachReason = (value: unknown) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, 120) : null;
  };

  const sanitizeNoShowReason = (value: unknown) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, 120) : null;
  };

  const sanitizePauseReason = (value: unknown) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, 120) : null;
  };

  const sanitizeResolutionCode = (value: unknown) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim().toLowerCase().replace(/[^a-z0-9_ -]/g, "").replace(/\s+/g, "_");
    return trimmed ? trimmed.slice(0, 80) : null;
  };

  const getBillingConfig = () => {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'billing_config'").get() as any;
    const parsed = row?.value ? JSON.parse(row.value) : {};
    return {
      bankName: parsed?.bankName || "",
      accountName: parsed?.accountName || "",
      accountNumber: parsed?.accountNumber || "",
      instructions: parsed?.instructions || "",
      qrUrl: parsed?.qrUrl || "",
      graceDays: Number.isFinite(parsed?.graceDays) ? Number(parsed.graceDays) : 5,
    };
  };

  const saveBillingConfig = (config: any) => {
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('billing_config', ?)")
      .run(JSON.stringify(config));
  };

  const getTenantCatalog = (tenantId: string) => {
    const tenant = db
      .prepare("SELECT id, plan, settings FROM tenants WHERE id = ?")
      .get(tenantId) as any;
    const plan = (tenant?.plan || "free").toLowerCase();
    const limits = getPlanLimits(plan);

    const branchRows = db
      .prepare("SELECT name FROM tenant_branches WHERE tenant_id = ? ORDER BY name ASC")
      .all(tenantId) as { name: string }[];
    const serviceRows = db
      .prepare("SELECT name FROM tenant_services WHERE tenant_id = ? ORDER BY name ASC")
      .all(tenantId) as { name: string }[];

    const settings = tenant?.settings ? JSON.parse(tenant.settings) : {};
    const customerTerm = typeof settings?.customerTerm === "string" && VALID_CUSTOMER_TERMS.has(settings.customerTerm)
      ? settings.customerTerm
      : "customer";

    return {
      tenantId,
      plan,
      branches: (
        branchRows.length ? branchRows.map((r) => r.name) : [...DEFAULT_BRANCHES]
      ).slice(0, limits.maxBranches ?? undefined),
      services: (
        serviceRows.length ? serviceRows.map((r) => r.name) : [...DEFAULT_SERVICES]
      ).slice(0, limits.maxServices ?? undefined),
      customerTerm,
    };
  };

  const checkIPAccess = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    // Authenticated admins can always submit tickets (kiosk IP limits apply to public access)
    const token = req.headers["x-admin-token"] as string | undefined;
    if (token && getUserFromToken(token)) return next();

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

  const ensureTenantCatalog = (tenantId: string) => {
    const branchCount = (db.prepare("SELECT COUNT(1) as c FROM tenant_branches WHERE tenant_id = ?").get(tenantId) as any).c as number;
    if (branchCount === 0) {
      for (const name of DEFAULT_BRANCHES) {
        db.prepare("INSERT OR IGNORE INTO tenant_branches (id, tenant_id, name, createdAt) VALUES (?, ?, ?, ?)")
          .run(crypto.randomUUID(), tenantId, name, new Date().toISOString());
      }
    }

    const serviceCount = (db.prepare("SELECT COUNT(1) as c FROM tenant_services WHERE tenant_id = ?").get(tenantId) as any).c as number;
    if (serviceCount === 0) {
      for (const name of DEFAULT_SERVICES) {
        db.prepare("INSERT OR IGNORE INTO tenant_services (id, tenant_id, name, createdAt) VALUES (?, ?, ?, ?)")
          .run(crypto.randomUUID(), tenantId, name, new Date().toISOString());
      }
    }
  };

  const allTenantIds = db.prepare("SELECT id FROM tenants").all() as { id: string }[];
  for (const t of allTenantIds) {
    ensureTenantCatalog(t.id);
  }

  const ensureTenantSubscription = (tenantId: string) => {
    const tenant = db.prepare("SELECT plan FROM tenants WHERE id = ?").get(tenantId) as any;
    if (!tenant) return;
    const existing = db.prepare("SELECT tenant_id FROM subscriptions WHERE tenant_id = ?").get(tenantId) as any;
    if (!existing) {
      const now = new Date().toISOString();
      db.prepare(
        "INSERT INTO subscriptions (tenant_id, plan, status, period_start, period_end, grace_days, amount, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        tenantId,
        (tenant.plan || "free").toLowerCase(),
        "active",
        now,
        null,
        getBillingConfig().graceDays || 5,
        getPlanPrice(tenant.plan),
        now
      );
    }
  };

  for (const t of allTenantIds) {
    ensureTenantSubscription(t.id);
  }

  app.post("/api/demo/start", async (_req, res) => {
    const demoTenantId = "demo-tenant";
    const demoUserEmail = "demo@smartqueue.local";
    const nowIso = new Date().toISOString();

    db.prepare(
      "INSERT OR IGNORE INTO tenants (id, name, slug, settings, plan, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(
      demoTenantId,
      "Smart Queue Demo Organization",
      "smart-queue-demo",
      JSON.stringify({
        industry: "Banking",
        customerTerm: "customer",
        contact_email: "demo@smartqueue.local",
        contact_phone: "+63 900 000 0000",
      }),
      "starter",
      nowIso
    );
    ensureTenantCatalog(demoTenantId);
    ensureTenantSubscription(demoTenantId);

    let demoUser = db.prepare("SELECT id FROM users WHERE email = ?").get(demoUserEmail) as any;
    if (!demoUser) {
      const demoUserId = crypto.randomUUID();
      const demoHash = await bcrypt.hash(crypto.randomUUID(), 10);
      db.prepare(
        "INSERT INTO users (id, email, password_hash, role, tenant_id, name, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(demoUserId, demoUserEmail, demoHash, "tenant_admin", demoTenantId, "Demo Admin", nowIso);
      demoUser = { id: demoUserId };
    }

    db.prepare("DELETE FROM queue WHERE tenant_id = ?").run(demoTenantId);
    db.prepare("DELETE FROM history WHERE tenant_id = ?").run(demoTenantId);

    const now = Date.now();
    const mkIso = (minsAgo: number) => new Date(now - minsAgo * 60 * 1000).toISOString();
    const queueSamples = [
      { id: "SQ-DEMO001", name: "Juan Dela Cruz", branch: "Carcar Branch", service: "Withdrawal", priority: "Priority", checkInTime: mkIso(18), status: "Waiting", calledTime: null },
      { id: "SQ-DEMO002", name: "Maria Santos", branch: "Carcar Branch", service: "Cash/Check Deposit", priority: "Regular", checkInTime: mkIso(12), status: "Waiting", calledTime: null },
      { id: "SQ-DEMO003", name: "Pedro Reyes", branch: "Moalboal Branch", service: "Customer Service", priority: "Regular", checkInTime: mkIso(9), status: "Processing", calledTime: mkIso(3) },
    ];
    for (const q of queueSamples) {
      db.prepare(
        "INSERT OR REPLACE INTO queue (id, tenant_id, name, branch, service, priority, checkInTime, status, calledTime, completedTime, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(q.id, demoTenantId, q.name, q.branch, q.service, q.priority, q.checkInTime, q.status, q.calledTime, null, null);
    }

    const historySamples = [
      { id: "SQ-HIST001", name: "Ana Lim", branch: "Carcar Branch", service: "Withdrawal", priority: "Regular", checkInMins: 55, calledMins: 40, completedMins: 35 },
      { id: "SQ-HIST002", name: "Carlo Ong", branch: "Carcar Branch", service: "Cash/Check Deposit", priority: "Priority", checkInMins: 48, calledMins: 32, completedMins: 27 },
      { id: "SQ-HIST003", name: "Liza Cruz", branch: "Moalboal Branch", service: "Account Opening", priority: "Regular", checkInMins: 44, calledMins: 24, completedMins: 16 },
      { id: "SQ-HIST004", name: "Ben Tan", branch: "Carcar Branch", service: "Loans", priority: "Regular", checkInMins: 38, calledMins: 21, completedMins: 12 },
      { id: "SQ-HIST005", name: "Nina Sy", branch: "Moalboal Branch", service: "Customer Service", priority: "Priority", checkInMins: 30, calledMins: 15, completedMins: 8 },
    ];
    for (const h of historySamples) {
      db.prepare(
        "INSERT OR REPLACE INTO history (id, tenant_id, name, branch, service, priority, checkInTime, status, calledTime, completedTime, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        h.id,
        demoTenantId,
        h.name,
        h.branch,
        h.service,
        h.priority,
        mkIso(h.checkInMins),
        "Completed",
        mkIso(h.calledMins),
        mkIso(h.completedMins),
        "Demo transaction"
      );
    }

    const token = crypto.randomBytes(32).toString("hex");
    db.prepare("INSERT INTO admin_sessions (token, createdAt, user_id) VALUES (?, ?, ?)").run(
      token, new Date().toISOString(), demoUser.id
    );

    broadcast({ type: "QUEUE_UPDATED" });
    broadcast({ type: "HISTORY_UPDATED" });
    res.json({ token, role: "tenant_admin", demo: true, tenant_id: demoTenantId });
  });

  const generateCSV = async (tenantId: string, fromDate: string, toDate: string) => {
    const rows = db.prepare("SELECT * FROM history WHERE date(completedTime) >= date(?) AND date(completedTime) <= date(?) AND (tenant_id = ? OR ? = 'all') ORDER BY completedTime DESC")
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
      ? db.prepare("SELECT * FROM history WHERE date(completedTime) >= date(?) AND date(completedTime) <= date(?) AND (tenant_id = ? OR ? = 'all') AND branch = ? ORDER BY completedTime DESC")
          .all(fromDate, toDate, tenantId, tenantId, branch) as any[]
      : db.prepare("SELECT * FROM history WHERE date(completedTime) >= date(?) AND date(completedTime) <= date(?) AND (tenant_id = ? OR ? = 'all') ORDER BY completedTime DESC")
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

  const config: AppConfig = {
    isDev,
    loginWindowMs: 15 * 60 * 1000,
    loginMaxAttempts: 5,
    defaultBranches: DEFAULT_BRANCHES,
    defaultServices: DEFAULT_SERVICES,
    validPriorities: VALID_PRIORITIES,
    validCustomerTerms: VALID_CUSTOMER_TERMS,
    planLimits: PLAN_LIMITS,
    planPrices: PLAN_PRICES,
  };
  const paths: AppPaths = {
    rootDir: __dirname,
    distDir: path.resolve(__dirname, "dist"),
    tenantLogoDir: TENANT_LOGO_DIR,
    billingFilesDir: BILLING_FILES_DIR,
    paymentProofsDir: PAYMENT_PROOFS_DIR,
    receiptsDir: RECEIPTS_DIR,
    billingQrDir: BILLING_QR_DIR,
  };
  const helpers: AppHelpers = {
    normalizeIP,
    getClientIP,
    getActiveSession,
    requireAdmin,
    requireSuperAdmin,
    getUserFromToken,
    canAccessTenant,
    normalizeNameList,
    getPlanLimits,
    getPlanPrice,
    normalizeSourceChannel,
    normalizeSlaTarget,
    sanitizeBreachReason,
    sanitizeNoShowReason,
    sanitizePauseReason,
    sanitizeResolutionCode,
    getBillingConfig,
    saveBillingConfig,
    getTenantCatalog,
    checkIPAccess,
    broadcast,
    getTenant,
    ensureDefaultTenant,
    ensureTenantCatalog,
    ensureTenantSubscription,
    generatePDF,
    generateAndSendReport,
  };
  const state = {
    loginAttempts: new Map<string, { count: number; resetAt: number }>(),
  };

  // Schedule daily reports at 01:00 server time
  const scheduleDailyReports = () => {
    const now = new Date();
    const next = new Date();
    next.setHours(1,0,0,0);
    if (next <= now) next.setDate(next.getDate() + 1);
    const delay = next.getTime() - now.getTime();
    const timeout = setTimeout(() => {
      const tenants = db.prepare('SELECT id FROM tenants').all() as any[];
      for (const t of tenants) {
        generateAndSendReport(t.id, 'daily').catch(e => console.error('Scheduled report failed', e));
      }
      const interval = setInterval(() => {
        const tenants = db.prepare('SELECT id FROM tenants').all() as any[];
        for (const t of tenants) {
          generateAndSendReport(t.id, 'daily').catch(e => console.error('Scheduled report failed', e));
        }
      }, 24 * 60 * 60 * 1000);
      cleanupTimers.push(interval);
    }, delay);
    cleanupTimers.push(timeout);
  };
  if (enableSchedules) {
    scheduleDailyReports();
  }

  const runSubscriptionLifecycle = () => {
    const now = new Date();
    const rows = db.prepare("SELECT * FROM subscriptions").all() as any[];
    for (const sub of rows) {
      if (!sub.period_end) continue;
      const periodEnd = new Date(sub.period_end);
      const graceDays = Number.isFinite(Number(sub.grace_days)) ? Number(sub.grace_days) : 5;
      const downgradeAt = new Date(periodEnd.getTime() + graceDays * 24 * 60 * 60 * 1000);
      let nextStatus = "active";
      if (now > downgradeAt) nextStatus = "downgraded_free";
      else if (now > periodEnd) nextStatus = "overdue";
      else {
        const dueSoonAt = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
        nextStatus = now >= dueSoonAt ? "due_soon" : "active";
      }

      const currentPlan = (sub.plan || "free").toLowerCase();
      if (nextStatus === "downgraded_free" && currentPlan !== "free") {
        db.prepare("UPDATE tenants SET plan = 'free' WHERE id = ?").run(sub.tenant_id);
        db.prepare("UPDATE subscriptions SET plan = 'free', status = ?, amount = 0, updatedAt = ? WHERE tenant_id = ?")
          .run(nextStatus, new Date().toISOString(), sub.tenant_id);
      } else if (sub.status !== nextStatus) {
        db.prepare("UPDATE subscriptions SET status = ?, updatedAt = ? WHERE tenant_id = ?")
          .run(nextStatus, new Date().toISOString(), sub.tenant_id);
      }
    }
  };
  runSubscriptionLifecycle();
  if (enableSchedules) {
    cleanupTimers.push(setInterval(runSubscriptionLifecycle, 6 * 60 * 60 * 1000));
  }

  // Auto-archive old history nightly (default retention: 90 days)
  const archiveRetentionDays = Number(process.env.ARCHIVE_RETENTION_DAYS || 90);
  const runHistoryArchive = () => {
    const days = Number.isFinite(archiveRetentionDays) && archiveRetentionDays > 0
      ? Math.floor(archiveRetentionDays)
      : 90;
    const result = db
      .prepare("DELETE FROM history WHERE completedTime IS NOT NULL AND completedTime != '' AND date(completedTime) < date('now', ?)")
      .run(`-${days} days`);

    if (result.changes > 0) {
      console.log(`[ARCHIVE] Removed ${result.changes} row(s) older than ${days} days`);
    }
  };
  runHistoryArchive();
  if (enableSchedules) {
    cleanupTimers.push(setInterval(runHistoryArchive, 24 * 60 * 60 * 1000));
  }

  registerAuthRoutes({ app, db, wss, config, paths, state, helpers });
  registerAdminRoutes({ app, db, wss, config, paths, state, helpers });
  registerBillingRoutes({ app, db, wss, config, paths, state, helpers });
  registerQueueRoutes({ app, db, wss, config, paths, state, helpers });

  // ===== VITE / STATIC =====
  console.log(`[STARTUP] isDev: ${isDev}`);

  if (serveFrontend && isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (serveFrontend) {
    console.log(`[STARTUP] Serving static from: ${paths.distDir}`);
    app.use(express.static(paths.distDir));
    app.get("*", (req, res, next) => {
      if (req.url.startsWith("/api")) return next();
      res.sendFile(path.join(paths.distDir, "index.html"));
    });
  }

  if (shouldListen) {
    await new Promise<void>((resolve) => {
      server.listen(listenPort, listenHost, () => {
        console.log(`Server is live on port ${listenPort}`);
        if (!process.env.ADMIN_PASSWORD && isDev) {
          console.warn(`[ADMIN] Warning: Using development fallback admin password. Set ADMIN_EMAIL and ADMIN_PASSWORD in your env.`);
        }
        resolve();
      });
    });
  }

  const close = async () => {
    cleanupTimers.forEach((timer) => clearInterval(timer));
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    db.close();
  };

  return {
    app,
    server,
    db,
    close,
  };
}

export async function startServer(options: Omit<CreateAppOptions, "listen"> = {}) {
  return createSmartQueueServer({ ...options, listen: true });
}

if (process.argv[1] === __filename) {
  startServer().catch(console.error);
}
