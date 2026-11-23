import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Eye,
  Lock,
  MessageSquare,
  Phone,
  Search,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { SUPER_ADMIN_EMAIL } from '../../services/adminService';
import type {
  AppSecuritySettings,
  PhoneRegistryEntry,
  UserProfile,
} from '../../types/chat';

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
  userPhoneRegistryMap?: Record<string, PhoneRegistryEntry>;
  allUsersList?: UserProfile[];
  globalSecuritySettings?: AppSecuritySettings;
  onOpenSecurityPolicy?: () => void;
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
  userPhoneRegistryMap,
  allUsersList = [],
  globalSecuritySettings,
  onOpenSecurityPolicy,
}: AdminUsersTabProps) {
  const bn = language === 'bn';

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Slim Global Policy Strip (Full settings live cleanly in Security Policy tab) */}
      {globalSecuritySettings && onOpenSecurityPolicy && (
        <div className="px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-300 flex-wrap">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">
              {bn ? 'ডিফল্ট কোটা:' : 'Default Quota:'}
            </span>
            <span className="font-mono tabular-nums text-slate-400">
              {bn
                ? `মোবাইল ${globalSecuritySettings.defaultMobileLimit} · ওয়েব ${globalSecuritySettings.defaultWebLimit} · 2FA: ${globalSecuritySettings.newDeviceApprovalMode}`
                : `Mobile ${globalSecuritySettings.defaultMobileLimit} · Web ${globalSecuritySettings.defaultWebLimit} · 2FA: ${globalSecuritySettings.newDeviceApprovalMode}`}
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenSecurityPolicy}
            className="text-xs font-semibold text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <span>{bn ? 'নীতি পরিবর্তন করুন' : 'Configure Policy'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Search & Status Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5 justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder={
              bn
                ? 'নাম, ইমেইল, @ইউজারনেম, মোবাইল নম্বর বা আইডি দিয়ে খুঁজুন...'
                : 'Search by name, email, @username, mobile number or ID...'
            }
            className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
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
                  : 'bg-slate-950/80 border border-slate-800 text-slate-400 hover:text-white'
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

      {/* User Directory Cards (Clean single-elevation 1px border, low badge noise) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredUsers.map((u) => {
          const isSelf = u.email === currentUserEmail;
          const reg = u.phoneNumber ? userPhoneRegistryMap?.[u.userId] : undefined;
          const used = reg?.accountUids?.length ?? 0;
          const limit = reg?.maxLimit ?? 3;
          const linkedLabels = (reg?.accountUids || []).map((uid) => {
            const match = allUsersList.find((x) => x.userId === uid);
            if (!match) return `UID:${uid.slice(0, 6)}...`;
            if (match.status === 'deleted')
              return `${match.displayName} (${bn ? 'ডিলিট' : 'Deleted'})`;
            if (match.status === 'scheduled_for_deletion')
              return `${match.displayName} (${bn ? 'ডিলিট পেন্ডিং' : 'Pending Del'})`;
            return match.displayName;
          });

          return (
            <div
              key={u.userId}
              className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3 hover:border-slate-700 transition"
            >
              <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                  <img
                    src={u.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.userId}`}
                    alt={u.displayName}
                    className="w-10 h-10 rounded-full object-cover bg-slate-800 border border-slate-700"
                  />
                  {u.isOnline && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-950" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-white truncate">{u.displayName}</span>
                    {u.email === SUPER_ADMIN_EMAIL ? (
                      <span className="text-[10px] font-semibold text-emerald-400">
                        · {t('userRoleAdmin')}
                      </span>
                    ) : u.isBanned ? (
                      <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 text-[10px] font-semibold">
                        {t('userStatusBanned')}
                      </span>
                    ) : u.warningNotice ? (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px] font-semibold">
                        {t('userStatusWarned')}
                      </span>
                    ) : null}
                    {u.status === 'scheduled_for_deletion' && (
                      <span className="px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-300 text-[10px] font-semibold">
                        {bn ? 'ডিলিট পেন্ডিং' : 'Deletion Pending'}
                      </span>
                    )}
                    {u.status === 'deleted' && (
                      <span className="text-[10px] font-medium text-slate-400">
                        · {bn ? 'ডিলিট হয়েছে' : 'Deleted'}
                      </span>
                    )}
                    {u.hasAppLockPin && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[10px] text-sky-400"
                        title={bn ? 'অ্যাপ-লক চালু আছে' : 'App-Lock PIN active'}
                      >
                        <Lock className="w-3 h-3" />
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                    {u.email}
                    {u.username && <span className="font-mono text-slate-500"> · @{u.username}</span>}
                  </div>

                  {u.phoneNumber && (
                    <div className="mt-1 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap text-[11px]">
                        <span className="text-emerald-400 font-mono inline-flex items-center gap-1 tabular-nums">
                          <Phone className="w-3 h-3" />
                          {u.phoneNumber}
                        </span>
                        {reg && (
                          <button
                            type="button"
                            onClick={() => onOpenDossier(u)}
                            className={`text-[10px] font-mono tabular-nums font-semibold cursor-pointer hover:underline inline-flex items-center gap-1 ${
                              reg.isBlocked
                                ? 'text-rose-400'
                                : used >= limit
                                ? 'text-amber-400'
                                : 'text-slate-400'
                            }`}
                            title={
                              bn
                                ? `যুক্ত (${used}/${limit}): ${linkedLabels.join(', ')}`
                                : `Linked (${used}/${limit}): ${linkedLabels.join(', ')}`
                            }
                          >
                            {reg.isBlocked && <ShieldAlert className="w-3 h-3" />}
                            <span>
                              · {used}/{limit}
                              {reg.isBlocked ? ' LOCK' : used >= limit ? ' FULL' : ''}
                            </span>
                          </button>
                        )}
                        {u.initialPhoneNumber && u.initialPhoneNumber !== u.phoneNumber && (
                          <span className="text-[10px] font-mono text-amber-300">
                            · {bn ? 'প্রথম:' : '1st:'} {u.initialPhoneNumber}
                          </span>
                        )}
                      </div>
                      {reg && linkedLabels.length > 1 && (
                        <div className="text-[10px] text-slate-500 truncate">
                          {bn ? 'কোটায় যুক্ত:' : 'Linked:'} {linkedLabels.join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {u.isBanned && (
                <div className="bg-red-950/25 border border-red-900/40 rounded-xl p-2.5 text-[11px] text-red-200 space-y-1">
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <span className="font-semibold text-red-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {u.bannedUntil ? (
                        <span>{bn ? 'সাময়িক স্থগিতাদেশ' : 'Temporary Suspension'}</span>
                      ) : (
                        <span>{t('suspensionPermanentNotice')}</span>
                      )}
                    </span>
                    {u.bannedUntil && (
                      <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                        {t('suspensionExpiresAt').replace(
                          '{date}',
                          new Date(u.bannedUntil).toLocaleDateString()
                        )}
                      </span>
                    )}
                  </div>
                  <div className="text-slate-300 leading-relaxed">
                    <span className="text-slate-400">{bn ? 'কারণ: ' : 'Reason: '}</span>
                    {u.banReason || 'Platform guidelines violation.'}
                  </div>
                </div>
              )}

              {u.warningNotice && !u.isBanned && (
                <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-2.5 text-[11px] text-amber-200">
                  <span className="font-semibold block">{bn ? 'সতর্কতা:' : 'Active Warning:'}</span>
                  <span className="text-slate-300">{u.warningNotice}</span>
                </div>
              )}

              {/* Clean Single-Line Action Footer */}
              <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/80 text-xs gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => onOpenDossier(u)}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-emerald-400 rounded-lg text-[11px] font-medium transition cursor-pointer border border-slate-800 inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>{t('viewUserDossierBtn')}</span>
                  </button>

                  <button
                    onClick={() => onInspectChats(u)}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-sky-400 rounded-lg text-[11px] font-medium transition cursor-pointer border border-slate-800 inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{t('inspectUserChatsBtn')}</span>
                  </button>

                  {onEnterGhostMode && (
                    <button
                      onClick={() => onEnterGhostMode(u)}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-lg text-[11px] font-medium transition cursor-pointer border border-slate-800 inline-flex items-center gap-1 whitespace-nowrap"
                    >
                      <Eye className="w-3.5 h-3.5 text-sky-400" />
                      <span>{t('enterDmInboxBtn')}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isSelf ? (
                    <span className="text-[10px] text-slate-500">Self</span>
                  ) : (
                    <>
                      {u.isBanned ? (
                        <button
                          onClick={() => onUnban(u)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-semibold transition cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{t('unsuspendUserBtn')}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => onOpenBan(u)}
                          className="px-2.5 py-1 bg-red-600/85 hover:bg-red-600 text-white rounded-lg text-[11px] font-medium transition cursor-pointer whitespace-nowrap"
                        >
                          {t('banUserBtn')}
                        </button>
                      )}

                      {u.warningNotice ? (
                        <button
                          onClick={() => onClearWarning(u)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-medium transition cursor-pointer whitespace-nowrap"
                        >
                          {t('clearWarningBtn')}
                        </button>
                      ) : (
                        <button
                          onClick={() => onOpenWarn(u)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-amber-300 rounded-lg text-[11px] font-medium transition cursor-pointer border border-slate-800 whitespace-nowrap"
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
