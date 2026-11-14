/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { LoginScreen } from './components/LoginScreen';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { NewChatModal } from './components/NewChatModal';
import { ProfileModal } from './components/ProfileModal';
import { ShareLinkModal } from './components/ShareLinkModal';
import { CallModal } from './components/CallModal';
import { BannedScreen } from './components/BannedScreen';
import { WarningNoticeModal } from './components/WarningNoticeModal';
import { AnnouncementBanner } from './components/AnnouncementBanner';
import { AdminModal } from './components/AdminModal';
import { UpdateModal } from './components/UpdateModal';
import { subscribeToUserChats } from './services/chatService';
import { isSuperAdmin } from './services/adminService';
import { subscribeToLatestRelease, type AppReleaseInfo } from './services/updateService';
import { isUpdateAvailable, isNativeApkApp } from './utils/appVersion';
import type { ChatRoom, CallSession, UserProfile } from './types/chat';
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

function ChatDashboard({ user }: { user: UserProfile }) {
  const { deletionNotice, recoverAccount, signOutUser, firebaseUser, resendVerificationEmail } = useAuth();
  const { t, language } = useLanguage();
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [selectedChat, setSelectedChat] = useState<ChatRoom | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [callSession, setCallSession] = useState<CallSession | null>(null);
  const [dismissVerifyBanner, setDismissVerifyBanner] = useState(false);
  const [verificationSentNote, setVerificationSentNote] = useState<string | null>(null);

  // Ghost Inspection State (Admin enters user DM without login)
  const [ghostUser, setGhostUser] = useState<UserProfile | null>(null);

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
    const targetUserId = ghostUser ? ghostUser.userId : user.userId;
    if (!targetUserId) return;
    const unsubscribe = subscribeToUserChats(targetUserId, (data) => {
      setChats(data);
    });

    return () => unsubscribe();
  }, [user.userId, ghostUser]);

  // Handle mobile hardware back and Escape key while in Ghost Mode
  useEffect(() => {
    if (!ghostUser) return;
    window.history.pushState({ modal: 'ghostMode' }, '');
    const handlePopState = () => {
      setGhostUser(null);
      setActiveChatId(null);
      setSelectedChat(null);
      setShowAdmin(true);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handlePopState();
      }
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [ghostUser]);

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
              onClick={() => {
                setGhostUser(null);
                setActiveChatId(null);
                setSelectedChat(null);
                setShowAdmin(true);
              }}
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
          onOpenShare={() => setShowShare(true)}
          onOpenAdmin={() => {
            if (canAccessAdminPanel) setShowAdmin(true);
          }}
          ghostUser={ghostUser}
          onExitGhostMode={() => {
            setGhostUser(null);
            setActiveChatId(null);
            setSelectedChat(null);
            setShowAdmin(true);
          }}
        />
      </div>

      {/* Main Conversation Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
        {activeChat ? (
          <ChatArea
            key={activeChat.id}
            chat={activeChat}
            onBack={() => {
              setActiveChatId(null);
              setSelectedChat(null);
            }}
            onStartCall={(session) => setCallSession(session)}
            ghostUser={ghostUser}
            onExitGhostMode={() => {
              setGhostUser(null);
              setActiveChatId(null);
              setSelectedChat(null);
              setShowAdmin(true);
            }}
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

              <div className="flex gap-2.5">
                <button
                  onClick={() => setShowNewChat(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer flex items-center gap-2 active:scale-[0.99]"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  <span>{t('startNewChatBtn')}</span>
                </button>
                <button
                  onClick={() => setShowShare(true)}
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
      )}

      {/* Modals */}
      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onSelectChat={(room) => {
            setActiveChatId(room.id);
            setSelectedChat(room);
            setShowNewChat(false);
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
        />
      )}

      {showShare && <ShareLinkModal onClose={() => setShowShare(false)} />}

      {callSession && (
        <CallModal session={callSession} onEndCall={() => setCallSession(null)} />
      )}
    </div>
  );
}

function MainContent() {
  const { user, loading, isAppLocked } = useAuth();
  const { t } = useLanguage();
  const [pendingRelease, setPendingRelease] = useState<AppReleaseInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

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
      ) : (
        <ChatDashboard key={user.userId} user={user} />
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
