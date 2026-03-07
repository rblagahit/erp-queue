/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './utils';
import {
  BREACH_REASON_OPTIONS,
  NO_SHOW_REASON_OPTIONS,
  PAUSE_REASON_OPTIONS,
  RESOLUTION_CODE_OPTIONS,
  SLA_THRESHOLD_MINUTES,
  type QueueApiEntry,
  type QueueEntry,
} from './features/queue/model';

interface IPEntry {
  ip: string;
  label: string;
  addedAt: string;
}

const DEFAULT_BRANCHES = [
  "Carcar Branch", "Moalboal Branch", "Talisay Branch", "Carbon Branch",
  "Solinea Branch", "Mandaue Branch", "Danao Branch", "Bogo Branch",
  "Capitol Branch"
];

const DEFAULT_SERVICES = [
  "Cash/Check Deposit", "Withdrawal", "Account Opening", "Customer Service", "Loans"
];

const CUSTOMER_TERMS: Record<string, { singular: string; plural: string; title: string }> = {
  customer: { singular: "customer", plural: "customers", title: "Customer" },
  client: { singular: "client", plural: "clients", title: "Client" },
  patient: { singular: "patient", plural: "patients", title: "Patient" },
  citizen: { singular: "citizen", plural: "citizens", title: "Citizen" },
};

const AnalyticsPanel = lazy(() => import('./features/dashboard/AnalyticsPanel'));
const AdminOverviewPanel = lazy(() => import('./features/dashboard/AdminOverviewPanel'));
const TellerPanel = lazy(() => import('./features/dashboard/TellerPanel'));
const AdminOperationsPanel = lazy(() => import('./features/dashboard/AdminOperationsPanel'));
const AdminReportsPanel = lazy(() => import('./features/dashboard/AdminReportsPanel'));
const AdminSettingsPanel = lazy(() => import('./features/dashboard/AdminSettingsPanel'));
const AdminPlatformPanel = lazy(() => import('./features/dashboard/AdminPlatformPanel'));

interface AppProps {
  onGoToLanding?: () => void;
  initialView?: 'client' | 'teller' | 'display' | 'analytics' | 'admin';
  loginRole?: 'tenant_admin' | 'super_admin';
}

type AdminArea = 'overview' | 'access' | 'catalog' | 'kiosk' | 'profile' | 'integrations' | 'subscription' | 'seo' | 'exports' | 'delivery' | 'billing' | 'users' | 'tenants';
type AdminParentKey = 'operations' | 'administration' | 'insights';

const DEFAULT_PLATFORM_BRAND = {
  textLogo: 'Smart Queue',
  tagLine: 'Queue Intelligence Platform',
  logoUrl: '',
};

function upsertBrandLink(selector: string, rel: string, href: string) {
  let node = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (!node) {
    node = document.createElement('link');
    node.rel = rel;
    document.head.appendChild(node);
  }
  node.href = href;
}

