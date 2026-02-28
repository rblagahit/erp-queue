import { StrictMode, ReactNode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import Landing from './Landing.tsx';
import './index.css';

function ErrorBoundaryFallback({ error, resetError }: { error: Error | null; resetError: () => void }) {
  if (!error) return null;
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] px-4">
      <div className="white-card rounded-[2rem] p-10 max-w-sm w-full text-center">
        <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h2 className="text-[#003366] font-extrabold text-lg mb-2">Something went wrong</h2>
        <p className="text-slate-400 text-xs font-mono mb-6">{error.message}</p>
        <button
          type="button"
          onClick={resetError}
          className="btn-primary px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

export function ErrorBoundary({ children }: ErrorBoundaryProps) {
  const [error, setError] = useState<Error | null>(null);

  if (error) {
    return <ErrorBoundaryFallback error={error} resetError={() => setError(null)} />;
  }

  try {
    return <>{children}</>;
  } catch (err) {
    setError(err instanceof Error ? err : new Error(String(err)));
    return null;
  }
}

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
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </StrictMode>,
);
