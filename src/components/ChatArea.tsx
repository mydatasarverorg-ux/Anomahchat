import { useEffect, useRef, useState, useCallback } from 'react';
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
  subscribeToUserProfile,
  formatLastSeenStatus,
} from '../services/chatService';
import type { ChatRoom, ChatMessage, CallSession, UserProfile } from '../types/chat';
import { sounds } from '../utils/audioEffects';
import { compressImageForChat } from '../utils/imageCompressor';
import {
  Phone,
  Video,
  Send,
  Mic,
  Smile,
  Paperclip,
  CheckCheck,
  MoreVertical,
  Reply,
  Trash2,
  Pencil,
  Copy,
  AlertTriangle,
  Play,
  Pause,
  ArrowLeft,
  X,
  Search,
  Image as ImageIcon,
  Flag,
  ShieldAlert,
} from 'lucide-react';
import { isSuperAdmin } from '../services/adminService';
import { ReportModal } from './ReportModal';

interface ChatAreaProps {
  chat: ChatRoom;
  onBack: () => void;
  onStartCall: (session: CallSession) => void;
}

export function ChatArea({ chat, onBack, onStartCall }: ChatAreaProps) {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Reporting State
  const [reportTarget, setReportTarget] = useState<{
    targetUserId: string;
    targetUserName: string;
    targetUserEmail?: string;
    chatId?: string;
    messageId?: string;
    messageText?: string;
  } | null>(null);

  // Real-time recipient profile & presence tracking
  const [partnerUser, setPartnerUser] = useState<UserProfile | null>(null);

  // Edit message & delete conversation states
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [editText, setEditText] = useState('');
  const [showDeleteChatConfirm, setShowDeleteChatConfirm] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<ChatMessage | null>(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);

  // Long-press Context Menu & Floating Reactions (Messenger/WhatsApp style)
  const [activeMenuMessage, setActiveMenuMessage] = useState<ChatMessage | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<{ id: string; time: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioElements = useRef<Record<string, HTMLAudioElement>>({});

  // Partner ID for 1-to-1 direct chat
  const partnerId =
    chat.type === 'direct'
      ? chat.participantIds.find((id) => id !== user?.userId) || chat.participantIds[0]
      : null;
  const partnerDetails = partnerId ? chat.participantDetails?.[partnerId] : null;

  // Real-time subscription to partner's presence
  useEffect(() => {
    if (!partnerId) {
      setPartnerUser(null);
      return;
    }
    const unsubscribe = subscribeToUserProfile(partnerId, (profile) => {
      setPartnerUser(profile);
    });
    return () => unsubscribe();
  }, [partnerId]);

  const partnerStatus = formatLastSeenStatus(partnerUser?.lastSeen, partnerUser?.isOnline);

  const title =
    chat.type === 'group'
      ? chat.name || t('filterGroup')
      : partnerUser?.displayName || partnerDetails?.displayName || (language === 'bn' ? 'ব্যবহারকারী' : 'User');
  const avatar =
    chat.type === 'group'
      ? 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100&auto=format&fit=crop&q=80'
      : partnerUser?.photoURL || partnerDetails?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${partnerId}`;

  // Subscribe to messages in current chat
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

      // Mark unread messages as read
      if (user) {
        markChatMessagesAsRead(chat.id, user, msgs);
      }
    });

    return () => unsubscribe();
  }, [chat.id, user]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Double tap to quick-react (❤️)
  const handleMessageTap = (msg: ChatMessage) => {
    const now = Date.now();
    if (lastTapRef.current && lastTapRef.current.id === msg.id && now - lastTapRef.current.time < 350) {
      // Double tap detected
      if (user) {
        toggleMessageReaction(chat.id, msg.id, user.userId, '❤️');
      }
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { id: msg.id, time: now };
    }
  };

  // Long press detection for mobile & desktop
  const handleTouchStart = (msg: ChatMessage, e: React.TouchEvent | React.MouseEvent) => {
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
    setActiveMenuMessage(msg);
    setMenuPosition({
      x: Math.min(window.innerWidth - 220, Math.max(16, e.clientX - 80)),
      y: Math.min(window.innerHeight - 260, Math.max(70, e.clientY - 80)),
    });
  };

  // Send text message
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !user) return;

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

  // Image upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
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

  // Voice Notes
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = async () => {
          const base64Audio = reader.result as string;
          if (user) {
            sounds.playMessageSent();
            await sendMessage({
              chatId: chat.id,
              sender: user,
              text: t('voiceNoteLabel'),
              type: 'audio',
              mediaUrl: base64Audio,
              audioDuration: recordDuration,
            });
          }
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordDuration(0);
    } catch {
      setIsRecording(true);
      setRecordDuration(0);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const stopRecording = (cancel = false) => {
    if (!isRecording) return;
    setIsRecording(false);
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      if (cancel) {
        mediaRecorder.ondataavailable = null;
        mediaRecorder.onstop = null;
        mediaRecorder.stop();
      } else {
        mediaRecorder.stop();
      }
    } else if (!cancel && user) {
      sounds.playMessageSent();
      sendMessage({
        chatId: chat.id,
        sender: user,
        text: t('voiceNoteLabel'),
        type: 'audio',
        audioDuration: recordDuration || 4,
      });
    }
    setRecordDuration(0);
  };

  const playVoiceNote = (messageId: string, url?: string) => {
    if (playingAudioId === messageId) {
      audioElements.current[messageId]?.pause();
      setPlayingAudioId(null);
      return;
    }

    if (playingAudioId && audioElements.current[playingAudioId]) {
      audioElements.current[playingAudioId].pause();
    }

    if (url) {
      let audio = audioElements.current[messageId];
      if (!audio) {
        audio = new Audio(url);
        audioElements.current[messageId] = audio;
        audio.onended = () => setPlayingAudioId(null);
      }
      audio.play().catch(() => {});
      setPlayingAudioId(messageId);
    } else {
      sounds.playBeep();
      setPlayingAudioId(messageId);
      setTimeout(() => setPlayingAudioId(null), 3000);
    }
  };

  const formatAudioTime = (seconds = 0) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
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
    if (!messageToDelete) return;
    await deleteChatMessage(chat.id, messageToDelete.id);
    setMessageToDelete(null);
  };

  const handleDeleteConversation = async () => {
    if (!user) return;
    await deleteChatRoom(chat.id, user.userId);
    setShowDeleteChatConfirm(false);
    onBack();
  };

  const filteredMessages = messages.filter((m) =>
    searchQuery.trim() ? m.text?.toLowerCase().includes(searchQuery.toLowerCase()) : true
  );

  // Distinct color per sender in group chat
  const getSenderColor = (senderId: string) => {
    const colors = [
      'text-emerald-400',
      'text-sky-400',
      'text-indigo-400',
      'text-amber-400',
      'text-teal-400',
      'text-rose-400',
      'text-purple-400',
    ];
    let hash = 0;
    for (let i = 0; i < senderId.length; i++) hash += senderId.charCodeAt(i);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div
      onClick={() => {
        if (activeMenuMessage) setActiveMenuMessage(null);
        if (showHeaderMenu) setShowHeaderMenu(false);
      }}
      className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden relative select-none"
    >
      {/* Normalized Top Chat Header (56px standard) */}
      <div className="h-14 px-3.5 bg-slate-900 border-b border-slate-800/80 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="relative">
            <img
              src={avatar}
              alt={title}
              className="w-9 h-9 rounded-full object-cover bg-slate-800 border border-slate-700/60 shadow-sm"
            />
            {chat.type === 'direct' && partnerStatus.isOnline && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-900" />
            )}
          </div>

          <div className="min-w-0">
            <h2 className="text-xs font-bold text-white truncate max-w-[150px] sm:max-w-xs leading-tight">{title}</h2>
            <p
              className={`text-[10px] truncate leading-none mt-0.5 ${
                partnerStatus.isOnline ? 'text-emerald-400 font-medium' : 'text-slate-400'
              }`}
            >
              {chat.type === 'group'
                ? t('membersLabel', { count: chat.participantIds.length })
                : (partnerStatus.isOnline ? t('online') : (partnerStatus.statusText === 'Offline' ? t('offline') : partnerStatus.statusText))}
            </p>
          </div>
        </div>

        {/* Action icons */}
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

          <button
            onClick={() =>
              onStartCall({
                active: true,
                type: 'audio',
                recipientName: title,
                recipientPhoto: avatar,
                status: 'calling',
                isMuted: false,
                isVideoOff: true,
                durationSeconds: 0,
              })
            }
            className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition cursor-pointer"
            title={t('audioCall')}
          >
            <Phone className="w-4 h-4" />
          </button>

          <button
            onClick={() =>
              onStartCall({
                active: true,
                type: 'video',
                recipientName: title,
                recipientPhoto: avatar,
                status: 'calling',
                isMuted: false,
                isVideoOff: false,
                durationSeconds: 0,
              })
            }
            className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition cursor-pointer"
            title={t('videoCall')}
          >
            <Video className="w-4 h-4" />
          </button>

          {/* More options menu */}
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
                className="absolute right-0 top-11 z-40 w-52 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl py-1.5 animate-in fade-in"
              >
                {partnerId && partnerId !== user?.userId && (
                  <button
                    onClick={() => {
                      setShowHeaderMenu(false);
                      setReportTarget({
                        targetUserId: partnerId,
                        targetUserName: title,
                        targetUserEmail: partnerUser?.email || partnerDetails?.email,
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
              </div>
            )}
          </div>
        </div>
      </div>

      {/* In-Chat Search Bar */}
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

      {/* Messages List Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 p-6">
            <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-3 text-slate-500">
              <Smile className="w-8 h-8 stroke-1" />
            </div>
            <p className="text-xs font-semibold text-slate-300 mb-1">{t('noMessagesInChat')}</p>
            <p className="text-[11px] text-slate-500 max-w-xs">
              {t('noMessagesInChatHelp')}
            </p>
          </div>
        ) : (
          filteredMessages.map((msg, idx) => {
            const isMine = msg.senderId === user?.userId;
            const isLastMessage = idx === filteredMessages.length - 1;

            // Seen list (avatars of people who saw this message)
            const seenList = Object.entries(msg.seenByDetails || {}).filter(
              ([uid]) => uid !== msg.senderId
            );

            return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} group relative`}
              >
                {/* Group chat: Sender Name & Avatar above incoming bubble */}
                {!isMine && chat.type === 'group' && (
                  <div className="flex items-center gap-1.5 mb-1 ml-1">
                    <img
                      src={msg.senderPhoto || `https://api.dicebear.com/7.x/bottts/svg?seed=${msg.senderId}`}
                      alt={msg.senderName}
                      className="w-4 h-4 rounded-full object-cover bg-slate-800"
                    />
                    <span className={`text-[11px] font-bold ${getSenderColor(msg.senderId)}`}>
                      {msg.senderName}
                    </span>
                  </div>
                )}

                {/* Message Bubble Container */}
                <div
                  onClick={() => handleMessageTap(msg)}
                  onTouchStart={(e) => handleTouchStart(msg, e)}
                  onTouchEnd={handleTouchEnd}
                  onTouchMove={handleTouchEnd}
                  onContextMenu={(e) => handleContextMenu(e, msg)}
                  className={`max-w-[85%] sm:max-w-md px-3.5 py-2 transition-all cursor-pointer shadow-sm relative select-text ${
                    isMine
                      ? 'bg-emerald-600 text-white rounded-2xl rounded-tr-sm shadow-emerald-950/20'
                      : 'bg-slate-800/90 text-slate-100 rounded-2xl rounded-tl-sm border border-slate-700/50'
                  }`}
                >
                  {/* Quoted Reply Preview inside bubble */}
                  {msg.replyToId && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        const elem = document.getElementById(`msg-${msg.replyToId}`);
                        elem?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                      className={`mb-2 p-2 rounded-xl text-xs border-l-4 transition cursor-pointer ${
                        isMine
                          ? 'bg-emerald-800/40 border-emerald-300 text-emerald-100'
                          : 'bg-slate-900/60 border-emerald-500 text-slate-200'
                      }`}
                    >
                      <span className="font-bold text-[10px] block opacity-90">
                        {msg.replyToSender}
                      </span>
                      <span className="truncate block opacity-80 text-[11px]">{msg.replyToText}</span>
                    </div>
                  )}

                  {/* Photo Content */}
                  {msg.type === 'image' && msg.mediaUrl && (
                    <div className="mb-2 rounded-xl overflow-hidden cursor-pointer">
                      <img
                        src={msg.mediaUrl}
                        alt="Shared media"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewImage(msg.mediaUrl || null);
                        }}
                        className="max-h-64 w-full object-cover hover:opacity-95 transition rounded-xl"
                      />
                    </div>
                  )}

                  {/* Audio / Voice Note Content */}
                  {msg.type === 'audio' && (
                    <div className="flex items-center gap-3 py-1 min-w-[200px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          playVoiceNote(msg.id, msg.mediaUrl);
                        }}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition cursor-pointer shadow ${
                          isMine
                            ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                            : 'bg-emerald-600 text-white hover:bg-emerald-500'
                        }`}
                      >
                        {playingAudioId === msg.id ? (
                          <Pause className="w-4 h-4 fill-current" />
                        ) : (
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        )}
                      </button>

                      {/* Waveform */}
                      <div className="flex-1 flex items-center gap-0.5 h-6">
                        {[30, 60, 40, 80, 50, 95, 70, 30, 85, 45, 60, 75, 40, 90, 50, 35].map(
                          (height, bIdx) => (
                            <div
                              key={bIdx}
                              style={{ height: `${height}%` }}
                              className={`w-1 rounded-full transition-all duration-150 ${
                                playingAudioId === msg.id
                                  ? 'bg-emerald-300 animate-pulse'
                                  : isMine
                                  ? 'bg-emerald-300/60'
                                  : 'bg-slate-500'
                              }`}
                            />
                          )
                        )}
                      </div>

                      <span className="text-[10px] font-mono opacity-80">
                        {formatAudioTime(msg.audioDuration)}
                      </span>
                    </div>
                  )}

                  {/* Text Content with Inline Edit */}
                  {msg.type === 'text' &&
                    (editingMessage?.id === msg.id ? (
                      <div className="space-y-2 min-w-[200px] max-w-full" onClick={(e) => e.stopPropagation()}>
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full p-2 bg-slate-900 border border-emerald-400 rounded-xl text-xs text-white focus:outline-none resize-none"
                          rows={2}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSaveEdit();
                            }
                            if (e.key === 'Escape') setEditingMessage(null);
                          }}
                        />
                        <div className="flex gap-1.5 justify-end text-[10px]">
                          <button
                            type="button"
                            onClick={() => setEditingMessage(null)}
                            className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 cursor-pointer"
                          >
                            {t('cancel')}
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold cursor-pointer"
                          >
                            {t('save')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap break-words leading-relaxed text-xs sm:text-sm select-text">
                        {msg.text}
                      </p>
                    ))}

                  {/* Timestamp & Status */}
                  <div
                    className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                      isMine ? 'text-emerald-100/75' : 'text-slate-400'
                    }`}
                  >
                    {msg.isEdited && <span className="italic text-[9px] mr-0.5">{t('editedTag')}</span>}
                    <span>
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {isMine && (
                      <span>
                        <CheckCheck
                          className={`w-3.5 h-3.5 ${
                            msg.readBy.length > 1 ? 'text-sky-300' : 'text-emerald-200'
                          }`}
                        />
                      </span>
                    )}
                  </div>

                  {/* Emoji Reactions Pills under bubble */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5 -mb-0.5">
                      {Object.entries(msg.reactions).map(([emoji, uids]) => (
                        <button
                          key={emoji}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (user) toggleMessageReaction(chat.id, msg.id, user.userId, emoji);
                          }}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border transition cursor-pointer ${
                            user && uids.includes(user.userId)
                              ? 'bg-emerald-500/25 border-emerald-400/60 text-white'
                              : 'bg-slate-900/70 border-slate-700/60 text-slate-300'
                          }`}
                        >
                          <span>{emoji}</span>
                          <span>{uids.length}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Seen Avatars (Messenger Style Read Receipts) */}
                {isMine && seenList.length > 0 && (
                  <div className="flex items-center gap-1 mt-1 mr-1">
                    {seenList.slice(0, 4).map(([uid, details]) => (
                      <img
                        key={uid}
                        src={details.photoURL}
                        alt={details.displayName}
                        title={`Seen by ${details.displayName}`}
                        className="w-3.5 h-3.5 rounded-full object-cover border border-slate-900 shadow"
                      />
                    ))}
                    {seenList.length > 4 && (
                      <span className="text-[9px] text-slate-400 font-mono">
                        +{seenList.length - 4}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Long-Press Context Menu (Messenger/WhatsApp Popover) */}
      {activeMenuMessage && menuPosition && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ top: `${menuPosition.y}px`, left: `${menuPosition.x}px` }}
          className="fixed z-50 flex flex-col gap-1.5 animate-in zoom-in-95 duration-150"
        >
          {/* Reaction Bar */}
          <div className="flex items-center gap-2 p-1.5 bg-slate-900/95 border border-slate-700 rounded-full shadow-2xl backdrop-blur-md">
            {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  if (user) toggleMessageReaction(chat.id, activeMenuMessage.id, user.userId, emoji);
                  setActiveMenuMessage(null);
                }}
                className="w-8 h-8 rounded-full hover:bg-slate-800 flex items-center justify-center text-lg hover:scale-125 transition cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Action List */}
          <div className="bg-slate-900/95 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden py-1 min-w-[170px] backdrop-blur-md">
            <button
              onClick={() => {
                setReplyingTo(activeMenuMessage);
                setActiveMenuMessage(null);
              }}
              className="w-full px-3.5 py-2 text-left text-xs text-white hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer transition font-medium"
            >
              <Reply className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('replyAction')}</span>
            </button>

            {activeMenuMessage.type === 'text' && (
              <button
                onClick={() => handleCopyText(activeMenuMessage.text)}
                className="w-full px-3.5 py-2 text-left text-xs text-white hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer transition font-medium"
              >
                <Copy className="w-3.5 h-3.5 text-sky-400" />
                <span>{t('copyTextAction')}</span>
              </button>
            )}

            {activeMenuMessage.senderId === user?.userId && activeMenuMessage.type === 'text' && (
              <button
                onClick={() => handleStartEditFromMenu(activeMenuMessage)}
                className="w-full px-3.5 py-2 text-left text-xs text-amber-300 hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer transition font-medium"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>{t('editAction')}</span>
              </button>
            )}

            {activeMenuMessage.senderId !== user?.userId && (
              <button
                onClick={() => {
                  setReportTarget({
                    targetUserId: activeMenuMessage.senderId,
                    targetUserName: activeMenuMessage.senderName,
                    chatId: chat.id,
                    messageId: activeMenuMessage.id,
                    messageText: activeMenuMessage.text,
                  });
                  setActiveMenuMessage(null);
                }}
                className="w-full px-3.5 py-2 text-left text-xs text-amber-300 hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer transition font-medium"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>{t('reportMessageAction')}</span>
              </button>
            )}

            {(activeMenuMessage.senderId === user?.userId || isSuperAdmin(user?.email)) && (
              <button
                onClick={() => {
                  setMessageToDelete(activeMenuMessage);
                  setActiveMenuMessage(null);
                }}
                className="w-full px-3.5 py-2 text-left text-xs text-red-400 hover:bg-red-500/15 flex items-center gap-2.5 cursor-pointer transition font-medium border-t border-slate-800"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {isSuperAdmin(user?.email) && activeMenuMessage.senderId !== user?.userId
                    ? 'Admin Delete Message'
                    : t('deleteForEveryoneAction')}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Floating Quoted Message Bar */}
      {replyingTo && (
        <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs animate-in slide-in-from-bottom-2">
          <div className="border-l-4 border-emerald-500 pl-3 min-w-0">
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

      {/* Recording Voice Status Bar */}
      {isRecording && (
        <div className="px-4 py-2 bg-red-950/80 border-t border-red-500/40 flex items-center justify-between text-xs animate-pulse">
          <div className="flex items-center gap-2 text-red-400 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span>{t('recordingVoice', { duration: formatAudioTime(recordDuration) })}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => stopRecording(true)}
              className="px-2.5 py-1 text-slate-400 hover:text-white rounded-lg text-xs cursor-pointer"
            >
              {t('cancelRecording')}
            </button>
            <button
              onClick={() => stopRecording(false)}
              className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold cursor-pointer"
            >
              {t('sendVoice')}
            </button>
          </div>
        </div>
      )}

      {/* Bottom Message Input Bar (Standard 56px height) */}
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

          {/* Quick emoji popover */}
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
            className="p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-600/30 transition cursor-pointer flex items-center justify-center shrink-0"
            title={t('sendTooltip')}
          >
            <Send className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={isRecording ? () => stopRecording(false) : startRecording}
            className={`p-2.5 rounded-2xl transition cursor-pointer flex items-center justify-center shrink-0 ${
              isRecording
                ? 'bg-red-600 text-white animate-bounce'
                : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
            title={t('recordVoiceTooltip')}
          >
            <Mic className="w-4 h-4" />
          </button>
        )}
      </form>

      {/* Fullscreen Image Preview Modal */}
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

      {/* Delete Message Confirmation Modal */}
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

      {/* Delete Conversation Confirmation Modal */}
      {showDeleteChatConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-red-500/30 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-bold text-white mb-1">{t('deleteConversationTitle')}</h3>
              <p className="text-xs text-slate-400">
                {t('deleteConversationNotice')}
              </p>
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

      {/* User / Message Report Modal */}
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
    </div>
  );
}
