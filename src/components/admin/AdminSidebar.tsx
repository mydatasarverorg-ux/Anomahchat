import {
  FileText,
  Flag,
  HardDrive,
  KeyRound,
  MessageSquare,
  Radio,
  Rocket,
  Shield,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { SUPER_ADMIN_EMAIL } from '../../services/adminService';
import { APP_VERSION } from '../../utils/appVersion';

export type AdminTabId =
  | 'overview'
  | 'users'
  | 'security_policy'
  | 'chat_audit'
  | 'backup'
  | 'recovery'
  | 'reports'
  | 'announcements'
  | 'logs'
  | 'updates';

interface AdminSidebarProps {
  t: (key: any) => string;
  language: string;
  activeTab: AdminTabId;
  onSelectTab: (tab: AdminTabId) => void;
  totalUsersCount: number;
  totalChatsCount: number;
  pendingRecoveryCount: number;
  pendingReportsCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function AdminSidebar({
  t,
  language,
  activeTab,
  onSelectTab,
  totalUsersCount,
  totalChatsCount,
  pendingRecoveryCount,
  pendingReportsCount,
  mobileOpen,
  onCloseMobile,
}: AdminSidebarProps) {
  const bn = language === 'bn';

  const groups: Array<{
    title: string;
    items: Array<{
      id: AdminTabId;
      label: string;
      icon: typeof Sparkles;
      count?: number;
      alert?: boolean;
    }>;
  }> = [
    {
      title: bn ? 'মনিটরিং' : 'Monitoring',
      items: [
        { id: 'overview', label: t('adminTabOverview'), icon: Sparkles },
        {
          id: 'chat_audit',
          label: t('adminTabChatAudit'),
          icon: MessageSquare,
          count: totalChatsCount,
        },
        {
          id: 'reports',
          label: t('adminTabReports'),
          icon: Flag,
          count: pendingReportsCount,
          alert: pendingReportsCount > 0,
        },
      ],
    },
    {
      title: bn ? 'ইউজার ও সুরক্ষা' : 'Users & Safety',
      items: [
        {
          id: 'users',
          label: t('adminTabUsers'),
          icon: Users,
          count: totalUsersCount,
        },
        {
          id: 'recovery',
          label: t('adminTabRecovery'),
          icon: KeyRound,
          count: pendingRecoveryCount,
          alert: pendingRecoveryCount > 0,
        },
        {
          id: 'security_policy',
          label: bn ? 'সিকিউরিটি নীতি' : 'Security Policy',
          icon: ShieldCheck,
        },
      ],
    },
    {
      title: bn ? 'প্ল্যাটফর্ম' : 'Platform',
      items: [
        { id: 'announcements', label: t('adminTabAnnouncements'), icon: Radio },
        {
          id: 'backup',
          label: bn ? 'ড্রাইভ ব্যাকআপ' : 'Drive Backup',
          icon: HardDrive,
        },
        {
          id: 'updates',
          label: bn ? 'APK রিলিজ' : 'APK Releases',
          icon: Rocket,
        },
        { id: 'logs', label: t('adminTabLogs'), icon: FileText },
      ],
    },
  ];

  const navBody = (
    <div className="flex flex-col h-full justify-between p-3 select-none">
      <div className="space-y-5 overflow-y-auto pr-0.5">
        {groups.map((group) => (
          <div key={group.title} className="space-y-1">
            <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {group.title}
            </div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectTab(item.id);
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs font-medium transition cursor-pointer text-left ${
                    isActive
                      ? 'bg-slate-800 text-white border border-slate-700/80'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-emerald-400' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {typeof item.count === 'number' && item.count > 0 && (
                    <span
                      className={`text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded-md shrink-0 ${
                        item.alert
                          ? 'bg-rose-500/20 text-rose-300 font-bold'
                          : 'text-slate-400'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bottom Root Identity */}
      <div className="pt-3 mt-3 border-t border-slate-800 px-2 space-y-1">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
          <Shield className="w-3.5 h-3.5 shrink-0" />
          <span>{t('superAdminBadge')}</span>
        </div>
        <div className="text-[10px] font-mono text-slate-500 truncate">{SUPER_ADMIN_EMAIL}</div>
        <div className="text-[10px] font-mono tabular-nums text-slate-500">
          v{APP_VERSION.versionName}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Static Sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 bg-slate-950/70 border-r border-slate-800 flex-col overflow-hidden">
        {navBody}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <aside className="relative z-10 w-64 max-w-[82vw] h-full bg-slate-950 border-r border-slate-800 flex flex-col shadow-2xl">
            <div className="h-14 px-3.5 border-b border-slate-800 flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>{t('adminPanelTitle')}</span>
              </span>
              <button
                type="button"
                onClick={onCloseMobile}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">{navBody}</div>
          </aside>
        </div>
      )}
    </>
  );
}
