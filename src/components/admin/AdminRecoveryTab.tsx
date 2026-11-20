import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  KeyRound,
  Lock,
  Mail,
  MailCheck,
  Phone,
  RotateCcw,
  Search,
  ShieldOff,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react';
import { SUPPORT_DESK_ADDRESS, doPhonesMatch } from '../../services/adminService';
import type { PasswordRecoveryRequest, RecoveryTopic, UserProfile } from '../../types/chat';

interface AdminRecoveryTabProps {
  t: (key: any) => string;
  language: 'en' | 'bn';
  usersList: UserProfile[];
  filteredRecovery: PasswordRecoveryRequest[];
  recoveryCounts: {
    all: number;
    pending: number;
    resolved: number;
    dismissed: number;
  };
  recoveryFilter: 'all' | 'pending' | 'resolved' | 'dismissed';
  setRecoveryFilter: (val: 'all' | 'pending' | 'resolved' | 'dismissed') => void;
  recoverySearch: string;
  setRecoverySearch: (val: string) => void;
  copiedText: string | null;
  onCopy: (text: string) => void;
  onOpenDossier: (targetUser: UserProfile) => void;
  onClearAppLock: (targetUser: UserProfile, ticketId?: string) => Promise<void>;
  onSendResetEmail: (targetEmail: string, ticketId: string) => Promise<void>;
  onDismiss: (reqId: string, notes?: string) => Promise<void>;
  onReopen: (reqId: string) => Promise<void>;
  onDelete: (reqId: string) => Promise<void>;
  onSelectResolve: (req: PasswordRecoveryRequest) => void;
}

type MatchSignal = 'uid' | 'email' | 'username' | 'phone';

interface ResolvedMatch {
  user?: UserProfile;
  matchedBy: MatchSignal[];
  hasEmailConflict: boolean;
}

