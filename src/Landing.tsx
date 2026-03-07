import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './utils';

interface Props {
  onEnterApp: (token?: string) => void;
}

interface SiteConfig {
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  supportEmail: string;
}

const DEFAULT_SITE_CONFIG: SiteConfig = {
  seoTitle: 'Smart Queue | Enterprise Queue & Analytics',
  seoDescription: 'Real-time queue management, SLA tracking, KPI dashboards, and branch analytics for banks, cooperatives, and service teams.',
  seoKeywords: 'queue management software, SLA tracking SaaS, KPI dashboard, branch analytics, banking queue system',
  supportEmail: '',
};

function upsertHeadMeta(attribute: 'name' | 'property', key: string, content: string) {
  let node = document.head.querySelector(`meta[${attribute}="${key}"]`) as HTMLMetaElement | null;
  if (!node) {
    node = document.createElement('meta');
    node.setAttribute(attribute, key);
    document.head.appendChild(node);
  }
  node.setAttribute('content', content);
}

function applySiteMetadata(siteConfig: SiteConfig) {
  document.title = siteConfig.seoTitle || DEFAULT_SITE_CONFIG.seoTitle;
  upsertHeadMeta('name', 'description', siteConfig.seoDescription || DEFAULT_SITE_CONFIG.seoDescription);
  upsertHeadMeta('name', 'keywords', siteConfig.seoKeywords || DEFAULT_SITE_CONFIG.seoKeywords);
  upsertHeadMeta('property', 'og:title', siteConfig.seoTitle || DEFAULT_SITE_CONFIG.seoTitle);
  upsertHeadMeta('property', 'og:description', siteConfig.seoDescription || DEFAULT_SITE_CONFIG.seoDescription);
  upsertHeadMeta('name', 'twitter:title', siteConfig.seoTitle || DEFAULT_SITE_CONFIG.seoTitle);
  upsertHeadMeta('name', 'twitter:description', siteConfig.seoDescription || DEFAULT_SITE_CONFIG.seoDescription);
  upsertHeadMeta('property', 'og:url', window.location.origin + '/');
  let canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = window.location.origin + '/';
}

const FEATURES = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: 'Real-Time Queue',
    desc: 'Live WebSocket updates across all branch terminals. No page refresh needed — status changes appear instantly.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3M9 7h6M9 11h6M9 15h4" />
      </svg>
    ),
    title: 'Multi-Branch Network',
    desc: 'Manage up to 9 branches from a single dashboard. Filter, monitor, and report per branch or across all.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Performance Analytics',
    desc: 'Average wait time, service TAT per transaction type, and historical logs. Export to CSV with one click.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Email Reports',
    desc: 'Scheduled daily and monthly PDF + CSV reports sent via your own SMTP. No third-party email service needed.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: 'IP-Based Security',
    desc: 'Whitelist specific branch IP addresses to restrict queue submissions. Admin sessions with rate limiting built in.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
    title: 'Priority Queue',
    desc: 'Dedicated priority lane for Senior Citizens, PWDs, and premium customers. Clearly flagged in teller view.',
  },
];

const STEPS = [
  {
    number: '01',
    title: 'Customer Self-Service',
    desc: 'Customers check in at the kiosk — enter their name, select their branch, transaction type, and priority status.',
  },
  {
    number: '02',
    title: 'Teller Console',
    desc: 'Branch tellers see the live queue, call the next customer, and mark transactions complete. All updates are instant.',
  },
  {
    number: '03',
    title: 'Analytics & Reports',
    desc: 'Managers view average wait times, TAT per service type, and export historical data as CSV or PDF at any time.',
  },
];

const CLIENT_LOGOS = [
  { name: 'Cebu MPC', abbr: 'CM', bg: 'bg-[#003366]' },
  { name: 'Metro Savings', abbr: 'MS', bg: 'bg-[#1a6b3c]' },
  { name: 'UniFirst Credit', abbr: 'UC', bg: 'bg-[#7b2d8b]' },
  { name: 'Davao Coop Bank', abbr: 'DC', bg: 'bg-red-700' },
  { name: 'Iloilo MPC', abbr: 'IM', bg: 'bg-teal-700' },
  { name: 'Laguna FCB', abbr: 'LF', bg: 'bg-blue-800' },
  { name: 'Visayas Savings', abbr: 'VS', bg: 'bg-amber-900' },
  { name: 'Batangas COOP', abbr: 'BC', bg: 'bg-emerald-900' },
  { name: 'Pangasinan MPC', abbr: 'PM', bg: 'bg-blue-700' },
  { name: 'Pampanga FCB', abbr: 'PF', bg: 'bg-pink-800' },
];

