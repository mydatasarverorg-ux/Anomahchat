import { CheckCircle2, Trash2 } from 'lucide-react';
import type { UserProfile, UserReport } from '../../types/chat';

interface AdminReportsTabProps {
  t: (key: any) => string;
  usersList: UserProfile[];
  filteredReports: UserReport[];
  reportFilter: 'all' | 'pending' | 'resolved' | 'dismissed';
  setReportFilter: (val: 'all' | 'pending' | 'resolved' | 'dismissed') => void;
  onOpenBan: (target: UserProfile, defaultReason: string) => void;
  onDeleteReportedMessage: (chatId: string, messageId: string, reason: string) => void;
  onResolveReport: (reportId: string, status: 'resolved' | 'dismissed', notes: string) => void;
  onDeleteReport: (reportId: string) => void;
}

export function AdminReportsTab({
  t,
  usersList,
  filteredReports,
  reportFilter,
  setReportFilter,
  onOpenBan,
  onDeleteReportedMessage,
  onResolveReport,
  onDeleteReport,
}: AdminReportsTabProps) {
  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex gap-2 text-xs overflow-x-auto scrollbar-none py-0.5">
        {(['all', 'pending', 'resolved', 'dismissed'] as const).map((tag) => (
          <button
            key={tag}
            onClick={() => setReportFilter(tag)}
            className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer shrink-0 whitespace-nowrap ${
              reportFilter === tag
                ? 'bg-red-600 text-white'
                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {tag === 'all'
              ? 'All'
              : tag === 'pending'
              ? t('reportStatusPending')
              : tag === 'resolved'
              ? t('reportStatusResolved')
              : t('reportStatusDismissed')}
          </button>
        ))}
      </div>

      {filteredReports.length === 0 ? (
        <div className="py-12 text-center text-slate-500 space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <h4 className="text-sm font-bold text-white">{t('reportsEmptyTitle')}</h4>
          <p className="text-xs text-slate-400">{t('reportsEmptySubtitle')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30 uppercase">
                    {report.reason}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      report.status === 'pending'
                        ? 'bg-amber-500/20 text-amber-300'
                        : report.status === 'resolved'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {report.status}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500">
                  {new Date(report.createdAt).toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-semibold">Reported User:</span>
                  <span className="text-white font-bold">{report.targetUserName}</span>
                  {report.targetUserEmail && (
                    <span className="text-[11px] text-slate-400 block">({report.targetUserEmail})</span>
                  )}
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-semibold">Reporter:</span>
                  <span className="text-slate-300">{report.reporterName}</span>
                  <span className="text-[11px] text-slate-500 block">({report.reporterEmail})</span>
                </div>
              </div>

              {report.messageText && (
                <div className="bg-red-950/20 border border-red-900/30 p-2.5 rounded-xl text-xs text-red-200">
                  <span className="font-semibold block text-[10px] uppercase text-red-300">
                    Reported Message Content:
                  </span>
                  <p className="italic">"{report.messageText}"</p>
                </div>
              )}

              {report.details && (
                <div className="text-xs text-slate-300 bg-slate-900/30 p-2 rounded-xl">
                  <span className="text-[10px] text-slate-500 block font-semibold">Details:</span>
                  <p>{report.details}</p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      const found = usersList.find((u) => u.userId === report.targetUserId);
                      if (found) {
                        onOpenBan(found, `User reported for ${report.reason}: "${report.details || 'Violating safety'}"`);
                      }
                    }}
                    className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-medium cursor-pointer"
                  >
                    {t('banUserBtn')}
                  </button>

                  {report.chatId && report.messageId && (
                    <button
                      onClick={() => onDeleteReportedMessage(report.chatId!, report.messageId!, report.reason)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                      <span>{t('deleteReportedMsgBtn')}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {report.status === 'pending' && (
                    <>
                      <button
                        onClick={() => onResolveReport(report.id, 'resolved', 'Addressed by admin.')}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        {t('resolveReportBtn')}
                      </button>
                      <button
                        onClick={() => onResolveReport(report.id, 'dismissed', 'Dismissed as false report.')}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-xs cursor-pointer"
                      >
                        {t('dismissReportBtn')}
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => onDeleteReport(report.id)}
                    className="p-1 rounded-lg text-slate-500 hover:text-red-400 cursor-pointer"
                    title="Delete report"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
