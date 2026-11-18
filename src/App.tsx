/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { LoginScreen } from './components/LoginScreen';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { NewChatModal } from './components/NewChatModal';
import { ProfileModal } from './components/ProfileModal';
import { ShareLinkModal } from './components/ShareLinkModal';
import { QrScannerModal } from './components/QrScannerModal';
import { RequestsModal } from './components/RequestsModal';
import { ConnectPreviewModal } from './components/ConnectPreviewModal';
import { BannedScreen } from './components/BannedScreen';
import { WarningNoticeModal } from './components/WarningNoticeModal';
import { AnnouncementBanner } from './components/AnnouncementBanner';
import { UpdateModal } from './components/UpdateModal';
import { useModalHistory } from './hooks/useModalHistory';

const AdminModal = lazy(() => import('./components/AdminModal').then((m) => ({ default: m.AdminModal })));
const CallModal = lazy(() => import('./components/CallModal').then((m) => ({ default: m.CallModal })));
import {
  subscribeToUserChats,
  subscribeToUserFriendships,
  getOrCreateDirectChat,
} from './services/chatService';
import {
  getPendingDeepLinkTarget,
  setPendingDeepLinkTarget,
  isAndroidMobileBrowser,
  buildAndroidAppIntentUrl,
  type DeepLinkTarget,
} from './utils/accountShortcut';
import { subscribeToIncomingDirectCalls } from './services/callService';
import {
  isAppNotificationSupported,
  getAppNotificationPermission,
  requestAppNotificationPermission,
  isAppInBackground,
  showChatOrCallNotification,
  cancelAppNotification,
  type AppNotificationPermission,
} from './services/notificationService';
import { isSuperAdmin, SUPPORT_DESK_ADDRESS, extractPhoneDigits } from './services/adminService';
import { subscribeToLatestRelease, type AppReleaseInfo } from './services/updateService';
import { isUpdateAvailable, isNativeApkApp } from './utils/appVersion';
import type { ChatRoom, CallSession, Friendship, UserProfile } from './types/chat';
import {
  MessageSquare,
  Lock,
  Globe,
  Loader2,
  MessageSquarePlus,
  WifiOff,
  Eye,
  ArrowLeft,
  ShieldCheck,
  MailCheck,
  X,
  LogOut,
  KeyRound,
  Bell,
  Phone,
  AtSign,
  ScanLine,
  Smartphone,
} from 'lucide-react';

