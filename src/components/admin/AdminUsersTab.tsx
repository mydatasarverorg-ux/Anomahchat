import { AlertTriangle, BarChart3, CheckCircle2, Eye, Lock, MessageSquare, Search } from 'lucide-react';
import { SUPER_ADMIN_EMAIL } from '../../services/adminService';
import type { UserProfile } from '../../types/chat';

interface AdminUsersTabProps {
  t: (key: any) => string;
  language: string;
  currentUserEmail?: string;
  filteredUsers: UserProfile[];
  userSearch: string;
  setUserSearch: (val: string) => void;
  userFilter: 'all' | 'active' | 'banned' | 'warned' | 'online';
  setUserFilter: (val: 'all' | 'active' | 'banned' | 'warned' | 'online') => void;
  onOpenDossier: (u: UserProfile) => void;
  onInspectChats: (u: UserProfile) => void;
  onEnterGhostMode?: (u: UserProfile) => void;
  onUnban: (u: UserProfile) => void;
  onOpenBan: (u: UserProfile) => void;
  onClearWarning: (u: UserProfile) => void;
  onOpenWarn: (u: UserProfile) => void;
}

export function AdminUsersTab({
  t,
  language,
  currentUserEmail,
  filteredUsers,
  userSearch,
  setUserSearch,
  userFilter,
  setUserFilter,
  onOpenDossier,
  onInspectChats,
  onEnterGhostMode,
  onUnban,
  onOpenBan,
  onClearWarning,
  onOpenWarn,
}: AdminUsersTabProps) {
  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row gap-2.5 justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder={t('searchUsersPlaceholder')}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto text-xs scrollbar-none">
          {(['all', 'active', 'banned', 'warned', 'online'] as const).map((filterKey) => (
            <button
              key={filterKey}
              onClick={() => setUserFilter(filterKey)}
              className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer whitespace-nowrap ${
                userFilter === filterKey
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {filterKey === 'all'
                ? t('filterAllUsers')
                : filterKey === 'active'
                ? t('filterActiveUsers')
                : filterKey === 'banned'
                ? t('filterBannedUsers')
                : filterKey === 'warned'
                ? t('filterWarnedUsers')
                : t('filterOnlineUsers')}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredUsers.map((u) => {
          const isSelf = u.email === currentUserEmail;
          return (
            <div
              key={u.userId}
              className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between gap-3 hover:border-slate-700 transition"
            >
              <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                  <img
                    src={u.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.userId}`}
                    alt={u.displayName}
                    className="w-11 h-11 rounded-full object-cover bg-slate-800 border border-slate-700"
                  />
                  {u.isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-white truncate">{u.displayName}</span>
                    {u.email === SUPER_ADMIN_EMAIL ? (
                      <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[9px] font-bold">
                        {t('userRoleAdmin')}
                      </span>
                    ) : u.isBanned ? (
                      <span className="px-1.5 py-0.5 rounded-md bg-red-500/20 text-red-300 text-[9px] font-bold">
                        {t('userStatusBanned')}
                      </span>
                    ) : u.warningNotice ? (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[9px] font-bold">
                        {t('userStatusWarned')}
                      </span>
                    ) : null}
                    {u.hasAppLockPin && (
                      <span
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-sky-500/15 text-sky-300 border border-sky-500/30 text-[9px] font-semibold"
                        title={language === 'bn' ? 'অ্যাপ-লক চালু আছে' : 'App-Lock PIN active'}
                      >
                        <Lock className="w-2.5 h-2.5" />
                        <span>LOCK</span>
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">{u.email}</div>
                  {u.username && (
                    <div className="text-[10px] text-slate-500 font-mono">@{u.username}</div>
                  )}
                </div>
              </div>

              {u.isBanned && (
                <div className="bg-red-950/30 border border-red-900/40 rounded-xl p-2.5 text-[11px] text-red-200 space-y-1">
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <span className="font-semibold text-red-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {u.bannedUntil ? (
                        <span>{language === 'bn' ? 'সাময়িক স্থগিতাদেশ' : 'Temporary Suspension'}</span>
                      ) : (
                        <span>{t('suspensionPermanentNotice')}</span>
                      )}
                    </span>
                    {u.bannedUntil && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        {t('suspensionExpiresAt').replace('{date}', new Date(u.bannedUntil).toLocaleDateString())}
                      </span>
                    )}
                  </div>
                  <div className="text-slate-300 text-[11px] leading-relaxed">
                    <span className="text-slate-400 font-medium">{language === 'bn' ? 'কারণ: ' : 'Reason: '}</span>
                    {u.banReason || 'Platform guidelines violation.'}
                  </div>
                </div>
              )}

              {u.warningNotice && !u.isBanned && (
                <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-2 text-[11px] text-amber-200">
                  <span className="font-semibold block">Active Warning:</span>
                  <span className="text-slate-300">{u.warningNotice}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => onOpenDossier(u)}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 rounded-lg text-[11px] font-medium transition cursor-pointer border border-emerald-500/20 flex items-center gap-1.5"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>{t('viewUserDossierBtn')}</span>
                  </button>

                  <button
                    onClick={() => onInspectChats(u)}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-sky-400 hover:text-sky-300 rounded-lg text-[11px] font-medium transition cursor-pointer border border-sky-500/20 flex items-center gap-1.5"
                    title={language === 'bn' ? `${u.displayName}-এর চ্যাটগুলো দেখুন` : `View ${u.displayName}'s chats`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{t('inspectUserChatsBtn')}</span>
                  </button>

                  {onEnterGhostMode && (
                    <button
                      onClick={() => onEnterGhostMode(u)}
                      className="px-2.5 py-1 bg-gradient-to-r from-sky-600/30 to-indigo-600/30 hover:from-sky-600 hover:to-indigo-600 text-sky-200 hover:text-white rounded-lg text-[11px] font-semibold transition cursor-pointer border border-sky-500/40 flex items-center gap-1.5 shadow-sm"
                      title={language === 'bn' ? `${u.displayName}-এর আসল ইনবক্সে প্রবেশ করুন` : `Enter ${u.displayName}'s DM Inbox`}
                    >
                      <Eye className="w-3.5 h-3.5 text-sky-400" />
                      <span>{t('enterDmInboxBtn')}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {isSelf ? (
                    <span className="text-[10px] text-slate-500 italic">Self (Protected)</span>
                  ) : (
                    <>
                      {u.isBanned ? (
                        <button
                          onClick={() => onUnban(u)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 shadow-sm"
                          title={t('unsuspendUserBtn')}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{t('unsuspendUserBtn')}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => onOpenBan(u)}
                          className="px-2.5 py-1 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-[11px] font-medium transition cursor-pointer"
                        >
                          {t('banUserBtn')}
                        </button>
                      )}

                      {u.warningNotice ? (
                        <button
                          onClick={() => onClearWarning(u)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg text-[11px] font-medium transition cursor-pointer"
                        >
                          {t('clearWarningBtn')}
                        </button>
                      ) : (
                        <button
                          onClick={() => onOpenWarn(u)}
                          className="px-2.5 py-1 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded-lg text-[11px] font-medium transition cursor-pointer border border-amber-500/30"
                        >
                          {t('warnUserBtn')}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
