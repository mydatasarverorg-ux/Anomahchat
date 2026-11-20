import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Eye,
  Laptop,
  Lock,
  MessageSquare,
  Phone,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { SUPER_ADMIN_EMAIL } from '../../services/adminService';
import type { AppSecuritySettings, PhoneRegistryEntry, UserProfile } from '../../types/chat';

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
  securityPolicyBusy?: boolean;
  onSaveGlobalSecuritySettings?: (settings: {
    defaultMobileLimit: number;
    defaultWebLimit: number;
    requireApprovalForNewDevice: boolean;
  }) => Promise<void>;
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
  securityPolicyBusy = false,
  onSaveGlobalSecuritySettings,
}: AdminUsersTabProps) {
  const [mobileLimitDraft, setMobileLimitDraft] = useState<string>(
    String(globalSecuritySettings?.defaultMobileLimit ?? 1)
  );
  const [webLimitDraft, setWebLimitDraft] = useState<string>(
    String(globalSecuritySettings?.defaultWebLimit ?? 1)
  );
  const [requireApprovalDraft, setRequireApprovalDraft] = useState<boolean>(
    globalSecuritySettings?.requireApprovalForNewDevice !== false
  );

  useEffect(() => {
    if (!globalSecuritySettings) return;
    setMobileLimitDraft(String(globalSecuritySettings.defaultMobileLimit));
    setWebLimitDraft(String(globalSecuritySettings.defaultWebLimit));
    setRequireApprovalDraft(globalSecuritySettings.requireApprovalForNewDevice !== false);
  }, [
    globalSecuritySettings?.defaultMobileLimit,
    globalSecuritySettings?.defaultWebLimit,
    globalSecuritySettings?.requireApprovalForNewDevice,
  ]);

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Global Device Limit & Login Approval Control */}
      {globalSecuritySettings && onSaveGlobalSecuritySettings && (
        <div className="p-3.5 sm:p-4 bg-slate-950/90 border border-slate-800 rounded-2xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-white">
                  {language === 'bn'
                    ? 'গ্লোবাল ডিভাইস সীমা ও নতুন লগইন অনুমোদন নিয়ন্ত্রণ'
                    : 'Global Device Limits & New Login Approval Policy'}
                </h4>
                <p className="text-[10px] text-slate-400">
                  {language === 'bn'
                    ? 'প্রতি ইউজার সর্বোচ্চ কয়টি মোবাইল (APK/মোবাইল ব্রাউজার) ও ওয়েব/পিসি চালাতে পারবে তা এখান থেকে নিয়ন্ত্রণ করুন।'
                    : 'Control how many Mobile (APK/Mobile Browser) and PC/Web sessions each account can run concurrently.'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end text-xs">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                <Smartphone className="w-3 h-3 text-emerald-400" />
                <span>{language === 'bn' ? 'সর্বোচ্চ মোবাইল সংখ্যা' : 'Max Mobile Devices'}</span>
              </label>
              <input
                type="number"
                min={0}
                max={20}
                value={mobileLimitDraft}
                onChange={(e) => setMobileLimitDraft(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                <Laptop className="w-3 h-3 text-sky-400" />
                <span>{language === 'bn' ? 'সর্বোচ্চ ওয়েব/পিসি' : 'Max PC / Web'}</span>
              </label>
              <input
                type="number"
                min={0}
                max={20}
                value={webLimitDraft}
                onChange={(e) => setWebLimitDraft(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-[11px] text-slate-300 font-medium">
                {language === 'bn' ? 'নতুন ডিভাইস অনুমোদন' : 'Require Approval'}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={requireApprovalDraft}
                onClick={() => setRequireApprovalDraft((prev) => !prev)}
                className={`w-10 h-5 rounded-full transition relative shrink-0 cursor-pointer ${
                  requireApprovalDraft ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`block w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${
                    requireApprovalDraft ? 'translate-x-5.5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <button
              type="button"
              disabled={securityPolicyBusy}
              onClick={() => {
                const m = Math.min(20, Math.max(0, Number(mobileLimitDraft) || 0));
                const w = Math.min(20, Math.max(0, Number(webLimitDraft) || 0));
                onSaveGlobalSecuritySettings({
                  defaultMobileLimit: m,
                  defaultWebLimit: w,
                  requireApprovalForNewDevice: requireApprovalDraft,
                });
              }}
              className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition shadow"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? 'নীতি সেভ করুন' : 'Save Policy'}</span>
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2.5 justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder={
              language === 'bn'
                ? 'নাম, ইমেইল, @ইউজারনেম, মোবাইল নম্বর বা আইডি দিয়ে খুঁজুন...'
                : 'Search by name, email, @username, mobile number or ID...'
            }
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
                    {u.status === 'scheduled_for_deletion' && (
                      <span className="px-1.5 py-0.5 rounded-md bg-orange-500/20 text-orange-300 border border-orange-500/30 text-[9px] font-bold">
                        {language === 'bn' ? 'ডিলিট পেন্ডিং' : 'DELETION PENDING'}
                      </span>
                    )}
                    {u.status === 'deleted' && (
                      <span className="px-1.5 py-0.5 rounded-md bg-slate-700/70 text-slate-300 border border-slate-600 text-[9px] font-bold">
                        {language === 'bn' ? 'ডিলিট হয়েছে' : 'DELETED'}
                      </span>
                    )}
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
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    {u.username && (
                      <span className="text-[10px] text-slate-500 font-mono">@{u.username}</span>
                    )}
                    {u.phoneNumber && (() => {
                      const reg = userPhoneRegistryMap?.[u.userId];
                      const used = reg?.accountUids?.length ?? 0;
                      const limit = reg?.maxLimit ?? 3;
                      const linkedLabels = (reg?.accountUids || []).map((uid) => {
                        const match = allUsersList.find((x) => x.userId === uid);
                        if (!match) return `UID:${uid.slice(0, 6)}...`;
                        if (match.status === 'deleted') return `${match.displayName} (${language === 'bn' ? 'ডিলিট' : 'Deleted'})`;
                        if (match.status === 'scheduled_for_deletion') return `${match.displayName} (${language === 'bn' ? 'ডিলিট পেন্ডিং' : 'Pending Del'})`;
                        return match.displayName;
                      });
                      return (
                        <span className="inline-flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-emerald-400/90 font-mono inline-flex items-center gap-1">
                              <Phone className="w-2.5 h-2.5" />
                              {u.phoneNumber}
                            </span>
                            {reg && (
                              <button
                                type="button"
                                onClick={() => onOpenDossier(u)}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold inline-flex items-center gap-0.5 border cursor-pointer hover:opacity-90 transition ${
                                  reg.isBlocked
                                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                    : used >= limit
                                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                    : 'bg-slate-800 text-slate-300 border-slate-700'
                                }`}
                                title={
                                  language === 'bn'
                                    ? `এই নম্বরে যুক্ত (${used}/${limit}): ${linkedLabels.join(', ')} — বিস্তারিত দেখতে ক্লিক করুন`
                                    : `Linked (${used}/${limit}): ${linkedLabels.join(', ')} — click to manage`
                                }
                              >
                                {reg.isBlocked && <ShieldAlert className="w-2.5 h-2.5" />}
                                <span>{used}/{limit}</span>
                                {reg.isBlocked ? (
                                  <span>LOCK</span>
                                ) : used >= limit ? (
                                  <span>FULL</span>
                                ) : null}
                              </button>
                            )}
                            {u.initialPhoneNumber && u.initialPhoneNumber !== u.phoneNumber && (
                              <span
                                className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/25"
                                title={
                                  language === 'bn'
                                    ? 'সর্বপ্রথম রেজিস্ট্রি করা নম্বর'
                                    : 'First Registered Phone Number'
                                }
                              >
                                {language === 'bn' ? 'প্রথম:' : '1st:'} {u.initialPhoneNumber}
                              </span>
                            )}
                            {u.deviceLimits &&
                              (typeof u.deviceLimits.mobile === 'number' ||
                                typeof u.deviceLimits.web === 'number') && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-sky-500/10 text-sky-300 border border-sky-500/25">
                                  {language === 'bn' ? 'ডিভাইস:' : 'Dev:'} M:
                                  {u.deviceLimits.mobile ??
                                    globalSecuritySettings?.defaultMobileLimit ??
                                    1}{' '}
                                  W:
                                  {u.deviceLimits.web ??
                                    globalSecuritySettings?.defaultWebLimit ??
                                    1}
                                </span>
                              )}
                          </span>
                          {reg && linkedLabels.length > 1 && (
                            <span className="text-[9px] text-slate-400 leading-tight">
                              {language === 'bn' ? 'কোটায় যুক্ত:' : 'Linked:'} {linkedLabels.join(', ')}
                            </span>
                          )}
                        </span>
                      );
                    })()}
                  </div>
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
