import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  banUser,
  unbanUser,
  issueWarning,
  clearWarning,
  subscribeToReports,
  updateReportStatus,
  deleteReport,
  subscribeToAnnouncements,
  createAnnouncement,
  toggleAnnouncement,
  deleteAnnouncement,
  subscribeToAdminLogs,
  deleteAdminMessage,
  subscribeToRecoveryRequests,
  resolveRecoveryRequest,
  dismissRecoveryRequest,
  adminClearUserAppLock,
  backfillDirectoryFromUsers,
  subscribeToAllChatsForAdmin,
  subscribeToChatMessagesForAdmin,
  SUPER_ADMIN_EMAIL,
} from '../services/adminService';
import {
  publishAppRelease,
  subscribeToLatestRelease,
  type AppReleaseInfo,
} from '../services/updateService';
import type {
  UserProfile,
  UserReport,
  SystemAnnouncement,
  AdminAuditLog,
  AnnouncementType,
  PasswordRecoveryRequest,
  ChatRoom,
  ChatMessage,
} from '../types/chat';
import {
  Shield,
  Users,
  Flag,
  Radio,
  FileText,
  CheckCircle2,
  Rocket,
  X,
  ArrowLeft,
  KeyRound,
  MessageSquare,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { AdminOverviewTab } from './admin/AdminOverviewTab';
import { AdminUsersTab } from './admin/AdminUsersTab';
import { AdminChatAuditTab } from './admin/AdminChatAuditTab';
import { AdminRecoveryTab } from './admin/AdminRecoveryTab';
import { AdminReportsTab } from './admin/AdminReportsTab';
import { AdminAnnouncementsTab } from './admin/AdminAnnouncementsTab';
import { AdminReleaseTab } from './admin/AdminReleaseTab';
import { AdminLogsTab } from './admin/AdminLogsTab';
import { AdminModals } from './admin/AdminModals';

interface AdminModalProps {
  onClose: () => void;
  onEnterGhostMode?: (user: UserProfile, targetChatId?: string) => void;
}

export function AdminModal({ onClose, onEnterGhostMode }: AdminModalProps) {
  const { user } = useAuth();
  const { t, language } = useLanguage();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'users' | 'chat_audit' | 'recovery' | 'reports' | 'announcements' | 'logs' | 'updates'
  >('overview');

  const [currentLiveRelease, setCurrentLiveRelease] = useState<AppReleaseInfo | null>(null);
  const [releaseVersionName, setReleaseVersionName] = useState('1.0.6');
  const [releaseVersionCode, setReleaseVersionCode] = useState('106');
  const [releaseApkUrl, setReleaseApkUrl] = useState('https://github.com/mydatasarverorg-ux/Anomahchat/releases/latest/download/AnomahChat.apk');
  const [releaseApkSha256, setReleaseApkSha256] = useState('');
  const [releaseFileSizeText, setReleaseFileSizeText] = useState('9.6 MB');
  const [releaseChangelogEn, setReleaseChangelogEn] = useState(
    '• Hardened Firestore Zero-Trust Security Rules\n• Signed Release APK & SHA-256 Auto-Update Verification\n• Version Mahi A06 release'
  );
  const [releaseChangelogBn, setReleaseChangelogBn] = useState(
    '• সুরক্ষিত ফায়ারস্টোর ডাটাবেজ ও অ্যাকাউন্ট প্রটেকশন\n• SHA-256 ভেরিফাইড রিলিজ APK অটো-আপডেট\n• সংস্করণ মাহি A06 রিলিজ'
  );
  const [releaseForceUpdate, setReleaseForceUpdate] = useState(false);
  const [publishingRelease, setPublishingRelease] = useState(false);

  useEffect(() => {
    window.history.pushState({ modal: 'adminModal' }, '');
    const handlePopState = () => onClose();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'active' | 'banned' | 'warned' | 'online'>('all');
  const [selectedDossierUser, setSelectedDossierUser] = useState<UserProfile | null>(null);
  const [isClearingLock, setIsClearingLock] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const didBackfillRef = useRef(false);

  const [allChats, setAllChats] = useState<ChatRoom[]>([]);
  const [chatSearch, setChatSearch] = useState('');
  const [selectedChat, setSelectedChat] = useState<ChatRoom | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatFilter, setChatFilter] = useState<'all' | 'direct' | 'group'>('all');
  const [targetUserChatFilter, setTargetUserChatFilter] = useState<UserProfile | null>(null);
  const [mobileChatView, setMobileChatView] = useState<'list' | 'messages'>('list');

  const handleInspectUserChats = (targetUser: UserProfile) => {
    setTargetUserChatFilter(targetUser);
    setSelectedDossierUser(null);
    setActiveTab('chat_audit');
    setMobileChatView('messages');
    const userChats = allChats.filter(
      (c) => c.participantIds && c.participantIds.includes(targetUser.userId)
    );
    setSelectedChat(userChats.length > 0 ? userChats[0] : null);
  };

  const [recoveryRequests, setRecoveryRequests] = useState<PasswordRecoveryRequest[]>([]);
  const [recoveryFilter, setRecoveryFilter] = useState<'all' | 'pending' | 'resolved' | 'dismissed'>('all');
  const [selectedRecovery, setSelectedRecovery] = useState<PasswordRecoveryRequest | null>(null);
  const [resolvingRecovery, setResolvingRecovery] = useState(false);
  const [recoveryAdminNotes, setRecoveryAdminNotes] = useState('');

  const [reports, setReports] = useState<UserReport[]>([]);
  const [reportFilter, setReportFilter] = useState<'all' | 'pending' | 'resolved' | 'dismissed'>('all');

  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnContent, setNewAnnContent] = useState('');
  const [newAnnType, setNewAnnType] = useState<AnnouncementType>('info');
  const [publishingAnn, setPublishingAnn] = useState(false);

  const [logs, setLogs] = useState<AdminAuditLog[]>([]);

  const [banTarget, setBanTarget] = useState<UserProfile | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] = useState<'1' | '3' | '7' | '30' | 'permanent'>('7');
  const [isBanning, setIsBanning] = useState(false);

  const [warnTarget, setWarnTarget] = useState<UserProfile | null>(null);
  const [warnText, setWarnText] = useState('');
  const [isWarning, setIsWarning] = useState(false);

  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const list: UserProfile[] = [];
        snapshot.forEach((d) => {
          list.push(d.data() as UserProfile);
        });
        setUsersList(list);

        if (!didBackfillRef.current && list.length > 0) {
          didBackfillRef.current = true;
          backfillDirectoryFromUsers(list).catch(() => {});
        }

        if (selectedDossierUser) {
          const fresh = list.find((u) => u.userId === selectedDossierUser.userId);
          if (fresh) setSelectedDossierUser(fresh);
        }
      },
      (error) => {
        console.warn('Admin users snapshot notice:', error);
      }
    );
    return () => unsubscribe();
  }, [selectedDossierUser]);

  useEffect(() => subscribeToAllChatsForAdmin((data) => setAllChats(data)), []);

  useEffect(() => {
    if (!selectedChat) {
      setChatMessages([]);
      return;
    }
    return subscribeToChatMessagesForAdmin(selectedChat.id, (msgs) => setChatMessages(msgs));
  }, [selectedChat]);

  useEffect(() => subscribeToRecoveryRequests((data) => setRecoveryRequests(data)), []);
  useEffect(() => subscribeToReports((data) => setReports(data)), []);
  useEffect(() => subscribeToAnnouncements(false, (data) => setAnnouncements(data)), []);
  useEffect(() => subscribeToAdminLogs((data) => setLogs(data)), []);

  useEffect(() => {
    return subscribeToLatestRelease((rel) => {
      setCurrentLiveRelease(rel);
      if (rel) {
        setReleaseVersionName(rel.versionName);
        setReleaseVersionCode(String(rel.versionCode));
        setReleaseApkUrl(rel.apkDownloadUrl || '');
        setReleaseApkSha256(rel.apkSha256 || '');
        setReleaseFileSizeText(rel.fileSizeText || '9.6 MB');
        setReleaseChangelogEn(rel.changelogEn || '');
        setReleaseChangelogBn(rel.changelogBn || '');
        setReleaseForceUpdate(Boolean(rel.forceUpdate));
      }
    });
  }, []);

  const showSuccessBanner = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 3000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handlePublishRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!releaseVersionName.trim() || !releaseVersionCode || !releaseApkUrl.trim() || !user) return;
    setPublishingRelease(true);
    setActionErrorMsg(null);
    try {
      let parsedCode = parseInt(releaseVersionCode, 10) || 106;
      if (parsedCode < 10) {
        parsedCode = parsedCode * 100 + (parsedCode === 2 ? 2 : 0);
      }
      await publishAppRelease(
        {
          versionName: releaseVersionName.trim(),
          versionCode: parsedCode,
          apkDownloadUrl: releaseApkUrl.trim(),
          apkSha256: releaseApkSha256.trim() || undefined,
          fileSizeText: releaseFileSizeText.trim() || undefined,
          changelogEn: releaseChangelogEn.trim(),
          changelogBn: releaseChangelogBn.trim(),
          forceUpdate: releaseForceUpdate,
          publishedBy: user.email || SUPER_ADMIN_EMAIL,
        },
        user.email || SUPER_ADMIN_EMAIL
      );
      showSuccessBanner(
        language === 'bn'
          ? `v${releaseVersionName.trim()} রিলিজ সফলভাবে ক্লাউডে পাবলিশ হয়েছে! সকল ডিভাইস আপডেট নোটিফিকেশন পাবে।`
          : `Release v${releaseVersionName.trim()} published! All connected client devices will get update prompt.`
      );
    } catch (err) {
      console.error('Failed to publish release:', err);
      setActionErrorMsg(err instanceof Error ? err.message : 'Failed to publish release.');
    } finally {
      setPublishingRelease(false);
    }
  };

  const handleConfirmBan = async () => {
    if (!banTarget || !user?.email) return;
    try {
      setIsBanning(true);
      await banUser(
        banTarget.userId,
        banTarget.email,
        banTarget.displayName,
        banReason,
        user.email,
        banDuration === 'permanent' ? 'permanent' : Number(banDuration)
      );
      const targetName = banTarget.displayName;
      setBanTarget(null);
      setBanReason('');
      setBanDuration('7');
      showSuccessBanner(
        language === 'bn'
          ? `${targetName}-কে সফলভাবে স্থগিত করা হয়েছে।`
          : `Suspended ${targetName} successfully.`
      );
    } catch (err) {
      console.error(err);
      setActionErrorMsg(err instanceof Error ? err.message : 'Suspension failed.');
    } finally {
      setIsBanning(false);
    }
  };

  const handleConfirmUnban = async (u: UserProfile) => {
    if (!user?.email) return;
    try {
      await unbanUser(u.userId, u.email, u.displayName, user.email);
      showSuccessBanner(
        language === 'bn'
          ? `${u.displayName}-এর অ্যাকাউন্ট পুনরায় সফলভাবে সচল করা হয়েছে।`
          : `Reactivated ${u.displayName} successfully.`
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmWarn = async () => {
    if (!warnTarget || !user?.email) return;
    try {
      setIsWarning(true);
      await issueWarning(warnTarget.userId, warnTarget.email, warnTarget.displayName, warnText, user.email);
      setWarnTarget(null);
      setWarnText('');
      showSuccessBanner(`Issued official warning to ${warnTarget.displayName}.`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsWarning(false);
    }
  };

  const handleClearWarning = async (u: UserProfile) => {
    if (!user?.email) return;
    try {
      await clearWarning(u.userId, u.email, u.displayName, user.email);
      showSuccessBanner(`Cleared warning for ${u.displayName}.`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearUserAppLock = async () => {
    if (!selectedDossierUser || !user?.email) return;
    try {
      setIsClearingLock(true);
      await adminClearUserAppLock(selectedDossierUser.userId, user.email);
      showSuccessBanner(
        language === 'bn'
          ? `${selectedDossierUser.displayName}-এর অ্যাপ-লক রিসেট করা হয়েছে।`
          : `Cleared Quick App-Lock for ${selectedDossierUser.displayName}.`
      );
    } catch (err) {
      console.error(err);
    } finally {
      setIsClearingLock(false);
    }
  };

  const handleResolveRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecovery || !user?.email) return;
    try {
      setResolvingRecovery(true);
      await resolveRecoveryRequest(selectedRecovery.id, recoveryAdminNotes, user.email);
      showSuccessBanner(`Support ticket resolved for ${selectedRecovery.email}`);
      setSelectedRecovery(null);
      setRecoveryAdminNotes('');
    } catch (err) {
      console.error(err);
    } finally {
      setResolvingRecovery(false);
    }
  };

  const handleDismissRecovery = async (reqId: string) => {
    if (!user?.email) return;
    try {
      await dismissRecoveryRequest(reqId, 'Dismissed by administrator.', user.email);
      showSuccessBanner('Recovery request dismissed.');
      setSelectedRecovery(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle.trim() || !newAnnContent.trim() || !user) return;
    try {
      setPublishingAnn(true);
      await createAnnouncement(
        newAnnTitle,
        newAnnContent,
        newAnnType,
        user.userId,
        user.displayName || 'Super Admin',
        user.email || SUPER_ADMIN_EMAIL
      );
      setNewAnnTitle('');
      setNewAnnContent('');
      showSuccessBanner('Published broadcast announcement.');
    } catch (err) {
      console.error(err);
    } finally {
      setPublishingAnn(false);
    }
  };

  const get7DayActivity = (targetUser: UserProfile) => {
    const daily = targetUser.dailyActivity || {};
    const result: { dateStr: string; label: string; minutes: number }[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateKey = d.toISOString().slice(0, 10);
      const dayName = d.toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', { weekday: 'short' });
      result.push({
        dateStr: dateKey,
        label: i === 0 ? (language === 'bn' ? 'আজ' : 'Today') : dayName,
        minutes: daily[dateKey] || (i === 0 && targetUser.isOnline ? 12 : 0),
      });
    }
    const maxVal = Math.max(...result.map((r) => r.minutes), 30);
    return { days: result, maxVal };
  };

  const totalUsersCount = usersList.length;
  const onlineUsersCount = usersList.filter((u) => u.isOnline).length;
  const bannedUsersCount = usersList.filter((u) => u.isBanned).length;
  const pendingReportsCount = reports.filter((r) => r.status === 'pending').length;
  const pendingRecoveryCount = recoveryRequests.filter((r) => r.status === 'pending').length;
  const totalChatsCount = allChats.length;

  const filteredUsers = usersList.filter((u) => {
    if (userFilter === 'active' && u.isBanned) return false;
    if (userFilter === 'banned' && !u.isBanned) return false;
    if (userFilter === 'warned' && !u.warningNotice) return false;
    if (userFilter === 'online' && !u.isOnline) return false;

    if (!userSearch.trim()) return true;
    const term = userSearch.toLowerCase();
    return (
      u.displayName?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.username?.toLowerCase().includes(term) ||
      u.userId.toLowerCase().includes(term)
    );
  });

  const filteredChats = allChats.filter((c) => {
    if (targetUserChatFilter && (!c.participantIds || !c.participantIds.includes(targetUserChatFilter.userId))) {
      return false;
    }
    if (chatFilter === 'direct' && c.type !== 'direct') return false;
    if (chatFilter === 'group' && c.type !== 'group') return false;

    if (!chatSearch.trim()) return true;
    const term = chatSearch.toLowerCase();
    const nameMatch = c.name?.toLowerCase().includes(term);
    const memberMatch = Object.values(c.participantDetails || {}).some(
      (p) => p.displayName?.toLowerCase().includes(term) || p.email?.toLowerCase().includes(term)
    );
    return nameMatch || memberMatch;
  });

  const filteredRecovery = recoveryRequests.filter((r) => {
    if (recoveryFilter === 'pending' && r.status !== 'pending') return false;
    if (recoveryFilter === 'resolved' && r.status !== 'resolved') return false;
    if (recoveryFilter === 'dismissed' && r.status !== 'dismissed') return false;
    return true;
  });

  const filteredReports = reports.filter((r) => {
    if (reportFilter === 'pending' && r.status !== 'pending') return false;
    if (reportFilter === 'resolved' && r.status !== 'resolved') return false;
    if (reportFilter === 'dismissed' && r.status !== 'dismissed') return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-6xl h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        <div className="h-16 px-4 sm:px-6 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 hover:border-slate-600 transition cursor-pointer shadow-sm group"
              title={t('exitPanelTooltip')}
            >
              <ArrowLeft className="w-4 h-4 text-emerald-400 group-hover:-translate-x-0.5 transition" />
              <span className="hidden sm:inline">{t('backToMessenger')}</span>
              <span className="sm:hidden">{t('close')}</span>
            </button>

            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Shield className="w-5 h-5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                  {t('adminPanelTitle')}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30 shrink-0">
                  {t('superAdminBadge')}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate hidden sm:block">
                {t('adminPanelSubtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-xl border border-emerald-500/20 hidden md:inline">
              {SUPER_ADMIN_EMAIL}
            </span>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title={t('close')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {actionSuccessMsg && (
          <div className="bg-emerald-600 text-white text-xs py-2 px-4 flex items-center justify-center gap-2 font-medium shadow animate-in slide-in-from-top-1 z-30">
            <CheckCircle2 className="w-4 h-4" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        {actionErrorMsg && (
          <div className="bg-rose-600 text-white text-xs py-2 px-4 flex items-center justify-center gap-2 font-medium shadow z-30">
            <AlertTriangle className="w-4 h-4" />
            <span>{actionErrorMsg}</span>
          </div>
        )}

        <div className="flex border-b border-slate-800 bg-slate-950/40 px-3 sm:px-6 gap-1.5 overflow-x-auto shrink-0 scrollbar-none">
          {[
            { id: 'overview', label: t('adminTabOverview'), icon: Sparkles },
            { id: 'users', label: t('adminTabUsers'), icon: Users, badge: totalUsersCount },
            { id: 'chat_audit', label: t('adminTabChatAudit'), icon: MessageSquare, badge: totalChatsCount },
            { id: 'recovery', label: t('adminTabRecovery'), icon: KeyRound, badge: pendingRecoveryCount, alert: pendingRecoveryCount > 0 },
            { id: 'reports', label: t('adminTabReports'), icon: Flag, badge: pendingReportsCount, alert: pendingReportsCount > 0 },
            { id: 'announcements', label: t('adminTabAnnouncements'), icon: Radio },
            { id: 'updates', label: language === 'bn' ? 'APK রিলিজ' : 'APK Releases', icon: Rocket },
            { id: 'logs', label: t('adminTabLogs'), icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-semibold transition cursor-pointer shrink-0 ${
                  isActive
                    ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      tab.alert ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div
          className={`flex-1 min-h-0 bg-slate-900/60 ${
            activeTab === 'chat_audit'
              ? 'flex flex-col p-2.5 sm:p-4 md:p-5 overflow-hidden'
              : 'overflow-y-auto p-4 sm:p-6'
          }`}
        >
          {activeTab === 'overview' && (
            <AdminOverviewTab
              t={t}
              totalUsersCount={totalUsersCount}
              onlineUsersCount={onlineUsersCount}
              totalChatsCount={totalChatsCount}
              pendingRecoveryCount={pendingRecoveryCount}
              pendingReportsCount={pendingReportsCount}
              bannedUsersCount={bannedUsersCount}
              onSelectTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'users' && (
            <AdminUsersTab
              t={t}
              language={language}
              currentUserEmail={user?.email}
              filteredUsers={filteredUsers}
              userSearch={userSearch}
              setUserSearch={setUserSearch}
              userFilter={userFilter}
              setUserFilter={setUserFilter}
              onOpenDossier={(u) => setSelectedDossierUser(u)}
              onInspectChats={handleInspectUserChats}
              onEnterGhostMode={onEnterGhostMode}
              onUnban={handleConfirmUnban}
              onOpenBan={(u) => {
                setBanTarget(u);
                setBanReason('');
              }}
              onClearWarning={handleClearWarning}
              onOpenWarn={(u) => {
                setWarnTarget(u);
                setWarnText('');
              }}
            />
          )}

          {activeTab === 'chat_audit' && (
            <AdminChatAuditTab
              t={t}
              language={language}
              usersList={usersList}
              allChats={allChats}
              filteredChats={filteredChats}
              selectedChat={selectedChat}
              setSelectedChat={setSelectedChat}
              chatMessages={chatMessages}
              chatSearch={chatSearch}
              setChatSearch={setChatSearch}
              chatFilter={chatFilter}
              setChatFilter={setChatFilter}
              targetUserChatFilter={targetUserChatFilter}
              setTargetUserChatFilter={setTargetUserChatFilter}
              mobileChatView={mobileChatView}
              setMobileChatView={setMobileChatView}
              onInspectUserChats={handleInspectUserChats}
              onEnterGhostMode={onEnterGhostMode}
              onOpenWarn={(u, text) => {
                setWarnTarget(u);
                setWarnText(text);
              }}
              onOpenBan={(u, reason) => {
                setBanTarget(u);
                setBanReason(reason);
              }}
              onDeleteMessage={async (chatId, msgId) => {
                if (user?.email) {
                  await deleteAdminMessage(chatId, msgId, user.email, 'Admin moderation violation');
                  showSuccessBanner('Deleted message from chat room.');
                }
              }}
            />
          )}

          {activeTab === 'recovery' && (
            <AdminRecoveryTab
              t={t}
              filteredRecovery={filteredRecovery}
              recoveryFilter={recoveryFilter}
              setRecoveryFilter={setRecoveryFilter}
              onDismiss={handleDismissRecovery}
              onSelectResolve={(req) => {
                setSelectedRecovery(req);
                setRecoveryAdminNotes('');
              }}
            />
          )}

          {activeTab === 'reports' && (
            <AdminReportsTab
              t={t}
              usersList={usersList}
              filteredReports={filteredReports}
              reportFilter={reportFilter}
              setReportFilter={setReportFilter}
              onOpenBan={(u, reason) => {
                setBanTarget(u);
                setBanReason(reason);
              }}
              onDeleteReportedMessage={async (chatId, msgId, reason) => {
                if (user?.email) {
                  await deleteAdminMessage(chatId, msgId, user.email, reason);
                  showSuccessBanner('Deleted offending message.');
                }
              }}
              onResolveReport={async (reportId, status, notes) => {
                if (user?.email) {
                  await updateReportStatus(reportId, status, notes, user.email);
                  if (status === 'resolved') showSuccessBanner('Report marked as resolved.');
                }
              }}
              onDeleteReport={async (reportId) => {
                if (user?.email) await deleteReport(reportId, user.email);
              }}
            />
          )}

          {activeTab === 'announcements' && (
            <AdminAnnouncementsTab
              t={t}
              announcements={announcements}
              newAnnTitle={newAnnTitle}
              setNewAnnTitle={setNewAnnTitle}
              newAnnContent={newAnnContent}
              setNewAnnContent={setNewAnnContent}
              newAnnType={newAnnType}
              setNewAnnType={setNewAnnType}
              publishingAnn={publishingAnn}
              onCreateAnnouncement={handleCreateAnnouncement}
              onToggleAnnouncement={async (id, nextActive) => {
                if (user?.email) await toggleAnnouncement(id, nextActive, user.email);
              }}
              onDeleteAnnouncement={async (id) => {
                if (user?.email) await deleteAnnouncement(id, user.email);
              }}
            />
          )}

          {activeTab === 'updates' && (
            <AdminReleaseTab
              language={language}
              currentLiveRelease={currentLiveRelease}
              releaseVersionName={releaseVersionName}
              setReleaseVersionName={setReleaseVersionName}
              releaseVersionCode={releaseVersionCode}
              setReleaseVersionCode={setReleaseVersionCode}
              releaseApkUrl={releaseApkUrl}
              setReleaseApkUrl={setReleaseApkUrl}
              releaseApkSha256={releaseApkSha256}
              setReleaseApkSha256={setReleaseApkSha256}
              releaseFileSizeText={releaseFileSizeText}
              setReleaseFileSizeText={setReleaseFileSizeText}
              releaseChangelogBn={releaseChangelogBn}
              setReleaseChangelogBn={setReleaseChangelogBn}
              releaseChangelogEn={releaseChangelogEn}
              setReleaseChangelogEn={setReleaseChangelogEn}
              releaseForceUpdate={releaseForceUpdate}
              setReleaseForceUpdate={setReleaseForceUpdate}
              publishingRelease={publishingRelease}
              onPublishRelease={handlePublishRelease}
            />
          )}

          {activeTab === 'logs' && <AdminLogsTab t={t} logs={logs} />}
        </div>
      </div>

      <AdminModals
        t={t}
        language={language}
        copiedText={copiedText}
        onCopy={copyToClipboard}
        selectedDossierUser={selectedDossierUser}
        onCloseDossier={() => setSelectedDossierUser(null)}
        onConfirmUnban={handleConfirmUnban}
        onInspectUserChats={handleInspectUserChats}
        onEnterGhostMode={onEnterGhostMode}
        isClearingLock={isClearingLock}
        onClearUserAppLock={handleClearUserAppLock}
        get7DayActivity={get7DayActivity}
        selectedRecovery={selectedRecovery}
        onCloseRecovery={() => setSelectedRecovery(null)}
        recoveryAdminNotes={recoveryAdminNotes}
        setRecoveryAdminNotes={setRecoveryAdminNotes}
        resolvingRecovery={resolvingRecovery}
        onResolveRecovery={handleResolveRecovery}
        banTarget={banTarget}
        onCloseBan={() => setBanTarget(null)}
        banDuration={banDuration}
        setBanDuration={setBanDuration}
        banReason={banReason}
        setBanReason={setBanReason}
        isBanning={isBanning}
        onConfirmBan={handleConfirmBan}
        warnTarget={warnTarget}
        onCloseWarn={() => setWarnTarget(null)}
        warnText={warnText}
        setWarnText={setWarnText}
        isWarning={isWarning}
        onConfirmWarn={handleConfirmWarn}
      />
    </div>
  );
}
