import type { RouteDeps } from "../types";

export function registerQueueRoutes({
  app,
  db,
  config,
  helpers,
}: RouteDeps) {
  app.get("/api/queue", helpers.requireAdmin, (req, res) => {
    const dbUser = helpers.getUserFromToken(req.headers["x-admin-token"] as string);
    if (!dbUser) return res.status(401).json({ error: "Session invalid" });
    const rows = dbUser.role === "super_admin"
      ? db.prepare("SELECT * FROM queue ORDER BY CASE WHEN priority='Priority' THEN 0 ELSE 1 END, checkInTime ASC").all()
      : db.prepare("SELECT * FROM queue WHERE tenant_id = ? ORDER BY CASE WHEN priority='Priority' THEN 0 ELSE 1 END, checkInTime ASC").all(dbUser.tenant_id);
    res.json(rows);
  });

  app.get("/api/history", helpers.requireAdmin, (req, res) => {
    const dbUser = helpers.getUserFromToken(req.headers["x-admin-token"] as string);
    if (!dbUser) return res.status(401).json({ error: "Session invalid" });
    const rows = dbUser.role === "super_admin"
      ? db.prepare("SELECT * FROM history ORDER BY completedTime DESC").all()
      : db.prepare("SELECT * FROM history WHERE tenant_id = ? ORDER BY completedTime DESC").all(dbUser.tenant_id);
    res.json(rows);
  });

  app.post("/api/queue", helpers.checkIPAccess, (req, res) => {
    const entry = req.body;
    const token = req.headers["x-admin-token"] as string | undefined;
    const user = token ? helpers.getUserFromToken(token) : null;

    if (!entry.name || typeof entry.name !== "string" || entry.name.trim().length === 0) {
      return res.status(400).json({ error: "Invalid name" });
    }
    if (!config.validPriorities.has(entry.priority)) {
      return res.status(400).json({ error: "Invalid priority" });
    }

    const tenantId = user?.tenant_id || entry.tenant_id || "default";
    const tenantExists = db.prepare("SELECT id FROM tenants WHERE id = ?").get(tenantId) as any;
    if (!tenantExists?.id) {
      return res.status(400).json({ error: "Invalid tenant" });
    }
    helpers.ensureTenantCatalog(tenantId);
    const catalog = helpers.getTenantCatalog(tenantId);
    if ((catalog.plan || 'free').toLowerCase() === 'free') {
      const usage = helpers.getMonthlyTransactionUsage(tenantId);
      if (usage.count >= usage.limit) {
        return res.status(403).json({
          error: `Free tier monthly transaction limit reached (${usage.limit}). Upgrade to continue accepting new queue entries.`,
          code: 'FREE_TIER_LIMIT_REACHED',
          usage,
        });
      }
    }
    if (!catalog.branches.includes(entry.branch)) {
      return res.status(400).json({ error: "Invalid branch for this tenant" });
    }
    if (!catalog.services.includes(entry.service)) {
      return res.status(400).json({ error: "Invalid service for this tenant" });
    }
    db.prepare(`
      INSERT INTO queue (id, tenant_id, name, branch, service, priority, source_channel, sla_target_minutes, checkInTime, status, first_called_time, calledTime, completedTime, paused_at, reassign_count, handled_by_user_id, handled_by_email, outcome, breach_reason, no_show_reason, pause_reason, resolution_code, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.id, tenantId, entry.name.trim(), entry.branch, entry.service,
      entry.priority, helpers.normalizeSourceChannel(entry.sourceChannel), helpers.normalizeSlaTarget(entry.slaTargetMinutes),
      entry.checkInTime, "Waiting",
      null, null, null, null, 0, null, null, null, null, null, null, null, null
    );
    helpers.broadcast({ type: "QUEUE_UPDATED" });
    res.json({ status: "ok" });
  });

  app.post("/api/call", helpers.requireAdmin, (req, res) => {
    const { id, calledTime } = req.body;
    const dbUser = helpers.getUserFromToken(req.headers["x-admin-token"] as string);
    if (!dbUser) return res.status(401).json({ error: "Session invalid" });
    const item = db.prepare("SELECT tenant_id FROM queue WHERE id = ?").get(id) as any;
    if (!item) return res.status(404).json({ error: "Ticket not found" });
    if (!helpers.canAccessTenant(dbUser, item.tenant_id || "default")) {
      return res.status(403).json({ error: "Access denied for this tenant" });
    }
    db.prepare("UPDATE queue SET status = 'Processing', calledTime = ?, first_called_time = COALESCE(first_called_time, ?), handled_by_user_id = ?, handled_by_email = ? WHERE id = ?").run(
      calledTime, calledTime, dbUser.id, dbUser.email, id
    );
    helpers.broadcast({ type: "QUEUE_UPDATED" });
    res.json({ status: "ok" });
  });

  app.post("/api/hold", helpers.requireAdmin, (req, res) => {
    const { id, pauseReason } = req.body;
    const dbUser = helpers.getUserFromToken(req.headers["x-admin-token"] as string);
    if (!dbUser) return res.status(401).json({ error: "Session invalid" });
    const item = db.prepare("SELECT tenant_id, status FROM queue WHERE id = ?").get(id) as any;
    if (!item) return res.status(404).json({ error: "Ticket not found" });
    if (!helpers.canAccessTenant(dbUser, item.tenant_id || "default")) {
      return res.status(403).json({ error: "Access denied for this tenant" });
    }
    if (item.status !== "Processing") {
      return res.status(400).json({ error: "Only processing tickets can be put on hold" });
    }
    const sanitizedPauseReason = helpers.sanitizePauseReason(pauseReason);
    if (!sanitizedPauseReason) {
      return res.status(400).json({ error: "Pause reason is required" });
    }
    db.prepare("UPDATE queue SET status = 'On Hold', paused_at = ?, pause_reason = ?, handled_by_user_id = ?, handled_by_email = ? WHERE id = ?").run(
      new Date().toISOString(),
      sanitizedPauseReason,
      dbUser.id,
      dbUser.email,
      id
    );
    helpers.broadcast({ type: "QUEUE_UPDATED" });
    res.json({ status: "ok" });
  });

  app.post("/api/resume", helpers.requireAdmin, (req, res) => {
    const { id } = req.body;
    const dbUser = helpers.getUserFromToken(req.headers["x-admin-token"] as string);
    if (!dbUser) return res.status(401).json({ error: "Session invalid" });
    const item = db.prepare("SELECT tenant_id, status FROM queue WHERE id = ?").get(id) as any;
    if (!item) return res.status(404).json({ error: "Ticket not found" });
    if (!helpers.canAccessTenant(dbUser, item.tenant_id || "default")) {
      return res.status(403).json({ error: "Access denied for this tenant" });
    }
    if (item.status !== "On Hold") {
      return res.status(400).json({ error: "Only on-hold tickets can be resumed" });
    }
    db.prepare("UPDATE queue SET status = 'Processing', paused_at = NULL, pause_reason = NULL, handled_by_user_id = ?, handled_by_email = ? WHERE id = ?").run(
      dbUser.id,
      dbUser.email,
      id
    );
    helpers.broadcast({ type: "QUEUE_UPDATED" });
    res.json({ status: "ok" });
  });

  app.post("/api/reassign", helpers.requireAdmin, (req, res) => {
    const { id, branch, service } = req.body;
    const dbUser = helpers.getUserFromToken(req.headers["x-admin-token"] as string);
    if (!dbUser) return res.status(401).json({ error: "Session invalid" });
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Ticket ID is required" });
    }
    const item = db.prepare("SELECT id, tenant_id FROM queue WHERE id = ?").get(id) as any;
    if (!item) return res.status(404).json({ error: "Ticket not found in active queue" });
    const tenantId = item.tenant_id || "default";
    if (!helpers.canAccessTenant(dbUser, tenantId)) {
      return res.status(403).json({ error: "Access denied for this tenant" });
    }
    helpers.ensureTenantCatalog(tenantId);
    const catalog = helpers.getTenantCatalog(tenantId);
    if (!catalog.branches.includes(branch)) {
      return res.status(400).json({ error: "Invalid branch for this tenant" });
    }
    if (!catalog.services.includes(service)) {
      return res.status(400).json({ error: "Invalid service for this tenant" });
    }

    db.prepare(
      "UPDATE queue SET branch = ?, service = ?, priority = 'Priority', status = 'Waiting', calledTime = NULL, handled_by_user_id = NULL, handled_by_email = NULL, reassign_count = COALESCE(reassign_count, 0) + 1 WHERE id = ?"
    ).run(branch, service, id);

    helpers.broadcast({ type: "QUEUE_UPDATED" });
    res.json({ status: "ok" });
  });

  app.post("/api/recall", helpers.requireAdmin, (req, res) => {
    const { id } = req.body;
    const dbUser = helpers.getUserFromToken(req.headers["x-admin-token"] as string);
    if (!dbUser) return res.status(401).json({ error: "Session invalid" });
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Ticket ID is required" });
    }

    const item = db.prepare("SELECT tenant_id, status FROM queue WHERE id = ?").get(id) as any;
    if (!item) return res.status(404).json({ error: "Ticket not found" });
    if (!helpers.canAccessTenant(dbUser, item.tenant_id || "default")) {
      return res.status(403).json({ error: "Access denied for this tenant" });
    }
    if (item.status !== "Processing") {
      return res.status(400).json({ error: "Only processing tickets can be recalled" });
    }

    db.prepare("UPDATE queue SET calledTime = ?, handled_by_user_id = ?, handled_by_email = ? WHERE id = ?").run(
      new Date().toISOString(),
      dbUser.id,
      dbUser.email,
      id
    );
    helpers.broadcast({ type: "QUEUE_UPDATED" });
    res.json({ status: "ok" });
  });

  app.post("/api/complete", helpers.requireAdmin, (req, res) => {
    const { id, completedTime, notes, breachReason, resolutionCode } = req.body;
    const dbUser = helpers.getUserFromToken(req.headers["x-admin-token"] as string);
    if (!dbUser) return res.status(401).json({ error: "Session invalid" });
    const item = db.prepare("SELECT * FROM queue WHERE id = ?").get(id) as any;
    if (item) {
      if (!helpers.canAccessTenant(dbUser, item.tenant_id || "default")) {
        return res.status(403).json({ error: "Access denied for this tenant" });
      }
      const sanitizedNotes = typeof notes === "string" && notes.trim().length > 0
        ? notes.trim().slice(0, 500)
        : null;
      const sanitizedBreachReason = helpers.sanitizeBreachReason(breachReason);
      const sanitizedResolutionCode = helpers.sanitizeResolutionCode(resolutionCode);
      if (!sanitizedResolutionCode) {
        return res.status(400).json({ error: "Resolution code is required" });
      }
      db.prepare(`
        INSERT INTO history (id, tenant_id, name, branch, service, priority, source_channel, sla_target_minutes, checkInTime, status, first_called_time, calledTime, completedTime, paused_at, reassign_count, handled_by_user_id, handled_by_email, outcome, breach_reason, no_show_reason, pause_reason, resolution_code, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.id, item.tenant_id || "default", item.name, item.branch, item.service, item.priority,
        item.source_channel || "self_service", item.sla_target_minutes || 10, item.checkInTime, "Completed",
        item.first_called_time || item.calledTime, item.calledTime, completedTime, item.paused_at || null,
        item.reassign_count || 0, item.handled_by_user_id || null, item.handled_by_email || null, "completed", sanitizedBreachReason, null, item.pause_reason || null, sanitizedResolutionCode, sanitizedNotes
      );
      db.prepare("DELETE FROM queue WHERE id = ?").run(id);
      helpers.broadcast({ type: "QUEUE_UPDATED" });
      helpers.broadcast({ type: "HISTORY_UPDATED" });
    }
    res.json({ status: "ok" });
  });

  app.post("/api/noshow", helpers.requireAdmin, (req, res) => {
    const { id, noShowReason } = req.body;
    const dbUser = helpers.getUserFromToken(req.headers["x-admin-token"] as string);
    if (!dbUser) return res.status(401).json({ error: "Session invalid" });
    const item = db.prepare("SELECT * FROM queue WHERE id = ?").get(id) as any;
    if (item) {
      if (!helpers.canAccessTenant(dbUser, item.tenant_id || "default")) {
        return res.status(403).json({ error: "Access denied for this tenant" });
      }
      const sanitizedNoShowReason = helpers.sanitizeNoShowReason(noShowReason);
      db.prepare(`
        INSERT INTO history (id, tenant_id, name, branch, service, priority, source_channel, sla_target_minutes, checkInTime, status, first_called_time, calledTime, completedTime, paused_at, reassign_count, handled_by_user_id, handled_by_email, outcome, breach_reason, no_show_reason, pause_reason, resolution_code, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.id, item.tenant_id || "default", item.name, item.branch, item.service, item.priority,
        item.source_channel || "self_service", item.sla_target_minutes || 10, item.checkInTime, "No Show",
        item.first_called_time || item.calledTime, item.calledTime, new Date().toISOString(), item.paused_at || null,
        item.reassign_count || 0, item.handled_by_user_id || dbUser.id, item.handled_by_email || dbUser.email, "no_show", null, sanitizedNoShowReason, item.pause_reason || null, null, null
      );
      db.prepare("DELETE FROM queue WHERE id = ?").run(id);
      helpers.broadcast({ type: "QUEUE_UPDATED" });
      helpers.broadcast({ type: "HISTORY_UPDATED" });
    }
    res.json({ status: "ok" });
  });
}
