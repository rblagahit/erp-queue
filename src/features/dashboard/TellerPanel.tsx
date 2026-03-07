import { motion } from 'motion/react';
import { cn } from '../../utils';
import {
  BREACH_REASON_OPTIONS,
  NO_SHOW_REASON_OPTIONS,
  PAUSE_REASON_OPTIONS,
  RESOLUTION_CODE_OPTIONS,
  SLA_THRESHOLD_MINUTES,
  type QueueEntry,
} from '../queue/model';

type TellerPanelProps = {
  latestProcessingTicket: QueueEntry | null;
  filterBranch: string;
  branches: string[];
  services: string[];
  filteredQueue: QueueEntry[];
  slaAlertsCount: number;
  currentTime: Date;
  termTitle: string;
  termPlural: string;
  completionNotes: Record<string, string>;
  completionBreachReasons: Record<string, string>;
  completionResolutionCodes: Record<string, string>;
  noShowReasons: Record<string, string>;
  pauseReasons: Record<string, string>;
  reassignBranch: Record<string, string>;
  reassignService: Record<string, string>;
  formatDuration: (ms: number) => string;
  onFilterBranchChange: (value: string) => void;
  onRecallLastCalled: (id: string) => void;
  onCallNext: (id: string) => void;
  onCompletionNotesChange: (id: string, value: string) => void;
  onCompletionBreachReasonChange: (id: string, value: string) => void;
  onCompletionResolutionCodeChange: (id: string, value: string) => void;
  onNoShowReasonChange: (id: string, value: string) => void;
  onPauseReasonChange: (id: string, value: string) => void;
  onCompleteTransaction: (id: string, notes: string, breachReason: string, resolutionCode: string) => void;
  onRecallTicket: (id: string) => void;
  onHoldTicket: (id: string) => void;
  onResumeTicket: (id: string) => void;
  onMarkNoShow: (id: string) => void;
  onReassignBranchChange: (id: string, value: string) => void;
  onReassignServiceChange: (id: string, value: string) => void;
  onReassignClient: (id: string, branch: string, service: string) => void;
};

