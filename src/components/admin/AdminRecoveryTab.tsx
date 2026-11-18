import { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Eye,
  KeyRound,
  Lock,
  Mail,
  Phone,
  RotateCcw,
  Search,
  ShieldOff,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react';
import { SUPPORT_DESK_ADDRESS, doPhonesMatch } from '../../services/adminService';
import type { PasswordRecoveryRequest, UserProfile } from '../../types/chat';

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
  onClearAppLock: (targetUser: UserProfile) => Promise<void>;
  onSendResetEmail: (targetEmail: string, ticketId: string) => Promise<void>;
  onDismiss: (reqId: string) => Promise<void>;
  onReopen: (reqId: string) => Promise<void>;
  onDelete: (reqId: string) => Promise<void>;
  onSelectResolve: (req: PasswordRecoveryRequest) => void;
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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const findMatchedUser = (req: PasswordRecoveryRequest): UserProfile | undefined => {
    const cleanEmail = req.email?.trim().toLowerCase();
    const cleanUsername = req.username?.trim().replace(/^@/, '').toLowerCase();
    return usersList.find(
      (u) =>
        (cleanEmail && u.email?.trim().toLowerCase() === cleanEmail) ||
        (cleanUsername && u.username?.trim().toLowerCase() === cleanUsername) ||
        doPhonesMatch(req.contactPhone, u.phoneNumber)
    );
  };

  const getStatusLabel = (status: PasswordRecoveryRequest['status']) => {
    if (status === 'pending') return t('recoveryStatusPending');
    if (status === 'resolved') return t('recoveryStatusResolved');
    return t('recoveryStatusDismissed');
  };

  const runBusy = async (id: string, fn: () => Promise<void>) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await fn();
    } finally {
      setBusyId(null);
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

      {/* Search Bar for Support Tickets (email, @username, phone number, name) */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
        <input
          type="text"
          value={recoverySearch}
          onChange={(e) => setRecoverySearch(e.target.value)}
          placeholder={
            language === 'bn'
              ? 'ইমেইল, @ইউজারনেম, মোবাইল নম্বর বা নাম দিয়ে টিকিট খুঁজুন...'
              : 'Search tickets by email, @username, mobile number, or name...'
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
            const matchedUser = findMatchedUser(req);
            const targetEmail = matchedUser?.email || req.email;
            const primaryIdentifier =
              req.email ||
              req.contactPhone ||
              (req.username ? `@${req.username}` : req.name || req.id);
            const isBusy = busyId === req.id;

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
                        {language === 'bn' ? 'অ্যাকাউন্ট পাওয়া গেছে' : 'Account Matched'}
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
                  </div>

                  <span className="text-[10px] text-slate-500">
                    {new Date(req.createdAt).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}
                  </span>
                </div>

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
                    {matchedUser?.email && matchedUser.email !== req.email && (
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
                        onClick={() => runBusy(req.id, () => onClearAppLock(matchedUser))}
                        className="px-2.5 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition disabled:opacity-50"
                      >
                        <ShieldOff className="w-3.5 h-3.5" />
                        <span>{language === 'bn' ? 'অ্যাপ-লক রিসেট' : 'Clear App-Lock'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isBusy || !targetEmail || !targetEmail.includes('@')}
                      onClick={() => runBusy(req.id, () => onSendResetEmail(targetEmail, req.id))}
                      className="px-2.5 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-medium cursor-pointer flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>
                        {language === 'bn' ? 'রিসেট ইমেইল পাঠান' : 'Send Reset Email'}
                      </span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {req.status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => runBusy(req.id, () => onDismiss(req.id))}
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
