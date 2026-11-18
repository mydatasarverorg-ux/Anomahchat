import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useModalHistory } from '../hooks/useModalHistory';
import { submitReport } from '../services/adminService';
import type { ReportReason } from '../types/chat';
import {
  ShieldAlert,
  X,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  MessageSquare,
  User,
} from 'lucide-react';

interface ReportModalProps {
  targetUserId: string;
  targetUserName: string;
  targetUserEmail?: string;
  chatId?: string;
  messageId?: string;
  messageText?: string;
  onClose: () => void;
}

export function ReportModal({
  targetUserId,
  targetUserName,
  targetUserEmail,
  chatId,
  messageId,
  messageText,
  onClose,
}: ReportModalProps) {
  const { user } = useAuth();
  const { t, language } = useLanguage();

  useModalHistory(true, onClose);

  const [reason, setReason] = useState<ReportReason>('harassment');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const isSelfReport = Boolean(user?.userId && user.userId === targetUserId);

  const reportReasons: { id: ReportReason; labelKey: any }[] = [
    { id: 'harassment', labelKey: 'reportReasonHarassment' },
    { id: 'hate_speech', labelKey: 'reportReasonHateSpeech' },
    { id: 'spam', labelKey: 'reportReasonSpam' },
    { id: 'scam', labelKey: 'reportReasonScam' },
    { id: 'inappropriate', labelKey: 'reportReasonInappropriate' },
    { id: 'impersonation', labelKey: 'reportReasonImpersonation' },
    { id: 'other', labelKey: 'reportReasonOther' },
  ];

  const extractReadableError = (err: unknown): string => {
    const fallback =
      language === 'bn'
        ? 'রিপোর্ট জমা দেওয়া যায়নি। দয়া করে ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।'
        : 'Could not submit report. Please check your connection and try again.';

    if (!(err instanceof Error) || !err.message) return fallback;
    try {
      const parsed = JSON.parse(err.message);
      if (parsed && typeof parsed.error === 'string' && parsed.error.trim()) {
        if (parsed.error.toLowerCase().includes('permission')) {
          return language === 'bn'
            ? 'নিরাপত্তা নীতির কারণে রিপোর্টটি গ্রহণ করা যায়নি।'
            : 'Report was rejected by security validation.';
        }
        return parsed.error;
      }
    } catch {
      // Plain error message
    }
    return err.message;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || submitting) return;
    if (isSelfReport) {
      setErrorMsg(
        language === 'bn'
          ? 'আপনি নিজের অ্যাকাউন্টের বিরুদ্ধে রিপোর্ট করতে পারবেন না।'
          : 'You cannot report your own account.'
      );
      return;
    }

    setErrorMsg(null);
    try {
      setSubmitting(true);
      await submitReport({
        reporterId: user.userId,
        reporterName: user.displayName || 'Anonymous User',
        reporterEmail: user.email || '',
        targetUserId,
        targetUserName,
        targetUserEmail,
        chatId,
        messageId,
        messageText,
        reason,
        details,
      });
      setSuccess(true);
      closeTimerRef.current = setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err) {
      console.error('Failed to submit report:', err);
      setErrorMsg(extractReadableError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5 text-red-400">
            <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{t('reportModalTitle')}</h3>
              <p className="text-[11px] text-slate-400">{t('reportModalSubtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <p className="text-xs text-slate-300 font-medium max-w-xs mx-auto">
              {t('reportSubmittedSuccess')}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Target Information Snippet */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 text-xs space-y-1.5">
              <div className="flex items-center gap-2 text-slate-300">
                <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-semibold text-white">{targetUserName}</span>
                {targetUserEmail && (
                  <span className="text-[10px] text-slate-500">({targetUserEmail})</span>
                )}
              </div>
              {messageText && (
                <div className="flex items-start gap-2 pt-1 border-t border-slate-800/80 text-[11px] text-slate-400">
                  <MessageSquare className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                  <p className="italic line-clamp-2 break-words">"{messageText}"</p>
                </div>
              )}
            </div>

            {isSelfReport && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {language === 'bn'
                    ? 'আপনি নিজের অ্যাকাউন্টের বিরুদ্ধে রিপোর্ট করতে পারবেন না।'
                    : 'You cannot submit a report against yourself.'}
                </span>
              </div>
            )}

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Reason Radio Group */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                {t('reportReasonLabel')}
              </label>
              <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {reportReasons.map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-center gap-2.5 p-2 rounded-xl text-xs cursor-pointer border transition ${
                      reason === item.id
                        ? 'bg-red-500/15 border-red-500/50 text-white font-medium'
                        : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reportReason"
                      value={item.id}
                      checked={reason === item.id}
                      onChange={() => setReason(item.id)}
                      className="accent-red-500 w-3.5 h-3.5"
                    />
                    <span>{t(item.labelKey)}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Additional Details */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 block">
                  {t('reportDetailsLabel')}
                </label>
                <span className="text-[10px] text-slate-500 font-mono">
                  {details.length}/2000
                </span>
              </div>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value.slice(0, 2000))}
                maxLength={2000}
                placeholder={t('reportDetailsPlaceholder')}
                rows={2}
                className="w-full p-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500/70 resize-none"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={submitting || isSelfReport}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-xs font-semibold text-white cursor-pointer shadow flex items-center gap-2"
              >
                {submitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5" />
                )}
                <span>{t('reportSubmitBtn')}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
