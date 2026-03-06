import { motion } from 'motion/react';
import type { QueueEntry } from '../queue/model';

type AnalyticsSummary = {
  awt: number;
  tat: number;
  total: number;
  tatPerService: Array<{ name: string; avg: number; count: number }>;
};

type AnalyticsPanelProps = {
  analytics: AnalyticsSummary;
  analyticsBranch: string;
  branches: string[];
  history: QueueEntry[];
  termTitle: string;
  onAnalyticsBranchChange: (value: string) => void;
};

export default function AnalyticsPanel({
  analytics,
  analyticsBranch,
  branches,
  history,
  termTitle,
  onAnalyticsBranchChange,
}: AnalyticsPanelProps) {
  return (
    <motion.section key="analytics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-extrabold text-[#003366]">Performance Analytics</h2>
          <p className="text-xs text-slate-400 font-medium">Historical data and service metrics</p>
        </div>
        <select
          aria-label="Filter analytics by branch"
          value={analyticsBranch}
          onChange={(e) => onAnalyticsBranchChange(e.target.value)}
          className="white-card text-[11px] font-bold rounded-lg px-4 py-2 outline-none cursor-pointer border border-slate-100"
        >
          <option value="All">All Branches</option>
          {branches.map((branch) => (
            <option key={branch} value={branch}>
              {branch.replace(' Branch', '')}
            </option>
          ))}
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
          <p className="text-[9px] text-slate-400 font-medium mt-2">Completion duration per {termTitle.toLowerCase()}</p>
        </div>
        <div className="white-card p-6 rounded-2xl">
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total Serviced Today</p>
          <h3 className="text-3xl font-black text-[#003366] metric-value">{analytics.total}</h3>
          <p className="text-[9px] text-blue-600 font-bold mt-2">Across {branches.length} Locations</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="white-card rounded-2xl p-6">
          <h4 className="text-sm font-bold text-[#003366] mb-4 uppercase tracking-wider border-b pb-3">TAT per Service Type</h4>
          <div className="space-y-4">
            {analytics.tatPerService.map((service) => (
              <div key={service.name} className="flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-slate-700">{service.name}</p>
                  <p className="text-[9px] text-slate-400 uppercase font-bold">{service.count} Transactions</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-[#003366]">{service.avg}m</p>
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
                  <th className="pb-3 font-semibold">{termTitle}</th>
                  <th className="pb-3 font-semibold">Branch</th>
                  <th className="pb-3 font-semibold">Wait Time</th>
                  <th className="pb-3 font-semibold">Service Duration</th>
                  <th className="pb-3 font-semibold">Outcome</th>
                  <th className="pb-3 font-semibold">Handled By</th>
                  <th className="pb-3 font-semibold text-right">Handled At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {history
                  .filter((entry) => analyticsBranch === 'All' || entry.branch === analyticsBranch)
                  .slice(0, 10)
                  .map((entry) => {
                    const wait = entry.calledTime && entry.checkInTime
                      ? Math.round((new Date(entry.calledTime).getTime() - new Date(entry.checkInTime).getTime()) / 60000)
                      : 0;
                    const duration = entry.completedTime && entry.calledTime
                      ? Math.round((new Date(entry.completedTime).getTime() - new Date(entry.calledTime).getTime()) / 60000)
                      : 0;
                    return (
                      <tr key={entry.id} className="text-slate-600">
                        <td className="py-3 font-bold text-slate-800">{entry.name}</td>
                        <td className="py-3">{entry.branch}</td>
                        <td className="py-3">{wait}m</td>
                        <td className="py-3 font-bold text-[#003366]">{duration}m</td>
                        <td className="py-3 uppercase text-[10px] font-bold text-slate-500">{entry.outcome || entry.status}</td>
                        <td className="py-3 text-[10px] text-slate-500">{entry.handledByEmail || '—'}</td>
                        <td className="py-3 text-right text-[10px] text-slate-400">
                          {entry.completedTime ? new Date(entry.completedTime).toLocaleTimeString() : ''}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
