import { Clock } from 'lucide-react';
import type { AdminAuditLog } from '../../types/chat';

interface AdminLogsTabProps {
  t: (key: any) => string;
  logs: AdminAuditLog[];
}

export function AdminLogsTab({ t, logs }: AdminLogsTabProps) {
  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div>
        <h3 className="text-sm font-bold text-white">{t('auditLogsTitle')}</h3>
        <p className="text-xs text-slate-400">{t('auditLogsSubtitle')}</p>
      </div>

      {logs.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-xs">{t('noAuditLogs')}</div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex items-start gap-3 text-xs"
            >
              <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 shrink-0 mt-0.5">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-white capitalize">
                    {log.action.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] text-slate-500 shrink-0">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-slate-300 mt-0.5">{log.details}</p>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                  <span>Admin: {log.adminEmail}</span>
                  {log.targetName && <span>· Target: {log.targetName}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