interface PublicLogo {
  name: string;
  abbr: string;
  logoUrl?: string;
  bg?: string;
}

const TESTIMONIALS = [
  {
    quote: "Our average wait time dropped from 22 minutes to under 8 minutes in the first week. The tellers love the live queue view — they can see every branch at a glance.",
    name: "Ma. Theresa R.",
    title: "Branch Manager",
    org: "Metro Savings Cooperative",
    initials: "MT",
  },
  {
    quote: "Setup took less than 10 minutes. We deployed across two branches the same day. The automated PDF reports every morning save our ops team an hour of manual work.",
    name: "Jun Carlo B.",
    title: "Operations Head",
    org: "Cebu MPC",
    initials: "JC",
  },
  {
    quote: "Priority queuing for senior citizens was the feature that convinced our compliance team. It's simple, it works, and clients actually notice the difference.",
    name: "Marivic L.",
    title: "Admin Manager",
    org: "Iloilo MPC",
    initials: "ML",
  },
];

const FAQ_ITEMS = [
  {
    q: "Is it really free? What's the catch?",
    a: "The Free plan is genuinely free forever — one branch, real-time queue management, analytics, and CSV export. No credit card required. Upgrade to Starter or Pro only when your needs grow.",
  },
  {
    q: "Do we need to install anything on our computers?",
    a: "Nothing to install. Smart Queue runs entirely in the browser — any device, any OS. Your customer kiosk can be a cheap Android tablet, and the teller console works on any desktop browser.",
  },
  {
    q: "How does IP whitelisting protect our kiosk?",
    a: "You add your branch IP addresses in the admin panel. Only those IPs can submit tickets to the queue — preventing customers from checking in remotely or from outside the branch premises.",
  },
  {
    q: "Can we use our own email server for automated reports?",
    a: "Yes. Enter your SMTP credentials in the admin panel (works with Gmail, Outlook, or any SMTP provider) and all automated reports go out through your own email address — no third-party service needed.",
  },
  {
    q: "How long is our data kept?",
    a: "Transaction history is retained as long as your account is active. On the Free plan you get standard retention. Starter and Pro plans include longer retention windows. You can export all data as CSV or PDF at any time.",
  },
];

const PLANS = [
  {
    name: 'Free',
    price: '₱0',
    period: 'forever',
    highlight: false,
    description: 'Perfect for a single-branch pilot or evaluation.',
    features: [
      '1 branch',
      'Real-time queue management',
      'Basic analytics',
      'Manual CSV export',
      'IP whitelist (1 IP)',
      'Community support',
    ],
    cta: 'Get Started Free',
    ctaStyle: 'border border-[#003366] text-[#003366] hover:bg-[#003366] hover:text-white',
  },
  {
    name: 'Starter',
    price: '₱999',
    period: 'per month',
    highlight: true,
    description: 'Ideal for growing branch networks up to 9 locations.',
    features: [
      'Up to 9 branches',
      'Everything in Free',
      'Email reports (PDF + CSV)',
      'Scheduled daily/monthly reports',
      'Full analytics dashboard',
      'Unlimited IP whitelist',
      'Priority email support',
    ],
    cta: 'Start Starter Plan',
    ctaStyle: 'bg-[#003366] text-white hover:bg-[#002244]',
  },
  {
    name: 'Pro',
    price: '₱2,499',
    period: 'per month',
    highlight: false,
    description: 'Enterprise-grade for multi-tenant deployments.',
    features: [
      'Unlimited branches',
      'Everything in Starter',
      'Multi-tenant management',
      'Custom branding per tenant',
      'Auto-invoice generation',
      'Longer data retention',
      'Dedicated account support',
    ],
    cta: 'Contact Sales',
    ctaStyle: 'border border-[#003366] text-[#003366] hover:bg-[#003366] hover:text-white',
  },
];

