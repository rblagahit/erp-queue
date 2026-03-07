import type { FormEvent } from 'react';

type PlatformSection = 'billing' | 'users' | 'tenants';

type AdminPlatformPanelProps = {
  activeSection: PlatformSection;
  billingSettings: any;
  billingQrDataUrl: string;
  billingSettingsSaving: boolean;
  adminUsers: any[];
  adminTenants: any[];
  editTenantName: Record<string, string>;
  editTenantPlan: Record<string, 'free' | 'starter' | 'pro'>;
  confirmDeleteUser: string | null;
  confirmDeleteTenant: string | null;
  onSaveBillingSettings: (e: FormEvent<HTMLFormElement>) => void;
  onSetBillingSettings: (updater: (prev: any) => any) => void;
  onSetBillingQrDataUrl: (value: string) => void;
  onRefreshUsers: () => void;
  onRefreshTenants: () => void;
  onUpdateUserRole: (userId: string, role: string) => void;
  onDeleteUser: (userId: string) => void;
  onSetConfirmDeleteUser: (value: string | null) => void;
  onSetEditTenantName: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  onUpdateTenantName: (tenantId: string) => void;
  onSetEditTenantPlan: (updater: (prev: Record<string, 'free' | 'starter' | 'pro'>) => Record<string, 'free' | 'starter' | 'pro'>) => void;
  onUpdateTenantPlan: (tenantId: string) => void;
  onDeleteTenant: (tenantId: string) => void;
  onSetConfirmDeleteTenant: (value: string | null) => void;
};