function AppLockGate() {
  const { user, unlockAppWithPin, signOutUser } = useAuth();
  const { language } = useLanguage();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) return;
    setChecking(true);
    setError(null);
    const res = await unlockAppWithPin(pin);
    if (!res.success) {
      setError(res.error || (language === 'bn' ? 'পিন সঠিক নয়।' : 'Incorrect App-Lock PIN.'));
      setPin('');
    }
    setChecking(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 safe-area-container">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <KeyRound className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white">
            {language === 'bn' ? 'অ্যাপ লক করা আছে' : 'App-Lock Protected'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {language === 'bn'
              ? `${user?.displayName || 'ব্যবহারকারী'}, চ্যাটে প্রবেশ করতে আপনার ৪-৬ ডিজিটের পিন দিন।`
              : `Enter your 4-6 digit Quick App-Lock PIN for ${user?.displayName || 'your account'}.`}
          </p>
        </div>

        {error && (
          <div className="p-2.5 bg-rose-950/60 border border-rose-500/40 rounded-xl text-xs text-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleUnlock} className="space-y-3">
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="••••"
            maxLength={6}
            className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-center text-lg font-mono tracking-[0.5em] text-white focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={checking || pin.length < 4}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2"
          >
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            <span>{language === 'bn' ? 'আনলক করুন' : 'Unlock Messenger'}</span>
          </button>
        </form>

        <button
          type="button"
          onClick={signOutUser}
          className="text-xs text-slate-400 hover:text-rose-400 inline-flex items-center gap-1.5 cursor-pointer transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{language === 'bn' ? 'লগআউট করে পাসওয়ার্ড দিয়ে ঢুকুন' : 'Sign out & use password'}</span>
        </button>
      </div>
    </div>
  );
}

function PhoneNumberGate() {
  const { user, savePhoneNumber, signOutUser } = useAuth();
  const { language } = useLanguage();
  const [phone, setPhone] = useState('');
  const [usernameInput, setUsernameInput] = useState(user?.username || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (extractPhoneDigits(phone).length < 7) {
      setError(
        language === 'bn'
          ? 'দয়া করে কমপক্ষে ৭ ডিজিটের সঠিক মোবাইল নম্বর দিন।'
          : 'Please enter a valid mobile number (at least 7 digits).'
      );
      return;
    }
    setSaving(true);
    try {
      await savePhoneNumber(phone, !user?.username && usernameInput.trim() ? usernameInput.trim() : undefined);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : language === 'bn'
          ? 'মোবাইল নম্বর সংরক্ষণ করতে সমস্যা হয়েছে।'
          : 'Failed to save mobile number.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 safe-area-container">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5">
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Phone className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-white">
            {language === 'bn' ? 'অ্যাকাউন্ট সুরক্ষায় মোবাইল নম্বর যুক্ত করুন' : 'Add Your Mobile Number'}
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {language === 'bn'
              ? `আপনার অ্যাকাউন্ট পরিচিতি নিশ্চিত করতে এবং ভবিষ্যতে ইমেইল/অ্যাকাউন্ট রিকভারির (${SUPPORT_DESK_ADDRESS}) জন্য মোবাইল নম্বর যুক্ত করা বাধ্যতামূলক। এই নম্বরটি কেবল আপনার ও অ্যাডমিনের কাছেই গোপন থাকবে।`
              : `A mobile number is required for identity verification and account recovery via ${SUPPORT_DESK_ADDRESS}. Your number remains private and is never shown to other users.`}
          </p>
        </div>

        {error && (
          <div className="p-2.5 bg-rose-950/60 border border-rose-500/40 rounded-xl text-xs text-rose-200 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-3.5">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300 block">
              {language === 'bn' ? 'মোবাইল নম্বর' : 'Mobile Number'} <span className="text-emerald-400">*</span>
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                required
                autoFocus
                maxLength={50}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+880 1XXX-XXXXXX"
                className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {!user?.username && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 block">
                {language === 'bn' ? 'ইউজারনেম (ঐচ্ছিক)' : 'Username (Optional)'}
              </label>
              <div className="relative">
                <AtSign className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  maxLength={50}
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value.replace(/\s+/g, ''))}
                  placeholder="username"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={saving || extractPhoneDigits(phone).length < 7}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 shadow"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            <span>{language === 'bn' ? 'সংরক্ষণ করে চ্যাটে প্রবেশ করুন' : 'Save & Continue to Messenger'}</span>
          </button>
        </form>

        <div className="text-center pt-1">
          <button
            type="button"
            onClick={signOutUser}
            className="text-xs text-slate-400 hover:text-rose-400 inline-flex items-center gap-1.5 cursor-pointer transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? 'অন্য অ্যাকাউন্ট দিয়ে ঢুকুন (লগআউট)' : 'Sign out'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatDashboard({ user }: { user: UserProfile }) {
  const { deletionNotice, recoverAccount, signOutUser, firebaseUser, resendVerificationEmail } = useAuth();
  const { t, language } = useLanguage();
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [selectedChat, setSelectedChat] = useState<ChatRoom | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [shareGroupTarget, setShareGroupTarget] = useState<ChatRoom | null>(null);
  const [connectPreviewTarget, setConnectPreviewTarget] = useState<DeepLinkTarget | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [callSession, setCallSession] = useState<CallSession | null>(null);
  const [dismissVerifyBanner, setDismissVerifyBanner] = useState(false);
  const [verificationSentNote, setVerificationSentNote] = useState<string | null>(null);
  const [notifPermission, setNotifPermission] = useState<AppNotificationPermission>(() =>
    getAppNotificationPermission()
  );
  const [dismissNotifBanner, setDismissNotifBanner] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('anomah_dismiss_notif_banner') === '1';
    } catch {
      return false;
    }
  });

  // Refs for background notification deduplication and Android tap deep-linking
  const activeChatIdRef = useRef<string | null>(null);
  const chatsRef = useRef<ChatRoom[]>([]);
  const chatsInitializedRef = useRef(false);
  const lastNotifiedMsgTimeRef = useRef<Map<string, string>>(new Map());
  const activeIncomingCallNotifRef = useRef<string | null>(null);
  const callActiveRef = useRef(false);
  const pendingOpenChatIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
    if (activeChatId) {
      cancelAppNotification(`msg_${activeChatId}`);
    }
  }, [activeChatId]);

  useEffect(() => {
    chatsRef.current = chats;
    if (pendingOpenChatIdRef.current) {
      const target = chats.find((c) => c.id === pendingOpenChatIdRef.current);
      if (target) {
        setActiveChatId(target.id);
        setSelectedChat(target);
        pendingOpenChatIdRef.current = null;
      }
    }
  }, [chats]);

  useEffect(() => {
    callActiveRef.current = Boolean(callSession?.active);
    if (!callSession && activeIncomingCallNotifRef.current) {
      cancelAppNotification(activeIncomingCallNotifRef.current);
      activeIncomingCallNotifRef.current = null;
    }
  }, [callSession]);

  // Sync notification permission state when returning from system dialog or settings
  useEffect(() => {
    const syncPerm = () => setNotifPermission(getAppNotificationPermission());
    window.addEventListener('anomah_notification_permission_changed', syncPerm);
    window.addEventListener('focus', syncPerm);
    document.addEventListener('visibilitychange', syncPerm);
    return () => {
      window.removeEventListener('anomah_notification_permission_changed', syncPerm);
      window.removeEventListener('focus', syncPerm);
      document.removeEventListener('visibilitychange', syncPerm);
    };
  }, []);

  // Open chat when user taps an Android native notification (handles both warm & cold launch)
  useEffect(() => {
    const openFromNotification = (chatId?: string | null) => {
      if (!chatId) return;
      const found = chatsRef.current.find((c) => c.id === chatId);
      if (found) {
        setActiveChatId(found.id);
        setSelectedChat(found);
        pendingOpenChatIdRef.current = null;
      } else {
        setActiveChatId(chatId);
        pendingOpenChatIdRef.current = chatId;
      }
    };

    const win = window as unknown as { __pendingNotificationChatId?: string };
    if (win.__pendingNotificationChatId) {
      const pendingId = win.__pendingNotificationChatId;
      delete win.__pendingNotificationChatId;
      openFromNotification(pendingId);
    }

    const handleOpenEvent = (e: CustomEvent<{ chatId?: string }>) => {
      openFromNotification(e.detail?.chatId);
    };
    window.addEventListener('anomah_open_chat_from_notification', handleOpenEvent as EventListener);
    return () => {
      window.removeEventListener('anomah_open_chat_from_notification', handleOpenEvent as EventListener);
    };
  }, []);

  // Ghost Inspection State (Admin enters user DM without login)
  const [ghostUser, setGhostUser] = useState<UserProfile | null>(null);
  const ghostUserRef = useRef<UserProfile | null>(null);
  ghostUserRef.current = ghostUser;
  const userRef = useRef(user);
  userRef.current = user;
  const languageRef = useRef(language);
  languageRef.current = language;

  // Handle personal chat & group deep-links (?chat=, ?group=, QR scanner, or native APK intent)
  useEffect(() => {
    if (ghostUser?.userId || !user.userId) return;

    const openTarget = (target: DeepLinkTarget | null) => {
      if (!target || !target.value) return;
      setPendingDeepLinkTarget(null);
      const win = window as unknown as { __pendingDeepLink?: DeepLinkTarget };
      if (win.__pendingDeepLink) delete win.__pendingDeepLink;
      setConnectPreviewTarget(target);
    };

    const win = window as unknown as { __pendingDeepLink?: DeepLinkTarget };
    if (win.__pendingDeepLink) {
      openTarget(win.__pendingDeepLink);
    } else {
      const stored = getPendingDeepLinkTarget();
      if (stored) {
        openTarget(stored);
      }
    }

    const handleDeepLinkEvent = (e: CustomEvent<DeepLinkTarget>) => {
      if (e.detail) {
        openTarget(e.detail);
      }
    };
    window.addEventListener('anomah_deep_link', handleDeepLinkEvent as EventListener);
    return () => {
      window.removeEventListener('anomah_deep_link', handleDeepLinkEvent as EventListener);
    };
  }, [user.userId, ghostUser?.userId]);

  // Subscribe to live friendships & friend requests
  useEffect(() => {
    if (ghostUser?.userId || !user.userId) {
      setFriendships([]);
      return;
    }
    const unsubscribe = subscribeToUserFriendships(user.userId, setFriendships);
    return () => unsubscribe();
  }, [user.userId, ghostUser?.userId]);

  const pendingRequestsCount = useMemo(
    () =>
      friendships.filter(
        (f) => f.status === 'pending' && f.receiverId === user.userId
      ).length,
    [friendships, user.userId]
  );

  const isPasswordAccount = Boolean(
    firebaseUser?.providerData?.some((p) => p.providerId === 'password')
  );
  const needsEmailVerification = Boolean(
    firebaseUser && !firebaseUser.emailVerified && isPasswordAccount && !dismissVerifyBanner
  );
  const canAccessAdminPanel =
    isSuperAdmin(user?.email) && Boolean(firebaseUser?.emailVerified);

  // Online / Offline state detection (WhatsApp style)
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Subscribe to all chats where current user (or ghost inspected user) is a participant
  useEffect(() => {
    const targetUserId = ghostUser?.userId || user.userId;
    if (!targetUserId) return;
    chatsInitializedRef.current = false;
    lastNotifiedMsgTimeRef.current.clear();

    const unsubscribe = subscribeToUserChats(targetUserId, (data) => {
      setChats(data);
      if (ghostUserRef.current) return;

      if (!chatsInitializedRef.current) {
        chatsInitializedRef.current = true;
        data.forEach((chat) => {
          if (chat.lastMessageTime) {
            lastNotifiedMsgTimeRef.current.set(chat.id, chat.lastMessageTime);
          }
        });
        return;
      }

      data.forEach((chat) => {
        const latestTime = chat.lastMessageTime;
        if (!latestTime) return;
        const prevTime = lastNotifiedMsgTimeRef.current.get(chat.id);
        if (prevTime && latestTime <= prevTime) return;
        lastNotifiedMsgTimeRef.current.set(chat.id, latestTime);

        const isFromOther = Boolean(
          chat.lastMessageSenderId &&
          chat.lastMessageSenderId !== 'system' &&
          chat.lastMessageSenderId !== user.userId
        );
        const shouldAlert = isAppInBackground() || activeChatIdRef.current !== chat.id;
        if (!isFromOther || !shouldAlert) return;

        let title = chat.name || 'Anomah Chat';
        let icon: string | undefined = chat.groupPhoto;
        if (chat.type === 'direct') {
          const partnerId = chat.participantIds.find((id) => id !== user.userId);
          const partner = partnerId ? chat.participantDetails?.[partnerId] : undefined;
          title = partner?.displayName || title;
          icon = partner?.photoURL || icon;
        } else if (chat.lastMessageSenderId) {
          const senderName = chat.participantDetails?.[chat.lastMessageSenderId]?.displayName;
          if (senderName) {
            title = `${chat.name || 'Group'} • ${senderName}`;
          }
        }

        const currentLang = languageRef.current;
        const body = chat.lastMessageText?.trim()
          ? chat.lastMessageText
          : currentLang === 'bn'
          ? 'নতুন মেসেজ এসেছে'
          : 'Sent you a message';

        showChatOrCallNotification({
          id: `msg_${chat.id}`,
          title,
          body,
          type: 'message',
          chatId: chat.id,
          icon,
          onClick: () => {
            setActiveChatId(chat.id);
            setSelectedChat(chat);
          },
        });
      });
    });

    return () => unsubscribe();
  }, [user.userId, ghostUser?.userId]);

  const directChatIdsKey = useMemo(
    () =>
      chats
        .filter((c) => c.type === 'direct' && !c.isSuspended)
        .map((c) => c.id)
        .sort()
        .join(','),
    [chats]
  );

  // Listen for incoming 1-on-1 WebRTC calls across active direct chats
  useEffect(() => {
    if (ghostUser?.userId || user.isBanned || !directChatIdsKey) return;
    const directChats = chatsRef.current.filter((c) => c.type === 'direct' && !c.isSuspended);
    if (directChats.length === 0) return;

    const unsubscribe = subscribeToIncomingDirectCalls(user.userId, directChats, (incoming) => {
      if (!incoming) return;

      if (!callActiveRef.current && activeIncomingCallNotifRef.current !== incoming.id && isAppInBackground()) {
        activeIncomingCallNotifRef.current = incoming.id;
        const currentLang = languageRef.current;
        showChatOrCallNotification({
          id: incoming.id,
          title: incoming.callerName || 'Anomah Chat',
          body:
            incoming.type === 'video'
              ? currentLang === 'bn'
                ? 'ইনকামিং ভিডিও কল আসছে...'
                : 'Incoming video call...'
              : currentLang === 'bn'
              ? 'ইনকামিং অডিও কল আসছে...'
              : 'Incoming voice call...',
          type: 'call',
          chatId: incoming.chatId,
          icon: incoming.callerPhoto,
          onClick: () => {
            setActiveChatId(incoming.chatId);
          },
        });
      }

      setCallSession((prev) => {
        if (prev && prev.active) return prev;
        return {
          active: true,
          callId: incoming.id,
          chatId: incoming.chatId,
          role: 'callee',
          type: incoming.type,
          partnerId: incoming.callerId,
          recipientName: incoming.callerName,
          recipientPhoto: incoming.callerPhoto,
          status: 'ringing',
          isMuted: false,
          isVideoOff: incoming.type === 'audio',
          durationSeconds: 0,
          signalData: incoming,
        };
      });
    });

    return () => unsubscribe();
  }, [directChatIdsKey, user.userId, user.isBanned, ghostUser?.userId]);

  const handleExitGhostMode = useCallback(() => {
    setGhostUser(null);
    setActiveChatId(null);
    setSelectedChat(null);
    setShowAdmin(true);
  }, []);

  // Handle mobile hardware back and Escape key while in Ghost Mode
  useModalHistory(Boolean(ghostUser), handleExitGhostMode);

  const activeChat =
    (activeChatId ? chats.find((c) => c.id === activeChatId) : null) ||
    (selectedChat &&
    Array.isArray(selectedChat.participantIds) &&
    selectedChat.participantIds.includes((ghostUser || user).userId)
      ? selectedChat
      : null);

  return (
    <div className="h-screen w-screen bg-slate-950 flex flex-col overflow-hidden font-sans relative safe-area-container">
      {/* 15-Day Account Deletion Recovery Banner */}
      {deletionNotice && (
        <div className="bg-gradient-to-r from-red-600 to-rose-600 text-white px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2 z-50 shadow-md">
          <div className="flex items-center gap-2">
            <span className="font-bold bg-white/20 px-2 py-0.5 rounded-full text-[10px]">
              {t('gracePeriodTitle')}
            </span>
            <span>
              {t('gracePeriodBanner', { days: deletionNotice.daysRemaining })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={recoverAccount}
              className="px-3 py-1 bg-white text-slate-900 hover:bg-slate-100 rounded-lg font-bold text-xs cursor-pointer shadow transition"
            >
              {t('recoverAccountBtn')}
            </button>
            <button
              onClick={signOutUser}
              className="px-2.5 py-1 bg-black/25 hover:bg-black/40 text-white rounded-lg text-xs cursor-pointer transition"
            >
              {t('logoutBtn')}
            </button>
          </div>
        </div>
      )}

      {/* Email Verification Reminder Banner */}
      {needsEmailVerification && (
        <div className="bg-amber-950/90 border-b border-amber-500/30 text-amber-100 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 z-40">
          <div className="flex items-center gap-2 min-w-0">
            <MailCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">
              {verificationSentNote ||
                (language === 'bn'
                  ? 'নিরাপত্তার জন্য আপনার ইমেইল ভেরিফাই করুন (ইনবক্স বা স্প্যাম চেক করুন)।'
                  : 'Please verify your email address for full account security.')}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={async () => {
                try {
                  await resendVerificationEmail();
                  setVerificationSentNote(
                    language === 'bn'
                      ? 'ভেরিফিকেশন লিংক পাঠানো হয়েছে! লিংকে ক্লিক করে রিলোড করুন।'
                      : 'Verification email sent! Check your inbox then reload.'
                  );
                } catch {
                  setVerificationSentNote(
                    language === 'bn' ? 'কিছুক্ষণ পর আবার চেষ্টা করুন।' : 'Please try again shortly.'
                  );
                }
              }}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg font-bold text-[11px] cursor-pointer transition"
            >
              {language === 'bn' ? 'ভেরিফিকেশন লিংক পাঠান' : 'Resend Verification'}
            </button>
            <button
              type="button"
              onClick={() => setDismissVerifyBanner(true)}
              className="p-1 text-amber-300 hover:text-white cursor-pointer"
              aria-label={t('close')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Notification Permission Opt-In Banner */}
      {isAppNotificationSupported() && notifPermission === 'default' && !dismissNotifBanner && !ghostUser && (
        <div className="bg-slate-900/95 border-b border-emerald-500/30 text-slate-100 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 z-40">
          <div className="flex items-center gap-2 min-w-0">
            <Bell className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">
              {language === 'bn'
                ? 'অ্যাপ মিনিমাইজ বা ব্যাকগ্রাউন্ডে থাকলেও মেসেজ ও কলের এলার্ট পেতে নোটিফিকেশন চালু করুন।'
                : 'Enable notifications to receive alerts for new messages and incoming calls in the background.'}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={async () => {
                const result = await requestAppNotificationPermission();
                setNotifPermission(result);
              }}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[11px] cursor-pointer transition shadow-xs"
            >
              {language === 'bn' ? 'চালু করুন' : 'Enable Alerts'}
            </button>
            <button
              type="button"
              onClick={() => {
                setDismissNotifBanner(true);
                try {
                  sessionStorage.setItem('anomah_dismiss_notif_banner', '1');
                } catch {
                  // ignore
                }
              }}
              className="p-1 text-slate-400 hover:text-white cursor-pointer"
              aria-label={t('close')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Offline Status Banner (WhatsApp/Messenger Style) */}
      {!isOnline && (
        <div className="bg-amber-600/95 text-amber-50 text-[11px] font-semibold py-1 px-4 text-center flex items-center justify-center gap-2 shadow-lg backdrop-blur-sm z-40">
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>{t('offlineBanner')}</span>
        </div>
      )}

      {/* Global Broadcast Announcement Banner */}
      <AnnouncementBanner />

      {/* Admin Ghost Mode Top Persistent Banner */}
      {ghostUser && (
        <div className="bg-slate-900 text-white px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2.5 z-50 shadow-sm animate-in slide-in-from-top-2 border-b border-sky-500/30">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0 border border-sky-500/20 shadow-xs">
              <Eye className="w-4 h-4 text-sky-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-sky-400 tracking-wider">
                  {t('ghostModeBannerTitle')}
                </span>
                <span className="text-slate-600">·</span>
                <span className="font-semibold text-xs text-white truncate">{ghostUser.displayName}</span>
                {ghostUser.email && (
                  <span className="text-slate-400 text-xs truncate hidden sm:inline">({ghostUser.email})</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5 hidden md:block">
                {t('ghostModeBannerDesc')
                  .replace('{name}', ghostUser.displayName)
                  .replace('{email}', ghostUser.email || ghostUser.userId)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExitGhostMode}
              className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-medium text-xs cursor-pointer shadow-xs transition flex items-center gap-1.5 active:scale-[0.99]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t('exitGhostModeBtn')}</span>
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden relative">
      {/* Sidebar: Visible on desktop, or on mobile when no active chat is opened */}
      <div
        className={`${
          activeChat ? 'hidden md:flex' : 'flex'
        } w-full md:w-auto h-full flex-col`}
      >
        <Sidebar
          chats={chats}
          activeChatId={activeChat?.id || activeChatId}
          onSelectChat={(id) => {
            setActiveChatId(id);
            const found = chats.find((c) => c.id === id);
            if (found) setSelectedChat(found);
          }}
          onOpenNewChat={() => setShowNewChat(true)}
          onOpenProfile={() => setShowProfile(true)}
          onOpenShare={() => {
            setShareGroupTarget(null);
            setShowShare(true);
          }}
          onOpenRequests={() => setShowRequests(true)}
          onOpenQrScanner={() => setShowQrScanner(true)}
          pendingRequestsCount={pendingRequestsCount}
          onOpenAdmin={() => {
            if (canAccessAdminPanel) setShowAdmin(true);
          }}
          ghostUser={ghostUser}
          onExitGhostMode={handleExitGhostMode}
        />
      </div>

      {/* Main Conversation Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
        {activeChat ? (
          <ChatArea
            key={activeChat.id}
            chat={activeChat}
            friendships={friendships}
            onBack={() => {
              setActiveChatId(null);
              setSelectedChat(null);
            }}
            onStartCall={(session) => setCallSession(session)}
            onOpenGroupShareQR={(groupChat) => {
              setShareGroupTarget(groupChat);
              setShowShare(true);
            }}
            ghostUser={ghostUser}
            onExitGhostMode={handleExitGhostMode}
          />
        ) : (
          /* Normalized Empty State - Clean Telegram/WhatsApp style */
          <div className="hidden md:flex flex-1 flex-col items-center justify-center p-6 bg-slate-950 text-center select-none border-l border-slate-800/80">
            <div className="max-w-sm flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 text-emerald-400 flex items-center justify-center mb-4 shadow-sm">
                <MessageSquare className="w-7 h-7 stroke-[1.75]" />
              </div>

              <h2 className="text-lg font-bold text-white mb-1.5">{t('emptyChatTitle')}</h2>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                {t('emptyChatSubtitle')}
              </p>

              <div className="flex flex-wrap justify-center gap-2.5">
                <button
                  onClick={() => setShowNewChat(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer flex items-center gap-2 active:scale-[0.99]"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  <span>{t('startNewChatBtn')}</span>
                </button>
                <button
                  onClick={() => setShowQrScanner(true)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700/80 transition cursor-pointer flex items-center gap-1.5"
                >
                  <ScanLine className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{language === 'bn' ? 'QR স্ক্যান' : 'Scan QR'}</span>
                </button>
                <button
                  onClick={() => {
                    setShareGroupTarget(null);
                    setShowShare(true);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-slate-700/80 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('shareLinkBtn')}</span>
                </button>
              </div>

              <div className="mt-12 flex items-center gap-1.5 text-[11px] text-slate-500">
                <Lock className="w-3.5 h-3.5" />
                <span>{t('securityFooter')}</span>
              </div>
            </div>
          </div>
        )}
      </main>
      </div>

      {/* User Warning Modal if Warning Issued */}
      <WarningNoticeModal />

      {/* Super Admin Control Panel Modal (Requires verified Super Admin email) */}
      {showAdmin && canAccessAdminPanel && (
        <Suspense fallback={null}>
          <AdminModal
            onClose={() => setShowAdmin(false)}
            onEnterGhostMode={(targetUser, targetChatId) => {
              setGhostUser(targetUser);
              setShowAdmin(false);
              if (targetChatId) {
                setActiveChatId(targetChatId);
              } else {
                setActiveChatId(null);
                setSelectedChat(null);
              }
            }}
          />
        </Suspense>
      )}

      {/* Modals */}
      {showNewChat && (
        <NewChatModal
          existingChats={chats}
          friendships={friendships}
          onClose={() => setShowNewChat(false)}
          onSelectChat={(room) => {
            setActiveChatId(room.id);
            setSelectedChat(room);
            setShowNewChat(false);
          }}
          onStartDirectCall={(room, partner, callType) => {
            setActiveChatId(room.id);
            setSelectedChat(room);
            setShowNewChat(false);
            setCallSession({
              active: true,
              chatId: room.id,
              role: 'caller',
              type: callType,
              partnerId: partner.userId,
              recipientName: partner.displayName,
              recipientPhoto:
                partner.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${partner.userId}`,
              status: 'calling',
              isMuted: false,
              isVideoOff: callType === 'audio',
              durationSeconds: 0,
            });
          }}
          onOpenShareQR={() => {
            setShareGroupTarget(null);
            setShowShare(true);
          }}
          onOpenQrScanner={() => setShowQrScanner(true)}
        />
      )}

      {showRequests && (
        <RequestsModal
          currentUser={user}
          friendships={friendships}
          onClose={() => setShowRequests(false)}
          onOpenChatWithFriend={async (friend, callType) => {
            const room = await getOrCreateDirectChat(user, friend);
            setActiveChatId(room.id);
            setSelectedChat(room);
            if (callType) {
              setCallSession({
                active: true,
                chatId: room.id,
                role: 'caller',
                type: callType,
                partnerId: friend.userId,
                recipientName: friend.displayName,
                recipientPhoto:
                  friend.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${friend.userId}`,
                status: 'calling',
                isMuted: false,
                isVideoOff: callType === 'audio',
                durationSeconds: 0,
              });
            }
          }}
          onOpenQrScanner={() => setShowQrScanner(true)}
          onOpenNewChat={() => setShowNewChat(true)}
        />
      )}

      {showQrScanner && (
        <QrScannerModal
          onClose={() => setShowQrScanner(false)}
          onDetected={(detectedTarget) => {
            setShowQrScanner(false);
            setConnectPreviewTarget(detectedTarget);
          }}
        />
      )}

      {connectPreviewTarget && (
        <ConnectPreviewModal
          target={connectPreviewTarget}
          currentUser={user}
          existingChats={chats}
          friendships={friendships}
          onClose={() => setConnectPreviewTarget(null)}
          onOpenChat={(room) => {
            setActiveChatId(room.id);
            setSelectedChat(room);
          }}
          onOpenShareSelf={() => {
            setShareGroupTarget(null);
            setShowShare(true);
          }}
        />
      )}

      {showProfile && (
        <ProfileModal
          key={user.userId}
          onClose={() => setShowProfile(false)}
          onOpenAdmin={() => {
            if (canAccessAdminPanel) setShowAdmin(true);
          }}
          onOpenShareQR={() => {
            setShareGroupTarget(null);
            setShowShare(true);
          }}
        />
      )}

      {showShare && (
        <ShareLinkModal
          groupChat={shareGroupTarget}
          onClose={() => {
            setShowShare(false);
            setShareGroupTarget(null);
          }}
          onOpenProfileSettings={() => setShowProfile(true)}
          onOpenQrScanner={() => setShowQrScanner(true)}
        />
      )}

      {callSession && (
        <Suspense fallback={null}>
          <CallModal
            session={callSession}
            currentUser={user}
            onEndCall={() => setCallSession(null)}
          />
        </Suspense>
      )}
    </div>
  );
}

function MainContent() {
  const { user, loading, isAppLocked } = useAuth();
  const { t, language } = useLanguage();
  const [pendingRelease, setPendingRelease] = useState<AppReleaseInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [androidAppChooserTarget, setAndroidAppChooserTarget] = useState<DeepLinkTarget | null>(null);

  const isDashboardActive = Boolean(user && !user.isBanned && !isAppLocked && user.phoneNumber?.trim());

  // Capture ?chat= / ?group= deep-link even if user passes through Login / AppLock / PhoneGate first
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const groupParam = params.get('group')?.trim();
    const chatParam = params.get('chat')?.trim();
    const qrFlag = params.get('qr') === '1' || params.get('qr') === 'true';

    let urlTarget: DeepLinkTarget | null = null;
    if (groupParam) {
      urlTarget = { type: 'group', value: groupParam, isQr: qrFlag };
    } else if (chatParam) {
      urlTarget = { type: 'chat', value: chatParam, isQr: qrFlag };
    }

    if (urlTarget) {
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`);
      if (isAndroidMobileBrowser()) {
        setAndroidAppChooserTarget(urlTarget);
      } else {
        setPendingDeepLinkTarget(urlTarget);
        window.dispatchEvent(new CustomEvent('anomah_deep_link', { detail: urlTarget }));
      }
    }
  }, []);

  // Preserve native Android intent deep-links received before login/gates finish
  useEffect(() => {
    const handlePreDashboardDeepLink = (e: CustomEvent<DeepLinkTarget>) => {
      if (!isDashboardActive && e.detail) {
        setPendingDeepLinkTarget(e.detail);
      }
    };
    window.addEventListener('anomah_deep_link', handlePreDashboardDeepLink as EventListener);
    return () => {
      window.removeEventListener('anomah_deep_link', handlePreDashboardDeepLink as EventListener);
    };
  }, [isDashboardActive]);

  // Subscribe to real-time app releases (Option 3 In-App Auto-Updater)
  useEffect(() => {
    if (!isNativeApkApp()) {
      return;
    }

    const unsubscribe = subscribeToLatestRelease((release) => {
      if (release && isUpdateAvailable(release)) {
        setPendingRelease(release);
        const dismissed = sessionStorage.getItem(`dismissed_update_${release.versionCode}`);
        if (!dismissed || release.forceUpdate) {
          setShowUpdateModal(true);
        }
      } else {
        setPendingRelease(null);
        setShowUpdateModal(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Listen to manual update check events (Strictly for Native APK)
  useEffect(() => {
    const handleCheckEvent = (e: CustomEvent<{ release?: AppReleaseInfo }>) => {
      if (!isNativeApkApp()) return;
      if (e.detail?.release) {
        setPendingRelease(e.detail.release);
        setShowUpdateModal(true);
      }
    };
    window.addEventListener('anomah_open_update_modal', handleCheckEvent as EventListener);
    return () => window.removeEventListener('anomah_open_update_modal', handleCheckEvent as EventListener);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-3" />
        <span className="text-xs text-slate-400 tracking-wide">{t('connectingCloud')}</span>
      </div>
    );
  }

  return (
    <>
      {!user ? (
        <LoginScreen />
      ) : user.isBanned ? (
        <BannedScreen />
      ) : isAppLocked ? (
        <AppLockGate />
      ) : !user.phoneNumber?.trim() ? (
        <PhoneNumberGate />
      ) : (
        <ChatDashboard key={user.userId} user={user} />
      )}

      {/* External Android Mobile Browser -> Suggest Installed APK or Continue in Web/PWA */}
      {androidAppChooserTarget && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4 text-center relative">
            <button
              type="button"
              onClick={() => {
                setPendingDeepLinkTarget(androidAppChooserTarget);
                window.dispatchEvent(new CustomEvent('anomah_deep_link', { detail: androidAppChooserTarget }));
                setAndroidAppChooserTarget(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Smartphone className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">
                {language === 'bn' ? 'কোন অ্যাপে খুলতে চান?' : 'Open in Anomah Chat?'}
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                {language === 'bn'
                  ? 'আপনার ফোনে Anomah Chat APK অ্যাপ ইন্সটল করা থাকলে সরাসরি অ্যাপে খুলতে পারেন, অথবা ওয়েব/PWA ভার্সনে চালিয়ে যেতে পারেন।'
                  : 'Open this link directly in your installed Anomah Chat Android app, or continue in the Web / PWA version.'}
              </p>
            </div>

            <div className="space-y-2.5 pt-1">
              <a
                href={buildAndroidAppIntentUrl(androidAppChooserTarget)}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow"
              >
                <Smartphone className="w-4 h-4" />
                <span>{language === 'bn' ? 'Anomah Chat APK অ্যাপে খুলুন' : 'Open in Android APK App'}</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  setPendingDeepLinkTarget(androidAppChooserTarget);
                  window.dispatchEvent(new CustomEvent('anomah_deep_link', { detail: androidAppChooserTarget }));
                  setAndroidAppChooserTarget(null);
                }}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700/80 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Globe className="w-4 h-4 text-emerald-400" />
                <span>{language === 'bn' ? 'ওয়েব / PWA ভার্সনে চালিয়ে যান' : 'Continue in Web / PWA'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Auto Updater Modal (Strictly for Native Mobile APK) */}
      {showUpdateModal && pendingRelease && isNativeApkApp() && (
        <UpdateModal
          release={pendingRelease}
          onClose={() => {
            setShowUpdateModal(false);
            if (!pendingRelease.forceUpdate) {
              sessionStorage.setItem(`dismissed_update_${pendingRelease.versionCode}`, 'true');
            }
          }}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <MainContent />
      </AuthProvider>
    </LanguageProvider>
  );
}
