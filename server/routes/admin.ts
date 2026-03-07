import archiver from "archiver";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { RouteDeps } from "../types";

export function registerAdminRoutes({
  app,
  db,
  config,
  paths,
  helpers,
}: RouteDeps) {
  app.get("/api/download", helpers.requireAdmin, (_req, res) => {
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
    res.json({
      nodeEnv: process.env.NODE_ENV,
      cwd: process.cwd(),
      distExists: fs.existsSync(paths.distDir),
      distFiles: fs.existsSync(paths.distDir) ? fs.readdirSync(paths.distDir) : [],
      indexExists: fs.existsSync(path.join(paths.distDir, "index.html")),
    });
  });


  const getPrimarySupportEmail = () => {
    const seededAdmin = db.prepare("SELECT email FROM users WHERE role = 'super_admin' ORDER BY createdAt ASC LIMIT 1").get() as { email?: string } | undefined;
    return (process.env.ADMIN_EMAIL || seededAdmin?.email || 'admin@example.com').trim();
  };

  const getSiteConfig = () => {
    const defaults = {
      seoTitle: 'Smart Queue | Enterprise Queue & Analytics',
      seoDescription: 'Real-time queue management, SLA tracking, KPI dashboards, and branch analytics for banks, cooperatives, and service teams.',
      seoKeywords: 'queue management software, SLA tracking SaaS, KPI dashboard, branch analytics, banking queue system',
      supportEmail: getPrimarySupportEmail(),
      textLogo: 'Smart Queue',
      tagLine: 'Queue Intelligence Platform',
      logoUrl: '',
    };
    const billingConfig = helpers.getBillingConfig();
    const row = db.prepare("SELECT value FROM settings WHERE key = 'site_config'").get() as { value?: string } | undefined;
    let parsed: any = {};
    if (row?.value) {
      try { parsed = JSON.parse(row.value); } catch { parsed = {}; }
    }
    return {
      seoTitle: typeof parsed?.seoTitle === 'string' && parsed.seoTitle.trim() ? parsed.seoTitle.trim().slice(0, 80) : defaults.seoTitle,
      seoDescription: typeof parsed?.seoDescription === 'string' && parsed.seoDescription.trim() ? parsed.seoDescription.trim().slice(0, 200) : defaults.seoDescription,
      seoKeywords: typeof parsed?.seoKeywords === 'string' && parsed.seoKeywords.trim() ? parsed.seoKeywords.trim().slice(0, 240) : defaults.seoKeywords,
      supportEmail: typeof parsed?.supportEmail === 'string' && parsed.supportEmail.trim() ? parsed.supportEmail.trim().slice(0, 160) : defaults.supportEmail,
      textLogo: typeof parsed?.textLogo === 'string' && parsed.textLogo.trim() ? parsed.textLogo.trim().slice(0, 80) : defaults.textLogo,
      tagLine: typeof parsed?.tagLine === 'string' && parsed.tagLine.trim() ? parsed.tagLine.trim().slice(0, 120) : defaults.tagLine,
      logoUrl: typeof parsed?.logoUrl === 'string' && parsed.logoUrl.trim() ? parsed.logoUrl.trim().slice(0, 240) : defaults.logoUrl,
      starterPrice: Number.isFinite(Number(billingConfig.starterPrice)) ? Number(billingConfig.starterPrice) : 999,
      proPrice: Number.isFinite(Number(billingConfig.proPrice)) ? Number(billingConfig.proPrice) : 2499,
      freeMonthlyTransactions: Number.isFinite(Number(billingConfig.freeMonthlyTransactions)) ? Number(billingConfig.freeMonthlyTransactions) : 500,
    };
  };

  app.get('/api/public/site-config', (_req, res) => {
    res.json(getSiteConfig());
  });

  app.get('/api/admin/settings/site', helpers.requireSuperAdmin, (_req, res) => {
    res.json(getSiteConfig());
  });

  app.post('/api/admin/settings/site', helpers.requireSuperAdmin, (req, res) => {
    const current = getSiteConfig();
    const seoTitle = typeof req.body?.seoTitle === 'string' && req.body.seoTitle.trim()
      ? req.body.seoTitle.trim().slice(0, 80)
      : current.seoTitle;
    const seoDescription = typeof req.body?.seoDescription === 'string' && req.body.seoDescription.trim()
      ? req.body.seoDescription.trim().slice(0, 200)
      : current.seoDescription;
    const seoKeywords = typeof req.body?.seoKeywords === 'string' && req.body.seoKeywords.trim()
      ? req.body.seoKeywords.trim().slice(0, 240)
      : current.seoKeywords;
    const supportEmail = typeof req.body?.supportEmail === 'string' && req.body.supportEmail.trim()
      ? req.body.supportEmail.trim().slice(0, 160)
      : getPrimarySupportEmail();
    const textLogo = typeof req.body?.textLogo === 'string' && req.body.textLogo.trim()
      ? req.body.textLogo.trim().slice(0, 80)
      : current.textLogo;
    const tagLine = typeof req.body?.tagLine === 'string' && req.body.tagLine.trim()
      ? req.body.tagLine.trim().slice(0, 120)
      : current.tagLine;
    let logoUrl = current.logoUrl;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
      return res.status(400).json({ error: 'Support email must be a valid email address' });
    }

    const logoDataUrl = typeof req.body?.logoDataUrl === 'string' ? req.body.logoDataUrl : '';
    if (logoDataUrl) {
      const match = logoDataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp|svg\+xml|x-icon|vnd\.microsoft\.icon));base64,(.+)$/i);
      if (!match) return res.status(400).json({ error: 'Platform logo must be a valid image.' });
      const mime = match[1].toLowerCase();
      const ext = mime.includes('png')
        ? 'png'
        : mime.includes('webp')
          ? 'webp'
          : mime.includes('svg')
            ? 'svg'
            : mime.includes('icon')
              ? 'ico'
              : 'jpg';
      const buffer = Buffer.from(match[2], 'base64');
      if (buffer.length > 2 * 1024 * 1024) return res.status(400).json({ error: 'Platform logo is too large (max 2MB).' });

      const filename = `platform-brand-${Date.now()}.${ext}`;
      const filePath = path.join(paths.platformBrandingDir, filename);
      fs.writeFileSync(filePath, buffer);
      if (logoUrl && logoUrl.startsWith('/platform-branding/')) {
        const previousPath = path.join(paths.platformBrandingDir, path.basename(logoUrl));
        if (fs.existsSync(previousPath)) fs.unlinkSync(previousPath);
      }
      logoUrl = `/platform-branding/${filename}`;
    }

    const nextConfig = {
      seoTitle,
      seoDescription,
      seoKeywords,
      supportEmail,
      textLogo,
      tagLine,
      logoUrl,
    };
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('site_config', ?)").run(JSON.stringify(nextConfig));
    res.json(nextConfig);
  });

  app.get("/api/admin/ips", helpers.requireAdmin, (_req, res) => {
    const rows = db.prepare("SELECT * FROM ip_whitelist ORDER BY addedAt DESC").all();
    res.json(rows);
  });

  app.post("/api/admin/ips", helpers.requireAdmin, (req, res) => {
    const { ip, label } = req.body;
    if (!ip) return res.status(400).json({ error: "IP address is required" });
    try {
      db.prepare(
        "INSERT OR REPLACE INTO ip_whitelist (ip, label, addedAt) VALUES (?, ?, ?)"
      ).run(helpers.normalizeIP(ip.trim()), label?.trim() || "", new Date().toISOString());
      res.json({ status: "ok" });
    } catch {
      res.status(500).json({ error: "Failed to add IP" });
    }
  });

  app.delete("/api/admin/ips/:ip", helpers.requireAdmin, (req, res) => {
    db.prepare("DELETE FROM ip_whitelist WHERE ip = ?").run(helpers.normalizeIP(req.params.ip));
    res.json({ status: "ok" });
  });

  app.get("/api/admin/access", helpers.requireAdmin, (req, res) => {
    const dbUser = helpers.getUserFromToken(req.headers["x-admin-token"] as string);
    if (!dbUser) return res.status(401).json({ error: "Session invalid" });
    const tenant = db.prepare("SELECT settings FROM tenants WHERE id = ?").get(dbUser.tenant_id) as any;
    const settings = tenant?.settings ? JSON.parse(tenant.settings) : {};
    const accessMode = typeof settings?.accessMode === "string" ? settings.accessMode : "ip_whitelist";
    const trustedDevices = db.prepare(
      "SELECT id, branch, label, createdAt, lastSeenAt FROM trusted_devices WHERE tenant_id = ? ORDER BY createdAt DESC"
    ).all(dbUser.tenant_id);
    res.json({
      accessMode: ["ip_whitelist", "hybrid", "trusted_devices"].includes(accessMode) ? accessMode : "ip_whitelist",
      trustedDevices,
    });
  });

  app.post("/api/admin/access", helpers.requireAdmin, (req, res) => {
    const dbUser = helpers.getUserFromToken(req.headers["x-admin-token"] as string);
    if (!dbUser) return res.status(401).json({ error: "Session invalid" });
    const accessMode = typeof req.body?.accessMode === "string" ? req.body.accessMode.trim() : "";
    if (!["ip_whitelist", "hybrid", "trusted_devices"].includes(accessMode)) {
      return res.status(400).json({ error: "Invalid access mode" });
    }
    const tenant = db.prepare("SELECT settings FROM tenants WHERE id = ?").get(dbUser.tenant_id) as any;
    const currentSettings = tenant?.settings ? JSON.parse(tenant.settings) : {};
    const nextSettings = { ...currentSettings, accessMode };
    db.prepare("UPDATE tenants SET settings = ? WHERE id = ?").run(JSON.stringify(nextSettings), dbUser.tenant_id);
    res.json({ status: "ok", accessMode });
  });

  app.post("/api/admin/trusted-devices", helpers.requireAdmin, (req, res) => {
    const dbUser = helpers.getUserFromToken(req.headers["x-admin-token"] as string);
    if (!dbUser) return res.status(401).json({ error: "Session invalid" });
    const label = typeof req.body?.label === "string" ? req.body.label.trim().slice(0, 120) : "";
    const branch = typeof req.body?.branch === "string" ? req.body.branch.trim().slice(0, 120) : "";
    if (!label) return res.status(400).json({ error: "Device label is required" });
    if (!branch) return res.status(400).json({ error: "Branch is required" });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const id = crypto.randomUUID();
    db.prepare(
      "INSERT INTO trusted_devices (id, tenant_id, branch, label, token_hash, createdAt, lastSeenAt, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      id,
      dbUser.tenant_id,
      branch,
      label,
      tokenHash,
      new Date().toISOString(),
      new Date().toISOString(),
      dbUser.email || null
    );

    const trustedDevices = db.prepare(
      "SELECT id, branch, label, createdAt, lastSeenAt FROM trusted_devices WHERE tenant_id = ? ORDER BY createdAt DESC"
    ).all(dbUser.tenant_id);
    res.status(201).json({ status: "ok", id, deviceToken: rawToken, trustedDevices });
  });

  app.delete("/api/admin/trusted-devices/:id", helpers.requireAdmin, (req, res) => {
    const dbUser = helpers.getUserFromToken(req.headers["x-admin-token"] as string);
    if (!dbUser) return res.status(401).json({ error: "Session invalid" });
    db.prepare("DELETE FROM trusted_devices WHERE id = ? AND tenant_id = ?").run(req.params.id, dbUser.tenant_id);
    res.json({ status: "ok" });
  });

  app.get("/api/admin/settings", helpers.requireAdmin, (_req, res) => {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'apiKey'").get() as { value: string } | undefined;
    const key = row?.value ?? "";
    const masked = key.length > 12
      ? `${key.slice(0, 8)}${"•".repeat(key.length - 12)}${key.slice(-4)}`
      : "•".repeat(key.length);
    res.json({ configured: key.length > 0, masked });
  });

  app.post("/api/admin/settings", helpers.requireAdmin, (req, res) => {
    const { apiKey } = req.body;
    if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
      return res.status(400).json({ error: "apiKey must be a non-empty string" });
    }
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('apiKey', ?)").run(apiKey.trim());
    res.json({ status: "ok" });
  });

  app.delete("/api/admin/settings/apikey", helpers.requireAdmin, (_req, res) => {
    db.prepare("DELETE FROM settings WHERE key = 'apiKey'").run();
    res.json({ status: "ok" });
  });

  app.get("/api/admin/smtp", helpers.requireAdmin, (req, res) => {
    const user = helpers.getUserFromToken(req.headers["x-admin-token"] as string);
    if (!user) return res.json({});
    const tenant = db.prepare("SELECT settings FROM tenants WHERE id = ?").get(user.tenant_id) as any;
    const settings = tenant?.settings ? JSON.parse(tenant.settings) : {};
    const smtp = settings.smtp || {};
    res.json({
      host: smtp.host || "",
      port: smtp.port || 587,
      secure: smtp.secure || false,
      user: smtp.auth?.user || "",
      from: smtp.from || "",
      to: settings.email_contact || "",
      configured: !!smtp.host,
    });
  });

  app.post("/api/admin/smtp", helpers.requireAdmin, (req, res) => {
    const { host, port, secure, user, pass, from, to } = req.body;
    const dbUser = helpers.getUserFromToken(req.headers["x-admin-token"] as string);
    if (!dbUser) return res.status(401).json({ error: "Session invalid" });
    const tenant = db.prepare("SELECT settings FROM tenants WHERE id = ?").get(dbUser.tenant_id) as any;
    const currentSettings = tenant?.settings ? JSON.parse(tenant.settings) : {};
    const smtp: any = { host: host || "", port: Number(port) || 587, secure: !!secure };
    if (user) smtp.auth = { user, pass: pass || currentSettings.smtp?.auth?.pass || "" };
    if (from) smtp.from = from;
    const newSettings = { ...currentSettings, smtp, email_contact: to || currentSettings.email_contact || "" };
    db.prepare("UPDATE tenants SET settings = ? WHERE id = ?").run(JSON.stringify(newSettings), dbUser.tenant_id);
    res.json({ status: "ok" });
  });

  app.get("/api/admin/profile", helpers.requireAdmin, (req, res) => {
    const dbUser = helpers.getUserFromToken(req.headers["x-admin-token"] as string);
    if (!dbUser) return res.status(401).json({ error: "Session invalid" });
    const tenant = db.prepare("SELECT name, settings FROM tenants WHERE id = ?").get(dbUser.tenant_id) as any;
    const settings = tenant?.settings ? JSON.parse(tenant.settings) : {};
    res.json({
      companyName: tenant?.name || "",
      industry: settings?.industry || "",
      contactEmail: settings?.contact_email || settings?.email_contact || "",
      contactPhone: settings?.contact_phone || "",
      logoUrl: settings?.logo_url || "",
    });
  });

  app.post("/api/admin/profile", helpers.requireAdmin, (req, res) => {
    const dbUser = helpers.getUserFromToken(req.headers["x-admin-token"] as string);
    if (!dbUser) return res.status(401).json({ error: "Session invalid" });
    const { companyName, industry, contactEmail, contactPhone } = req.body;

    const tenant = db.prepare("SELECT settings FROM tenants WHERE id = ?").get(dbUser.tenant_id) as any;
    const currentSettings = tenant?.settings ? JSON.parse(tenant.settings) : {};
    const nextSettings = {
      ...currentSettings,
      industry: typeof industry === "string" ? industry.trim().slice(0, 120) : "",
      contact_email: typeof contactEmail === "string" ? contactEmail.trim().slice(0, 160) : "",
      contact_phone: typeof contactPhone === "string" ? contactPhone.trim().slice(0, 40) : "",
    };

    db.prepare("UPDATE tenants SET settings = ? WHERE id = ?").run(JSON.stringify(nextSettings), dbUser.tenant_id);
    if (typeof companyName === "string" && companyName.trim()) {
      db.prepare("UPDATE tenants SET name = ? WHERE id = ?").run(companyName.trim().slice(0, 160), dbUser.tenant_id);
    }
    res.json({ status: "ok" });
  });

  app.post("/api/admin/profile/logo", helpers.requireAdmin, (req, res) => {
    const dbUser = helpers.getUserFromToken(req.headers["x-admin-token"] as string);
    if (!dbUser) return res.status(401).json({ error: "Session invalid" });

    const dataUrl = typeof req.body?.dataUrl === "string" ? req.body.dataUrl : "";
    if (!dataUrl.startsWith("data:image/")) {
      return res.status(400).json({ error: "Invalid image data" });
    }
    const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i);
    if (!match) return res.status(400).json({ error: "Unsupported image format" });

    const mime = match[1].toLowerCase();
    const base64 = match[2];
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length > 2 * 1024 * 1024) {
      return res.status(400).json({ error: "Logo file too large (max 2MB)" });
    }

    const filename = `${dbUser.tenant_id}-${Date.now()}.${ext}`;
    const filePath = path.join(paths.tenantLogoDir, filename);
    fs.writeFileSync(filePath, buffer);
    const logoUrl = `/tenant-logos/${filename}`;

    const tenant = db.prepare("SELECT settings FROM tenants WHERE id = ?").get(dbUser.tenant_id) as any;
    const currentSettings = tenant?.settings ? JSON.parse(tenant.settings) : {};
    const oldLogoUrl = currentSettings?.logo_url as string | undefined;
    const nextSettings = { ...currentSettings, logo_url: logoUrl };
    db.prepare("UPDATE tenants SET settings = ? WHERE id = ?").run(JSON.stringify(nextSettings), dbUser.tenant_id);

    if (oldLogoUrl && oldLogoUrl.startsWith("/tenant-logos/")) {
      const oldFilePath = path.join(paths.tenantLogoDir, oldLogoUrl.replace("/tenant-logos/", ""));
      try { if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath); } catch {}
    }

    res.json({ status: "ok", logoUrl });
  });

  app.get("/api/logos/public", (_req, res) => {
    const rows = db.prepare("SELECT name, settings FROM tenants WHERE id != 'default' ORDER BY createdAt DESC LIMIT 40").all() as any[];
    const logos = rows
      .map((r) => {
        const settings = r.settings ? JSON.parse(r.settings) : {};
        const logoUrl = settings?.logo_url || "";
        const name = (r.name || "").trim();
        if (!logoUrl || !name) return null;
        const abbr = name
          .split(/\s+/)
          .slice(0, 2)
          .map((p: string) => p[0] || "")
          .join("")
          .toUpperCase();
        return { name, logoUrl, abbr: abbr || name.slice(0, 2).toUpperCase() };
      })
      .filter(Boolean);
    res.json(logos);
  });

  app.get("/api/catalog", (req, res) => {
    const token = req.headers["x-admin-token"] as string | undefined;
    const user = token ? helpers.getUserFromToken(token) : null;
    const requestedTenantId = typeof req.query.tenant_id === "string" ? req.query.tenant_id : null;
    const tenantId = requestedTenantId && user?.role === "super_admin"
      ? requestedTenantId
      : user?.tenant_id || requestedTenantId || "default";
    const tenantExists = db.prepare("SELECT id FROM tenants WHERE id = ?").get(tenantId) as any;
    const effectiveTenantId = tenantExists?.id || "default";
    helpers.ensureTenantCatalog(effectiveTenantId);
    const catalog = helpers.getTenantCatalog(effectiveTenantId);
    const limits = helpers.getPlanLimits(catalog.plan);
    res.json({
      tenantId: effectiveTenantId,
      plan: catalog.plan,
      limits,
      branches: catalog.branches,
      services: catalog.services,
      customerTerm: catalog.customerTerm,
    });
  });

  app.get("/api/admin/catalog", helpers.requireAdmin, (req, res) => {
    const dbUser = helpers.getUserFromToken(req.headers["x-admin-token"] as string);
    const tenantId = dbUser?.tenant_id || "default";
    helpers.ensureTenantCatalog(tenantId);
    const catalog = helpers.getTenantCatalog(tenantId);
    const limits = helpers.getPlanLimits(catalog.plan);
    res.json({
      plan: catalog.plan,
      limits,
      branches: catalog.branches,
      services: catalog.services,
      customerTerm: catalog.customerTerm,
    });
  });

  app.post("/api/admin/catalog", helpers.requireAdmin, (req, res) => {
    const dbUser = helpers.getUserFromToken(req.headers["x-admin-token"] as string);
    if (!dbUser?.tenant_id) return res.status(401).json({ error: "Session invalid" });
    const tenantId = dbUser.tenant_id as string;
    helpers.ensureTenantCatalog(tenantId);

    const branches = helpers.normalizeNameList(req.body?.branches);
    const services = helpers.normalizeNameList(req.body?.services);
    const customerTerm = typeof req.body?.customerTerm === "string"
      ? req.body.customerTerm.toLowerCase().trim()
      : "";

    if (!branches.length) return res.status(400).json({ error: "At least one branch is required" });
    if (!services.length) return res.status(400).json({ error: "At least one service is required" });
    if (!config.validCustomerTerms.has(customerTerm)) {
      return res.status(400).json({ error: "Invalid customer term" });
    }

    const tenant = db.prepare("SELECT plan, settings FROM tenants WHERE id = ?").get(tenantId) as any;
    const plan = (tenant?.plan || "free").toLowerCase();
    const limits = helpers.getPlanLimits(plan);

    if (limits.maxBranches !== null && branches.length > limits.maxBranches) {
      return res.status(400).json({ error: `Plan limit exceeded: ${plan} allows up to ${limits.maxBranches} branch(es)` });
    }
    if (limits.maxServices !== null && services.length > limits.maxServices) {
      return res.status(400).json({ error: `Plan limit exceeded: ${plan} allows up to ${limits.maxServices} service(s)` });
    }

    const tx = db.transaction(() => {
      db.prepare("DELETE FROM tenant_branches WHERE tenant_id = ?").run(tenantId);
      for (const name of branches) {
        db.prepare("INSERT INTO tenant_branches (id, tenant_id, name, createdAt) VALUES (?, ?, ?, ?)")
          .run(crypto.randomUUID(), tenantId, name, new Date().toISOString());
      }

      db.prepare("DELETE FROM tenant_services WHERE tenant_id = ?").run(tenantId);
      for (const name of services) {
        db.prepare("INSERT INTO tenant_services (id, tenant_id, name, createdAt) VALUES (?, ?, ?, ?)")
          .run(crypto.randomUUID(), tenantId, name, new Date().toISOString());
      }

      const currentSettings = tenant?.settings ? JSON.parse(tenant.settings) : {};
      const nextSettings = { ...currentSettings, customerTerm };
      db.prepare("UPDATE tenants SET settings = ? WHERE id = ?").run(JSON.stringify(nextSettings), tenantId);
    });
    tx();

    helpers.broadcast({ type: "QUEUE_UPDATED" });
    res.json({ status: "ok" });
  });

  app.get("/api/admin/report/pdf", helpers.requireAdmin, async (req, res) => {
    const { from, to, branch } = req.query;
    const dbUser = helpers.getUserFromToken(req.headers["x-admin-token"] as string);
    const tenantId = dbUser?.tenant_id || "all";
    const fromDate = (from as string) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const toDate = (to as string) || new Date().toISOString().slice(0, 10);
    try {
      const pdfPath = await helpers.generatePDF(tenantId, fromDate, toDate, branch as string | undefined);
      const filename = `report-${fromDate}-to-${toDate}.pdf`;
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", "application/pdf");
      const fileStream = fs.createReadStream(pdfPath);
      fileStream.pipe(res);
      fileStream.on("end", () => { try { fs.unlinkSync(pdfPath); } catch {} });
      fileStream.on("error", () => { try { fs.unlinkSync(pdfPath); } catch {} res.status(500).end(); });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to generate PDF" });
    }
  });

  app.post("/api/admin/report/send", helpers.requireAdmin, async (req, res) => {
    const { period } = req.body;
    const dbUser = helpers.getUserFromToken(req.headers["x-admin-token"] as string);
    const tenantId = dbUser?.tenant_id;
    if (!tenantId) return res.status(400).json({ error: "No tenant found" });
    try {
      await helpers.generateAndSendReport(tenantId, period === "monthly" ? "monthly" : "daily");
      res.json({ status: "ok" });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to send report" });
    }
  });

  app.get("/api/admin/tenants", helpers.requireSuperAdmin, (_req, res) => {
    const tenants = db.prepare(`
      SELECT t.id, t.name, t.slug, t.plan, t.createdAt, COUNT(u.id) as userCount
      FROM tenants t
      LEFT JOIN users u ON u.tenant_id = t.id
      GROUP BY t.id
      ORDER BY t.createdAt DESC
    `).all();
    res.json(tenants);
  });

  app.put("/api/admin/tenants/:id", helpers.requireSuperAdmin, (req, res) => {
    const { name, plan } = req.body;
    const { id } = req.params;
    if (name) db.prepare("UPDATE tenants SET name = ? WHERE id = ?").run((name as string).trim(), id);
    if (plan) {
      const normalizedPlan = String(plan).toLowerCase();
      if (!config.planLimits[normalizedPlan]) {
        return res.status(400).json({ error: "Invalid plan. Must be free, starter, or pro" });
      }
      const branchCount = (db.prepare("SELECT COUNT(1) as c FROM tenant_branches WHERE tenant_id = ?").get(id) as any).c as number;
      const serviceCount = (db.prepare("SELECT COUNT(1) as c FROM tenant_services WHERE tenant_id = ?").get(id) as any).c as number;
      const limits = helpers.getPlanLimits(normalizedPlan);
      if (limits.maxBranches !== null && branchCount > limits.maxBranches) {
        return res.status(400).json({ error: `Cannot downgrade: tenant has ${branchCount} branches, but ${normalizedPlan} allows ${limits.maxBranches}` });
      }
      if (limits.maxServices !== null && serviceCount > limits.maxServices) {
        return res.status(400).json({ error: `Cannot downgrade: tenant has ${serviceCount} services, but ${normalizedPlan} allows ${limits.maxServices}` });
      }
      db.prepare("UPDATE tenants SET plan = ? WHERE id = ?").run(normalizedPlan, id);
      helpers.ensureTenantSubscription(id);
      db.prepare("UPDATE subscriptions SET plan = ?, amount = ?, updatedAt = ? WHERE tenant_id = ?")
        .run(normalizedPlan, helpers.getPlanPrice(normalizedPlan), new Date().toISOString(), id);
    }
    res.json({ status: "ok" });
  });

  app.delete("/api/admin/tenants/:id", helpers.requireSuperAdmin, (req, res) => {
    const { id } = req.params;
    if (id === "default") return res.status(400).json({ error: "Cannot delete the default tenant" });
    db.prepare("DELETE FROM admin_sessions WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)").run(id);
    db.prepare("DELETE FROM users WHERE tenant_id = ?").run(id);
    db.prepare("DELETE FROM tenants WHERE id = ?").run(id);
    res.json({ status: "ok" });
  });

  app.get("/api/admin/users", helpers.requireSuperAdmin, (_req, res) => {
    const users = db.prepare(`
      SELECT u.id, u.email, u.name, u.role, u.tenant_id, u.createdAt, u.lastLoginAt,
             t.name as tenantName
      FROM users u
      LEFT JOIN tenants t ON t.id = u.tenant_id
      ORDER BY u.createdAt DESC
    `).all();
    res.json(users);
  });

  app.put("/api/admin/users/:id", helpers.requireSuperAdmin, (req, res) => {
    const { role } = req.body;
    if (!["tenant_admin", "super_admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role. Must be tenant_admin or super_admin" });
    }
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, req.params.id);
    res.json({ status: "ok" });
  });

  app.delete("/api/admin/users/:id", helpers.requireSuperAdmin, (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM admin_sessions WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
    res.json({ status: "ok" });
  });

  app.get("/api/admin/history", helpers.requireAdmin, (req, res) => {
    const { from, to, branch } = req.query;
    const dbUser = helpers.getUserFromToken(req.headers["x-admin-token"] as string);
    if (!dbUser) return res.status(401).json({ error: "Session invalid" });
    let query = "SELECT * FROM history WHERE 1=1";
    const params: string[] = [];

    if (dbUser.role !== "super_admin") {
      query += " AND tenant_id = ?";
      params.push(dbUser.tenant_id);
    }

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

  app.get("/api/ticket/:id", (req, res) => {
    const ticketId = (req.params.id || "").trim().toUpperCase();
    if (!ticketId) return res.status(400).json({ error: "Ticket ID is required" });

    const inQueue = db.prepare("SELECT * FROM queue WHERE id = ?").get(ticketId) as any;
    if (inQueue) return res.json({ ticket: inQueue, location: "queue" });

    const inHistory = db.prepare("SELECT * FROM history WHERE id = ?").get(ticketId) as any;
    if (inHistory) return res.json({ ticket: inHistory, location: "history" });

    return res.status(404).json({ error: "Ticket not found" });
  });

  app.post("/api/tenants/:id/report", helpers.requireAdmin, async (req, res) => {
    const tenantId = req.params.id;
    const dbUser = helpers.getUserFromToken(req.headers["x-admin-token"] as string);
    if (!dbUser) return res.status(401).json({ error: "Session invalid" });
    if (!helpers.canAccessTenant(dbUser, tenantId)) {
      return res.status(403).json({ error: "Access denied for this tenant" });
    }
    const period = req.query.period === "monthly" ? "monthly" : "daily";
    try {
      await helpers.generateAndSendReport(tenantId, period as "daily" | "monthly");
      res.json({ status: "ok" });
    } catch (err: any) {
      console.error("Report error", err);
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  app.get("/api/stats/public", (_req, res) => {
    const totalTx = (db.prepare("SELECT COUNT(*) as c FROM history").get() as any).c as number;
    const totalTenants = (db.prepare("SELECT COUNT(*) as c FROM tenants WHERE id != 'default'").get() as any).c as number;
    const avgWaitRow = db.prepare(
      "SELECT AVG((julianday(calledTime) - julianday(checkInTime)) * 24 * 60) as avg FROM history WHERE calledTime IS NOT NULL AND calledTime != '' AND checkInTime IS NOT NULL"
    ).get() as any;
    res.json({
      totalTransactions: totalTx,
      totalTenants,
      avgWaitMinutes: avgWaitRow?.avg ? Math.round(avgWaitRow.avg * 10) / 10 : null,
    });
  });

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
    helpers.ensureTenantCatalog(demoTenantId);
    helpers.ensureTenantSubscription(demoTenantId);

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

    helpers.broadcast({ type: "QUEUE_UPDATED" });
    helpers.broadcast({ type: "HISTORY_UPDATED" });
    res.json({ token, role: "tenant_admin", demo: true, tenant_id: demoTenantId });
  });
}
