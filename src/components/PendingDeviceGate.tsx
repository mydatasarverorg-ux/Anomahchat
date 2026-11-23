import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { submitRecoveryRequest } from '../services/adminService';
import { buildDeviceApprovalQrString } from '../utils/accountShortcut';
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Laptop,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  QrCode,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

export function PendingDeviceGate() {
  const {
    user,
    currentDeviceSession,
    publicAuthFlags,
    refreshPendingDeviceQr,
    retryCurrentDeviceApproval,
    selfApproveCurrentDeviceWithPin,
    sendPasswordReset,
    signOutUser,
    hasPasswordProvider,
  } = useAuth();
  const { language } = useLanguage();

  const [pinInput, setPinInput] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const [retrying, setRetrying] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const autoRefreshLockRef = useRef(false);

  const [showSupportForm, setShowSupportForm] = useState(false);
  const [supportPhone, setSupportPhone] = useState(user?.phoneNumber || '');
  const [supportDetails, setSupportDetails] = useState('');
  const [supportBusy, setSupportBusy] = useState(false);
  const [supportTicketId, setSupportTicketId] = useState<string | null>(null);

  const isRejected = currentDeviceSession?.status === 'rejected';
  const qrFeatureEnabled = Boolean(
    user && currentDeviceSession && !isRejected && publicAuthFlags.enableQrDeviceApproval
  );
  const challenge = currentDeviceSession?.approvalChallenge || '';
  const challengeExpiresAtMs = currentDeviceSession?.approvalChallengeExpiresAtMs || 0;
  const remainingSeconds = Math.max(0, Math.ceil((challengeExpiresAtMs - nowMs) / 1000));

  useEffect(() => {
    if (!qrFeatureEnabled) return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [qrFeatureEnabled]);

  useEffect(() => {
    if (!qrFeatureEnabled || !user || !currentDeviceSession) {
      setQrDataUrl(null);
      return;
    }

    if (!challenge || remainingSeconds <= 0) {
      if (autoRefreshLockRef.current) return;
      autoRefreshLockRef.current = true;
      setQrBusy(true);
      refreshPendingDeviceQr()
        .catch(() => {})
        .finally(() => {
          setQrBusy(false);
          setTimeout(() => {
            autoRefreshLockRef.current = false;
          }, 1500);
        });
      return;
    }

    const qrString = buildDeviceApprovalQrString({
      userId: user.userId,
      deviceId: currentDeviceSession.deviceId,
      challenge,
      expiresAtMs: challengeExpiresAtMs,
    });
    let cancelled = false;
    QRCode.toDataURL(qrString, {
      width: 220,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [
    qrFeatureEnabled,
    user?.userId,
    currentDeviceSession?.deviceId,
    challenge,
    challengeExpiresAtMs,
    remainingSeconds <= 0,
    refreshPendingDeviceQr,
  ]);

  if (!user || !currentDeviceSession) return null;

  const runtimeBadge =
    currentDeviceSession.runtimeType === 'apk'
      ? 'Android APK'
      : currentDeviceSession.runtimeType === 'pwa'
      ? 'Installed PWA'
      : 'Web Browser';

  const handlePinApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.length < 4) return;
    setPinBusy(true);
    setPinError(null);
    try {
      const res = await selfApproveCurrentDeviceWithPin(pinInput);
      if (!res.success) {
        setPinError(
          res.error || (language === 'bn' ? 'পিন সঠিক নয়।' : 'Incorrect App-Lock PIN.')
        );
        setPinInput('');
      }
    } catch (err) {
      setPinError(
        err instanceof Error
          ? err.message
          : language === 'bn'
          ? 'যাচাই করতে সমস্যা হয়েছে।'
          : 'Failed to verify PIN.'
      );
    } finally {
      setPinBusy(false);
    }
  };

  const handleRetryApproval = async () => {
    setRetrying(true);
    setActionError(null);
    setActionMessage(null);
    try {
      await retryCurrentDeviceApproval();
      setActionMessage(
        language === 'bn'
          ? 'মূল ডিভাইসে পুনরায় অনুমোদনের অনুরোধ পাঠানো হয়েছে।'
          : 'Approval request re-sent to your active trusted device.'
      );
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to send approval request right now.'
      );
    } finally {
      setRetrying(false);
    }
  };

  const handleSendPasswordReset = async () => {
    if (!user.email) return;
    setResetBusy(true);
    setActionError(null);
    try {
      await sendPasswordReset(user.email);
      setResetSent(true);
      setActionMessage(
        language === 'bn'
          ? `${user.email} ঠিকানায় পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে।`
          : `Password reset link sent to ${user.email}.`
      );
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Could not send password reset email.'
      );
    } finally {
      setResetBusy(false);
    }
  };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupportBusy(true);
    setActionError(null);
    try {
      const id = await submitRecoveryRequest({
        email: user.email,
        name: user.displayName,
        username: user.username,
        contactPhone: supportPhone.trim() || user.phoneNumber,
        topic: 'other',
        requesterUid: user.userId,
        details: `[New Device Approval Help | Device: ${currentDeviceSession.deviceLabel} (${currentDeviceSession.runtimeType})]\n${
          supportDetails.trim() ||
          'Need help verifying or unlocking new device session.'
        }`,
      });
      setSupportTicketId(id);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to submit support ticket.'
      );
    } finally {
      setSupportBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden select-none">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 relative z-10 max-h-[94vh] overflow-y-auto">
        {/* Top Security Icon & Title */}
        <div className="text-center space-y-2.5">
          <div
            className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center border shadow-md ${
              isRejected
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
            }`}
          >
            {isRejected ? (
              <ShieldAlert className="w-8 h-8" />
            ) : (
              <ShieldCheck className="w-8 h-8" />
            )}
          </div>

          <h2 className="text-lg font-bold text-white">
            {isRejected
              ? language === 'bn'
                ? 'এই ডিভাইস লগইন প্রত্যাখ্যান করা হয়েছে'
                : 'This Device Login Was Blocked'
              : language === 'bn'
              ? 'নতুন ডিভাইস অনুমোদনের অপেক্ষায়'
              : 'Waiting for Device Approval'}
          </h2>

          <p className="text-xs text-slate-400 leading-relaxed">
            {isRejected
              ? language === 'bn'
                ? 'আপনার মূল সক্রিয় ডিভাইস থেকে এই লগইনটি "এটা আমি না" হিসেবে চিহ্নিত করে বন্ধ করে দেওয়া হয়েছে। আপনি যদি প্রকৃত মালিক হন, নিচের অপশন দিয়ে যাচাই করুন।'
                : 'Your primary active device marked this login as "Not Me" and blocked access. If you are the rightful owner, verify below.'
              : language === 'bn'
              ? 'আপনার অ্যাকাউন্টের সুরক্ষার জন্য এই নতুন ডিভাইসটি কোয়ারেন্টাইনে রাখা হয়েছে। মূল ডিভাইসে যাওয়া নোটিফিকেশন থেকে "হ্যাঁ, এটা আমি" চাপলেই চ্যাট খুলে যাবে।'
              : 'For your security, this device is in quarantine. Tap "Yes, It\'s Me" on the alert sent to your active device to unlock your chats.'}
          </p>
        </div>

        {/* Waiting Live Pulse */}
        {!isRejected && (
          <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-xs text-emerald-200">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0" />
            <span>
              {language === 'bn'
                ? 'মূল ডিভাইসের অনুমোদনের জন্য রিয়েল-টাইমে অপেক্ষা করা হচ্ছে...'
                : 'Listening in real time for approval from your trusted device...'}
            </span>
          </div>
        )}

        {/* QR Code Instant Device Verification Card (Admin Controlled) */}
        {qrFeatureEnabled && (
          <div className="p-4 bg-slate-950/90 border border-emerald-500/35 rounded-2xl space-y-3 text-center">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                <QrCode className="w-4 h-4 shrink-0" />
                <span>
                  {language === 'bn'
                    ? 'QR স্ক্যান করে ১ ক্লিকে লগইন'
                    : '1-Scan QR Device Approval'}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-mono font-bold text-emerald-300">
                {`${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(
                  remainingSeconds % 60
                ).padStart(2, '0')}`}
              </span>
            </div>

            <div className="mx-auto w-44 h-44 bg-white rounded-2xl p-2 flex items-center justify-center shadow-lg">
              {qrDataUrl && !qrBusy ? (
                <img
                  src={qrDataUrl}
                  alt="Device Approval QR"
                  className="w-full h-full object-contain rounded-lg"
                />
              ) : (
                <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
              )}
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              {language === 'bn'
                ? 'আপনার সক্রিয় ফোন/অ্যাপ থেকে প্রোফাইল → নিরাপত্তা → "Scan PC QR" অথবা মূল QR স্ক্যানার দিয়ে স্ক্যান করলেই সাথে সাথে চ্যাট খুলে যাবে।'
                : 'Scan this code from your trusted phone (Settings → Security → Scan PC QR or main QR Scanner) to unlock instantly.'}
            </p>

            <button
              type="button"
              disabled={qrBusy}
              onClick={async () => {
                setQrBusy(true);
                try {
                  await refreshPendingDeviceQr();
                } finally {
                  setQrBusy(false);
                }
              }}
              className="mx-auto px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition border border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${qrBusy ? 'animate-spin' : ''}`} />
              <span>{language === 'bn' ? 'নতুন QR তৈরি করুন' : 'Refresh QR Code'}</span>
            </button>
          </div>
        )}

        {/* Current Quarantined Device Details */}
        <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {currentDeviceSession.platformCategory === 'mobile' ? (
                <Smartphone className="w-4 h-4 text-sky-400 shrink-0" />
              ) : (
                <Laptop className="w-4 h-4 text-sky-400 shrink-0" />
              )}
              <span className="font-bold text-white truncate">
                {currentDeviceSession.deviceLabel}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30 shrink-0">
              {runtimeBadge}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-500" />
              <span>
                {currentDeviceSession.approxLocation ||
                  (language === 'bn' ? 'অবস্থান অজানা' : 'Location unavailable')}
              </span>
            </span>
            <span>
              {new Date(
                currentDeviceSession.loginAt || currentDeviceSession.createdAt
              ).toLocaleTimeString(language === 'bn' ? 'bn-BD' : 'en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>

          {currentDeviceSession.limitBlocked && (
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>
                {language === 'bn'
                  ? 'এই ক্যাটাগরিতে আপনার ডিভাইস সীমা পূর্ণ রয়েছে। অনুমোদন পেলে পুরোনো ডিভাইসটি স্বয়ংক্রিয়ভাবে লগ-আউট হয়ে যাবে।'
                  : 'Your device limit for this platform is full. Approving this session will automatically sign out the older one.'}
              </span>
            </div>
          )}
        </div>

        {actionMessage && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{actionMessage}</span>
          </div>
        )}

        {actionError && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
            {actionError}
          </div>
        )}

        {/* Retry Button if Rejected */}
        {isRejected && (
          <button
            type="button"
            onClick={handleRetryApproval}
            disabled={retrying}
            className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition shadow"
          >
            {retrying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span>
              {language === 'bn'
                ? 'ভুলবশত ব্লক হলে পুনরায় অনুমোদনের অনুরোধ পাঠান'
                : 'Accidental Block? Request Approval Again'}
            </span>
          </button>
        )}

        {/* Self-Verify with App-Lock PIN (Backup if user doesn't have the other device nearby) */}
        {user.hasAppLockPin && (
          <form
            onSubmit={handlePinApprove}
            className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2.5"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {language === 'bn'
                  ? 'পুরোনো ফোন কাছে না থাকলে অ্যাপ-লক পিন দিয়ে যাচাই করুন'
                  : 'Old device unavailable? Verify with your App-Lock PIN'}
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                inputMode="numeric"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder={language === 'bn' ? '৪-৬ ডিজিটের পিন' : '4-6 digit PIN'}
                maxLength={6}
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono tracking-widest focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={pinBusy || pinInput.length < 4}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer transition"
              >
                {pinBusy
                  ? '...'
                  : language === 'bn'
                  ? 'যাচাই'
                  : 'Verify'}
              </button>
            </div>
            {pinError && <p className="text-[11px] text-rose-400">{pinError}</p>}
          </form>
        )}

        {/* Password Reset & Support Recovery */}
        <div className="space-y-2 pt-1 border-t border-slate-800/80">
          {hasPasswordProvider && user.email && (
            <button
              type="button"
              onClick={handleSendPasswordReset}
              disabled={resetBusy || resetSent}
              className="w-full py-2 px-3 bg-slate-800/90 hover:bg-slate-800 disabled:opacity-50 text-sky-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition border border-slate-700"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>
                {resetSent
                  ? language === 'bn'
                    ? 'রিসেট লিংক পাঠানো হয়েছে'
                    : 'Reset Email Sent'
                  : language === 'bn'
                  ? 'ইমেইলে পাসওয়ার্ড রিসেট লিংক পাঠান'
                  : 'Send Password Reset Email'}
              </span>
            </button>
          )}

          {!showSupportForm ? (
            <button
              type="button"
              onClick={() => setShowSupportForm(true)}
              className="w-full py-1.5 text-[11px] text-slate-400 hover:text-emerald-400 cursor-pointer transition text-center"
            >
              {language === 'bn'
                ? 'কোনো ডিভাইসই অ্যাক্সেস করতে পারছেন না? অ্যাডমিন সাপোর্টে জানান'
                : 'Cannot access any device? Contact Support Admin'}
            </button>
          ) : supportTicketId ? (
            <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-center text-xs text-emerald-300 space-y-1">
              <div className="font-bold">
                {language === 'bn'
                  ? 'সাপোর্ট টিকিট পাঠানো হয়েছে'
                  : 'Support Ticket Submitted'}
              </div>
              <div className="font-mono text-[10px] text-slate-400">
                ID: {supportTicketId}
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleSupportSubmit}
              className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2"
            >
              <input
                type="tel"
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
                placeholder={
                  language === 'bn' ? 'যোগাযোগের মোবাইল নম্বর' : 'Contact mobile number'
                }
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
              <textarea
                rows={2}
                value={supportDetails}
                onChange={(e) => setSupportDetails(e.target.value)}
                placeholder={
                  language === 'bn'
                    ? 'সমস্যার সংক্ষিপ্ত বিবরণ লিখুন...'
                    : 'Briefly describe why you cannot approve from old device...'
                }
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white resize-none"
                required
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowSupportForm(false)}
                  className="flex-1 py-1.5 bg-slate-800 text-slate-300 rounded-xl text-xs cursor-pointer"
                >
                  {language === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={supportBusy}
                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-1"
                >
                  <Send className="w-3 h-3" />
                  <span>{language === 'bn' ? 'পাঠান' : 'Submit'}</span>
                </button>
              </div>
            </form>
          )}

          <button
            type="button"
            onClick={signOutUser}
            className="w-full py-2.5 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>
              {language === 'bn' ? 'এই ডিভাইস থেকে লগ-আউট করুন' : 'Sign Out This Device'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
