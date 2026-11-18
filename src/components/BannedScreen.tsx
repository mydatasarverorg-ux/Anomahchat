import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  claimExpiredSuspension,
  submitRecoveryRequest,
  SUPPORT_DESK_ADDRESS,
} from '../services/adminService';
import {
  ShieldAlert,
  LogOut,
  Mail,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Send,
  Loader2,
  X,
} from 'lucide-react';

export function BannedScreen() {
  const { user, signOutUser } = useAuth();
  const { t, language } = useLanguage();
  const [timeLeft, setTimeLeft] = useState<{
    expired: boolean;
    text: string;
  } | null>(null);
  const reactivatingRef = useRef(false);

  // Appeal Support Ticket State
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [appealPhone, setAppealPhone] = useState(user?.phoneNumber || '');
  const [appealDetails, setAppealDetails] = useState('');
  const [submittingAppeal, setSubmittingAppeal] = useState(false);
  const [appealSubmittedId, setAppealSubmittedId] = useState<string | null>(null);
  const [appealError, setAppealError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.bannedUntil) {
      setTimeLeft(null);
      return;
    }

    const calculateTime = () => {
      const targetTime = new Date(user.bannedUntil!).getTime();
      const diffMs = targetTime - Date.now();

      if (diffMs <= 0) {
        setTimeLeft({ expired: true, text: '' });
        // Automatically reinstate user when temporary suspension timer expires (10s interval handles server-time skew)
        if (!reactivatingRef.current && user) {
          reactivatingRef.current = true;
          claimExpiredSuspension(user.userId).catch((err) => {
            console.warn('Temporary suspension expiry claim retry queued:', err);
            reactivatingRef.current = false;
          });
        }
        return;
      }

      const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
      const days = Math.floor(totalHours / 24);
      const hours = totalHours % 24;
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      let str = '';
      if (language === 'bn') {
        if (days > 0) str += `${days} দিন `;
        if (hours > 0 || days > 0) str += `${hours} ঘণ্টা `;
        str += `${minutes} মিনিট`;
      } else {
        if (days > 0) str += `${days}d `;
        if (hours > 0 || days > 0) str += `${hours}h `;
        str += `${minutes}m`;
      }

      setTimeLeft({ expired: false, text: str });
    };

    calculateTime();
    const timer = setInterval(calculateTime, 10000); // Check every 10s so server-time skew resolves quickly
    return () => clearInterval(timer);
  }, [user, language]);

  const formattedDate = user?.bannedAt
    ? new Date(user.bannedAt).toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  const formattedExpiryDate = user?.bannedUntil
    ? new Date(user.bannedUntil).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div className="min-h-screen w-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white relative overflow-hidden select-none safe-area-container">
      {/* Background radial accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6 text-center">
        {/* Shield Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div>
          <span className="inline-block px-3 py-1 bg-red-500/20 text-red-300 rounded-full text-[11px] font-bold tracking-wide uppercase mb-2 border border-red-500/30">
            {t('userStatusBanned')}
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {t('bannedScreenTitle')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
            {t('bannedScreenSubtitle')}
          </p>
        </div>

        {/* Reason and Duration Box */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 text-left space-y-3">
          <div className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{t('bannedReasonTitle')}</span>
          </div>
          <p className="text-xs text-slate-200 font-medium leading-relaxed bg-red-950/20 p-2.5 rounded-xl border border-red-900/30">
            "{user?.banReason || 'Violation of community safety terms.'}"
          </p>

          {/* Temporary Suspension Timer or Permanent Notice */}
          {user?.bannedUntil ? (
            <div className="pt-1 border-t border-slate-800/80 space-y-1.5">
              {timeLeft?.expired ? (
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/30 animate-pulse">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{t('suspensionExpiredNotice')}</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs text-amber-300 font-semibold bg-amber-500/10 px-3 py-2 rounded-xl border border-amber-500/20">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                      <span>{t('suspensionDurationLabel')}:</span>
                    </span>
                    <span className="font-mono font-bold">{timeLeft?.text}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 px-1 flex items-center justify-between">
                    <span>{t('suspensionExpiresAt', { date: formattedExpiryDate })}</span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="pt-1 border-t border-slate-800/80">
              <span className="text-[11px] text-red-400 font-semibold flex items-center gap-1.5">
                <ShieldAlert className="w-3 h-3" />
                <span>{t('suspensionPermanentNotice')}</span>
              </span>
            </div>
          )}

          {formattedDate && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-0.5">
              <Calendar className="w-3 h-3" />
              <span>
                {t('bannedDatePrefix')} {formattedDate}
              </span>
            </div>
          )}
        </div>

        {/* Appeals Notice & In-App Appeal to support@anomah.me */}
        <div className="text-xs text-slate-400 space-y-2.5">
          <p>{t('bannedSupportHelp')}</p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 text-emerald-400 font-mono text-[11px] border border-slate-700/80">
            <Mail className="w-3.5 h-3.5" />
            <span>{SUPPORT_DESK_ADDRESS}</span>
          </div>

          {appealSubmittedId ? (
            <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl text-emerald-200 text-xs space-y-1 text-left">
              <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {language === 'bn'
                    ? `আপনার আপিল সফলভাবে ${SUPPORT_DESK_ADDRESS} ডেস্কে পাঠানো হয়েছে!`
                    : `Your appeal has been sent to ${SUPPORT_DESK_ADDRESS}!`}
                </span>
              </div>
              <p className="text-[11px] opacity-85 font-mono">Ticket ID: {appealSubmittedId}</p>
            </div>
          ) : showAppealForm ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!appealDetails.trim()) return;
                setSubmittingAppeal(true);
                setAppealError(null);
                try {
                  const id = await submitRecoveryRequest({
                    email: user?.email || '',
                    name: user?.displayName || undefined,
                    username: user?.username || undefined,
                    contactPhone: appealPhone.trim() || user?.phoneNumber || undefined,
                    details: `[Suspension / Ban Appeal | UID: ${user?.userId || 'unknown'}] ${appealDetails.trim()}`.slice(0, 1000),
                  });
                  setAppealSubmittedId(id);
                  setShowAppealForm(false);
                } catch (err: unknown) {
                  setAppealError(
                    err instanceof Error ? err.message : 'Failed to submit appeal.'
                  );
                } finally {
                  setSubmittingAppeal(false);
                }
              }}
              className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-left space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-white">
                  {language === 'bn'
                    ? `আপিল ফর্ম (${SUPPORT_DESK_ADDRESS})`
                    : `Suspension Appeal (${SUPPORT_DESK_ADDRESS})`}
                </span>
                <button
                  type="button"
                  onClick={() => setShowAppealForm(false)}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {appealError && (
                <div className="p-2 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-200 text-[11px]">
                  {appealError}
                </div>
              )}

              <input
                type="tel"
                maxLength={50}
                placeholder={language === 'bn' ? 'যোগাযোগের মোবাইল নম্বর' : 'Contact mobile number'}
                value={appealPhone}
                onChange={(e) => setAppealPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />

              <textarea
                rows={3}
                required
                maxLength={850}
                placeholder={
                  language === 'bn'
                    ? 'কেন এই সাসপেনশনটি ভুল হয়েছে বলে মনে করছেন তা স্পষ্টভাবে লিখুন...'
                    : 'Explain why you believe this suspension was a mistake or should be reviewed...'
                }
                value={appealDetails}
                onChange={(e) => setAppealDetails(e.target.value.slice(0, 850))}
                className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
              />

              <button
                type="submit"
                disabled={submittingAppeal || !appealDetails.trim()}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition shadow"
              >
                {submittingAppeal ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>
                  {language === 'bn' ? 'আপিল সাবমিট করুন' : 'Send Appeal to Support Desk'}
                </span>
              </button>
            </form>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => setShowAppealForm(true)}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow flex items-center justify-center gap-2"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {language === 'bn'
                    ? `আপিল পাঠান (${SUPPORT_DESK_ADDRESS})`
                    : `Appeal to ${SUPPORT_DESK_ADDRESS}`}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Sign Out Button */}
        <div className="pt-1">
          <button
            onClick={signOutUser}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow flex items-center justify-center gap-2 border border-slate-700 active:scale-95"
          >
            <LogOut className="w-4 h-4 text-red-400" />
            <span>{t('bannedSignOutBtn')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