export default function Landing({ onEnterApp }: Props) {
  // Main auth modal
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'signin' | 'register'>('signin');
  const [authView, setAuthView] = useState<'login' | 'forgot' | 'reset'>('login');

  // Sign-in form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register form
  const [regName, setRegName] = useState('');
  const [regOrg, setRegOrg] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState(false);

  // Forgot / reset
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  // Super Admin modal (separate)
  const [showSuperAdmin, setShowSuperAdmin] = useState(false);
  const [saEmail, setSaEmail] = useState('');
  const [saPassword, setSaPassword] = useState('');
  const [saError, setSaError] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [publicLogos, setPublicLogos] = useState<PublicLogo[]>([]);

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [liveStats, setLiveStats] = useState<{ totalTransactions: number; totalTenants: number; avgWaitMinutes: number | null } | null>(null);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(DEFAULT_SITE_CONFIG);

  // Fetch public live stats for hero section
  useEffect(() => {
    fetch('/api/stats/public')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setLiveStats(d); })
      .catch(() => {});
  }, []);

  // Detect reset token in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rt = params.get('reset_token');
    if (rt) {
      setResetToken(rt);
      setAuthView('reset');
      setShowModal(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    fetch('/api/logos/public')
      .then(async (res) => (res.ok ? res.json() : []))
      .then((rows: PublicLogo[]) => {
        if (Array.isArray(rows) && rows.length > 0) setPublicLogos(rows);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/public/site-config')
      .then(async (res) => (res.ok ? res.json() : DEFAULT_SITE_CONFIG))
      .then((data: Partial<SiteConfig>) => {
        setSiteConfig({
          seoTitle: data.seoTitle || DEFAULT_SITE_CONFIG.seoTitle,
          seoDescription: data.seoDescription || DEFAULT_SITE_CONFIG.seoDescription,
          seoKeywords: data.seoKeywords || DEFAULT_SITE_CONFIG.seoKeywords,
          supportEmail: data.supportEmail || DEFAULT_SITE_CONFIG.supportEmail,
        });
      })
      .catch(() => setSiteConfig(DEFAULT_SITE_CONFIG));
  }, []);

  useEffect(() => {
    applySiteMetadata(siteConfig);
  }, [siteConfig]);

  // Scroll lock when any modal is open
  useEffect(() => {
    document.body.style.overflow = (showModal || showSuperAdmin) ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showModal, showSuperAdmin]);

  const openModal = (tab: 'signin' | 'register' = 'signin') => {
    setActiveTab(tab);
    setAuthView('login');
    setLoginError(null);
    setRegError(null);
    setRegSuccess(false);
    setEmail('');
    setPassword('');
    setShowModal(true);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await fetch('/api/admin/login/tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const { token } = await res.json();
        localStorage.setItem('adminToken', token);
        setShowModal(false);
        onEnterApp();
      } else {
        const err = await res.json().catch(() => ({}));
        setLoginError(err.error || 'Invalid email or password.');
      }
    } catch {
      setLoginError('Login failed. Please check your connection.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    if (regPassword !== regConfirm) { setRegError('Passwords do not match.'); return; }
    if (regPassword.length < 8) { setRegError('Password must be at least 8 characters.'); return; }
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: regName, organization: regOrg, email: regEmail, password: regPassword }),
      });
      if (res.ok) {
        const { token } = await res.json();
        localStorage.setItem('adminToken', token);
        setShowModal(false);
        onEnterApp();
      } else {
        const err = await res.json().catch(() => ({}));
        setRegError(err.error || 'Registration failed. Please try again.');
      }
    } catch {
      setRegError('Registration failed. Please check your connection.');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
    } catch { /* silent */ }
    setForgotSent(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (resetNewPassword !== resetConfirm) { setLoginError('Passwords do not match.'); return; }
    if (resetNewPassword.length < 8) { setLoginError('Password must be at least 8 characters.'); return; }
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, password: resetNewPassword }),
      });
      if (res.ok) {
        setResetSuccess(true);
        setTimeout(() => {
          setResetSuccess(false);
          setAuthView('login');
          setResetNewPassword('');
          setResetConfirm('');
          setResetToken('');
        }, 3000);
      } else {
        const err = await res.json().catch(() => ({}));
        setLoginError(err.error || 'Reset failed. The link may have expired.');
      }
    } catch {
      setLoginError('Reset failed. Please check your connection.');
    }
  };

  const handleSuperAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaError(null);
    try {
      const res = await fetch('/api/admin/login/super', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: saEmail, password: saPassword }),
      });
      if (res.ok) {
        const { token } = await res.json();
        localStorage.setItem('adminToken', token);
        setShowSuperAdmin(false);
        onEnterApp();
      } else {
        const err = await res.json().catch(() => ({}));
        setSaError(err.error || 'Invalid credentials.');
      }
    } catch {
      setSaError('Login failed. Please check your connection.');
    }
  };

  const handleStartDemo = async () => {
    setDemoLoading(true);
    try {
      const res = await fetch('/api/demo/start', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to start demo.');
      const { token } = await res.json();
      if (!token) throw new Error('Demo token missing.');
      localStorage.setItem('adminToken', token);
      onEnterApp(token);
    } catch (err: any) {
      setLoginError(err?.message || 'Unable to launch demo.');
      setActiveTab('signin');
      setAuthView('login');
      setShowModal(true);
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 overflow-x-hidden">

      {/* ===== NAVBAR ===== */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex flex-col leading-none">
            <span className="font-black text-lg text-[#003366] uppercase tracking-tight">
              Smart <span className="text-amber-500">Queue</span>
            </span>
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em]">Queue Intelligence Platform</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-xs font-bold text-slate-500 hover:text-[#003366] uppercase tracking-widest transition-colors">Features</a>
            <a href="#testimonials" className="text-xs font-bold text-slate-500 hover:text-[#003366] uppercase tracking-widest transition-colors">Reviews</a>
            <a href="#pricing" className="text-xs font-bold text-slate-500 hover:text-[#003366] uppercase tracking-widest transition-colors">Pricing</a>
            <a href="#faq" className="text-xs font-bold text-slate-500 hover:text-[#003366] uppercase tracking-widest transition-colors">FAQ</a>
          </div>

          {/* CTA Buttons — top right */}
          <div className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={() => openModal('signin')}
              className="text-xs font-bold text-[#003366] border border-[#003366]/30 px-4 py-2 rounded-lg hover:bg-[#003366]/5 transition-colors uppercase tracking-widest"
            >
              Sign In / Register
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = '/tenant-admin-login'; }}
              className="text-xs font-bold bg-[#003366] text-white px-4 py-2 rounded-lg hover:bg-[#002244] transition-colors uppercase tracking-widest shadow-md"
            >
              Tenant Admin
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileNavOpen(v => !v)}
            className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-50"
          >
            {mobileNavOpen
              ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
            }
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileNavOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white px-6 py-4 flex flex-col gap-3">
            <a href="#features" onClick={() => setMobileNavOpen(false)} className="text-xs font-bold text-slate-500 uppercase tracking-widest py-2">Features</a>
            <a href="#how-it-works" onClick={() => setMobileNavOpen(false)} className="text-xs font-bold text-slate-500 uppercase tracking-widest py-2">How It Works</a>
            <a href="#testimonials" onClick={() => setMobileNavOpen(false)} className="text-xs font-bold text-slate-500 uppercase tracking-widest py-2">Reviews</a>
            <a href="#pricing" onClick={() => setMobileNavOpen(false)} className="text-xs font-bold text-slate-500 uppercase tracking-widest py-2">Pricing</a>
            <a href="#faq" onClick={() => setMobileNavOpen(false)} className="text-xs font-bold text-slate-500 uppercase tracking-widest py-2">FAQ</a>
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => { setMobileNavOpen(false); openModal('signin'); }} className="w-full py-3 text-xs font-bold text-[#003366] border border-[#003366]/30 rounded-lg uppercase tracking-widest">Sign In / Register</button>
              <button type="button" onClick={() => { setMobileNavOpen(false); window.location.href = '/tenant-admin-login'; }} className="w-full py-3 text-xs font-bold bg-[#003366] text-white rounded-lg uppercase tracking-widest">Tenant Admin</button>
            </div>
          </div>
        )}
      </nav>

      {/* ===== HERO ===== */}
      <section className="relative bg-gradient-to-br from-[#001a33] via-[#003366] to-[#004080] text-white overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-400 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-blue-300 rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-6xl mx-auto px-6 py-24 md:py-32 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-8">
              <span className="w-2 h-2 bg-amber-400 rounded-full live-indicator"></span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300">Queue Management Platform</span>
            </div>

            <h1 className="text-4xl md:text-6xl font-black leading-tight mb-6 max-w-4xl mx-auto">
              Smart Queue Management<br />
              <span className="text-amber-400">for Modern Branches</span>
            </h1>

            <p className="text-blue-200 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
              Real-time queue tracking, multi-branch analytics, and automated email reports — built for savings banks and cooperatives that want professional service without enterprise complexity.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <button
                type="button"
                onClick={() => openModal('register')}
                className="px-8 py-4 bg-amber-400 hover:bg-amber-300 text-[#003366] font-black rounded-xl text-sm uppercase tracking-widest transition-all shadow-lg shadow-amber-400/30 hover:shadow-amber-400/50 hover:-translate-y-0.5"
              >
                Get Started Free
              </button>
              <button
                type="button"
                onClick={handleStartDemo}
                className="px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/30 text-white font-bold rounded-xl text-sm uppercase tracking-widest transition-all backdrop-blur"
              >
                {demoLoading ? 'Launching Demo…' : 'Live Demo'}
              </button>
            </div>

            {/* Stats row — live data from DB, fallback to benchmarks */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-2xl mx-auto">
              {[
                {
                  value: liveStats && liveStats.totalTransactions > 0
                    ? `${liveStats.totalTransactions.toLocaleString()}+`
                    : '5,000+',
                  label: 'Transactions Served',
                },
                {
                  value: liveStats && liveStats.totalTenants > 0
                    ? `${liveStats.totalTenants}`
                    : '10+',
                  label: 'Active Organizations',
                },
                {
                  value: liveStats?.avgWaitMinutes != null
                    ? `${liveStats.avgWaitMinutes}m`
                    : '< 8m',
                  label: 'Avg. Wait Time',
                },
                { value: 'Free', label: 'Core Features' },
              ].map(stat => (
                <div key={stat.label} className="text-center">
                  <p className="text-2xl font-black text-amber-400">{stat.value}</p>
                  <p className="text-[10px] font-bold text-blue-300 uppercase tracking-wider mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== CLIENT LOGO TICKER ===== */}
      <section id="clients" className="py-10 bg-white border-y border-slate-100 overflow-hidden">
        <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-8">
          Trusted by cooperatives &amp; savings banks across the Philippines
        </p>
        <div className="relative overflow-hidden">
          {/* Fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
          {/* Ticker */}
          <div className="sq-ticker flex items-center gap-10">
            {[...(publicLogos.length ? publicLogos : CLIENT_LOGOS), ...(publicLogos.length ? publicLogos : CLIENT_LOGOS)].map((logo, i) => (
              <div key={i} className="flex items-center gap-3 shrink-0 px-4 py-2">
                {logo.logoUrl ? (
                  <img src={logo.logoUrl} alt={`${logo.name} logo`} className="w-9 h-9 rounded-xl object-cover border border-slate-200 bg-white shadow-sm" />
                ) : (
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-sm ${logo.bg || 'bg-[#003366]'}`}>
                    {logo.abbr}
                  </div>
                )}
                <span className="font-black text-slate-600 text-sm whitespace-nowrap tracking-tight">{logo.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="features" className="py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em] mb-3">Platform Features</p>
            <h2 className="text-3xl md:text-4xl font-black text-[#003366]">Everything your branches need</h2>
            <p className="text-slate-500 mt-4 max-w-xl mx-auto text-sm leading-relaxed">
              Built specifically for savings banks and financial cooperatives. No bloat, no unnecessary integrations — just the tools your staff uses every day.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4 }}
                className="bg-white border border-slate-100 rounded-2xl p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <div className="inline-flex items-center justify-center w-11 h-11 bg-[#003366]/10 text-[#003366] rounded-xl mb-4">
                  {f.icon}
                </div>
                <h3 className="font-black text-[#003366] text-sm mb-2">{f.title}</h3>
                <p className="text-slate-500 text-xs leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section id="how-it-works" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em] mb-3">Workflow</p>
            <h2 className="text-3xl md:text-4xl font-black text-[#003366]">How it works</h2>
            <p className="text-slate-500 mt-4 max-w-xl mx-auto text-sm leading-relaxed">
              Three steps from customer arrival to completed transaction — with real-time data flowing to your analytics dashboard.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="relative text-center"
              >
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-1/2 w-full h-px border-t-2 border-dashed border-slate-200 z-0" />
                )}
                <div className="relative z-10">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-[#003366] text-amber-400 rounded-2xl font-black text-xl mx-auto mb-4">
                    {step.number}
                  </div>
                  <h3 className="font-black text-[#003366] mb-3">{step.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section id="testimonials" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em] mb-3">What managers say</p>
            <h2 className="text-3xl md:text-4xl font-black text-[#003366]">Trusted by branch managers</h2>
            <p className="text-slate-500 mt-4 max-w-xl mx-auto text-sm leading-relaxed">
              Real results from organizations that replaced paper-based queue systems with Smart Queue.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="bg-slate-50 border border-slate-100 rounded-2xl p-6 flex flex-col hover:shadow-lg transition-all"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <svg key={j} className="w-4 h-4 text-amber-400 fill-current shrink-0" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-slate-600 text-sm leading-relaxed flex-1 mb-6">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#003366] text-amber-400 flex items-center justify-center text-xs font-black shrink-0">
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-xs font-black text-[#003366]">{t.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t.title} · {t.org}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="pricing" className="py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em] mb-3">Pricing</p>
            <h2 className="text-3xl md:text-4xl font-black text-[#003366]">Simple, transparent pricing</h2>
            <p className="text-slate-500 mt-4 max-w-xl mx-auto text-sm leading-relaxed">
              Start free with no credit card required. Upgrade when you need more branches or advanced reporting features.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            {PLANS.map((plan) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className={cn(
                  "rounded-2xl p-8 border transition-all",
                  plan.highlight
                    ? "bg-[#003366] text-white border-[#003366] shadow-2xl shadow-[#003366]/30 scale-105"
                    : "bg-white border-slate-200 hover:shadow-lg"
                )}
              >
                {plan.highlight && (
                  <div className="inline-flex items-center gap-1.5 bg-amber-400 text-[#003366] text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-4">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                    Most Popular
                  </div>
                )}
                <h3 className={cn("text-xl font-black mb-1", plan.highlight ? "text-white" : "text-[#003366]")}>{plan.name}</h3>
                <p className={cn("text-xs mb-6 leading-relaxed", plan.highlight ? "text-blue-200" : "text-slate-500")}>{plan.description}</p>

                <div className="mb-6">
                  <span className={cn("text-4xl font-black", plan.highlight ? "text-white" : "text-[#003366]")}>{plan.price}</span>
                  <span className={cn("text-xs ml-2", plan.highlight ? "text-blue-300" : "text-slate-400")}>/{plan.period}</span>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-xs">
                      <svg className={cn("w-4 h-4 shrink-0", plan.highlight ? "text-amber-400" : "text-[#003366]")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className={plan.highlight ? "text-blue-100" : "text-slate-600"}>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => openModal(plan.name === 'Free' ? 'register' : 'signin')}
                  className={cn(
                    "w-full py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all",
                    plan.highlight
                      ? "bg-amber-400 text-[#003366] hover:bg-amber-300"
                      : plan.ctaStyle
                  )}
                >
                  {plan.cta}
                </button>
              </motion.div>
            ))}
          </div>

          <p className="text-center text-xs text-slate-400 mt-8">
            All plans include a 30-day free trial. Payment by bank transfer or cash. Invoices emailed monthly.
          </p>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="py-24 bg-white">
        <div className="max-w-2xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em] mb-3">FAQ</p>
            <h2 className="text-3xl md:text-4xl font-black text-[#003366]">Common questions</h2>
          </div>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="text-sm font-bold text-[#003366] pr-4">{item.q}</span>
                  <svg
                    className={cn('w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200', faqOpen === i ? 'rotate-180' : '')}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {faqOpen === i && (
                  <div className="px-5 pb-5 border-t border-slate-100">
                    <p className="text-sm text-slate-500 leading-relaxed pt-4">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="py-20 bg-[#003366]">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-black text-white mb-4">Ready to modernize your queue?</h2>
          <p className="text-blue-200 text-sm mb-8 leading-relaxed">
            Create a free account in seconds — no credit card required. Sign in to manage your branch from any device.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              type="button"
              onClick={() => openModal('register')}
              className="px-8 py-4 bg-amber-400 hover:bg-amber-300 text-[#003366] font-black rounded-xl text-sm uppercase tracking-widest transition-all shadow-lg"
            >
              Register Free
            </button>
            <button
              type="button"
              onClick={() => openModal('signin')}
              className="px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/30 text-white font-bold rounded-xl text-sm uppercase tracking-widest transition-all"
            >
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-[#001a33] text-blue-300 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <p className="font-black text-white text-lg uppercase tracking-tight">
                Smart <span className="text-amber-400">Queue</span>
              </p>
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mt-1">Queue Intelligence Platform</p>
            </div>
            <div className="flex flex-wrap gap-6 text-[10px] font-bold uppercase tracking-widest">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#testimonials" className="hover:text-white transition-colors">Reviews</a>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
              <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
              <button type="button" onClick={() => openModal('signin')} className="hover:text-white transition-colors">Sign In</button>
              <button type="button" onClick={() => openModal('register')} className="hover:text-white transition-colors">Register</button>
            </div>
          </div>
          <div className="border-t border-white/10 mt-8 pt-8 text-center text-[10px] text-blue-500">
            © 2026 Smart Queue. All rights reserved.
          </div>
        </div>
      </footer>

      {/* ===== SUPER ADMIN FLOATING BUTTON (bottom-right) ===== */}
      <button
        type="button"
        onClick={() => { window.location.href = '/super-admin-login'; }}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-[#001a33]/80 hover:bg-[#001a33] border border-white/10 text-white/60 hover:text-white text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-full backdrop-blur transition-all shadow-lg"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
        Super Admin
      </button>

      {/* ===== AUTH MODAL (Sign In / Register / Forgot / Reset) ===== */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#001a33]/80 backdrop-blur-sm"
              onClick={() => setShowModal(false)}
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 md:p-10 max-h-[90vh] overflow-y-auto"
            >
              {/* Close button */}
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Logo mark */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-[#003366] rounded-2xl mb-3 mx-auto">
                  <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <p className="font-black text-[#003366] text-sm uppercase tracking-widest">Smart Queue</p>
              </div>

              {/* Tab switcher (only for login view) */}
              {authView === 'login' && (
                <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
                  <button
                    type="button"
                    onClick={() => { setActiveTab('signin'); setLoginError(null); }}
                    className={cn(
                      "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                      activeTab === 'signin' ? "bg-white text-[#003366] shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveTab('register'); setRegError(null); }}
                    className={cn(
                      "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                      activeTab === 'register' ? "bg-white text-[#003366] shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    Register Free
                  </button>
                </div>
              )}

              {/* Section title for forgot/reset */}
              {authView !== 'login' && (
                <div className="text-center mb-6">
                  <h2 className="text-lg font-extrabold text-[#003366]">
                    {authView === 'forgot' ? 'Reset Password' : 'Set New Password'}
                  </h2>
                  <p className="text-slate-500 text-xs mt-1">
                    {authView === 'forgot' ? 'Enter your email to receive a reset link.' : 'Choose a new password for your account.'}
                  </p>
                </div>
              )}

              {/* SIGN IN */}
              {authView === 'login' && activeTab === 'signin' && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="admin@example.com"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                    />
                  </div>
                  {loginError && (
                    <p className="text-red-500 text-xs font-bold bg-red-50 border border-red-100 rounded-lg px-3 py-2">{loginError}</p>
                  )}
                  <button type="submit" className="w-full py-3.5 bg-[#003366] hover:bg-[#002244] text-white rounded-xl font-bold text-sm uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20 mt-2">
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthView('forgot'); setLoginError(null); setForgotEmail(''); setForgotSent(false); }}
                    className="w-full text-center text-[11px] font-bold text-slate-400 hover:text-[#003366] transition-colors pt-1"
                  >
                    Forgot your password?
                  </button>
                </form>
              )}

              {/* REGISTER */}
              {authView === 'login' && activeTab === 'register' && (
                <div>
                  {regSuccess ? (
                    <div className="text-center space-y-4 py-4">
                      <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mx-auto">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-sm font-bold text-slate-700">Account created!</p>
                      <p className="text-xs text-slate-500">Redirecting to your dashboard...</p>
                    </div>
                  ) : (
                    <form onSubmit={handleRegister} className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Full Name</label>
                        <input
                          type="text"
                          value={regName}
                          onChange={e => setRegName(e.target.value)}
                          placeholder="Juan dela Cruz"
                          required
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Organization / Branch Name</label>
                        <input
                          type="text"
                          value={regOrg}
                          onChange={e => setRegOrg(e.target.value)}
                          placeholder="ABC Savings Bank"
                          required
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Email Address</label>
                        <input
                          type="email"
                          value={regEmail}
                          onChange={e => setRegEmail(e.target.value)}
                          placeholder="you@yourorg.com"
                          required
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Password</label>
                        <input
                          type="password"
                          value={regPassword}
                          onChange={e => setRegPassword(e.target.value)}
                          placeholder="Minimum 8 characters"
                          required
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Confirm Password</label>
                        <input
                          type="password"
                          value={regConfirm}
                          onChange={e => setRegConfirm(e.target.value)}
                          placeholder="Repeat password"
                          required
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                        />
                      </div>
                      {regError && (
                        <p className="text-red-500 text-xs font-bold bg-red-50 border border-red-100 rounded-lg px-3 py-2">{regError}</p>
                      )}
                      <button type="submit" className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-white rounded-xl font-bold text-sm uppercase tracking-widest transition-all shadow-lg shadow-amber-500/20 mt-1">
                        Create Free Account
                      </button>
                      <p className="text-center text-[10px] text-slate-400 pt-1">
                        By registering you agree to our terms of service.
                      </p>
                    </form>
                  )}
                </div>
              )}

              {/* FORGOT PASSWORD */}
              {authView === 'forgot' && (
                <div>
                  {forgotSent ? (
                    <div className="text-center space-y-4">
                      <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mx-auto">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-sm font-bold text-slate-700">Check your email</p>
                      <p className="text-xs text-slate-500">If an account exists for <span className="font-bold text-[#003366]">{forgotEmail}</span>, a reset link has been sent.</p>
                      <button
                        type="button"
                        onClick={() => { setAuthView('login'); setForgotSent(false); }}
                        className="w-full py-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors uppercase tracking-widest"
                      >
                        Back to Sign In
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Email Address</label>
                        <input
                          type="email"
                          value={forgotEmail}
                          onChange={e => setForgotEmail(e.target.value)}
                          placeholder="admin@example.com"
                          required
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                        />
                      </div>
                      <button type="submit" className="w-full py-3.5 bg-[#003366] hover:bg-[#002244] text-white rounded-xl font-bold text-sm uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20">
                        Send Reset Link
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAuthView('login'); setLoginError(null); }}
                        className="w-full text-center text-[11px] font-bold text-slate-400 hover:text-[#003366] transition-colors pt-1"
                      >
                        Back to Sign In
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* RESET PASSWORD */}
              {authView === 'reset' && (
                <div>
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
                    <form onSubmit={handleResetPassword} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">New Password</label>
                        <input
                          type="password"
                          value={resetNewPassword}
                          onChange={e => setResetNewPassword(e.target.value)}
                          placeholder="Minimum 8 characters"
                          required
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
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
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                        />
                      </div>
                      {loginError && (
                        <p className="text-red-500 text-xs font-bold bg-red-50 border border-red-100 rounded-lg px-3 py-2">{loginError}</p>
                      )}
                      <button type="submit" className="w-full py-3.5 bg-[#003366] hover:bg-[#002244] text-white rounded-xl font-bold text-sm uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20">
                        Set New Password
                      </button>
                    </form>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== SUPER ADMIN MODAL ===== */}
      <AnimatePresence>
        {showSuperAdmin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-end p-6"
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#001a33]/60 backdrop-blur-sm"
              onClick={() => setShowSuperAdmin(false)}
            />

            {/* Super Admin Card — anchored bottom-right */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="relative bg-[#001a33] border border-white/10 rounded-2xl shadow-2xl w-full max-w-xs p-7"
            >
              {/* Close button */}
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowSuperAdmin(false)}
                className="absolute top-3 right-3 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 bg-amber-500/20 rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-4.5 h-4.5 text-amber-400 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-black text-sm">Super Admin</p>
                  <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Restricted Access</p>
                </div>
              </div>

              <form onSubmit={handleSuperAdminLogin} className="space-y-3">
                <input
                  type="email"
                  value={saEmail}
                  onChange={e => setSaEmail(e.target.value)}
                  placeholder="super@admin.com"
                  required
                  className="w-full bg-white/5 border border-white/10 text-white placeholder:text-white/30 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                />
                <input
                  type="password"
                  value={saPassword}
                  onChange={e => setSaPassword(e.target.value)}
                  placeholder="Password"
                  required
                  className="w-full bg-white/5 border border-white/10 text-white placeholder:text-white/30 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                />
                {saError && (
                  <p className="text-red-400 text-xs font-bold bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{saError}</p>
                )}
                <button type="submit" className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-[#001a33] rounded-xl font-black text-xs uppercase tracking-widest transition-all">
                  Access Super Admin
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {siteConfig.supportEmail && (
        <a
          href={`mailto:${siteConfig.supportEmail}?subject=${encodeURIComponent('Smart Queue support or feature request')}`}
          className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-3 rounded-full bg-[#003366] px-5 py-3 text-white shadow-2xl shadow-blue-900/20 transition-all hover:-translate-y-0.5 hover:bg-[#002244]"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4v-4z" />
            </svg>
          </span>
          <span className="text-left">
            <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-blue-100">Need Help?</span>
            <span className="block text-sm font-bold">Contact Support</span>
          </span>
        </a>
      )}
    </div>
  );
}
