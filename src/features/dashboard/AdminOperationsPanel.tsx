import type { FormEvent } from 'react';

type IPEntry = {
  ip: string;
  label: string;
  addedAt: string;
};

type TrustedDeviceEntry = {
  id: string;
  branch: string;
  label: string;
  createdAt: string;
  lastSeenAt: string;
};

type CustomerTerm = 'customer' | 'client' | 'patient' | 'citizen';
type OperationsSection = 'access' | 'catalog' | 'kiosk';

type AdminOperationsPanelProps = {
  activeSection: OperationsSection;
  ipList: IPEntry[];
  trustedDevices: TrustedDeviceEntry[];
  trustedAccessMode: 'ip_whitelist' | 'hybrid' | 'trusted_devices';
  trustedDeviceLabel: string;
  trustedDeviceBranch: string;
  trustedDeviceBusy: boolean;
  accessModeSaving: boolean;
  confirmRemoveIP: string | null;
  newIP: string;
  newIPLabel: string;
  branches: string[];
  services: string[];
  tenantPlan: 'free' | 'starter' | 'pro';
  planLimits: { maxBranches: number | null; maxServices: number | null };
  customerTerm: CustomerTerm;
  catalogBranchesText: string;
  catalogServicesText: string;
  catalogSaving: boolean;
  qrBranch: string;
  qrService: string;
  kioskUrl: string;
  kioskQrImageUrl: string;
  onAddIP: (e: FormEvent<HTMLFormElement>) => void;
  onSaveAccessMode: (mode: 'ip_whitelist' | 'hybrid' | 'trusted_devices') => void;
  onRegisterTrustedDevice: (e: FormEvent<HTMLFormElement>) => void;
  onRevokeTrustedDevice: (id: string) => void;
  onRemoveIP: (ip: string) => void;
  onDetectMyIP: () => void;
  onSetConfirmRemoveIP: (ip: string | null) => void;
  onSetTrustedDeviceLabel: (value: string) => void;
  onSetTrustedDeviceBranch: (value: string) => void;
  onSetNewIP: (value: string) => void;
  onSetNewIPLabel: (value: string) => void;
  onSaveCatalog: (e: FormEvent<HTMLFormElement>) => void;
  onSetCustomerTerm: (value: CustomerTerm) => void;
  onSetCatalogBranchesText: (value: string) => void;
  onSetCatalogServicesText: (value: string) => void;
  onSetQrBranch: (value: string) => void;
  onSetQrService: (value: string) => void;
  onCopyKioskUrl: () => void;
};

