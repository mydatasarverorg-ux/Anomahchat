import { useEffect, useState } from 'react';
import { Laptop, Mail, QrCode, Save, ShieldCheck, Smartphone } from 'lucide-react';
import { SUPER_ADMIN_EMAIL } from '../../services/adminService';
import type {
  AdminSecuritySettings,
  AppSecuritySettings,
  NewDeviceApprovalMode,
} from '../../types/chat';

interface AdminSecurityPolicyTabProps {
  language: string;
  globalSecuritySettings: AppSecuritySettings;
  adminSecuritySettings: AdminSecuritySettings;
  securityPolicyBusy: boolean;
  onSaveGlobalSecuritySettings: (settings: {
    defaultMobileLimit: number;
    defaultWebLimit: number;
    newDeviceApprovalMode: NewDeviceApprovalMode;
    defaultOptionalApproval: boolean;
    enableMagicLinkLogin: boolean;
    enableQrDeviceApproval: boolean;
  }) => Promise<void>;
  onSaveAdminSecuritySettings: (settings: {
    adminMobileLimit: number;
    adminWebLimit: number;
    adminLoginMode: 'fast_alert' | 'strict_approval';
  }) => Promise<void>;
}

export function AdminSecurityPolicyTab({
  language,
  globalSecuritySettings,
  adminSecuritySettings,
  securityPolicyBusy,
  onSaveGlobalSecuritySettings,
  onSaveAdminSecuritySettings,
}: AdminSecurityPolicyTabProps) {
  const bn = language === 'bn';

  const [mobileLimitDraft, setMobileLimitDraft] = useState<string>(
    String(globalSecuritySettings.defaultMobileLimit ?? 1)
  );
  const [webLimitDraft, setWebLimitDraft] = useState<string>(
    String(globalSecuritySettings.defaultWebLimit ?? 1)
  );
  const [approvalModeDraft, setApprovalModeDraft] = useState<NewDeviceApprovalMode>(
    globalSecuritySettings.newDeviceApprovalMode ?? 'optional'
  );
  const [enableMagicLinkDraft, setEnableMagicLinkDraft] = useState<boolean>(
    globalSecuritySettings.enableMagicLinkLogin === true
  );
  const [enableQrApprovalDraft, setEnableQrApprovalDraft] = useState<boolean>(
    globalSecuritySettings.enableQrDeviceApproval !== false
  );

  const [adminMobileDraft, setAdminMobileDraft] = useState<string>(
    String(adminSecuritySettings.adminMobileLimit ?? 5)
  );
  const [adminWebDraft, setAdminWebDraft] = useState<string>(
    String(adminSecuritySettings.adminWebLimit ?? 5)
  );
  const [adminLoginModeDraft, setAdminLoginModeDraft] = useState<'fast_alert' | 'strict_approval'>(
    adminSecuritySettings.adminLoginMode || 'fast_alert'
  );

  useEffect(() => {
    setMobileLimitDraft(String(globalSecuritySettings.defaultMobileLimit));
    setWebLimitDraft(String(globalSecuritySettings.defaultWebLimit));
    setApprovalModeDraft(globalSecuritySettings.newDeviceApprovalMode ?? 'optional');
    setEnableMagicLinkDraft(globalSecuritySettings.enableMagicLinkLogin === true);
    setEnableQrApprovalDraft(globalSecuritySettings.enableQrDeviceApproval !== false);
  }, [
    globalSecuritySettings.defaultMobileLimit,
    globalSecuritySettings.defaultWebLimit,
    globalSecuritySettings.newDeviceApprovalMode,
    globalSecuritySettings.enableMagicLinkLogin,
    globalSecuritySettings.enableQrDeviceApproval,
  ]);

  useEffect(() => {
    setAdminMobileDraft(String(adminSecuritySettings.adminMobileLimit));
    setAdminWebDraft(String(adminSecuritySettings.adminWebLimit));
    setAdminLoginModeDraft(adminSecuritySettings.adminLoginMode);
  }, [
    adminSecuritySettings.adminMobileLimit,
    adminSecuritySettings.adminWebLimit,
    adminSecuritySettings.adminLoginMode,
  ]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Page Title */}
      <div className="pb-3 border-b border-slate-800">
        <h3 className="text-sm font-bold text-white">
          {bn ? 'গ্লোবাল সিকিউরিটি ও লগইন নীতি' : 'Global Security & Login Policy'}
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          {bn
            ? 'সাধারণ ইউজার এবং সুপার অ্যাডমিনের জন্য লগইন মেথড, QR অনুমোদন, 2FA নীতি এবং ডিভাইস কোটা নিয়ন্ত্রণ করুন।'
            : 'Configure authentication switches, 2FA quarantine policy, and device quotas for regular users and Super Admin.'}
        </p>
      </div>

      {/* Section 1: Regular Users Global Policy */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-800 flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <h4 className="text-xs font-bold text-white">
              {bn ? 'সকল সাধারণ ইউজার নীতি' : 'Regular Users Global Policy'}
            </h4>
            <p className="text-[11px] text-slate-400">
              {bn
                ? 'Magic Link ও QR লগইন ফিচার এবং ডিফল্ট ডিভাইস সংখ্যা নির্ধারণ করুন।'
                : 'Control Magic Link, QR login approval, 2FA quarantine mode, and default device slots.'}
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-800/80">
          {/* Magic Link Switch */}
          <div className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <Mail className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white">
                  {bn ? 'Passwordless Magic Link লগইন' : 'Passwordless Email Magic Link'}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  {bn
                    ? 'ডিফল্টভাবে বন্ধ (সহজ Password ও Google লগইন)। চাইলে চালু করতে পারবেন।'
                    : 'Off by default for simple Password & Google sign-in. Enable here anytime.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enableMagicLinkDraft}
              onClick={() => setEnableMagicLinkDraft((prev) => !prev)}
              className={`w-11 h-6 rounded-full transition relative shrink-0 cursor-pointer ${
                enableMagicLinkDraft ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`block w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  enableMagicLinkDraft ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* QR Approval Switch */}
          <div className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <QrCode className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white">
                  {bn ? 'QR কোড ডিভাইস/PC অনুমোদন' : 'QR Code Device / PC Approval'}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  {bn
                    ? 'নতুন পিসি/ডিভাইসে ২-মিনিটের স্ক্যানযোগ্য QR ও মোবাইলে Scan PC QR দেখাবে।'
                    : 'Displays a 2-minute approval QR on new devices and Scan PC QR on trusted phones.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enableQrApprovalDraft}
              onClick={() => setEnableQrApprovalDraft((prev) => !prev)}
              className={`w-11 h-6 rounded-full transition relative shrink-0 cursor-pointer ${
                enableQrApprovalDraft ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`block w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  enableQrApprovalDraft ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* 3-Way Quarantine Mode + Limits */}
          <div className="px-4 sm:px-5 py-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
              <div className="lg:col-span-6 space-y-1.5">
                <label className="text-xs text-slate-300 font-semibold block">
                  {bn
                    ? 'নতুন ডিভাইস 2FA কোয়ারেন্টাইন নীতি'
                    : 'New Device 2FA Quarantine Policy'}
                </label>
                <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
                  {(
                    [
                      {
                        id: 'off' as const,
                        label: bn ? 'সবার জন্য বন্ধ' : 'Off for All',
                        activeCls: 'bg-slate-700 text-white',
                      },
                      {
                        id: 'optional' as const,
                        label: bn ? 'ইউজারের ইচ্ছাধীন' : 'User Optional',
                        activeCls: 'bg-emerald-600 text-white',
                      },
                      {
                        id: 'required' as const,
                        label: bn ? 'সবার আবশ্যিক' : 'Required All',
                        activeCls: 'bg-amber-600 text-white',
                      },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setApprovalModeDraft(opt.id)}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition cursor-pointer truncate ${
                        approvalModeDraft === opt.id
                          ? opt.activeCls
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-2 space-y-1.5">
                <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{bn ? 'সর্বোচ্চ মোবাইল' : 'Max Mobile'}</span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={mobileLimitDraft}
                  onChange={(e) => setMobileLimitDraft(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono tabular-nums focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="lg:col-span-2 space-y-1.5">
                <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                  <Laptop className="w-3.5 h-3.5 text-sky-400" />
                  <span>{bn ? 'সর্বোচ্চ ওয়েব/পিসি' : 'Max PC / Web'}</span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={webLimitDraft}
                  onChange={(e) => setWebLimitDraft(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono tabular-nums focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="lg:col-span-2">
                <button
                  type="button"
                  disabled={securityPolicyBusy}
                  onClick={() => {
                    const m = Math.min(20, Math.max(0, Number(mobileLimitDraft) || 0));
                    const w = Math.min(20, Math.max(0, Number(webLimitDraft) || 0));
                    onSaveGlobalSecuritySettings({
                      defaultMobileLimit: m,
                      defaultWebLimit: w,
                      newDeviceApprovalMode: approvalModeDraft,
                      defaultOptionalApproval: false,
                      enableMagicLinkLogin: enableMagicLinkDraft,
                      enableQrDeviceApproval: enableQrApprovalDraft,
                    });
                  }}
                  className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{bn ? 'নীতি সেভ' : 'Save Policy'}</span>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              {approvalModeDraft === 'optional'
                ? bn
                  ? 'ইউজারের ইচ্ছাধীন: ডিফল্ট সরাসরি লগইন হবে; যে ইউজার Settings → Devices & 2FA থেকে চালু করবে, তার নতুন ডিভাইসে 2FA/QR লাগবে।'
                  : 'Opt-in default: Users sign in directly unless they enable 2FA in Settings → Devices & 2FA.'
                : approvalModeDraft === 'required'
                ? bn
                  ? 'সবার জন্য আবশ্যিক: প্রত্যেক সাধারণ ইউজারের নতুন ডিভাইসে ঢুকতে QR স্ক্যান বা অনুমোদন লাগবে।'
                  : 'Mandatory: Every new device login requires QR scan or trusted-device approval.'
                : bn
                ? 'বন্ধ: নতুন ডিভাইসে 2FA কোয়ারেন্টাইন বন্ধ থাকবে (শুধু ডিভাইস সীমা পূর্ণ হলে যাচাই চাইবে)।'
                : 'Disabled: 2FA quarantine is bypassed globally unless device quota is full.'}
            </p>
          </div>
        </div>
      </div>

      {/* Section 2: Super Admin Root Security Policy */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-white">
                {bn ? 'সুপার অ্যাডমিনের নিজস্ব নিরাপত্তা নীতি' : 'Super Admin Dedicated Policy'}
              </h4>
              <p className="text-[11px] text-slate-400">
                {bn
                  ? 'এমুলেটর/পিসি ও ফোনের জন্য আলাদা কোটা এবং Fast Alert / Strict Lock মোড।'
                  : 'Dedicated device quota and sign-in alert mode for root administration.'}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-sky-400">{SUPER_ADMIN_EMAIL}</span>
        </div>

        <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="space-y-1.5">
            <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span>{bn ? 'অ্যাডমিন মোবাইল' : 'Admin Mobile'}</span>
            </label>
            <input
              type="number"
              min={0}
              max={20}
              value={adminMobileDraft}
              onChange={(e) => setAdminMobileDraft(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono tabular-nums focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
              <Laptop className="w-3.5 h-3.5 text-sky-400" />
              <span>{bn ? 'অ্যাডমিন ওয়েব/পিসি' : 'Admin Web/PC'}</span>
            </label>
            <input
              type="number"
              min={0}
              max={20}
              value={adminWebDraft}
              onChange={(e) => setAdminWebDraft(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono tabular-nums focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-slate-300 font-medium block">
              {bn ? 'অ্যাডমিন লগইন মোড' : 'Admin Login Mode'}
            </label>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setAdminLoginModeDraft('fast_alert')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                  adminLoginModeDraft === 'fast_alert'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {bn ? 'ফাস্ট অ্যালার্ট' : 'Fast Alert'}
              </button>
              <button
                type="button"
                onClick={() => setAdminLoginModeDraft('strict_approval')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                  adminLoginModeDraft === 'strict_approval'
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {bn ? 'কঠোর লক' : 'Strict Lock'}
              </button>
            </div>
          </div>

          <button
            type="button"
            disabled={securityPolicyBusy}
            onClick={() => {
              const am = Math.min(20, Math.max(0, Number(adminMobileDraft) || 0));
              const aw = Math.min(20, Math.max(0, Number(adminWebDraft) || 0));
              onSaveAdminSecuritySettings({
                adminMobileLimit: am,
                adminWebLimit: aw,
                adminLoginMode: adminLoginModeDraft,
              });
            }}
            className="py-2 px-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{bn ? 'অ্যাডমিন নীতি সেভ' : 'Save Admin Policy'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
