import type express from "express";
import type Database from "better-sqlite3";
import type { WebSocketServer } from "ws";

export type AppConfig = {
  isDev: boolean;
  loginWindowMs: number;
  loginMaxAttempts: number;
  defaultBranches: string[];
  defaultServices: string[];
  validPriorities: Set<string>;
  validCustomerTerms: Set<string>;
  planLimits: Record<string, { maxBranches: number | null; maxServices: number | null }>;
  planPrices: Record<string, number>;
};

export type AppPaths = {
  rootDir: string;
  distDir: string;
  tenantLogoDir: string;
  billingFilesDir: string;
  paymentProofsDir: string;
  receiptsDir: string;
  billingQrDir: string;
};

export type LoginAttemptState = Map<string, { count: number; resetAt: number }>;

export type AppHelpers = {
  normalizeIP: (ip: string) => string;
  getClientIP: (req: express.Request) => string;
  getActiveSession: (token: string | undefined) => { token: string; user_id: string | null; createdAt: string } | null;
  requireAdmin: express.RequestHandler;
  requireSuperAdmin: express.RequestHandler;
  getUserFromToken: (token: string) => any;
  canAccessTenant: (user: any, tenantId: string) => boolean;
  normalizeNameList: (items: unknown) => string[];
  getPlanLimits: (planRaw?: string) => { maxBranches: number | null; maxServices: number | null };
  getPlanPrice: (planRaw?: string) => number;
  getPlanPricing: () => { free: number; starter: number; pro: number; freeMonthlyTransactions: number };
  getMonthlyTransactionUsage: (tenantId: string, referenceDate?: Date) => { count: number; limit: number; remaining: number; periodStart: string; periodEnd: string };
  normalizeSourceChannel: (value: unknown) => string;
  normalizeSlaTarget: (value: unknown) => number;
  sanitizeBreachReason: (value: unknown) => string | null;
  sanitizeNoShowReason: (value: unknown) => string | null;
  sanitizePauseReason: (value: unknown) => string | null;
  sanitizeResolutionCode: (value: unknown) => string | null;
  getBillingConfig: () => any;
  saveBillingConfig: (config: any) => void;
  getTenantCatalog: (tenantId: string) => {
    tenantId: string;
    plan: string;
    branches: string[];
    services: string[];
    customerTerm: string;
  };
  checkIPAccess: express.RequestHandler;
  broadcast: (data: any) => void;
  getTenant: (tenantId: string) => any;
  ensureDefaultTenant: () => void;
  ensureTenantCatalog: (tenantId: string) => void;
  ensureTenantSubscription: (tenantId: string) => void;
  generatePDF: (tenantId: string, fromDate: string, toDate: string, branch?: string) => Promise<string>;
  generateAndSendReport: (tenantId: string, period: "daily" | "monthly") => Promise<void>;
};

export type RouteDeps = {
  app: express.Express;
  db: Database.Database;
  wss: WebSocketServer;
  config: AppConfig;
  paths: AppPaths;
  state: {
    loginAttempts: LoginAttemptState;
  };
  helpers: AppHelpers;
};

export type CreateAppOptions = {
  dbPath?: string;
  port?: number;
  host?: string;
  listen?: boolean;
  serveFrontend?: boolean;
  enableSchedules?: boolean;
};