export function AdminRecoveryTab({
  t,
  language,
  usersList,
  filteredRecovery,
  recoveryCounts,
  recoveryFilter,
  setRecoveryFilter,
  recoverySearch,
  setRecoverySearch,
  copiedText,
  onCopy,
  onOpenDossier,
  onClearAppLock,
  onSendResetEmail,
  onDismiss,
  onReopen,
  onDelete,
  onSelectResolve,
}: AdminRecoveryTabProps) {
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDismissId, setConfirmDismissId] = useState<string | null>(null);
  const [dismissNote, setDismissNote] = useState('');
  const [confirmResetId, setConfirmResetId] = useState<string | null>(null);

  const resolveMatchDetails = (req: PasswordRecoveryRequest): ResolvedMatch => {
    const cleanEmail = req.email?.trim().toLowerCase();
    const cleanUsername = req.username?.trim().replace(/^@/, '').toLowerCase();
    const uidFromDetails = req.details?.match(/UID:\s*([A-Za-z0-9_-]{6,128})/i)?.[1];
    const targetUid = req.requesterUid || (uidFromDetails && uidFromDetails !== 'unknown' ? uidFromDetails : undefined);

    const evaluateSignals = (u: UserProfile): MatchSignal[] => {
      const signals: MatchSignal[] = [];
      if (targetUid && u.userId === targetUid) signals.push('uid');
      if (cleanEmail && u.email?.trim().toLowerCase() === cleanEmail) signals.push('email');
      if (cleanUsername && u.username?.trim().toLowerCase() === cleanUsername) signals.push('username');
      if (doPhonesMatch(req.contactPhone, u.phoneNumber)) signals.push('phone');
      return signals;
    };

    let bestUser: UserProfile | undefined;
    let bestSignals: MatchSignal[] = [];
    let bestScore = 0;

    for (const u of usersList) {
      const signals = evaluateSignals(u);
      if (signals.length === 0) continue;
      // Score strongly favors authoritative UID or Email matches over partial handle/phone collisions
      const score =
        (signals.includes('uid') ? 100 : 0) +
        (signals.includes('email') ? 40 : 0) +
        (signals.includes('phone') ? 20 : 0) +
        (signals.includes('username') ? 15 : 0);
      if (score > bestScore) {
        bestScore = score;
        bestUser = u;
        bestSignals = signals;
      }
    }

    const hasEmailConflict = Boolean(
      bestUser &&
        cleanEmail &&
        cleanEmail.includes('@') &&
        bestUser.email?.trim() &&
        bestUser.email.trim().toLowerCase() !== cleanEmail
    );

    return {
      user: bestUser,
      matchedBy: bestSignals,
      hasEmailConflict,
    };
  };

  const inferTopic = (req: PasswordRecoveryRequest): RecoveryTopic => {
    if (req.topic) return req.topic;
    const d = (req.details || '').toLowerCase();
    if (d.includes('[app-lock')) return 'app_lock';
    if (d.includes('[lost email')) return 'lost_email';
    if (d.includes('[suspension')) return 'suspended';
    return 'other';
  };

  const getTopicMeta = (topic: RecoveryTopic) => {
    switch (topic) {
      case 'app_lock':
        return {
          label: language === 'bn' ? 'অ্যাপ-লক রিসেট' : 'App-Lock PIN',
          classes: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        };
      case 'lost_email':
        return {
          label: language === 'bn' ? 'ইমেইল/অ্যাক্সেস সমস্যা' : 'Lost Email',
          classes: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
        };
      case 'suspended':
        return {
          label: language === 'bn' ? 'সাসপেনশন আপিল' : 'Suspension Appeal',
          classes: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
        };
      default:
        return {
          label: language === 'bn' ? 'সাধারণ সহায়তা' : 'General Help',
          classes: 'bg-slate-800 text-slate-300 border-slate-700',
        };
    }
  };

  const getSignalLabel = (signal: MatchSignal) => {
    switch (signal) {
      case 'uid':
        return 'UID';
      case 'email':
        return language === 'bn' ? 'ইমেইল' : 'Email';
      case 'username':
        return '@username';
      case 'phone':
        return language === 'bn' ? 'ফোন' : 'Phone';
    }
  };

  const getStatusLabel = (status: PasswordRecoveryRequest['status']) => {
    if (status === 'pending') return t('recoveryStatusPending');
    if (status === 'resolved') return t('recoveryStatusResolved');
    return t('recoveryStatusDismissed');
  };

  const runBusy = async (id: string, fn: () => Promise<void>) => {
    if (busyIds[id]) return;
    setBusyIds((prev) => ({ ...prev, [id]: true }));
    try {
      await fn();
    } finally {
      setBusyIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-white">{t('recoveryDeskTitle')}</h3>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-[10px] font-bold">
              <Mail className="w-3 h-3" />
              <span>{SUPPORT_DESK_ADDRESS}</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{t('recoveryDeskSubtitle')}</p>
        </div>
        <div className="flex gap-1.5 text-xs overflow-x-auto scrollbar-none py-0.5">
          {(['all', 'pending', 'resolved', 'dismissed'] as const).map((tag) => {
            const count = recoveryCounts[tag];
            const label =
              tag === 'all'
                ? language === 'bn'
                  ? 'সব'
                  : 'All'
                : tag === 'pending'
                ? t('recoveryStatusPending')
                : tag === 'resolved'
                ? t('recoveryStatusResolved')
                : t('recoveryStatusDismissed');
            return (
              <button
                key={tag}
                onClick={() => setRecoveryFilter(tag)}
                className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer shrink-0 whitespace-nowrap flex items-center gap-1.5 ${
                  recoveryFilter === tag
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span>{label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    recoveryFilter === tag
                      ? 'bg-white/20 text-white'
                      : tag === 'pending' && count > 0
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search Bar for Support Tickets (email, @username, phone number, name, ticket ID) */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
        <input
          type="text"
          value={recoverySearch}
          onChange={(e) => setRecoverySearch(e.target.value)}
          placeholder={
            language === 'bn'
              ? 'ইমেইল, @ইউজারনেম, মোবাইল নম্বর, নাম বা টিকিট আইডি দিয়ে খুঁজুন...'
              : 'Search tickets by email, @username, mobile number, name, or ticket ID...'
          }
          className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
        />
      </div>

      {filteredRecovery.length === 0 ? (
        <div className="py-12 text-center text-slate-500 space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <p className="text-xs">{t('recoveryRequestsEmpty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRecovery.map((req) => {
            const match = resolveMatchDetails(req);
            const matchedUser = match.user;
            const topic = inferTopic(req);
            const topicMeta = getTopicMeta(topic);
            const targetEmail = matchedUser?.email || req.email;
            const primaryIdentifier =
              req.email ||
              req.contactPhone ||
              (req.username ? `@${req.username}` : req.name || req.id);
            const isBusy = Boolean(busyIds[req.id]);
            const needsResetConfirm =
              Boolean(targetEmail && targetEmail.includes('@')) &&
              (topic === 'lost_email' || match.hasEmailConflict);

            return (
              <div
                key={req.id}
                className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        req.status === 'resolved'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : req.status === 'dismissed'
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {getStatusLabel(req.status)}
                    </span>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${topicMeta.classes}`}>
                      {topicMeta.label}
                    </span>

                    <span className="text-xs font-bold text-white truncate max-w-[230px]">
                      {primaryIdentifier}
                    </span>

                    <button
                      type="button"
                      onClick={() => onCopy(primaryIdentifier)}
                      className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                      title={t('copy')}
                    >
                      {copiedText === primaryIdentifier ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>

                    {req.username && (
                      <span className="text-[11px] text-slate-400 font-mono">@{req.username}</span>
                    )}

                    {matchedUser ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1">
                        <UserCheck className="w-3 h-3" />
                        <span>
                          {language === 'bn' ? 'ম্যাচ: ' : 'Matched: '}
                          {match.matchedBy.map(getSignalLabel).join(' + ')}
                        </span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 inline-flex items-center gap-1">
                        <UserX className="w-3 h-3" />
                        {language === 'bn' ? 'ডাটাবেজে নেই' : 'Not Matched'}
                      </span>
                    )}

                    {matchedUser?.hasAppLockPin && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" />
                        {language === 'bn' ? 'অ্যাপ-লক চালু' : 'App-Lock Active'}
                      </span>
                    )}

                    {matchedUser?.isBanned && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        {t('userStatusBanned')}
                      </span>
                    )}

                    {req.resetEmailSentAt && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30 inline-flex items-center gap-1">
                        <MailCheck className="w-3 h-3" />
                        <span>
                          {language === 'bn' ? 'রিসেট পাঠানো হয়েছে' : 'Reset Sent'}
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <button
                      type="button"
                      onClick={() => onCopy(req.id)}
                      className="font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 hover:text-slate-300 cursor-pointer inline-flex items-center gap-1"
                      title={t('copy')}
                    >
                      <span>{req.id.slice(0, 14)}</span>
                      {copiedText === req.id ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                    </button>
                    <span>
                      {new Date(req.createdAt).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}
                    </span>
                  </div>
                </div>

                {match.hasEmailConflict && matchedUser && (
                  <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">
                      {language === 'bn'
                        ? `সতর্কতা: আবেদনের ইমেইল (${req.email}) ও অ্যাকাউন্টের মূল ইমেইল (${matchedUser.email}) ভিন্ন! অ্যাপ-লক রিসেট বা রিসেট লিংক পাঠানোর আগে ডসিয়ার ও ফোন নম্বর যাচাই করুন।`
                        : `Identity Check Warning: Submitted email (${req.email}) differs from matched account email (${matchedUser.email}). Verify ownership via Dossier/Phone before clearing App-Lock or sending resets.`}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 block font-semibold">
                      {t('applicantName')}:
                    </span>
                    <span className="text-white font-medium block">
                      {req.name || matchedUser?.displayName || 'Not specified'}
                    </span>
                    {(req.contactPhone || matchedUser?.phoneNumber) && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-0.5">
                        <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>
                          {req.contactPhone || matchedUser?.phoneNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => onCopy((req.contactPhone || matchedUser?.phoneNumber)!)}
                          className="p-0.5 text-slate-500 hover:text-white cursor-pointer"
                          title={t('copy')}
                        >
                          {copiedText === (req.contactPhone || matchedUser?.phoneNumber) ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    )}
                    {matchedUser?.email && matchedUser.email.toLowerCase() !== (req.email || '').toLowerCase() && (
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-300 pt-0.5">
                        <Mail className="w-3 h-3 shrink-0" />
                        <span className="truncate">
                          {language === 'bn' ? 'মূল ইমেইল: ' : 'Matched Email: '}
                          {matchedUser.email}
                        </span>
                        <button
                          type="button"
                          onClick={() => onCopy(matchedUser.email)}
                          className="p-0.5 text-slate-400 hover:text-white cursor-pointer shrink-0"
                          title={t('copy')}
                        >
                          {copiedText === matchedUser.email ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-semibold">
                      {t('applicantDetails')}:
                    </span>
                    <p className="text-slate-300 break-words">
                      {req.details || 'User requested assistance.'}
                    </p>
                  </div>
                </div>

                {req.resetEmailSentTo && req.resetEmailSentAt && (
                  <div className="px-2.5 py-1.5 rounded-xl bg-sky-950/30 border border-sky-500/25 text-[11px] text-sky-200 flex items-center justify-between gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5">
                      <MailCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span>
                        {language === 'bn'
                          ? `পাসওয়ার্ড রিসেট ইমেইল পাঠানো হয়েছে: ${req.resetEmailSentTo}`
                          : `Password reset email sent to: ${req.resetEmailSentTo}`}
                      </span>
                    </span>
                    <span className="text-[10px] text-sky-300/80">
                      {new Date(req.resetEmailSentAt).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}
                    </span>
                  </div>
                )}

                {req.adminNotes && (
                  <div
                    className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                      req.status === 'resolved'
                        ? 'bg-emerald-950/30 border-emerald-500/20 text-emerald-200'
                        : req.status === 'dismissed'
                        ? 'bg-slate-900/70 border-slate-700/80 text-slate-300'
                        : 'bg-amber-950/20 border-amber-500/25 text-amber-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] opacity-80">
                      <span className="font-bold uppercase">
                        {language === 'bn' ? 'সাপোর্ট নোট:' : 'Resolution Notes:'}
                      </span>
                      {(req.resolvedBy || req.resolvedAt) && (
                        <span>
                          {req.resolvedBy || ''}
                          {req.resolvedAt
                            ? ` · ${new Date(req.resolvedAt).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}`
                            : ''}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] break-words">{req.adminNotes}</div>
                  </div>
                )}

                {confirmResetId === req.id && targetEmail && (
                  <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-amber-200">
                      {language === 'bn'
                        ? `${targetEmail} ঠিকানায় রিসেট লিংক পাঠাতে নিশ্চিত করুন (আবেদনকারী ইমেইল হারানোর কথা জানিয়েছেন)।`
                        : `Confirm sending password reset link to ${targetEmail} (ticket reported lost email or different email).`}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          runBusy(req.id, async () => {
                            await onSendResetEmail(targetEmail, req.id);
                            setConfirmResetId(null);
                          })
                        }
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                      >
                        {t('confirm')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmResetId(null)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] cursor-pointer"
                      >
                        {t('cancel')}
                      </button>
                    </div>
                  </div>
                )}

                {confirmDismissId === req.id && (
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs">
                    <input
                      type="text"
                      maxLength={300}
                      value={dismissNote}
                      onChange={(e) => setDismissNote(e.target.value)}
                      placeholder={
                        language === 'bn'
                          ? 'বাতিলের কারণ লিখুন (ঐচ্ছিক)...'
                          : 'Optional reason for dismissing ticket...'
                      }
                      className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          runBusy(req.id, async () => {
                            await onDismiss(req.id, dismissNote);
                            setConfirmDismissId(null);
                            setDismissNote('');
                          })
                        }
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                      >
                        {language === 'bn' ? 'নিশ্চিত বাতিল' : 'Confirm Dismiss'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDismissId(null);
                          setDismissNote('');
                        }}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] cursor-pointer"
                      >
                        {t('cancel')}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {matchedUser && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onOpenDossier(matchedUser)}
                        className="px-2.5 py-1.5 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 rounded-xl text-xs font-medium cursor-pointer flex items-center gap-1.5 transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{t('viewUserDossierBtn')}</span>
                      </button>
                    )}

                    {matchedUser?.hasAppLockPin && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => runBusy(req.id, () => onClearAppLock(matchedUser, req.id))}
                        className="px-2.5 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition disabled:opacity-50"
                      >
                        <ShieldOff className="w-3.5 h-3.5" />
                        <span>{language === 'bn' ? 'অ্যাপ-লক রিসেট' : 'Clear App-Lock'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isBusy || !targetEmail || !targetEmail.includes('@')}
                      onClick={() => {
                        if (!targetEmail) return;
                        if (needsResetConfirm) {
                          setConfirmResetId(req.id);
                          return;
                        }
                        runBusy(req.id, () => onSendResetEmail(targetEmail, req.id));
                      }}
                      title={targetEmail ? `Send Firebase reset link to ${targetEmail}` : undefined}
                      className="px-2.5 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-medium cursor-pointer flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed max-w-[260px]"
                    >
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        {targetEmail && targetEmail.includes('@')
                          ? language === 'bn'
                            ? `রিসেট → ${targetEmail}`
                            : `Reset → ${targetEmail}`
                          : language === 'bn'
                          ? 'রিসেট ইমেইল নেই'
                          : 'No Email Available'}
                      </span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {req.status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            setConfirmDismissId(confirmDismissId === req.id ? null : req.id);
                            setDismissNote('');
                          }}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl text-xs cursor-pointer"
                        >
                          {t('dismissRecoveryBtn')}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => onSelectResolve(req)}
                          className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-1.5 shadow"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>{t('resolveRecoveryBtn')}</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => runBusy(req.id, () => onReopen(req.id))}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-amber-300 rounded-xl text-xs font-medium cursor-pointer flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>{language === 'bn' ? 'পুনরায় খুলুন' : 'Reopen'}</span>
                      </button>
                    )}

                    {confirmDeleteId === req.id ? (
                      <div className="flex items-center gap-1 bg-rose-950/60 border border-rose-500/40 rounded-xl px-2 py-1">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            runBusy(req.id, async () => {
                              await onDelete(req.id);
                              setConfirmDeleteId(null);
                            })
                          }
                          className="text-[11px] font-bold text-rose-300 hover:text-white cursor-pointer"
                        >
                          {t('confirm')}
                        </button>
                        <span className="text-slate-600">|</span>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                        >
                          {t('cancel')}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setConfirmDeleteId(req.id)}
                        className="p-1.5 rounded-xl text-slate-500 hover:text-red-400 cursor-pointer"
                        title={language === 'bn' ? 'টিকিট ডিলিট করুন' : 'Delete ticket'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
