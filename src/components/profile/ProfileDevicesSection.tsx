import { useState } from 'react';
import {
  Laptop,
  LogOut,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
  X,
  Eye,
  EyeOff,
  Mail,
} from 'lucide-react';
import type { AppSecuritySettings, DeviceSession, UserProfile } from '../../types/chat';

interface ProfileDevicesSectionProps {
  language: 'en' | 'bn';
  t: (key: any) => string;
  user: UserProfile | null;
  hasPasswordProvider: boolean;
  isVerifiedSuperAdmin: boolean;
  userSessions: DeviceSession[];
  currentDeviceId: string;
  deviceLimitsSummary: { mobile: number; web: number };
  globalSecuritySettings: AppSecuritySettings;
  publicAuthFlags: {
    enableMagicLinkLogin: boolean;
    enableQrDeviceApproval: boolean;
  };
  approvePendingDevice: (deviceId: string) => Promise<void>;
  acknowledgeAdminAlert: (deviceId: string, trustDevice: boolean) => Promise<void>;
  trustOrUntrustDevice: (deviceId: string, trust: boolean) => Promise<void>;
  forceLogoutOtherDevice: (deviceId: string) => Promise<void>;
  logoutAllOtherDevices: () => Promise<number>;
  removeDeviceHistoryItem: (deviceId: string) => Promise<void>;
  blockDeviceWithVerification: (
    deviceId: string,
    opts: {
      password?: string;
      verifyGoogle?: boolean;
      allowPopupFallback?: boolean;
      appLockPin?: string;
      confirmedEmail?: string;
    }
  ) => Promise<void>;
  updateOptionalDevice2FA: (enabled: boolean) => Promise<void>;
  onOpenQrScanner: () => void;
  qrApproveBusy: boolean;
  blockedWarningBanner: { label: string; resetSent: boolean } | null;
  onDismissBlockedBanner: () => void;
  onSendResetFromBlocked: () => Promise<void>;
  savingReset: boolean;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  onDeviceBlocked: (label: string) => void;
}

