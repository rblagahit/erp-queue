import type { ChangeEvent, FormEvent } from 'react';

type BillingMe = any;

type AdminSettingsPanelProps = {
  currentUserRole: string | null;
  companyName: string;
  industry: string;
  contactEmail: string;
  contactPhone: string;
  companyLogoUrl: string;
  logoUploading: boolean;
  profileSaving: boolean;
  apiKey: string;
  apiKeyInput: string;
  showApiKey: boolean;
  billingMe: BillingMe;
  paymentPlan: 'starter' | 'pro';
  paymentMonths: number;
  paymentReference: string;
  paymentNotes: string;
  paymentProofDataUrl: string;
  paymentSubmitting: boolean;
  onSaveProfile: (e: FormEvent<HTMLFormElement>) => void;
  onUploadCompanyLogo: (file: File) => void;
  onSetCompanyName: (value: string) => void;
  onSetIndustry: (value: string) => void;
  onSetContactEmail: (value: string) => void;
  onSetContactPhone: (value: string) => void;
  onRemoveApiKey: () => void;
  onSaveApiKey: (e: FormEvent<HTMLFormElement>) => void;
  onSetApiKeyInput: (value: string) => void;
  onSetShowApiKey: (value: boolean) => void;
  onSubmitPaymentProof: (e: FormEvent<HTMLFormElement>) => void;
  onSetPaymentPlan: (value: 'starter' | 'pro') => void;
  onSetPaymentMonths: (value: number) => void;
  onSetPaymentReference: (value: string) => void;
  onSetPaymentNotes: (value: string) => void;
  onSetPaymentProofDataUrl: (value: string) => void;
};

