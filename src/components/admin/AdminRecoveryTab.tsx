import { CheckCircle2, KeyRound } from 'lucide-react';
import type { PasswordRecoveryRequest } from '../../types/chat';

interface AdminRecoveryTabProps {
  t: (key: any) => string;
  filteredRecovery: PasswordRecoveryRequest[];
  recoveryFilter: 'all' | 'pending' | 'resolved' | 'dismissed';
  setRecoveryFilter: (val: 'all' | 'pending' | 'resolved' | 'dismissed') => void;
  onDismiss: (reqId: string) => void;
  onSelectResolve: (req: PasswordRecoveryRequest) => void;
}

export function AdminRecoveryTab({
  t,
  filteredRecovery,
  recoveryFilter,
  setRecoveryFilter,
  onDismiss,
  onSelectResolve,
}: AdminRecoveryTabProps) {
  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white">{t('recoveryDeskTitle')}</h3>
          <p className="text-xs text-slate-400">{t('recoveryDeskSubtitle')}</p>
        </div>
        <div className="flex gap-1.5 text-xs overflow-x-auto scrollbar-none py-0.5">
          {(['all', 'pending', 'resolved', 'dismissed'] as const).map((tag) => (
            <button
              key={tag}
              onClick={() => setRecoveryFilter(tag)}
              className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer shrink-0 whitespace-nowrap ${
                recoveryFilter === tag
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {tag.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {filteredRecovery.length === 0 ? (
        <div className="py-12 text-center text-slate-500 space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <p className="text-xs">{t('recoveryRequestsEmpty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRecovery.map((req) => (
            <div
              key={req.id}
              className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      req.status === 'resolved'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : req.status === 'dismissed'
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {req.status.toUpperCase()}
                  </span>
                  <span className="text-xs font-bold text-white">{req.email}</span>
                  {req.username && (
                    <span className="text-[11px] text-slate-400 font-mono">(@{req.username})</span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500">
                  {new Date(req.createdAt).toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-semibold">{t('applicantName')}:</span>
                  <span className="text-white font-medium">{req.name || 'Not specified'}</span>
                  {req.contactPhone && (
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Phone: {req.contactPhone}
                    </span>
                  )}
                </div>

                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-semibold">{t('applicantDetails')}:</span>
                  <p className="text-slate-300">{req.details || 'User requested assistance.'}</p>
                </div>
              </div>

              {req.status === 'resolved' && req.adminNotes && (
                <div className="bg-emerald-950/30 border border-emerald-500/20 p-2.5 rounded-xl text-xs space-y-1">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase">Resolution Notes:</span>
                  <div className="text-slate-300 text-[11px]">{req.adminNotes}</div>
                </div>
              )}

              {req.status === 'pending' && (
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => onDismiss(req.id)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs cursor-pointer"
                  >
                    {t('dismissRecoveryBtn')}
                  </button>
                  <button
                    onClick={() => onSelectResolve(req)}
                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-1.5 shadow"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>{t('resolveRecoveryBtn')}</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
