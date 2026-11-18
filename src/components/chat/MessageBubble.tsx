import type React from 'react';
import { CheckCheck, Pause, Play, Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed } from 'lucide-react';
import type { ChatMessage, ChatRoom, DirectoryUser, UserProfile } from '../../types/chat';

interface MessageBubbleProps {
  msg: ChatMessage;
  chat: ChatRoom;
  isMine: boolean;
  isSameSenderAsPrev: boolean;
  isNewDay: boolean;
  language: string;
  t: (key: any, params?: Record<string, any>) => string;
  user: UserProfile | null;
  ghostUser?: UserProfile | null;
  partnerUser?: DirectoryUser | null;
  isPartnerDeleted?: boolean;
  isLastSeenInDm?: boolean;
  editingMessage: ChatMessage | null;
  editText: string;
  setEditText: (val: string) => void;
  setEditingMessage: (msg: ChatMessage | null) => void;
  handleSaveEdit: () => void;
  playingAudioId: string | null;
  audioProgress: Record<string, number>;
  playVoiceNote: (messageId: string, url?: string) => void;
  formatAudioTime: (seconds?: number) => string;
  onPreviewImage: (url: string) => void;
  onMessageTap: (msg: ChatMessage) => void;
  onTouchStart: (msg: ChatMessage, e: React.TouchEvent | React.MouseEvent) => void;
  onTouchEnd: () => void;
  onContextMenu: (e: React.MouseEvent, msg: ChatMessage) => void;
  onToggleReaction: (msgId: string, emoji: string) => void;
  onOpenMessageInfo: (msg: ChatMessage) => void;
  onCallBack?: (callType: 'audio' | 'video') => void;
}

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

