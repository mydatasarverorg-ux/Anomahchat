import { useEffect, useRef, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  subscribeToChatMessages,
  sendMessage,
  markChatMessagesAsRead,
  toggleMessageReaction,
  deleteChatMessage,
  editChatMessage,
  deleteChatRoom,
  subscribeToDirectoryUser,
  formatLastSeenStatus,
} from '../services/chatService';
import type { ChatRoom, ChatMessage, CallSession, UserProfile, DirectoryUser } from '../types/chat';
import { sounds } from '../utils/audioEffects';
import { compressImageForChat } from '../utils/imageCompressor';
import {
  Phone,
  Video,
  Send,
  Mic,
  Smile,
  Paperclip,
  MoreVertical,
  Trash2,
  AlertTriangle,
  ArrowLeft,
  X,
  Search,
  Flag,
  ShieldAlert,
  Loader2,
  MicOff,
  Info,
  Users,
  UserX,
} from 'lucide-react';
import { ReportModal } from './ReportModal';
import { GroupInfoModal } from './GroupInfoModal';
import { MessageInfoModal } from './MessageInfoModal';
import { MessageBubble } from './chat/MessageBubble';
import { MessageContextMenu } from './chat/MessageContextMenu';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';

interface ChatAreaProps {
  chat: ChatRoom;
  onBack: () => void;
  onStartCall: (session: CallSession) => void;
  ghostUser?: UserProfile | null;
  onExitGhostMode?: () => void;
}

