import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
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
  adminSetUserPin,
  subscribeToAllChatsForAdmin,
  subscribeToChatMessagesForAdmin,
  SUPER_ADMIN_EMAIL,
} from '../services/adminService';
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
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  X,
  Trash2,
  Plus,
  Loader2,
  Calendar,
  Sparkles,
  Info,
  Clock,
  ArrowRight,
  ExternalLink,
  ArrowLeft,
  KeyRound,
  MessageSquare,
  Eye,
  EyeOff,
  Copy,
  Check,
  Activity,
  BarChart3,
  Phone,
  Send,
  AlertOctagon,
} from 'lucide-react';

interface AdminModalProps {
  onClose: () => void;
}

export function AdminModal({ onClose }: AdminModalProps) {
  const { user } = useAuth();
  const { t, language } = useLanguage();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'users' | 'chat_audit' | 'recovery' | 'reports' | 'announcements' | 'logs'
  >('overview');

  // Mobile Hardware / Browser Back Navigation and Esc Key Interception
  useEffect(() => {
    window.history.pushState({ modal: 'adminModal' }, '');
    const handlePopState = () => {
      onClose();
    };
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

  // Users data
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'active' | 'banned' | 'warned' | 'online'>('all');
  const [selectedDossierUser, setSelectedDossierUser] = useState<UserProfile | null>(null);
  const [showDossierPin, setShowDossierPin] = useState(false);
  const [newPinInput, setNewPinInput] = useState('');
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Chat Inspection data
  const [allChats, setAllChats] = useState<ChatRoom[]>([]);
  const [chatSearch, setChatSearch] = useState('');
  const [selectedChat, setSelectedChat] = useState<ChatRoom | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatFilter, setChatFilter] = useState<'all' | 'direct' | 'group'>('all');

  // Password Recovery Desk data
  const [recoveryRequests, setRecoveryRequests] = useState<PasswordRecoveryRequest[]>([]);
  const [recoveryFilter, setRecoveryFilter] = useState<'all' | 'pending' | 'resolved' | 'dismissed'>('all');
  const [selectedRecovery, setSelectedRecovery] = useState<PasswordRecoveryRequest | null>(null);
  const [resolvingRecovery, setResolvingRecovery] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [tempPin, setTempPin] = useState('');
  const [recoveryAdminNotes, setRecoveryAdminNotes] = useState('');

  // Reports data
  const [reports, setReports] = useState<UserReport[]>([]);
  const [reportFilter, setReportFilter] = useState<'all' | 'pending' | 'resolved' | 'dismissed'>('all');

  // Announcements data
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnContent, setNewAnnContent] = useState('');
  const [newAnnType, setNewAnnType] = useState<AnnouncementType>('info');
  const [publishingAnn, setPublishingAnn] = useState(false);

  // Audit Logs data
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);

  // Action Modals State (inside Admin Modal)
  const [banTarget, setBanTarget] = useState<UserProfile | null>(null);
  const [banReason, setBanReason] = useState('');
  const [isBanning, setIsBanning] = useState(false);

  const [warnTarget, setWarnTarget] = useState<UserProfile | null>(null);
  const [warnText, setWarnText] = useState('');
  const [isWarning, setIsWarning] = useState(false);

  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Live Users Subscription
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list: UserProfile[] = [];
      snapshot.forEach((d) => {
        list.push(d.data() as UserProfile);
      });
      setUsersList(list);

      // Keep selected dossier user updated
      if (selectedDossierUser) {
        const fresh = list.find((u) => u.userId === selectedDossierUser.userId);
        if (fresh) setSelectedDossierUser(fresh);
      }
    });
    return () => unsubscribe();
  }, [selectedDossierUser]);

  // Live All Chats Subscription
  useEffect(() => {
    const unsubscribe = subscribeToAllChatsForAdmin((data) => setAllChats(data));
    return () => unsubscribe();
  }, []);

  // Live Messages for Selected Chat
  useEffect(() => {
    if (!selectedChat) {
      setChatMessages([]);
      return;
    }
    const unsubscribe = subscribeToChatMessagesForAdmin(selectedChat.id, (msgs) => setChatMessages(msgs));
    return () => unsubscribe();
  }, [selectedChat]);

  // Live Recovery Requests Subscription
  useEffect(() => {
    const unsubscribe = subscribeToRecoveryRequests((data) => setRecoveryRequests(data));
    return () => unsubscribe();
  }, []);

  // Live Reports Subscription
  useEffect(() => {
    const unsubscribe = subscribeToReports((data) => setReports(data));
    return () => unsubscribe();
  }, []);

  // Live Announcements Subscription
  useEffect(() => {
    const unsubscribe = subscribeToAnnouncements(false, (data) => setAnnouncements(data));
    return () => unsubscribe();
  }, []);

  // Live Admin Audit Logs Subscription
  useEffect(() => {
    const unsubscribe = subscribeToAdminLogs((data) => setLogs(data));
    return () => unsubscribe();
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

  // Metrics
  const totalUsersCount = usersList.length;
  const onlineUsersCount = usersList.filter((u) => u.isOnline).length;
  const bannedUsersCount = usersList.filter((u) => u.isBanned).length;
  const pendingReportsCount = reports.filter((r) => r.status === 'pending').length;
  const pendingRecoveryCount = recoveryRequests.filter((r) => r.status === 'pending').length;
  const activeAnnouncementsCount = announcements.filter((a) => a.active).length;
  const totalChatsCount = allChats.length;

  // Filtered Users
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

  // Filtered Chats
  const filteredChats = allChats.filter((c) => {
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

  // Filtered Recovery Requests
  const filteredRecovery = recoveryRequests.filter((r) => {
    if (recoveryFilter === 'pending' && r.status !== 'pending') return false;
    if (recoveryFilter === 'resolved' && r.status !== 'resolved') return false;
    if (recoveryFilter === 'dismissed' && r.status !== 'dismissed') return false;
    return true;
  });

  // Filtered Reports
  const filteredReports = reports.filter((r) => {
    if (reportFilter === 'pending' && r.status !== 'pending') return false;
    if (reportFilter === 'resolved' && r.status !== 'resolved') return false;
    if (reportFilter === 'dismissed' && r.status !== 'dismissed') return false;
    return true;
  });

  // Ban confirmation
  const handleConfirmBan = async () => {
    if (!banTarget || !user?.email) return;
    try {
      setIsBanning(true);
      await banUser(
        banTarget.userId,
        banTarget.email,
        banTarget.displayName,
        banReason,
        user.email
      );
      setBanTarget(null);
      setBanReason('');
      showSuccessBanner(`Suspended ${banTarget.displayName} successfully.`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsBanning(false);
    }
  };

  // Unban confirmation
  const handleConfirmUnban = async (u: UserProfile) => {
    if (!user?.email) return;
    try {
      await unbanUser(u.userId, u.email, u.displayName, user.email);
      showSuccessBanner(`Reactivated ${u.displayName}.`);
    } catch (err) {
      console.error(err);
    }
  };

  // Warning confirmation
  const handleConfirmWarn = async () => {
    if (!warnTarget || !user?.email) return;
    try {
      setIsWarning(true);
      await issueWarning(
        warnTarget.userId,
        warnTarget.email,
        warnTarget.displayName,
        warnText,
        user.email
      );
      setWarnTarget(null);
      setWarnText('');
      showSuccessBanner(`Issued official warning to ${warnTarget.displayName}.`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsWarning(false);
    }
  };

  // Clear warning
  const handleClearWarning = async (u: UserProfile) => {
    if (!user?.email) return;
    try {
      await clearWarning(u.userId, u.email, u.displayName, user.email);
      showSuccessBanner(`Cleared warning for ${u.displayName}.`);
    } catch (err) {
      console.error(err);
    }
  };

  // Set new PIN for User
  const handleSaveUserPin = async () => {
    if (!selectedDossierUser || !user?.email || newPinInput.trim().length < 4) return;
    try {
      setIsUpdatingPin(true);
      await adminSetUserPin(selectedDossierUser.userId, newPinInput.trim(), user.email);
      showSuccessBanner(`Secret PIN updated to ${newPinInput.trim()}`);
      setNewPinInput('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdatingPin(false);
    }
  };

  // Resolve Recovery Request
  const handleResolveRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecovery || !user?.email) return;
    try {
      setResolvingRecovery(true);
      // Find matching user profile by email if exists
      const target = usersList.find((u) => u.email?.toLowerCase() === selectedRecovery.email.toLowerCase());
      await resolveRecoveryRequest(
        selectedRecovery.id,
        target?.userId,
        tempPassword,
        tempPin,
        recoveryAdminNotes,
        user.email
      );
      showSuccessBanner(`Recovery ticket resolved for ${selectedRecovery.email}`);
      setSelectedRecovery(null);
      setTempPassword('');
      setTempPin('');
      setRecoveryAdminNotes('');
    } catch (err) {
      console.error(err);
    } finally {
      setResolvingRecovery(false);
    }
  };

  // Dismiss Recovery Request
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

  // Create Announcement
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

  // Helper to build 7-day activity graph data for a user
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

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-6xl h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Top Header with prominent "Back to Messenger" Button */}
        <div className="h-16 px-4 sm:px-6 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {/* Prominent Back Button */}
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

        {/* Action Success Toast Banner */}
        {actionSuccessMsg && (
          <div className="bg-emerald-600 text-white text-xs py-2 px-4 flex items-center justify-center gap-2 font-medium shadow animate-in slide-in-from-top-1 z-30">
            <CheckCircle2 className="w-4 h-4" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        {/* Navigation Tabs (Standard, Calm, Horizontal Scrollable) */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-3 sm:px-6 gap-1.5 overflow-x-auto shrink-0 scrollbar-none">
          {[
            { id: 'overview', label: t('adminTabOverview'), icon: Sparkles },
            { id: 'users', label: t('adminTabUsers'), icon: Users, badge: totalUsersCount },
            { id: 'chat_audit', label: t('adminTabChatAudit'), icon: MessageSquare, badge: totalChatsCount },
            { id: 'recovery', label: t('adminTabRecovery'), icon: KeyRound, badge: pendingRecoveryCount, alert: pendingRecoveryCount > 0 },
            { id: 'reports', label: t('adminTabReports'), icon: Flag, badge: pendingReportsCount, alert: pendingReportsCount > 0 },
            { id: 'announcements', label: t('adminTabAnnouncements'), icon: Radio },
            { id: 'logs', label: t('adminTabLogs'), icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
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

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-900/60">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              {/* Security Health Card */}
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

              {/* Metrics Grid */}
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
                  <div className="text-[11px] font-medium text-amber-400 mb-1">Recovery Tickets</div>
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

              {/* Quick Actions */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  {t('quickActionsTitle')}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => setActiveTab('recovery')}
                    className="p-4 bg-slate-950/70 border border-slate-800 hover:border-amber-500/50 rounded-2xl text-left transition cursor-pointer group"
                  >
                    <KeyRound className="w-5 h-5 text-amber-400 mb-2 group-hover:scale-110 transition" />
                    <div className="text-xs font-bold text-white">{t('recoveryDeskTitle')}</div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {pendingRecoveryCount} password recovery requests pending
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('chat_audit')}
                    className="p-4 bg-slate-950/70 border border-slate-800 hover:border-sky-500/50 rounded-2xl text-left transition cursor-pointer group"
                  >
                    <MessageSquare className="w-5 h-5 text-sky-400 mb-2 group-hover:scale-110 transition" />
                    <div className="text-xs font-bold text-white">{t('chatAuditTitle')}</div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Inspect {totalChatsCount} active chat threads and messages
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('users')}
                    className="p-4 bg-slate-950/70 border border-slate-800 hover:border-emerald-500/50 rounded-2xl text-left transition cursor-pointer group"
                  >
                    <Users className="w-5 h-5 text-emerald-400 mb-2 group-hover:scale-110 transition" />
                    <div className="text-xs font-bold text-white">{t('quickSearchUsersBtn')}</div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Inspect user dossiers, secret PINs, and seen time graph
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USER DIRECTORY & ACTIVITY DOSSIER */}
          {activeTab === 'users' && (
            <div className="space-y-4 max-w-5xl mx-auto">
              {/* Search & Filters */}
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

              {/* Users Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredUsers.map((u) => {
                  const isSelf = u.email === user?.email;
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
                          <div className="flex items-center gap-1.5">
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
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">{u.email}</div>
                          {u.username && (
                            <div className="text-[10px] text-slate-500 font-mono">@{u.username}</div>
                          )}
                        </div>
                      </div>

                      {/* Moderation Badges if warned or banned */}
                      {u.isBanned && (
                        <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-2 text-[11px] text-red-200">
                          <span className="font-semibold block">Suspension Reason:</span>
                          <span className="text-slate-300">{u.banReason}</span>
                        </div>
                      )}

                      {u.warningNotice && !u.isBanned && (
                        <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-2 text-[11px] text-amber-200">
                          <span className="font-semibold block">Active Warning:</span>
                          <span className="text-slate-300">{u.warningNotice}</span>
                        </div>
                      )}

                      {/* Action buttons + Open Dossier */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                        <button
                          onClick={() => {
                            setSelectedDossierUser(u);
                            setShowDossierPin(false);
                            setNewPinInput('');
                          }}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 rounded-lg text-[11px] font-medium transition cursor-pointer border border-emerald-500/20 flex items-center gap-1.5"
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                          <span>{t('viewUserDossierBtn')}</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          {isSelf ? (
                            <span className="text-[10px] text-slate-500 italic">Self (Protected)</span>
                          ) : (
                            <>
                              {u.isBanned ? (
                                <button
                                  onClick={() => handleConfirmUnban(u)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-medium transition cursor-pointer"
                                >
                                  {t('unbanUserBtn')}
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setBanTarget(u);
                                    setBanReason('');
                                  }}
                                  className="px-2.5 py-1 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-[11px] font-medium transition cursor-pointer"
                                >
                                  {t('banUserBtn')}
                                </button>
                              )}

                              {u.warningNotice ? (
                                <button
                                  onClick={() => handleClearWarning(u)}
                                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg text-[11px] font-medium transition cursor-pointer"
                                >
                                  {t('clearWarningBtn')}
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setWarnTarget(u);
                                    setWarnText('');
                                  }}
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
          )}

          {/* TAB 3: CHAT INSPECTION & AUDIT */}
          {activeTab === 'chat_audit' && (
            <div className="h-full flex flex-col md:flex-row gap-4 max-w-5xl mx-auto">
              {/* Left Chat List */}
              <div className="w-full md:w-80 bg-slate-950/80 border border-slate-800 rounded-2xl p-3 flex flex-col shrink-0 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    {t('allPlatformChats')} ({filteredChats.length})
                  </h4>
                  <div className="flex gap-1">
                    {(['all', 'direct', 'group'] as const).map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setChatFilter(tag)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
                          chatFilter === tag ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-400'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={chatSearch}
                    onChange={(e) => setChatSearch(e.target.value)}
                    placeholder={t('searchChatsAdminPlaceholder')}
                    className="w-full pl-8 pr-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin">
                  {filteredChats.length === 0 ? (
                    <div className="text-xs text-slate-500 text-center py-6">No chats found.</div>
                  ) : (
                    filteredChats.map((c) => {
                      const isSelected = selectedChat?.id === c.id;
                      const participants = Object.values(c.participantDetails || {});
                      const title = c.type === 'group' ? c.name : participants.map((p) => p.displayName).join(' & ');
                      return (
                        <div
                          key={c.id}
                          onClick={() => setSelectedChat(c)}
                          className={`p-2.5 rounded-xl border transition cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-950/40 border-emerald-500/80 text-white'
                              : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-850'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="truncate">{title || 'Conversation'}</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-slate-800 text-slate-400 font-normal">
                              {c.type === 'group' ? 'Group' : 'Direct'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate mt-1">
                            {c.lastMessageText || 'No messages'}
                          </div>
                          <div className="text-[9px] text-slate-500 mt-1">
                            {c.updatedAt ? new Date(c.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Message Stream Inspector */}
              <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
                {selectedChat ? (
                  <>
                    {/* Chat Header */}
                    <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-2">
                          <span>{selectedChat.name || 'Direct Conversation'}</span>
                          <span className="text-[10px] text-emerald-400 font-mono">({selectedChat.id})</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {Object.values(selectedChat.participantDetails || {})
                            .map((p) => `${p.displayName} (${p.email})`)
                            .join(' · ')}
                        </div>
                      </div>
                      <span className="text-xs text-slate-400">
                        {chatMessages.length} messages
                      </span>
                    </div>

                    {/* Messages List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
                      {chatMessages.length === 0 ? (
                        <div className="text-xs text-slate-500 text-center py-12">
                          {t('noMsgsInSelectedChat')}
                        </div>
                      ) : (
                        chatMessages.map((msg) => (
                          <div
                            key={msg.id}
                            className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl flex items-start justify-between gap-3 group hover:border-slate-700 transition"
                          >
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white truncate">{msg.senderName}</span>
                                <span className="text-[10px] text-slate-500">
                                  {new Date(msg.createdAt).toLocaleTimeString()} · {new Date(msg.createdAt).toLocaleDateString()}
                                </span>
                              </div>

                              <p className="text-xs text-slate-200 whitespace-pre-wrap break-words leading-relaxed">
                                {msg.text}
                              </p>

                              {msg.mediaUrl && (
                                <div className="mt-2 max-w-xs rounded-xl overflow-hidden border border-slate-700">
                                  {msg.type === 'image' ? (
                                    <img src={msg.mediaUrl} alt="Attachment" className="max-h-48 w-full object-cover" />
                                  ) : (
                                    <a
                                      href={msg.mediaUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-xs text-emerald-400 underline p-2 block"
                                    >
                                      View Media Attachment
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Moderation Actions for this message */}
                            <div className="flex items-center gap-1.5 opacity-90 sm:opacity-40 group-hover:opacity-100 transition shrink-0">
                              <button
                                onClick={async () => {
                                  if (user?.email && selectedChat) {
                                    await deleteAdminMessage(selectedChat.id, msg.id, user.email, 'Admin moderation violation');
                                    showSuccessBanner('Deleted message from chat room.');
                                  }
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition"
                                title="Delete offending message"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-500 text-center space-y-2">
                    <MessageSquare className="w-10 h-10 text-slate-700" />
                    <p className="text-xs">{t('selectChatToInspect')}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: PASSWORD RECOVERY DESK */}
          {activeTab === 'recovery' && (
            <div className="space-y-4 max-w-5xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">{t('recoveryDeskTitle')}</h3>
                  <p className="text-xs text-slate-400">{t('recoveryDeskSubtitle')}</p>
                </div>
                <div className="flex gap-1.5 text-xs">
                  {(['all', 'pending', 'resolved', 'dismissed'] as const).map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setRecoveryFilter(tag)}
                      className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer ${
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
                          <p className="text-slate-300">{req.details || 'User forgot password and requested assistance.'}</p>
                        </div>
                      </div>

                      {/* If already resolved, show assigned credentials */}
                      {req.status === 'resolved' && (
                        <div className="bg-emerald-950/30 border border-emerald-500/20 p-2.5 rounded-xl text-xs space-y-1">
                          <span className="text-[10px] font-bold text-emerald-400 uppercase">Assigned Credentials:</span>
                          {req.temporaryPin && (
                            <div className="text-emerald-200">
                              Secret PIN: <span className="font-mono font-bold text-white">{req.temporaryPin}</span>
                            </div>
                          )}
                          {req.temporaryPassword && (
                            <div className="text-emerald-200">
                              Temp Password: <span className="font-mono font-bold text-white">{req.temporaryPassword}</span>
                            </div>
                          )}
                          {req.adminNotes && (
                            <div className="text-slate-300 text-[11px]">Note: {req.adminNotes}</div>
                          )}
                        </div>
                      )}

                      {/* Action buttons */}
                      {req.status === 'pending' && (
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                          <button
                            onClick={() => handleDismissRecovery(req.id)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs cursor-pointer"
                          >
                            {t('dismissRecoveryBtn')}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedRecovery(req);
                              setTempPassword('');
                              setTempPin('');
                              setRecoveryAdminNotes('');
                            }}
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
          )}

          {/* TAB 5: REPORTS & MODERATION */}
          {activeTab === 'reports' && (
            <div className="space-y-4 max-w-4xl mx-auto">
              <div className="flex gap-2 text-xs">
                {(['all', 'pending', 'resolved', 'dismissed'] as const).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setReportFilter(tag)}
                    className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer ${
                      reportFilter === tag
                        ? 'bg-red-600 text-white'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {tag === 'all'
                      ? 'All'
                      : tag === 'pending'
                      ? t('reportStatusPending')
                      : tag === 'resolved'
                      ? t('reportStatusResolved')
                      : t('reportStatusDismissed')}
                  </button>
                ))}
              </div>

              {filteredReports.length === 0 ? (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <h4 className="text-sm font-bold text-white">{t('reportsEmptyTitle')}</h4>
                  <p className="text-xs text-slate-400">{t('reportsEmptySubtitle')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredReports.map((report) => (
                    <div
                      key={report.id}
                      className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30 uppercase">
                            {report.reason}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              report.status === 'pending'
                                ? 'bg-amber-500/20 text-amber-300'
                                : report.status === 'resolved'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {report.status}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {new Date(report.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-400 block font-semibold">Reported User:</span>
                          <span className="text-white font-bold">{report.targetUserName}</span>
                          {report.targetUserEmail && (
                            <span className="text-[11px] text-slate-400 block">({report.targetUserEmail})</span>
                          )}
                        </div>
                        <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-400 block font-semibold">Reporter:</span>
                          <span className="text-slate-300">{report.reporterName}</span>
                          <span className="text-[11px] text-slate-500 block">({report.reporterEmail})</span>
                        </div>
                      </div>

                      {/* Quoted Offending Message */}
                      {report.messageText && (
                        <div className="bg-red-950/20 border border-red-900/30 p-2.5 rounded-xl text-xs text-red-200">
                          <span className="font-semibold block text-[10px] uppercase text-red-300">
                            Reported Message Content:
                          </span>
                          <p className="italic">"{report.messageText}"</p>
                        </div>
                      )}

                      {/* Reporter's Details */}
                      {report.details && (
                        <div className="text-xs text-slate-300 bg-slate-900/30 p-2 rounded-xl">
                          <span className="text-[10px] text-slate-500 block font-semibold">Details:</span>
                          <p>{report.details}</p>
                        </div>
                      )}

                      {/* Moderation Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              const found = usersList.find((u) => u.userId === report.targetUserId);
                              if (found) {
                                setBanTarget(found);
                                setBanReason(`User reported for ${report.reason}: "${report.details || 'Violating safety'}"`);
                              }
                            }}
                            className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-medium cursor-pointer"
                          >
                            {t('banUserBtn')}
                          </button>

                          {report.chatId && report.messageId && (
                            <button
                              onClick={async () => {
                                if (user?.email && report.chatId && report.messageId) {
                                  await deleteAdminMessage(report.chatId, report.messageId, user.email, report.reason);
                                  showSuccessBanner('Deleted offending message.');
                                }
                              }}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium cursor-pointer flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3 text-red-400" />
                              <span>{t('deleteReportedMsgBtn')}</span>
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {report.status === 'pending' && (
                            <>
                              <button
                                onClick={async () => {
                                  if (user?.email) {
                                    await updateReportStatus(report.id, 'resolved', 'Addressed by admin.', user.email);
                                    showSuccessBanner('Report marked as resolved.');
                                  }
                                }}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
                              >
                                {t('resolveReportBtn')}
                              </button>
                              <button
                                onClick={async () => {
                                  if (user?.email) {
                                    await updateReportStatus(report.id, 'dismissed', 'Dismissed as false report.', user.email);
                                  }
                                }}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-xs cursor-pointer"
                              >
                                {t('dismissReportBtn')}
                              </button>
                            </>
                          )}

                          <button
                            onClick={async () => {
                              if (user?.email) {
                                await deleteReport(report.id, user.email);
                              }
                            }}
                            className="p-1 rounded-lg text-slate-500 hover:text-red-400 cursor-pointer"
                            title="Delete report"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: BROADCAST ANNOUNCEMENTS */}
          {activeTab === 'announcements' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <form
                onSubmit={handleCreateAnnouncement}
                className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4"
              >
                <div className="flex items-center gap-2 text-emerald-400">
                  <Radio className="w-4 h-4" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                    {t('createAnnouncementBtn')}
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs text-slate-300 font-semibold">{t('announcementTitleLabel')}</label>
                    <input
                      type="text"
                      value={newAnnTitle}
                      onChange={(e) => setNewAnnTitle(e.target.value)}
                      placeholder={t('announcementTitlePlaceholder')}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-300 font-semibold">{t('announcementTypeLabel')}</label>
                    <select
                      value={newAnnType}
                      onChange={(e) => setNewAnnType(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="info">Info</option>
                      <option value="warning">Warning</option>
                      <option value="alert">Alert</option>
                      <option value="update">Update</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-300 font-semibold">{t('announcementContentLabel')}</label>
                  <textarea
                    value={newAnnContent}
                    onChange={(e) => setNewAnnContent(e.target.value)}
                    placeholder={t('announcementContentPlaceholder')}
                    rows={2}
                    className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={publishingAnn || !newAnnTitle.trim() || !newAnnContent.trim()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow transition cursor-pointer flex items-center gap-2"
                  >
                    {publishingAnn ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Radio className="w-3.5 h-3.5" />
                    )}
                    <span>{t('publishAnnouncementBtn')}</span>
                  </button>
                </div>
              </form>

              {/* Announcements List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Existing Broadcasts ({announcements.length})
                </h4>

                {announcements.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    {t('noAnnouncementsFound')}
                  </div>
                ) : (
                  announcements.map((ann) => (
                    <div
                      key={ann.id}
                      className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              ann.type === 'alert'
                                ? 'bg-red-500/20 text-red-300'
                                : ann.type === 'warning'
                                ? 'bg-amber-500/20 text-amber-300'
                                : ann.type === 'update'
                                ? 'bg-purple-500/20 text-purple-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {ann.type}
                          </span>
                          <span className="text-xs font-bold text-white truncate">{ann.title}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              ann.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            {ann.active ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{ann.content}</p>
                        <span className="text-[10px] text-slate-500 block">
                          {new Date(ann.createdAt).toLocaleString()} · by {ann.authorName}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={async () => {
                            if (user?.email) {
                              await toggleAnnouncement(ann.id, !ann.active, user.email);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                            ann.active
                              ? 'bg-amber-600/20 text-amber-300 hover:bg-amber-600/30'
                              : 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30'
                          }`}
                        >
                          {ann.active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={async () => {
                            if (user?.email) {
                              await deleteAnnouncement(ann.id, user.email);
                            }
                          }}
                          className="p-1.5 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                          title="Delete announcement"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 7: AUDIT LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-4 max-w-4xl mx-auto">
              <div>
                <h3 className="text-sm font-bold text-white">{t('auditLogsTitle')}</h3>
                <p className="text-xs text-slate-400">{t('auditLogsSubtitle')}</p>
              </div>

              {logs.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  {t('noAuditLogs')}
                </div>
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
          )}
        </div>
      </div>

      {/* USER ACTIVITY DOSSIER & GRAPH MODAL */}
      {selectedDossierUser && (
        <div className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-3 sm:p-4 animate-in fade-in select-none">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto space-y-4">
            <button
              onClick={() => setSelectedDossierUser(null)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Profile Info Header */}
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="relative">
                <img
                  src={selectedDossierUser.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${selectedDossierUser.userId}`}
                  alt={selectedDossierUser.displayName}
                  className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500 bg-slate-800 shadow"
                />
                {selectedDossierUser.isOnline && (
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-950" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold text-white truncate">{selectedDossierUser.displayName}</h4>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedDossierUser.isOnline ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {selectedDossierUser.isOnline ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
                <div className="text-xs text-slate-400 truncate">{selectedDossierUser.email}</div>
                {selectedDossierUser.username && (
                  <div className="text-[11px] text-emerald-400 font-mono">@{selectedDossierUser.username}</div>
                )}
              </div>
            </div>

            {/* User Credentials & Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block font-semibold">{t('dossierUserId')}</span>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="font-mono text-slate-300 truncate max-w-[170px]">{selectedDossierUser.userId}</span>
                  <button
                    onClick={() => copyToClipboard(selectedDossierUser.userId)}
                    className="p-1 text-slate-400 hover:text-white cursor-pointer"
                    title="Copy UID"
                  >
                    {copiedText === selectedDossierUser.userId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Secret PIN Viewer & Setter */}
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block font-semibold">{t('dossierSecretPin')}</span>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="font-mono font-bold text-emerald-400 text-sm tracking-widest">
                    {selectedDossierUser.secretPin ? (
                      showDossierPin ? selectedDossierUser.secretPin : '••••'
                    ) : (
                      <span className="text-xs text-slate-500 font-normal italic">{t('pinNotConfigured')}</span>
                    )}
                  </span>
                  {selectedDossierUser.secretPin && (
                    <button
                      onClick={() => setShowDossierPin(!showDossierPin)}
                      className="p-1 text-slate-400 hover:text-white cursor-pointer"
                    >
                      {showDossierPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Session Login Time */}
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block font-semibold">{t('dossierLastLogin')}</span>
                <span className="text-slate-300">
                  {selectedDossierUser.lastLoginAt ? new Date(selectedDossierUser.lastLoginAt).toLocaleString() : (selectedDossierUser.lastSeen ? new Date(selectedDossierUser.lastSeen).toLocaleString() : 'N/A')}
                </span>
              </div>

              {/* Session Exit / Logout Time */}
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block font-semibold">{t('dossierLastExit')}</span>
                <span className="text-slate-300">
                  {selectedDossierUser.lastExitAt ? new Date(selectedDossierUser.lastExitAt).toLocaleString() : (selectedDossierUser.isOnline ? 'Currently Active' : 'N/A')}
                </span>
              </div>
            </div>

            {/* 7-DAY ACTIVITY & SEEN TIME GRAPH */}
            <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    {t('activityChartTitle')}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Total: {selectedDossierUser.totalActiveMinutes || 0} mins
                </span>
              </div>

              {/* Visual Clean Bar Chart */}
              {(() => {
                const { days, maxVal } = get7DayActivity(selectedDossierUser);
                return (
                  <div className="pt-3">
                    <div className="flex items-end justify-between gap-2 h-28 px-1 border-b border-slate-800 pb-2">
                      {days.map((item, idx) => {
                        const heightPct = Math.max(8, Math.min(100, (item.minutes / maxVal) * 100));
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                            <span className="text-[9px] font-mono text-emerald-300 opacity-80 group-hover:opacity-100 transition">
                              {item.minutes}m
                            </span>
                            <div className="w-full bg-slate-900 rounded-t-md h-full flex items-end overflow-hidden max-w-[36px]">
                              <div
                                style={{ height: `${heightPct}%` }}
                                className="w-full bg-gradient-to-t from-emerald-600 to-teal-400 rounded-t-md transition-all duration-300 group-hover:brightness-125"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Day Labels */}
                    <div className="flex items-center justify-between px-1 pt-1.5 text-[10px] text-slate-400 font-medium">
                      {days.map((item, idx) => (
                        <div key={idx} className="flex-1 text-center truncate">
                          {item.label}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Admin PIN Reset Tool */}
            <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-2xl space-y-2">
              <span className="text-xs font-bold text-white block">{t('assignNewPinBtn')}</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="4-6 digit PIN (e.g. 5821)"
                  maxLength={6}
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                  className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono tracking-widest focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleSaveUserPin}
                  disabled={isUpdatingPin || newPinInput.length < 4}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold cursor-pointer transition shadow"
                >
                  {isUpdatingPin ? 'Saving...' : 'Set PIN'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RESOLVE RECOVERY REQUEST MODAL */}
      {selectedRecovery && (
        <div className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4 select-none">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-amber-400">
                <KeyRound className="w-5 h-5" />
                <h4 className="text-sm font-bold text-white">{t('resolveRecoveryBtn')}</h4>
              </div>
              <button
                onClick={() => setSelectedRecovery(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Applicant: <strong className="text-white">{selectedRecovery.email}</strong>
            </p>

            <form onSubmit={handleResolveRecovery} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300 block">{t('tempPinLabel')}</label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder={t('tempPinPlaceholder')}
                  value={tempPin}
                  onChange={(e) => setTempPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono tracking-widest focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300 block">{t('tempPasswordLabel')}</label>
                <input
                  type="text"
                  placeholder={t('tempPasswordPlaceholder')}
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300 block">{t('adminNotesLabel')}</label>
                <textarea
                  rows={2}
                  placeholder={t('adminNotesPlaceholder')}
                  value={recoveryAdminNotes}
                  onChange={(e) => setRecoveryAdminNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedRecovery(null)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs cursor-pointer hover:bg-slate-750"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={resolvingRecovery || (!tempPin.trim() && !tempPassword.trim())}
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold cursor-pointer shadow transition"
                >
                  {resolvingRecovery ? 'Saving...' : t('confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BAN CONFIRMATION MODAL */}
      {banTarget && (
        <div className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/40 rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
              <h4 className="text-sm font-bold text-white">{t('banUserModalTitle')}</h4>
              <p className="text-xs text-slate-400">
                {banTarget.displayName} ({banTarget.email})
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-300 font-semibold block">{t('banReasonLabel')}</label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder={t('banReasonPlaceholder')}
                rows={3}
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setBanTarget(null)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmBan}
                disabled={isBanning}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                {isBanning ? 'Suspending...' : t('confirmBanBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WARN USER MODAL */}
      {warnTarget && (
        <div className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <AlertOctagon className="w-10 h-10 text-amber-500 mx-auto" />
              <h4 className="text-sm font-bold text-white">{t('warnModalTitle')}</h4>
              <p className="text-xs text-slate-400">
                {warnTarget.displayName} ({warnTarget.email})
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-300 font-semibold block">{t('warningNoticeLabel')}</label>
              <textarea
                value={warnText}
                onChange={(e) => setWarnText(e.target.value)}
                placeholder={t('warningNoticePlaceholder')}
                rows={3}
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setWarnTarget(null)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmWarn}
                disabled={isWarning || !warnText.trim()}
                className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                {isWarning ? 'Sending...' : t('confirmWarnBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