export function MessageBubble({
  msg,
  chat,
  isMine,
  isSameSenderAsPrev,
  isNewDay,
  language,
  t,
  user,
  ghostUser,
  partnerUser,
  isPartnerDeleted,
  isLastSeenInDm = true,
  editingMessage,
  editText,
  setEditText,
  setEditingMessage,
  handleSaveEdit,
  playingAudioId,
  audioProgress,
  playVoiceNote,
  formatAudioTime,
  onPreviewImage,
  onMessageTap,
  onTouchStart,
  onTouchEnd,
  onContextMenu,
  onToggleReaction,
  onOpenMessageInfo,
  onCallBack,
}: MessageBubbleProps) {
  const readByArr = Array.isArray(msg.readBy) ? msg.readBy : [];
  const detailsMap = msg.seenByDetails || {};
  const seenUidSet = new Set<string>();
  Object.keys(detailsMap).forEach((uid) => {
    if (uid && uid !== msg.senderId) seenUidSet.add(uid);
  });
  readByArr.forEach((uid) => {
    if (uid && uid !== msg.senderId) seenUidSet.add(uid);
  });

  const seenList: Array<[string, { displayName: string; photoURL?: string; seenAt?: string }]> =
    Array.from(seenUidSet).map((uid) => {
      const saved = detailsMap[uid];
      const participantInfo = chat.participantDetails?.[uid];
      if (chat.type === 'direct' && isPartnerDeleted) {
        return [
          uid,
          {
            displayName: t('deletedAccountName'),
            photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=deleted_user',
            seenAt: saved?.seenAt,
          },
        ];
      }
      const liveMatch = partnerUser && partnerUser.userId === uid ? partnerUser : null;
      return [
        uid,
        {
          displayName:
            liveMatch?.displayName ||
            participantInfo?.displayName ||
            saved?.displayName ||
            (language === 'bn' ? 'ব্যবহারকারী' : 'User'),
          photoURL:
            liveMatch?.photoURL ||
            participantInfo?.photoURL ||
            saved?.photoURL ||
            `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}`,
          seenAt: saved?.seenAt,
        },
      ];
    });

  const isReadByOther = seenList.length > 0;
  const viewerId = ghostUser?.userId || user?.userId;
  const isCallMessage = msg.type === 'call';
  const isOutgoingCall = isCallMessage
    ? (msg.callerId || msg.senderId) === viewerId
    : isMine;
  const bubbleIsRight = isCallMessage ? isOutgoingCall : isMine;

  const formatCallDurationLocalized = (secs?: number) => {
    const safe = Math.max(0, Math.round(secs || 0));
    const hrs = Math.floor(safe / 3600);
    const mins = Math.floor((safe % 3600) / 60);
    const remSecs = safe % 60;
    if (language === 'bn') {
      if (hrs > 0) return `${hrs} ঘ ${mins} মি ${remSecs} সে`;
      if (mins > 0) return `${mins} মি ${remSecs} সে`;
      return `${remSecs} সেকেন্ড`;
    }
    if (hrs > 0) return `${hrs}h ${mins}m ${remSecs}s`;
    if (mins > 0) return `${mins}m ${remSecs}s`;
    return `${remSecs}s`;
  };

  return (
    <div className="w-full">
      {isNewDay && (
        <div className="flex items-center justify-center my-3">
          <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-slate-900/90 text-slate-400 border border-slate-800 shadow-sm select-none">
            {(() => {
              const d = new Date(msg.createdAt);
              const today = new Date();
              if (d.toDateString() === today.toDateString()) {
                return language === 'bn' ? 'আজ' : 'Today';
              }
              const yest = new Date();
              yest.setDate(today.getDate() - 1);
              if (d.toDateString() === yest.toDateString()) {
                return language === 'bn' ? 'গতকাল' : 'Yesterday';
              }
              return d.toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {
                month: 'short',
                day: 'numeric',
              });
            })()}
          </span>
        </div>
      )}

      <div
        id={`msg-${msg.id}`}
        className={`flex flex-col ${bubbleIsRight ? 'items-end' : 'items-start'} group relative ${
          isSameSenderAsPrev ? 'mt-1' : 'mt-3.5'
        }`}
      >
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
            {Boolean(chat.participantDetails?.[msg.senderId]?.isBanned) && (
              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold">
                {language === 'bn' ? 'স্থগিত' : 'Suspended'}
              </span>
            )}
          </div>
        )}

        <div
          onClick={() => onMessageTap(msg)}
          onTouchStart={(e) => onTouchStart(msg, e)}
          onTouchEnd={onTouchEnd}
          onTouchMove={onTouchEnd}
          onContextMenu={(e) => onContextMenu(e, msg)}
          className={`max-w-[85%] sm:max-w-md px-3.5 py-2 transition-all cursor-pointer shadow-sm relative select-text ${
            bubbleIsRight
              ? isCallMessage
                ? 'bg-slate-800/95 text-slate-100 rounded-2xl rounded-tr-sm border border-emerald-500/30 shadow-emerald-950/20'
                : 'bg-emerald-600 text-white rounded-2xl rounded-tr-sm shadow-emerald-950/20'
              : 'bg-slate-800/90 text-slate-100 rounded-2xl rounded-tl-sm border border-slate-700/50'
          }`}
        >
          {msg.replyToId && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                const elem = document.getElementById(`msg-${msg.replyToId}`);
                elem?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              className={`mb-2 p-2 rounded-r-lg text-xs border-l-2 transition cursor-pointer ${
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

          {msg.type === 'image' && msg.mediaUrl && (
            <div className="mb-2 rounded-xl overflow-hidden cursor-pointer">
              <img
                src={msg.mediaUrl}
                alt="Shared media"
                onClick={(e) => {
                  e.stopPropagation();
                  if (msg.mediaUrl) onPreviewImage(msg.mediaUrl);
                }}
                className="max-h-64 w-full object-cover hover:opacity-95 transition rounded-xl"
              />
            </div>
          )}

          {msg.type === 'audio' && (
            <div className="flex items-center gap-3 py-1.5 min-w-[210px] sm:min-w-[240px]">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  playVoiceNote(msg.id, msg.mediaUrl);
                }}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition cursor-pointer shadow shrink-0 ${
                  isMine
                    ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 active:scale-95'
                    : 'bg-emerald-600 text-white hover:bg-emerald-500 active:scale-95'
                }`}
                title={playingAudioId === msg.id ? 'Pause' : 'Play'}
              >
                {playingAudioId === msg.id ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>

              <div
                onClick={(e) => {
                  e.stopPropagation();
                  playVoiceNote(msg.id, msg.mediaUrl);
                }}
                className="flex-1 flex items-center gap-1 h-6 cursor-pointer"
              >
                {[25, 60, 35, 80, 50, 95, 70, 30, 85, 45, 60, 75, 40, 90, 50, 35].map(
                  (height, bIdx) => {
                    const barProgress = (bIdx / 16) * 100;
                    const currentProgress = audioProgress[msg.id] || 0;
                    const isPassed = playingAudioId === msg.id && currentProgress >= barProgress;
                    return (
                      <div
                        key={bIdx}
                        style={{ height: `${height}%` }}
                        className={`w-1 rounded-full transition-all duration-150 ${
                          isPassed
                            ? isMine
                              ? 'bg-white'
                              : 'bg-emerald-300'
                            : playingAudioId === msg.id
                            ? isMine
                              ? 'bg-emerald-200/90'
                              : 'bg-emerald-500/80'
                            : isMine
                            ? 'bg-emerald-300/60'
                            : 'bg-slate-500'
                        }`}
                      />
                    );
                  }
                )}
              </div>

              <span className="text-[10px] font-mono opacity-85 shrink-0">
                {formatAudioTime(msg.audioDuration)}
              </span>
            </div>
          )}

          {msg.type === 'call' && (() => {
            const isVideo = msg.callType === 'video';
            const status = msg.callStatus || 'completed';
            const isUnanswered = status === 'missed' || status === 'declined' || status === 'cancelled';

            let callTitle = '';
            let callSubtitle = '';

            if (status === 'completed') {
              callTitle = language === 'bn'
                ? isOutgoingCall
                  ? isVideo ? 'আউটগোয়িং ভিডিও কল' : 'আউটগোয়িং অডিও কল'
                  : isVideo ? 'ইনকামিং ভিডিও কল' : 'ইনকামিং অডিও কল'
                : isOutgoingCall
                ? isVideo ? 'Outgoing video call' : 'Outgoing voice call'
                : isVideo ? 'Incoming video call' : 'Incoming voice call';
              callSubtitle = formatCallDurationLocalized(msg.callDuration);
            } else if (status === 'declined') {
              callTitle = language === 'bn'
                ? isVideo ? 'ভিডিও কল প্রত্যাখ্যাত' : 'অডিও কল প্রত্যাখ্যাত'
                : isVideo ? 'Declined video call' : 'Declined voice call';
              callSubtitle = language === 'bn' ? 'কল রিসিভ করা হয়নি' : 'Declined';
            } else if (status === 'cancelled') {
              if (isOutgoingCall) {
                callTitle = language === 'bn'
                  ? isVideo ? 'ভিডিও কল বাতিল হয়েছে' : 'অডিও কল বাতিল হয়েছে'
                  : isVideo ? 'Cancelled video call' : 'Cancelled voice call';
                callSubtitle = language === 'bn' ? 'রিসিভ হওয়ার আগে কাটা হয়েছে' : 'Cancelled';
              } else {
                callTitle = language === 'bn'
                  ? isVideo ? 'মিসড ভিডিও কল' : 'মিসড অডিও কল'
                  : isVideo ? 'Missed video call' : 'Missed voice call';
                callSubtitle = language === 'bn' ? 'কল রিসিভ হয়নি' : 'Not answered';
              }
            } else {
              callTitle = language === 'bn'
                ? isOutgoingCall
                  ? isVideo ? 'কোনো উত্তর পাওয়া যায়নি' : 'কোনো উত্তর পাওয়া যায়নি'
                  : isVideo ? 'মিসড ভিডিও কল' : 'মিসড অডিও কল'
                : isOutgoingCall
                ? isVideo ? 'No answer · Video' : 'No answer · Voice'
                : isVideo ? 'Missed video call' : 'Missed voice call';
              callSubtitle = language === 'bn' ? 'কল রিসিভ হয়নি' : 'No answer';
            }

            return (
              <div className="flex items-center gap-3 py-1 min-w-[215px]">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border ${
                    isUnanswered
                      ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  {isUnanswered ? (
                    <PhoneMissed className="w-4 h-4" />
                  ) : isOutgoingCall ? (
                    <PhoneOutgoing className="w-4 h-4" />
                  ) : (
                    <PhoneIncoming className="w-4 h-4" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white truncate">{callTitle}</div>
                  <div
                    className={`text-[11px] mt-0.5 font-medium ${
                      isUnanswered ? 'text-rose-300/90' : 'text-emerald-300'
                    }`}
                  >
                    {callSubtitle}
                  </div>
                </div>

                {onCallBack && !ghostUser && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCallBack(isVideo ? 'video' : 'audio');
                    }}
                    className="w-8 h-8 rounded-full bg-slate-700/70 hover:bg-emerald-600 text-slate-200 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
                    title={language === 'bn' ? 'পুনরায় কল করুন' : 'Call back'}
                  >
                    {isVideo ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            );
          })()}

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

          <div
            className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
              bubbleIsRight && !isCallMessage ? 'text-emerald-100/75' : 'text-slate-400'
            }`}
          >
            {msg.isEdited && <span className="italic text-[9px] mr-0.5">{t('editedTag')}</span>}
            <span>
              {new Date(msg.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            {isMine && !isCallMessage && (
              <span>
                <CheckCheck
                  className={`w-3.5 h-3.5 ${
                    isReadByOther ? 'text-sky-300' : 'text-emerald-200'
                  }`}
                />
              </span>
            )}
          </div>

          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5 -mb-0.5">
              {Object.entries(msg.reactions).map(([emoji, uids]) => (
                <button
                  key={emoji}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (user && !ghostUser) onToggleReaction(msg.id, emoji);
                  }}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border transition ${
                    ghostUser ? 'cursor-default opacity-85' : 'cursor-pointer'
                  } ${
                    user && !ghostUser && uids.includes(user.userId)
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

        {isMine && !isCallMessage && seenList.length > 0 && (chat.type === 'group' || isLastSeenInDm) && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onOpenMessageInfo(msg);
            }}
            className="flex items-center gap-1.5 mt-1 mr-1 cursor-pointer hover:opacity-90 group/seen"
            title={language === 'bn' ? 'কে কে দেখেছে দেখতে ক্লিক করুন' : 'Click to see message info'}
          >
            <div className="flex items-center -space-x-1">
              {seenList.slice(0, 4).map(([uid, details]) => (
                <img
                  key={uid}
                  src={details.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}`}
                  alt={details.displayName}
                  title={`Seen by ${details.displayName}`}
                  className="w-4 h-4 rounded-full object-cover border border-slate-900 shadow group-hover/seen:scale-110 transition-transform"
                />
              ))}
            </div>
            {seenList.length > 4 && (
              <span className="text-[9px] text-slate-400 font-mono">
                +{seenList.length - 4}
              </span>
            )}
            {chat.type === 'group' && (
              <span className="text-[10px] text-sky-300 font-mono font-semibold bg-sky-950/40 border border-sky-500/30 px-1.5 py-0.2 rounded-full">
                {seenList.length}/{Math.max(1, chat.participantIds.length - 1)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
