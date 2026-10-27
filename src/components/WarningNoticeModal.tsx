import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { acknowledgeWarning } from '../services/adminService';
import { AlertCircle, ShieldAlert, CheckCircle2, Loader2 } from 'lucide-react';

export function WarningNoticeModal() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [submitting, setSubmitting] = useState(false);

  if (!user?.warningNotice || user.warningDismissed) {
    return null;
  }

  const handleAcknowledge = async () => {
    try {
      setSubmitting(true);
      await acknowledgeWarning(user.userId);
    } catch (err) {
      console.error('Failed to dismiss warning:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="max-w-md w-full bg-slate-900 border border-amber-500/40 rounded-3xl p-6 shadow-2xl relative space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white leading-tight">
              {t('warningNoticeTitle')}
            </h3>
            <p className="text-xs text-amber-300/90 mt-0.5">
              {t('warningNoticeSubtitle')}
            </p>
          </div>
        </div>

        {/* Notice Message Content */}
        <div className="bg-amber-950/20 border border-amber-600/30 rounded-2xl p-4 text-xs text-amber-100/90 leading-relaxed space-y-2">
          <div className="flex items-center gap-1.5 font-semibold text-amber-300 text-[11px] uppercase tracking-wider">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Administrator Warning</span>
          </div>
          <p className="whitespace-pre-wrap font-medium">"{user.warningNotice}"</p>
        </div>

        <div className="pt-2">
          <button
            onClick={handleAcknowledge}
            disabled={submitting}
            className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 rounded-xl text-xs font-bold transition cursor-pointer shadow flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>{t('warningAcknowledgeBtn')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
