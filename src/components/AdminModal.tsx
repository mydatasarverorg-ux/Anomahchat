import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useModalHistory } from '../hooks/useModalHistory';
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
  reopenRecoveryRequest,
  deleteRecoveryRequest,
  sendAdminPasswordResetEmail,
  adminClearUserAppLock,
  backfillDirectoryFromUsers,
  subscribeToAllChatsForAdmin,
  subscribeToChatMessagesForAdmin,
  SUPER_ADMIN_EMAIL,
  isSuperAdmin,
  extractPhoneDigits,
  doPhonesMatch,
  extractReadableFirestoreError,
  stampReportTargetSnapshot,
} from '../services/adminService';
import { hashPhoneForRegistry } from '../utils/phoneUtils';
import {
  subscribeToPhoneRegistries,
  backfillPhoneRegistryFromUsers,
  adminSetPhoneManualBlock,
  adminRemoveUidFromPhoneRegistry,
  adminUpdatePhoneMaxLimit,
} from '../services/phoneRegistryService';
import {
  DEFAULT_ADMIN_SECURITY_SETTINGS,
  DEFAULT_SECURITY_SETTINGS,
  adminApproveDeviceSession,
  adminDeleteDeviceSession,
  adminForceLogoutDeviceSession,
  adminUnlockPhoneCooldown,
  adminUpdateAdminSecuritySettings,
  adminUpdateGlobalSecuritySettings,
  adminUpdateUserDeviceLimits,
  subscribeToAdminSecuritySettings,
  subscribeToGlobalSecuritySettings,
  subscribeToUserDeviceSessions,
} from '../services/deviceSessionService';
import {
  publishAppRelease,
  subscribeToLatestRelease,
  type AppReleaseInfo,
} from '../services/updateService';
import { APP_VERSION } from '../utils/appVersion';
import type {
  UserProfile,
  UserReport,
  ReportReason,
  SystemAnnouncement,
  AdminAuditLog,
  AnnouncementType,
  PasswordRecoveryRequest,
  PhoneRegistryEntry,
  AdminSecuritySettings,
  AppSecuritySettings,
  DeviceSession,
  ChatRoom,
  ChatMessage,
  NewDeviceApprovalMode,
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
  HardDrive,
} from 'lucide-react';
import { AdminOverviewTab } from './admin/AdminOverviewTab';
import { AdminUsersTab } from './admin/AdminUsersTab';
import { AdminChatAuditTab } from './admin/AdminChatAuditTab';
import { AdminRecoveryTab } from './admin/AdminRecoveryTab';
import { AdminReportsTab } from './admin/AdminReportsTab';
import { AdminAnnouncementsTab } from './admin/AdminAnnouncementsTab';
import { AdminReleaseTab } from './admin/AdminReleaseTab';
import { AdminLogsTab } from './admin/AdminLogsTab';
import { AdminBackupTab } from './admin/AdminBackupTab';
import { AdminModals } from './admin/AdminModals';

interface AdminModalProps {
  onClose: () => void;
  onEnterGhostMode?: (user: UserProfile, targetChatId?: string) => void;
}

