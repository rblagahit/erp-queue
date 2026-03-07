import test from "node:test";
import assert from "node:assert/strict";
import os from "os";
import path from "path";
import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { createSmartQueueServer } from "../server";

type JsonRequestOptions = {
  method?: string;
  token?: string;
  body?: unknown;
};

async function requestJson(baseUrl: string, route: string, options: JsonRequestOptions = {}) {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers["x-admin-token"] = options.token;

  const response = await fetch(`${baseUrl}${route}`, {
    method: options.method || (options.body === undefined ? "GET" : "POST"),
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return { response, data };
}

async function startTestServer() {
  process.env.NODE_ENV = "test";
  process.env.ADMIN_EMAIL = "admin@test.local";
  process.env.ADMIN_PASSWORD = "AdminPass123!";

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "smart-queue-test-"));
  const dbPath = path.join(tempDir, "ssb_queue.db");
  const runtime = await createSmartQueueServer({
    dbPath,
    listen: true,
    host: "127.0.0.1",
    port: 0,
    serveFrontend: false,
    enableSchedules: false,
  });
  const address = runtime.server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    ...runtime,
    baseUrl,
    async dispose() {
      await runtime.close();
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

async function registerTenant(baseUrl: string, suffix: string) {
  const email = `tenant-${suffix}@test.local`;
  const password = "TenantPass123!";
  const { response, data } = await requestJson(baseUrl, "/api/auth/register", {
    body: {
      name: `Tenant ${suffix}`,
      organization: `Organization ${suffix}`,
      email,
      password,
    },
  });
  assert.equal(response.status, 201);
  const token = data.token as string;
  const me = await requestJson(baseUrl, "/api/auth/me", { token });
  assert.equal(me.response.status, 200);
  const catalog = await requestJson(baseUrl, "/api/admin/catalog", { token });
  assert.equal(catalog.response.status, 200);
  return {
    email,
    password,
    token,
    tenantId: me.data.tenant_id as string,
    branch: catalog.data.branches[0] as string,
    service: catalog.data.services[0] as string,
    alternateService: (catalog.data.services[1] || catalog.data.services[0]) as string,
  };
}

const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn7l2QAAAAASUVORK5CYII=";

test("role-specific login routes work", async (t) => {
  const runtime = await startTestServer();
  t.after(async () => {
    await runtime.dispose();
  });

  const superLogin = await requestJson(runtime.baseUrl, "/api/admin/login/super", {
    body: {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    },
  });
  assert.equal(superLogin.response.status, 200);
  assert.equal(superLogin.data.role, "super_admin");

  const tenant = await registerTenant(runtime.baseUrl, "login");

  const tenantLogin = await requestJson(runtime.baseUrl, "/api/admin/login/tenant", {
    body: { email: tenant.email, password: tenant.password },
  });
  assert.equal(tenantLogin.response.status, 200);
  assert.equal(tenantLogin.data.role, "tenant_admin");

  const tenantAsSuper = await requestJson(runtime.baseUrl, "/api/admin/login/super", {
    body: { email: tenant.email, password: tenant.password },
  });
  assert.equal(tenantAsSuper.response.status, 403);
});

test("queue lifecycle moves records into history", async (t) => {
  const runtime = await startTestServer();
  t.after(async () => {
    await runtime.dispose();
  });

  const tenant = await registerTenant(runtime.baseUrl, "lifecycle");
  const ticketId = "SQ-TEST001";

  const create = await requestJson(runtime.baseUrl, "/api/queue", {
    token: tenant.token,
    body: {
      id: ticketId,
      tenant_id: tenant.tenantId,
      name: "Juan Dela Cruz",
      branch: tenant.branch,
      service: tenant.service,
      priority: "Regular",
      sourceChannel: "self_service",
      slaTargetMinutes: 10,
      checkInTime: new Date().toISOString(),
    },
  });
  assert.equal(create.response.status, 200);

  const call = await requestJson(runtime.baseUrl, "/api/call", {
    token: tenant.token,
    body: { id: ticketId, calledTime: new Date().toISOString() },
  });
  assert.equal(call.response.status, 200);

  const reassign = await requestJson(runtime.baseUrl, "/api/reassign", {
    token: tenant.token,
    body: { id: ticketId, branch: tenant.branch, service: tenant.alternateService },
  });
  assert.equal(reassign.response.status, 200);

  const recallAfterReassign = await requestJson(runtime.baseUrl, "/api/call", {
    token: tenant.token,
    body: { id: ticketId, calledTime: new Date().toISOString() },
  });
  assert.equal(recallAfterReassign.response.status, 200);

  const hold = await requestJson(runtime.baseUrl, "/api/hold", {
    token: tenant.token,
    body: { id: ticketId, pauseReason: "Awaiting documents" },
  });
  assert.equal(hold.response.status, 200);

  const resume = await requestJson(runtime.baseUrl, "/api/resume", {
    token: tenant.token,
    body: { id: ticketId },
  });
  assert.equal(resume.response.status, 200);

  const complete = await requestJson(runtime.baseUrl, "/api/complete", {
    token: tenant.token,
    body: {
      id: ticketId,
      completedTime: new Date().toISOString(),
      notes: "Served successfully",
      breachReason: "",
      resolutionCode: "served",
    },
  });
  assert.equal(complete.response.status, 200);

  const queue = await requestJson(runtime.baseUrl, "/api/queue", { token: tenant.token });
  assert.equal(queue.response.status, 200);
  assert.equal(queue.data.length, 0);

  const history = await requestJson(runtime.baseUrl, "/api/history", { token: tenant.token });
  assert.equal(history.response.status, 200);
  const completed = history.data.find((entry: any) => entry.id === ticketId);
  assert.ok(completed);
  assert.equal(completed.outcome, "completed");
  assert.equal(completed.reassign_count, 1);
  assert.equal(completed.branch, tenant.branch);
  assert.equal(completed.service, tenant.alternateService);
  assert.equal(completed.resolution_code, "served");
});

test("tenant admins cannot act on another tenant's queue", async (t) => {
  const runtime = await startTestServer();
  t.after(async () => {
    await runtime.dispose();
  });

  const tenantA = await registerTenant(runtime.baseUrl, "tenant-a");
  const tenantB = await registerTenant(runtime.baseUrl, "tenant-b");
  const ticketId = "SQ-TEST403";

  const create = await requestJson(runtime.baseUrl, "/api/queue", {
    token: tenantA.token,
    body: {
      id: ticketId,
      tenant_id: tenantA.tenantId,
      name: "Maria Santos",
      branch: tenantA.branch,
      service: tenantA.service,
      priority: "Regular",
      sourceChannel: "self_service",
      slaTargetMinutes: 10,
      checkInTime: new Date().toISOString(),
    },
  });
  assert.equal(create.response.status, 200);

  const forbiddenCall = await requestJson(runtime.baseUrl, "/api/call", {
    token: tenantB.token,
    body: { id: ticketId, calledTime: new Date().toISOString() },
  });
  assert.equal(forbiddenCall.response.status, 403);
});


test("free tier monthly transaction cap blocks new queue entries once reached", async (t) => {
  const runtime = await startTestServer();
  t.after(async () => {
    await runtime.dispose();
  });

  const superLogin = await requestJson(runtime.baseUrl, "/api/admin/login/super", {
    body: {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    },
  });
  assert.equal(superLogin.response.status, 200);
  const superToken = superLogin.data.token as string;

  const configure = await requestJson(runtime.baseUrl, "/api/admin/billing/settings", {
    token: superToken,
    body: {
      freeMonthlyTransactions: 1,
      starterPrice: 1200,
      proPrice: 3400,
    },
  });
  assert.equal(configure.response.status, 200);

  const tenant = await registerTenant(runtime.baseUrl, "free-cap");

  const first = await requestJson(runtime.baseUrl, "/api/queue", {
    token: tenant.token,
    body: {
      id: "SQ-CAP001",
      tenant_id: tenant.tenantId,
      name: "First Customer",
      branch: tenant.branch,
      service: tenant.service,
      priority: "Regular",
      sourceChannel: "self_service",
      slaTargetMinutes: 10,
      checkInTime: new Date().toISOString(),
    },
  });
  assert.equal(first.response.status, 200);

  const second = await requestJson(runtime.baseUrl, "/api/queue", {
    token: tenant.token,
    body: {
      id: "SQ-CAP002",
      tenant_id: tenant.tenantId,
      name: "Second Customer",
      branch: tenant.branch,
      service: tenant.service,
      priority: "Regular",
      sourceChannel: "self_service",
      slaTargetMinutes: 10,
      checkInTime: new Date().toISOString(),
    },
  });
  assert.equal(second.response.status, 403);
  assert.equal(second.data.code, "FREE_TIER_LIMIT_REACHED");

  const billingMe = await requestJson(runtime.baseUrl, "/api/billing/me", { token: tenant.token });
  assert.equal(billingMe.response.status, 200);
  assert.equal(billingMe.data.pricing.starter, 1200);
  assert.equal(billingMe.data.pricing.pro, 3400);
  assert.equal(billingMe.data.usage.count, 1);
  assert.equal(billingMe.data.usage.limit, 1);
});

test("super admin site branding settings round-trip without losing seo fields", async (t) => {
  const runtime = await startTestServer();
  t.after(async () => {
    await runtime.dispose();
  });

  const superLogin = await requestJson(runtime.baseUrl, "/api/admin/login/super", {
    body: {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    },
  });
  assert.equal(superLogin.response.status, 200);
  const superToken = superLogin.data.token as string;

  const saveSettings = await requestJson(runtime.baseUrl, "/api/admin/settings/site", {
    token: superToken,
    body: {
      seoTitle: "LiteQue.com | Multi-Tenant Queue SaaS",
      seoDescription: "Queue intelligence for multi-tenant service teams.",
      seoKeywords: "queue saas, multi-tenant dashboard, sla tracking",
      supportEmail: "support@liteque.com",
      textLogo: "LiteQue.com",
      tagLine: "Smart Queue Intelligence",
      logoDataUrl: TINY_PNG_DATA_URL,
    },
  });
  assert.equal(saveSettings.response.status, 200);
  assert.equal(saveSettings.data.textLogo, "LiteQue.com");
  assert.equal(saveSettings.data.tagLine, "Smart Queue Intelligence");
  assert.match(saveSettings.data.logoUrl, /^\/platform-branding\//);

  const publicConfig = await requestJson(runtime.baseUrl, "/api/public/site-config");
  assert.equal(publicConfig.response.status, 200);
  assert.equal(publicConfig.data.seoTitle, "LiteQue.com | Multi-Tenant Queue SaaS");
  assert.equal(publicConfig.data.supportEmail, "support@liteque.com");
  assert.equal(publicConfig.data.textLogo, "LiteQue.com");
  assert.equal(publicConfig.data.tagLine, "Smart Queue Intelligence");
});
