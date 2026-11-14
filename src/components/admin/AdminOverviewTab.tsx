import { KeyRound, Lock, MessageSquare, Users } from 'lucide-react';
import { SUPER_ADMIN_EMAIL } from '../../services/adminService';

interface AdminOverviewTabProps {
  t: (key: any) => string;
  totalUsersCount: number;
  onlineUsersCount: number;
  totalChatsCount: number;
  pendingRecoveryCount: number;
  pendingReportsCount: number;
  bannedUsersCount: number;
  onSelectTab: (tab: 'recovery' | 'chat_audit' | 'users') => void;
}

export function AdminOverviewTab({
  t,
  totalUsersCount,
  onlineUsersCount,
  totalChatsCount,
  pendingRecoveryCount,
  pendingReportsCount,
  bannedUsersCount,
  onSelectTab,
}: AdminOverviewTabProps) {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-gradient-to-r from-emerald-950/40 to-slate-950/60 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">{t('securityStatusTitle')}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('superAdminVerified')} · <span className="text-emerald-400 font-mono">{SUPER_ADMIN_EMAIL}</span>
            </p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
          {t('securityStatusBadge')}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl">
          <div className="text-[11px] font-medium text-slate-400 mb-1">{t('statTotalUsers')}</div>
          <div className="text-2xl font-bold text-white">{totalUsersCount}</div>
        </div>
        <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl">
          <div className="text-[11px] font-medium text-emerald-400 mb-1">{t('statActiveNow')}</div>
          <div className="text-2xl font-bold text-emerald-400">{onlineUsersCount}</div>
        </div>
        <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl">
          <div className="text-[11px] font-medium text-sky-400 mb-1">{t('statTotalChats')}</div>
          <div className="text-2xl font-bold text-sky-400">{totalChatsCount}</div>
        </div>
        <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl">
          <div className="text-[11px] font-medium text-amber-400 mb-1">Support Tickets</div>
          <div className="text-2xl font-bold text-amber-400">{pendingRecoveryCount}</div>
        </div>
        <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl">
          <div className="text-[11px] font-medium text-red-400 mb-1">{t('statPendingReports')}</div>
          <div className="text-2xl font-bold text-red-400">{pendingReportsCount}</div>
        </div>
        <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl">
          <div className="text-[11px] font-medium text-rose-400 mb-1">{t('statBannedUsers')}</div>
          <div className="text-2xl font-bold text-rose-400">{bannedUsersCount}</div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          {t('quickActionsTitle')}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => onSelectTab('recovery')}
            className="p-4 bg-slate-950/70 border border-slate-800 hover:border-amber-500/50 rounded-2xl text-left transition cursor-pointer group"
          >
            <KeyRound className="w-5 h-5 text-amber-400 mb-2 group-hover:scale-110 transition" />
            <div className="text-xs font-bold text-white">{t('recoveryDeskTitle')}</div>
            <div className="text-[11px] text-slate-400 mt-1">
              {pendingRecoveryCount} support recovery requests pending
            </div>
          </button>

          <button
            onClick={() => onSelectTab('chat_audit')}
            className="p-4 bg-slate-950/70 border border-slate-800 hover:border-sky-500/50 rounded-2xl text-left transition cursor-pointer group"
          >
            <MessageSquare className="w-5 h-5 text-sky-400 mb-2 group-hover:scale-110 transition" />
            <div className="text-xs font-bold text-white">{t('chatAuditTitle')}</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Inspect {totalChatsCount} active chat threads and messages
            </div>
          </button>

          <button
            onClick={() => onSelectTab('users')}
            className="p-4 bg-slate-950/70 border border-slate-800 hover:border-emerald-500/50 rounded-2xl text-left transition cursor-pointer group"
          >
            <Users className="w-5 h-5 text-emerald-400 mb-2 group-hover:scale-110 transition" />
            <div className="text-xs font-bold text-white">{t('quickSearchUsersBtn')}</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Inspect user dossiers, app-lock status, and activity graphs
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
