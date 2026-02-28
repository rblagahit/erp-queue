/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './utils';

interface QueueEntry {
  id: string;
  name: string;
  branch: string;
  service: string;
  priority: string;
  checkInTime: string;
  status: 'Waiting' | 'Processing' | 'Completed';
  calledTime: string | null;
  completedTime: string | null;
}

interface IPEntry {
  ip: string;
  label: string;
  addedAt: string;
}

const BRANCHES = [
  "Carcar Branch", "Moalboal Branch", "Talisay Branch", "Carbon Branch",
  "Solinea Branch", "Mandaue Branch", "Danao Branch", "Bogo Branch",
  "Capitol Branch"
];

const SERVICES = [
  "Cash/Check Deposit", "Withdrawal", "Account Opening", "Customer Service", "Loans"
];

export default function App() {
  const [view, setView] = useState<'client' | 'teller' | 'analytics' | 'admin'>('teller');
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [history, setHistory] = useState<QueueEntry[]>([]);
  const [filterBranch, setFilterBranch] = useState('All');
  const [analyticsBranch, setAnalyticsBranch] = useState('All');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notification, setNotification] = useState<{ msg: string; isError?: boolean } | null>(null);
  const notifTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Admin state
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);
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

  // UI state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [confirmRemoveIP, setConfirmRemoveIP] = useState<string | null>(null);

  const showNotification = (msg: string, isError = false) => {
    if (notifTimeoutRef.current) clearTimeout(notifTimeoutRef.current);
    setNotification({ msg, isError });
    notifTimeoutRef.current = setTimeout(() => setNotification(null), 3500);
  };

  const fetchData = async () => {
    try {
      const [qRes, hRes] = await Promise.all([
        fetch('/api/queue'),
        fetch('/api/history')
      ]);
      if (qRes.ok) setQueue(await qRes.json());
      if (hRes.ok) setHistory(await hRes.json());
    } catch (err) {
      console.error("Failed to fetch data", err);
    }
  };

  // Initial load, WebSocket, polling
  useEffect(() => {
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

  // Restore admin session from localStorage and verify it
  useEffect(() => {
    const stored = localStorage.getItem('adminToken');
    if (stored) {
      fetch('/api/admin/verify', { headers: { 'x-admin-token': stored } })
        .then(res => {
          if (res.ok) setAdminToken(stored);
          else localStorage.removeItem('adminToken');
        })
        .catch(() => localStorage.removeItem('adminToken'));
    }
  }, []);

  // Load IPs and settings when entering admin view
  useEffect(() => {
    if (view === 'admin' && adminToken) {
      loadIPs();
      loadSettings();
    }
  }, [view, adminToken]);

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

  const adminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoginError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword })
      });
      if (res.ok) {
        const { token } = await res.json();
        setAdminToken(token);
        localStorage.setItem('adminToken', token);
        setAdminPassword('');
        loadIPs(token);
        loadSettings(token);
      } else {
        setAdminLoginError('Invalid password. Please try again.');
      }
    } catch {
      setAdminLoginError('Login failed. Please check your connection.');
    }
  };

  const adminLogout = async () => {
    if (adminToken) {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: { 'x-admin-token': adminToken }
      }).catch(() => {});
    }
    setAdminToken(null);
    localStorage.removeItem('adminToken');
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

      const data: QueueEntry[] = await res.json();
      if (data.length === 0) {
        showNotification('No records found for the selected filters.', true);
        return;
      }

      // Compute TAT per service from the filtered dataset
      const serviceStats: Record<string, { total: number; count: number }> = {};
      SERVICES.forEach(s => serviceStats[s] = { total: 0, count: 0 });
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
        "Ticket ID", "Client Name", "Branch", "Service", "Priority",
        "Check-In", "Called At", "Completed At", "Wait Time (m)", "Service Time (m)"
      ];
      const rows = data.map(h => {
        const wait = h.calledTime && h.checkInTime
          ? Math.round((new Date(h.calledTime).getTime() - new Date(h.checkInTime).getTime()) / 60000) : 0;
        const svc = h.completedTime && h.calledTime
          ? Math.round((new Date(h.completedTime).getTime() - new Date(h.calledTime).getTime()) / 60000) : 0;
        return [h.id, h.name, h.branch, h.service, h.priority,
          h.checkInTime, h.calledTime || '', h.completedTime || '', wait, svc];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
        '',
        'TAT per Service Type Summary',
        'Service Type,Average TAT (m),Total Transactions',
        ...SERVICES.map(s => `"${s}",${serviceStats[s].count
          ? Math.round(serviceStats[s].total / serviceStats[s].count) : 0},${serviceStats[s].count}`)
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateTag = exportFrom || exportTo
        ? `${exportFrom || 'start'}_to_${exportTo || 'end'}`
        : 'all-dates';
      link.download = `SSB_Queue_Report_${dateTag}.csv`;
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
    const formData = new FormData(e.currentTarget);
    const name = formData.get('clientName') as string;
    if (!name) return;

    const entry: QueueEntry = {
      id: 'SSB-' + crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase(),
      name,
      branch: formData.get('clientBranch') as string,
      service: formData.get('clientService') as string,
      priority: formData.get('clientPriority') as string,
      checkInTime: new Date().toISOString(),
      status: 'Waiting',
      calledTime: null,
      completedTime: null
    };

    try {
      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
      if (res.ok) {
        await fetchData();
        showNotification(`Ticket Issued: ${entry.id}`);
        setView('teller');
        e.currentTarget.reset();
      } else {
        const errData = await res.json().catch(() => ({ error: 'Check-in failed' }));
        showNotification(errData.error || 'Check-in failed. Please try again.', true);
      }
    } catch {
      showNotification('Check-in failed. Please check your connection.', true);
    }
  };

  const callNext = async (id: string) => {
    try {
      const res = await fetch('/api/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, calledTime: new Date().toISOString() })
      });
      if (res.ok) await fetchData();
    } catch (err) {
      console.error("Call failed", err);
    }
  };

  const completeTransaction = async (id: string) => {
    try {
      const res = await fetch('/api/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, completedTime: new Date().toISOString() })
      });
      if (res.ok) await fetchData();
    } catch (err) {
      console.error("Completion failed", err);
    }
  };

  const filteredQueue = useMemo(() => {
    return filterBranch === 'All' ? queue : queue.filter(q => q.branch === filterBranch);
  }, [queue, filterBranch]);

  const analytics = useMemo(() => {
    let totalWait = 0, totalService = 0, waitCount = 0, serviceCount = 0;
    const serviceStats: Record<string, { total: number; count: number }> = {};
    SERVICES.forEach(s => serviceStats[s] = { total: 0, count: 0 });

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
      tatPerService: SERVICES.map(s => ({
        name: s,
        avg: serviceStats[s].count ? Math.round(serviceStats[s].total / serviceStats[s].count) : 0,
        count: serviceStats[s].count
      }))
    };
  }, [history, analyticsBranch]);

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`;
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="px-8 h-20 flex justify-between items-center">
          <div className="flex flex-col">
            <h1 className="font-bold text-xl text-[#003366] leading-none uppercase tracking-tight">
              Sun Savings <span className="text-amber-500 font-extrabold">Bank</span>
            </h1>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Smart Queue Intelligence</p>
          </div>

          <div className="hidden md:flex gap-10">
            <button type="button" onClick={() => setView('client')} className={cn("nav-link text-xs font-bold uppercase tracking-widest", view === 'client' ? "active" : "text-slate-400")}>
              Customer Entry
            </button>
            <button type="button" onClick={() => setView('teller')} className={cn("nav-link text-xs font-bold uppercase tracking-widest", view === 'teller' ? "active" : "text-slate-400")}>
              Branch Console
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
              { key: 'client', label: 'Customer Entry' },
              { key: 'teller', label: 'Branch Console' },
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
                  <p className="text-slate-500 mt-2 text-sm">Welcome to Sun Savings Bank. Please check in below.</p>
                </div>

                <form onSubmit={handleCheckIn} className="space-y-5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Client Full Name</label>
                    <input name="clientName" type="text" required placeholder="Juan Dela Cruz" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-400 outline-none transition-all" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Branch</label>
                      <select name="clientBranch" aria-label="Branch" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none">
                        {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Account Type</label>
                      <select name="clientPriority" aria-label="Account Type" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none">
                        <option value="Regular">Regular</option>
                        <option value="Priority">Priority (Senior/PWD)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Transaction Type</label>
                    <select name="clientService" aria-label="Transaction Type" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none">
                      {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
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
            <motion.section key="teller" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                  <h2 className="text-2xl font-extrabold text-[#003366]">Active Service Queue</h2>
                  <p className="text-xs text-slate-400 font-medium">Real-time monitoring across the network</p>
                </div>
                <select
                  aria-label="Filter by branch"
                  value={filterBranch}
                  onChange={(e) => setFilterBranch(e.target.value)}
                  className="white-card text-[11px] font-bold rounded-lg px-4 py-2 outline-none cursor-pointer"
                >
                  <option value="All">All Branches</option>
                  {BRANCHES.map(b => <option key={b} value={b}>{b.replace(' Branch', '')}</option>)}
                </select>
              </div>

              <div className="white-card rounded-2xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 tracking-wider">Branch & Info</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 tracking-wider">Customer</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 tracking-wider">Transaction</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 tracking-wider text-center">Live TAT Metrics</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 tracking-wider text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredQueue.map(item => {
                      const waitTimeMs = currentTime.getTime() - new Date(item.checkInTime).getTime();
                      const processingTimeMs = item.calledTime ? currentTime.getTime() - new Date(item.calledTime).getTime() : 0;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-5">
                            <p className="text-[10px] font-extrabold text-[#003366] uppercase">{item.branch}</p>
                            <p className="text-[9px] text-slate-400 mt-1">ID: {item.id}</p>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800">{item.name}</span>
                              {item.priority === 'Priority' && <span className="bg-amber-100 text-amber-600 text-[8px] font-black px-1.5 py-0.5 rounded">PRIORITY</span>}
                            </div>
                            <p className="text-[9px] text-slate-400">{item.priority} Account</p>
                          </td>
                          <td className="px-6 py-5">
                            <span className="text-xs font-semibold text-slate-600">{item.service}</span>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col items-center gap-2">
                              <div className="flex items-center gap-4 w-full justify-center">
                                <div className="text-center">
                                  <p className="text-[8px] font-bold text-slate-400 uppercase">Waiting</p>
                                  <p className={cn("text-xs font-black", waitTimeMs > 600000 ? "text-red-500" : "text-slate-600")}>
                                    {formatDuration(waitTimeMs)}
                                  </p>
                                </div>
                                {item.status === 'Processing' && (
                                  <>
                                    <div className="w-px h-6 bg-slate-100"></div>
                                    <div className="text-center">
                                      <p className="text-[8px] font-bold text-blue-400 uppercase">Processing</p>
                                      <p className="text-xs font-black text-blue-600 live-indicator">{formatDuration(processingTimeMs)}</p>
                                    </div>
                                  </>
                                )}
                              </div>
                              <span className={cn(
                                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-tighter",
                                item.status === 'Processing' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'
                              )}>
                                <span className={cn("w-1 h-1 rounded-full bg-current", item.status === 'Processing' && "live-indicator")}></span>
                                {item.status}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-right">
                            {item.status === 'Waiting' ? (
                              <button type="button" onClick={() => callNext(item.id)} className="text-[10px] font-bold uppercase text-amber-600 border border-amber-200 px-4 py-2 rounded-lg hover:bg-amber-50 transition-colors shadow-sm">Call Client</button>
                            ) : (
                              <button type="button" onClick={() => completeTransaction(item.id)} className="text-[10px] font-bold uppercase bg-[#003366] text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all shadow-md flex items-center gap-2 ml-auto">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                Finish Transaction
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredQueue.length === 0 && (
                  <div className="p-20 text-center">
                    <p className="text-slate-300 font-bold uppercase text-[10px] tracking-widest italic">Queue is currently empty</p>
                  </div>
                )}
              </div>
            </motion.section>
          )}

          {/* ANALYTICS */}
          {view === 'analytics' && (
            <motion.section key="analytics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-extrabold text-[#003366]">Performance Analytics</h2>
                  <p className="text-xs text-slate-400 font-medium">Historical data and service metrics</p>
                </div>
                <select
                  aria-label="Filter analytics by branch"
                  value={analyticsBranch}
                  onChange={(e) => setAnalyticsBranch(e.target.value)}
                  className="white-card text-[11px] font-bold rounded-lg px-4 py-2 outline-none cursor-pointer border border-slate-100"
                >
                  <option value="All">All Branches</option>
                  {BRANCHES.map(b => <option key={b} value={b}>{b.replace(' Branch', '')}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="white-card p-6 rounded-2xl">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Avg. Wait Time (AWT)</p>
                  <h3 className="text-3xl font-black text-[#003366] metric-value">{analytics.awt}m</h3>
                  <p className="text-[9px] text-green-600 font-bold mt-2">↑ Optimizing</p>
                </div>
                <div className="white-card p-6 rounded-2xl border-l-4 border-amber-400">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Avg. Service Time (TAT)</p>
                  <h3 className="text-3xl font-black text-[#003366] metric-value">{analytics.tat}m</h3>
                  <p className="text-[9px] text-slate-400 font-medium mt-2">Completion duration per client</p>
                </div>
                <div className="white-card p-6 rounded-2xl">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total Serviced Today</p>
                  <h3 className="text-3xl font-black text-[#003366] metric-value">{analytics.total}</h3>
                  <p className="text-[9px] text-blue-600 font-bold mt-2">Across {BRANCHES.length} Branches</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="white-card rounded-2xl p-6">
                  <h4 className="text-sm font-bold text-[#003366] mb-4 uppercase tracking-wider border-b pb-3">TAT per Service Type</h4>
                  <div className="space-y-4">
                    {analytics.tatPerService.map(s => (
                      <div key={s.name} className="flex justify-between items-center">
                        <div>
                          <p className="text-xs font-bold text-slate-700">{s.name}</p>
                          <p className="text-[9px] text-slate-400 uppercase font-bold">{s.count} Transactions</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-[#003366]">{s.avg}m</p>
                          <p className="text-[8px] font-bold text-amber-500 uppercase">Avg TAT</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="white-card rounded-2xl p-6">
                  <h4 className="text-sm font-bold text-[#003366] mb-4 uppercase tracking-wider border-b pb-3">Service Performance Log</h4>
                  <div className="overflow-x-auto max-h-[300px] no-scrollbar">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400">
                          <th className="pb-3 font-semibold">Client</th>
                          <th className="pb-3 font-semibold">Branch</th>
                          <th className="pb-3 font-semibold">Wait Time</th>
                          <th className="pb-3 font-semibold">Service Duration</th>
                          <th className="pb-3 font-semibold text-right">Handled At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {history
                          .filter(h => analyticsBranch === 'All' || h.branch === analyticsBranch)
                          .slice(0, 10)
                          .map(h => {
                            const wait = h.calledTime && h.checkInTime ? Math.round((new Date(h.calledTime).getTime() - new Date(h.checkInTime).getTime()) / 60000) : 0;
                            const dur = h.completedTime && h.calledTime ? Math.round((new Date(h.completedTime).getTime() - new Date(h.calledTime).getTime()) / 60000) : 0;
                            return (
                              <tr key={h.id} className="text-slate-600">
                                <td className="py-3 font-bold text-slate-800">{h.name}</td>
                                <td className="py-3">{h.branch}</td>
                                <td className="py-3">{wait}m</td>
                                <td className="py-3 font-bold text-[#003366]">{dur}m</td>
                                <td className="py-3 text-right text-[10px] text-slate-400">
                                  {h.completedTime ? new Date(h.completedTime).toLocaleTimeString() : ''}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Project Development Team */}
              <div className="mt-12 space-y-8 bg-white p-10 rounded-[3rem] border border-slate-100">
                <div className="text-center">
                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em] mb-2">Enterprise Solutions</p>
                  <h4 className="text-2xl font-black text-[#003366] uppercase tracking-tight">Project Development Team</h4>
                  <div className="h-1.5 w-16 bg-[#003366] mx-auto mt-4 rounded-full"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                  <div className="text-center group">
                    <div className="profile-frame group-hover:scale-105 transition-transform duration-300">
                      <div className="profile-inner">
                        <img src="https://media.licdn.com/dms/image/v2/D5603AQGH0ybzOK3UDQ/profile-displayphoto-scale_200_200/B56Zx4tivxGwAY-/0/1771551734704?e=2147483647&v=beta&t=BCBC5AhYwV6lJTI6hNyIPA8EXc0Qrov-I1ZACNNI1Uo" alt="Rodelio Lagahit" className="w-full h-full object-cover" />
                      </div>
                    </div>
                    <h5 className="font-extrabold text-[#003366] text-lg leading-tight">Rodelio Lagahit</h5>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 mb-1">Head of HR & Security</p>
                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Lead Developer</p>
                    <p className="text-[11px] text-slate-500 mt-4 leading-relaxed px-2">Architecting the core queue logic, secure database schemas, and real-time synchronization engine.</p>
                  </div>
                  <div className="text-center group">
                    <div className="profile-frame group-hover:scale-105 transition-transform duration-300">
                      <div className="profile-inner">
                        <img src="https://sunsavings.ph/wp-content/uploads/bfi_thumb/beans-o46ee8vdiu7dqy36mulh2uyxfpwid3v9bls0j23daw.png" alt="Beans Gonzales" className="w-full h-full object-cover" />
                      </div>
                    </div>
                    <h5 className="font-extrabold text-[#003366] text-lg">Beans Gonzales</h5>
                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mt-1">COO, EVP & Treasurer</p>
                    <p className="text-[11px] text-slate-500 mt-4 leading-relaxed px-2">Driving strategic implementation, operational alignment, and efficient resource allocation for the bank.</p>
                  </div>
                  <div className="text-center group">
                    <div className="profile-frame group-hover:scale-105 transition-transform duration-300">
                      <div className="profile-inner">
                        <img src="https://d2gjqh9j26unp0.cloudfront.net/profilepic/5af07a5bc15422e1ee86ea61d87507ef" alt="Dwight Cuevas" className="w-full h-full object-cover" />
                      </div>
                    </div>
                    <h5 className="font-extrabold text-[#003366] text-lg leading-tight">Dwight Cuevas</h5>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 mb-1">Sr. AVP of Products</p>
                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Lead Support</p>
                    <p className="text-[11px] text-slate-500 mt-4 leading-relaxed px-2">Overseeing branch-level deployments, technical onboarding, and multi-tier system reliability.</p>
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {/* ADMIN PANEL */}
          {view === 'admin' && (
            <motion.section key="admin" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              {!adminToken ? (
                /* Login Form */
                <div className="max-w-sm mx-auto white-card rounded-[2.5rem] p-10 md:p-14">
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-[#003366] rounded-2xl mb-4 mx-auto">
                      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-extrabold text-[#003366]">Admin Access</h2>
                    <p className="text-slate-500 mt-2 text-sm">Restricted to authorized personnel only.</p>
                  </div>
                  <form onSubmit={adminLogin} className="space-y-5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Admin Password</label>
                      <input
                        type="password"
                        value={adminPassword}
                        onChange={e => setAdminPassword(e.target.value)}
                        placeholder="Enter admin password"
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                      />
                    </div>
                    {adminLoginError && (
                      <p className="text-red-500 text-xs font-bold bg-red-50 border border-red-100 rounded-lg px-3 py-2">{adminLoginError}</p>
                    )}
                    <button type="submit" className="w-full py-4 btn-primary rounded-xl font-bold text-sm uppercase tracking-widest shadow-lg shadow-blue-900/20">
                      Sign In to Admin
                    </button>
                  </form>
                </div>
              ) : (
                /* Admin Panel — authenticated */
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <div>
                      <h2 className="text-2xl font-extrabold text-[#003366]">Admin Panel</h2>
                      <p className="text-xs text-slate-400 font-medium">IP Whitelist · Report Export · API Settings</p>
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* IP WHITELIST PANEL */}
                    <div className="white-card rounded-2xl p-6 space-y-5">
                      <div className="border-b pb-3">
                        <h4 className="text-sm font-bold text-[#003366] uppercase tracking-wider">IP Whitelist</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Only whitelisted IPs can submit queue entries.</p>
                      </div>

                      {ipList.length === 0 ? (
                        <div className="py-5 text-center bg-amber-50 border border-amber-100 rounded-xl">
                          <p className="text-amber-700 text-xs font-bold uppercase">No IPs configured</p>
                          <p className="text-amber-600 text-[10px] mt-1">All network access is currently allowed.<br />Add an IP below to restrict queue access.</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-52 overflow-y-auto no-scrollbar">
                          {ipList.map(entry => (
                            <div key={entry.ip} className="flex justify-between items-center bg-slate-50 border border-slate-100 px-4 py-3 rounded-xl">
                              <div>
                                <p className="text-xs font-black text-[#003366] font-mono">{entry.ip}</p>
                                {entry.label && (
                                  <p className="text-[9px] text-slate-400 uppercase font-bold mt-0.5">{entry.label}</p>
                                )}
                              </div>
                              {confirmRemoveIP === entry.ip ? (
                                <div className="flex items-center gap-1.5 ml-4 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => removeIP(entry.ip)}
                                    className="text-[9px] font-black uppercase text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-md transition-colors"
                                  >
                                    Remove
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmRemoveIP(null)}
                                    className="text-[9px] font-black uppercase text-slate-500 border border-slate-200 px-2 py-1 rounded-md hover:bg-slate-50 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmRemoveIP(entry.ip)}
                                  className="text-red-400 hover:text-red-600 transition-colors ml-4 p-1 rounded-lg hover:bg-red-50 shrink-0"
                                  title="Remove IP"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <form onSubmit={addIP} className="space-y-3 border-t pt-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Add IP Address</p>
                        <div className="flex gap-2">
                          <input
                            value={newIP}
                            onChange={e => setNewIP(e.target.value)}
                            placeholder="192.168.1.100"
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none font-mono focus:ring-2 focus:ring-amber-400 transition-all"
                          />
                          <button
                            type="button"
                            onClick={detectMyIP}
                            className="text-[10px] font-bold text-amber-600 border border-amber-200 px-3 py-2 rounded-lg hover:bg-amber-50 transition-colors whitespace-nowrap"
                            title="Auto-detect my IP"
                          >
                            My IP
                          </button>
                        </div>
                        <input
                          value={newIPLabel}
                          onChange={e => setNewIPLabel(e.target.value)}
                          placeholder="Label (e.g. Carcar Branch Terminal)"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                        />
                        <button
                          type="submit"
                          className="w-full py-2.5 btn-primary rounded-lg font-bold text-xs uppercase tracking-widest"
                        >
                          Add to Whitelist
                        </button>
                      </form>
                    </div>

                    {/* CSV EXPORT PANEL */}
                    <div className="white-card rounded-2xl p-6 space-y-5">
                      <div className="border-b pb-3">
                        <h4 className="text-sm font-bold text-[#003366] uppercase tracking-wider">Export Report</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Download transaction history as CSV with date range filter.</p>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Branch Filter</label>
                          <select
                            aria-label="Export branch filter"
                            value={exportBranch}
                            onChange={e => setExportBranch(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none text-xs font-bold focus:ring-2 focus:ring-amber-400 transition-all"
                          >
                            <option value="All">All Branches</option>
                            {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Date From</label>
                            <input
                              type="date"
                              title="Start date for export"
                              value={exportFrom}
                              onChange={e => setExportFrom(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none text-xs focus:ring-2 focus:ring-amber-400 transition-all"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Date To</label>
                            <input
                              type="date"
                              title="End date for export"
                              value={exportTo}
                              onChange={e => setExportTo(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none text-xs focus:ring-2 focus:ring-amber-400 transition-all"
                            />
                          </div>
                        </div>

                        {(exportFrom || exportTo || exportBranch !== 'All') && (
                          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                            <p className="text-[10px] font-bold text-[#003366] uppercase mb-1">Active Filters</p>
                            <p className="text-xs text-blue-700">
                              {exportBranch !== 'All' && <span className="font-bold">{exportBranch} · </span>}
                              {exportFrom && exportTo
                                ? <span>{exportFrom} — {exportTo}</span>
                                : exportFrom
                                  ? <span>From {exportFrom}</span>
                                  : exportTo
                                    ? <span>Up to {exportTo}</span>
                                    : <span>All dates</span>}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 border-t pt-4">
                        <button
                          type="button"
                          onClick={downloadAdminCSV}
                          className="w-full flex items-center justify-center gap-2 btn-primary py-3 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-blue-900/20"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download CSV
                        </button>
                        {(exportFrom || exportTo || exportBranch !== 'All') && (
                          <button
                            type="button"
                            onClick={() => { setExportFrom(''); setExportTo(''); setExportBranch('All'); }}
                            className="w-full py-2 text-[10px] font-bold text-slate-400 uppercase hover:text-slate-600 transition-colors"
                          >
                            Clear Filters
                          </button>
                        )}
                      </div>
                    </div>

                    {/* API KEY PANEL */}
                    <div className="white-card rounded-2xl p-6 space-y-5 md:col-span-2">
                      <div className="border-b pb-3">
                        <h4 className="text-sm font-bold text-[#003366] uppercase tracking-wider">Google API Key</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Update the Google API key used by the system. The key is stored securely and never returned in full.</p>
                      </div>

                      {apiKey && (
                        <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                          <div>
                            <p className="text-[10px] font-bold text-green-700 uppercase">Key Configured</p>
                            <p className="text-xs text-green-600 font-mono mt-0.5">{apiKey}</p>
                          </div>
                          <button
                            type="button"
                            onClick={removeApiKey}
                            className="text-[9px] font-black uppercase text-red-400 border border-red-200 px-2 py-1 rounded-md hover:bg-red-50 transition-colors ml-4 shrink-0"
                          >
                            Remove
                          </button>
                        </div>
                      )}

                      <form onSubmit={saveApiKey} className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                            {apiKey ? 'Replace Key' : 'API Key'}
                          </label>
                          <div className="flex gap-2">
                            <input
                              type={showApiKey ? 'text' : 'password'}
                              value={apiKeyInput}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApiKeyInput(e.target.value)}
                              placeholder={apiKey ? 'Paste new key to replace...' : 'AIza...'}
                              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none font-mono focus:ring-2 focus:ring-amber-400 transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => setShowApiKey((v: boolean) => !v)}
                              className="text-[10px] font-bold text-slate-500 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
                            >
                              {showApiKey ? 'Hide' : 'Show'}
                            </button>
                          </div>
                        </div>
                        <button
                          type="submit"
                          disabled={!apiKeyInput.trim()}
                          className="w-full py-2.5 btn-primary rounded-lg font-bold text-xs uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {apiKey ? 'Update API Key' : 'Save API Key'}
                        </button>
                      </form>
                    </div>

                  </div>
                </div>
              )}
            </motion.section>
          )}

        </AnimatePresence>
      </main>

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
          <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em]">Sun Savings Bank Smart Queue System</p>
          <div className="flex justify-center gap-6 mt-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <span className="hover:text-blue-900 cursor-pointer">Security Policy</span>
            <span className="hover:text-blue-900 cursor-pointer">Branch Network</span>
            <span className="hover:text-blue-900 cursor-pointer">Support Hub</span>
          </div>
          <p className="text-[10px] text-slate-300 mt-6">© 2026 Sun Savings Bank. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