export default function App({ onGoToLanding, initialView = 'teller', loginRole = 'tenant_admin' }: AppProps = {}) {
  const [view, setView] = useState<'client' | 'teller' | 'display' | 'analytics' | 'admin'>(initialView);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [history, setHistory] = useState<QueueEntry[]>([]);
  const [tenantId, setTenantId] = useState('default');
  const [branches, setBranches] = useState<string[]>(DEFAULT_BRANCHES);
  const [services, setServices] = useState<string[]>(DEFAULT_SERVICES);
  const [customerTerm, setCustomerTerm] = useState<'customer' | 'client' | 'patient' | 'citizen'>('customer');
  const [tenantPlan, setTenantPlan] = useState<'free' | 'starter' | 'pro'>('free');
  const [planLimits, setPlanLimits] = useState<{ maxBranches: number | null; maxServices: number | null }>({ maxBranches: 1, maxServices: 5 });
  const [filterBranch, setFilterBranch] = useState('All');
  const [analyticsBranch, setAnalyticsBranch] = useState('All');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notification, setNotification] = useState<{ msg: string; isError?: boolean } | null>(null);
  const notifTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Admin state
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);

  // Auth flow state
  const [authView, setAuthView] = useState<'login' | 'forgot' | 'reset'>('login');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [ipList, setIpList] = useState<IPEntry[]>([]);
  const [newIP, setNewIP] = useState('');
  const [newIPLabel, setNewIPLabel] = useState('');
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [exportBranch, setExportBranch] = useState('All');

  // API Key state
  const [apiKey, setApiKey] = useState('');       // stores masked value from server
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [siteSeoTitle, setSiteSeoTitle] = useState('');
  const [siteSeoDescription, setSiteSeoDescription] = useState('');
  const [siteSeoKeywords, setSiteSeoKeywords] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [platformTextLogo, setPlatformTextLogo] = useState(DEFAULT_PLATFORM_BRAND.textLogo);
  const [platformTagLine, setPlatformTagLine] = useState(DEFAULT_PLATFORM_BRAND.tagLine);
  const [platformLogoUrl, setPlatformLogoUrl] = useState(DEFAULT_PLATFORM_BRAND.logoUrl);
  const [platformLogoDataUrl, setPlatformLogoDataUrl] = useState('');
  const [siteSettingsSaving, setSiteSettingsSaving] = useState(false);

  // Role-based access
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  // SMTP settings state
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [smtpTo, setSmtpTo] = useState('');
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'monthly'>('daily');
  const [sendingReport, setSendingReport] = useState(false);

  // Super admin — users & tenants
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminTenants, setAdminTenants] = useState<any[]>([]);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<string | null>(null);
  const [confirmDeleteTenant, setConfirmDeleteTenant] = useState<string | null>(null);
  const [editTenantName, setEditTenantName] = useState<Record<string, string>>({});
  const [editTenantPlan, setEditTenantPlan] = useState<Record<string, 'free' | 'starter' | 'pro'>>({});

  // UI state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [confirmRemoveIP, setConfirmRemoveIP] = useState<string | null>(null);
  const [completionNotes, setCompletionNotes] = useState<Record<string, string>>({});
  const [completionBreachReasons, setCompletionBreachReasons] = useState<Record<string, string>>({});
  const [completionResolutionCodes, setCompletionResolutionCodes] = useState<Record<string, string>>({});
  const [noShowReasons, setNoShowReasons] = useState<Record<string, string>>({});
  const [pauseReasons, setPauseReasons] = useState<Record<string, string>>({});
  const [reassignBranch, setReassignBranch] = useState<Record<string, string>>({});
  const [reassignService, setReassignService] = useState<Record<string, string>>({});
  const [catalogBranchesText, setCatalogBranchesText] = useState('');
  const [catalogServicesText, setCatalogServicesText] = useState('');
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [adminArea, setAdminArea] = useState<AdminArea>('overview');
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [companyLogoUrl, setCompanyLogoUrl] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [billingMe, setBillingMe] = useState<any>(null);
  const [billingOverview, setBillingOverview] = useState<any>(null);
  const [billingSubmissions, setBillingSubmissions] = useState<any[]>([]);
  const [billingSettings, setBillingSettings] = useState<any>({ bankName: '', accountName: '', accountNumber: '', instructions: '', qrUrl: '', graceDays: 5, starterPrice: 999, proPrice: 2499, freeMonthlyTransactions: 500 });
  const [billingSettingsSaving, setBillingSettingsSaving] = useState(false);
  const [billingQrDataUrl, setBillingQrDataUrl] = useState('');
  const [paymentPlan, setPaymentPlan] = useState<'starter' | 'pro'>('starter');
  const [paymentMonths, setPaymentMonths] = useState(1);
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentProofDataUrl, setPaymentProofDataUrl] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [billingReviewBusy, setBillingReviewBusy] = useState<string | null>(null);
  const [clientBranch, setClientBranch] = useState(DEFAULT_BRANCHES[0]);
  const [clientService, setClientService] = useState(DEFAULT_SERVICES[0]);
  const [clientPriority, setClientPriority] = useState<'Regular' | 'Priority'>('Regular');
  const [qrBranch, setQrBranch] = useState(DEFAULT_BRANCHES[0]);
  const [qrService, setQrService] = useState(DEFAULT_SERVICES[0]);

  const showNotification = (msg: string, isError = false) => {
    if (notifTimeoutRef.current) clearTimeout(notifTimeoutRef.current);
    setNotification({ msg, isError });
    notifTimeoutRef.current = setTimeout(() => setNotification(null), 3500);
  };

  const termCopy = CUSTOMER_TERMS[customerTerm] || CUSTOMER_TERMS.customer;

  const generateTicketId = () => {
    const hasUUID = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function';
    const raw = hasUUID
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`.toUpperCase();
    return `SQ-${raw.slice(0, 8).toUpperCase()}`;
  };

  const getEntrySourceChannel = () => {
    const params = new URLSearchParams(window.location.search);
    if (adminToken) return 'staff_assisted';
    if (params.get('kiosk') === '1') return 'qr_kiosk';
    return 'self_service';
  };

  const normalizeQueueEntry = (entry: QueueApiEntry): QueueEntry => ({
    ...entry,
    sourceChannel: entry.sourceChannel ?? entry.source_channel ?? 'self_service',
    slaTargetMinutes: entry.slaTargetMinutes ?? entry.sla_target_minutes ?? SLA_THRESHOLD_MINUTES,
    firstCalledTime: entry.firstCalledTime ?? entry.first_called_time ?? null,
    pausedAt: entry.pausedAt ?? entry.paused_at ?? null,
    reassignCount: entry.reassignCount ?? entry.reassign_count ?? 0,
    handledByUserId: entry.handledByUserId ?? entry.handled_by_user_id ?? null,
    handledByEmail: entry.handledByEmail ?? entry.handled_by_email ?? null,
    breachReason: entry.breachReason ?? entry.breach_reason ?? null,
    noShowReason: entry.noShowReason ?? entry.no_show_reason ?? null,
    pauseReason: entry.pauseReason ?? entry.pause_reason ?? null,
    resolutionCode: entry.resolutionCode ?? entry.resolution_code ?? null,
  });

  const fetchData = async () => {
    const token = localStorage.getItem('adminToken');
    const headers: HeadersInit = token ? { 'x-admin-token': token } : {};
    try {
      const [qRes, hRes] = await Promise.all([
        fetch('/api/queue', { headers }),
        fetch('/api/history', { headers })
      ]);
      if (qRes.ok) {
        const data = await qRes.json();
        setQueue(Array.isArray(data) ? data.map(normalizeQueueEntry) : []);
      }
      else if (qRes.status === 401) setQueue([]);
      if (hRes.ok) {
        const data = await hRes.json();
        setHistory(Array.isArray(data) ? data.map(normalizeQueueEntry) : []);
      }
      else if (hRes.status === 401) setHistory([]);
    } catch (err) {
      console.error("Failed to fetch data", err);
    }
  };

  // Initial load, WebSocket, polling
  useEffect(() => {
    loadCatalog();
    fetchData();
    const pollInterval = setInterval(fetchData, 30000);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'QUEUE_UPDATED' || data.type === 'HISTORY_UPDATED') fetchData();
      } catch (e) {
        console.error("WS Message Error", e);
      }
    };
    ws.onerror = (err) => console.error("WebSocket Error", err);

    return () => { ws.close(); clearInterval(pollInterval); };
  }, []);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (filterBranch !== 'All' && !branches.includes(filterBranch)) setFilterBranch('All');
    if (analyticsBranch !== 'All' && !branches.includes(analyticsBranch)) setAnalyticsBranch('All');
    if (exportBranch !== 'All' && !branches.includes(exportBranch)) setExportBranch('All');
    if (!branches.includes(clientBranch)) setClientBranch(branches[0] || '');
    if (!branches.includes(qrBranch)) setQrBranch(branches[0] || '');
  }, [branches, filterBranch, analyticsBranch, exportBranch]);

  useEffect(() => {
    if (!services.includes(clientService)) setClientService(services[0] || '');
    if (!services.includes(qrService)) setQrService(services[0] || '');
  }, [services, clientService, qrService]);

  // Restore admin session from localStorage and verify it
  useEffect(() => {
    const stored = localStorage.getItem('adminToken');
    if (stored) {
      fetch('/api/admin/verify', { headers: { 'x-admin-token': stored } })
        .then(async res => {
          if (res.ok) {
            setAdminToken(stored);
            loadCatalog(stored);
            const me = await fetch('/api/auth/me', { headers: { 'x-admin-token': stored } });
            if (me.ok) {
              const u = await me.json();
              setCurrentUserRole(u.role);
            }
          } else {
            localStorage.removeItem('adminToken');
          }
        })
        .catch(() => localStorage.removeItem('adminToken'));
    }
  }, []);

  // Detect password reset token in URL on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rt = params.get('reset_token');
    if (rt) {
      setResetToken(rt);
      setView('admin');
      setAuthView('reset');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Allow direct TV display mode via ?view=display
  useEffect(() => {
    const viewParam = new URLSearchParams(window.location.search).get('view');
    if (viewParam === 'display') {
      setView('display');
    }
  }, []);

  // Kiosk deep-link support (?kiosk=1&tenant_id=...&branch=...&service=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const kiosk = params.get('kiosk') === '1';
    const tenant = params.get('tenant_id');
    const branch = params.get('branch');
    const service = params.get('service');

    if (kiosk) setView('client');
    if (tenant) loadCatalog(undefined, tenant);
    if (branch) setClientBranch(branch);
    if (service) setClientService(service);
  }, []);

  // Load IPs, settings, SMTP, and super-admin data when entering admin view
  useEffect(() => {
    void loadPublicSiteConfig();
  }, []);

  useEffect(() => {
    if (platformLogoUrl) {
      upsertBrandLink('link[rel="icon"]', 'icon', platformLogoUrl);
      upsertBrandLink('link[rel="apple-touch-icon"]', 'apple-touch-icon', platformLogoUrl);
    }
  }, [platformLogoUrl]);

  useEffect(() => {
    if (view === 'admin' && adminToken) {
      loadIPs();
      loadSettings();
      loadSmtp();
      loadProfile();
      loadAdminCatalog();
      loadBillingMe();
      if (currentUserRole === 'super_admin') {
        loadBillingOverview();
        loadBillingSubmissions();
        loadBillingSettings();
        loadSiteSettings();
      }
    }
  }, [view, adminToken, currentUserRole]);

  useEffect(() => {
    if (view === 'admin' && adminToken && currentUserRole === 'super_admin') {
      loadAdminUsers();
      loadAdminTenants();
    }
  }, [view, adminToken, currentUserRole]);

  // ===== ADMIN FUNCTIONS =====

  const loadIPs = async (token?: string) => {
    const t = token ?? adminToken;
    if (!t) return;
    try {
      const res = await fetch('/api/admin/ips', { headers: { 'x-admin-token': t } });
      if (res.ok) setIpList(await res.json());
      else if (res.status === 401) { setAdminToken(null); localStorage.removeItem('adminToken'); }
    } catch (err) {
      console.error('Failed to load IPs', err);
    }
  };

  const loadSettings = async (token?: string) => {
    const t = token ?? adminToken;
    if (!t) return;
    try {
      const res = await fetch('/api/admin/settings', { headers: { 'x-admin-token': t } });
      if (res.ok) {
        const { configured, masked } = await res.json();
        setApiKey(configured ? masked : '');
        setApiKeyInput('');
      }
    } catch (err) {
      console.error('Failed to load settings', err);
    }
  };

  const loadPublicSiteConfig = async () => {
    try {
      const res = await fetch('/api/public/site-config');
      if (!res.ok) return;
      const data = await res.json();
      setSupportEmail(data.supportEmail || '');
      setPlatformTextLogo(data.textLogo || DEFAULT_PLATFORM_BRAND.textLogo);
      setPlatformTagLine(data.tagLine || DEFAULT_PLATFORM_BRAND.tagLine);
      setPlatformLogoUrl(data.logoUrl || DEFAULT_PLATFORM_BRAND.logoUrl);
    } catch (err) {
      console.error('Failed to load public site config', err);
    }
  };

  const loadSiteSettings = async (token?: string) => {
    const t = token ?? adminToken;
    if (!t) return;
    try {
      const res = await fetch('/api/admin/settings/site', { headers: { 'x-admin-token': t } });
      if (res.ok) {
        const data = await res.json();
        setSiteSeoTitle(data.seoTitle || '');
        setSiteSeoDescription(data.seoDescription || '');
        setSiteSeoKeywords(data.seoKeywords || '');
        setSupportEmail(data.supportEmail || '');
        setPlatformTextLogo(data.textLogo || DEFAULT_PLATFORM_BRAND.textLogo);
        setPlatformTagLine(data.tagLine || DEFAULT_PLATFORM_BRAND.tagLine);
        setPlatformLogoUrl(data.logoUrl || DEFAULT_PLATFORM_BRAND.logoUrl);
        setPlatformLogoDataUrl('');
      }
    } catch (err) {
      console.error('Failed to load site settings', err);
    }
  };

  const handlePlatformLogoSelection = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        showNotification('Failed to read the platform logo file.', true);
        return;
      }
      setPlatformLogoDataUrl(result);
    };
    reader.onerror = () => showNotification('Failed to read the platform logo file.', true);
    reader.readAsDataURL(file);
  };

  const saveSiteSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setSiteSettingsSaving(true);
    try {
      const res = await fetch('/api/admin/settings/site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({
          seoTitle: siteSeoTitle,
          seoDescription: siteSeoDescription,
          seoKeywords: siteSeoKeywords,
          supportEmail,
          textLogo: platformTextLogo,
          tagLine: platformTagLine,
          logoDataUrl: platformLogoDataUrl,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSiteSeoTitle(data.seoTitle || '');
        setSiteSeoDescription(data.seoDescription || '');
        setSiteSeoKeywords(data.seoKeywords || '');
        setSupportEmail(data.supportEmail || '');
        setPlatformTextLogo(data.textLogo || DEFAULT_PLATFORM_BRAND.textLogo);
        setPlatformTagLine(data.tagLine || DEFAULT_PLATFORM_BRAND.tagLine);
        setPlatformLogoUrl(data.logoUrl || DEFAULT_PLATFORM_BRAND.logoUrl);
        setPlatformLogoDataUrl('');
        showNotification('Platform branding, SEO, and support settings saved.');
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to save platform branding and support settings.' }));
        showNotification(err.error || 'Failed to save platform branding and support settings.', true);
      }
    } catch {
      showNotification('Failed to save platform branding and support settings.', true);
    } finally {
      setSiteSettingsSaving(false);
    }
  };

  const saveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || !apiKeyInput.trim()) return;
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ apiKey: apiKeyInput })
      });
      if (res.ok) {
        setApiKeyInput('');
        await loadSettings();
        showNotification('API key saved successfully.');
      } else {
        showNotification('Failed to save API key.', true);
      }
    } catch {
      showNotification('Failed to save API key. Check connection.', true);
    }
  };

  const removeApiKey = async () => {
    if (!adminToken) return;
    try {
      const res = await fetch('/api/admin/settings/apikey', {
        method: 'DELETE',
        headers: { 'x-admin-token': adminToken }
      });
      if (res.ok) {
        setApiKey('');
        setApiKeyInput('');
        showNotification('API key removed.');
      } else {
        showNotification('Failed to remove API key.', true);
      }
    } catch {
      showNotification('Failed to remove API key. Check connection.', true);
    }
  };

  const loadSmtp = async (token?: string) => {
    const t = token ?? adminToken;
    if (!t) return;
    try {
      const res = await fetch('/api/admin/smtp', { headers: { 'x-admin-token': t } });
      if (res.ok) {
        const d = await res.json();
        setSmtpHost(d.host || '');
        setSmtpPort(String(d.port || 587));
        setSmtpSecure(d.secure || false);
        setSmtpUser(d.user || '');
        setSmtpFrom(d.from || '');
        setSmtpTo(d.to || '');
      }
    } catch {}
  };

  const loadProfile = async (token?: string) => {
    const t = token ?? adminToken;
    if (!t) return;
    try {
      const res = await fetch('/api/admin/profile', { headers: { 'x-admin-token': t } });
      if (res.ok) {
        const d = await res.json();
        setCompanyName(d.companyName || '');
        setIndustry(d.industry || '');
        setContactEmail(d.contactEmail || '');
        setContactPhone(d.contactPhone || '');
        setCompanyLogoUrl(d.logoUrl || '');
      }
    } catch {}
  };

  const uploadCompanyLogo = async (file: File) => {
    if (!adminToken) return;
    if (!file.type.startsWith('image/')) {
      showNotification('Please upload an image file.', true);
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

    setLogoUploading(true);
    try {
      const res = await fetch('/api/admin/profile/logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ dataUrl }),
      });
      if (res.ok) {
        const d = await res.json();
        setCompanyLogoUrl(d.logoUrl || '');
        showNotification('Company logo uploaded.');
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to upload logo.' }));
        showNotification(err.error || 'Failed to upload logo.', true);
      }
    } catch {
      showNotification('Failed to upload logo. Check connection.', true);
    } finally {
      setLogoUploading(false);
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setProfileSaving(true);
    try {
      const res = await fetch('/api/admin/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ companyName, industry, contactEmail, contactPhone }),
      });
      if (res.ok) {
        showNotification('Company profile saved.');
        await loadProfile();
        if (currentUserRole === 'super_admin') await loadAdminTenants();
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to save profile.' }));
        showNotification(err.error || 'Failed to save profile.', true);
      }
    } catch {
      showNotification('Failed to save profile. Check connection.', true);
    } finally {
      setProfileSaving(false);
    }
  };

  const loadBillingMe = async (token?: string) => {
    const t = token ?? adminToken;
    if (!t) return;
    try {
      const res = await fetch('/api/billing/me', { headers: { 'x-admin-token': t } });
      if (res.ok) {
        const d = await res.json();
        setBillingMe(d);
      }
    } catch {}
  };

  const loadBillingOverview = async (token?: string) => {
    const t = token ?? adminToken;
    if (!t) return;
    try {
      const res = await fetch('/api/admin/billing/overview', { headers: { 'x-admin-token': t } });
      if (res.ok) setBillingOverview(await res.json());
    } catch {}
  };

  const loadBillingSubmissions = async (token?: string) => {
    const t = token ?? adminToken;
    if (!t) return;
    try {
      const res = await fetch('/api/admin/billing/submissions?status=pending', { headers: { 'x-admin-token': t } });
      if (res.ok) setBillingSubmissions(await res.json());
    } catch {}
  };

  const loadBillingSettings = async (token?: string) => {
    const t = token ?? adminToken;
    if (!t) return;
    try {
      const res = await fetch('/api/admin/billing/settings', { headers: { 'x-admin-token': t } });
      if (res.ok) setBillingSettings(await res.json());
    } catch {}
  };

  const saveBillingSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setBillingSettingsSaving(true);
    try {
      const payload = {
        ...billingSettings,
        qrDataUrl: billingQrDataUrl || undefined,
      };
      const res = await fetch('/api/admin/billing/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const d = await res.json();
        setBillingSettings(d.config || billingSettings);
        setBillingQrDataUrl('');
        showNotification('Billing settings saved.');
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to save billing settings.' }));
        showNotification(err.error || 'Failed to save billing settings.', true);
      }
    } catch {
      showNotification('Failed to save billing settings.', true);
    } finally {
      setBillingSettingsSaving(false);
    }
  };

  const submitPaymentProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    if (!paymentProofDataUrl) {
      showNotification('Upload payment proof image first.', true);
      return;
    }
    if (!paymentReference.trim()) {
      showNotification('Reference code is required.', true);
      return;
    }
    setPaymentSubmitting(true);
    try {
      const res = await fetch('/api/billing/submit-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({
          desiredPlan: paymentPlan,
          periodMonths: paymentMonths,
          referenceCode: paymentReference,
          notes: paymentNotes,
          proofDataUrl: paymentProofDataUrl,
        }),
      });
      if (res.ok) {
        showNotification('Payment proof submitted. Awaiting confirmation.');
        setPaymentReference('');
        setPaymentNotes('');
        setPaymentProofDataUrl('');
        setPaymentMonths(1);
        await loadBillingMe();
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to submit payment proof.' }));
        showNotification(err.error || 'Failed to submit payment proof.', true);
      }
    } catch {
      showNotification('Failed to submit payment proof.', true);
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const confirmPaymentSubmission = async (submissionId: string) => {
    if (!adminToken) return;
    const monthsRaw = window.prompt('Confirm subscription period in months (1-12):', '1');
    const monthsParsed = Math.max(1, Math.min(12, Number(monthsRaw || 1)));
    if (!Number.isFinite(monthsParsed)) return;
    setBillingReviewBusy(`confirm-${submissionId}`);
    try {
      const res = await fetch(`/api/admin/billing/submissions/${submissionId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ periodMonths: monthsParsed }),
      });
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        showNotification('Payment confirmed and receipt generated.');
        if (d?.receiptPdfUrl) {
          window.open(d.receiptPdfUrl, '_blank');
        }
        await loadBillingSubmissions();
        await loadBillingOverview();
        await loadBillingMe();
        await loadAdminTenants();
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to confirm payment.' }));
        showNotification(err.error || 'Failed to confirm payment.', true);
      }
    } catch {
      showNotification('Failed to confirm payment.', true);
    } finally {
      setBillingReviewBusy(null);
    }
  };

  const rejectPaymentSubmission = async (submissionId: string) => {
    if (!adminToken) return;
    const note = window.prompt('Reason for rejection:', 'Payment details are incomplete.');
    if (note === null) return;
    setBillingReviewBusy(`reject-${submissionId}`);
    try {
      const res = await fetch(`/api/admin/billing/submissions/${submissionId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ notes: note }),
      });
      if (res.ok) {
        showNotification('Payment submission rejected.');
        await loadBillingSubmissions();
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to reject payment.' }));
        showNotification(err.error || 'Failed to reject payment.', true);
      }
    } catch {
      showNotification('Failed to reject payment.', true);
    } finally {
      setBillingReviewBusy(null);
    }
  };

  const applyCatalog = (d: any) => {
    const nextBranches = Array.isArray(d?.branches) && d.branches.length ? d.branches : DEFAULT_BRANCHES;
    const nextServices = Array.isArray(d?.services) && d.services.length ? d.services : DEFAULT_SERVICES;
    const nextTerm = typeof d?.customerTerm === 'string' && CUSTOMER_TERMS[d.customerTerm] ? d.customerTerm : 'customer';
    const nextPlan = typeof d?.plan === 'string' && ['free', 'starter', 'pro'].includes(d.plan) ? d.plan : 'free';
    setBranches(nextBranches);
    setServices(nextServices);
    setTenantId(d?.tenantId || 'default');
    setCustomerTerm(nextTerm as 'customer' | 'client' | 'patient' | 'citizen');
    setTenantPlan(nextPlan as 'free' | 'starter' | 'pro');
    setPlanLimits(d?.limits || { maxBranches: 1, maxServices: 5 });
  };

  const loadCatalog = async (token?: string, requestedTenantId?: string) => {
    const t = token ?? adminToken;
    const headers: HeadersInit = t ? { 'x-admin-token': t } : {};
    try {
      const params = new URLSearchParams();
      if (requestedTenantId) params.set('tenant_id', requestedTenantId);
      const res = await fetch(`/api/catalog${params.toString() ? `?${params}` : ''}`, { headers });
      if (res.ok) {
        const d = await res.json();
        applyCatalog(d);
      }
    } catch {}
  };

  const loadAdminCatalog = async (token?: string) => {
    const t = token ?? adminToken;
    if (!t) return;
    try {
      const res = await fetch('/api/admin/catalog', { headers: { 'x-admin-token': t } });
      if (res.ok) {
        const d = await res.json();
        applyCatalog(d);
        setCatalogBranchesText((d.branches || []).join('\n'));
        setCatalogServicesText((d.services || []).join('\n'));
      }
    } catch {}
  };

  const saveCatalog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    const nextBranches = catalogBranchesText.split('\n').map(v => v.trim()).filter(Boolean);
    const nextServices = catalogServicesText.split('\n').map(v => v.trim()).filter(Boolean);
    setCatalogSaving(true);
    try {
      const res = await fetch('/api/admin/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({
          branches: nextBranches,
          services: nextServices,
          customerTerm,
        }),
      });
      if (res.ok) {
        showNotification('Catalog settings saved.');
        await loadAdminCatalog();
        await fetchData();
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to save catalog settings.' }));
        showNotification(err.error || 'Failed to save catalog settings.', true);
      }
    } catch {
      showNotification('Failed to save catalog settings. Check connection.', true);
    } finally {
      setCatalogSaving(false);
    }
  };

  const saveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setSmtpSaving(true);
    try {
      const res = await fetch('/api/admin/smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ host: smtpHost, port: Number(smtpPort), secure: smtpSecure, user: smtpUser, pass: smtpPass, from: smtpFrom, to: smtpTo }),
      });
      if (res.ok) showNotification('SMTP settings saved.');
      else showNotification('Failed to save SMTP settings.', true);
    } catch {
      showNotification('Failed to save SMTP settings. Check connection.', true);
    } finally {
      setSmtpSaving(false);
    }
  };

  const downloadPDF = async () => {
    if (!adminToken) return;
    const params = new URLSearchParams();
    if (exportFrom) params.append('from', exportFrom);
    if (exportTo) params.append('to', exportTo);
    if (exportBranch && exportBranch !== 'All') params.append('branch', exportBranch);
    try {
      const res = await fetch(`/api/admin/report/pdf?${params}`, { headers: { 'x-admin-token': adminToken } });
      if (!res.ok) { showNotification('Failed to generate PDF.', true); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${exportFrom || 'all'}-${exportTo || 'today'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showNotification('Failed to download PDF. Check connection.', true);
    }
  };

  const sendTestReport = async () => {
    if (!adminToken) return;
    setSendingReport(true);
    try {
      const res = await fetch('/api/admin/report/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ period: reportPeriod }),
      });
      if (res.ok) showNotification(`${reportPeriod === 'monthly' ? 'Monthly' : 'Daily'} report sent successfully.`);
      else { const e = await res.json().catch(() => ({})); showNotification(e.error || 'Failed to send report.', true); }
    } catch {
      showNotification('Failed to send report. Check connection.', true);
    } finally {
      setSendingReport(false);
    }
  };

  const loadAdminUsers = async (token?: string) => {
    const t = token ?? adminToken;
    if (!t) return;
    try {
      const res = await fetch('/api/admin/users', { headers: { 'x-admin-token': t } });
      if (res.ok) setAdminUsers(await res.json());
    } catch {}
  };

  const loadAdminTenants = async (token?: string) => {
    const t = token ?? adminToken;
    if (!t) return;
    try {
      const res = await fetch('/api/admin/tenants', { headers: { 'x-admin-token': t } });
      if (res.ok) {
        const data = await res.json();
        setAdminTenants(data);
        const names: Record<string, string> = {};
        const plans: Record<string, 'free' | 'starter' | 'pro'> = {};
        data.forEach((t: any) => {
          names[t.id] = t.name;
          plans[t.id] = (['free', 'starter', 'pro'].includes(t.plan) ? t.plan : 'free') as 'free' | 'starter' | 'pro';
        });
        setEditTenantName(names);
        setEditTenantPlan(plans);
      }
    } catch {}
  };

  const updateUserRole = async (userId: string, role: string) => {
    if (!adminToken) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ role }),
      });
      if (res.ok) { showNotification('Role updated.'); await loadAdminUsers(); }
      else showNotification('Failed to update role.', true);
    } catch { showNotification('Failed to update role.', true); }
  };

  const deleteUser = async (userId: string) => {
    if (!adminToken) return;
    try {
      await fetch(`/api/admin/users/${userId}`, { method: 'DELETE', headers: { 'x-admin-token': adminToken } });
      setConfirmDeleteUser(null);
      showNotification('User deleted.');
      await loadAdminUsers();
    } catch { showNotification('Failed to delete user.', true); }
  };

  const updateTenantName = async (tenantId: string) => {
    if (!adminToken) return;
    const name = editTenantName[tenantId];
    if (!name?.trim()) return;
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) { showNotification('Tenant updated.'); await loadAdminTenants(); }
      else showNotification('Failed to update tenant.', true);
    } catch { showNotification('Failed to update tenant.', true); }
  };

  const updateTenantPlan = async (tenantId: string) => {
    if (!adminToken) return;
    const plan = editTenantPlan[tenantId];
    if (!plan) return;
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ plan }),
      });
      if (res.ok) {
        showNotification('Tenant plan updated.');
        await loadAdminTenants();
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to update tenant plan.' }));
        showNotification(err.error || 'Failed to update tenant plan.', true);
      }
    } catch {
      showNotification('Failed to update tenant plan.', true);
    }
  };

  const deleteTenant = async (tenantId: string) => {
    if (!adminToken) return;
    try {
      await fetch(`/api/admin/tenants/${tenantId}`, { method: 'DELETE', headers: { 'x-admin-token': adminToken } });
      setConfirmDeleteTenant(null);
      showNotification('Tenant deleted.');
      await loadAdminTenants();
      await loadAdminUsers();
    } catch { showNotification('Failed to delete tenant.', true); }
  };

  const adminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoginError(null);
    try {
      const loginEndpoint = loginRole === 'super_admin' ? '/api/admin/login/super' : '/api/admin/login/tenant';
      const res = await fetch(loginEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password: adminPassword })
      });
      if (res.ok) {
          const { token } = await res.json();
          setAdminToken(token);
          localStorage.setItem('adminToken', token);
        setAdminEmail('');
        setAdminPassword('');
          loadIPs(token);
          loadSettings(token);
          loadSmtp(token);
          loadProfile(token);
          loadCatalog(token);
          loadAdminCatalog(token);
          fetch('/api/auth/me', { headers: { 'x-admin-token': token } })
            .then(r => r.json())
            .then(u => {
              setCurrentUserRole(u.role);
            })
            .catch(() => {});
      } else {
        const err = await res.json().catch(() => ({}));
        setAdminLoginError(err.error || 'Invalid email or password. Please try again.');
      }
    } catch {
      setAdminLoginError('Login failed. Please check your connection.');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      });
    } catch { /* silent — always show success */ }
    setForgotSent(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoginError(null);
    if (resetNewPassword !== resetConfirm) {
      setAdminLoginError('Passwords do not match.');
      return;
    }
    if (resetNewPassword.length < 8) {
      setAdminLoginError('Password must be at least 8 characters.');
      return;
    }
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, password: resetNewPassword })
      });
      if (res.ok) {
        setResetSuccess(true);
        setTimeout(() => {
          setAuthView('login');
          setResetSuccess(false);
          setResetNewPassword('');
          setResetConfirm('');
          setResetToken('');
        }, 3000);
      } else {
        const err = await res.json().catch(() => ({}));
        setAdminLoginError(err.error || 'Reset failed. The link may have expired.');
      }
    } catch {
      setAdminLoginError('Reset failed. Please check your connection.');
    }
  };

  const playChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.7);
      setTimeout(() => ctx.close(), 1000);
    } catch {}
  };

  const adminLogout = async () => {
    if (adminToken) {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: { 'x-admin-token': adminToken }
      }).catch(() => {});
    }
    setAdminToken(null);
    setCurrentUserRole(null);
    localStorage.removeItem('adminToken');
    loadCatalog();
    setView('teller');
  };

  const addIP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIP.trim() || !adminToken) return;
    try {
      const res = await fetch('/api/admin/ips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ ip: newIP.trim(), label: newIPLabel.trim() })
      });
      if (res.ok) {
        setNewIP('');
        setNewIPLabel('');
        await loadIPs();
        showNotification(`IP ${newIP.trim()} added to whitelist.`);
      } else {
        const err = await res.json();
        showNotification(err.error || 'Failed to add IP.', true);
      }
    } catch {
      showNotification('Failed to add IP. Check connection.', true);
    }
  };

  const removeIP = async (ip: string) => {
    if (!adminToken) return;
    try {
      await fetch(`/api/admin/ips/${encodeURIComponent(ip)}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': adminToken }
      });
      setConfirmRemoveIP(null);
      await loadIPs();
      showNotification(`IP ${ip} removed.`);
    } catch {
      showNotification('Failed to remove IP.', true);
    }
  };

  const detectMyIP = async () => {
    try {
      const res = await fetch('/api/admin/my-ip');
      if (res.ok) {
        const { ip } = await res.json();
        setNewIP(ip);
      }
    } catch {
      showNotification('Could not detect IP.', true);
    }
  };

  const downloadAdminCSV = async () => {
    if (!adminToken) return;
    const params = new URLSearchParams();
    if (exportFrom) params.append('from', exportFrom);
    if (exportTo) params.append('to', exportTo);
    if (exportBranch !== 'All') params.append('branch', exportBranch);

    try {
      const res = await fetch(`/api/admin/history?${params}`, {
        headers: { 'x-admin-token': adminToken }
      });
      if (!res.ok) {
        if (res.status === 401) {
          setAdminToken(null);
          localStorage.removeItem('adminToken');
          showNotification('Session expired. Please log in again.', true);
        } else {
          showNotification('Export failed. Please try again.', true);
        }
        return;
      }

      const payload = await res.json();
      const data: QueueEntry[] = Array.isArray(payload) ? payload.map(normalizeQueueEntry) : [];
      if (data.length === 0) {
        showNotification('No records found for the selected filters.', true);
        return;
      }

      // Compute TAT per service from the filtered dataset
      const serviceStats: Record<string, { total: number; count: number }> = {};
      services.forEach(s => serviceStats[s] = { total: 0, count: 0 });
      data.forEach(h => {
        if (h.completedTime && h.calledTime && serviceStats[h.service]) {
          const dur = (new Date(h.completedTime).getTime() - new Date(h.calledTime).getTime()) / 60000;
          if (!isNaN(dur) && dur >= 0) {
            serviceStats[h.service].total += dur;
            serviceStats[h.service].count += 1;
          }
        }
      });

      const headers = [
        "Ticket ID", `${termCopy.title} Name`, "Branch", "Service", "Priority",
        "Entry Source", "SLA Target (m)", "First Response", "Reassignments", "Handled By", "Outcome", "Resolution Code", "Breach Reason", "No Show Reason", "Pause Reason",
        "Check-In", "Called At", "Completed At", "Wait Time (m)", "Service Time (m)"
      ];
      const rows = data.map(h => {
        const wait = h.calledTime && h.checkInTime
          ? Math.round((new Date(h.calledTime).getTime() - new Date(h.checkInTime).getTime()) / 60000) : 0;
        const svc = h.completedTime && h.calledTime
          ? Math.round((new Date(h.completedTime).getTime() - new Date(h.calledTime).getTime()) / 60000) : 0;
        return [h.id, h.name, h.branch, h.service, h.priority,
          h.sourceChannel || 'self_service', h.slaTargetMinutes || SLA_THRESHOLD_MINUTES, h.firstCalledTime || '', h.reassignCount || 0, h.handledByEmail || '', h.outcome || h.status, h.resolutionCode || '', h.breachReason || '', h.noShowReason || '', h.pauseReason || '',
          h.checkInTime, h.calledTime || '', h.completedTime || '', wait, svc];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
        '',
        'TAT per Service Type Summary',
        'Service Type,Average TAT (m),Total Transactions',
        ...services.map(s => `"${s}",${serviceStats[s].count
          ? Math.round(serviceStats[s].total / serviceStats[s].count) : 0},${serviceStats[s].count}`)
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateTag = exportFrom || exportTo
        ? `${exportFrom || 'start'}_to_${exportTo || 'end'}`
        : 'all-dates';
      link.download = `SmartQueue_Report_${dateTag}.csv`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => { document.body.removeChild(link); window.URL.revokeObjectURL(url); }, 100);
      showNotification(`Exported ${data.length} record${data.length !== 1 ? 's' : ''}.`);
    } catch (err) {
      console.error('CSV Export Error:', err);
      showNotification('Export failed. Check console for details.', true);
    }
  };

  // ===== QUEUE FUNCTIONS =====

  const handleCheckIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = formData.get('clientName') as string;
    if (!name) return;
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (adminToken) headers['x-admin-token'] = adminToken;

    const entry: QueueEntry = {
      id: generateTicketId(),
      name,
      branch: clientBranch,
      service: clientService,
      priority: clientPriority,
      sourceChannel: getEntrySourceChannel(),
      slaTargetMinutes: SLA_THRESHOLD_MINUTES,
      checkInTime: new Date().toISOString(),
      status: 'Waiting',
      firstCalledTime: null,
      calledTime: null,
      completedTime: null,
      reassignCount: 0,
      outcome: null,
      breachReason: null,
    };

    try {
      const res = await fetch('/api/queue', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...entry, tenant_id: tenantId })
      });
      if (res.ok) {
        const waitingAhead = queue.filter(q => q.status === 'Waiting' && q.branch === entry.branch).length;
        const position = waitingAhead + 1;
        const avgMin = analytics.tat > 0 ? analytics.tat : 5;
        const estWait = Math.round(position * avgMin);
        await fetchData();
        showNotification(`Ticket ${entry.id} · #${position} in line · ~${estWait} min wait`);
        if (adminToken) setView('teller');
        const nameInput = form.elements.namedItem('clientName') as HTMLInputElement | null;
        if (nameInput) nameInput.value = '';
      } else {
        const errData = await res.json().catch(() => ({ error: 'Check-in failed' }));
        showNotification(errData.error || 'Check-in failed. Please try again.', true);
      }
    } catch (err: any) {
      console.error('Check-in request error:', err);
      showNotification(err?.message ? `Check-in failed: ${err.message}` : 'Check-in failed. Please check your connection.', true);
    }
  };

  const callNext = async (id: string) => {
    if (!adminToken) {
      showNotification('Sign in required for teller actions.', true);
      return;
    }
    try {
      const res = await fetch('/api/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ id, calledTime: new Date().toISOString() })
      });
      if (res.ok) { playChime(); await fetchData(); }
      else showNotification(`Failed to call ${termCopy.singular}. Please try again.`, true);
    } catch {
      showNotification(`Failed to call ${termCopy.singular}. Check connection.`, true);
    }
  };

  const completeTransaction = async (id: string, notes: string, breachReason: string, resolutionCode: string) => {
    if (!adminToken) {
      showNotification('Sign in required for teller actions.', true);
      return;
    }
    if (!resolutionCode.trim()) {
      showNotification('Select a resolution code before completing the ticket.', true);
      return;
    }
    const ticket = queue.find((item) => item.id === id);
    if (ticket) {
      const firstResponseTime = ticket.firstCalledTime || ticket.calledTime;
      const slaTarget = ticket.slaTargetMinutes || SLA_THRESHOLD_MINUTES;
      if (firstResponseTime && ticket.checkInTime) {
        const responseMinutes = (new Date(firstResponseTime).getTime() - new Date(ticket.checkInTime).getTime()) / 60000;
        if (responseMinutes > slaTarget && !breachReason.trim()) {
          showNotification('Select a breach reason before completing an SLA-breached ticket.', true);
          return;
        }
      }
    }
    try {
      const res = await fetch('/api/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ id, completedTime: new Date().toISOString(), notes, breachReason, resolutionCode })
      });
      if (res.ok) {
        setCompletionNotes(prev => ({ ...prev, [id]: '' }));
        setCompletionBreachReasons(prev => ({ ...prev, [id]: '' }));
        setCompletionResolutionCodes(prev => ({ ...prev, [id]: '' }));
        setPauseReasons(prev => ({ ...prev, [id]: '' }));
        await fetchData();
      }
      else showNotification('Failed to complete transaction. Please try again.', true);
    } catch {
      showNotification('Failed to complete transaction. Check connection.', true);
    }
  };

  const markNoShow = async (id: string) => {
    if (!adminToken) {
      showNotification('Sign in required for teller actions.', true);
      return;
    }
    const noShowReason = noShowReasons[id] || '';
    if (!noShowReason.trim()) {
      showNotification('Select a no-show reason before closing the ticket.', true);
      return;
    }
    try {
      const res = await fetch('/api/noshow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ id, noShowReason })
      });
      if (res.ok) {
        setNoShowReasons(prev => ({ ...prev, [id]: '' }));
        await fetchData();
      }
      else showNotification('Failed to mark no-show. Please try again.', true);
    } catch {
      showNotification('Failed to mark no-show. Check connection.', true);
    }
  };

  const reassignClient = async (id: string, currentBranch: string, currentService: string) => {
    if (!adminToken) {
      showNotification('Sign in required for teller actions.', true);
      return;
    }
    const newBranch = reassignBranch[id] || currentBranch;
    const newService = reassignService[id] || currentService;

    try {
      const res = await fetch('/api/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ id, branch: newBranch, service: newService })
      });
      if (res.ok) {
        setNoShowReasons(prev => ({ ...prev, [id]: '' }));
        await fetchData();
        showNotification(`Ticket ${id} reassigned to ${newBranch} / ${newService} and moved to Priority queue.`);
      } else {
        const err = await res.json().catch(() => ({ error: `Failed to reassign ${termCopy.singular}.` }));
        showNotification(err.error || `Failed to reassign ${termCopy.singular}.`, true);
      }
    } catch {
      showNotification(`Failed to reassign ${termCopy.singular}. Check connection.`, true);
    }
  };

  const recallTicket = async (id: string) => {
    if (!adminToken) {
      showNotification('Sign in required for teller actions.', true);
      return;
    }
    try {
      const res = await fetch('/api/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        playChime();
        await fetchData();
        showNotification(`Ticket ${id} recalled.`);
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to recall ticket.' }));
        showNotification(err.error || 'Failed to recall ticket.', true);
      }
    } catch {
      showNotification('Failed to recall ticket. Check connection.', true);
    }
  };

  const holdTicket = async (id: string) => {
    if (!adminToken) {
      showNotification('Sign in required for teller actions.', true);
      return;
    }
    const pauseReason = pauseReasons[id] || '';
    if (!pauseReason.trim()) {
      showNotification('Select a hold reason before pausing the ticket.', true);
      return;
    }
    try {
      const res = await fetch('/api/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ id, pauseReason })
      });
      if (res.ok) {
        await fetchData();
        showNotification(`Ticket ${id} placed on hold.`);
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to hold ticket.' }));
        showNotification(err.error || 'Failed to hold ticket.', true);
      }
    } catch {
      showNotification('Failed to hold ticket. Check connection.', true);
    }
  };

  const resumeTicket = async (id: string) => {
    if (!adminToken) {
      showNotification('Sign in required for teller actions.', true);
      return;
    }
    try {
      const res = await fetch('/api/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        setPauseReasons(prev => ({ ...prev, [id]: '' }));
        await fetchData();
        showNotification(`Ticket ${id} resumed.`);
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to resume ticket.' }));
        showNotification(err.error || 'Failed to resume ticket.', true);
      }
    } catch {
      showNotification('Failed to resume ticket. Check connection.', true);
    }
  };

  const filteredQueue = useMemo(() => {
    return filterBranch === 'All' ? queue : queue.filter(q => q.branch === filterBranch);
  }, [queue, filterBranch]);

  const latestProcessingTicket = useMemo(() => {
    const processing = filteredQueue
      .filter(q => q.status === 'Processing')
      .sort((a, b) => (b.calledTime || '').localeCompare(a.calledTime || ''));
    return processing[0] || null;
  }, [filteredQueue]);

  const slaAlerts = useMemo(() => {
    const now = Date.now();
    return filteredQueue.filter((q) => {
      if (q.status !== 'Waiting') return false;
      const waitMin = (now - new Date(q.checkInTime).getTime()) / 60000;
      return waitMin >= SLA_THRESHOLD_MINUTES;
    });
  }, [filteredQueue, currentTime]);

  const kioskUrl = useMemo(() => {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('kiosk', '1');
    url.searchParams.set('tenant_id', tenantId);
    if (qrBranch) url.searchParams.set('branch', qrBranch);
    if (qrService) url.searchParams.set('service', qrService);
    return url.toString();
  }, [tenantId, qrBranch, qrService]);

  const kioskQrImageUrl = useMemo(() => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(kioskUrl)}`;
  }, [kioskUrl]);

  const analytics = useMemo(() => {
    let totalWait = 0, totalService = 0, waitCount = 0, serviceCount = 0;
    const serviceStats: Record<string, { total: number; count: number }> = {};
    services.forEach(s => serviceStats[s] = { total: 0, count: 0 });

    const filteredHistory = analyticsBranch === 'All'
      ? history
      : history.filter(h => h.branch === analyticsBranch);

    filteredHistory.forEach(h => {
      if (h.calledTime && h.checkInTime) {
        const wait = (new Date(h.calledTime).getTime() - new Date(h.checkInTime).getTime()) / 60000;
        if (!isNaN(wait) && wait >= 0) { totalWait += wait; waitCount++; }
      }
      if (h.completedTime && h.calledTime) {
        const service = (new Date(h.completedTime).getTime() - new Date(h.calledTime).getTime()) / 60000;
        if (!isNaN(service) && service >= 0) {
          totalService += service; serviceCount++;
          if (serviceStats[h.service]) {
            serviceStats[h.service].total += service;
            serviceStats[h.service].count += 1;
          }
        }
      }
    });

    return {
      awt: waitCount ? Math.round(totalWait / waitCount) : 0,
      tat: serviceCount ? Math.round(totalService / serviceCount) : 0,
      total: filteredHistory.length,
      tatPerService: services.map(s => ({
        name: s,
        avg: serviceStats[s].count ? Math.round(serviceStats[s].total / serviceStats[s].count) : 0,
        count: serviceStats[s].count
      }))
    };
  }, [history, analyticsBranch, services]);

  const displayRows = useMemo(() => {
    const processing = queue
      .filter(item => item.status === 'Processing')
      .sort((a, b) => (a.calledTime || '').localeCompare(b.calledTime || ''));

    return processing.map(item => ({
      item,
      waiting: queue.filter(q => q.status === 'Waiting' && q.branch === item.branch).length,
    }));
  }, [queue]);

  const adminSummary = useMemo(() => {
    const waiting = queue.filter(q => q.status === 'Waiting').length;
    const processing = queue.filter(q => q.status === 'Processing').length;
    const today = history.filter(h => h.completedTime && new Date(h.completedTime).toDateString() === new Date().toDateString()).length;
    return { waiting, processing, today };
  }, [queue, history]);

  const kpiSnapshot = useMemo(() => {
    const completedHistory = history.filter(h => h.outcome === 'completed' || h.status === 'Completed');
    const closedHistory = history.filter(h =>
      h.outcome === 'completed' || h.outcome === 'no_show' || h.status === 'Completed' || h.status === 'No Show'
    );
    const noShowCount = history.filter(h => h.outcome === 'no_show' || h.status === 'No Show').length;
    let firstResponseTotal = 0;
    let firstResponseCount = 0;
    let slaMetCount = 0;
    let reassignments = 0;
    const breachReasons = new Map<string, number>();

    completedHistory.forEach((item) => {
      const firstResponse = item.firstCalledTime || item.calledTime;
      const slaTarget = item.slaTargetMinutes || SLA_THRESHOLD_MINUTES;
      if (firstResponse && item.checkInTime) {
        const responseMinutes = (new Date(firstResponse).getTime() - new Date(item.checkInTime).getTime()) / 60000;
        if (!Number.isNaN(responseMinutes) && responseMinutes >= 0) {
          firstResponseTotal += responseMinutes;
          firstResponseCount += 1;
          if (responseMinutes <= slaTarget) slaMetCount += 1;
        }
      }
      reassignments += item.reassignCount || 0;
      if (item.breachReason) {
        breachReasons.set(item.breachReason, (breachReasons.get(item.breachReason) || 0) + 1);
      }
    });

    const topBreachReason = [...breachReasons.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

    return {
      firstResponseAvg: firstResponseCount ? Math.round(firstResponseTotal / firstResponseCount) : 0,
      slaMetRate: firstResponseCount ? Math.round((slaMetCount / firstResponseCount) * 100) : 0,
      noShowRate: closedHistory.length ? Math.round((noShowCount / closedHistory.length) * 100) : 0,
      reassignments,
      topBreachReason,
    };
  }, [history]);

  const setupChecklist = useMemo(() => {
    const profileDone = !!companyName.trim() && !!industry.trim() && !!contactEmail.trim() && !!contactPhone.trim();
    const operationsDone = branches.length > 0 && services.length > 0;
    const configDone = ipList.length > 0 && !!smtpHost.trim() && !!smtpTo.trim();
    return { profileDone, operationsDone, configDone };
  }, [companyName, industry, contactEmail, contactPhone, branches, services, ipList, smtpHost, smtpTo]);

  const setupCompletionCount = useMemo(() => {
    return [setupChecklist.profileDone, setupChecklist.operationsDone, setupChecklist.configDone].filter(Boolean).length;
  }, [setupChecklist]);

  const adminTabGroups = useMemo(() => {
    const groups: Array<{
      key: AdminParentKey;
      label: string;
      description: string;
      children: Array<{
        key: AdminArea;
        label: string;
        desc: string;
        badge: string;
      }>;
    }> = [
      {
        key: 'operations',
        label: 'Operations',
        description: 'Queue setup, network access, and check-in controls',
        children: [
          {
            key: 'overview',
            label: 'Overview',
            desc: 'Setup progress, live SLA pulse, and today health',
            badge: `${setupCompletionCount}/3 set`,
          },
          {
            key: 'access',
            label: 'Queue Access',
            desc: 'Whitelist branches and trusted network devices',
            badge: `${ipList.length} IP${ipList.length === 1 ? '' : 's'}`,
          },
          {
            key: 'catalog',
            label: 'Catalog',
            desc: 'Maintain branches, services, and customer language',
            badge: `${branches.length} branches`,
          },
          {
            key: 'kiosk',
            label: 'Kiosk QR',
            desc: 'Prepare touchless entry links by branch and service',
            badge: `${services.length} services`,
          },
        ],
      },
      {
        key: 'administration',
        label: 'Administration',
        description: 'Identity, integrations, and admin-only controls',
        children: [
          {
            key: 'profile',
            label: 'Profile',
            desc: 'Branding, contact details, and company identity',
            badge: companyName.trim() ? 'Ready' : 'Pending',
          },
          {
            key: 'integrations',
            label: 'Integrations',
            desc: 'Manage the Google API key and secure tooling access',
            badge: apiKey ? 'Key set' : 'No key',
          },
          ...(currentUserRole === 'super_admin'
            ? [
                {
                  key: 'seo' as AdminArea,
                  label: 'SEO & Support',
                  desc: 'Manage landing-page metadata and the shared support email',
                  badge: supportEmail ? 'Configured' : 'Pending',
                },
                {
                  key: 'users' as AdminArea,
                  label: 'Users',
                  desc: 'Update roles and maintain platform user access',
                  badge: `${adminUsers.length} users`,
                },
                {
                  key: 'tenants' as AdminArea,
                  label: 'Tenants',
                  desc: 'Review tenant plans, names, and workspace ownership',
                  badge: `${adminTenants.length} tenants`,
                },
              ]
            : []),
        ],
      },
      {
        key: 'insights',
        label: 'Insights & Billing',
        description: 'Exports, report delivery, and subscription actions',
        children: [
          {
            key: 'exports',
            label: 'Exports',
            desc: 'Download KPI and queue history with scoped filters',
            badge: exportFrom || exportTo || exportBranch !== 'All' ? 'Filtered' : 'All data',
          },
          {
            key: 'delivery',
            label: 'Email Reports',
            desc: 'Configure SMTP and schedule automated reporting',
            badge: smtpHost.trim() ? 'SMTP ready' : 'SMTP pending',
          },
          ...(currentUserRole === 'super_admin'
            ? [
                {
                  key: 'billing' as AdminArea,
                  label: 'Billing Config',
                  desc: 'Control payment rails, QR, and grace periods',
                  badge: `${billingSubmissions.length} pending`,
                },
              ]
            : [
                {
                  key: 'subscription' as AdminArea,
                  label: 'Subscription',
                  desc: 'Submit payment proof and review billing details',
                  badge: billingMe?.billing?.bankName ? 'Ready' : 'Pending',
                },
              ]),
        ],
      },
    ];

    return groups;
  }, [
    setupCompletionCount,
    ipList.length,
    branches.length,
    services.length,
    companyName,
    apiKey,
    supportEmail,
    currentUserRole,
    adminUsers.length,
    adminTenants.length,
    exportFrom,
    exportTo,
    exportBranch,
    smtpHost,
    billingSubmissions.length,
    billingMe,
  ]);

  const activeAdminGroup = adminTabGroups.find((group) => group.children.some((child) => child.key === adminArea)) ?? adminTabGroups[0];
  const activeAdminChild = activeAdminGroup.children.find((child) => child.key === adminArea) ?? activeAdminGroup.children[0];

  useEffect(() => {
    const isValid = adminTabGroups.some((group) => group.children.some((child) => child.key === adminArea));
    if (!isValid && adminTabGroups[0]) {
      setAdminArea(adminTabGroups[0].children[0].key);
    }
  }, [adminArea, adminTabGroups]);

  const selectAdminParent = (parentKey: AdminParentKey) => {
    const targetGroup = adminTabGroups.find((group) => group.key === parentKey);
    if (targetGroup) setAdminArea(targetGroup.children[0].key);
  };

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`;
  };

  const brandName = platformTextLogo || DEFAULT_PLATFORM_BRAND.textLogo;
  const brandTagLine = platformTagLine || DEFAULT_PLATFORM_BRAND.tagLine;
  const brandLogoPreview = platformLogoDataUrl || platformLogoUrl;
  const supportSubject = `${brandName} support or feature request`;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="px-8 h-20 flex justify-between items-center">
          <div className="flex flex-col">
            <button
              type="button"
              onClick={onGoToLanding}
              className="text-left group flex items-center gap-3"
              title="Back to home"
            >
              {platformLogoUrl && (
                <img src={platformLogoUrl} alt={`${brandName} logo`} className="w-11 h-11 rounded-xl object-cover border border-slate-200 bg-white" />
              )}
              <div className="flex flex-col">
                <h1 className="font-bold text-xl text-[#003366] leading-none tracking-tight group-hover:text-[#002244] transition-colors">
                  {brandName}
                </h1>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">{brandTagLine}</p>
              </div>
            </button>
          </div>

          <div className="hidden md:flex gap-10">
            <button type="button" onClick={() => setView('client')} className={cn("nav-link text-xs font-bold uppercase tracking-widest", view === 'client' ? "active" : "text-slate-400")}>
              {termCopy.title} Entry
            </button>
            <button type="button" onClick={() => setView('teller')} className={cn("nav-link text-xs font-bold uppercase tracking-widest", view === 'teller' ? "active" : "text-slate-400")}>
              Branch Console
            </button>
            <button type="button" onClick={() => setView('display')} className={cn("nav-link text-xs font-bold uppercase tracking-widest", view === 'display' ? "active" : "text-slate-400")}>
              Now Serving
            </button>
            <button type="button" onClick={() => setView('analytics')} className={cn("nav-link text-xs font-bold uppercase tracking-widest", view === 'analytics' ? "active" : "text-slate-400")}>
              Analytics Data
            </button>
            <button type="button" onClick={() => setView('admin')} className={cn("nav-link text-xs font-bold uppercase tracking-widest flex items-center gap-1.5", view === 'admin' ? "active" : "text-slate-400")}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Admin
              {adminToken && <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>}
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-[#003366]">
                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
              <p className="text-[9px] text-slate-400 font-medium">System Status: Optimal</p>
            </div>
            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v: boolean) => !v)}
              className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen
                ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
              }
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white px-6 py-4 flex flex-col gap-1">
            {([
              { key: 'client', label: `${termCopy.title} Entry` },
              { key: 'teller', label: 'Branch Console' },
              { key: 'display', label: 'Now Serving' },
              { key: 'analytics', label: 'Analytics Data' },
              { key: 'admin', label: 'Admin' },
            ] as const).map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => { setView(item.key); setMobileMenuOpen(false); }}
                className={cn(
                  "text-left px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors",
                  view === item.key ? "bg-[#003366] text-white" : "text-slate-500 hover:bg-slate-50"
                )}
              >
                {item.label}
                {item.key === 'admin' && adminToken && <span className="ml-2 inline-block w-1.5 h-1.5 bg-green-400 rounded-full align-middle"></span>}
              </button>
            ))}
          </div>
        )}
      </nav>

      <main className="flex-grow container mx-auto px-4 mt-8 max-w-7xl">
        <AnimatePresence mode="wait">

          {/* CUSTOMER ENTRY */}
          {view === 'client' && (
            <motion.section key="client" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div className="max-w-xl mx-auto white-card rounded-[2.5rem] p-10 md:p-14">
                <div className="text-center mb-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-100 rounded-full mb-4">
                    <span className="w-2 h-2 bg-amber-500 rounded-full live-indicator"></span>
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-tighter">Self-Service Kiosk</span>
                  </div>
                  <h2 className="text-3xl font-extrabold text-[#003366]">Get Your Ticket</h2>
                  <p className="text-slate-500 mt-2 text-sm">Welcome to {brandName}. Please check in below.</p>
                </div>

                <form onSubmit={handleCheckIn} className="space-y-5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">{termCopy.title} Full Name</label>
                    <input name="clientName" type="text" required placeholder="Juan Dela Cruz" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-400 outline-none transition-all" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Branch</label>
                      <select
                        name="clientBranch"
                        aria-label="Branch"
                        value={clientBranch}
                        onChange={(e) => setClientBranch(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none"
                      >
                        {branches.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">{termCopy.title} Type</label>
                      <select
                        name="clientPriority"
                        aria-label={`${termCopy.title} Type`}
                        value={clientPriority}
                        onChange={(e) => setClientPriority(e.target.value as 'Regular' | 'Priority')}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none"
                      >
                        <option value="Regular">Regular</option>
                        <option value="Priority">Priority</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Service Type</label>
                    <select
                      name="clientService"
                      aria-label="Service Type"
                      value={clientService}
                      onChange={(e) => setClientService(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none"
                    >
                      {services.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <button type="submit" className="w-full py-4 btn-primary rounded-xl font-bold text-sm uppercase tracking-widest mt-4 shadow-lg shadow-blue-900/20">
                    Confirm & Issue Ticket
                  </button>
                </form>
              </div>
            </motion.section>
          )}

          {/* BRANCH CONSOLE */}
          {view === 'teller' && (
            <Suspense fallback={<div className="white-card rounded-2xl p-6 text-xs font-bold uppercase tracking-widest text-slate-400">Loading teller queue…</div>}>
              <TellerPanel
                latestProcessingTicket={latestProcessingTicket}
                filterBranch={filterBranch}
                branches={branches}
                services={services}
                filteredQueue={filteredQueue}
                slaAlertsCount={slaAlerts.length}
                currentTime={currentTime}
                termTitle={termCopy.title}
                termPlural={termCopy.plural}
                completionNotes={completionNotes}
                completionBreachReasons={completionBreachReasons}
                completionResolutionCodes={completionResolutionCodes}
                noShowReasons={noShowReasons}
                pauseReasons={pauseReasons}
                reassignBranch={reassignBranch}
                reassignService={reassignService}
                formatDuration={formatDuration}
                onFilterBranchChange={setFilterBranch}
                onRecallLastCalled={recallTicket}
                onCallNext={callNext}
                onCompletionNotesChange={(id, value) => setCompletionNotes(prev => ({ ...prev, [id]: value }))}
                onCompletionBreachReasonChange={(id, value) => setCompletionBreachReasons(prev => ({ ...prev, [id]: value }))}
                onCompletionResolutionCodeChange={(id, value) => setCompletionResolutionCodes(prev => ({ ...prev, [id]: value }))}
                onNoShowReasonChange={(id, value) => setNoShowReasons(prev => ({ ...prev, [id]: value }))}
                onPauseReasonChange={(id, value) => setPauseReasons(prev => ({ ...prev, [id]: value }))}
                onCompleteTransaction={completeTransaction}
                onRecallTicket={recallTicket}
                onHoldTicket={holdTicket}
                onResumeTicket={resumeTicket}
                onMarkNoShow={markNoShow}
                onReassignBranchChange={(id, value) => setReassignBranch(prev => ({ ...prev, [id]: value }))}
                onReassignServiceChange={(id, value) => setReassignService(prev => ({ ...prev, [id]: value }))}
                onReassignClient={reassignClient}
              />
            </Suspense>
          )}

          {/* NOW SERVING DISPLAY */}
          {view === 'display' && (
            <motion.section key="display" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="white-card rounded-2xl p-6 md:p-8 bg-gradient-to-r from-[#003366] to-[#0a4a82] text-white">
                <p className="text-xs font-bold uppercase tracking-widest text-blue-100">Now Serving</p>
                <h2 className="text-3xl md:text-5xl font-black mt-2">Live Branch Display</h2>
                <p className="text-blue-100 mt-2 text-sm">Open with <span className="font-bold">?view=display</span> for TV mode.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {displayRows.map(({ item, waiting }) => (
                  <div key={item.id} className="white-card rounded-2xl p-6 border-l-4 border-amber-400">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.branch}</p>
                    <p className="text-4xl md:text-5xl font-black text-[#003366] mt-2">{item.id}</p>
                    <p className="text-lg font-bold text-slate-700 mt-1">{item.name}</p>
                    <p className="text-sm text-slate-500">{item.service}</p>
                    <div className="mt-5 flex items-center justify-between text-xs">
                      <span className="font-bold text-blue-600 uppercase">Processing</span>
                      <span className="font-bold text-slate-500">{waiting} waiting in this branch</span>
                    </div>
                  </div>
                ))}
              </div>

              {displayRows.length === 0 && (
                <div className="white-card rounded-2xl p-16 text-center">
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No ticket is currently being served</p>
                </div>
              )}
            </motion.section>
          )}

          {/* ANALYTICS */}
          {view === 'analytics' && (
            <Suspense fallback={<div className="white-card rounded-2xl p-6 text-xs font-bold uppercase tracking-widest text-slate-400">Loading analytics…</div>}>
              <AnalyticsPanel
                analytics={analytics}
                analyticsBranch={analyticsBranch}
                branches={branches}
                history={history}
                termTitle={termCopy.title}
                onAnalyticsBranchChange={setAnalyticsBranch}
              />
            </Suspense>
          )}

          {/* ADMIN PANEL */}
          {view === 'admin' && (
            <motion.section key="admin" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              {!adminToken ? (
                <div className="max-w-sm mx-auto white-card rounded-[2.5rem] p-10 md:p-14">
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-[#003366] rounded-2xl mb-4 mx-auto">
                      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-extrabold text-[#003366]">
                      {authView === 'login'
                        ? (loginRole === 'super_admin' ? 'Super Admin Access' : 'Tenant Admin Access')
                        : authView === 'forgot' ? 'Reset Password' : 'Set New Password'}
                    </h2>
                    <p className="text-slate-500 mt-2 text-sm">
                      {authView === 'login'
                        ? (loginRole === 'super_admin'
                            ? 'Restricted to super administrators only.'
                            : 'Restricted to tenant administrators only.')
                        : authView === 'forgot' ? 'Enter your email to receive a reset link.' : 'Choose a new password for your account.'}
                    </p>
                    {authView === 'login' && (
                      <p className="text-[10px] text-slate-400 mt-2">
                        {loginRole === 'super_admin'
                          ? <a href="/tenant-admin-login" className="underline hover:text-[#003366]">Go to Tenant Admin Login</a>
                          : <a href="/super-admin-login" className="underline hover:text-[#003366]">Go to Super Admin Login</a>}
                      </p>
                    )}
                  </div>

                  {/* LOGIN FORM */}
                  {authView === 'login' && (
                    <form onSubmit={adminLogin} className="space-y-5">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Email Address</label>
                        <input
                          type="email"
                          value={adminEmail}
                          onChange={e => setAdminEmail(e.target.value)}
                          placeholder="admin@ssb.local"
                          required
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Password</label>
                        <input
                          type="password"
                          value={adminPassword}
                          onChange={e => setAdminPassword(e.target.value)}
                          placeholder="Enter your password"
                          required
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                        />
                      </div>
                      {adminLoginError && (
                        <p className="text-red-500 text-xs font-bold bg-red-50 border border-red-100 rounded-lg px-3 py-2">{adminLoginError}</p>
                      )}
                      <button type="submit" className="w-full py-4 btn-primary rounded-xl font-bold text-sm uppercase tracking-widest shadow-lg shadow-blue-900/20">
                        Sign In
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAuthView('forgot'); setAdminLoginError(null); setForgotSent(false); setForgotEmail(''); }}
                        className="w-full text-center text-[11px] font-bold text-slate-400 hover:text-[#003366] transition-colors pt-1"
                      >
                        Forgot your password?
                      </button>
                    </form>
                  )}

                  {/* FORGOT PASSWORD FORM */}
                  {authView === 'forgot' && (
                    <div className="space-y-5">
                      {forgotSent ? (
                        <div className="text-center space-y-4">
                          <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mx-auto">
                            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <p className="text-sm font-bold text-slate-700">Check your email</p>
                          <p className="text-xs text-slate-500">If an account exists for <span className="font-bold text-[#003366]">{forgotEmail}</span>, a reset link has been sent. Check your inbox.</p>
                          <button
                            type="button"
                            onClick={() => { setAuthView('login'); setForgotSent(false); setForgotEmail(''); }}
                            className="w-full py-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors uppercase tracking-widest"
                          >
                            Back to Sign In
                          </button>
                        </div>
                      ) : (
                        <form onSubmit={handleForgotPassword} className="space-y-5">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Email Address</label>
                            <input
                              type="email"
                              value={forgotEmail}
                              onChange={e => setForgotEmail(e.target.value)}
                              placeholder="admin@ssb.local"
                              required
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                            />
                          </div>
                          <button type="submit" className="w-full py-4 btn-primary rounded-xl font-bold text-sm uppercase tracking-widest shadow-lg shadow-blue-900/20">
                            Send Reset Link
                          </button>
                          <button
                            type="button"
                            onClick={() => { setAuthView('login'); setAdminLoginError(null); }}
                            className="w-full text-center text-[11px] font-bold text-slate-400 hover:text-[#003366] transition-colors pt-1"
                          >
                            Back to Sign In
                          </button>
                        </form>
                      )}
                    </div>
                  )}

                  {/* RESET PASSWORD FORM */}
                  {authView === 'reset' && (
                    <div className="space-y-5">
                      {resetSuccess ? (
                        <div className="text-center space-y-4">
                          <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mx-auto">
                            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <p className="text-sm font-bold text-slate-700">Password updated!</p>
                          <p className="text-xs text-slate-500">Redirecting to sign in...</p>
                        </div>
                      ) : (
                        <form onSubmit={handleResetPassword} className="space-y-5">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">New Password</label>
                            <input
                              type="password"
                              value={resetNewPassword}
                              onChange={e => setResetNewPassword(e.target.value)}
                              placeholder="Minimum 8 characters"
                              required
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Confirm Password</label>
                            <input
                              type="password"
                              value={resetConfirm}
                              onChange={e => setResetConfirm(e.target.value)}
                              placeholder="Repeat new password"
                              required
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                            />
                          </div>
                          {adminLoginError && (
                            <p className="text-red-500 text-xs font-bold bg-red-50 border border-red-100 rounded-lg px-3 py-2">{adminLoginError}</p>
                          )}
                          <button type="submit" className="w-full py-4 btn-primary rounded-xl font-bold text-sm uppercase tracking-widest shadow-lg shadow-blue-900/20">
                            Set New Password
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Admin Panel — authenticated */
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <div>
                      <h2 className="text-2xl font-extrabold text-[#003366]">Admin Control Center</h2>
                      <p className="text-xs text-slate-400 font-medium">
                        Parent tabs and child tabs keep admin workflows grouped and easier to scan.
                        {currentUserRole === 'super_admin' && <span className="ml-2 text-amber-500 font-black">· Super Admin</span>}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={adminLogout}
                      className="flex items-center gap-2 text-xs font-bold text-red-500 border border-red-200 px-4 py-2 rounded-xl hover:bg-red-50 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign Out
                    </button>
                  </div>

                  <div className="grid grid-cols-2 xl:grid-cols-6 gap-4">
                    <div className="white-card rounded-2xl p-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Waiting</p>
                      <p className="text-2xl font-black text-[#003366]">{adminSummary.waiting}</p>
                    </div>
                    <div className="white-card rounded-2xl p-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Processing</p>
                      <p className="text-2xl font-black text-blue-600">{adminSummary.processing}</p>
                    </div>
                    <div className="white-card rounded-2xl p-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Completed Today</p>
                      <p className="text-2xl font-black text-green-600">{adminSummary.today}</p>
                    </div>
                    <div className="white-card rounded-2xl p-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Avg Wait</p>
                      <p className="text-2xl font-black text-amber-600">{analytics.awt}m</p>
                    </div>
                    <div className="white-card rounded-2xl p-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Avg Service</p>
                      <p className="text-2xl font-black text-violet-600">{analytics.tat}m</p>
                    </div>
                    <div className="white-card rounded-2xl p-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">SLA Risk</p>
                      <p className="text-2xl font-black text-red-600">{slaAlerts.length}</p>
                    </div>
                    <div className="white-card rounded-2xl p-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">SLA Met</p>
                      <p className="text-2xl font-black text-emerald-600">{kpiSnapshot.slaMetRate}%</p>
                    </div>
                    <div className="white-card rounded-2xl p-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">1st Response</p>
                      <p className="text-2xl font-black text-cyan-600">{kpiSnapshot.firstResponseAvg}m</p>
                    </div>
                  </div>

                  <div className="white-card rounded-[28px] border border-slate-200/80 p-4 md:p-5 space-y-4 shadow-sm shadow-slate-200/40">
                    <div className="flex flex-wrap gap-3">
                      {adminTabGroups.map((group) => {
                        const isActive = activeAdminGroup.key === group.key;
                        return (
                          <button
                            key={group.key}
                            type="button"
                            onClick={() => selectAdminParent(group.key)}
                            className={cn(
                              "rounded-2xl border px-5 py-3 text-left transition-all min-w-[11rem]",
                              isActive
                                ? "border-blue-200 bg-blue-50 text-[#2553d9] shadow-sm shadow-blue-100/70"
                                : "border-slate-200 bg-slate-50/80 text-slate-500 hover:border-slate-300 hover:bg-white hover:text-[#003366]"
                            )}
                          >
                            <p className="text-[11px] font-black uppercase tracking-[0.18em]">{group.label}</p>
                            <p className="mt-1 text-[11px] leading-relaxed text-inherit/70">{group.description}</p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="border-b border-slate-200 px-1">
                      <div className="flex flex-wrap items-end gap-2 md:gap-4">
                        {activeAdminGroup.children.map((child) => {
                          const isActive = adminArea === child.key;
                          return (
                            <button
                              key={child.key}
                              type="button"
                              onClick={() => setAdminArea(child.key)}
                              className={cn(
                                "px-4 py-3 text-sm font-bold transition-colors border-b-[3px]",
                                isActive
                                  ? "border-[#2553d9] text-[#2553d9]"
                                  : "border-transparent text-slate-400 hover:text-[#003366]"
                              )}
                            >
                              {child.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="px-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.28em]">{activeAdminGroup.label}</p>
                        <h3 className="mt-1 text-xl font-extrabold text-[#003366]">{activeAdminChild.label}</h3>
                        <p className="mt-1 text-sm text-slate-500 max-w-2xl">{activeAdminChild.desc}</p>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        {activeAdminChild.badge}
                      </span>
                    </div>
                  </div>

                  {adminArea === 'overview' && (
                    <Suspense fallback={<div className="white-card rounded-2xl p-6 text-xs font-bold uppercase tracking-widest text-slate-400">Loading overview…</div>}>
                      <AdminOverviewPanel
                        setupChecklist={setupChecklist}
                        currentUserRole={currentUserRole}
                        billingOverview={billingOverview}
                        billingSubmissions={billingSubmissions}
                        billingMe={billingMe}
                        billingReviewBusy={billingReviewBusy}
                        kpiSnapshot={kpiSnapshot}
                        onOpenOperations={() => setAdminArea('access')}
                        onRefreshBillingSubmissions={() => { void loadBillingSubmissions(); }}
                        onConfirmPaymentSubmission={confirmPaymentSubmission}
                        onRejectPaymentSubmission={rejectPaymentSubmission}
                      />
                    </Suspense>
                  )}

                  {(adminArea === 'access' || adminArea === 'catalog' || adminArea === 'kiosk') && (
                    <div className="grid grid-cols-1 gap-6">
                      <Suspense fallback={<div className="white-card rounded-2xl p-6 text-xs font-bold uppercase tracking-widest text-slate-400">Loading operations…</div>}>
                        <AdminOperationsPanel
                          activeSection={adminArea as 'access' | 'catalog' | 'kiosk'}
                          ipList={ipList}
                          confirmRemoveIP={confirmRemoveIP}
                          newIP={newIP}
                          newIPLabel={newIPLabel}
                          branches={branches}
                          services={services}
                          tenantPlan={tenantPlan}
                          planLimits={planLimits}
                          customerTerm={customerTerm}
                          catalogBranchesText={catalogBranchesText}
                          catalogServicesText={catalogServicesText}
                          catalogSaving={catalogSaving}
                          qrBranch={qrBranch}
                          qrService={qrService}
                          kioskUrl={kioskUrl}
                          kioskQrImageUrl={kioskQrImageUrl}
                          onAddIP={addIP}
                          onRemoveIP={removeIP}
                          onDetectMyIP={detectMyIP}
                          onSetConfirmRemoveIP={setConfirmRemoveIP}
                          onSetNewIP={setNewIP}
                          onSetNewIPLabel={setNewIPLabel}
                          onSaveCatalog={saveCatalog}
                          onSetCustomerTerm={setCustomerTerm}
                          onSetCatalogBranchesText={setCatalogBranchesText}
                          onSetCatalogServicesText={setCatalogServicesText}
                          onSetQrBranch={setQrBranch}
                          onSetQrService={setQrService}
                          onCopyKioskUrl={async () => {
                            try {
                              await navigator.clipboard.writeText(kioskUrl);
                              showNotification('Kiosk URL copied.');
                            } catch {
                              showNotification('Failed to copy kiosk URL.', true);
                            }
                          }}
                        />
                      </Suspense>
                    </div>
                  )}

                  {(adminArea === 'exports' || adminArea === 'delivery') && (
                    <div className="grid grid-cols-1 gap-6">
                      <Suspense fallback={<div className="white-card rounded-2xl p-6 text-xs font-bold uppercase tracking-widest text-slate-400">Loading reports…</div>}>
                        <AdminReportsPanel
                          activeSection={adminArea as 'exports' | 'delivery'}
                          exportBranch={exportBranch}
                          exportFrom={exportFrom}
                          exportTo={exportTo}
                          branches={branches}
                          smtpHost={smtpHost}
                          smtpPort={smtpPort}
                          smtpSecure={smtpSecure}
                          smtpUser={smtpUser}
                          smtpPass={smtpPass}
                          smtpFrom={smtpFrom}
                          smtpTo={smtpTo}
                          smtpSaving={smtpSaving}
                          reportPeriod={reportPeriod}
                          sendingReport={sendingReport}
                          onSetExportBranch={setExportBranch}
                          onSetExportFrom={setExportFrom}
                          onSetExportTo={setExportTo}
                          onDownloadAdminCSV={downloadAdminCSV}
                          onDownloadPDF={downloadPDF}
                          onClearFilters={() => { setExportFrom(''); setExportTo(''); setExportBranch('All'); }}
                          onSaveSmtp={saveSmtp}
                          onSetSmtpHost={setSmtpHost}
                          onSetSmtpPort={setSmtpPort}
                          onSetSmtpSecure={setSmtpSecure}
                          onSetSmtpUser={setSmtpUser}
                          onSetSmtpPass={setSmtpPass}
                          onSetSmtpFrom={setSmtpFrom}
                          onSetSmtpTo={setSmtpTo}
                          onSetReportPeriod={setReportPeriod}
                          onSendTestReport={sendTestReport}
                        />
                      </Suspense>
                    </div>
                  )}

                  {(adminArea === 'profile' || adminArea === 'integrations' || adminArea === 'subscription' || adminArea === 'seo') && (
                    <div className="grid grid-cols-1 gap-6">
                      <Suspense fallback={<div className="white-card rounded-2xl p-6 text-xs font-bold uppercase tracking-widest text-slate-400">Loading settings…</div>}>
                        <AdminSettingsPanel
                          activeSection={adminArea as 'profile' | 'integrations' | 'subscription' | 'seo'}
                          currentUserRole={currentUserRole}
                          companyName={companyName}
                          industry={industry}
                          contactEmail={contactEmail}
                          contactPhone={contactPhone}
                          companyLogoUrl={companyLogoUrl}
                          logoUploading={logoUploading}
                          profileSaving={profileSaving}
                          apiKey={apiKey}
                          apiKeyInput={apiKeyInput}
                          showApiKey={showApiKey}
                          billingMe={billingMe}
                          paymentPlan={paymentPlan}
                          paymentMonths={paymentMonths}
                          paymentReference={paymentReference}
                          paymentNotes={paymentNotes}
                          paymentProofDataUrl={paymentProofDataUrl}
                          paymentSubmitting={paymentSubmitting}
                          siteSeoTitle={siteSeoTitle}
                          siteSeoDescription={siteSeoDescription}
                          siteSeoKeywords={siteSeoKeywords}
                          supportEmail={supportEmail}
                          platformTextLogo={platformTextLogo}
                          platformTagLine={platformTagLine}
                          platformLogoPreview={brandLogoPreview}
                          siteSettingsSaving={siteSettingsSaving}
                          onSaveProfile={saveProfile}
                          onUploadCompanyLogo={uploadCompanyLogo}
                          onSetCompanyName={setCompanyName}
                          onSetIndustry={setIndustry}
                          onSetContactEmail={setContactEmail}
                          onSetContactPhone={setContactPhone}
                          onRemoveApiKey={removeApiKey}
                          onSaveApiKey={saveApiKey}
                          onSetApiKeyInput={setApiKeyInput}
                          onSetShowApiKey={setShowApiKey}
                          onSubmitPaymentProof={submitPaymentProof}
                          onSetPaymentPlan={setPaymentPlan}
                          onSetPaymentMonths={setPaymentMonths}
                          onSetPaymentReference={setPaymentReference}
                          onSetPaymentNotes={setPaymentNotes}
                          onSetPaymentProofDataUrl={setPaymentProofDataUrl}
                          onSaveSiteSettings={saveSiteSettings}
                          onSetSiteSeoTitle={setSiteSeoTitle}
                          onSetSiteSeoDescription={setSiteSeoDescription}
                          onSetSiteSeoKeywords={setSiteSeoKeywords}
                          onSetSupportEmail={setSupportEmail}
                          onSetPlatformTextLogo={setPlatformTextLogo}
                          onSetPlatformTagLine={setPlatformTagLine}
                          onUploadPlatformLogo={handlePlatformLogoSelection}
                        />
                      </Suspense>
                    </div>
                  )}

                  {(adminArea === 'billing' || adminArea === 'users' || adminArea === 'tenants') && currentUserRole === 'super_admin' && (
                    <div className="grid grid-cols-1 gap-6">
                      <Suspense fallback={<div className="white-card rounded-2xl p-6 text-xs font-bold uppercase tracking-widest text-slate-400">Loading platform tools…</div>}>
                        <AdminPlatformPanel
                          activeSection={adminArea as 'billing' | 'users' | 'tenants'}
                          billingSettings={billingSettings}
                          billingQrDataUrl={billingQrDataUrl}
                          billingSettingsSaving={billingSettingsSaving}
                          adminUsers={adminUsers}
                          adminTenants={adminTenants}
                          editTenantName={editTenantName}
                          editTenantPlan={editTenantPlan}
                          confirmDeleteUser={confirmDeleteUser}
                          confirmDeleteTenant={confirmDeleteTenant}
                          onSaveBillingSettings={saveBillingSettings}
                          onSetBillingSettings={setBillingSettings}
                          onSetBillingQrDataUrl={setBillingQrDataUrl}
                          onRefreshUsers={() => loadAdminUsers()}
                          onRefreshTenants={() => loadAdminTenants()}
                          onUpdateUserRole={updateUserRole}
                          onDeleteUser={deleteUser}
                          onSetConfirmDeleteUser={setConfirmDeleteUser}
                          onSetEditTenantName={setEditTenantName}
                          onUpdateTenantName={updateTenantName}
                          onSetEditTenantPlan={setEditTenantPlan}
                          onUpdateTenantPlan={updateTenantPlan}
                          onDeleteTenant={deleteTenant}
                          onSetConfirmDeleteTenant={setConfirmDeleteTenant}
                        />
                      </Suspense>
                    </div>
                  )}

              </div>
            )}
            </motion.section>
          )}

        </AnimatePresence>
      </main>

      {view === 'admin' && supportEmail && (
        <a
          href={`mailto:${supportEmail}?subject=${encodeURIComponent(supportSubject)}`}
          className="fixed bottom-8 left-8 z-[90] inline-flex items-center gap-3 rounded-full bg-[#003366] px-5 py-3 text-white shadow-2xl shadow-blue-900/20 transition-all hover:-translate-y-0.5 hover:bg-[#002244]"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4v-4z" />
            </svg>
          </span>
          <span className="text-left">
            <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-blue-100">Support</span>
            <span className="block text-sm font-bold">Contact Super Admin</span>
          </span>
        </a>
      )}

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className={cn(
              "fixed bottom-10 right-10 text-white px-6 py-4 rounded-2xl shadow-2xl z-[100]",
              notification.isError ? "bg-red-600" : "bg-[#003366]"
            )}
          >
            <p className="font-bold text-xs uppercase tracking-widest">{notification.msg}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="mt-12 py-8 text-center bg-white border-t border-slate-100">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-3">
            {platformLogoUrl && (
              <img src={platformLogoUrl} alt={`${brandName} logo`} className="w-10 h-10 rounded-xl object-cover border border-slate-200 bg-white" />
            )}
            <div>
              <p className="text-sm font-bold text-[#003366] tracking-tight">{brandName}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em]">{brandTagLine}</p>
            </div>
          </div>
          <div className="flex justify-center gap-6 mt-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <span className="hover:text-blue-900 cursor-pointer">Security Policy</span>
            <span className="hover:text-blue-900 cursor-pointer">Branch Network</span>
            <span className="hover:text-blue-900 cursor-pointer">Support Hub</span>
          </div>
          <p className="text-[10px] text-slate-300 mt-6">© 2026 {brandName}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