export default function AdminSettingsPanel({
  currentUserRole,
  companyName,
  industry,
  contactEmail,
  contactPhone,
  companyLogoUrl,
  logoUploading,
  profileSaving,
  apiKey,
  apiKeyInput,
  showApiKey,
  billingMe,
  paymentPlan,
  paymentMonths,
  paymentReference,
  paymentNotes,
  paymentProofDataUrl,
  paymentSubmitting,
  onSaveProfile,
  onUploadCompanyLogo,
  onSetCompanyName,
  onSetIndustry,
  onSetContactEmail,
  onSetContactPhone,
  onRemoveApiKey,
  onSaveApiKey,
  onSetApiKeyInput,
  onSetShowApiKey,
  onSubmitPaymentProof,
  onSetPaymentPlan,
  onSetPaymentMonths,
  onSetPaymentReference,
  onSetPaymentNotes,
  onSetPaymentProofDataUrl,
}: AdminSettingsPanelProps) {
  return (
    <>
      <div className="white-card rounded-2xl p-6 space-y-5">
        <div className="border-b pb-3">
          <h4 className="text-sm font-bold text-[#003366] uppercase tracking-wider">Company Profile</h4>
          <p className="text-[10px] text-slate-400 mt-0.5">Set your organization identity and contact details.</p>
        </div>
        <form onSubmit={onSaveProfile} className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Company Logo</label>
            <div className="flex items-center gap-3">
              {companyLogoUrl ? (
                <img src={companyLogoUrl} alt="Company logo" className="w-14 h-14 rounded-lg object-cover border border-slate-200 bg-white" />
              ) : (
                <div className="w-14 h-14 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-[9px] font-bold text-slate-400 uppercase">
                  No Logo
                </div>
              )}
              <label className="text-[10px] font-bold uppercase text-amber-600 border border-amber-200 px-3 py-2 rounded-lg hover:bg-amber-50 transition-colors cursor-pointer">
                {logoUploading ? 'Uploading…' : 'Upload Logo'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUploadCompanyLogo(file);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Company Name</label>
            <input value={companyName} onChange={(e) => onSetCompanyName(e.target.value)} placeholder="Acme Cooperative" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Industry</label>
            <input value={industry} onChange={(e) => onSetIndustry(e.target.value)} placeholder="Banking, Hospital, Government..." className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Contact Email</label>
              <input type="email" value={contactEmail} onChange={(e) => onSetContactEmail(e.target.value)} placeholder="ops@company.com" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Contact Number</label>
              <input value={contactPhone} onChange={(e) => onSetContactPhone(e.target.value)} placeholder="+63 912 345 6789" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all" />
            </div>
          </div>
          <button type="submit" disabled={profileSaving} className="w-full py-2.5 btn-primary rounded-lg font-bold text-xs uppercase tracking-widest disabled:opacity-40">
            {profileSaving ? 'Saving…' : 'Save Company Profile'}
          </button>
        </form>
      </div>

      <div className="white-card rounded-2xl p-6 space-y-5">
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
              onClick={onRemoveApiKey}
              className="text-[9px] font-black uppercase text-red-400 border border-red-200 px-2 py-1 rounded-md hover:bg-red-50 transition-colors ml-4 shrink-0"
            >
              Remove
            </button>
          </div>
        )}

        <form onSubmit={onSaveApiKey} className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
              {apiKey ? 'Replace Key' : 'API Key'}
            </label>
            <div className="flex gap-2">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e: ChangeEvent<HTMLInputElement>) => onSetApiKeyInput(e.target.value)}
                placeholder={apiKey ? 'Paste new key to replace...' : 'AIza...'}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none font-mono focus:ring-2 focus:ring-amber-400 transition-all"
              />
              <button
                type="button"
                onClick={() => onSetShowApiKey(!showApiKey)}
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

      {currentUserRole !== 'super_admin' && (
        <div className="white-card rounded-2xl p-6 space-y-5 md:col-span-2">
          <div className="border-b pb-3">
            <h4 className="text-sm font-bold text-[#003366] uppercase tracking-wider">Subscription & Payment</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">Submit your payment proof for plan activation.</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 space-y-1">
            <p><span className="font-bold text-slate-500 uppercase text-[10px]">Bank:</span> {billingMe?.billing?.bankName || 'Not configured'}</p>
            <p><span className="font-bold text-slate-500 uppercase text-[10px]">Account Name:</span> {billingMe?.billing?.accountName || 'Not configured'}</p>
            <p><span className="font-bold text-slate-500 uppercase text-[10px]">Account Number:</span> {billingMe?.billing?.accountNumber || 'Not configured'}</p>
            {billingMe?.billing?.instructions && (
              <p><span className="font-bold text-slate-500 uppercase text-[10px]">Instructions:</span> {billingMe.billing.instructions}</p>
            )}
          </div>

          {billingMe?.billing?.qrUrl && (
            <div className="flex justify-center">
              <img src={billingMe.billing.qrUrl} alt="Payment QR code" className="w-40 h-40 rounded-xl border border-slate-200 bg-white p-2" />
            </div>
          )}

          <form onSubmit={onSubmitPaymentProof} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Plan</label>
                <select
                  value={paymentPlan}
                  onChange={(e) => onSetPaymentPlan(e.target.value as 'starter' | 'pro')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                >
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Months</label>
                <select
                  value={paymentMonths}
                  onChange={(e) => onSetPaymentMonths(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                >
                  <option value={1}>1 Month</option>
                  <option value={3}>3 Months</option>
                  <option value={6}>6 Months</option>
                  <option value={12}>12 Months</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Reference Code</label>
              <input
                value={paymentReference}
                onChange={(e) => onSetPaymentReference(e.target.value)}
                placeholder="Transfer reference number"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Notes (optional)</label>
              <textarea
                rows={2}
                value={paymentNotes}
                onChange={(e) => onSetPaymentNotes(e.target.value)}
                placeholder="Payment details"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-400 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Payment Proof</label>
              <label className="inline-flex text-[10px] font-bold uppercase text-amber-600 border border-amber-200 px-3 py-2 rounded-lg hover:bg-amber-50 transition-colors cursor-pointer">
                {paymentProofDataUrl ? 'Replace Proof' : 'Upload Proof'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => onSetPaymentProofDataUrl(String(reader.result || ''));
                    reader.readAsDataURL(file);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
            </div>
            {paymentProofDataUrl && (
              <img src={paymentProofDataUrl} alt="Payment proof preview" className="w-full max-h-64 object-contain bg-slate-50 border border-slate-200 rounded-xl p-2" />
            )}
            <button type="submit" disabled={paymentSubmitting} className="w-full py-2.5 btn-primary rounded-lg font-bold text-xs uppercase tracking-widest disabled:opacity-40">
              {paymentSubmitting ? 'Submitting…' : 'Submit Payment Proof'}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