export function AdminModal({ onClose, onEnterGhostMode }: AdminModalProps) {
  const { user, isVerifiedSuperAdmin } = useAuth();
  const { t, language } = useLanguage();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'users' | 'chat_audit' | 'backup' | 'recovery' | 'reports' | 'announcements' | 'logs' | 'updates'
  >('overview');

  const [currentLiveRelease, setCurrentLiveRelease] = useState<AppReleaseInfo | null>(null);
  const [releaseVersionName, setReleaseVersionName] = useState(APP_VERSION.versionName);
  const [releaseVersionCode, setReleaseVersionCode] = useState(String(APP_VERSION.versionCode));
  const [releaseApkUrl, setReleaseApkUrl] = useState('https://github.com/mydatasarverorg-ux/Anomahchat/releases/latest/download/AnomahChat.apk');
  const [releaseApkSha256, setReleaseApkSha256] = useState('');
  const [releaseFileSizeText, setReleaseFileSizeText] = useState('');
  const [releaseChangelogEn, setReleaseChangelogEn] = useState(
    '• Enhanced Account Security: PBKDF2 PIN Lock & Immutable Suspension Enforcement\n• Safer In-App Updates: Fail-Closed SHA-256 Verification & Hardened Media Rules\n• Stronger Privacy Defaults & Android WebView Security Improvements (Mahi A13)'
  );
  const [releaseChangelogBn, setReleaseChangelogBn] = useState(
    '• আরও শক্তিশালী অ্যাকাউন্ট নিরাপত্তা: PBKDF2 পিন লক ও স্থায়ী সাসপেনশন সুরক্ষা\n• নিরাপদ ইন-অ্যাপ আপডেট: বাধ্যতামূলক SHA-256 যাচাই ও সুরক্ষিত মিডিয়া নিয়ম\n• ফোন ডিসকভারি প্রাইভেসি উন্নয়ন ও অ্যান্ড্রয়েড নিরাপত্তা আপডেট (Mahi A13)'
  );
  const [releaseForceUpdate, setReleaseForceUpdate] = useState(false);
  const [publishingRelease, setPublishingRelease] = useState(false);

  useModalHistory(true, onClose);

  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'active' | 'banned' | 'warned' | 'online'>('all');
  const [selectedDossierUser, setSelectedDossierUser] = useState<UserProfile | null>(null);
  const [isClearingLock, setIsClearingLock] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const didBackfillRef = useRef(false);
  const lastPhoneSyncSigRef = useRef<string>('');
  const stampedReportIdsRef = useRef<Set<string>>(new Set());
  const [phoneRegistries, setPhoneRegistries] = useState<PhoneRegistryEntry[]>([]);
  const [phoneHashByUserId, setPhoneHashByUserId] = useState<Record<string, string>>({});
  const [phoneActionBusy, setPhoneActionBusy] = useState(false);
  const [globalSecuritySettings, setGlobalSecuritySettings] =
    useState<AppSecuritySettings>(DEFAULT_SECURITY_SETTINGS);
  const [adminSecuritySettings, setAdminSecuritySettings] =
    useState<AdminSecuritySettings>(DEFAULT_ADMIN_SECURITY_SETTINGS);
  const [dossierDeviceSessions, setDossierDeviceSessions] = useState<DeviceSession[]>([]);
  const [securityActionBusy, setSecurityActionBusy] = useState(false);

  const [allChats, setAllChats] = useState<ChatRoom[]>([]);
  const [chatSearch, setChatSearch] = useState('');
  const [selectedChat, setSelectedChat] = useState<ChatRoom | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatFilter, setChatFilter] = useState<'all' | 'direct' | 'group'>('all');
  const [targetUserChatFilter, setTargetUserChatFilter] = useState<UserProfile | null>(null);
  const [mobileChatView, setMobileChatView] = useState<'list' | 'messages'>('list');
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  const handleInspectUserChats = (targetUser: UserProfile) => {
    setTargetUserChatFilter(targetUser);
    setSelectedDossierUser(null);
    setHighlightedMessageId(null);
    setActiveTab('chat_audit');
    setMobileChatView('messages');
    const userChats = allChats.filter(
      (c) => c.participantIds && c.participantIds.includes(targetUser.userId)
    );
    setSelectedChat(userChats.length > 0 ? userChats[0] : null);
  };

  const handleInspectReportChat = (chatId: string, highlightMessageId?: string) => {
    const foundChat = allChats.find((c) => c.id === chatId) || null;
    if (!foundChat) {
      setActionErrorMsg(
        language === 'bn'
          ? 'এই রিপোর্টের সাথে যুক্ত চ্যাট রুমটি আর পাওয়া যায়নি (সম্ভবত ডিলিট করা হয়েছে)।'
          : 'The chat room linked to this report was not found (it may have been deleted).'
      );
      return;
    }
    setActionErrorMsg(null);
    setTargetUserChatFilter(null);
    setChatSearch('');
    setChatFilter('all');
    setSelectedChat(foundChat);
    setHighlightedMessageId(highlightMessageId || null);
    setActiveTab('chat_audit');
    setMobileChatView('messages');
  };

  const [recoveryRequests, setRecoveryRequests] = useState<PasswordRecoveryRequest[]>([]);
  const [recoveryFilter, setRecoveryFilter] = useState<'all' | 'pending' | 'resolved' | 'dismissed'>('all');
  const [recoverySearch, setRecoverySearch] = useState('');
  const [selectedRecovery, setSelectedRecovery] = useState<PasswordRecoveryRequest | null>(null);
  const [resolvingRecovery, setResolvingRecovery] = useState(false);
  const [recoveryAdminNotes, setRecoveryAdminNotes] = useState('');

  const [reports, setReports] = useState<UserReport[]>([]);
  const [reportFilter, setReportFilter] = useState<'all' | 'pending' | 'resolved' | 'dismissed'>('all');
  const [reportSearch, setReportSearch] = useState('');
  const [reportReasonFilter, setReportReasonFilter] = useState<'all' | ReportReason>('all');

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
      },
      (error) => {
        console.warn('Admin users snapshot notice:', error);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => subscribeToPhoneRegistries((entries) => setPhoneRegistries(entries)), []);

  const [phoneHashReadyVersion, setPhoneHashReadyVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const u of usersList) {
        if (!u.phoneNumber) continue;
        const h = await hashPhoneForRegistry(u.phoneNumber);
        if (h) next[u.userId] = h;
      }
      if (!cancelled) {
        setPhoneHashByUserId(next);
        setPhoneHashReadyVersion((v) => v + 1);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [usersList]);

  useEffect(() => {
    if (usersList.length === 0 || phoneHashReadyVersion === 0) return;
    const nowMs = Date.now();
    const userById = new Map(usersList.map((u) => [u.userId, u]));
    const isExpiredOrDeleted = (u: UserProfile) =>
      !u.isBanned &&
      (u.status === 'deleted' ||
        (u.status === 'scheduled_for_deletion' &&
          Boolean(u.deleteScheduledAt) &&
          Number.isFinite(new Date(u.deleteScheduledAt!).getTime()) &&
          new Date(u.deleteScheduledAt!).getTime() <= nowMs));

    const mismatchItems: string[] = [];
    for (const u of usersList) {
      if (isExpiredOrDeleted(u)) continue;
      const h = phoneHashByUserId[u.userId];
      if (!h) continue;
      const reg = phoneRegistries.find((r) => r.phoneHash === h);
      const released = reg?.manuallyReleasedUids || [];
      if (!reg || (!reg.accountUids.includes(u.userId) && !released.includes(u.userId))) {
        mismatchItems.push(`add:${u.userId}:${h}`);
      }
    }

    for (const reg of phoneRegistries) {
      const seen = new Set<string>();
      for (const id of reg.accountUids || []) {
        if (seen.has(id)) {
          mismatchItems.push(`dup:${id}:${reg.phoneHash}`);
          continue;
        }
        seen.add(id);
        const owner = userById.get(id);
        const isBannedHere = Boolean(reg.bannedUids?.includes(id) || owner?.isBanned);
        if (!owner && !isBannedHere) {
          mismatchItems.push(`orphan:${id}:${reg.phoneHash}`);
        } else if (owner && isExpiredOrDeleted(owner)) {
          mismatchItems.push(`del:${id}:${reg.phoneHash}`);
        } else if (owner && !isBannedHere && phoneHashByUserId[id] !== reg.phoneHash) {
          mismatchItems.push(`moved:${id}:${reg.phoneHash}`);
        }
      }
    }

    if (mismatchItems.length === 0) return;
    const sig = mismatchItems.sort().join('|');
    if (sig === lastPhoneSyncSigRef.current) return;
    lastPhoneSyncSigRef.current = sig;
    backfillPhoneRegistryFromUsers(usersList).catch(() => {});
  }, [usersList, phoneRegistries, phoneHashByUserId, phoneHashReadyVersion]);

  const userPhoneRegistryMap: Record<string, PhoneRegistryEntry> = {};
  for (const u of usersList) {
    const h = phoneHashByUserId[u.userId];
    if (h) {
      const reg = phoneRegistries.find((r) => r.phoneHash === h);
      if (reg) userPhoneRegistryMap[u.userId] = reg;
    }
  }

  const originalUidByPhoneHash: Record<string, string> = {};
  for (const reg of phoneRegistries) {
    if (!reg.accountUids || reg.accountUids.length === 0) continue;
    let earliestUid = reg.accountUids[0];
    let earliestMs = Number.MAX_SAFE_INTEGER;
    for (const uid of reg.accountUids) {
      const matchUser = usersList.find((u) => u.userId === uid);
      if (matchUser?.createdAt) {
        const ms = new Date(matchUser.createdAt).getTime();
        if (Number.isFinite(ms) && ms < earliestMs) {
          earliestMs = ms;
          earliestUid = uid;
        }
      }
    }
    originalUidByPhoneHash[reg.phoneHash] = earliestUid;
  }

  const activeDossierUser = selectedDossierUser
    ? usersList.find((u) => u.userId === selectedDossierUser.userId) || selectedDossierUser
    : null;
  const activeDossierPhoneRegistry = activeDossierUser
    ? userPhoneRegistryMap[activeDossierUser.userId] || null
    : null;

  useEffect(() => subscribeToGlobalSecuritySettings((settings) => setGlobalSecuritySettings(settings)), []);

  useEffect(() => {
    if (!isVerifiedSuperAdmin) return;
    return subscribeToAdminSecuritySettings((settings) => setAdminSecuritySettings(settings));
  }, [isVerifiedSuperAdmin]);

  useEffect(() => {
    if (!activeDossierUser?.userId) {
      setDossierDeviceSessions([]);
      return;
    }
    return subscribeToUserDeviceSessions(activeDossierUser.userId, (sessions) => {
      setDossierDeviceSessions(sessions);
    });
  }, [activeDossierUser?.userId]);

  useEffect(() => {
    if (reports.length === 0 || usersList.length === 0) return;
    for (const rep of reports) {
      if (rep.targetPhoneNumber || stampedReportIdsRef.current.has(rep.id)) continue;
      const target = usersList.find((u) => u.userId === rep.targetUserId);
      if (target && (target.phoneNumber || target.initialPhoneNumber)) {
        stampedReportIdsRef.current.add(rep.id);
        stampReportTargetSnapshot(rep.id, target).catch(() => {});
      }
    }
  }, [reports, usersList]);

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
        setReleaseApkUrl(rel.apkDownloadUrl || '');
        setReleaseFileSizeText(rel.fileSizeText || '');
        setReleaseForceUpdate(Boolean(rel.forceUpdate));
        if (rel.versionCode >= APP_VERSION.versionCode) {
          setReleaseVersionName(rel.versionName);
          setReleaseVersionCode(String(rel.versionCode));
          setReleaseApkSha256(rel.apkSha256 || '');
          setReleaseChangelogEn(rel.changelogEn || '');
          setReleaseChangelogBn(rel.changelogBn || '');
        }
      }
    });
  }, []);

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const showSuccessBanner = (msg: string) => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    setActionErrorMsg(null);
    setActionSuccessMsg(msg);
    successTimerRef.current = setTimeout(() => setActionSuccessMsg(null), 3500);
  };

  const extractReadableError = (err: unknown, fallback: string) =>
    extractReadableFirestoreError(err, language, fallback);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleTogglePhoneManualBlock = async (
    phoneHash: string,
    blocked: boolean,
    displayPhone?: string
  ) => {
    if (!user?.email) return;
    setPhoneActionBusy(true);
    setActionErrorMsg(null);
    try {
      await adminSetPhoneManualBlock(
        phoneHash,
        blocked,
        blocked ? 'Manually locked by administrator' : '',
        user.email,
        displayPhone
      );
      showSuccessBanner(
        blocked
          ? language === 'bn'
            ? 'এই মোবাইল নম্বরটি অ্যাডমিন লক করা হয়েছে (নতুন অ্যাকাউন্ট খোলা বন্ধ)।'
            : 'Mobile number manually locked against new registrations.'
          : language === 'bn'
          ? 'মোবাইল নম্বরের ম্যানুয়াল লক খুলে দেওয়া হয়েছে।'
          : 'Manual lock removed from mobile number.'
      );
    } catch (err) {
      setActionErrorMsg(extractReadableError(err, 'Failed to update phone block status.'));
    } finally {
      setPhoneActionBusy(false);
    }
  };

  const handleReleasePhoneSlot = async (
    phoneHash: string,
    targetUid: string,
    displayPhone?: string
  ) => {
    if (!user?.email) return;
    setPhoneActionBusy(true);
    setActionErrorMsg(null);
    try {
      await adminRemoveUidFromPhoneRegistry(phoneHash, targetUid, user.email, displayPhone);
      showSuccessBanner(
        language === 'bn'
          ? 'নির্বাচিত অ্যাকাউন্টটির ফোন স্লট খালি করা হয়েছে।'
          : 'Released account slot from mobile registry.'
      );
    } catch (err) {
      setActionErrorMsg(extractReadableError(err, 'Failed to release phone slot.'));
    } finally {
      setPhoneActionBusy(false);
    }
  };

  const handleUpdatePhoneLimit = async (
    phoneHash: string,
    newLimit: number,
    displayPhone?: string
  ) => {
    if (!user?.email) return;
    setPhoneActionBusy(true);
    setActionErrorMsg(null);
    try {
      await adminUpdatePhoneMaxLimit(phoneHash, newLimit, user.email, displayPhone);
      showSuccessBanner(
        language === 'bn'
          ? `এই মোবাইল নম্বরের সর্বোচ্চ অ্যাকাউন্ট সীমা ${newLimit} করা হয়েছে।`
          : `Updated mobile number max limit to ${newLimit}.`
      );
    } catch (err) {
      setActionErrorMsg(extractReadableError(err, 'Failed to update phone limit.'));
    } finally {
      setPhoneActionBusy(false);
    }
  };

  const handleSaveGlobalSecuritySettings = async (settings: {
    defaultMobileLimit: number;
    defaultWebLimit: number;
    newDeviceApprovalMode: NewDeviceApprovalMode;
    defaultOptionalApproval: boolean;
    enableMagicLinkLogin: boolean;
    enableQrDeviceApproval: boolean;
  }) => {
    if (!user?.email) return;
    setSecurityActionBusy(true);
    setActionErrorMsg(null);
    try {
      await adminUpdateGlobalSecuritySettings(settings, user.email);
      const modeLabelBn =
        settings.newDeviceApprovalMode === 'optional'
          ? 'ইউজারের ইচ্ছাধীন'
          : settings.newDeviceApprovalMode === 'required'
          ? 'সবার জন্য আবশ্যিক'
          : 'বন্ধ';
      showSuccessBanner(
        language === 'bn'
          ? `গ্লোবাল নিরাপত্তা নীতি সেভ হয়েছে (2FA: ${modeLabelBn}, Magic Link: ${
              settings.enableMagicLinkLogin ? 'চালু' : 'বন্ধ'
            }, QR: ${settings.enableQrDeviceApproval ? 'চালু' : 'বন্ধ'}, মোবাইল: ${
              settings.defaultMobileLimit
            }, ওয়েব/পিসি: ${settings.defaultWebLimit})।`
          : `Saved global security policy (2FA: ${settings.newDeviceApprovalMode}, Magic Link: ${
              settings.enableMagicLinkLogin ? 'ON' : 'OFF'
            }, QR: ${settings.enableQrDeviceApproval ? 'ON' : 'OFF'}, Mobile: ${
              settings.defaultMobileLimit
            }, Web/PC: ${settings.defaultWebLimit}).`
      );
    } catch (err) {
      setActionErrorMsg(extractReadableError(err, 'Failed to save global security policy.'));
    } finally {
      setSecurityActionBusy(false);
    }
  };

  const handleSaveAdminSecuritySettings = async (settings: {
    adminMobileLimit: number;
    adminWebLimit: number;
    adminLoginMode: 'fast_alert' | 'strict_approval';
  }) => {
    if (!user?.email) return;
    setSecurityActionBusy(true);
    setActionErrorMsg(null);
    try {
      await adminUpdateAdminSecuritySettings(settings, user.email);
      showSuccessBanner(
        language === 'bn'
          ? `সুপার অ্যাডমিন ডিভাইস নীতি সেভ হয়েছে (মোবাইল: ${settings.adminMobileLimit}, ওয়েব/পিসি: ${settings.adminWebLimit}, মোড: ${
              settings.adminLoginMode === 'fast_alert' ? 'ফাস্ট অ্যালার্ট' : 'কঠোর অনুমোদন'
            })।`
          : `Saved Super Admin policy (Mobile: ${settings.adminMobileLimit}, Web/PC: ${settings.adminWebLimit}, Mode: ${settings.adminLoginMode}).`
      );
    } catch (err) {
      setActionErrorMsg(extractReadableError(err, 'Failed to save Super Admin device policy.'));
    } finally {
      setSecurityActionBusy(false);
    }
  };

  const handleUpdateUserDeviceLimits = async (
    targetUser: UserProfile,
    limits: { mobile?: number; web?: number } | null
  ) => {
    if (!user?.email) return;
    setSecurityActionBusy(true);
    setActionErrorMsg(null);
    try {
      await adminUpdateUserDeviceLimits(
        targetUser.userId,
        limits,
        user.email,
        targetUser.displayName
      );
      const targetIsSuperAdmin = isSuperAdmin(targetUser.email);
      showSuccessBanner(
        limits
          ? language === 'bn'
            ? `${targetUser.displayName}-এর ডিভাইস সীমা আপডেট করা হয়েছে।`
            : `Updated device limits for ${targetUser.displayName}.`
          : targetIsSuperAdmin
          ? language === 'bn'
            ? `${targetUser.displayName}-এর ডিভাইস সীমা সুপার অ্যাডমিন নীতি ডিফল্টে রিসেট করা হয়েছে।`
            : `Reset device limits for ${targetUser.displayName} to Super Admin policy defaults.`
          : language === 'bn'
          ? `${targetUser.displayName}-এর ডিভাইস সীমা গ্লোবাল ডিফল্টে রিসেট করা হয়েছে।`
          : `Reset device limits for ${targetUser.displayName} to global defaults.`
      );
    } catch (err) {
      setActionErrorMsg(extractReadableError(err, 'Failed to update user device limits.'));
    } finally {
      setSecurityActionBusy(false);
    }
  };

  const handleUnlockPhoneCooldown = async (targetUser: UserProfile) => {
    if (!user?.email) return;
    setSecurityActionBusy(true);
    setActionErrorMsg(null);
    try {
      await adminUnlockPhoneCooldown(targetUser.userId, user.email, targetUser.displayName);
      showSuccessBanner(
        language === 'bn'
          ? `${targetUser.displayName}-এর ৩০-দিনের মোবাইল নম্বর পরিবর্তনের বাধা আনলক করা হয়েছে।`
          : `Unlocked 30-day mobile number cooldown for ${targetUser.displayName}.`
      );
    } catch (err) {
      setActionErrorMsg(extractReadableError(err, 'Failed to unlock cooldown.'));
    } finally {
      setSecurityActionBusy(false);
    }
  };

  const handleAdminForceLogoutDevice = async (targetUser: UserProfile, deviceId: string) => {
    if (!user?.email) return;
    setSecurityActionBusy(true);
    setActionErrorMsg(null);
    try {
      await adminForceLogoutDeviceSession(
        targetUser.userId,
        deviceId,
        user.email,
        targetUser.displayName
      );
      showSuccessBanner(
        language === 'bn'
          ? 'নির্বাচিত ডিভাইস সেশনটি ফোর্স লগ-আউট করা হয়েছে।'
          : 'Device session forced logged out.'
      );
    } catch (err) {
      setActionErrorMsg(extractReadableError(err, 'Failed to force logout device session.'));
    } finally {
      setSecurityActionBusy(false);
    }
  };

  const handleAdminApproveDevice = async (targetUser: UserProfile, deviceId: string) => {
    if (!user?.email) return;
    setSecurityActionBusy(true);
    setActionErrorMsg(null);
    try {
      await adminApproveDeviceSession(targetUser.userId, deviceId, user.email, targetUser);
      showSuccessBanner(
        language === 'bn'
          ? 'ডিভাইস সেশনটি অ্যাডমিন থেকে অনুমোদন দেওয়া হয়েছে।'
          : 'Approved device session.'
      );
    } catch (err) {
      setActionErrorMsg(extractReadableError(err, 'Failed to approve device session.'));
    } finally {
      setSecurityActionBusy(false);
    }
  };

  const handleAdminDeleteDevice = async (targetUser: UserProfile, deviceId: string) => {
    if (!user?.email) return;
    setSecurityActionBusy(true);
    setActionErrorMsg(null);
    try {
      await adminDeleteDeviceSession(
        targetUser.userId,
        deviceId,
        user.email,
        targetUser.displayName
      );
      showSuccessBanner(
        language === 'bn'
          ? 'ডিভাইস সেশন রেকর্ডটি মুছে ফেলা হয়েছে।'
          : 'Removed device session record.'
      );
    } catch (err) {
      setActionErrorMsg(extractReadableError(err, 'Failed to remove device session record.'));
    } finally {
      setSecurityActionBusy(false);
    }
  };

  const handlePublishRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!releaseVersionName.trim() || !releaseVersionCode || !releaseApkUrl.trim() || !user) return;
    setPublishingRelease(true);
    setActionErrorMsg(null);
    try {
      const parsedCode = parseInt(releaseVersionCode, 10);
      if (!Number.isFinite(parsedCode) || parsedCode < 100) {
        setActionErrorMsg(
          language === 'bn'
            ? 'ভার্সন কোড অবশ্যই কমপক্ষে ১০০ (যেমন: 110) হতে হবে।'
            : 'Version code must be a valid number >= 100 (e.g. 110).'
        );
        setPublishingRelease(false);
        return;
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
      setActionErrorMsg(extractReadableError(err, 'Failed to reactivate account.'));
    }
  };

  const handleConfirmWarn = async () => {
    if (!warnTarget || !user?.email) return;
    try {
      setIsWarning(true);
      await issueWarning(warnTarget.userId, warnTarget.email, warnTarget.displayName, warnText, user.email);
      setWarnTarget(null);
      setWarnText('');
      showSuccessBanner(
        language === 'bn'
          ? `${warnTarget.displayName}-কে অফিশিয়াল সতর্কবার্তা পাঠানো হয়েছে।`
          : `Issued official warning to ${warnTarget.displayName}.`
      );
    } catch (err) {
      console.error(err);
      setActionErrorMsg(extractReadableError(err, 'Failed to issue warning.'));
    } finally {
      setIsWarning(false);
    }
  };

  const handleClearWarning = async (u: UserProfile) => {
    if (!user?.email) return;
    try {
      await clearWarning(u.userId, u.email, u.displayName, user.email);
      showSuccessBanner(
        language === 'bn' ? `${u.displayName}-এর সতর্কবার্তা মুছে ফেলা হয়েছে।` : `Cleared warning for ${u.displayName}.`
      );
    } catch (err) {
      console.error(err);
      setActionErrorMsg(extractReadableError(err, 'Failed to clear warning notice.'));
    }
  };

  const handleClearUserAppLock = async () => {
    if (!activeDossierUser || !user?.email) return;
    try {
      setIsClearingLock(true);
      await adminClearUserAppLock(activeDossierUser.userId, user.email);
      showSuccessBanner(
        language === 'bn'
          ? `${activeDossierUser.displayName}-এর অ্যাপ-লক রিসেট করা হয়েছে।`
          : `Cleared Quick App-Lock for ${activeDossierUser.displayName}.`
      );
    } catch (err) {
      console.error(err);
      setActionErrorMsg(extractReadableError(err, 'Failed to clear App-Lock PIN.'));
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
      const applicantLabel =
        selectedRecovery.email ||
        selectedRecovery.contactPhone ||
        (selectedRecovery.username ? `@${selectedRecovery.username}` : selectedRecovery.id);
      showSuccessBanner(
        language === 'bn'
          ? `${applicantLabel}-এর সাপোর্ট টিকিট সমাধান করা হয়েছে।`
          : `Support ticket resolved for ${applicantLabel}`
      );
      setSelectedRecovery(null);
      setRecoveryAdminNotes('');
    } catch (err) {
      console.error(err);
      setActionErrorMsg(extractReadableError(err, 'Failed to resolve support ticket.'));
    } finally {
      setResolvingRecovery(false);
    }
  };

  const handleDismissRecovery = async (reqId: string, notes?: string) => {
    if (!user?.email) return;
    try {
      await dismissRecoveryRequest(reqId, notes?.trim() || 'Dismissed by administrator.', user.email);
      showSuccessBanner(language === 'bn' ? 'সাপোর্ট টিকিট বাতিল করা হয়েছে।' : 'Support ticket dismissed.');
      setSelectedRecovery(null);
    } catch (err) {
      console.error(err);
      setActionErrorMsg(extractReadableError(err, 'Failed to dismiss support ticket.'));
    }
  };

  const handleReopenRecovery = async (reqId: string) => {
    if (!user?.email) return;
    try {
      await reopenRecoveryRequest(reqId, user.email);
      showSuccessBanner(
        language === 'bn' ? 'সাপোর্ট টিকিটটি পুনরায় খোলা হয়েছে।' : 'Support ticket reopened.'
      );
    } catch (err) {
      console.error(err);
      setActionErrorMsg(extractReadableError(err, 'Failed to reopen support ticket.'));
    }
  };

  const handleDeleteRecovery = async (reqId: string) => {
    if (!user?.email) return;
    try {
      await deleteRecoveryRequest(reqId, user.email);
      showSuccessBanner(
        language === 'bn' ? 'সাপোর্ট টিকিটটি আর্কাইভ থেকে মুছে ফেলা হয়েছে।' : 'Support ticket deleted.'
      );
    } catch (err) {
      console.error(err);
      setActionErrorMsg(extractReadableError(err, 'Failed to delete support ticket.'));
    }
  };

  const handleSendResetFromSupport = async (targetEmail: string, ticketId: string) => {
    if (!user?.email) return;
    try {
      await sendAdminPasswordResetEmail(targetEmail, user.email, ticketId);
      showSuccessBanner(
        language === 'bn'
          ? `${targetEmail} ঠিকানায় পাসওয়ার্ড রিসেট ইমেইল পাঠানো হয়েছে।`
          : `Password reset email sent to ${targetEmail}.`
      );
    } catch (err) {
      console.error(err);
      setActionErrorMsg(extractReadableError(err, 'Failed to send password reset email.'));
    }
  };

  const handleClearAppLockFromSupport = async (targetUser: UserProfile, ticketId?: string) => {
    if (!user?.email) return;
    try {
      await adminClearUserAppLock(targetUser.userId, user.email, ticketId);
      showSuccessBanner(
        language === 'bn'
          ? `${targetUser.displayName}-এর অ্যাপ-লক পিন রিসেট করা হয়েছে।`
          : `Cleared Quick App-Lock for ${targetUser.displayName}.`
      );
    } catch (err) {
      console.error(err);
      setActionErrorMsg(extractReadableError(err, 'Failed to clear App-Lock PIN.'));
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
      showSuccessBanner(
        language === 'bn' ? 'ব্রডকাস্ট নোটিশ প্রকাশিত হয়েছে।' : 'Published broadcast announcement.'
      );
    } catch (err) {
      console.error(err);
      setActionErrorMsg(extractReadableError(err, 'Failed to publish announcement.'));
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
    const term = userSearch.trim().toLowerCase();
    const digitTerm = extractPhoneDigits(userSearch);
    const historyPhones = (u.phoneHistory || []).map((h) => h.phone);
    const allUserPhones = [u.phoneNumber, u.initialPhoneNumber, ...historyPhones].filter(
      (p): p is string => Boolean(p)
    );
    return (
      u.displayName?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.username?.toLowerCase().includes(term) ||
      allUserPhones.some(
        (p) =>
          p.toLowerCase().includes(term) ||
          (digitTerm.length >= 3 && extractPhoneDigits(p).includes(digitTerm))
      ) ||
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

  const recoveryCounts = {
    all: recoveryRequests.length,
    pending: recoveryRequests.filter((r) => r.status === 'pending').length,
    resolved: recoveryRequests.filter((r) => r.status === 'resolved').length,
    dismissed: recoveryRequests.filter((r) => r.status === 'dismissed').length,
  };

  const filteredRecovery = recoveryRequests.filter((r) => {
    if (recoveryFilter === 'pending' && r.status !== 'pending') return false;
    if (recoveryFilter === 'resolved' && r.status !== 'resolved') return false;
    if (recoveryFilter === 'dismissed' && r.status !== 'dismissed') return false;

    if (!recoverySearch.trim()) return true;
    const term = recoverySearch.trim().toLowerCase();
    const cleanTermHandle = term.replace(/^@/, '');
    const digitTerm = extractPhoneDigits(recoverySearch);

    const directMatch =
      r.email?.toLowerCase().includes(term) ||
      r.name?.toLowerCase().includes(term) ||
      (cleanTermHandle.length > 0 && r.username?.toLowerCase().includes(cleanTermHandle)) ||
      r.contactPhone?.toLowerCase().includes(term) ||
      (digitTerm.length >= 3 && extractPhoneDigits(r.contactPhone).includes(digitTerm)) ||
      r.topic?.toLowerCase().includes(term) ||
      r.requesterUid?.toLowerCase().includes(term) ||
      r.details?.toLowerCase().includes(term) ||
      r.adminNotes?.toLowerCase().includes(term) ||
      r.id.toLowerCase().includes(term);

    if (directMatch) return true;

    const uidMatch = r.details?.match(/UID:\s*([A-Za-z0-9_-]{6,128})/i)?.[1];
    const resolvedUid = r.requesterUid || (uidMatch && uidMatch !== 'unknown' ? uidMatch : undefined);
    const matchedUser = usersList.find(
      (u) =>
        (resolvedUid && u.userId === resolvedUid) ||
        (r.email && u.email?.trim().toLowerCase() === r.email.trim().toLowerCase()) ||
        (r.username && u.username?.trim().toLowerCase() === r.username.trim().replace(/^@/, '').toLowerCase()) ||
        doPhonesMatch(r.contactPhone, u.phoneNumber)
    );
    if (!matchedUser) return false;
    return (
      matchedUser.displayName?.toLowerCase().includes(term) ||
      matchedUser.email?.toLowerCase().includes(term) ||
      (cleanTermHandle.length > 0 && matchedUser.username?.toLowerCase().includes(cleanTermHandle)) ||
      (digitTerm.length >= 3 && extractPhoneDigits(matchedUser.phoneNumber).includes(digitTerm))
    );
  });

  const reportCounts = {
    all: reports.length,
    pending: reports.filter((r) => r.status === 'pending').length,
    resolved: reports.filter((r) => r.status === 'resolved').length,
    dismissed: reports.filter((r) => r.status === 'dismissed').length,
  };

  const filteredReports = reports.filter((r) => {
    if (reportFilter === 'pending' && r.status !== 'pending') return false;
    if (reportFilter === 'resolved' && r.status !== 'resolved') return false;
    if (reportFilter === 'dismissed' && r.status !== 'dismissed') return false;
    if (reportReasonFilter !== 'all' && r.reason !== reportReasonFilter) return false;

    if (!reportSearch.trim()) return true;
    const term = reportSearch.trim().toLowerCase();
    const digitTerm = extractPhoneDigits(reportSearch);
    const targetUser = usersList.find((u) => u.userId === r.targetUserId);
    const reporterUser = usersList.find((u) => u.userId === r.reporterId);
    const phoneCandidates = [
      r.targetPhoneNumber,
      r.targetInitialPhoneNumber,
      r.reporterPhoneNumber,
      r.reporterInitialPhoneNumber,
      targetUser?.phoneNumber,
      targetUser?.initialPhoneNumber,
      ...(targetUser?.phoneHistory || []).map((h) => h.phone),
      reporterUser?.phoneNumber,
      reporterUser?.initialPhoneNumber,
      ...(reporterUser?.phoneHistory || []).map((h) => h.phone),
    ].filter((p): p is string => Boolean(p));

    return (
      r.id.toLowerCase().includes(term) ||
      r.targetUserName?.toLowerCase().includes(term) ||
      r.targetUserEmail?.toLowerCase().includes(term) ||
      r.reporterName?.toLowerCase().includes(term) ||
      r.reporterEmail?.toLowerCase().includes(term) ||
      r.messageText?.toLowerCase().includes(term) ||
      r.details?.toLowerCase().includes(term) ||
      r.resolutionNotes?.toLowerCase().includes(term) ||
      phoneCandidates.some(
        (p) =>
          p.toLowerCase().includes(term) ||
          (digitTerm.length >= 3 && extractPhoneDigits(p).includes(digitTerm))
      )
    );
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
          <div className="bg-rose-600 text-white text-xs py-2 px-4 flex items-center justify-between gap-2 font-medium shadow z-30">
            <div className="w-4 shrink-0" />
            <div className="flex items-center justify-center gap-2 text-center">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{actionErrorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionErrorMsg(null)}
              className="p-0.5 rounded hover:bg-rose-500/50 text-white cursor-pointer shrink-0"
              title={t('close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex border-b border-slate-800 bg-slate-950/40 px-3 sm:px-6 gap-1.5 overflow-x-auto shrink-0 scrollbar-none">
          {[
            { id: 'overview', label: t('adminTabOverview'), icon: Sparkles },
            { id: 'users', label: t('adminTabUsers'), icon: Users, badge: totalUsersCount },
            { id: 'chat_audit', label: t('adminTabChatAudit'), icon: MessageSquare, badge: totalChatsCount },
            { id: 'backup', label: language === 'bn' ? 'ড্রাইভ ব্যাকআপ' : 'Drive Backup', icon: HardDrive },
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
                if (isSuperAdmin(u.email)) return;
                setBanTarget(u);
                setBanReason('');
                setBanDuration('7');
              }}
              onClearWarning={handleClearWarning}
              onOpenWarn={(u) => {
                setWarnTarget(u);
                setWarnText('');
              }}
              userPhoneRegistryMap={userPhoneRegistryMap}
              allUsersList={usersList}
              globalSecuritySettings={globalSecuritySettings}
              adminSecuritySettings={adminSecuritySettings}
              securityPolicyBusy={securityActionBusy}
              onSaveGlobalSecuritySettings={handleSaveGlobalSecuritySettings}
              onSaveAdminSecuritySettings={handleSaveAdminSecuritySettings}
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
              setSelectedChat={(c) => {
                setHighlightedMessageId(null);
                setSelectedChat(c);
              }}
              chatMessages={chatMessages}
              highlightedMessageId={highlightedMessageId}
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
                if (isSuperAdmin(u.email)) return;
                setBanTarget(u);
                setBanReason(reason.slice(0, 500));
                setBanDuration('7');
              }}
              onDeleteMessage={async (chatId, msgId) => {
                if (!user?.email) return;
                try {
                  const linkedIds = reports
                    .filter((r) => r.chatId === chatId && r.messageId === msgId)
                    .map((r) => r.id);
                  const deleted = await deleteAdminMessage(chatId, msgId, user.email, 'Admin moderation violation', linkedIds);
                  if (deleted) {
                    showSuccessBanner(
                      language === 'bn' ? 'চ্যাট রুম থেকে মেসেজ ডিলিট করা হয়েছে।' : 'Deleted message from chat room.'
                    );
                  } else {
                    setActionErrorMsg(
                      language === 'bn'
                        ? 'এই মেসেজটি ইতিমধ্যেই ডিলিট করা হয়েছে।'
                        : 'This message has already been deleted.'
                    );
                  }
                } catch (err) {
                  setActionErrorMsg(extractReadableError(err, 'Failed to delete message.'));
                }
              }}
            />
          )}

          {activeTab === 'recovery' && (
            <AdminRecoveryTab
              t={t}
              language={language}
              usersList={usersList}
              filteredRecovery={filteredRecovery}
              recoveryCounts={recoveryCounts}
              recoveryFilter={recoveryFilter}
              setRecoveryFilter={setRecoveryFilter}
              recoverySearch={recoverySearch}
              setRecoverySearch={setRecoverySearch}
              copiedText={copiedText}
              onCopy={copyToClipboard}
              onOpenDossier={(u) => setSelectedDossierUser(u)}
              onClearAppLock={handleClearAppLockFromSupport}
              onSendResetEmail={handleSendResetFromSupport}
              onDismiss={handleDismissRecovery}
              onReopen={handleReopenRecovery}
              onDelete={handleDeleteRecovery}
              onSelectResolve={(req) => {
                setSelectedRecovery(req);
                setRecoveryAdminNotes('');
              }}
            />
          )}

          {activeTab === 'reports' && (
            <AdminReportsTab
              t={t}
              language={language}
              usersList={usersList}
              filteredReports={filteredReports}
              reportCounts={reportCounts}
              reportFilter={reportFilter}
              setReportFilter={setReportFilter}
              reportSearch={reportSearch}
              setReportSearch={setReportSearch}
              reportReasonFilter={reportReasonFilter}
              setReportReasonFilter={setReportReasonFilter}
              copiedText={copiedText}
              onCopy={copyToClipboard}
              userPhoneRegistryMap={userPhoneRegistryMap}
              originalUidByPhoneHash={originalUidByPhoneHash}
              onOpenBan={(u, reason) => {
                if (isSuperAdmin(u.email)) return;
                setBanTarget(u);
                setBanReason(reason.slice(0, 500));
                setBanDuration('7');
              }}
              onOpenWarn={(u, text) => {
                setWarnTarget(u);
                setWarnText(text.slice(0, 1000));
              }}
              onOpenDossier={(u) => setSelectedDossierUser(u)}
              onInspectChat={handleInspectReportChat}
              onDeleteReportedMessage={async (chatId, msgId, reason, reportId) => {
                if (!user?.email) return;
                try {
                  const linkedIds = Array.from(
                    new Set([
                      reportId,
                      ...reports
                        .filter((r) => r.chatId === chatId && r.messageId === msgId)
                        .map((r) => r.id),
                    ])
                  );
                  const deleted = await deleteAdminMessage(chatId, msgId, user.email, reason, linkedIds);
                  if (deleted) {
                    showSuccessBanner(
                      language === 'bn' ? 'অপরাধমূলক মেসেজটি ডিলিট করা হয়েছে।' : 'Deleted offending message.'
                    );
                  } else {
                    showSuccessBanner(
                      language === 'bn'
                        ? 'মেসেজটি আগেই ডিলিট করা হয়েছিল — রিপোর্ট স্ট্যাটাস আপডেট করা হয়েছে।'
                        : 'Message was already deleted — synced report record.'
                    );
                  }
                } catch (err) {
                  setActionErrorMsg(extractReadableError(err, 'Failed to delete reported message.'));
                }
              }}
              onResolveReport={async (reportId, status, notes) => {
                if (!user?.email) return;
                try {
                  await updateReportStatus(reportId, status, notes, user.email);
                  if (status === 'resolved') {
                    showSuccessBanner(
                      language === 'bn' ? 'রিপোর্টটি মীমাংসিত হিসেবে চিহ্নিত হয়েছে।' : 'Report marked as resolved.'
                    );
                  } else if (status === 'dismissed') {
                    showSuccessBanner(
                      language === 'bn' ? 'রিপোর্টটি বাতিল করা হয়েছে।' : 'Report dismissed.'
                    );
                  } else {
                    showSuccessBanner(
                      language === 'bn' ? 'রিপোর্টটি পুনরায় পর্যালোচনার জন্য খোলা হয়েছে।' : 'Report reopened for review.'
                    );
                  }
                } catch (err) {
                  setActionErrorMsg(extractReadableError(err, 'Failed to update report status.'));
                }
              }}
              onDeleteReport={async (reportId) => {
                if (!user?.email) return;
                try {
                  await deleteReport(reportId, user.email);
                  showSuccessBanner(
                    language === 'bn' ? 'রিপোর্টটি আর্কাইভ থেকে মুছে ফেলা হয়েছে।' : 'Report deleted from archive.'
                  );
                } catch (err) {
                  setActionErrorMsg(extractReadableError(err, 'Failed to delete report.'));
                }
              }}
              onNotifyMissingUser={(targetName) => {
                setActionErrorMsg(
                  language === 'bn'
                    ? `${targetName}-এর ইউজার অ্যাকাউন্টটি আর ডাটাবেজে পাওয়া যায়নি (সম্ভবত ডিলিট হয়েছে)।`
                    : `User account for ${targetName} was not found in the database (it may have been deleted).`
                );
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
                if (!user?.email) return;
                try {
                  await toggleAnnouncement(id, nextActive, user.email);
                } catch (err) {
                  setActionErrorMsg(extractReadableError(err, 'Failed to toggle announcement.'));
                }
              }}
              onDeleteAnnouncement={async (id) => {
                if (!user?.email) return;
                try {
                  await deleteAnnouncement(id, user.email);
                } catch (err) {
                  setActionErrorMsg(extractReadableError(err, 'Failed to delete announcement.'));
                }
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

          {activeTab === 'backup' && (
            <AdminBackupTab
              language={language}
              allChats={allChats}
              onSuccess={showSuccessBanner}
              onError={(msg) => setActionErrorMsg(msg || null)}
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
        selectedDossierUser={activeDossierUser}
        onCloseDossier={() => setSelectedDossierUser(null)}
        onConfirmUnban={handleConfirmUnban}
        onInspectUserChats={handleInspectUserChats}
        onEnterGhostMode={onEnterGhostMode}
        isClearingLock={isClearingLock}
        onClearUserAppLock={handleClearUserAppLock}
        get7DayActivity={get7DayActivity}
        dossierPhoneRegistry={activeDossierPhoneRegistry}
        allUsersList={usersList}
        phoneActionBusy={phoneActionBusy}
        onTogglePhoneManualBlock={handleTogglePhoneManualBlock}
        onReleasePhoneSlot={handleReleasePhoneSlot}
        onUpdatePhoneLimit={handleUpdatePhoneLimit}
        onSelectDossierUser={(u) => setSelectedDossierUser(u)}
        globalSecuritySettings={globalSecuritySettings}
        adminSecuritySettings={adminSecuritySettings}
        dossierDeviceSessions={dossierDeviceSessions}
        securityActionBusy={securityActionBusy}
        onUnlockPhoneCooldown={handleUnlockPhoneCooldown}
        onUpdateUserDeviceLimits={handleUpdateUserDeviceLimits}
        onAdminForceLogoutDevice={handleAdminForceLogoutDevice}
        onAdminApproveDevice={handleAdminApproveDevice}
        onAdminDeleteDevice={handleAdminDeleteDevice}
        selectedRecovery={selectedRecovery}
        onCloseRecovery={() => setSelectedRecovery(null)}
        recoveryAdminNotes={recoveryAdminNotes}
        setRecoveryAdminNotes={setRecoveryAdminNotes}
        resolvingRecovery={resolvingRecovery}
        onResolveRecovery={handleResolveRecovery}
        banTarget={banTarget}
        onCloseBan={() => {
          setBanTarget(null);
          setBanReason('');
          setBanDuration('7');
        }}
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
