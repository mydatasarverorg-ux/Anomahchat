import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { deleteChatRoom, formatLastSeenStatus } from '../services/chatService';
import type { ChatRoom, UserProfile } from '../types/chat';
import {
  MessageSquarePlus,
  Search,
  Globe,
  Settings,
  LogOut,
  Users,
  CheckCheck,
  MessageCircle,
  Trash2,
  AlertTriangle,
  Languages,
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
  const { language, toggleLanguage, t } = useLanguage();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'direct' | 'group'>('all');
  const [chatToDelete, setChatToDelete] = useState<ChatRoom | null>(null);
  const [liveUsersMap, setLiveUsersMap] = useState<Record<string, UserProfile>>({});

  // Real-time live presence listener for users
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const map: Record<string, UserProfile> = {};
        snapshot.forEach((docItem) => {
          map[docItem.id] = docItem.data() as UserProfile;
        });
        setLiveUsersMap(map);
      },
      (error) => {
        console.warn('Users presence listener warning:', error);
      }
    );
    return () => unsubscribe();
  }, []);

  const getChatDisplay = (chat: ChatRoom) => {
    if (chat.type === 'group') {
      return {
        name: chat.name || t('filterGroup'),
        photo: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100&auto=format&fit=crop&q=80',
        isOnline: false,
        about: t('membersCount', { count: chat.participantIds.length }),
      };
    }

    // Direct chat: find partner
    const partnerId = chat.participantIds.find((id) => id !== user?.userId) || chat.participantIds[0];
    const liveProfile = liveUsersMap[partnerId];
    const details = chat.participantDetails?.[partnerId];
    const presence = liveProfile
      ? formatLastSeenStatus(liveProfile.lastSeen, liveProfile.isOnline)
      : { isOnline: false, statusText: t('offline') };

    return {
      name: liveProfile?.displayName || details?.displayName || (language === 'bn' ? 'ব্যবহারকারী' : 'User'),
      photo: liveProfile?.photoURL || details?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${partnerId}`,
      isOnline: presence.isOnline,
      about: liveProfile?.email || details?.email || '',
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
      return t('yesterday');
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <aside className="w-full md:w-80 lg:w-96 bg-slate-900 border-r border-slate-800 flex flex-col h-full select-none shrink-0">
      {/* Normalized Top Header (56px standard) */}
      <div className="h-14 px-3.5 bg-slate-900 border-b border-slate-800/80 flex items-center justify-between shrink-0">
        <div
          onClick={onOpenProfile}
          className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-800/80 cursor-pointer transition max-w-[150px]"
          title={t('openProfileTooltip')}
        >
          <div className="relative shrink-0">
            <img
              src={user?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.userId}`}
              alt={user?.displayName || 'Me'}
              className="w-8 h-8 rounded-full object-cover border border-slate-700 bg-slate-800 shadow-sm"
            />
            <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border-2 border-slate-900" />
          </div>
          <div className="truncate">
            <span className="text-xs font-bold text-white block truncate">{user?.displayName}</span>
            <span className="text-[10px] text-emerald-400 block font-medium leading-none">{t('active')}</span>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-0.5">
          {/* Quick Language Toggle */}
          <button
            onClick={toggleLanguage}
            className="p-1.5 px-2 rounded-xl text-slate-300 hover:text-emerald-400 hover:bg-slate-800 transition cursor-pointer flex items-center gap-1 text-[11px] font-semibold border border-slate-750"
            title={language === 'en' ? 'Switch to বাংলা' : 'Switch to English'}
          >
            <Languages className="w-3.5 h-3.5 text-emerald-400" />
            <span>{language === 'en' ? 'EN' : 'বাং'}</span>
          </button>

          <button
            onClick={onOpenNewChat}
            className="p-2 rounded-xl text-slate-300 hover:text-emerald-400 hover:bg-slate-800 transition cursor-pointer"
            title={t('newChatTooltip')}
          >
            <MessageSquarePlus className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenShare}
            className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition cursor-pointer"
            title={t('shareLinkTooltip')}
          >
            <Globe className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenProfile}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title={t('settingsTooltip')}
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={signOutUser}
            className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-slate-800 transition cursor-pointer"
            title={t('logoutTooltip')}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Input & Segmented Filters */}
      <div className="p-2.5 border-b border-slate-800/60 bg-slate-900/50">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-800/80 border border-slate-700/60 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/70 transition"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 mt-2 text-[11px]">
          {(['all', 'direct', 'group'] as const).map((tag) => (
            <button
              key={tag}
              onClick={() => setFilter(tag)}
              className={`flex-1 py-1 px-2 rounded-lg font-medium transition cursor-pointer text-center ${
                filter === tag
                  ? 'bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
              }`}
            >
              {tag === 'all' ? t('filterAll') : tag === 'direct' ? t('filterDirect') : t('filterGroup')}
            </button>
          ))}
        </div>
      </div>

      {/* Chats List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/30">
        {filteredChats.length === 0 ? (
          <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center">
            <MessageCircle className="w-9 h-9 text-slate-600 mb-2 stroke-[1.5]" />
            <p className="text-xs font-semibold text-slate-300 mb-1">{t('noChatsFound')}</p>
            <p className="text-[11px] text-slate-500 mb-4 max-w-[200px]">
              {t('noChatsSubtitle')}
            </p>
            <button
              onClick={onOpenNewChat}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shadow"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              <span>{t('startChatting')}</span>
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
                className={`group flex items-center gap-3 px-3 py-2.5 transition cursor-pointer ${
                  isActive
                    ? 'bg-slate-800/90 border-l-3 border-emerald-500'
                    : 'hover:bg-slate-800/40'
                }`}
              >
                <div className="relative shrink-0">
                  <img
                    src={display.photo}
                    alt={display.name}
                    className="w-10 h-10 rounded-full object-cover bg-slate-800 border border-slate-700/60 shadow-sm"
                  />
                  {chat.type === 'group' ? (
                    <span className="absolute -bottom-0.5 -right-0.5 p-0.5 bg-emerald-700 rounded-full text-white">
                      <Users className="w-2.5 h-2.5" />
                    </span>
                  ) : display.isOnline ? (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-900" />
                  ) : null}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-semibold text-white truncate max-w-[130px]">
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
                      <span className="truncate">{chat.lastMessageText || t('noMessageYet')}</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setChatToDelete(chat);
                      }}
                      className="opacity-70 md:opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/15 transition cursor-pointer shrink-0"
                      title={t('deleteChatTooltip')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Subtle 1-line quiet status footer */}
      <div className="px-3.5 py-2 bg-slate-950/80 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
        <span>{t('appName')}</span>
        <button
          onClick={onOpenShare}
          className="hover:text-emerald-400 transition cursor-pointer flex items-center gap-1"
        >
          <Globe className="w-3 h-3" />
          <span>{t('shareLinkBtn')}</span>
        </button>
      </div>

      {/* Delete Chat Confirmation Modal */}
      {chatToDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">{t('deleteConversationTitle')}</h4>
                <p className="text-xs text-slate-400">
                  {t('deleteConversationConfirmText', { name: getChatDisplay(chatToDelete).name })}
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setChatToDelete(null)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (user && chatToDelete) {
                    await deleteChatRoom(chatToDelete.id, user.userId);
                    setChatToDelete(null);
                  }
                }}
                className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-semibold text-white cursor-pointer shadow flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('delete')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
