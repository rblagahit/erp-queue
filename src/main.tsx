import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import Landing from './Landing.tsx';
import './index.css';

function TicketStatusPage({ ticketId }: { ticketId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<any>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/ticket/${encodeURIComponent(ticketId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Ticket lookup failed');
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setTicket(data.ticket);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Ticket lookup failed');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [ticketId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4">
      <div className="white-card rounded-[2rem] p-8 max-w-md w-full">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ticket Status</p>
        <h1 className="text-3xl font-black text-[#003366] mt-2">{ticketId.toUpperCase()}</h1>
        {loading && <p className="text-sm text-slate-500 mt-4">Checking status...</p>}
        {error && <p className="text-sm text-red-500 mt-4">{error}</p>}
        {ticket && (
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <p><span className="font-bold text-[#003366]">Status:</span> {ticket.status}</p>
            <p><span className="font-bold text-[#003366]">Name:</span> {ticket.name}</p>
            <p><span className="font-bold text-[#003366]">Branch:</span> {ticket.branch}</p>
            <p><span className="font-bold text-[#003366]">Service:</span> {ticket.service}</p>
            {ticket.notes && <p><span className="font-bold text-[#003366]">Notes:</span> {ticket.notes}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function Root() {
  const ticketMatch = window.location.pathname.match(/^\/ticket\/([^/]+)$/i);
  if (ticketMatch) {
    return <TicketStatusPage ticketId={ticketMatch[1]} />;
  }
  const isTenantAdminLogin = /^\/tenant-admin-login\/?$/i.test(window.location.pathname);
  const isSuperAdminLogin = /^\/super-admin-login\/?$/i.test(window.location.pathname);
  if (isTenantAdminLogin || isSuperAdminLogin) {
    return (
      <App
        initialView="admin"
        loginRole={isSuperAdminLogin ? 'super_admin' : 'tenant_admin'}
        onGoToLanding={() => {
          window.history.replaceState({}, '', '/');
          window.location.reload();
        }}
      />
    );
  }

  const [page, setPage] = useState<'landing' | 'app'>('landing');

  // If a valid admin session already exists in localStorage, skip the landing page
  useEffect(() => {
    const stored = localStorage.getItem('adminToken');
    if (stored) {
      fetch('/api/admin/verify', { headers: { 'x-admin-token': stored } })
        .then(res => { if (res.ok) setPage('app'); })
        .catch(() => {});
    }
    // If a reset_token is in the URL, stay on landing so the modal can handle it
  }, []);

  if (page === 'app') {
    return <App onGoToLanding={() => setPage('landing')} />;
  }
  return <Landing onEnterApp={(token?: string) => { if (token) localStorage.setItem('adminToken', token); setPage('app'); }} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
