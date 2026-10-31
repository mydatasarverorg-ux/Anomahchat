import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { unbanUser } from '../services/adminService';
import { ShieldAlert, LogOut, Mail, Calendar, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';

export function BannedScreen() {
  const { user, signOutUser } = useAuth();
  const { t, language } = useLanguage();
  const [timeLeft, setTimeLeft] = useState<{
    expired: boolean;
    text: string;
  } | null>(null);
  const [isReactivating, setIsReactivating] = useState(false);

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
        // Automatically reinstate user when time is up
        if (!isReactivating && user) {
          setIsReactivating(true);
          unbanUser(user.userId, user.email, user.displayName, 'system_auto_reinstated').catch(console.error);
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
    const timer = setInterval(calculateTime, 30000); // Check every 30s
    return () => clearInterval(timer);
  }, [user, language, isReactivating]);

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
    <div className="min-h-screen w-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white relative overflow-hidden select-none">
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

        {/* Appeals Notice */}
        <div className="text-xs text-slate-400 space-y-1">
          <p>{t('bannedSupportHelp')}</p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 text-emerald-400 font-mono text-[11px] border border-slate-700/80">
            <Mail className="w-3 h-3" />
            <span>{t('bannedContactEmail')}</span>
          </div>
        </div>

        {/* Sign Out Button */}
        <div className="pt-2">
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