export function ChatArea({
  chat,
  onBack,
  onStartCall,
  ghostUser,
  onExitGhostMode,
}: ChatAreaProps) {
  const { user } = useAuth();
  const effectiveUser = ghostUser || user;
  const { language, t } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);
  const [messageInfoTarget, setMessageInfoTarget] = useState<ChatMessage | null>(null);

  const [reportTarget, setReportTarget] = useState<{
    targetUserId: string;
    targetUserName: string;
    targetUserEmail?: string;
    chatId?: string;
    messageId?: string;
    messageText?: string;
  } | null>(null);

  const [partnerUser, setPartnerUser] = useState<DirectoryUser | null>(null);

  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [editText, setEditText] = useState('');
  const [showDeleteChatConfirm, setShowDeleteChatConfirm] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<ChatMessage | null>(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);

  const [activeMenuMessage, setActiveMenuMessage] = useState<ChatMessage | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{ id: string; time: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const partnerId =
    chat.type === 'direct'
      ? chat.participantIds.find((id) => id !== effectiveUser?.userId) || chat.participantIds[0]
      : null;
  const partnerDetails = partnerId ? chat.participantDetails?.[partnerId] : null;

  // Real-time subscription to partner's non-PII directory presence
  useEffect(() => {
    if (!partnerId) {
      setPartnerUser(null);
      return;
    }
    const unsubscribe = subscribeToDirectoryUser(partnerId, (profile) => {
      setPartnerUser(profile);
    });
    return () => unsubscribe();
  }, [partnerId]);

  const isPartnerDeleted =
    chat.type === 'direct' &&
    (Boolean(partnerUser?.status === 'scheduled_for_deletion' || partnerUser?.status === 'deleted') ||
      Boolean(partnerDetails?.status === 'scheduled_for_deletion' || partnerDetails?.status === 'deleted'));

  const isPartnerSuspended =
    !isPartnerDeleted &&
    chat.type === 'direct' &&
    (Boolean(chat.isSuspended) ||
      Boolean(partnerUser?.isBanned) ||
      Boolean(partnerDetails?.isBanned));
  const isCurrentUserSuspended = Boolean(effectiveUser?.isBanned);

  const voice = useVoiceRecorder({
    chatId: chat.id,
    user,
    disabled: isPartnerSuspended || isPartnerDeleted || isCurrentUserSuspended || Boolean(ghostUser),
    language,
    t,
  });

  const partnerStatus = isPartnerDeleted
    ? { isOnline: false, statusText: t('deletedAccountStatus') }
    : formatLastSeenStatus(partnerUser?.lastSeen, partnerUser?.isOnline);

  const title =
    chat.type === 'group'
      ? chat.name || t('filterGroup')
      : isPartnerDeleted
      ? t('deletedAccountName')
      : partnerUser?.displayName || partnerDetails?.displayName || (language === 'bn' ? 'ব্যবহারকারী' : 'User');
  const avatar =
    chat.type === 'group'
      ? 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100&auto=format&fit=crop&q=80'
      : isPartnerDeleted
      ? 'https://api.dicebear.com/7.x/bottts/svg?seed=deleted_user'
      : partnerUser?.photoURL || partnerDetails?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${partnerId}`;

  useEffect(() => {
    if (!chat.id) return;
    const unsubscribe = subscribeToChatMessages(chat.id, (msgs) => {
      setMessages(msgs);

      if (msgs.length > 0) {
        const last = msgs[msgs.length - 1];
        if (user && last.senderId !== user.userId && !last.readBy.includes(user.userId)) {
          sounds.playMessageReceived();
        }
      }

      if (user && !ghostUser) {
        const isParticipant = Array.isArray(chat.participantIds) && chat.participantIds.includes(user.userId);
        if (isParticipant) {
          markChatMessagesAsRead(chat.id, user, msgs);
        }
      }
    });

    return () => unsubscribe();
  }, [chat.id, chat.participantIds, user, ghostUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleMessageTap = (msg: ChatMessage) => {
    if (ghostUser) return;
    const now = Date.now();
    if (lastTapRef.current && lastTapRef.current.id === msg.id && now - lastTapRef.current.time < 350) {
      if (user) {
        toggleMessageReaction(chat.id, msg.id, user.userId, '❤️');
      }
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { id: msg.id, time: now };
    }
  };

  const handleTouchStart = (msg: ChatMessage, e: React.TouchEvent | React.MouseEvent) => {
    if (ghostUser && msg.type !== 'text') return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    longPressTimer.current = setTimeout(() => {
      setActiveMenuMessage(msg);
      setMenuPosition({
        x: Math.min(window.innerWidth - 220, Math.max(16, clientX - 80)),
        y: Math.min(window.innerHeight - 260, Math.max(70, clientY - 80)),
      });
    }, 450);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleContextMenu = (e: React.MouseEvent, msg: ChatMessage) => {
    e.preventDefault();
    if (ghostUser && msg.type !== 'text') return;
    setActiveMenuMessage(msg);
    setMenuPosition({
      x: Math.min(window.innerWidth - 220, Math.max(16, e.clientX - 80)),
      y: Math.min(window.innerHeight - 260, Math.max(70, e.clientY - 80)),
    });
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !user || isPartnerSuspended || isPartnerDeleted || isCurrentUserSuspended) return;

    const text = inputText;
    setInputText('');
    const currentReply = replyingTo;
    setReplyingTo(null);
    setShowEmojiPicker(false);

    sounds.playMessageSent();

    await sendMessage({
      chatId: chat.id,
      sender: user,
      text,
      type: 'text',
      replyTo: currentReply
        ? {
            id: currentReply.id,
            text: currentReply.text || (currentReply.type === 'audio' ? t('voiceNoteLabel') : t('imageLabel')),
            senderName: currentReply.senderName,
          }
        : undefined,
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || isPartnerSuspended || isPartnerDeleted || isCurrentUserSuspended) return;
    e.target.value = '';

    try {
      const compressedDataUrl = await compressImageForChat(file);
      sounds.playMessageSent();
      await sendMessage({
        chatId: chat.id,
        sender: user,
        text: t('imageLabel'),
        type: 'image',
        mediaUrl: compressedDataUrl,
      });
    } catch (err) {
      console.error('Failed to process and send image:', err);
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setActiveMenuMessage(null);
  };

  const handleStartEditFromMenu = (msg: ChatMessage) => {
    setEditingMessage(msg);
    setEditText(msg.text);
    setActiveMenuMessage(null);
  };

  const handleSaveEdit = async () => {
    if (!editingMessage || !editText.trim()) return;
    await editChatMessage(chat.id, editingMessage.id, editText);
    setEditingMessage(null);
    setEditText('');
  };

  const confirmDeleteMessage = async () => {
    if (!messageToDelete || ghostUser) return;
    await deleteChatMessage(chat.id, messageToDelete.id);
    setMessageToDelete(null);
  };

  const handleDeleteConversation = async () => {
    if (!user || ghostUser) return;
    await deleteChatRoom(chat.id, user.userId);
    setShowDeleteChatConfirm(false);
    onBack();
  };

  const filteredMessages = useMemo(() => {
    const list = searchQuery.trim()
      ? messages.filter((m) => m.text?.toLowerCase().includes(searchQuery.toLowerCase()))
      : messages;
    return [...list].sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return (a.id || '').localeCompare(b.id || '');
    });
  }, [messages, searchQuery]);

  return (
    <div
      onClick={() => {
        if (activeMenuMessage) setActiveMenuMessage(null);
        if (showHeaderMenu) setShowHeaderMenu(false);
      }}
      className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden relative select-none"
    >
      {/* Top Chat Header */}
      <div className="h-14 px-3.5 bg-slate-900 border-b border-slate-800/80 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div
            onClick={() => {
              if (chat.type === 'group') setShowGroupInfoModal(true);
            }}
            className={`flex items-center gap-2.5 min-w-0 ${
              chat.type === 'group' ? 'cursor-pointer hover:opacity-90 group/header' : ''
            }`}
            title={chat.type === 'group' ? t('groupInfoTitle') : undefined}
          >
            <div className="relative shrink-0">
              <img
                src={avatar}
                alt={title}
                className="w-9 h-9 rounded-full object-cover bg-slate-800 border border-slate-700/60 shadow-sm group-hover/header:border-emerald-500/60 transition"
              />
              {chat.type === 'direct' && partnerStatus.isOnline && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-900" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-xs font-bold text-white truncate max-w-[150px] sm:max-w-xs leading-tight group-hover/header:text-emerald-300 transition">
                  {title}
                </h2>
                {ghostUser && (
                  <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[9px] font-bold shrink-0">
                    {language === 'bn' ? `গোস্ট ডিএম: ${ghostUser.displayName}` : `Ghost: ${ghostUser.displayName}`}
                  </span>
                )}
              </div>
              <p
                className={`text-[10px] truncate leading-none mt-0.5 ${
                  isPartnerDeleted
                    ? 'text-rose-400 font-medium'
                    : isPartnerSuspended
                    ? 'text-amber-400 font-semibold'
                    : partnerStatus.isOnline
                    ? 'text-emerald-400 font-medium'
                    : 'text-slate-400'
                }`}
              >
                {chat.type === 'group' ? (
                  <span className="flex items-center gap-1 text-emerald-400/90 font-medium">
                    <Users className="w-3 h-3" />
                    <span>{t('membersLabel', { count: chat.participantIds.length })}</span>
                  </span>
                ) : isPartnerDeleted ? (
                  <span className="text-rose-400 font-medium flex items-center gap-1">
                    <UserX className="w-3 h-3 text-rose-400 shrink-0" />
                    <span>{t('deletedAccountStatus')}</span>
                  </span>
                ) : isPartnerSuspended ? (
                  <span className="text-amber-400 font-semibold flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>{t('userUnavailableBadge')} ({language === 'bn' ? 'স্থগিত' : 'Suspended'})</span>
                  </span>
                ) : partnerStatus.isOnline ? (
                  t('online')
                ) : partnerStatus.statusText === 'Offline' ? (
                  t('offline')
                ) : (
                  partnerStatus.statusText
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-2 rounded-xl transition cursor-pointer ${
              showSearch ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title={t('searchInChat')}
          >
            <Search className="w-4 h-4" />
          </button>

          {!ghostUser && (
            <>
              <button
                disabled={isPartnerSuspended || isPartnerDeleted || isCurrentUserSuspended}
                onClick={() => {
                  if (isPartnerSuspended || isPartnerDeleted || isCurrentUserSuspended) return;
                  onStartCall({
                    active: true,
                    type: 'audio',
                    recipientName: title,
                    recipientPhoto: avatar,
                    status: 'calling',
                    isMuted: false,
                    isVideoOff: true,
                    durationSeconds: 0,
                  });
                }}
                className={`p-2 rounded-xl transition ${
                  isPartnerSuspended || isPartnerDeleted || isCurrentUserSuspended
                    ? 'text-slate-600 opacity-40 cursor-not-allowed'
                    : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800 cursor-pointer'
                }`}
                title={
                  isPartnerDeleted
                    ? t('deletedAccountCallDisabled')
                    : isPartnerSuspended || isCurrentUserSuspended
                    ? t('callDisabledUserSuspended')
                    : t('audioCall')
                }
              >
                <Phone className="w-4 h-4" />
              </button>

              <button
                disabled={isPartnerSuspended || isPartnerDeleted || isCurrentUserSuspended}
                onClick={() => {
                  if (isPartnerSuspended || isPartnerDeleted || isCurrentUserSuspended) return;
                  onStartCall({
                    active: true,
                    type: 'video',
                    recipientName: title,
                    recipientPhoto: avatar,
                    status: 'calling',
                    isMuted: false,
                    isVideoOff: false,
                    durationSeconds: 0,
                  });
                }}
                className={`p-2 rounded-xl transition ${
                  isPartnerSuspended || isPartnerDeleted || isCurrentUserSuspended
                    ? 'text-slate-600 opacity-40 cursor-not-allowed'
                    : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800 cursor-pointer'
                }`}
                title={
                  isPartnerDeleted
                    ? t('deletedAccountCallDisabled')
                    : isPartnerSuspended || isCurrentUserSuspended
                    ? t('callDisabledUserSuspended')
                    : t('videoCall')
                }
              >
                <Video className="w-4 h-4" />
              </button>
            </>
          )}

          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowHeaderMenu(!showHeaderMenu);
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title={t('menuTitle')}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {showHeaderMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-11 z-40 w-56 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl py-1.5 animate-in fade-in"
              >
                {ghostUser ? (
                  <div className="py-1">
                    <div className="px-3.5 py-2 border-b border-slate-800 text-[11px] text-sky-400 font-semibold flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 shrink-0 text-sky-400" />
                      <div>
                        <span className="block font-bold">
                          {language === 'bn' ? 'রিড-অনলি গোস্ট অডিট' : 'Read-Only Ghost Audit'}
                        </span>
                        <span className="block text-[10px] text-slate-400 font-normal">
                          {language === 'bn' ? 'চ্যাট মোছা বা এডিট নিষ্ক্রিয়' : 'Deleting or editing is disabled'}
                        </span>
                      </div>
                    </div>
                    {onExitGhostMode && (
                      <button
                        onClick={() => {
                          setShowHeaderMenu(false);
                          onExitGhostMode();
                        }}
                        className="w-full px-3.5 py-2.5 text-left text-xs text-sky-300 hover:bg-sky-500/15 flex items-center gap-2 cursor-pointer font-bold transition"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>{t('exitGhostModeBtn')}</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {chat.type === 'group' && (
                      <button
                        onClick={() => {
                          setShowHeaderMenu(false);
                          setShowGroupInfoModal(true);
                        }}
                        className="w-full px-4 py-2 text-left text-xs text-emerald-300 hover:bg-emerald-500/15 flex items-center gap-2 cursor-pointer font-medium transition"
                      >
                        <Info className="w-4 h-4 text-emerald-400" />
                        <span>{t('groupInfoTitle')}</span>
                      </button>
                    )}

                    {partnerId && partnerId !== user?.userId && (
                      <button
                        onClick={() => {
                          setShowHeaderMenu(false);
                          setReportTarget({
                            targetUserId: partnerId,
                            targetUserName: title,
                            targetUserEmail: partnerDetails?.email,
                            chatId: chat.id,
                          });
                        }}
                        className="w-full px-4 py-2 text-left text-xs text-amber-400 hover:bg-amber-500/15 flex items-center gap-2 cursor-pointer font-medium transition"
                      >
                        <Flag className="w-4 h-4" />
                        <span>{t('reportUserAction')}</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setShowHeaderMenu(false);
                        setShowDeleteChatConfirm(true);
                      }}
                      className="w-full px-4 py-2 text-left text-xs text-red-400 hover:bg-red-500/15 flex items-center gap-2 cursor-pointer font-medium transition"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>{t('deleteConversationMenu')}</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showSearch && (
        <div className="px-4 py-2 bg-slate-900/95 border-b border-slate-800 flex items-center gap-2 animate-in slide-in-from-top-2">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder={t('searchInChat')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
            autoFocus
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-white p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 p-6">
            <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-3 text-slate-500">
              <Smile className="w-8 h-8 stroke-1" />
            </div>
            <p className="text-xs font-semibold text-slate-300 mb-1">{t('noMessagesInChat')}</p>
            <p className="text-[11px] text-slate-500 max-w-xs">{t('noMessagesInChatHelp')}</p>
          </div>
        ) : (
          filteredMessages.map((msg, idx) => {
            const isMine = msg.senderId === effectiveUser?.userId;
            const prevMsg = idx > 0 ? filteredMessages[idx - 1] : null;
            const isSameSenderAsPrev = Boolean(prevMsg && prevMsg.senderId === msg.senderId);
            const msgDateStr = new Date(msg.createdAt).toDateString();
            const prevDateStr = prevMsg ? new Date(prevMsg.createdAt).toDateString() : null;
            const isNewDay = !prevMsg || msgDateStr !== prevDateStr;

            return (
              <MessageBubble
                key={msg.id}
                msg={msg}
                chat={chat}
                isMine={isMine}
                isSameSenderAsPrev={isSameSenderAsPrev}
                isNewDay={isNewDay}
                language={language}
                t={t}
                user={user}
                ghostUser={ghostUser}
                editingMessage={editingMessage}
                editText={editText}
                setEditText={setEditText}
                setEditingMessage={setEditingMessage}
                handleSaveEdit={handleSaveEdit}
                playingAudioId={voice.playingAudioId}
                audioProgress={voice.audioProgress}
                playVoiceNote={voice.playVoiceNote}
                formatAudioTime={voice.formatAudioTime}
                onPreviewImage={(url) => setPreviewImage(url)}
                onMessageTap={handleMessageTap}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onContextMenu={handleContextMenu}
                onToggleReaction={(msgId, emoji) => {
                  if (user && !ghostUser) toggleMessageReaction(chat.id, msgId, user.userId, emoji);
                }}
                onOpenMessageInfo={(target) => setMessageInfoTarget(target)}
              />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {activeMenuMessage && menuPosition && (
        <MessageContextMenu
          message={activeMenuMessage}
          position={menuPosition}
          chatId={chat.id}
          user={user}
          ghostUser={ghostUser}
          language={language}
          t={t}
          onReact={(msgId, emoji) => {
            if (user) toggleMessageReaction(chat.id, msgId, user.userId, emoji);
          }}
          onReply={(m) => setReplyingTo(m)}
          onInfo={(m) => setMessageInfoTarget(m)}
          onCopy={handleCopyText}
          onEdit={handleStartEditFromMenu}
          onReport={(m) =>
            setReportTarget({
              targetUserId: m.senderId,
              targetUserName: m.senderName,
              chatId: chat.id,
              messageId: m.id,
              messageText: m.text,
            })
          }
          onDelete={(m) => setMessageToDelete(m)}
          onClose={() => setActiveMenuMessage(null)}
        />
      )}

      {replyingTo && !ghostUser && (
        <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs animate-in slide-in-from-bottom-2">
          <div className="border-l-2 border-emerald-500 pl-2.5 min-w-0">
            <span className="font-bold text-emerald-400 block text-[11px]">
              {t('replyingToPrefix')}{replyingTo.senderName}
            </span>
            <p className="text-slate-300 truncate text-[11px]">
              {replyingTo.text || (replyingTo.type === 'audio' ? `🎤 ${t('voiceNoteLabel')}` : `📷 ${t('imageLabel')}`)}
            </p>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {voice.micError && (
        <div className="px-4 py-2 bg-amber-500/20 border-t border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">{voice.micError}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => voice.setShowMicPermissionModal(true)}
              className="text-amber-300 hover:text-white font-medium underline text-xs cursor-pointer"
            >
              {language === 'bn' ? 'কীভাবে চালু করবেন?' : 'How to enable?'}
            </button>
            <button
              type="button"
              onClick={() => voice.setMicError(null)}
              className="text-amber-300 hover:text-white text-xs px-1.5 py-0.5 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {voice.isRecording && (
        <div className="px-4 py-2 bg-red-950/80 border-t border-red-500/40 flex items-center justify-between text-xs animate-pulse">
          <div className="flex items-center gap-2 text-red-400 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span>{t('recordingVoice', { duration: voice.formatAudioTime(voice.recordDuration) })}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => voice.stopRecording(true)}
              className="px-2.5 py-1 text-slate-400 hover:text-white rounded-lg text-xs cursor-pointer"
            >
              {t('cancelRecording')}
            </button>
            <button
              type="button"
              onClick={() => voice.stopRecording(false)}
              className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow"
            >
              <Send className="w-3 h-3" />
              <span>{t('sendVoice')}</span>
            </button>
          </div>
        </div>
      )}

      {ghostUser ? (
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-lg">
          <div className="flex items-center gap-2.5 text-sky-400 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-sky-500/20 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4 text-sky-400" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-white block truncate">
                {language === 'bn'
                  ? `গোস্ট ডিএম মোড: ${ghostUser.displayName}-এর ইনবক্স পর্যবেক্ষণ`
                  : `Ghost DM Mode: Live Monitoring of ${ghostUser.displayName}`}
              </span>
              <span className="text-[11px] text-slate-400 block truncate">
                {language === 'bn'
                  ? 'লাইভ চ্যাট সম্পূর্ণ রিড-অনলি ও সুরক্ষিতভাবে পর্যবেক্ষণ করা হচ্ছে। বার্তা পাঠানো, এডিট, রিপ্লাই বা রিঅ্যাক্ট করা সম্পূর্ণ নিষ্ক্রিয়।'
                  : 'Live chat is strictly in read-only audit mode. Sending, editing, replying, and reacting are disabled.'}
              </span>
            </div>
          </div>
          {onExitGhostMode && (
            <button
              type="button"
              onClick={onExitGhostMode}
              className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow flex items-center gap-1.5 shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t('exitGhostModeBtn')}</span>
            </button>
          )}
        </div>
      ) : isCurrentUserSuspended ? (
        <div className="px-4 py-3.5 bg-rose-950/40 border-t border-rose-800/60 flex items-center justify-center gap-2.5 shrink-0 select-none">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="text-xs font-medium text-rose-200 text-center">
            {language === 'bn'
              ? 'আপনার অ্যাকাউন্টটি বর্তমানে অ্যাডমিন কর্তৃক স্থগিত করা হয়েছে। আপনি কোনো বার্তা পাঠাতে পারবেন না।'
              : 'Your account has been suspended by the administrator. You cannot send messages.'}
          </span>
        </div>
      ) : isPartnerDeleted ? (
        <div className="px-4 py-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-center gap-2.5 shrink-0 select-none">
          <UserX className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="text-xs font-medium text-slate-300 text-center">
            {t('deletedAccountNotice')}
          </span>
        </div>
      ) : isPartnerSuspended ? (
        <div className="px-4 py-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-center gap-2.5 shrink-0 select-none">
          <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-xs font-medium text-slate-300 text-center">
            {t('chatPartnerSuspendedNotice')}
          </span>
        </div>
      ) : (
        <form
          onSubmit={handleSend}
          className="px-3 py-2 bg-slate-900 border-t border-slate-800/80 flex items-center gap-1.5 shrink-0"
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-400 hover:text-emerald-400 rounded-xl hover:bg-slate-800 transition cursor-pointer"
            title={t('imageLabel')}
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />

          <div className="relative flex-1">
            <input
              type="text"
              placeholder={t('messagePlaceholder')}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full pl-3.5 pr-9 py-2 bg-slate-800/80 border border-slate-700/60 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/80 transition"
            />
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-emerald-400 transition cursor-pointer p-0.5"
            >
              <Smile className="w-4 h-4" />
            </button>

            {showEmojiPicker && (
              <div className="absolute right-0 bottom-11 z-30 p-2 bg-slate-900 border border-slate-700 rounded-xl shadow-xl flex gap-1 animate-in fade-in">
                {['😀', '😂', '😍', '❤️', '👍', '🔥', '🎉', '👏', '🙏'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setInputText((prev) => prev + emoji);
                      setShowEmojiPicker(false);
                    }}
                    className="p-1 hover:scale-125 transition text-base cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {inputText.trim() ? (
            <button
              type="submit"
              className="p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center shrink-0 active:scale-[0.98]"
              title={t('sendTooltip')}
            >
              <Send className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={voice.isSendingVoice}
              onClick={voice.isRecording ? () => voice.stopRecording(false) : voice.startRecording}
              className={`p-2.5 rounded-xl transition cursor-pointer flex items-center justify-center shrink-0 active:scale-[0.98] ${
                voice.isRecording
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-750'
              } ${voice.isSendingVoice ? 'opacity-60 cursor-wait' : ''}`}
              title={voice.isSendingVoice ? 'Sending voice note...' : t('recordVoiceTooltip')}
            >
              {voice.isSendingVoice ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
          )}
        </form>
      )}

      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <img
            src={previewImage}
            alt="Preview"
            className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
          />
        </div>
      )}

      {messageToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-bold text-white mb-1">{t('deleteMessageTitle')}</h3>
              <p className="text-xs text-slate-400">{t('deleteMessageSubtitle')}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMessageToDelete(null)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={confirmDeleteMessage}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow"
              >
                {t('deleteMessageBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteChatConfirm && !ghostUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-red-500/30 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-bold text-white mb-1">{t('deleteConversationTitle')}</h3>
              <p className="text-xs text-slate-400">{t('deleteConversationNotice')}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteChatConfirm(false)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteConversation}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {reportTarget && (
        <ReportModal
          targetUserId={reportTarget.targetUserId}
          targetUserName={reportTarget.targetUserName}
          targetUserEmail={reportTarget.targetUserEmail}
          chatId={reportTarget.chatId}
          messageId={reportTarget.messageId}
          messageText={reportTarget.messageText}
          onClose={() => setReportTarget(null)}
        />
      )}

      {voice.showMicPermissionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <MicOff className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white">{t('micPermissionTitle')}</h3>
              <p className="text-xs text-slate-300">{t('micPermissionDeniedDesc')}</p>
            </div>

            <div className="p-3 bg-slate-800/80 border border-slate-700/60 rounded-2xl space-y-2 text-xs text-slate-300">
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-200 font-bold flex items-center justify-center text-[10px] shrink-0">
                  1
                </span>
                <span>{t('micPermissionStep1')}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-200 font-bold flex items-center justify-center text-[10px] shrink-0">
                  2
                </span>
                <span>{t('micPermissionStep2')}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-200 font-bold flex items-center justify-center text-[10px] shrink-0">
                  3
                </span>
                <span>{t('micPermissionStep3')}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => voice.setShowMicPermissionModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition"
              >
                {t('micDismissBtn')}
              </button>
              <button
                type="button"
                onClick={() => {
                  voice.setShowMicPermissionModal(false);
                  voice.startRecording();
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow flex items-center justify-center gap-1.5"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>{t('micTryAgainBtn')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showGroupInfoModal && chat.type === 'group' && user && (
        <GroupInfoModal
          isOpen={showGroupInfoModal}
          onClose={() => setShowGroupInfoModal(false)}
          chat={chat}
          currentUser={user}
          onLeaveGroup={onBack}
          onDeleteGroup={onBack}
        />
      )}

      {messageInfoTarget && (
        <MessageInfoModal
          isOpen={Boolean(messageInfoTarget)}
          onClose={() => setMessageInfoTarget(null)}
          message={messageInfoTarget}
          chat={chat}
        />
      )}
    </div>
  );
}
