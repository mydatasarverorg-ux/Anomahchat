import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  MessageSquare,
  Phone,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react';
import { isSuperAdmin } from '../../services/adminService';
import type { PhoneRegistryEntry, ReportReason, UserProfile, UserReport } from '../../types/chat';

interface AdminReportsTabProps {
  t: (key: any) => string;
  language: 'en' | 'bn';
  usersList: UserProfile[];
  filteredReports: UserReport[];
  reportCounts: {
    all: number;
    pending: number;
    resolved: number;
    dismissed: number;
  };
  reportFilter: 'all' | 'pending' | 'resolved' | 'dismissed';
  setReportFilter: (val: 'all' | 'pending' | 'resolved' | 'dismissed') => void;
  reportSearch: string;
  setReportSearch: (val: string) => void;
  reportReasonFilter: 'all' | ReportReason;
  setReportReasonFilter: (val: 'all' | ReportReason) => void;
  copiedText: string | null;
  onCopy: (text: string) => void;
  onOpenBan: (target: UserProfile, defaultReason: string) => void;
  onOpenWarn: (target: UserProfile, defaultText: string) => void;
  onOpenDossier: (target: UserProfile) => void;
  onInspectChat: (chatId: string, highlightMessageId?: string) => void;
  onDeleteReportedMessage: (
    chatId: string,
    messageId: string,
    reason: string,
    reportId: string
  ) => Promise<void>;
  onResolveReport: (
    reportId: string,
    status: 'pending' | 'resolved' | 'dismissed',
    notes: string
  ) => Promise<void>;
  onDeleteReport: (reportId: string) => Promise<void>;
  onNotifyMissingUser: (targetName: string) => void;
  userPhoneRegistryMap?: Record<string, PhoneRegistryEntry>;
  originalUidByPhoneHash?: Record<string, string>;
}

