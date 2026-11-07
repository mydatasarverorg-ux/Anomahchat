import React from 'react';
import { X, CheckCheck, Clock, MessageSquare } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import type { ChatMessage, ChatRoom } from '../types/chat';

interface MessageInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: ChatMessage | null;
  chat: ChatRoom;
}

export const MessageInfoModal: React.FC<MessageInfoModalProps> = ({
  isOpen,
  onClose,
  message,
  chat,
}) => {
  const { t, language } = useLanguage();

  if (!isOpen || !message) return null;

  const isGroup = chat.type === 'group';
  const seenDetailsMap = message.seenByDetails || {};

  // All members who have seen the message (excluding the sender themselves)
  const seenMembers = Object.entries(seenDetailsMap)
    .filter(([uid]) => uid !== message.senderId)
    .map(([uid, details]) => ({
      userId: uid,
      displayName: details.displayName || chat.participantDetails?.[uid]?.displayName || 'User',
      photoURL: details.photoURL || chat.participantDetails?.[uid]?.photoURL,
      seenAt: details.seenAt,
    }));

  // Identify who hasn't seen the message yet
  const notSeenMembers = (chat.participantIds || [])
    .filter((uid) => uid !== message.senderId && !message.readBy.includes(uid))
    .map((uid) => ({
      userId: uid,
      displayName: chat.participantDetails?.[uid]?.displayName || 'User',
      photoURL: chat.participantDetails?.[uid]?.photoURL,
    }));

  const formatTimestamp = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      const isToday = d.toDateString() === new Date().toDateString();
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (isToday) return `${timeStr} (${language === 'bn' ? 'আজ' : 'Today'})`;
      return `${timeStr}, ${d.toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', { month: 'short', day: 'numeric' })}`;
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">{t('messageInfoTitle')}</h3>
              <p className="text-[11px] text-slate-400">
                {isGroup ? chat.name || t('filterGroup') : t('filterDirect')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Preview Box */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/50">
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-200">
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5 font-medium">
              <span>{message.senderName}</span>
              <span>{formatTimestamp(message.createdAt)}</span>
            </div>
            {message.type === 'text' && (
              <p className="whitespace-pre-wrap break-words text-white font-normal leading-relaxed line-clamp-3">
                {message.text}
              </p>
            )}
            {message.type === 'image' && (
              <div className="flex items-center gap-2 text-emerald-400 font-medium">
                <MessageSquare className="w-4 h-4" />
                <span>📷 {language === 'bn' ? 'ছবি' : 'Photo'}</span>
              </div>
            )}
            {message.type === 'audio' && (
              <div className="flex items-center gap-2 text-emerald-400 font-medium">
                <MessageSquare className="w-4 h-4" />
                <span>🎤 {language === 'bn' ? 'ভয়েস মেসেজ' : 'Voice Message'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Read Receipts List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Read By Section */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-emerald-400 mb-2 px-1">
              <span className="flex items-center gap-1.5">
                <CheckCheck className="w-3.5 h-3.5 text-sky-400" />
                {t('readBySection')}
              </span>
              <span className="text-[11px] font-mono bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                {seenMembers.length}
              </span>
            </div>

            {seenMembers.length === 0 ? (
              <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 text-center text-slate-500 text-xs">
                {language === 'bn' ? 'এখনো কেউ মেসেজটি দেখেনি' : 'No one has seen this message yet'}
              </div>
            ) : (
              <div className="space-y-1.5">
                {seenMembers.map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={member.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${member.userId}`}
                        alt={member.displayName}
                        className="w-8 h-8 rounded-full object-cover bg-slate-800 border border-slate-700 shrink-0"
                      />
                      <div>
                        <span className="block text-xs font-bold text-white leading-tight">
                          {member.displayName}
                        </span>
                        <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                          {t('seenAt')}: {formatTimestamp(member.seenAt)}
                        </span>
                      </div>
                    </div>
                    <CheckCheck className="w-4 h-4 text-sky-400 shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Not Read Yet Section (For Groups) */}
          {isGroup && notSeenMembers.length > 0 && (
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-2 px-1">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {t('notReadYetSection')}
                </span>
                <span className="text-[11px] font-mono bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                  {notSeenMembers.length}
                </span>
              </div>

              <div className="space-y-1.5">
                {notSeenMembers.map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60 opacity-80"
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={member.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${member.userId}`}
                        alt={member.displayName}
                        className="w-8 h-8 rounded-full object-cover bg-slate-800 border border-slate-700 shrink-0"
                      />
                      <div>
                        <span className="block text-xs font-semibold text-slate-300 leading-tight">
                          {member.displayName}
                        </span>
                        <span className="block text-[10px] text-slate-500 font-mono mt-0.5">
                          {language === 'bn' ? 'অপেক্ষমাণ' : 'Delivered'}
                        </span>
                      </div>
                    </div>
                    <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition cursor-pointer"
          >
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};