export default function TellerPanel({
  latestProcessingTicket,
  filterBranch,
  branches,
  services,
  filteredQueue,
  slaAlertsCount,
  currentTime,
  termTitle,
  termPlural,
  completionNotes,
  completionBreachReasons,
  completionResolutionCodes,
  noShowReasons,
  pauseReasons,
  reassignBranch,
  reassignService,
  formatDuration,
  onFilterBranchChange,
  onRecallLastCalled,
  onCallNext,
  onCompletionNotesChange,
  onCompletionBreachReasonChange,
  onCompletionResolutionCodeChange,
  onNoShowReasonChange,
  onPauseReasonChange,
  onCompleteTransaction,
  onRecallTicket,
  onHoldTicket,
  onResumeTicket,
  onMarkNoShow,
  onReassignBranchChange,
  onReassignServiceChange,
  onReassignClient,
}: TellerPanelProps) {
  return (
    <motion.section key="teller" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#003366]">Active Service Queue</h2>
          <p className="text-xs text-slate-400 font-medium">Real-time monitoring across the network</p>
        </div>
        <div className="flex items-center gap-2">
          {latestProcessingTicket && (
            <button
              type="button"
              onClick={() => onRecallLastCalled(latestProcessingTicket.id)}
              className="text-[10px] font-bold uppercase bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors"
            >
              Recall Last Called
            </button>
          )}
          <select
            aria-label="Filter by branch"
            value={filterBranch}
            onChange={(e) => onFilterBranchChange(e.target.value)}
            className="white-card text-[11px] font-bold rounded-lg px-4 py-2 outline-none cursor-pointer"
          >
            <option value="All">All Branches</option>
            {branches.map((branch) => (
              <option key={branch} value={branch}>
                {branch.replace(' Branch', '')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {slaAlertsCount > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <p className="text-[11px] font-black text-red-700 uppercase tracking-wider">
            SLA Alert: {slaAlertsCount} waiting {termPlural} over {SLA_THRESHOLD_MINUTES} minutes
          </p>
        </div>
      )}

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
            {filteredQueue.map((item) => {
              const waitTimeMs = currentTime.getTime() - new Date(item.checkInTime).getTime();
              const processingTimeMs = item.calledTime ? currentTime.getTime() - new Date(item.calledTime).getTime() : 0;
              const firstResponseTime = item.firstCalledTime || item.calledTime;
              const firstResponseBreached = firstResponseTime
                ? ((new Date(firstResponseTime).getTime() - new Date(item.checkInTime).getTime()) / 60000) > (item.slaTargetMinutes || SLA_THRESHOLD_MINUTES)
                : false;

              return (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-5">
                    <p className="text-[10px] font-extrabold text-[#003366] uppercase">{item.branch}</p>
                    <p className="text-[9px] text-slate-400 mt-1">ID: {item.id}</p>
                    <p className="text-[9px] text-slate-400 mt-1 uppercase">Source: {item.sourceChannel || 'self_service'}</p>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{item.name}</span>
                      {item.priority === 'Priority' && <span className="bg-amber-100 text-amber-600 text-[8px] font-black px-1.5 py-0.5 rounded">PRIORITY</span>}
                    </div>
                    <p className="text-[9px] text-slate-400">{item.priority}</p>
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
                        {(item.status === 'Processing' || item.status === 'On Hold') && (
                          <>
                            <div className="w-px h-6 bg-slate-100"></div>
                            <div className="text-center">
                              <p className="text-[8px] font-bold text-blue-400 uppercase">{item.status === 'On Hold' ? 'Held' : 'Processing'}</p>
                              <p className={cn("text-xs font-black", item.status === 'On Hold' ? 'text-amber-600' : 'text-blue-600 live-indicator')}>{formatDuration(processingTimeMs)}</p>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[8px] uppercase font-bold text-slate-400">
                        <span>SLA {item.slaTargetMinutes || SLA_THRESHOLD_MINUTES}m</span>
                        <span>·</span>
                        <span>{item.reassignCount || 0} reassign</span>
                      </div>
                      <p className="text-[8px] uppercase font-bold text-slate-300">
                        Owner: {item.handledByEmail || 'Unassigned'}
                      </p>
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-tighter",
                        item.status === 'Processing'
                          ? 'bg-blue-50 text-blue-600'
                          : item.status === 'On Hold'
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-slate-100 text-slate-500'
                      )}>
                        <span className={cn("w-1 h-1 rounded-full bg-current", item.status === 'Processing' && "live-indicator")}></span>
                        {item.status}
                      </span>
                      {item.pauseReason && (
                        <p className="text-[8px] uppercase font-bold text-amber-500">
                          Hold reason: {item.pauseReason}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex flex-col items-end gap-2">
                      {item.status === 'Waiting' ? (
                        <button type="button" onClick={() => onCallNext(item.id)} className="text-[10px] font-bold uppercase text-amber-600 border border-amber-200 px-4 py-2 rounded-lg hover:bg-amber-50 transition-colors shadow-sm">
                          Call {termTitle}
                        </button>
                      ) : (
                        <>
                          <textarea
                            value={completionNotes[item.id] || ''}
                            onChange={(e) => onCompletionNotesChange(item.id, e.target.value)}
                            placeholder="Add completion note (optional)"
                            rows={2}
                            className="w-56 text-[10px] bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none"
                          />
                          {firstResponseBreached && (
                            <select
                              value={completionBreachReasons[item.id] || ''}
                              onChange={(e) => onCompletionBreachReasonChange(item.id, e.target.value)}
                              className="w-56 text-[10px] bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 outline-none text-amber-700"
                            >
                              <option value="">Select breach reason</option>
                              {BREACH_REASON_OPTIONS.map((reason) => (
                                <option key={reason} value={reason}>{reason}</option>
                              ))}
                            </select>
                          )}
                          <select
                            value={completionResolutionCodes[item.id] || ''}
                            onChange={(e) => onCompletionResolutionCodeChange(item.id, e.target.value)}
                            className="w-56 text-[10px] bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 outline-none text-blue-700"
                          >
                            <option value="">Select resolution code</option>
                            {RESOLUTION_CODE_OPTIONS.map((code) => (
                              <option key={code} value={code}>{code.replace(/_/g, ' ')}</option>
                            ))}
                          </select>
                          <select
                            value={noShowReasons[item.id] || ''}
                            onChange={(e) => onNoShowReasonChange(item.id, e.target.value)}
                            className="w-56 text-[10px] bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none text-slate-600"
                          >
                            <option value="">Select no-show reason</option>
                            {NO_SHOW_REASON_OPTIONS.map((reason) => (
                              <option key={reason} value={reason}>{reason}</option>
                            ))}
                          </select>
                          <select
                            value={pauseReasons[item.id] || ''}
                            onChange={(e) => onPauseReasonChange(item.id, e.target.value)}
                            className="w-56 text-[10px] bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 outline-none text-amber-700"
                          >
                            <option value="">Select hold reason</option>
                            {PAUSE_REASON_OPTIONS.map((reason) => (
                              <option key={reason} value={reason}>{reason}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => onCompleteTransaction(item.id, completionNotes[item.id] || '', completionBreachReasons[item.id] || '', completionResolutionCodes[item.id] || '')}
                            className="text-[10px] font-bold uppercase bg-[#003366] text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all shadow-md flex items-center gap-2"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                            Finish
                          </button>
                          <button type="button" onClick={() => onRecallTicket(item.id)} className="text-[10px] font-bold uppercase text-amber-600 border border-amber-200 px-4 py-1.5 rounded-lg hover:bg-amber-50 transition-colors">
                            Recall
                          </button>
                          {item.status === 'On Hold' ? (
                            <button type="button" onClick={() => onResumeTicket(item.id)} className="text-[10px] font-bold uppercase text-emerald-600 border border-emerald-200 px-4 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors">
                              Resume
                            </button>
                          ) : (
                            <button type="button" onClick={() => onHoldTicket(item.id)} className="text-[10px] font-bold uppercase text-amber-700 border border-amber-200 px-4 py-1.5 rounded-lg hover:bg-amber-50 transition-colors">
                              Put On Hold
                            </button>
                          )}
                          <button type="button" onClick={() => onMarkNoShow(item.id)} className="text-[10px] font-bold uppercase text-slate-400 border border-slate-200 px-4 py-1.5 rounded-lg hover:bg-slate-50 hover:text-red-500 hover:border-red-200 transition-colors">
                            No Show
                          </button>
                        </>
                      )}

                      <div className="w-56 border-t border-slate-100 pt-2 mt-1">
                        <p className="text-[9px] text-slate-400 font-bold uppercase mb-1 text-left">Reassign</p>
                        <div className="space-y-2">
                          <select
                            value={reassignBranch[item.id] || item.branch}
                            onChange={(e) => onReassignBranchChange(item.id, e.target.value)}
                            className="w-full text-[10px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
                          >
                            {branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
                          </select>
                          <select
                            value={reassignService[item.id] || item.service}
                            onChange={(e) => onReassignServiceChange(item.id, e.target.value)}
                            className="w-full text-[10px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
                          >
                            {services.map((service) => <option key={service} value={service}>{service}</option>)}
                          </select>
                          <button
                            type="button"
                            onClick={() => onReassignClient(item.id, item.branch, item.service)}
                            className="w-full text-[10px] font-bold uppercase text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-50 transition-colors"
                          >
                            Reassign to Priority
                          </button>
                        </div>
                      </div>
                    </div>
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
  );
}
