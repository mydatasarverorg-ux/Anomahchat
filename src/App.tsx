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
import { subscribeToUserChats } from './services/chatService';
import type { ChatRoom, CallSession } from './types/chat';
import {
  MessageSquare,
  Lock,
  Globe,
  Loader2,
  Sparkles,
  WifiOff,
} from 'lucide-react';

function ChatDashboard() {
  const { user, loading, deletionNotice, recoverAccount, signOutUser } = useAuth();
  const { t } = useLanguage();
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [selectedChat, setSelectedChat] = useState<ChatRoom | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [callSession, setCallSession] = useState<CallSession | null>(null);

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

  // Subscribe to all chats where current user is a participant
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToUserChats(user.userId, (data) => {
      setChats(data);
      // Auto select first chat if none selected on desktop
      if (!activeChatId && !selectedChat && data.length > 0 && window.innerWidth >= 768) {
        setActiveChatId(data[0].id);
        setSelectedChat(data[0]);
      }
    });

    return () => unsubscribe();
  }, [user, activeChatId, selectedChat]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-3" />
        <span className="text-xs text-slate-400 tracking-wide">{t('connectingCloud')}</span>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  const activeChat = chats.find((c) => c.id === activeChatId) || selectedChat || null;

  return (
    <div className="h-screen w-screen bg-slate-950 flex flex-col overflow-hidden font-sans relative">
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

      {/* Offline Status Banner (WhatsApp/Messenger Style) */}
      {!isOnline && (
        <div className="bg-amber-600/95 text-amber-50 text-[11px] font-semibold py-1 px-4 text-center flex items-center justify-center gap-2 shadow-lg backdrop-blur-sm z-40">
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>{t('offlineBanner')}</span>
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
        />
      </div>

      {/* Main Conversation Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
        {activeChat ? (
          <ChatArea
            chat={activeChat}
            onBack={() => {
              setActiveChatId(null);
              setSelectedChat(null);
            }}
            onStartCall={(session) => setCallSession(session)}
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
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow transition cursor-pointer flex items-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
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

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}

      {showShare && <ShareLinkModal onClose={() => setShowShare(false)} />}

      {callSession && (
        <CallModal session={callSession} onEndCall={() => setCallSession(null)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <ChatDashboard />
      </AuthProvider>
    </LanguageProvider>
  );
}
