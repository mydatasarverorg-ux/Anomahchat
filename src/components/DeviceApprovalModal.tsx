import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { QrScannerModal } from './QrScannerModal';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  Laptop,
  Loader2,
  Lock,
  Mail,
  MapPin,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  XCircle,
} from 'lucide-react';

export function DeviceApprovalModal() {
  const {
    user,
    pendingApprovalSessions,
    publicAuthFlags,
    hasPasswordProvider,
    approvePendingDevice,
    approveDeviceByQr,
    rejectPendingDevice,
    sendPasswordReset,
  } = useAuth();
  const { language } = useLanguage();

  const [step, setStep] = useState<'choice' | 'verify_reject' | 'rejected_done'>('choice');
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showFallbackForm, setShowFallbackForm] = useState(false);
  const [fallbackSecret, setFallbackSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [blockedDeviceLabel, setBlockedDeviceLabel] = useState('');

  const targetSession = pendingApprovalSessions[0] || null;
  const targetDeviceId = targetSession?.deviceId || '';

  useEffect(() => {
    if (step !== 'rejected_done') {
      setStep('choice');
      setPasswordInput('');
      setShowFallbackForm(false);
      setFallbackSecret('');
      setError(null);
      setResetEmailSent(false);
    }
  }, [targetDeviceId]);

  if (!targetSession && step !== 'rejected_done') {
    return null;
  }

  const runtimeLabel =
    targetSession?.runtimeType === 'apk'
      ? 'Android APK'
      : targetSession?.runtimeType === 'pwa'
      ? 'Installed PWA'
      : 'Web / PC Browser';

  const platformBadge =
    targetSession?.platformCategory === 'mobile'
      ? language === 'bn'
        ? 'মোবাইল'
        : 'Mobile'
      : language === 'bn'
      ? 'ওয়েব / পিসি'
      : 'PC / Web';

  const handleApprove = async () => {
    if (!targetSession) return;
    setBusy(true);
    setError(null);
    try {
      await approvePendingDevice(targetSession.deviceId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : language === 'bn'
          ? 'অনুমোদন দেওয়া সম্ভব হয়নি।'
          : 'Failed to approve login.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmRejectWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSession) return;
    setBusy(true);
    setError(null);
    try {
      await rejectPendingDevice(targetSession.deviceId, { password: passwordInput });
      setBlockedDeviceLabel(targetSession.deviceLabel);
      setPasswordInput('');
      setStep('rejected_done');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : language === 'bn'
          ? 'যাচাই ব্যর্থ হয়েছে।'
          : 'Verification failed.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmRejectGoogle = async (verifyWithPopup: boolean) => {
    if (!targetSession) return;
    setBusy(true);
    setError(null);
    try {
      await rejectPendingDevice(
        targetSession.deviceId,
        verifyWithPopup
          ? { verifyGoogle: true }
          : {
              allowPopupFallback: true,
              ...(user?.hasAppLockPin
                ? { appLockPin: fallbackSecret }
                : { confirmedEmail: fallbackSecret }),
            }
      );
      setBlockedDeviceLabel(targetSession.deviceLabel);
      setFallbackSecret('');
      setShowFallbackForm(false);
      setStep('rejected_done');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : language === 'bn'
          ? 'যাচাই সম্পন্ন হয়নি।'
          : 'Verification failed.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSendResetLink = async () => {
    if (!user?.email) return;
    setBusy(true);
    setError(null);
    try {
      await sendPasswordReset(user.email);
      setResetEmailSent(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : language === 'bn'
          ? 'পাসওয়ার্ড রিসেট ইমেইল পাঠানো যায়নি।'
          : 'Failed to send password reset email.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[75] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in select-none">
      <div className="bg-slate-900 border border-amber-500/40 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 relative overflow-hidden">
        {step === 'choice' && targetSession && (
          <>
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    {language === 'bn'
                      ? 'নতুন ডিভাইস থেকে লগইনের চেষ্টা!'
                      : 'New Device Login Alert!'}
                  </h3>
                  {pendingApprovalSessions.length > 1 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                      1 / {pendingApprovalSessions.length}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  {language === 'bn'
                    ? 'আপনার অ্যাকাউন্টে নতুন একটি ডিভাইস প্রবেশ করার অনুমতি চাইছে। এটি কি আপনি?'
                    : 'Another device is attempting to access your account. Was this you?'}
                </p>
              </div>
            </div>

            {/* Session Info Card */}
            <div className="p-4 bg-slate-950/90 border border-slate-800 rounded-2xl space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {targetSession.platformCategory === 'mobile' ? (
                    <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Laptop className="w-4 h-4 text-sky-400 shrink-0" />
                  )}
                  <span className="font-bold text-white truncate">
                    {targetSession.deviceLabel}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10px] font-semibold text-slate-200 shrink-0">
                  {platformBadge} · {runtimeLabel}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-1.5 text-[11px] text-slate-300 pt-1 border-t border-slate-800/70">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    <strong className="text-slate-400 font-medium">
                      {language === 'bn' ? 'সম্ভাব্য অবস্থান: ' : 'Location: '}
                    </strong>
                    {targetSession.approxLocation ||
                      (language === 'bn' ? 'নেটওয়ার্ক থেকে পাওয়া যায়নি' : 'Unavailable')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>
                    <strong className="text-slate-400 font-medium">
                      {language === 'bn' ? 'লগইনের সময়: ' : 'Attempt Time: '}
                    </strong>
                    {new Date(
                      targetSession.loginAt || targetSession.createdAt
                    ).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}
                  </span>
                </div>
              </div>

              {targetSession.limitBlocked && (
                <div className="p-2.5 rounded-xl bg-amber-950/35 border border-amber-500/35 text-[11px] text-amber-200 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    {language === 'bn'
                      ? 'এই ক্যাটাগরিতে আপনার ডিভাইস সীমা পূর্ণ। "হ্যাঁ, এটা আমি" দিলে পুরোনো সেশনটি স্বয়ংক্রিয়ভাবে লগ-আউট হয়ে নতুনটি চালু হবে।'
                      : 'Device limit reached for this category. Approving will automatically log out the older session.'}
                  </span>
                </div>
              )}
            </div>

            {error && (
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                disabled={busy}
                onClick={handleApprove}
                className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition shadow"
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>
                  {language === 'bn' ? 'হ্যাঁ, এটা আমি (অনুমোদন)' : "Yes, It's Me (Approve)"}
                </span>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setError(null);
                  setStep('verify_reject');
                }}
                className="py-2.5 px-3 bg-rose-600/90 hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition shadow"
              >
                <XCircle className="w-4 h-4" />
                <span>
                  {language === 'bn' ? 'না, এটা আমি না (ব্লক)' : 'No, Not Me (Block)'}
                </span>
              </button>
            </div>

            {publicAuthFlags.enableQrDeviceApproval && targetSession.approvalChallenge && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setError(null);
                  setShowQrScanner(true);
                }}
                className="w-full py-2 px-3 bg-slate-800/90 hover:bg-slate-800 disabled:opacity-50 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                <QrCode className="w-4 h-4 text-emerald-400" />
                <span>
                  {language === 'bn'
                    ? 'অথবা নতুন পিসির QR কোড স্ক্যান করে অনুমোদন দিন'
                    : 'Or Scan QR Code on New Device to Approve'}
                </span>
              </button>
            )}
          </>
        )}

        {step === 'verify_reject' && targetSession && (
          <>
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep('choice');
                }}
                className="flex items-center gap-1 text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{language === 'bn' ? 'পিছনে যান' : 'Back'}</span>
              </button>
              <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                {language === 'bn' ? 'মালিকানা যাচাই ও ব্লক' : 'Verify & Block Login'}
              </span>
            </div>

            <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-2xl text-xs text-slate-200 leading-relaxed">
              {language === 'bn' ? (
                <>
                  ভুলবশত নিজের ডিভাইস বন্ধ হওয়া আটকাতে আপনার পরিচয় যাচাই করুন। যাচাই সম্পন্ন হলে{' '}
                  <strong className="text-white">{targetSession.deviceLabel}</strong> সাথে সাথে লগ-আউট ও ব্লক হয়ে যাবে।
                </>
              ) : (
                <>
                  Confirm your identity so your own device is never locked out by mistake. Once verified,{' '}
                  <strong className="text-white">{targetSession.deviceLabel}</strong> will be blocked immediately.
                </>
              )}
            </div>

            {error && (
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
                {error}
              </div>
            )}

            {hasPasswordProvider ? (
              <form onSubmit={handleConfirmRejectWithPassword} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 block">
                    {language === 'bn'
                      ? 'আপনার বর্তমান অ্যাকাউন্ট পাসওয়ার্ড দিন'
                      : 'Enter Your Account Password'}
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-9 pr-9 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {user?.email && (
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <button
                      type="button"
                      disabled={busy || resetEmailSent}
                      onClick={handleSendResetLink}
                      className="text-sky-400 hover:underline disabled:opacity-50 cursor-pointer flex items-center gap-1"
                    >
                      <Mail className="w-3 h-3" />
                      <span>
                        {resetEmailSent
                          ? language === 'bn'
                            ? 'পাসওয়ার্ড রিসেট ইমেইল পাঠানো হয়েছে!'
                            : 'Reset link sent to inbox!'
                          : language === 'bn'
                          ? 'পাসওয়ার্ড ভুলে গেছেন? রিসেট লিংক পাঠান'
                          : 'Forgot password? Send reset link'}
                      </span>
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy || !passwordInput.trim()}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition shadow"
                >
                  {busy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldAlert className="w-4 h-4" />
                  )}
                  <span>
                    {language === 'bn'
                      ? 'যাচাই করে ডিভাইসটি ব্লক ও লগআউট করুন'
                      : 'Verify & Block Unknown Device'}
                  </span>
                </button>
              </form>
            ) : (
              <div className="space-y-2.5">
                <p className="text-[11px] text-slate-400">
                  {language === 'bn'
                    ? 'আপনার অ্যাকাউন্টটি Google Sign-In দিয়ে খোলা। Google দিয়ে নিশ্চিত করে অচেনা ডিভাইসটি ব্লক করুন।'
                    : 'Your account uses Google Sign-In. Re-verify with Google to block this unknown device.'}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleConfirmRejectGoogle(true)}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition shadow"
                >
                  {busy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  <span>
                    {language === 'bn'
                      ? 'Google যাচাই করে ব্লক করুন'
                      : 'Verify with Google & Block'}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setError(null);
                    setShowFallbackForm((prev) => !prev);
                  }}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[11px] font-semibold cursor-pointer transition"
                >
                  {user?.hasAppLockPin
                    ? language === 'bn'
                      ? 'পপআপ না খুললে অ্যাপ-লক পিন দিয়ে ব্লক করুন'
                      : 'Verify with App-Lock PIN (If Popup Blocked)'
                    : language === 'bn'
                    ? 'পপআপ না খুললে ইমেইল নিশ্চিত করে ব্লক করুন'
                    : 'Confirm with Account Email (If Popup Blocked)'}
                </button>

                {showFallbackForm && (
                  <div className="p-2.5 bg-slate-950/90 border border-slate-800 rounded-xl space-y-2">
                    <input
                      type={user?.hasAppLockPin ? 'password' : 'email'}
                      inputMode={user?.hasAppLockPin ? 'numeric' : 'email'}
                      maxLength={user?.hasAppLockPin ? 6 : 150}
                      value={fallbackSecret}
                      onChange={(e) =>
                        setFallbackSecret(
                          user?.hasAppLockPin
                            ? e.target.value.replace(/\D/g, '').slice(0, 6)
                            : e.target.value
                        )
                      }
                      placeholder={
                        user?.hasAppLockPin
                          ? language === 'bn'
                            ? 'আপনার ৪-৬ ডিজিটের অ্যাপ-লক পিন'
                            : 'Enter 4-6 digit App-Lock PIN'
                          : language === 'bn'
                          ? 'আপনার অ্যাকাউন্ট ইমেইল লিখুন'
                          : 'Type your account email'
                      }
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500"
                    />
                    <button
                      type="button"
                      disabled={busy || !fallbackSecret.trim()}
                      onClick={() => handleConfirmRejectGoogle(false)}
                      className="w-full py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer transition"
                    >
                      {language === 'bn' ? 'যাচাই ও ব্লক করুন' : 'Verify & Block Device'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {step === 'rejected_done' && (
          <div className="space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-sm font-bold text-white">
                {language === 'bn'
                  ? 'অচেনা ডিভাইসটি সফলভাবে ব্লক ও লগ-আউট করা হয়েছে!'
                  : 'Unknown Device Blocked & Signed Out!'}
              </h4>
              <p className="text-xs text-slate-400">
                {language === 'bn'
                  ? `${blockedDeviceLabel || 'নতুন ডিভাইস'}-কে চ্যাট থেকে বের করে দেওয়া হয়েছে।`
                  : `${blockedDeviceLabel || 'The unrecognized device'} has been locked out.`}
              </p>
            </div>

            <div className="p-3.5 bg-amber-950/35 border border-amber-500/35 rounded-2xl text-left space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                <KeyRound className="w-4 h-4 shrink-0" />
                <span>
                  {language === 'bn'
                    ? 'জরুরি নিরাপত্তা পরামর্শ'
                    : 'Urgent Security Recommendation'}
                </span>
              </div>
              <p className="text-[11px] text-amber-100/90 leading-relaxed">
                {hasPasswordProvider
                  ? language === 'bn'
                    ? 'যেহেতু অন্য কেউ আপনার ইমেইল ও পাসওয়ার্ড জানে, অনুগ্রহ করে এখনই আপনার পাসওয়ার্ড পরিবর্তন করে নিন।'
                    : 'Since someone else had your email and password, please reset or update your password immediately.'
                  : language === 'bn'
                  ? 'আপনার মূল Google অ্যাকাউন্টের পাসওয়ার্ড ও ২-ধাপের সুরক্ষা (2FA) দ্রুত পরীক্ষা ও পরিবর্তন করে নিন।'
                  : 'Please review and secure your linked Google account password and 2-step verification immediately.'}
              </p>
              {hasPasswordProvider && user?.email && (
                <button
                  type="button"
                  disabled={busy || resetEmailSent}
                  onClick={handleSendResetLink}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white rounded-xl text-xs font-bold cursor-pointer transition flex items-center justify-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>
                    {resetEmailSent
                      ? language === 'bn'
                        ? 'পাসওয়ার্ড রিসেট ইমেইল পাঠানো হয়েছে!'
                        : 'Password Reset Email Sent!'
                      : language === 'bn'
                      ? 'এখনই পাসওয়ার্ড পরিবর্তন/রিসেট লিংক পাঠান'
                      : 'Send Password Reset Link Now'}
                  </span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setStep('choice')}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer transition"
            >
              {language === 'bn' ? 'ঠিক আছে, বন্ধ করুন' : 'Done'}
            </button>
          </div>
        )}
      </div>

      {showQrScanner && (
        <QrScannerModal
          mode="device_approve"
          onClose={() => setShowQrScanner(false)}
          onDeviceApproveQr={async (payload) => {
            setShowQrScanner(false);
            setBusy(true);
            setError(null);
            try {
              await approveDeviceByQr(payload);
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : language === 'bn'
                  ? 'QR কোড যাচাই করে অনুমোদন দেওয়া যায়নি।'
                  : 'Failed to approve device via QR code.'
              );
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </div>
  );
}
