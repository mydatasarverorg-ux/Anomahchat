import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  subscribeToChatMessages,
  sendMessage,
  markChatMessagesAsRead,
  toggleMessageReaction,
  deleteChatMessage,
} from '../services/chatService';
import type { ChatRoom, ChatMessage, CallSession } from '../types/chat';
import { sounds } from '../utils/audioEffects';
import {
  Phone,
  Video,
  Send,
  Mic,
  Smile,
  Paperclip,
  Check,
  CheckCheck,
  MoreVertical,
  Reply,
  Trash2,
  Play,
  Pause,
  ArrowLeft,
  X,
  Search,
  Image as ImageIcon,
} from 'lucide-react';

interface ChatAreaProps {
  chat: ChatRoom;
  onBack: () => void;
  onStartCall: (session: CallSession) => void;
}

export function ChatArea({ chat, onBack, onStartCall }: ChatAreaProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioSpeed, setAudioSpeed] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioElements = useRef<Record<string, HTMLAudioElement>>({});

  // Determine chat display info
  const partnerId =
    chat.type === 'direct'
      ? chat.participantIds.find((id) => id !== user?.userId) || chat.participantIds[0]
      : null;
  const partnerDetails = partnerId ? chat.participantDetails?.[partnerId] : null;

  const title =
    chat.type === 'group'
      ? chat.name || 'Group Chat'
      : partnerDetails?.displayName || 'Chat Partner';
  const avatar =
    chat.type === 'group'
      ? 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100&auto=format&fit=crop&q=80'
      : partnerDetails?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${partnerId}`;

  // Subscribe to messages in current chat
  useEffect(() => {
    if (!chat.id) return;
    const unsubscribe = subscribeToChatMessages(chat.id, (msgs) => {
      setMessages(msgs);

      // Play sound if a new message arrives from partner
      if (msgs.length > 0) {
        const last = msgs[msgs.length - 1];
        if (user && last.senderId !== user.userId && !last.readBy.includes(user.userId)) {
          sounds.playMessageReceived();
        }
      }

      // Mark unread messages as read (Double Blue Tick)
      if (user) {
        markChatMessagesAsRead(chat.id, user.userId, msgs);
      }
    });

    return () => unsubscribe();
  }, [chat.id, user]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

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
            text: currentReply.text || (currentReply.type === 'audio' ? 'Voice note' : 'Media'),
            senderName: currentReply.senderName,
          }
        : undefined,
    });
  };

  // Image upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      sounds.playMessageSent();
      await sendMessage({
        chatId: chat.id,
        sender: user,
        text: 'Photo',
        type: 'image',
        mediaUrl: dataUrl,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Audio Recording (Voice Notes)
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
              text: 'Voice note',
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
      // If mic permission is not granted or supported, simulate a synthetic voice note
      setIsRecording(true);
      setRecordDuration(0);
    }
  };

  // Duration timer during recording
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
      // Fallback synthetic voice message if browser mic was blocked
      sounds.playMessageSent();
      sendMessage({
        chatId: chat.id,
        sender: user,
        text: 'Voice note',
        type: 'audio',
        audioDuration: Math.max(recordDuration, 3),
      });
    }
  };

  const playVoiceNote = (msgId: string, url?: string) => {
    if (playingAudioId === msgId) {
      const existing = audioElements.current[msgId];
      if (existing) {
        existing.pause();
        setPlayingAudioId(null);
      }
      return;
    }

    // Stop currently playing
    if (playingAudioId && audioElements.current[playingAudioId]) {
      audioElements.current[playingAudioId].pause();
    }

    if (url) {
      const audio = new Audio(url);
      audio.playbackRate = audioSpeed;
      audioElements.current[msgId] = audio;
      setPlayingAudioId(msgId);
      audio.play().catch(() => {});
      audio.onended = () => setPlayingAudioId(null);
    } else {
      // Beep simulation for mock audio
      sounds.playMessageReceived();
      setPlayingAudioId(msgId);
      setTimeout(() => setPlayingAudioId(null), 3000);
    }
  };

  const formatAudioTime = (sec?: number) => {
    if (!sec) return '0:05';
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const commonEmojis = ['😊', '😂', '❤️', '🔥', '👍', '🙏', '🎉', '😍', '👏', '🥳', '😎', '👌'];

  const filteredMessages = messages.filter((m) =>
    searchQuery.trim() ? m.text?.toLowerCase().includes(searchQuery.toLowerCase()) : true
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden relative">
      {/* Top Chat Header */}
      <div className="h-16 px-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0 z-10 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="relative">
            <img
              src={avatar}
              alt={title}
              className="w-10 h-10 rounded-full object-cover bg-slate-700 border border-slate-700"
            />
            {chat.type === 'direct' && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-900" />
            )}
          </div>

          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white truncate">{title}</h2>
            <p className="text-[11px] text-emerald-400 truncate">
              {chat.type === 'group'
                ? `${chat.participantIds.length} members in room`
                : 'Online • Real-time Active'}
            </p>
          </div>
        </div>

        {/* Action icons (Calls, Search, Menu) */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-2 rounded-xl transition cursor-pointer ${
              showSearch ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Search in chat"
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
            title="Start Audio Call"
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
            title="Start Video Call"
          >
            <Video className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* In-chat search bar */}
      {showSearch && (
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search messages in this chat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
            autoFocus
          />
          <button
            onClick={() => {
              setSearchQuery('');
              setShowSearch(false);
            }}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Messages Feed */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-3"
        style={{
          backgroundImage:
            'radial-gradient(circle at center, rgba(16, 185, 129, 0.03) 0%, transparent 70%)',
        }}
      >
        <div className="flex justify-center my-2">
          <span className="px-3 py-1 bg-slate-900/80 border border-slate-800 rounded-full text-[10px] text-slate-400 shadow-sm flex items-center gap-1.5">
            <span>🔒 Anomah Chat Cloud</span>
            <span>•</span>
            <span className="text-emerald-400 font-medium">Mahi A01</span>
            <span>•</span>
            <span>By Mahi Muhtasim</span>
          </span>
        </div>

        {filteredMessages.map((msg) => {
          const isMine = msg.senderId === user?.userId;
          const isReadByRecipient =
            msg.readBy.filter((id) => id !== user?.userId).length > 0;

          return (
            <div
              key={msg.id}
              className={`flex flex-col group ${isMine ? 'items-end' : 'items-start'}`}
            >
              {/* Group chat sender tag */}
              {chat.type === 'group' && !isMine && (
                <span className="text-[10px] font-semibold text-emerald-400 ml-2 mb-0.5">
                  {msg.senderName}
                </span>
              )}

              {/* Message Bubble */}
              <div
                className={`relative max-w-[85%] md:max-w-[70%] rounded-2xl p-3 shadow-md text-xs transition ${
                  isMine
                    ? 'bg-emerald-700/85 text-emerald-50 rounded-tr-none border border-emerald-600/40'
                    : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700/60'
                }`}
              >
                {/* Quoted Message Preview */}
                {msg.replyToText && (
                  <div
                    className={`mb-2 p-2 rounded-lg border-l-4 text-[11px] truncate ${
                      isMine
                        ? 'bg-emerald-800/80 border-emerald-300 text-emerald-100'
                        : 'bg-slate-900/80 border-emerald-500 text-slate-300'
                    }`}
                  >
                    <span className="font-bold block text-[10px] text-emerald-300">
                      {msg.replyToSender}
                    </span>
                    <span className="truncate block opacity-80">{msg.replyToText}</span>
                  </div>
                )}

                {/* Content: Photo / Image */}
                {msg.type === 'image' && msg.mediaUrl && (
                  <div className="mb-2 rounded-xl overflow-hidden cursor-pointer">
                    <img
                      src={msg.mediaUrl}
                      alt="Shared media"
                      onClick={() => setPreviewImage(msg.mediaUrl || null)}
                      className="max-h-60 w-full object-cover hover:opacity-95 transition"
                    />
                  </div>
                )}

                {/* Content: Voice Note */}
                {msg.type === 'audio' && (
                  <div className="flex items-center gap-3 py-1 min-w-[200px]">
                    <button
                      onClick={() => playVoiceNote(msg.id, msg.mediaUrl)}
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

                    {/* Animated Waveform Visualizer */}
                    <div className="flex-1 flex items-center gap-0.5 h-6">
                      {[30, 60, 40, 80, 50, 95, 70, 30, 85, 45, 60, 75, 40, 90, 50, 35].map(
                        (height, idx) => (
                          <div
                            key={idx}
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

                {/* Content: Text */}
                {msg.type === 'text' && (
                  <p className="whitespace-pre-wrap break-words leading-relaxed text-sm select-text">
                    {msg.text}
                  </p>
                )}

                {/* Bubble Footer: Timestamp & WhatsApp Delivery Checks */}
                <div
                  className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                    isMine ? 'text-emerald-200/80' : 'text-slate-400'
                  }`}
                >
                  <span>
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>

                  {isMine && (
                    <span title={isReadByRecipient ? 'Read' : 'Delivered'}>
                      {isReadByRecipient ? (
                        <CheckCheck className="w-3.5 h-3.5 text-sky-300" />
                      ) : (
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-200" />
                      )}
                    </span>
                  )}
                </div>

                {/* Emoji Reactions Tray on Bubble */}
                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5 -mb-1">
                    {Object.entries(msg.reactions).map(([emoji, uids]) => (
                      <button
                        key={emoji}
                        onClick={() => user && toggleMessageReaction(chat.id, msg.id, user.userId, emoji)}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border transition cursor-pointer ${
                          user && uids.includes(user.userId)
                            ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                            : 'bg-slate-900/60 border-slate-700/60 text-slate-300'
                        }`}
                      >
                        <span>{emoji}</span>
                        <span>{uids.length}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Hover Quick Action Toolbar */}
              <div
                className={`opacity-0 group-hover:opacity-100 flex items-center gap-1 text-slate-400 mt-1 transition-opacity ${
                  isMine ? 'mr-1' : 'ml-1'
                }`}
              >
                {/* Quick emoji reacts */}
                {['❤️', '👍', '😂', '🔥'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => user && toggleMessageReaction(chat.id, msg.id, user.userId, emoji)}
                    className="hover:scale-125 transition cursor-pointer text-xs p-0.5"
                    title={`React ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}

                {/* Reply */}
                <button
                  onClick={() => setReplyingTo(msg)}
                  className="hover:text-emerald-400 p-1 rounded hover:bg-slate-800 transition cursor-pointer"
                  title="Reply"
                >
                  <Reply className="w-3.5 h-3.5" />
                </button>

                {/* Delete message (only author) */}
                {isMine && (
                  <button
                    onClick={() => deleteChatMessage(chat.id, msg.id)}
                    className="hover:text-red-400 p-1 rounded hover:bg-slate-800 transition cursor-pointer"
                    title="Delete Message"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Quoted Message Bar */}
      {replyingTo && (
        <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs animate-in slide-in-from-bottom-2">
          <div className="border-l-4 border-emerald-500 pl-3 min-w-0">
            <span className="font-bold text-emerald-400 block text-[11px]">
              Replying to {replyingTo.senderName}
            </span>
            <p className="text-slate-300 truncate text-[11px]">
              {replyingTo.text || (replyingTo.type === 'audio' ? '🎤 Voice note' : '📷 Photo')}
            </p>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Emoji Picker Tray */}
      {showEmojiPicker && (
        <div className="px-4 py-3 bg-slate-900 border-t border-slate-800 flex flex-wrap gap-2 text-xl max-h-36 overflow-y-auto">
          {commonEmojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                setInputText((prev) => prev + emoji);
              }}
              className="hover:scale-125 transition cursor-pointer p-1 rounded hover:bg-slate-800"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Message Input Bottom Bar */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 shrink-0">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />

        {isRecording ? (
          /* Live Voice Recording State */
          <div className="flex items-center justify-between bg-slate-800 rounded-2xl px-4 py-2.5 animate-pulse">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
              <span className="text-xs font-semibold text-red-400">Recording audio note...</span>
              <span className="text-xs font-mono text-slate-300">{formatAudioTime(recordDuration)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => stopRecording(true)}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => stopRecording(false)}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold cursor-pointer shadow flex items-center gap-1"
              >
                <Send className="w-3 h-3" />
                <span>Send Note</span>
              </button>
            </div>
          </div>
        ) : (
          /* Standard Text & Media Input */
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-2 rounded-xl transition cursor-pointer ${
                showEmojiPicker
                  ? 'text-emerald-400 bg-slate-800'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Add Emoji"
            >
              <Smile className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition cursor-pointer"
              title="Attach Photo"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            <input
              type="text"
              placeholder="Type a message..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-slate-800/90 border border-slate-700/80 rounded-2xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500/80 shadow-inner"
              maxLength={5000}
            />

            {inputText.trim() ? (
              <button
                type="submit"
                className="w-10 h-10 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition shadow-lg shadow-emerald-600/30 cursor-pointer shrink-0"
                title="Send Message"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                className="w-10 h-10 rounded-2xl bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white flex items-center justify-center transition shadow cursor-pointer shrink-0"
                title="Hold or click to record voice note"
              >
                <Mic className="w-4 h-4" />
              </button>
            )}
          </form>
        )}
      </div>

      {/* Lightbox Image Preview Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={previewImage}
              alt="Full preview"
              className="max-h-[85vh] w-auto rounded-2xl shadow-2xl object-contain mx-auto"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-2 right-2 p-2 bg-slate-900/80 text-white rounded-full hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
