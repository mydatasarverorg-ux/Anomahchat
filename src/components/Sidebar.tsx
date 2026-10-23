import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { ChatRoom, UserProfile } from '../types/chat';
import {
  MessageSquarePlus,
  Search,
  Globe,
  Settings,
  LogOut,
  Users,
  Check,
  CheckCheck,
  MessageCircle,
} from 'lucide-react';

interface SidebarProps {
  chats: ChatRoom[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onOpenNewChat: () => void;
  onOpenProfile: () => void;
  onOpenShare: () => void;
}

export function Sidebar({
  chats,
  activeChatId,
  onSelectChat,
  onOpenNewChat,
  onOpenProfile,
  onOpenShare,
}: SidebarProps) {
  const { user, signOutUser } = useAuth();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'direct' | 'group'>('all');

  const getChatDisplay = (chat: ChatRoom) => {
    if (chat.type === 'group') {
      return {
        name: chat.name || 'Group Chat',
        photo: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100&auto=format&fit=crop&q=80',
        isOnline: false,
        about: `${chat.participantIds.length} members`,
      };
    }

    // Direct chat: find partner
    const partnerId = chat.participantIds.find((id) => id !== user?.userId) || chat.participantIds[0];
    const details = chat.participantDetails?.[partnerId];
    return {
      name: details?.displayName || 'Chat Partner',
      photo: details?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${partnerId}`,
      isOnline: false, // Updated by presence
      about: details?.email || '',
    };
  };

  const filteredChats = chats.filter((chat) => {
    if (filter === 'direct' && chat.type !== 'direct') return false;
    if (filter === 'group' && chat.type !== 'group') return false;
    if (!search.trim()) return true;

    const display = getChatDisplay(chat);
    return (
      display.name.toLowerCase().includes(search.toLowerCase()) ||
      chat.lastMessageText?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <aside className="w-full md:w-80 lg:w-96 bg-slate-900 border-r border-slate-800 flex flex-col h-full select-none shrink-0">
      {/* Top Header */}
      <div className="p-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div
          onClick={onOpenProfile}
          className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-800/80 cursor-pointer transition max-w-[180px]"
          title="Click to view & edit your profile"
        >
          <div className="relative">
            <img
              src={user?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.userId}`}
              alt={user?.displayName || 'Me'}
              className="w-9 h-9 rounded-full object-cover border-2 border-emerald-500"
            />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-900" />
          </div>
          <div className="truncate">
            <span className="text-xs font-bold text-white block truncate">{user?.displayName}</span>
            <span className="text-[10px] text-emerald-400 block font-medium">Online</span>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenShare}
            className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition cursor-pointer relative"
            title="Worldwide Link - Share to chat across devices"
          >
            <Globe className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenNewChat}
            className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white transition cursor-pointer"
            title="Start New Chat / Create Group"
          >
            <MessageSquarePlus className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenProfile}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Settings / Profile"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={signOutUser}
            className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-slate-800 transition cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-slate-800/60">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search or start new chat"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-800/70 border border-slate-700/60 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/70"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex gap-1.5 mt-2.5 text-[11px]">
          {(['all', 'direct', 'group'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-2.5 py-1 rounded-lg font-medium capitalize transition cursor-pointer ${
                filter === t
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              {t === 'all' ? 'All Chats' : t === 'direct' ? 'Direct' : 'Groups'}
            </button>
          ))}
        </div>
      </div>

      {/* Chats List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
        {filteredChats.length === 0 ? (
          <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center">
            <MessageCircle className="w-10 h-10 text-slate-600 mb-2 stroke-[1.5]" />
            <p className="text-xs font-semibold text-slate-400 mb-1">No conversations yet</p>
            <p className="text-[11px] text-slate-500 mb-4 max-w-[200px]">
              Tap the new chat icon above to start chatting with anyone in the world!
            </p>
            <button
              onClick={onOpenNewChat}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shadow"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              <span>Start Chatting</span>
            </button>
          </div>
        ) : (
          filteredChats.map((chat) => {
            const display = getChatDisplay(chat);
            const isActive = chat.id === activeChatId;
            const isSentByMe = chat.lastMessageSenderId === user?.userId;

            return (
              <div
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`flex items-center gap-3 p-3 transition cursor-pointer ${
                  isActive
                    ? 'bg-slate-800 border-l-4 border-emerald-500'
                    : 'hover:bg-slate-800/50'
                }`}
              >
                <div className="relative shrink-0">
                  <img
                    src={display.photo}
                    alt={display.name}
                    className="w-11 h-11 rounded-full object-cover bg-slate-700"
                  />
                  {chat.type === 'group' && (
                    <span className="absolute -bottom-1 -right-1 p-0.5 bg-emerald-700 rounded-full text-white">
                      <Users className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-bold text-white truncate max-w-[150px]">
                      {display.name}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {formatTime(chat.lastMessageTime || chat.updatedAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-1 truncate text-[11px]">
                      {isSentByMe && (
                        <CheckCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      )}
                      <span className="truncate">{chat.lastMessageText || 'No messages yet'}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Global Share Banner Footer */}
      <div className="p-3 bg-slate-950/90 border-t border-slate-800/80 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[11px] text-slate-200 font-semibold">Anomah Chat</span>
          </div>
          <button
            onClick={onOpenShare}
            className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <Globe className="w-3 h-3" />
            <span>Invite / Share</span>
          </button>
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5 border-t border-slate-800/40">
          <span>Owner: <strong className="text-slate-300">Mahi Muhtasim</strong></span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-[9px] font-bold border border-emerald-500/20">
            Mahi A01
          </span>
        </div>
      </div>
    </aside>
  );
}