export function AdminReportsTab({
  t,
  language,
  usersList,
  filteredReports,
  reportCounts,
  reportFilter,
  setReportFilter,
  reportSearch,
  setReportSearch,
  reportReasonFilter,
  setReportReasonFilter,
  copiedText,
  onCopy,
  onOpenBan,
  onOpenWarn,
  onOpenDossier,
  onInspectChat,
  onDeleteReportedMessage,
  onResolveReport,
  onDeleteReport,
  onNotifyMissingUser,
  userPhoneRegistryMap,
  originalUidByPhoneHash,
}: AdminReportsTabProps) {
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteMsgId, setConfirmDeleteMsgId] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});

  const getReasonLabel = (reason: ReportReason) => {
    switch (reason) {
      case 'harassment':
        return t('reportReasonHarassment');
      case 'hate_speech':
        return t('reportReasonHateSpeech');
      case 'spam':
        return t('reportReasonSpam');
      case 'scam':
        return t('reportReasonScam');
      case 'inappropriate':
        return t('reportReasonInappropriate');
      case 'impersonation':
        return t('reportReasonImpersonation');
      default:
        return t('reportReasonOther');
    }
  };

  const getMessageTypeBadge = (msgType?: UserReport['reportedMessageType']) => {
    switch (msgType) {
      case 'image':
        return language === 'bn' ? 'ছবি' : 'Photo';
      case 'audio':
        return language === 'bn' ? 'ভয়েস' : 'Voice Note';
      case 'file':
        return language === 'bn' ? 'ফাইল' : 'File';
      case 'text':
        return language === 'bn' ? 'টেক্সট' : 'Text';
      default:
        return null;
    }
  };

  const getStatusLabel = (status: UserReport['status']) => {
    if (status === 'pending') return t('reportStatusPending');
    if (status === 'resolved') return t('reportStatusResolved');
    return t('reportStatusDismissed');
  };

  const handleAction = async (reportId: string, fn: () => Promise<void>) => {
    if (busyIds[reportId]) return;
    setBusyIds((prev) => ({ ...prev, [reportId]: true }));
    try {
      await fn();
    } finally {
      setBusyIds((prev) => {
        const next = { ...prev };
        delete next[reportId];
        return next;
      });
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex gap-2 text-xs overflow-x-auto scrollbar-none py-0.5">
          {(['all', 'pending', 'resolved', 'dismissed'] as const).map((tag) => {
            const count = reportCounts[tag];
            const label =
              tag === 'all'
                ? language === 'bn'
                  ? 'সব'
                  : 'All'
                : tag === 'pending'
                ? t('reportStatusPending')
                : tag === 'resolved'
                ? t('reportStatusResolved')
                : t('reportStatusDismissed');

            return (
              <button
                key={tag}
                onClick={() => setReportFilter(tag)}
                className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer shrink-0 whitespace-nowrap flex items-center gap-1.5 ${
                  reportFilter === tag
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span>{label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    reportFilter === tag
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

        <select
          value={reportReasonFilter}
          onChange={(e) => setReportReasonFilter(e.target.value as 'all' | ReportReason)}
          className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-red-500 cursor-pointer"
        >
          <option value="all">
            {language === 'bn' ? 'সকল কারণ' : 'All Reasons'}
          </option>
          {(
            [
              'harassment',
              'hate_speech',
              'spam',
              'scam',
              'inappropriate',
              'impersonation',
              'other',
            ] as ReportReason[]
          ).map((r) => (
            <option key={r} value={r}>
              {getReasonLabel(r)}
            </option>
          ))}
        </select>
      </div>

      {/* Report Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
        <input
          type="text"
          value={reportSearch}
          onChange={(e) => setReportSearch(e.target.value)}
          placeholder={
            language === 'bn'
              ? 'রিপোর্টকৃত ব্যক্তি, রিপোর্টকারী, মোবাইল নম্বর (প্রথম/বর্তমান), মেসেজ বা আইডি দিয়ে খুঁজুন...'
              : 'Search by user, reporter, mobile number (first or current), message, or ID...'
          }
          className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
        />
      </div>

      {filteredReports.length === 0 ? (
        <div className="py-12 text-center text-slate-500 space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <h4 className="text-sm font-bold text-white">{t('reportsEmptyTitle')}</h4>
          <p className="text-xs text-slate-400">{t('reportsEmptySubtitle')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReports.map((report) => {
            const targetUser = usersList.find((u) => u.userId === report.targetUserId);
            const reporterUser = usersList.find((u) => u.userId === report.reporterId);
            const targetIsSuperAdmin = isSuperAdmin(targetUser?.email || report.targetUserEmail);
            const isBusy = Boolean(busyIds[report.id]);
            const draftNote = noteDrafts[report.id] ?? '';
            const msgTypeBadge = getMessageTypeBadge(report.reportedMessageType);

            return (
              <div
                key={report.id}
                className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                      {getReasonLabel(report.reason)}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium ${
                        report.status === 'pending'
                          ? 'bg-amber-500/20 text-amber-300'
                          : report.status === 'resolved'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {getStatusLabel(report.status)}
                    </span>
                    {report.targetMessageDeleted && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        {language === 'bn' ? 'মেসেজ ডিলিটকৃত' : 'Message Deleted'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <button
                      type="button"
                      onClick={() => onCopy(report.id)}
                      className="font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 hover:text-slate-300 cursor-pointer inline-flex items-center gap-1"
                      title={t('copy')}
                    >
                      <span>{report.id.slice(0, 14)}</span>
                      {copiedText === report.id ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                    </button>
                    <span>
                      {new Date(report.createdAt).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">
                        {language === 'bn' ? 'রিপোর্টকৃত ব্যক্তি:' : 'Reported User:'}
                      </span>
                      <div className="flex items-center gap-1">
                        {!targetUser ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-800 text-slate-400 inline-flex items-center gap-1">
                            <UserX className="w-2.5 h-2.5" />
                            {language === 'bn' ? 'অ্যাকাউন্ট নেই' : 'Not Found'}
                          </span>
                        ) : (
                          <>
                            {targetUser.isBanned && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                {t('userStatusBanned')}
                              </span>
                            )}
                            {targetUser.warningNotice && !targetUser.warningDismissed && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                {t('userStatusWarned')}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <span className="text-white font-bold block truncate">
                          {targetUser?.displayName || report.targetUserName}
                        </span>
                        {(targetUser?.email || report.targetUserEmail) && (
                          <span className="text-[11px] text-slate-400 block truncate">
                            ({targetUser?.email || report.targetUserEmail})
                          </span>
                        )}
                        {(() => {
                          const activePhone = targetUser?.phoneNumber || report.targetPhoneNumber;
                          const initPhone = targetUser?.initialPhoneNumber || report.targetInitialPhoneNumber;
                          const changeCount =
                            targetUser?.phoneHistory?.length ?? report.targetPhoneChangeCount ?? 0;
                          const reg = userPhoneRegistryMap?.[report.targetUserId];
                          const origUid = reg ? originalUidByPhoneHash?.[reg.phoneHash] : undefined;
                          const isOriginal = origUid ? origUid === report.targetUserId : false;
                          const hasSiblingBan = Boolean(
                            reg &&
                              !targetUser?.isBanned &&
                              reg.bannedUids?.some((uid) => uid !== report.targetUserId)
                          );

                          if (!activePhone && !initPhone && !reg) return null;
                          return (
                            <div className="flex flex-wrap items-center gap-1 pt-0.5">
                              {activePhone && (
                                <button
                                  type="button"
                                  onClick={() => onCopy(activePhone)}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/90 border border-slate-700 text-[10px] font-mono text-emerald-300 hover:border-emerald-500/40 cursor-pointer"
                                  title={t('copy')}
                                >
                                  <Phone className="w-2.5 h-2.5" />
                                  <span>{activePhone}</span>
                                  {copiedText === activePhone ? (
                                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-2.5 h-2.5 opacity-60" />
                                  )}
                                </button>
                              )}
                              {initPhone && initPhone !== activePhone && (
                                <span
                                  className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[9px] font-mono text-amber-300"
                                  title={
                                    language === 'bn'
                                      ? 'অ্যাকাউন্টের সর্বপ্রথম নম্বর'
                                      : 'First registered mobile number'
                                  }
                                >
                                  {language === 'bn' ? 'প্রথম:' : '1st:'} {initPhone}
                                </span>
                              )}
                              {changeCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-[9px] font-semibold text-sky-300">
                                  {language === 'bn'
                                    ? `${changeCount}বার পরিবর্তন`
                                    : `${changeCount}x changed`}
                                </span>
                              )}
                              {reg && (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                    isOriginal
                                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                  }`}
                                >
                                  {isOriginal
                                    ? language === 'bn'
                                      ? `মূল (ORIGINAL ${reg.accountUids.length}/${reg.maxLimit})`
                                      : `ORIGINAL (${reg.accountUids.length}/${reg.maxLimit})`
                                    : language === 'bn'
                                    ? `লিংকড (LINKED ${reg.accountUids.length}/${reg.maxLimit})`
                                    : `LINKED (${reg.accountUids.length}/${reg.maxLimit})`}
                                </span>
                              )}
                              {hasSiblingBan && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/35">
                                  {language === 'bn'
                                    ? 'একই নম্বরে অন্য অ্যাকাউন্ট ব্যানড!'
                                    : 'Sibling Account Banned!'}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      {targetUser && (
                        <button
                          type="button"
                          onClick={() => onOpenDossier(targetUser)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer shrink-0"
                          title={t('viewUserDossierBtn')}
                        >
                          <Eye className="w-3.5 h-3.5 text-sky-400" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">
                        {language === 'bn' ? 'রিপোর্টকারী:' : 'Reporter:'}
                      </span>
                      {reporterUser && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-500/10 text-emerald-400 inline-flex items-center gap-1">
                          <UserCheck className="w-2.5 h-2.5" />
                          {language === 'bn' ? 'যাচাইকৃত' : 'Verified'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <span className="text-slate-300 font-semibold block truncate">
                          {reporterUser?.displayName || report.reporterName}
                        </span>
                        <span className="text-[11px] text-slate-500 block truncate">
                          ({reporterUser?.email || report.reporterEmail || 'No email'})
                        </span>
                        {(() => {
                          const repPhone = reporterUser?.phoneNumber || report.reporterPhoneNumber;
                          const repInit =
                            reporterUser?.initialPhoneNumber || report.reporterInitialPhoneNumber;
                          if (!repPhone && !repInit) return null;
                          return (
                            <div className="flex flex-wrap items-center gap-1 pt-0.5">
                              {repPhone && (
                                <button
                                  type="button"
                                  onClick={() => onCopy(repPhone)}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/90 border border-slate-700 text-[10px] font-mono text-slate-300 hover:border-slate-500 cursor-pointer"
                                  title={t('copy')}
                                >
                                  <Phone className="w-2.5 h-2.5 text-emerald-400" />
                                  <span>{repPhone}</span>
                                  {copiedText === repPhone ? (
                                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-2.5 h-2.5 opacity-60" />
                                  )}
                                </button>
                              )}
                              {repInit && repInit !== repPhone && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/25 text-[9px] font-mono text-amber-300">
                                  {language === 'bn' ? 'প্রথম:' : '1st:'} {repInit}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      {reporterUser && (
                        <button
                          type="button"
                          onClick={() => onOpenDossier(reporterUser)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer shrink-0"
                          title={t('viewUserDossierBtn')}
                        >
                          <Eye className="w-3.5 h-3.5 text-emerald-400" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {report.messageText && (
                  <div className="bg-red-950/20 border border-red-900/30 p-2.5 rounded-xl text-xs text-red-200 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[10px] uppercase text-red-300">
                        {language === 'bn' ? 'রিপোর্টকৃত মেসেজ:' : 'Reported Message Content:'}
                      </span>
                      {msgTypeBadge && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-500/20 text-red-200 border border-red-500/30">
                          {msgTypeBadge}
                        </span>
                      )}
                    </div>
                    <p className="italic break-words">"{report.messageText}"</p>
                  </div>
                )}

                {report.details && (
                  <div className="text-xs text-slate-300 bg-slate-900/30 p-2.5 rounded-xl border border-slate-800/60 space-y-1">
                    <span className="text-[10px] text-slate-400 block font-semibold">
                      {language === 'bn' ? 'অতিরিক্ত বিবরণ:' : 'Details:'}
                    </span>
                    <p className="break-words">{report.details}</p>
                  </div>
                )}

                {(report.resolutionNotes || report.resolvedBy) && (
                  <div
                    className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                      report.status === 'resolved'
                        ? 'bg-emerald-950/20 border-emerald-500/25 text-emerald-200'
                        : report.status === 'dismissed'
                        ? 'bg-slate-900/70 border-slate-700/80 text-slate-300'
                        : 'bg-amber-950/20 border-amber-500/25 text-amber-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] opacity-80">
                      <span className="font-semibold">{t('resolutionNotesLabel')}</span>
                      {(report.resolvedBy || report.resolvedAt) && (
                        <span>
                          {report.resolvedBy ? `${report.resolvedBy}` : ''}
                          {report.resolvedAt
                            ? ` · ${new Date(report.resolvedAt).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US')}`
                            : ''}
                        </span>
                      )}
                    </div>
                    {report.resolutionNotes && <p className="break-words">{report.resolutionNotes}</p>}
                  </div>
                )}

                {report.status === 'pending' && (
                  <div className="space-y-1">
                    <input
                      type="text"
                      value={draftNote}
                      onChange={(e) =>
                        setNoteDrafts((prev) => ({
                          ...prev,
                          [report.id]: e.target.value.slice(0, 1000),
                        }))
                      }
                      maxLength={1000}
                      placeholder={t('resolutionNotesPlaceholder')}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
                    />
                  </div>
                )}

                {confirmDeleteMsgId === report.id && report.chatId && report.messageId && (
                  <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/40 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-rose-200">
                      {language === 'bn'
                        ? 'আপনি কি চ্যাট রুম থেকে এই মেসেজটি স্থায়ীভাবে ডিলিট করতে চান?'
                        : 'Permanently delete this offending message from the conversation?'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          handleAction(report.id, async () => {
                            await onDeleteReportedMessage(
                              report.chatId!,
                              report.messageId!,
                              report.reason,
                              report.id
                            );
                            setConfirmDeleteMsgId(null);
                          })
                        }
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                      >
                        {t('confirm')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteMsgId(null)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] cursor-pointer"
                      >
                        {t('cancel')}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {!targetIsSuperAdmin && (
                      <>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            if (!targetUser) {
                              onNotifyMissingUser(report.targetUserName);
                              return;
                            }
                            if (targetUser.isBanned) {
                              onOpenDossier(targetUser);
                              return;
                            }
                            const snippet = (report.details || report.messageText || 'Safety violation').slice(0, 400);
                            onOpenBan(
                              targetUser,
                              `Reported (${report.reason}): "${snippet}"`.slice(0, 500)
                            );
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer flex items-center gap-1 ${
                            targetUser?.isBanned
                              ? 'bg-rose-950/60 border border-rose-500/40 text-rose-300 hover:bg-rose-900/60'
                              : 'bg-red-600 hover:bg-red-500 text-white'
                          }`}
                        >
                          <ShieldAlert className="w-3 h-3" />
                          <span>
                            {targetUser?.isBanned
                              ? language === 'bn'
                                ? 'স্থগিত দেখুন / আনব্যান'
                                : 'View Suspension / Unban'
                              : t('banUserBtn')}
                          </span>
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            if (!targetUser) {
                              onNotifyMissingUser(report.targetUserName);
                              return;
                            }
                            onOpenWarn(
                              targetUser,
                              language === 'bn'
                                ? `আপনার বিরুদ্ধে "${getReasonLabel(report.reason)}" সংক্রান্ত একটি রিপোর্ট পাওয়া গেছে। অনুগ্রহ করে প্ল্যাটফর্মের নিয়মাবলী মেনে চলুন।`
                                : `Official notice regarding a report for ${getReasonLabel(report.reason)}. Please follow community guidelines.`
                            );
                          }}
                          className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 rounded-lg text-xs font-medium cursor-pointer flex items-center gap-1"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          <span>{t('warnUserBtn')}</span>
                        </button>
                      </>
                    )}

                    {report.chatId && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onInspectChat(report.chatId!, report.messageId)}
                        className="px-2.5 py-1 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 rounded-lg text-xs font-medium cursor-pointer flex items-center gap-1"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>{language === 'bn' ? 'চ্যাট দেখুন' : 'Inspect Chat'}</span>
                      </button>
                    )}

                    {report.chatId && report.messageId && !report.targetMessageDeleted && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          setConfirmDeleteMsgId(confirmDeleteMsgId === report.id ? null : report.id)
                        }
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-lg text-xs font-medium cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3 text-red-400" />
                        <span>{t('deleteReportedMsgBtn')}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {report.status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            handleAction(report.id, async () => {
                              await onResolveReport(
                                report.id,
                                'resolved',
                                draftNote || 'Addressed by admin.'
                              );
                              setNoteDrafts((prev) => {
                                const next = { ...prev };
                                delete next[report.id];
                                return next;
                              });
                            })
                          }
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          {t('resolveReportBtn')}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            handleAction(report.id, async () => {
                              await onResolveReport(
                                report.id,
                                'dismissed',
                                draftNote || 'Dismissed as false report.'
                              );
                              setNoteDrafts((prev) => {
                                const next = { ...prev };
                                delete next[report.id];
                                return next;
                              });
                            })
                          }
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-lg text-xs cursor-pointer"
                        >
                          {t('dismissReportBtn')}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          handleAction(report.id, () =>
                            onResolveReport(
                              report.id,
                              'pending',
                              'Reopened for further review.'
                            )
                          )
                        }
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-amber-300 rounded-lg text-xs font-medium cursor-pointer flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>{language === 'bn' ? 'পুনরায় খুলুন' : 'Reopen'}</span>
                      </button>
                    )}

                    {confirmDeleteId === report.id ? (
                      <div className="flex items-center gap-1 bg-rose-950/60 border border-rose-500/40 rounded-lg px-2 py-0.5">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            handleAction(report.id, async () => {
                              await onDeleteReport(report.id);
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
                        onClick={() => setConfirmDeleteId(report.id)}
                        className="p-1 rounded-lg text-slate-500 hover:text-red-400 cursor-pointer"
                        title={language === 'bn' ? 'রিপোর্ট ডিলিট করুন' : 'Delete report'}
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
