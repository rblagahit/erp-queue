import type { FormEvent } from 'react';

type AdminReportsPanelProps = {
  exportBranch: string;
  exportFrom: string;
  exportTo: string;
  branches: string[];
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  smtpTo: string;
  smtpSaving: boolean;
  reportPeriod: 'daily' | 'monthly';
  sendingReport: boolean;
  onSetExportBranch: (value: string) => void;
  onSetExportFrom: (value: string) => void;
  onSetExportTo: (value: string) => void;
  onDownloadAdminCSV: () => void;
  onDownloadPDF: () => void;
  onClearFilters: () => void;
  onSaveSmtp: (e: FormEvent<HTMLFormElement>) => void;
  onSetSmtpHost: (value: string) => void;
  onSetSmtpPort: (value: string) => void;
  onSetSmtpSecure: (value: boolean) => void;
  onSetSmtpUser: (value: string) => void;
  onSetSmtpPass: (value: string) => void;
  onSetSmtpFrom: (value: string) => void;
  onSetSmtpTo: (value: string) => void;
  onSetReportPeriod: (value: 'daily' | 'monthly') => void;
  onSendTestReport: () => void;
};

export default function AdminReportsPanel({
  exportBranch,
  exportFrom,
  exportTo,
  branches,
  smtpHost,
  smtpPort,
  smtpSecure,
  smtpUser,
  smtpPass,
  smtpFrom,
  smtpTo,
  smtpSaving,
  reportPeriod,
  sendingReport,
  onSetExportBranch,
  onSetExportFrom,
  onSetExportTo,
  onDownloadAdminCSV,
  onDownloadPDF,
  onClearFilters,
  onSaveSmtp,
  onSetSmtpHost,
  onSetSmtpPort,
  onSetSmtpSecure,
  onSetSmtpUser,
  onSetSmtpPass,
  onSetSmtpFrom,
  onSetSmtpTo,
  onSetReportPeriod,
  onSendTestReport,
}: AdminReportsPanelProps) {
  const hasFilters = exportFrom || exportTo || exportBranch !== 'All';

  return (
    <>
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
              onChange={(e) => onSetExportBranch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none text-xs font-bold focus:ring-2 focus:ring-amber-400 transition-all"
            >
              <option value="All">All Branches</option>
              {branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Date From</label>
              <input
                type="date"
                title="Start date for export"
                value={exportFrom}
                onChange={(e) => onSetExportFrom(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none text-xs focus:ring-2 focus:ring-amber-400 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Date To</label>
              <input
                type="date"
                title="End date for export"
                value={exportTo}
                onChange={(e) => onSetExportTo(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none text-xs focus:ring-2 focus:ring-amber-400 transition-all"
              />
            </div>
          </div>

          {hasFilters && (
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
            onClick={onDownloadAdminCSV}
            className="w-full flex items-center justify-center gap-2 btn-primary py-3 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-blue-900/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download CSV
          </button>
          <button
            type="button"
            onClick={onDownloadPDF}
            className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-800 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Download PDF Report
          </button>
          {hasFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="w-full py-2 text-[10px] font-bold text-slate-400 uppercase hover:text-slate-600 transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      <div className="white-card rounded-2xl p-6 space-y-5">
        <div className="border-b pb-3">
          <h4 className="text-sm font-bold text-[#003366] uppercase tracking-wider">Email / SMTP Settings</h4>
          <p className="text-[10px] text-slate-400 mt-0.5">Configure your outbound email server for scheduled reports.</p>
        </div>
        <form onSubmit={onSaveSmtp} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">SMTP Host</label>
              <input value={smtpHost} onChange={(e) => onSetSmtpHost(e.target.value)} placeholder="smtp.gmail.com" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Port</label>
              <input value={smtpPort} onChange={(e) => onSetSmtpPort(e.target.value)} placeholder="587" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Username</label>
              <input value={smtpUser} onChange={(e) => onSetSmtpUser(e.target.value)} placeholder="user@example.com" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Password</label>
              <input type="password" value={smtpPass} onChange={(e) => onSetSmtpPass(e.target.value)} placeholder="Leave blank to keep" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">From Address</label>
            <input value={smtpFrom} onChange={(e) => onSetSmtpFrom(e.target.value)} placeholder="no-reply@yourorg.com" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Report Recipient Email</label>
            <input type="email" value={smtpTo} onChange={(e) => onSetSmtpTo(e.target.value)} placeholder="manager@yourorg.com" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={smtpSecure} onChange={(e) => onSetSmtpSecure(e.target.checked)} className="rounded" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">Use TLS/SSL (port 465)</span>
          </label>
          <button type="submit" disabled={smtpSaving} className="w-full py-2.5 btn-primary rounded-lg font-bold text-xs uppercase tracking-widest disabled:opacity-40">
            {smtpSaving ? 'Saving…' : 'Save SMTP Settings'}
          </button>
        </form>

        <div className="border-t pt-4 space-y-3">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-2">Send Report Period</label>
            <div className="flex rounded-lg overflow-hidden border border-slate-200">
              <button
                type="button"
                onClick={() => onSetReportPeriod('daily')}
                className={`flex-1 py-2 text-xs font-bold uppercase transition-all ${reportPeriod === 'daily' ? 'bg-[#003366] text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => onSetReportPeriod('monthly')}
                className={`flex-1 py-2 text-xs font-bold uppercase transition-all ${reportPeriod === 'monthly' ? 'bg-[#003366] text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
              >
                Monthly
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={onSendTestReport}
            disabled={sendingReport}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-40"
          >
            {sendingReport ? 'Sending…' : 'Send Test Report Now'}
          </button>
        </div>
      </div>
    </>
  );
}
