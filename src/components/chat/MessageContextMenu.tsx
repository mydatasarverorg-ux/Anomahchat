import { Copy, Flag, Info, Pencil, Reply, ShieldAlert, Trash2 } from 'lucide-react';
import type { ChatMessage, UserProfile } from '../../types/chat';

interface MessageContextMenuProps {
  message: ChatMessage;
  position: { x: number; y: number };
  chatId: string;
  user: UserProfile | null;
  ghostUser?: UserProfile | null;
  language: string;
  t: (key: any, params?: Record<string, any>) => string;
  onReact: (msgId: string, emoji: string) => void;
  onReply: (msg: ChatMessage) => void;
  onInfo: (msg: ChatMessage) => void;
  onCopy: (text: string) => void;
  onEdit: (msg: ChatMessage) => void;
  onReport: (msg: ChatMessage) => void;
  onDelete: (msg: ChatMessage) => void;
  onClose: () => void;
}

export function MessageContextMenu({
  message,
  position,
  user,
  ghostUser,
  language,
  t,
  onReact,
  onReply,
  onInfo,
  onCopy,
  onEdit,
  onReport,
  onDelete,
  onClose,
}: MessageContextMenuProps) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{ top: `${position.y}px`, left: `${position.x}px` }}
      className="fixed z-50 flex flex-col gap-1.5 animate-in zoom-in-95 duration-150"
    >
      {!ghostUser && (
        <div className="flex items-center gap-2 p-1.5 bg-slate-900/95 border border-slate-700 rounded-full shadow-2xl backdrop-blur-md">
          {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                if (user) onReact(message.id, emoji);
                onClose();
              }}
              className="w-8 h-8 rounded-full hover:bg-slate-800 flex items-center justify-center text-lg hover:scale-125 transition cursor-pointer"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <div className="bg-slate-900/95 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden py-1 min-w-[170px] backdrop-blur-md">
        {ghostUser ? (
          <>
            <div className="px-3.5 py-1.5 border-b border-slate-800 text-[10px] text-sky-400 font-semibold flex items-center gap-1.5">
              <ShieldAlert className="w-3 h-3" />
              <span>{language === 'bn' ? 'রিড-অনলি গোস্ট অডিট' : 'Read-Only Ghost Audit'}</span>
            </div>
            {message.type === 'text' && (
              <button
                onClick={() => onCopy(message.text)}
                className="w-full px-3.5 py-2 text-left text-xs text-white hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer transition font-medium"
              >
                <Copy className="w-3.5 h-3.5 text-sky-400" />
                <span>{t('copyTextAction')}</span>
              </button>
            )}
          </>
        ) : (
          <>
            <button
              onClick={() => {
                onReply(message);
                onClose();
              }}
              className="w-full px-3.5 py-2 text-left text-xs text-white hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer transition font-medium"
            >
              <Reply className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('replyAction')}</span>
            </button>

            <button
              onClick={() => {
                onInfo(message);
                onClose();
              }}
              className="w-full px-3.5 py-2 text-left text-xs text-sky-300 hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer transition font-medium"
            >
              <Info className="w-3.5 h-3.5 text-sky-400" />
              <span>{t('messageInfoTitle')}</span>
            </button>

            {message.type === 'text' && (
              <button
                onClick={() => onCopy(message.text)}
                className="w-full px-3.5 py-2 text-left text-xs text-white hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer transition font-medium"
              >
                <Copy className="w-3.5 h-3.5 text-sky-400" />
                <span>{t('copyTextAction')}</span>
              </button>
            )}

            {message.senderId === user?.userId && message.type === 'text' && (
              <button
                onClick={() => onEdit(message)}
                className="w-full px-3.5 py-2 text-left text-xs text-amber-300 hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer transition font-medium"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>{t('editAction')}</span>
              </button>
            )}

            {message.senderId !== user?.userId && (
              <button
                onClick={() => {
                  onReport(message);
                  onClose();
                }}
                className="w-full px-3.5 py-2 text-left text-xs text-amber-300 hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer transition font-medium"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>{t('reportMessageAction')}</span>
              </button>
            )}

            {message.senderId === user?.userId && (
              <button
                onClick={() => {
                  onDelete(message);
                  onClose();
                }}
                className="w-full px-3.5 py-2 text-left text-xs text-red-400 hover:bg-red-500/15 flex items-center gap-2.5 cursor-pointer transition font-medium border-t border-slate-800"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('deleteForEveryoneAction')}</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
