import { cn } from '../../utils';

type SetupChecklist = {
  profileDone: boolean;
  operationsDone: boolean;
  configDone: boolean;
};

type KpiSnapshot = {
  firstResponseAvg: number;
  slaMetRate: number;
  reassignments: number;
  noShowRate: number;
  topBreachReason: string;
};

type InsightRow = {
  label: string;
  value: number;
  note: string;
};

type DashboardInsights = {
  trendRows: InsightRow[];
  branchRows: InsightRow[];
  serviceRows: InsightRow[];
  reasonRows: InsightRow[];
  tenantRows: InsightRow[];
  planRows: InsightRow[];
};

type AdminOverviewPanelProps = {
  setupChecklist: SetupChecklist;
  currentUserRole: string | null;
  billingOverview: any;
  billingSubmissions: any[];
  billingMe: any;
  billingReviewBusy: string | null;
  kpiSnapshot: KpiSnapshot;
  dashboardInsights: DashboardInsights;
  onOpenOperations: () => void;
  onRefreshBillingSubmissions: () => void;
  onConfirmPaymentSubmission: (id: string) => void;
  onRejectPaymentSubmission: (id: string) => void;
};

function HorizontalBarList({
  title,
  subtitle,
  data,
  tone = 'bg-[#003366]',
}: {
  title: string;
  subtitle: string;
  data: InsightRow[];
  tone?: string;
}) {
  const maxValue = Math.max(1, ...data.map((item) => item.value));

  return (
    <div className="white-card rounded-2xl p-6 space-y-4">
      <div className="border-b pb-3">
        <h4 className="text-sm font-bold text-[#003366] uppercase tracking-wider">{title}</h4>
        <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>
      </div>
      <div className="space-y-4">
        {data.map((item) => (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-700 truncate">{item.label}</p>
                <p className="text-[10px] text-slate-400">{item.note}</p>
              </div>
              <p className="text-sm font-black text-[#003366]">{item.value}</p>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(6, Math.round((item.value / maxValue) * 100))}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SparklineCard({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle: string;
  data: InsightRow[];
}) {
  const maxValue = Math.max(1, ...data.map((item) => item.value));
  const width = 420;
  const height = 120;
  const step = data.length > 1 ? width / (data.length - 1) : width;
  const points = data.map((item, index) => {
    const x = index * step;
    const y = height - (item.value / maxValue) * (height - 24) - 12;
    return `${x},${Math.max(12, y)}`;
  }).join(' ');

  return (
    <div className="white-card rounded-2xl p-6 space-y-4">
      <div className="border-b pb-3">
        <h4 className="text-sm font-bold text-[#003366] uppercase tracking-wider">{title}</h4>
        <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32 rounded-xl bg-slate-50 border border-slate-100">
        <polyline
          fill="none"
          stroke="#003366"
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points}
        />
        {data.map((item, index) => {
          const x = index * step;
          const y = height - (item.value / maxValue) * (height - 24) - 12;
          return (
            <circle key={`${item.label}-${index}`} cx={x} cy={Math.max(12, y)} r="4" fill="#f59e0b" />
          );
        })}
      </svg>
      <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
        {data.map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-black text-slate-400 uppercase">{item.label}</p>
            <p className="text-sm font-black text-[#003366]">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminOverviewPanel({
  setupChecklist,
  currentUserRole,
  billingOverview,
  billingSubmissions,
  billingMe,
  billingReviewBusy,
  kpiSnapshot,
  dashboardInsights,
  onOpenOperations,
  onRefreshBillingSubmissions,
  onConfirmPaymentSubmission,
  onRejectPaymentSubmission,
}: AdminOverviewPanelProps) {
  return (
    <div className="space-y-6">
      <div className="white-card rounded-2xl p-6 space-y-4">
        <h4 className="text-sm font-bold text-[#003366] uppercase tracking-wider">Quick Setup Walkthrough</h4>
        <div className="space-y-3">
          <div className="flex items-start justify-between p-3 rounded-xl border border-slate-100">
            <div>
              <p className="text-xs font-black text-[#003366]">1. Company Profile</p>
              <p className="text-[11px] text-slate-500">Add company name, industry, contact email, and phone.</p>
            </div>
            <span className={cn("text-[10px] font-black uppercase px-2 py-1 rounded-full", setupChecklist.profileDone ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>
              {setupChecklist.profileDone ? 'Done' : 'Pending'}
            </span>
          </div>
          <div className="flex items-start justify-between p-3 rounded-xl border border-slate-100">
            <div>
              <p className="text-xs font-black text-[#003366]">2. Operations Setup</p>
              <p className="text-[11px] text-slate-500">Set industry language, then add branches and service sections.</p>
            </div>
            <span className={cn("text-[10px] font-black uppercase px-2 py-1 rounded-full", setupChecklist.operationsDone ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>
              {setupChecklist.operationsDone ? 'Done' : 'Pending'}
            </span>
          </div>
          <div className="flex items-start justify-between p-3 rounded-xl border border-slate-100">
            <div>
              <p className="text-xs font-black text-[#003366]">3. Security & Notifications</p>
              <p className="text-[11px] text-slate-500">Add branch IPs, configure SMTP, and set report recipient email.</p>
            </div>
            <span className={cn("text-[10px] font-black uppercase px-2 py-1 rounded-full", setupChecklist.configDone ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>
              {setupChecklist.configDone ? 'Done' : 'Pending'}
            </span>
          </div>
        </div>
        <button type="button" onClick={onOpenOperations} className="w-full py-2.5 btn-primary rounded-lg font-bold text-xs uppercase tracking-widest">
          Open Operations
        </button>
      </div>

      {currentUserRole === 'super_admin' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="white-card rounded-2xl p-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Paid Tenants</p>
              <p className="text-2xl font-black text-[#003366]">{billingOverview?.paidTenants ?? 0}</p>
            </div>
            <div className="white-card rounded-2xl p-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase">MRR</p>
              <p className="text-2xl font-black text-green-600">
                {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(Number(billingOverview?.mrr || 0))}
              </p>
            </div>
            <div className="white-card rounded-2xl p-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Due Soon</p>
              <p className="text-2xl font-black text-amber-600">{billingOverview?.dueSoon ?? 0}</p>
            </div>
            <div className="white-card rounded-2xl p-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Overdue</p>
              <p className="text-2xl font-black text-red-600">{billingOverview?.overdue ?? 0}</p>
            </div>
            <div className="white-card rounded-2xl p-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Renewed (Month)</p>
              <p className="text-2xl font-black text-blue-600">{billingOverview?.renewedThisMonth ?? 0}</p>
            </div>
            <div className="white-card rounded-2xl p-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Downgraded (Month)</p>
              <p className="text-2xl font-black text-slate-700">{billingOverview?.downgradedThisMonth ?? 0}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SparklineCard
              title="7-Day Platform Volume Trend"
              subtitle="Recent transaction flow across all tenants using the shared SaaS platform."
              data={dashboardInsights.trendRows}
            />
            <HorizontalBarList
              title="Top Tenant Activity"
              subtitle="Most active tenant dashboards by transaction count."
              data={dashboardInsights.tenantRows}
              tone="bg-cyan-500"
            />
            <HorizontalBarList
              title="Tenant Plan Mix"
              subtitle="Current plan distribution across the multi-tenant customer base."
              data={dashboardInsights.planRows}
              tone="bg-violet-500"
            />
            <HorizontalBarList
              title="Top Branch Load"
              subtitle="Branches handling the highest transaction volume across tenants."
              data={dashboardInsights.branchRows}
              tone="bg-amber-500"
            />
          </div>

          <div className="white-card rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h4 className="text-sm font-bold text-[#003366] uppercase tracking-wider">Pending Payment Proofs</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Confirm to activate subscription and send receipt by email.</p>
              </div>
              <button type="button" onClick={onRefreshBillingSubmissions} className="text-[10px] font-bold text-slate-400 hover:text-[#003366] uppercase tracking-widest transition-colors">Refresh</button>
            </div>
            {billingSubmissions.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No pending payment submissions.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-[10px] font-black text-slate-400 uppercase tracking-wider pb-2 pr-4">Tenant</th>
                      <th className="text-[10px] font-black text-slate-400 uppercase tracking-wider pb-2 pr-4">Plan</th>
                      <th className="text-[10px] font-black text-slate-400 uppercase tracking-wider pb-2 pr-4">Amount</th>
                      <th className="text-[10px] font-black text-slate-400 uppercase tracking-wider pb-2 pr-4">Reference</th>
                      <th className="text-[10px] font-black text-slate-400 uppercase tracking-wider pb-2 pr-4">Proof</th>
                      <th className="text-[10px] font-black text-slate-400 uppercase tracking-wider pb-2 pr-4">Submitted</th>
                      <th className="pb-2" scope="col"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {billingSubmissions.map((submission) => (
                      <tr key={submission.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 pr-4 text-xs font-bold text-[#003366]">{submission.tenantName || submission.tenant_id}</td>
                        <td className="py-3 pr-4 text-xs uppercase font-bold text-slate-600">{submission.desired_plan}</td>
                        <td className="py-3 pr-4 text-xs font-bold text-slate-700">
                          {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(Number(submission.amount || 0))}
                        </td>
                        <td className="py-3 pr-4 text-[11px] font-mono text-slate-500">{submission.reference_code || '—'}</td>
                        <td className="py-3 pr-4">
                          {submission.proof_url ? (
                            <a href={submission.proof_url} target="_blank" rel="noreferrer" className="text-[10px] font-black uppercase text-amber-600 hover:text-amber-700">
                              View Proof
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-300">No file</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-[10px] text-slate-400">{submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : '—'}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onConfirmPaymentSubmission(submission.id)}
                              disabled={billingReviewBusy !== null}
                              className="text-[9px] font-black uppercase text-white bg-green-600 hover:bg-green-700 px-2 py-1 rounded-md transition-colors disabled:opacity-40"
                            >
                              {billingReviewBusy === `confirm-${submission.id}` ? 'Confirming…' : 'Confirm'}
                            </button>
                            <button
                              type="button"
                              onClick={() => onRejectPaymentSubmission(submission.id)}
                              disabled={billingReviewBusy !== null}
                              className="text-[9px] font-black uppercase text-red-500 border border-red-200 px-2 py-1 rounded-md hover:bg-red-50 transition-colors disabled:opacity-40"
                            >
                              {billingReviewBusy === `reject-${submission.id}` ? 'Rejecting…' : 'Reject'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {currentUserRole !== 'super_admin' && (
        <div className="white-card rounded-2xl p-6 space-y-4">
          <div className="border-b pb-3">
            <h4 className="text-sm font-bold text-[#003366] uppercase tracking-wider">Subscription Status</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">Upgrade plan by submitting proof of payment.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Current Plan</p>
              <p className="text-sm font-black text-[#003366] uppercase">{billingMe?.subscription?.plan || billingMe?.tenant?.plan || 'free'}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Status</p>
              <p className="text-sm font-black text-amber-600 uppercase">{billingMe?.subscription?.status || 'free'}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Period End</p>
              <p className="text-sm font-black text-slate-700">{billingMe?.subscription?.period_end ? new Date(billingMe.subscription.period_end).toLocaleDateString() : '—'}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Grace Days</p>
              <p className="text-sm font-black text-slate-700">{billingMe?.subscription?.grace_days ?? billingMe?.billing?.graceDays ?? 5}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Free Tier Usage</p>
              <p className="text-sm font-black text-slate-700">{billingMe?.usage ? `${billingMe.usage.count}/${billingMe.usage.limit}` : '—'}</p>
            </div>
          </div>
          {(billingMe?.tenant?.plan || 'free') === 'free' && billingMe?.usage && (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black text-amber-700 uppercase tracking-[0.2em]">Monthly Free Tier Transactions</p>
                  <p className="text-sm font-bold text-amber-900">{billingMe.usage.count} used this month, {billingMe.usage.remaining} remaining before the reset.</p>
                </div>
                <p className="text-sm font-black text-amber-700">{Math.min(100, Math.round((billingMe.usage.count / Math.max(1, billingMe.usage.limit)) * 100))}%</p>
              </div>
              <div className="h-2 rounded-full bg-amber-100 overflow-hidden">
                <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, Math.round((billingMe.usage.count / Math.max(1, billingMe.usage.limit)) * 100))}%` }} />
              </div>
              <p className="text-[11px] text-amber-800">The free tier refreshes every new month. Upgrade to Starter or Pro anytime if you need more transactions.</p>
            </div>
          )}
        </div>
      )}

      <div className="white-card rounded-2xl p-6 space-y-4">
        <div className="border-b pb-3">
          <h4 className="text-sm font-bold text-[#003366] uppercase tracking-wider">SLA / KPI Snapshot</h4>
          <p className="text-[10px] text-slate-400 mt-0.5">Operational metrics from entry, first response, reassignment, and closure.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase">First Response</p>
            <p className="text-sm font-black text-[#003366]">{kpiSnapshot.firstResponseAvg} min</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase">SLA Met Rate</p>
            <p className="text-sm font-black text-emerald-600">{kpiSnapshot.slaMetRate}%</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Reassignments</p>
            <p className="text-sm font-black text-amber-600">{kpiSnapshot.reassignments}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase">No-Show Rate</p>
            <p className="text-sm font-black text-rose-600">{kpiSnapshot.noShowRate}%</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Top Breach Reason</p>
            <p className="text-sm font-black text-slate-700">{kpiSnapshot.topBreachReason}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {currentUserRole !== 'super_admin' && (
          <>
            <SparklineCard
              title="7-Day Transaction Trend"
              subtitle="Daily ticket movement to show whether volume is rising or stabilizing."
              data={dashboardInsights.trendRows}
            />
            <HorizontalBarList
              title="Branches by Transaction Volume"
              subtitle="Sorted so managers can quickly see which branches carry the heaviest load."
              data={dashboardInsights.branchRows}
              tone="bg-[#003366]"
            />
          </>
        )}
        <HorizontalBarList
          title="Service Demand Mix"
          subtitle="Which transaction types are consuming the most queue capacity."
          data={dashboardInsights.serviceRows}
          tone="bg-emerald-500"
        />
        <HorizontalBarList
          title="Reason Signals"
          subtitle="Top tagged reasons from breaches, no-shows, holds, and resolution outcomes."
          data={dashboardInsights.reasonRows}
          tone="bg-rose-500"
        />
      </div>
    </div>
  );
}