export function ProfileDevicesSection({
  language,
  t,
  user,
  hasPasswordProvider,
  isVerifiedSuperAdmin,
  userSessions,
  currentDeviceId,
  deviceLimitsSummary,
  globalSecuritySettings,
  publicAuthFlags,
  approvePendingDevice,
  acknowledgeAdminAlert,
  trustOrUntrustDevice,
  forceLogoutOtherDevice,
  logoutAllOtherDevices,
  removeDeviceHistoryItem,
  blockDeviceWithVerification,
  updateOptionalDevice2FA,
  onOpenQrScanner,
  qrApproveBusy,
  blockedWarningBanner,
  onDismissBlockedBanner,
  onSendResetFromBlocked,
  savingReset,
  onSuccess,
  onError,
  onDeviceBlocked,
}: ProfileDevicesSectionProps) {
  const bn = language === 'bn';
  const [toggling2FA, setToggling2FA] = useState(false);
  const [confirmLogoutAllOther, setConfirmLogoutAllOther] = useState(false);
  const [deviceBusyId, setDeviceBusyId] = useState<string | null>(null);
  const [blockTargetDeviceId, setBlockTargetDeviceId] = useState<string | null>(null);
  const [blockVerifyPassword, setBlockVerifyPassword] = useState('');
  const [blockShowPassword, setBlockShowPassword] = useState(false);
  const [showBlockFallbackInput, setShowBlockFallbackInput] = useState(false);
  const [blockFallbackSecret, setBlockFallbackSecret] = useState('');
  const [blockVerifyError, setBlockVerifyError] = useState<string | null>(null);

  const policyMode = globalSecuritySettings.newDeviceApprovalMode;
  const userEffective2FA =
    policyMode === 'required'
      ? true
      : policyMode === 'off'
      ? false
      : typeof user?.requireDeviceApproval === 'boolean'
      ? user.requireDeviceApproval
      : globalSecuritySettings.defaultOptionalApproval;
  const isOptionalMode = policyMode === 'optional';

  const activeSessions = userSessions.filter(
    (s) => s.status === 'active' || s.status === 'pending_approval'
  );
  const historySessions = userSessions.filter(
    (s) => s.status === 'rejected' || s.status === 'logged_out'
  );

  const activeM = userSessions.filter(
    (s) => s.status === 'active' && s.platformCategory === 'mobile'
  ).length;
  const activeW = userSessions.filter(
    (s) => s.status === 'active' && s.platformCategory === 'web'
  ).length;

  return (
    <div className="space-y-5">
      {/* Section Header */}
      <div className="pb-3 border-b border-slate-800">
        <h4 className="text-sm font-bold text-white">
          {bn ? 'সংযুক্ত ডিভাইস ও ২-ধাপের সুরক্ষা' : 'Connected Devices & 2FA'}
        </h4>
        <p className="text-xs text-slate-400 mt-0.5">
          {bn
            ? 'সক্রিয় সেশন পর্যালোচনা করুন, নতুন পিসি QR দিয়ে অনুমোদন দিন এবং অচেনা ডিভাইস ব্লক করুন।'
            : 'Manage active logins, approve new PCs via QR, and control two-factor device protection.'}
        </p>
      </div>

      {/* 2FA Toggle Row (Single-elevation flat 1px border) */}
      <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl flex items-center justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-white">
                {bn ? 'নতুন ডিভাইস লগইন সুরক্ষা (2FA / QR)' : 'New Device Login Protection (2FA / QR)'}
              </span>
              <span className="text-[11px] font-medium text-slate-400">
                ·{' '}
                {policyMode === 'required'
                  ? bn
                    ? 'অ্যাডমিন থেকে বাধ্যতামূলক'
                    : 'Required by Admin'
                  : policyMode === 'off'
                  ? bn
                    ? 'অ্যাডমিন থেকে বন্ধ'
                    : 'Off by Admin'
                  : bn
                  ? 'ঐচ্ছিক'
                  : 'Optional'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              {policyMode === 'required'
                ? bn
                  ? 'সকল নতুন ডিভাইস/PC লগইনে QR স্ক্যান বা অনুমোদন বাধ্যতামূলক।'
                  : 'New device logins require QR scan or trusted-device approval for all accounts.'
                : policyMode === 'off'
                ? bn
                  ? 'বর্তমানে নতুন ডিভাইস 2FA যাচাই বন্ধ রয়েছে (শুধু কোটা পূর্ণ হলে অনুমোদন চাইবে)।'
                  : '2FA quarantine is off (approval only triggers when your device quota is full).'
                : userEffective2FA
                ? bn
                  ? 'চালু আছে: নতুন ফোন বা পিসিতে লগইনে আপনার মূল ডিভাইসের অনুমোদন লাগবে।'
                  : 'Enabled: Logins on any new phone or PC require QR scan or 1-tap approval.'
                : bn
                ? 'বন্ধ আছে: চাইলে চালু করুন—তাহলে অজানা ডিভাইস থেকে কেউ অনুমতি ছাড়া ঢুকতে পারবে না।'
                : 'Off: Enable so logins on any new phone or PC require your QR scan or approval.'}
            </p>
          </div>
        </div>

        {isOptionalMode ? (
          <button
            type="button"
            role="switch"
            aria-checked={userEffective2FA}
            disabled={toggling2FA}
            onClick={async () => {
              setToggling2FA(true);
              try {
                const nextVal = !userEffective2FA;
                await updateOptionalDevice2FA(nextVal);
                onSuccess(
                  nextVal
                    ? bn
                      ? 'নতুন ডিভাইস 2FA/QR সুরক্ষা চালু করা হয়েছে!'
                      : 'New device 2FA/QR protection enabled!'
                    : bn
                    ? 'নতুন ডিভাইস 2FA/QR সুরক্ষা বন্ধ করা হয়েছে।'
                    : 'New device 2FA/QR protection turned off.'
                );
              } catch (err) {
                onError(
                  err instanceof Error
                    ? err.message
                    : bn
                    ? 'সেটিংস আপডেট করা যায়নি।'
                    : 'Failed to update 2FA setting.'
                );
              } finally {
                setToggling2FA(false);
              }
            }}
            className={`w-11 h-6 rounded-full transition relative shrink-0 cursor-pointer disabled:opacity-50 ${
              userEffective2FA ? 'bg-emerald-500' : 'bg-slate-700'
            }`}
          >
            <span
              className={`block w-4 h-4 bg-white rounded-full shadow transition-transform ${
                userEffective2FA ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        ) : (
          <span className="text-[11px] font-semibold text-slate-300 shrink-0 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
            {userEffective2FA ? (bn ? 'সক্রিয়' : 'ON') : bn ? 'নিষ্ক্রিয়' : 'OFF'}
          </span>
        )}
      </div>

      {/* Active & Pending Devices Panel (Flat container with 1px hairline rows) */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden">
        {/* Toolbar Header */}
        <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-white">
              {bn ? 'সক্রিয় ও অপেক্ষমাণ ডিভাইস' : 'Active & Pending Sessions'}
            </span>
            <span className="text-[11px] font-mono tabular-nums text-slate-400">
              {bn
                ? `মোবাইল ${activeM}/${deviceLimitsSummary.mobile} · ওয়েব ${activeW}/${deviceLimitsSummary.web}`
                : `Mobile ${activeM}/${deviceLimitsSummary.mobile} · Web ${activeW}/${deviceLimitsSummary.web}`}
            </span>
            {isVerifiedSuperAdmin && (
              <span className="text-[10px] font-semibold text-sky-400">
                · {bn ? 'সুপার অ্যাডমিন কোটা' : 'Super Admin Quota'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {publicAuthFlags.enableQrDeviceApproval && (
              <button
                type="button"
                disabled={qrApproveBusy}
                onClick={onOpenQrScanner}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap shrink-0"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>{bn ? 'PC QR স্ক্যান' : 'Scan PC QR'}</span>
              </button>
            )}

            {userSessions.some(
              (s) =>
                s.deviceId !== currentDeviceId &&
                (s.status === 'active' || s.status === 'pending_approval')
            ) &&
              !confirmLogoutAllOther && (
                <button
                  type="button"
                  onClick={() => setConfirmLogoutAllOther(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-rose-300 border border-slate-800 text-[11px] font-semibold cursor-pointer transition whitespace-nowrap shrink-0"
                >
                  {bn ? 'অন্য সব লগ-আউট' : 'Log Out All Other'}
                </button>
              )}
          </div>
        </div>

        {/* Confirm Log Out All Other */}
        {confirmLogoutAllOther && (
          <div className="px-4 py-3 bg-rose-950/25 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-rose-200">
              {bn
                ? 'এই ডিভাইস বাদে বাকি সব সক্রিয় ডিভাইস থেকে লগ-আউট করতে চান?'
                : 'Sign out every other device except this one?'}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setConfirmLogoutAllOther(false)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-[11px] font-medium cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={deviceBusyId === '__all__'}
                onClick={async () => {
                  setDeviceBusyId('__all__');
                  try {
                    const count = await logoutAllOtherDevices();
                    setConfirmLogoutAllOther(false);
                    onSuccess(
                      bn
                        ? `${count}টি অন্য ডিভাইস থেকে লগ-আউট সম্পন্ন হয়েছে।`
                        : `Signed out ${count} other device(s).`
                    );
                  } catch (err) {
                    onError(
                      err instanceof Error
                        ? err.message
                        : bn
                        ? 'অন্যান্য ডিভাইস লগ-আউট করা যায়নি।'
                        : 'Failed to log out other devices.'
                    );
                  } finally {
                    setDeviceBusyId(null);
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold cursor-pointer"
              >
                {bn ? 'সব লগ-আউট করুন' : 'Confirm Sign Out'}
              </button>
            </div>
          </div>
        )}

        {/* Blocked Unknown Device Warning Banner */}
        {blockedWarningBanner && (
          <div className="px-4 py-3 bg-amber-950/30 border-b border-slate-800 space-y-2 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 text-amber-200">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  {bn
                    ? `"${blockedWarningBanner.label}" ব্লক ও লগ-আউট হয়েছে। আপনার অ্যাকাউন্ট সুরক্ষিত রাখতে এখনই পাসওয়ার্ড পরিবর্তন করুন।`
                    : `"${blockedWarningBanner.label}" has been blocked and signed out. Change or reset your password immediately.`}
                </span>
              </div>
              <button
                type="button"
                onClick={onDismissBlockedBanner}
                className="text-slate-400 hover:text-white cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {hasPasswordProvider && user?.email && (
              <button
                type="button"
                disabled={savingReset || blockedWarningBanner.resetSent}
                onClick={onSendResetFromBlocked}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white rounded-lg text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>
                  {blockedWarningBanner.resetSent
                    ? bn
                      ? 'পাসওয়ার্ড রিসেট ইমেইল পাঠানো হয়েছে!'
                      : 'Password Reset Email Sent!'
                    : bn
                    ? 'ইমেইলে পাসওয়ার্ড রিসেট লিংক পাঠান'
                    : 'Send Password Reset Email'}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Active Sessions Hairline Rows */}
        {activeSessions.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-slate-400">
            {bn ? 'কোনো সক্রিয় ডিভাইস পাওয়া যায়নি।' : 'No active sessions recorded yet.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {activeSessions.map((sess) => {
              const isCurrent = sess.deviceId === currentDeviceId;
              const rtLabel =
                sess.runtimeType === 'apk'
                  ? 'APK'
                  : sess.runtimeType === 'pwa'
                  ? 'PWA'
                  : 'Web';
              const isVerifyingThisBlock = blockTargetDeviceId === sess.deviceId;
              const isBusy = deviceBusyId === sess.deviceId;

              const metaParts = [
                rtLabel,
                isCurrent ? (bn ? 'এই ডিভাইস' : 'This device') : null,
                sess.isPrimaryTrusted && sess.status === 'active'
                  ? bn
                    ? 'বিশ্বস্ত'
                    : 'Trusted'
                  : null,
                sess.approvalMethod === 'qr_scan' && sess.status === 'active' ? 'QR' : null,
              ].filter(Boolean);

              return (
                <div key={sess.deviceId} className="px-4 py-3 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
                        {sess.platformCategory === 'mobile' ? (
                          <Smartphone className="w-4 h-4" />
                        ) : (
                          <Laptop className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white truncate max-w-[200px]">
                            {sess.deviceLabel}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {metaParts.join(' · ')}
                          </span>
                          {sess.status === 'pending_approval' && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-semibold">
                              {bn ? 'অপেক্ষমাণ' : 'Pending'}
                            </span>
                          )}
                          {sess.adminAlertPending && sess.status === 'active' && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-semibold">
                              {bn ? 'নতুন লগইন' : 'New Login'}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 tabular-nums mt-0.5">
                          {sess.approxLocation ? `${sess.approxLocation} · ` : ''}
                          {bn ? 'সক্রিয়: ' : 'Active: '}
                          {new Date(sess.lastActiveAt || sess.createdAt).toLocaleString(
                            bn ? 'bn-BD' : 'en-US'
                          )}
                          {sess.loginAt && (
                            <span className="text-slate-500">
                              {' · '}
                              {bn ? 'লগইন: ' : 'Login: '}
                              {new Date(sess.loginAt).toLocaleString(bn ? 'bn-BD' : 'en-US')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {!isCurrent && (
                      <div className="flex items-center gap-1.5 flex-wrap shrink-0 sm:justify-end">
                        {sess.status === 'pending_approval' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={async () => {
                              setDeviceBusyId(sess.deviceId);
                              try {
                                await approvePendingDevice(sess.deviceId);
                                onSuccess(
                                  bn
                                    ? `${sess.deviceLabel} অনুমোদন দেওয়া হয়েছে।`
                                    : `Approved ${sess.deviceLabel}.`
                                );
                              } catch (err) {
                                onError(
                                  err instanceof Error
                                    ? err.message
                                    : bn
                                    ? 'ডিভাইস অনুমোদন দেওয়া যায়নি।'
                                    : 'Failed to approve device.'
                                );
                              } finally {
                                setDeviceBusyId(null);
                              }
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
                          >
                            <ShieldCheck className="w-3 h-3" />
                            <span>{bn ? 'অনুমোদন' : 'Approve'}</span>
                          </button>
                        )}

                        {sess.status === 'active' && sess.adminAlertPending && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={async () => {
                              setDeviceBusyId(sess.deviceId);
                              try {
                                await acknowledgeAdminAlert(sess.deviceId, true);
                              } catch (err) {
                                onError(
                                  err instanceof Error
                                    ? err.message
                                    : bn
                                    ? 'ডিভাইস বিশ্বস্ত হিসেবে সংরক্ষণ করা যায়নি।'
                                    : 'Failed to trust device.'
                                );
                              } finally {
                                setDeviceBusyId(null);
                              }
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
                          >
                            <ShieldCheck className="w-3 h-3" />
                            <span>{bn ? 'আমিই (বিশ্বস্ত)' : 'Trust'}</span>
                          </button>
                        )}

                        {sess.status === 'active' && !sess.adminAlertPending && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={async () => {
                              setDeviceBusyId(sess.deviceId);
                              try {
                                await trustOrUntrustDevice(
                                  sess.deviceId,
                                  !sess.isPrimaryTrusted
                                );
                              } catch (err) {
                                onError(
                                  err instanceof Error
                                    ? err.message
                                    : bn
                                    ? 'ডিভাইস ট্রাস্ট পরিবর্তন করা যায়নি।'
                                    : 'Failed to update device trust.'
                                );
                              } finally {
                                setDeviceBusyId(null);
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 cursor-pointer transition whitespace-nowrap"
                          >
                            {sess.isPrimaryTrusted
                              ? bn
                                ? 'আনট্রাস্ট'
                                : 'Untrust'
                              : bn
                              ? 'বিশ্বস্ত করুন'
                              : 'Trust'}
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={async () => {
                            setDeviceBusyId(sess.deviceId);
                            try {
                              await forceLogoutOtherDevice(sess.deviceId);
                              onSuccess(
                                bn
                                  ? `${sess.deviceLabel} থেকে সেশন লগ-আউট করা হয়েছে।`
                                  : `Logged out ${sess.deviceLabel}.`
                              );
                            } catch (err) {
                              onError(
                                err instanceof Error
                                  ? err.message
                                  : bn
                                  ? 'ডিভাইসটি লগ-আউট করা যায়নি।'
                                  : 'Failed to log out device.'
                              );
                            } finally {
                              setDeviceBusyId(null);
                            }
                          }}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-[11px] font-medium cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
                        >
                          <LogOut className="w-3 h-3" />
                          <span>{bn ? 'লগআউট' : 'Logout'}</span>
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            setBlockVerifyError(null);
                            setBlockVerifyPassword('');
                            setShowBlockFallbackInput(false);
                            setBlockFallbackSecret('');
                            setBlockTargetDeviceId(
                              isVerifyingThisBlock ? null : sess.deviceId
                            );
                          }}
                          className="px-2.5 py-1 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-lg text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
                        >
                          <ShieldAlert className="w-3 h-3" />
                          <span>{bn ? 'ব্লক' : 'Block'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Inline Owner Verification before Blocking */}
                  {!isCurrent && isVerifyingThisBlock && (
                    <div className="p-3 bg-rose-950/25 border border-rose-500/30 rounded-xl space-y-2">
                      <div className="flex items-center justify-between gap-2 text-[11px] text-rose-200 font-semibold">
                        <span>
                          {bn
                            ? 'মালিকানা যাচাই করে অচেনা ডিভাইসটি ব্লক করুন:'
                            : 'Verify ownership before blocking this device:'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setBlockTargetDeviceId(null);
                            setBlockVerifyPassword('');
                            setShowBlockFallbackInput(false);
                            setBlockFallbackSecret('');
                            setBlockVerifyError(null);
                          }}
                          className="text-slate-400 hover:text-white cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {blockVerifyError && (
                        <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-[11px] text-rose-300">
                          {blockVerifyError}
                        </div>
                      )}

                      {hasPasswordProvider ? (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="relative flex-1">
                            <input
                              type={blockShowPassword ? 'text' : 'password'}
                              value={blockVerifyPassword}
                              onChange={(e) => setBlockVerifyPassword(e.target.value)}
                              placeholder={
                                bn
                                  ? 'বর্তমান অ্যাকাউন্ট পাসওয়ার্ড দিন'
                                  : 'Enter account password'
                              }
                              className="w-full px-3 py-1.5 pr-8 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-rose-500"
                            />
                            <button
                              type="button"
                              onClick={() => setBlockShowPassword((p) => !p)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                            >
                              {blockShowPassword ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          <button
                            type="button"
                            disabled={isBusy || !blockVerifyPassword.trim()}
                            onClick={async () => {
                              setDeviceBusyId(sess.deviceId);
                              setBlockVerifyError(null);
                              try {
                                await blockDeviceWithVerification(sess.deviceId, {
                                  password: blockVerifyPassword,
                                });
                                setBlockTargetDeviceId(null);
                                setBlockVerifyPassword('');
                                onDeviceBlocked(sess.deviceLabel);
                              } catch (err) {
                                setBlockVerifyError(
                                  err instanceof Error ? err.message : 'Verification failed.'
                                );
                              } finally {
                                setDeviceBusyId(null);
                              }
                            }}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg text-[11px] font-semibold cursor-pointer shrink-0"
                          >
                            {bn ? 'যাচাই ও ব্লক করুন' : 'Verify & Block'}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={async () => {
                                setDeviceBusyId(sess.deviceId);
                                setBlockVerifyError(null);
                                try {
                                  await blockDeviceWithVerification(sess.deviceId, {
                                    verifyGoogle: true,
                                  });
                                  setBlockTargetDeviceId(null);
                                  setShowBlockFallbackInput(false);
                                  setBlockFallbackSecret('');
                                  onDeviceBlocked(sess.deviceLabel);
                                } catch (err) {
                                  setBlockVerifyError(
                                    err instanceof Error ? err.message : 'Verification failed.'
                                  );
                                } finally {
                                  setDeviceBusyId(null);
                                }
                              }}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg text-[11px] font-semibold cursor-pointer"
                            >
                              {bn ? 'Google দিয়ে যাচাই ও ব্লক' : 'Verify with Google & Block'}
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => {
                                setBlockVerifyError(null);
                                setShowBlockFallbackInput((prev) => !prev);
                              }}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-medium cursor-pointer"
                            >
                              {user?.hasAppLockPin
                                ? bn
                                  ? 'পিন দিয়ে যাচাই'
                                  : 'Use App-Lock PIN'
                                : bn
                                ? 'পপআপ ছাড়া ইমেইল যাচাই'
                                : 'Verify via Email'}
                            </button>
                          </div>

                          {showBlockFallbackInput && (
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input
                                type={user?.hasAppLockPin ? 'password' : 'email'}
                                inputMode={user?.hasAppLockPin ? 'numeric' : 'email'}
                                maxLength={user?.hasAppLockPin ? 6 : 150}
                                value={blockFallbackSecret}
                                onChange={(e) =>
                                  setBlockFallbackSecret(
                                    user?.hasAppLockPin
                                      ? e.target.value.replace(/\D/g, '').slice(0, 6)
                                      : e.target.value
                                  )
                                }
                                placeholder={
                                  user?.hasAppLockPin
                                    ? bn
                                      ? '৪-৬ ডিজিটের পিন'
                                      : '4-6 digit App-Lock PIN'
                                    : bn
                                    ? 'অ্যাকাউন্টের ইমেইল লিখুন'
                                    : 'Enter your account email'
                                }
                                className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-rose-500"
                              />
                              <button
                                type="button"
                                disabled={isBusy || !blockFallbackSecret.trim()}
                                onClick={async () => {
                                  setDeviceBusyId(sess.deviceId);
                                  setBlockVerifyError(null);
                                  try {
                                    await blockDeviceWithVerification(sess.deviceId, {
                                      allowPopupFallback: true,
                                      ...(user?.hasAppLockPin
                                        ? { appLockPin: blockFallbackSecret }
                                        : { confirmedEmail: blockFallbackSecret }),
                                    });
                                    setBlockTargetDeviceId(null);
                                    setShowBlockFallbackInput(false);
                                    setBlockFallbackSecret('');
                                    onDeviceBlocked(sess.deviceLabel);
                                  } catch (err) {
                                    setBlockVerifyError(
                                      err instanceof Error ? err.message : 'Verification failed.'
                                    );
                                  } finally {
                                    setDeviceBusyId(null);
                                  }
                                }}
                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg text-[11px] font-semibold cursor-pointer shrink-0"
                              >
                                {bn ? 'নিশ্চিত ও ব্লক' : 'Confirm & Block'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent & Blocked Session History */}
      {historySessions.length > 0 && (
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-800 text-[11px] font-semibold text-slate-400">
            {bn ? 'সাম্প্রতিক ও ব্লকড সেশন ইতিহাস' : 'Recent & Blocked Session History'}
          </div>
          <div className="divide-y divide-slate-800/80 max-h-52 overflow-y-auto">
            {historySessions.map((sess) => {
              const isRejected = sess.status === 'rejected';
              return (
                <div
                  key={sess.deviceId}
                  className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-200 truncate max-w-[180px]">
                        {sess.deviceLabel}
                      </span>
                      <span
                        className={`text-[10px] font-semibold ${
                          isRejected ? 'text-rose-400' : 'text-slate-400'
                        }`}
                      >
                        · {isRejected ? (bn ? 'ব্লকড' : 'Blocked') : bn ? 'লগ-আউট' : 'Logged Out'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 tabular-nums truncate">
                      {sess.approxLocation ? `${sess.approxLocation} · ` : ''}
                      {new Date(sess.lastActiveAt || sess.createdAt).toLocaleString(
                        bn ? 'bn-BD' : 'en-US'
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={deviceBusyId === sess.deviceId}
                    onClick={async () => {
                      setDeviceBusyId(sess.deviceId);
                      try {
                        await removeDeviceHistoryItem(sess.deviceId);
                      } catch (err) {
                        onError(
                          err instanceof Error
                            ? err.message
                            : bn
                            ? 'সেশন ইতিহাস মুছতে সমস্যা হয়েছে।'
                            : 'Failed to remove device record.'
                        );
                      } finally {
                        setDeviceBusyId(null);
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-rose-500/15 text-slate-300 hover:text-rose-300 border border-slate-800 text-[11px] font-medium cursor-pointer inline-flex items-center gap-1 shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>
                      {isRejected
                        ? bn
                          ? 'আনব্লক'
                          : 'Unblock'
                        : bn
                        ? 'মুছুন'
                        : 'Remove'}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