export default function AdminPlatformPanel({
  activeSection,
  billingSettings,
  billingQrDataUrl,
  billingSettingsSaving,
  adminUsers,
  adminTenants,
  editTenantName,
  editTenantPlan,
  confirmDeleteUser,
  confirmDeleteTenant,
  onSaveBillingSettings,
  onSetBillingSettings,
  onSetBillingQrDataUrl,
  onRefreshUsers,
  onRefreshTenants,
  onUpdateUserRole,
  onDeleteUser,
  onSetConfirmDeleteUser,
  onSetEditTenantName,
  onUpdateTenantName,
  onSetEditTenantPlan,
  onUpdateTenantPlan,
  onDeleteTenant,
  onSetConfirmDeleteTenant,
}: AdminPlatformPanelProps) {
  return (
    <div className="space-y-6">
      {activeSection === 'billing' && (
        <div className="white-card rounded-2xl p-6 space-y-5">
          <div className="border-b pb-3">
            <h4 className="text-sm font-bold text-[#003366] uppercase tracking-wider">Billing Configuration</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">Set bank details, editable paid-tier pricing, the free-tier monthly transaction cap, and grace days for auto-downgrade.</p>
          </div>
          <form onSubmit={onSaveBillingSettings} className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Bank Name</label>
              <input value={billingSettings.bankName || ''} onChange={(e) => onSetBillingSettings((prev: any) => ({ ...prev, bankName: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Account Name</label>
                <input value={billingSettings.accountName || ''} onChange={(e) => onSetBillingSettings((prev: any) => ({ ...prev, accountName: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Account Number</label>
                <input value={billingSettings.accountNumber || ''} onChange={(e) => onSetBillingSettings((prev: any) => ({ ...prev, accountNumber: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Instructions</label>
              <textarea rows={3} value={billingSettings.instructions || ''} onChange={(e) => onSetBillingSettings((prev: any) => ({ ...prev, instructions: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Grace Days</label>
                <input type="number" min={1} max={30} value={billingSettings.graceDays ?? 5} onChange={(e) => onSetBillingSettings((prev: any) => ({ ...prev, graceDays: Number(e.target.value) }))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Starter Price (PHP)</label>
                <input type="number" min={0} step="1" value={billingSettings.starterPrice ?? 999} onChange={(e) => onSetBillingSettings((prev: any) => ({ ...prev, starterPrice: Number(e.target.value) }))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Pro Price (PHP)</label>
                <input type="number" min={0} step="1" value={billingSettings.proPrice ?? 2499} onChange={(e) => onSetBillingSettings((prev: any) => ({ ...prev, proPrice: Number(e.target.value) }))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Free Tier Monthly Transactions</label>
              <input type="number" min={1} max={50000} value={billingSettings.freeMonthlyTransactions ?? 500} onChange={(e) => onSetBillingSettings((prev: any) => ({ ...prev, freeMonthlyTransactions: Number(e.target.value) }))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all" />
              <p className="text-[10px] text-slate-400">Free plans stop accepting new queue entries once they hit this count for the current month. The count refreshes automatically every new month.</p>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Payment QR Code</label>
              <div className="flex items-center gap-3">
                {billingSettings.qrUrl ? (
                  <img src={billingSettings.qrUrl} alt="Billing QR code" className="w-16 h-16 rounded-lg border border-slate-200 bg-white p-1" />
                ) : (
                  <div className="w-16 h-16 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-[9px] font-bold text-slate-400 uppercase">No QR</div>
                )}
                <label className="text-[10px] font-bold uppercase text-amber-600 border border-amber-200 px-3 py-2 rounded-lg hover:bg-amber-50 transition-colors cursor-pointer">
                  {billingQrDataUrl ? 'QR Ready' : 'Upload QR'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => onSetBillingQrDataUrl(String(reader.result || ''));
                      reader.readAsDataURL(file);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
            <button type="submit" disabled={billingSettingsSaving} className="w-full py-2.5 btn-primary rounded-lg font-bold text-xs uppercase tracking-widest disabled:opacity-40">
              {billingSettingsSaving ? 'Saving…' : 'Save Billing Configuration'}
            </button>
          </form>
        </div>
      )}

      {activeSection === 'users' && (
        <div className="white-card rounded-2xl p-6 space-y-5">
          <div className="flex justify-between items-start border-b pb-3">
            <div>
              <h4 className="text-sm font-bold text-[#003366] uppercase tracking-wider">User Management</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">All registered users across all tenants. Change roles or remove accounts.</p>
            </div>
            <button type="button" onClick={onRefreshUsers} className="text-[10px] font-bold text-slate-400 hover:text-[#003366] uppercase tracking-widest transition-colors">Refresh</button>
          </div>

          {adminUsers.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-[10px] font-black text-slate-400 uppercase tracking-wider pb-2 pr-4">User</th>
                    <th className="text-[10px] font-black text-slate-400 uppercase tracking-wider pb-2 pr-4">Tenant</th>
                    <th className="text-[10px] font-black text-slate-400 uppercase tracking-wider pb-2 pr-4">Role</th>
                    <th className="text-[10px] font-black text-slate-400 uppercase tracking-wider pb-2 pr-4">Joined</th>
                    <th className="pb-2" scope="col"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {adminUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 pr-4">
                        <p className="text-xs font-bold text-[#003366]">{user.name || '—'}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{user.email}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="text-xs text-slate-600">{user.tenantName || user.tenant_id}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <select
                          aria-label="User role"
                          value={user.role}
                          onChange={(e) => onUpdateUserRole(user.id, e.target.value)}
                          className="text-[10px] font-bold bg-slate-100 border-0 rounded-lg px-2 py-1.5 outline-none cursor-pointer focus:ring-2 focus:ring-amber-400"
                        >
                          <option value="tenant_admin">Tenant Admin</option>
                          <option value="super_admin">Super Admin</option>
                        </select>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="text-[10px] text-slate-400">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</p>
                      </td>
                      <td className="py-3">
                        {confirmDeleteUser === user.id ? (
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => onDeleteUser(user.id)} className="text-[9px] font-black uppercase text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-md transition-colors">Delete</button>
                            <button type="button" onClick={() => onSetConfirmDeleteUser(null)} className="text-[9px] font-black uppercase text-slate-500 border border-slate-200 px-2 py-1 rounded-md hover:bg-slate-50 transition-colors">Cancel</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => onSetConfirmDeleteUser(user.id)} className="text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors" title="Delete user">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeSection === 'tenants' && (
        <div className="white-card rounded-2xl p-6 space-y-5">
          <div className="flex justify-between items-start border-b pb-3">
            <div>
              <h4 className="text-sm font-bold text-[#003366] uppercase tracking-wider">Tenant Management</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">All registered organizations. Edit names or remove inactive tenants.</p>
            </div>
            <button type="button" onClick={onRefreshTenants} className="text-[10px] font-bold text-slate-400 hover:text-[#003366] uppercase tracking-widest transition-colors">Refresh</button>
          </div>

          {adminTenants.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">No tenants found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-[10px] font-black text-slate-400 uppercase tracking-wider pb-2 pr-4">Name</th>
                    <th className="text-[10px] font-black text-slate-400 uppercase tracking-wider pb-2 pr-4">Slug</th>
                    <th className="text-[10px] font-black text-slate-400 uppercase tracking-wider pb-2 pr-4">Plan</th>
                    <th className="text-[10px] font-black text-slate-400 uppercase tracking-wider pb-2 pr-4">Users</th>
                    <th className="text-[10px] font-black text-slate-400 uppercase tracking-wider pb-2 pr-4">Created</th>
                    <th className="pb-2" scope="col"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {adminTenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <input
                            aria-label="Tenant name"
                            title="Edit tenant name"
                            value={editTenantName[tenant.id] ?? tenant.name}
                            onChange={(e) => onSetEditTenantName((prev) => ({ ...prev, [tenant.id]: e.target.value }))}
                            className="text-xs font-bold text-[#003366] bg-transparent border-b border-transparent hover:border-slate-300 focus:border-amber-400 outline-none w-36 transition-all"
                          />
                          {editTenantName[tenant.id] !== tenant.name && (
                            <button type="button" onClick={() => onUpdateTenantName(tenant.id)} className="text-[9px] font-black uppercase text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded transition-colors hover:bg-amber-50">Save</button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="text-[10px] text-slate-400 font-mono">{tenant.slug}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <select
                            aria-label="Tenant plan"
                            value={editTenantPlan[tenant.id] || (tenant.plan || 'free')}
                            onChange={(e) => onSetEditTenantPlan((prev) => ({ ...prev, [tenant.id]: e.target.value as 'free' | 'starter' | 'pro' }))}
                            className="text-[10px] font-bold bg-slate-100 border-0 rounded-lg px-2 py-1.5 outline-none cursor-pointer focus:ring-2 focus:ring-amber-400"
                          >
                            <option value="free">Free</option>
                            <option value="starter">Starter</option>
                            <option value="pro">Pro</option>
                          </select>
                          {(editTenantPlan[tenant.id] || tenant.plan || 'free') !== (tenant.plan || 'free') && (
                            <button type="button" onClick={() => onUpdateTenantPlan(tenant.id)} className="text-[9px] font-black uppercase text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded transition-colors hover:bg-amber-50">Save</button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="text-xs text-slate-600 font-bold">{tenant.userCount}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="text-[10px] text-slate-400">{tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : '—'}</p>
                      </td>
                      <td className="py-3">
                        {tenant.id === 'default' ? (
                          <span className="text-[9px] font-bold text-slate-300 uppercase">Default</span>
                        ) : confirmDeleteTenant === tenant.id ? (
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => onDeleteTenant(tenant.id)} className="text-[9px] font-black uppercase text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-md transition-colors">Delete</button>
                            <button type="button" onClick={() => onSetConfirmDeleteTenant(null)} className="text-[9px] font-black uppercase text-slate-500 border border-slate-200 px-2 py-1 rounded-md hover:bg-slate-50 transition-colors">Cancel</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => onSetConfirmDeleteTenant(tenant.id)} className="text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors" title="Delete tenant">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
