import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ShieldAlert, LogOut, Mail, Calendar, AlertTriangle } from 'lucide-react';

export function BannedScreen() {
  const { user, signOutUser } = useAuth();
  const { t, language } = useLanguage();

  const formattedDate = user?.bannedAt
    ? new Date(user.bannedAt).toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  return (
    <div className="min-h-screen w-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white relative overflow-hidden select-none">
      {/* Background radial accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-slate-900/90 border border-red-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10 space-y-6 text-center">
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

        {/* Reason Box */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-left space-y-2">
          <div className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{t('bannedReasonTitle')}</span>
          </div>
          <p className="text-xs text-slate-200 font-medium leading-relaxed bg-red-950/20 p-2.5 rounded-xl border border-red-900/30">
            "{user?.banReason || 'Violation of community safety terms.'}"
          </p>
          {formattedDate && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1">
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
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow flex items-center justify-center gap-2 border border-slate-700"
          >
            <LogOut className="w-4 h-4 text-red-400" />
            <span>{t('bannedSignOutBtn')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
