import crypto from "crypto";
import fs from "fs";
import path from "path";
// @ts-ignore
import nodemailer from "nodemailer";
// @ts-ignore
import PDFDocument from "pdfkit";
import type { RouteDeps } from "../types";

export function registerBillingRoutes({
  app,
  db,
  config,
  paths,
  helpers,
}: RouteDeps) {
  app.get("/api/billing/me", helpers.requireAdmin, (req, res) => {
    const dbUser = helpers.getUserFromToken(req.headers["x-admin-token"] as string);
    if (!dbUser) return res.status(401).json({ error: "Session invalid" });
    const tenant = db.prepare("SELECT id, name, plan, settings FROM tenants WHERE id = ?").get(dbUser.tenant_id) as any;
    const subscription = db.prepare("SELECT * FROM subscriptions WHERE tenant_id = ?").get(dbUser.tenant_id) as any;
    const recentSubmissions = db.prepare("SELECT * FROM payment_submissions WHERE tenant_id = ? ORDER BY submittedAt DESC LIMIT 5").all(dbUser.tenant_id);
    const billing = helpers.getBillingConfig();
    const settings = tenant?.settings ? JSON.parse(tenant.settings) : {};
    res.json({
      tenant: {
        id: tenant?.id,
        name: tenant?.name,
        plan: tenant?.plan || "free",
        contactEmail: settings?.contact_email || "",
      },
      subscription: subscription || null,
      pricing: config.planPrices,
      billing,
      submissions: recentSubmissions,
    });
  });

  app.post("/api/billing/submit-proof", helpers.requireAdmin, (req, res) => {
    const dbUser = helpers.getUserFromToken(req.headers["x-admin-token"] as string);
    if (!dbUser || dbUser.role === "super_admin") return res.status(401).json({ error: "Tenant admin session required" });
    const desiredPlan = String(req.body?.desiredPlan || "").toLowerCase();
    const referenceCode = typeof req.body?.referenceCode === "string" ? req.body.referenceCode.trim().slice(0, 120) : "";
    const notes = typeof req.body?.notes === "string" ? req.body.notes.trim().slice(0, 500) : "";
    const dataUrl = typeof req.body?.proofDataUrl === "string" ? req.body.proofDataUrl : "";
    if (!["starter", "pro"].includes(desiredPlan)) return res.status(400).json({ error: "Invalid paid plan" });
    if (!referenceCode) return res.status(400).json({ error: "Reference code is required" });
    if (!dataUrl.startsWith("data:image/")) return res.status(400).json({ error: "Payment proof image is required" });

    const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i);
    if (!match) return res.status(400).json({ error: "Unsupported image format" });
    const mime = match[1].toLowerCase();
    const base64 = match[2];
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length > 4 * 1024 * 1024) return res.status(400).json({ error: "Proof image too large (max 4MB)" });

    const id = crypto.randomUUID();
    const filename = `${dbUser.tenant_id}-${Date.now()}.${ext}`;
    const filePath = path.join(paths.paymentProofsDir, filename);
    fs.writeFileSync(filePath, buffer);
    const proofUrl = `/billing-files/proofs/${filename}`;

    db.prepare(
      "INSERT INTO payment_submissions (id, tenant_id, desired_plan, amount, reference_code, proof_url, status, notes, submittedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      id,
      dbUser.tenant_id,
      desiredPlan,
      helpers.getPlanPrice(desiredPlan),
      referenceCode,
      proofUrl,
      "pending",
      notes,
      new Date().toISOString()
    );

    res.status(201).json({ status: "ok", id });
  });

  app.get("/api/admin/billing/settings", helpers.requireSuperAdmin, (_req, res) => {
    res.json(helpers.getBillingConfig());
  });

  app.post("/api/admin/billing/settings", helpers.requireSuperAdmin, (req, res) => {
    const current = helpers.getBillingConfig();
    const next: any = {
      ...current,
      bankName: typeof req.body?.bankName === "string" ? req.body.bankName.trim().slice(0, 160) : current.bankName,
      accountName: typeof req.body?.accountName === "string" ? req.body.accountName.trim().slice(0, 160) : current.accountName,
      accountNumber: typeof req.body?.accountNumber === "string" ? req.body.accountNumber.trim().slice(0, 160) : current.accountNumber,
      instructions: typeof req.body?.instructions === "string" ? req.body.instructions.trim().slice(0, 1000) : current.instructions,
      graceDays: Number.isFinite(Number(req.body?.graceDays)) ? Math.max(1, Math.min(30, Number(req.body.graceDays))) : current.graceDays,
    };

    const qrDataUrl = typeof req.body?.qrDataUrl === "string" ? req.body.qrDataUrl : "";
    if (qrDataUrl) {
      const match = qrDataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i);
      if (!match) return res.status(400).json({ error: "Invalid QR image" });
      const mime = match[1].toLowerCase();
      const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
      const buffer = Buffer.from(match[2], "base64");
      const filename = `billing-qr-${Date.now()}.${ext}`;
      const filePath = path.join(paths.billingQrDir, filename);
      fs.writeFileSync(filePath, buffer);
      next.qrUrl = `/billing-files/qr/${filename}`;
    }

    helpers.saveBillingConfig(next);
    res.json({ status: "ok", config: next });
  });

  app.get("/api/admin/billing/overview", helpers.requireSuperAdmin, (_req, res) => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const plus7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const startMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    const paidTenants = (db.prepare("SELECT COUNT(*) as c FROM subscriptions WHERE plan IN ('starter','pro') AND status IN ('active','due_soon','overdue')").get() as any).c as number;
    const mrr = (db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM subscriptions WHERE plan IN ('starter','pro') AND status IN ('active','due_soon','overdue')").get() as any).s as number;
    const dueSoon = (db.prepare("SELECT COUNT(*) as c FROM subscriptions WHERE period_end IS NOT NULL AND date(period_end) >= date(?) AND date(period_end) <= date(?) AND status IN ('active','due_soon')").get(todayStr, plus7) as any).c as number;
    const overdue = (db.prepare("SELECT COUNT(*) as c FROM subscriptions WHERE period_end IS NOT NULL AND date(period_end) < date(?) AND status = 'overdue'").get(todayStr) as any).c as number;
    const renewedThisMonth = (db.prepare("SELECT COUNT(*) as c FROM receipts WHERE createdAt >= ?").get(startMonth) as any).c as number;
    const downgradedThisMonth = (db.prepare("SELECT COUNT(*) as c FROM subscriptions WHERE status = 'downgraded_free' AND updatedAt >= ?").get(startMonth) as any).c as number;
    res.json({ paidTenants, mrr, dueSoon, overdue, renewedThisMonth, downgradedThisMonth });
  });

  app.get("/api/admin/billing/submissions", helpers.requireSuperAdmin, (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const rows = status
      ? db.prepare(`
          SELECT ps.*, t.name as tenantName
          FROM payment_submissions ps
          LEFT JOIN tenants t ON t.id = ps.tenant_id
          WHERE ps.status = ?
          ORDER BY ps.submittedAt DESC
        `).all(status)
      : db.prepare(`
          SELECT ps.*, t.name as tenantName
          FROM payment_submissions ps
          LEFT JOIN tenants t ON t.id = ps.tenant_id
          ORDER BY ps.submittedAt DESC
        `).all();
    res.json(rows);
  });

  app.post("/api/admin/billing/submissions/:id/reject", helpers.requireSuperAdmin, (req, res) => {
    const { id } = req.params;
    const notes = typeof req.body?.notes === "string" ? req.body.notes.trim().slice(0, 500) : "";
    const reviewer = helpers.getUserFromToken(req.headers["x-admin-token"] as string);
    db.prepare("UPDATE payment_submissions SET status = 'rejected', reviewedAt = ?, reviewed_by = ?, notes = ? WHERE id = ?")
      .run(new Date().toISOString(), reviewer?.id || null, notes, id);
    res.json({ status: "ok" });
  });

  app.post("/api/admin/billing/submissions/:id/confirm", helpers.requireSuperAdmin, async (req, res) => {
    const { id } = req.params;
    const periodMonths = Math.max(1, Math.min(12, Number(req.body?.periodMonths || 1)));
    const reviewer = helpers.getUserFromToken(req.headers["x-admin-token"] as string);
    const submission = db.prepare("SELECT * FROM payment_submissions WHERE id = ?").get(id) as any;
    if (!submission) return res.status(404).json({ error: "Submission not found" });
    if (submission.status !== "pending") return res.status(400).json({ error: "Submission already reviewed" });

    const tenant = db.prepare("SELECT * FROM tenants WHERE id = ?").get(submission.tenant_id) as any;
    if (!tenant) return res.status(400).json({ error: "Tenant not found" });

    const start = new Date();
    const end = new Date(start);
    end.setMonth(end.getMonth() + periodMonths);
    const plan = (submission.desired_plan || "starter").toLowerCase();
    const amount = Number(submission.amount || helpers.getPlanPrice(plan));
    const billingCfg = helpers.getBillingConfig();
    const graceDays = Number.isFinite(Number(billingCfg.graceDays)) ? Number(billingCfg.graceDays) : 5;

    db.prepare("UPDATE payment_submissions SET status = 'confirmed', reviewedAt = ?, reviewed_by = ? WHERE id = ?")
      .run(new Date().toISOString(), reviewer?.id || null, id);

    db.prepare(
      "INSERT INTO subscriptions (tenant_id, plan, status, period_start, period_end, grace_days, amount, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(tenant_id) DO UPDATE SET plan=excluded.plan, status=excluded.status, period_start=excluded.period_start, period_end=excluded.period_end, grace_days=excluded.grace_days, amount=excluded.amount, updatedAt=excluded.updatedAt"
    ).run(
      submission.tenant_id,
      plan,
      "active",
      start.toISOString(),
      end.toISOString(),
      graceDays,
      amount,
      new Date().toISOString()
    );
    db.prepare("UPDATE tenants SET plan = ? WHERE id = ?").run(plan, submission.tenant_id);

    const receiptNo = `RCPT-${new Date().toISOString().slice(0, 7).replace("-", "")}-${Date.now().toString().slice(-5)}`;
    const receiptId = crypto.randomUUID();
    const receiptPdfPath = path.join(paths.receiptsDir, `${receiptNo}.pdf`);
    const receiptPdfUrl = `/billing-files/receipts/${receiptNo}.pdf`;
    const pdf = new PDFDocument();
    const receiptStream = fs.createWriteStream(receiptPdfPath);
    pdf.pipe(receiptStream);
    pdf.fontSize(16).text("Smart Queue Payment Receipt", { align: "center" });
    pdf.moveDown();
    pdf.fontSize(11).text(`Receipt No: ${receiptNo}`);
    pdf.text(`Tenant: ${tenant.name || submission.tenant_id}`);
    pdf.text(`Plan: ${plan.toUpperCase()}`);
    pdf.text(`Amount: PHP ${amount.toFixed(2)}`);
    pdf.text(`Period: ${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}`);
    pdf.text(`Reference: ${submission.reference_code || "-"}`);
    pdf.text(`Issued At: ${new Date().toISOString()}`);
    pdf.end();
    await new Promise<void>((resolve) => receiptStream.on("finish", () => resolve()));

    db.prepare(
      "INSERT INTO receipts (id, tenant_id, payment_submission_id, receipt_no, amount, plan, period_start, period_end, pdf_url, createdAt, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      receiptId,
      submission.tenant_id,
      id,
      receiptNo,
      amount,
      plan,
      start.toISOString(),
      end.toISOString(),
      receiptPdfUrl,
      new Date().toISOString(),
      reviewer?.id || null
    );

    const tenantSettings = tenant.settings ? JSON.parse(tenant.settings) : {};
    const recipient = tenantSettings?.contact_email || tenantSettings?.email_contact || null;
    if (recipient) {
      try {
        const smtp = tenantSettings?.smtp || {
          host: process.env.SMTP_HOST || "localhost",
          port: Number(process.env.SMTP_PORT || 25),
          secure: process.env.SMTP_SECURE === "true",
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
        };
        const transporter = nodemailer.createTransport(smtp as any);
        await transporter.sendMail({
          from: tenantSettings?.smtp?.from || process.env.SMTP_FROM || "no-reply@example.com",
          to: recipient,
          subject: `Payment Receipt ${receiptNo}`,
          text: `Thank you for your payment.\n\nReceipt: ${receiptNo}\nPlan: ${plan.toUpperCase()}\nAmount: PHP ${amount.toFixed(2)}\nPeriod: ${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}.`,
          attachments: [{ filename: `${receiptNo}.pdf`, path: receiptPdfPath }],
        });
      } catch (err) {
        console.error("[BILLING] Failed to send receipt email", err);
      }
    }

    res.json({ status: "ok", receiptNo, receiptPdfUrl });
  });
}
