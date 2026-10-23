/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
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
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react';

function ChatDashboard() {
  const { user, loading } = useAuth();
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [selectedChat, setSelectedChat] = useState<ChatRoom | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [callSession, setCallSession] = useState<CallSession | null>(null);

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
        <span className="text-xs text-slate-400 tracking-wide">Connecting to Anomah Chat Cloud...</span>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  const activeChat = chats.find((c) => c.id === activeChatId) || selectedChat || null;

  return (
    <div className="h-screen w-screen bg-slate-950 flex overflow-hidden font-sans">
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
          /* Empty State - WhatsApp Web Style Showcase */
          <div className="hidden md:flex flex-1 flex-col items-center justify-center p-8 bg-slate-950 text-center select-none border-l border-slate-800/80">
            <div className="max-w-md flex flex-col items-center">
              <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/10">
                <MessageSquare className="w-10 h-10" />
              </div>

              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-2xl font-bold text-white">Anomah Chat</h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold">
                  Mahi A01
                </span>
              </div>
              <p className="text-xs text-emerald-400 font-semibold mb-3">Created & Built by Mahi Muhtasim</p>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                Send and receive personal messages, voice notes, and media anywhere in the world. Your messages stay synchronized securely in Firebase Cloud.
              </p>

              <div className="grid grid-cols-2 gap-3 w-full mb-8 text-left">
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-1">
                    <Globe className="w-3.5 h-3.5" /> Worldwide Reach
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Chat seamlessly from different countries or across tabs.
                  </p>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs">
                  <div className="flex items-center gap-1.5 text-teal-400 font-semibold mb-1">
                    <Smartphone className="w-3.5 h-3.5" /> Multi-Device
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Works smoothly on mobile phones, tablets, and laptops.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowNewChat(true)}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/30 transition cursor-pointer flex items-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Start New Conversation</span>
                </button>
                <button
                  onClick={() => setShowShare(true)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition cursor-pointer flex items-center gap-2"
                >
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Share App Link</span>
                </button>
              </div>

              <div className="mt-10 flex flex-col items-center gap-1 text-[11px] text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>End-to-End Database Cloud Security</span>
                </div>
                <span className="text-[10px] text-slate-600">
                  Anomah Chat • Owner: Mahi Muhtasim • Version: Mahi A01
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

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
    <AuthProvider>
      <ChatDashboard />
    </AuthProvider>
  );
}
