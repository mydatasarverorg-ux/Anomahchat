import { Clock } from 'lucide-react';
import type { AdminAuditLog } from '../../types/chat';

interface AdminLogsTabProps {
  t: (key: any) => string;
  logs: AdminAuditLog[];
}

export function AdminLogsTab({ t, logs }: AdminLogsTabProps) {
  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="pb-3 border-b border-slate-800">
        <h3 className="text-sm font-bold text-white">{t('auditLogsTitle')}</h3>
        <p className="text-xs text-slate-400 mt-0.5">{t('auditLogsSubtitle')}</p>
      </div>

      {logs.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-xs">{t('noAuditLogs')}</div>
      ) : (
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl divide-y divide-slate-800/80 overflow-hidden">
          {logs.map((log) => (
            <div key={log.id} className="p-3.5 flex items-start gap-3 text-xs">
              <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 shrink-0 mt-0.5">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-white capitalize">
                    {log.action.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono tabular-nums shrink-0">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-slate-300 mt-0.5 leading-relaxed">{log.details}</p>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                  <span>{log.adminEmail}</span>
                  {log.targetName && <span>· {log.targetName}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
