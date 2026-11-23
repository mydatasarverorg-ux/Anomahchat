import {
  Flag,
  HardDrive,
  KeyRound,
  Lock,
  MessageSquare,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { SUPER_ADMIN_EMAIL } from '../../services/adminService';
import type { AdminTabId } from './AdminSidebar';

interface AdminOverviewTabProps {
  t: (key: any) => string;
  language: string;
  totalUsersCount: number;
  onlineUsersCount: number;
  totalChatsCount: number;
  pendingRecoveryCount: number;
  pendingReportsCount: number;
  bannedUsersCount: number;
  onSelectTab: (tab: AdminTabId) => void;
}

export function AdminOverviewTab({
  t,
  language,
  totalUsersCount,
  onlineUsersCount,
  totalChatsCount,
  pendingRecoveryCount,
  pendingReportsCount,
  bannedUsersCount,
  onSelectTab,
}: AdminOverviewTabProps) {
  const bn = language === 'bn';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Clean Single-Elevation Status Header */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">{t('securityStatusTitle')}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('superAdminVerified')} ·{' '}
              <span className="text-emerald-400 font-mono">{SUPER_ADMIN_EMAIL}</span>
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold text-emerald-400">
          ● {t('securityStatusBadge')}
        </span>
      </div>

      {/* Tabular KPI Metric Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl">
          <div className="text-[11px] font-medium text-slate-400 mb-1">
            {t('statTotalUsers')}
          </div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">
            {totalUsersCount}
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl">
          <div className="text-[11px] font-medium text-slate-400 mb-1">
            {t('statActiveNow')}
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono tabular-nums">
            {onlineUsersCount}
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl">
          <div className="text-[11px] font-medium text-slate-400 mb-1">
            {t('statTotalChats')}
          </div>
          <div className="text-2xl font-bold text-sky-400 font-mono tabular-nums">
            {totalChatsCount}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSelectTab('recovery')}
          className="bg-slate-950/60 border border-slate-800 hover:border-amber-500/40 p-4 rounded-xl text-left transition cursor-pointer"
        >
          <div className="text-[11px] font-medium text-slate-400 mb-1">
            {t('adminTabRecovery')}
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono tabular-nums">
            {pendingRecoveryCount}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('reports')}
          className="bg-slate-950/60 border border-slate-800 hover:border-red-500/40 p-4 rounded-xl text-left transition cursor-pointer"
        >
          <div className="text-[11px] font-medium text-slate-400 mb-1">
            {t('statPendingReports')}
          </div>
          <div className="text-2xl font-bold text-red-400 font-mono tabular-nums">
            {pendingReportsCount}
          </div>
        </button>

        <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl">
          <div className="text-[11px] font-medium text-slate-400 mb-1">
            {t('statBannedUsers')}
          </div>
          <div className="text-2xl font-bold text-rose-400 font-mono tabular-nums">
            {bannedUsersCount}
          </div>
        </div>
      </div>

      {/* Quick Actions Grid (Flat 1px hairline list cards) */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          {t('quickActionsTitle')}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => onSelectTab('reports')}
            className="p-4 bg-slate-950/60 border border-slate-800 hover:border-slate-700 rounded-xl text-left transition cursor-pointer flex items-start gap-3"
          >
            <Flag className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-white">{t('quickReviewReportsBtn')}</div>
              <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                {pendingReportsCount} {t('statPendingReports')}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('recovery')}
            className="p-4 bg-slate-950/60 border border-slate-800 hover:border-slate-700 rounded-xl text-left transition cursor-pointer flex items-start gap-3"
          >
            <KeyRound className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-white">{t('recoveryDeskTitle')}</div>
              <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                {pendingRecoveryCount}{' '}
                {bn ? 'সাপোর্ট অনুরোধ অপেক্ষমাণ' : 'recovery requests pending'}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('users')}
            className="p-4 bg-slate-950/60 border border-slate-800 hover:border-slate-700 rounded-xl text-left transition cursor-pointer flex items-start gap-3"
          >
            <Users className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-white">{t('quickSearchUsersBtn')}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {bn
                  ? 'ইউজার ডোসিয়ার, পিন ও অ্যাক্টিভিটি দেখুন'
                  : 'Inspect user dossiers, app-lock status & limits'}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('security_policy')}
            className="p-4 bg-slate-950/60 border border-slate-800 hover:border-slate-700 rounded-xl text-left transition cursor-pointer flex items-start gap-3"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-white">
                {bn ? 'গ্লোবাল সিকিউরিটি নীতি' : 'Security & 2FA Policy'}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {bn
                  ? 'Magic Link, QR অনুমোদন ও ডিভাইস কোটা নিয়ন্ত্রণ'
                  : 'Configure Magic Link, QR login & device limits'}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('chat_audit')}
            className="p-4 bg-slate-950/60 border border-slate-800 hover:border-slate-700 rounded-xl text-left transition cursor-pointer flex items-start gap-3"
          >
            <MessageSquare className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-white">{t('chatAuditTitle')}</div>
              <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                {bn
                  ? `${totalChatsCount}টি চ্যাট থ্রেড ও মেসেজ পরিদর্শন`
                  : `Inspect ${totalChatsCount} active chat threads`}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('backup')}
            className="p-4 bg-slate-950/60 border border-slate-800 hover:border-slate-700 rounded-xl text-left transition cursor-pointer flex items-start gap-3"
          >
            <HardDrive className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-white">
                {bn ? 'ড্রাইভ ব্যাকআপ ও ১ জিবি ক্লিন' : 'Drive Backup & 1 GiB Clean'}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                anomahchatsarverorg@gmail.com
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