export default function AdminOperationsPanel({
  activeSection,
  ipList,
  trustedDevices,
  trustedAccessMode,
  trustedDeviceLabel,
  trustedDeviceBranch,
  trustedDeviceBusy,
  accessModeSaving,
  confirmRemoveIP,
  newIP,
  newIPLabel,
  branches,
  services,
  tenantPlan,
  planLimits,
  customerTerm,
  catalogBranchesText,
  catalogServicesText,
  catalogSaving,
  qrBranch,
  qrService,
  kioskUrl,
  kioskQrImageUrl,
  onAddIP,
  onSaveAccessMode,
  onRegisterTrustedDevice,
  onRevokeTrustedDevice,
  onRemoveIP,
  onDetectMyIP,
  onSetConfirmRemoveIP,
  onSetTrustedDeviceLabel,
  onSetTrustedDeviceBranch,
  onSetNewIP,
  onSetNewIPLabel,
  onSaveCatalog,
  onSetCustomerTerm,
  onSetCatalogBranchesText,
  onSetCatalogServicesText,
  onSetQrBranch,
  onSetQrService,
  onCopyKioskUrl,
}: AdminOperationsPanelProps) {
  return (
    <>
      {activeSection === 'access' && (
        <div className="white-card rounded-2xl p-6 space-y-5">
          <div className="border-b pb-3">
            <h4 className="text-sm font-bold text-[#003366] uppercase tracking-wider">Queue Access Control</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">Choose how branch kiosks and teller browsers are allowed to submit queue entries.</p>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 space-y-3">
            <p className="text-[10px] font-black text-blue-700 uppercase tracking-[0.2em]">Simple Recommendation</p>
            <p className="text-[11px] text-blue-900">If the branch internet changes IP often, use <span className="font-black">Trusted Devices</span>. Approve the branch browser once, then that kiosk or teller PC can keep checking in even if the ISP changes the public IP.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                key: 'ip_whitelist',
                label: 'IP Whitelist Only',
                note: 'Best when the branch has a stable public IP.',
              },
              {
                key: 'hybrid',
                label: 'Trusted Device or IP',
                note: 'Best mixed setup for branches with both static and dynamic internet.',
              },
              {
                key: 'trusted_devices',
                label: 'Trusted Devices Only',
                note: 'Best when branch IPs change and you want to stop relying on IPs.',
              },
            ].map((option) => {
              const isActive = trustedAccessMode === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  disabled={accessModeSaving}
                  onClick={() => onSaveAccessMode(option.key as 'ip_whitelist' | 'hybrid' | 'trusted_devices')}
                  className={`rounded-2xl border px-4 py-4 text-left transition-all ${
                    isActive
                      ? 'border-[#2553d9] bg-blue-50 shadow-sm shadow-blue-100'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  } ${accessModeSaving ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <p className="text-xs font-black text-[#003366]">{option.label}</p>
                  <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{option.note}</p>
                  {isActive && <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#2553d9] mt-3">Active Mode</p>}
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 space-y-4">
            <div>
              <h5 className="text-xs font-black text-[#003366] uppercase tracking-wider">Trusted Browser Registration</h5>
              <p className="text-[10px] text-slate-500 mt-1">Open this admin page from the actual branch kiosk or teller browser, then approve that browser below. The token is stored only on that browser.</p>
            </div>

            <form onSubmit={onRegisterTrustedDevice} className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_auto] gap-3 items-end">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Device Label</label>
                <input
                  value={trustedDeviceLabel}
                  onChange={(e) => onSetTrustedDeviceLabel(e.target.value)}
                  placeholder="Carcar Front Desk iPad"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Branch</label>
                <select
                  value={trustedDeviceBranch}
                  onChange={(e) => onSetTrustedDeviceBranch(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                >
                  {branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
                </select>
              </div>
              <button type="submit" disabled={trustedDeviceBusy} className="w-full md:w-auto py-2.5 px-4 btn-primary rounded-lg font-bold text-xs uppercase tracking-widest disabled:opacity-40">
                {trustedDeviceBusy ? 'Approving…' : 'Trust This Browser'}
              </button>
            </form>

            {trustedDevices.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-4 text-center">
                <p className="text-xs font-bold text-slate-500">No trusted devices yet</p>
                <p className="text-[10px] text-slate-400 mt-1">Add one for a branch that does not have a static IP.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar">
                {trustedDevices.map((device) => (
                  <div key={device.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-xs font-black text-[#003366] truncate">{device.label}</p>
                      <p className="text-[10px] text-slate-500 uppercase font-bold mt-0.5">{device.branch}</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Last used: {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : 'Never'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRevokeTrustedDevice(device.id)}
                      className="ml-4 text-[9px] font-black uppercase text-red-500 border border-red-200 px-2 py-1 rounded-md hover:bg-red-50 transition-colors"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {ipList.length === 0 ? (
            <div className="py-5 text-center bg-amber-50 border border-amber-100 rounded-xl">
              <p className="text-amber-700 text-xs font-bold uppercase">No IPs configured</p>
              <p className="text-amber-600 text-[10px] mt-1">No static branch IPs configured yet.<br />If your branches use dynamic internet, approve trusted devices above.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto no-scrollbar">
              {ipList.map((entry) => (
                <div key={entry.ip} className="flex justify-between items-center bg-slate-50 border border-slate-100 px-4 py-3 rounded-xl">
                  <div>
                    <p className="text-xs font-black text-[#003366] font-mono">{entry.ip}</p>
                    {entry.label && <p className="text-[9px] text-slate-400 uppercase font-bold mt-0.5">{entry.label}</p>}
                  </div>
                  {confirmRemoveIP === entry.ip ? (
                    <div className="flex items-center gap-1.5 ml-4 shrink-0">
                      <button
                        type="button"
                        onClick={() => onRemoveIP(entry.ip)}
                        className="text-[9px] font-black uppercase text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-md transition-colors"
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetConfirmRemoveIP(null)}
                        className="text-[9px] font-black uppercase text-slate-500 border border-slate-200 px-2 py-1 rounded-md hover:bg-slate-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSetConfirmRemoveIP(entry.ip)}
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

          <form onSubmit={onAddIP} className="space-y-3 border-t pt-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Add Static Branch IP</p>
            <div className="flex gap-2">
              <input
                value={newIP}
                onChange={(e) => onSetNewIP(e.target.value)}
                placeholder="192.168.1.100"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none font-mono focus:ring-2 focus:ring-amber-400 transition-all"
              />
              <button
                type="button"
                onClick={onDetectMyIP}
                className="text-[10px] font-bold text-amber-600 border border-amber-200 px-3 py-2 rounded-lg hover:bg-amber-50 transition-colors whitespace-nowrap"
                title="Auto-detect my IP"
              >
                My IP
              </button>
            </div>
            <input
              value={newIPLabel}
              onChange={(e) => onSetNewIPLabel(e.target.value)}
              placeholder="Label (e.g. Carcar Branch Terminal)"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all"
            />
            <p className="text-[10px] text-slate-400">Use this only for branches with a stable public IP. If the branch IP changes often, trusted devices are the simpler option.</p>
            <button type="submit" className="w-full py-2.5 btn-primary rounded-lg font-bold text-xs uppercase tracking-widest">
              Add to Whitelist
            </button>
          </form>
        </div>
      )}

      {activeSection === 'catalog' && (
        <div className="white-card rounded-2xl p-6 space-y-5">
          <div className="border-b pb-3">
            <h4 className="text-sm font-bold text-[#003366] uppercase tracking-wider">Branch / Service Catalog</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Tenant-specific queue configuration with plan enforcement ({tenantPlan.toUpperCase()} plan).
            </p>
          </div>

          <form onSubmit={onSaveCatalog} className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Language Term</label>
              <select
                value={customerTerm}
                onChange={(e) => onSetCustomerTerm(e.target.value as CustomerTerm)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all"
              >
                <option value="customer">Customer</option>
                <option value="client">Client</option>
                <option value="patient">Patient</option>
                <option value="citizen">Citizen</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Branches (1 per line)</label>
                <textarea
                  rows={6}
                  value={catalogBranchesText}
                  onChange={(e) => onSetCatalogBranchesText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                />
                <p className="text-[10px] text-slate-400">Limit: {planLimits.maxBranches === null ? 'Unlimited' : planLimits.maxBranches}</p>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Services (1 per line)</label>
                <textarea
                  rows={6}
                  value={catalogServicesText}
                  onChange={(e) => onSetCatalogServicesText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                />
                <p className="text-[10px] text-slate-400">Limit: {planLimits.maxServices === null ? 'Unlimited' : planLimits.maxServices}</p>
              </div>
            </div>

            <button type="submit" disabled={catalogSaving} className="w-full py-2.5 btn-primary rounded-lg font-bold text-xs uppercase tracking-widest disabled:opacity-40">
              {catalogSaving ? 'Saving…' : 'Save Catalog Settings'}
            </button>
          </form>
        </div>
      )}

      {activeSection === 'kiosk' && (
        <div className="white-card rounded-2xl p-6 space-y-5">
          <div className="border-b pb-3">
            <h4 className="text-sm font-bold text-[#003366] uppercase tracking-wider">Kiosk QR Check-in</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">Generate a QR link for touchless check-in per branch and service.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Branch</label>
              <select
                value={qrBranch}
                onChange={(e) => onSetQrBranch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all"
              >
                {branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Service</label>
              <select
                value={qrService}
                onChange={(e) => onSetQrService(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all"
              >
                {services.map((service) => <option key={service} value={service}>{service}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Kiosk URL</p>
            <p className="text-[11px] text-slate-600 break-all">{kioskUrl}</p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <img src={kioskQrImageUrl} alt="Kiosk QR code" className="w-44 h-44 rounded-lg border border-slate-200 bg-white p-2" />
            <button
              type="button"
              onClick={onCopyKioskUrl}
              className="text-[10px] font-bold uppercase text-amber-600 border border-amber-200 px-4 py-2 rounded-lg hover:bg-amber-50 transition-colors"
            >
              Copy Kiosk URL
            </button>
          </div>
        </div>
      )}
    </>
  );
}
