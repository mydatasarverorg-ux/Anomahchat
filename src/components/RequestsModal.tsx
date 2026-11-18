import { useMemo, useState } from 'react';
import {
  acceptFriendRequest,
  blockUser,
  cancelFriendRequest,
  declineFriendRequest,
  unblockUser,
  unfriendUser,
} from '../services/chatService';
import { useLanguage } from '../context/LanguageContext';
import { useModalHistory } from '../hooks/useModalHistory';
import type { Friendship, UserProfile } from '../types/chat';
import {
  X,
  UserCheck,
  UserPlus,
  Clock,
  ShieldBan,
  Check,
  Trash2,
  MessageSquare,
  Phone,
  Video,
  QrCode,
  Loader2,
  Users,
} from 'lucide-react';

interface RequestsModalProps {
  currentUser: UserProfile;
  friendships: Friendship[];
  onClose: () => void;
  onOpenChatWithFriend: (friend: UserProfile, callType?: 'audio' | 'video') => void;
  onOpenQrScanner?: () => void;
  onOpenFindFriends?: () => void;
}

function getOtherPartyProfile(f: Friendship, myUid: string): UserProfile {
  const isRequester = f.requesterId === myUid;
  const otherId = isRequester ? f.receiverId : f.requesterId;
  const preview = isRequester ? f.receiverProfile : f.requesterProfile;
  return {
    userId: otherId,
    displayName: preview?.displayName || 'User',
    email: '',
    photoURL: preview?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${otherId}`,
    username: preview?.username,
    createdAt: f.createdAt,
  };
}

export function RequestsModal({
  currentUser,
  friendships,
  onClose,
  onOpenChatWithFriend,
  onOpenQrScanner,
  onOpenNewChat,
}: RequestsModalProps & { onOpenNewChat?: () => void }) {
  const { language } = useLanguage();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmUnfriendId, setConfirmUnfriendId] = useState<string | null>(null);

  useModalHistory(true, onClose);

  const incoming = useMemo(
    () =>
      friendships.filter(
        (f) => f.status === 'pending' && f.receiverId === currentUser.userId
      ),
    [friendships, currentUser.userId]
  );

  const outgoing = useMemo(
    () =>
      friendships.filter(
        (f) => f.status === 'pending' && f.requesterId === currentUser.userId
      ),
    [friendships, currentUser.userId]
  );

  const accepted = useMemo(
    () => friendships.filter((f) => f.status === 'accepted'),
    [friendships]
  );

  const blocked = useMemo(
    () =>
      friendships.filter(
        (f) => f.status === 'blocked' && f.blockedBy === currentUser.userId
      ),
    [friendships, currentUser.userId]
  );

  const [tab, setTab] = useState<'incoming' | 'sent' | 'friends' | 'blocked'>(
    incoming.length > 0 ? 'incoming' : 'friends'
  );

  const runAction = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    try {
      await fn();
    } catch (err) {
      console.error('Friendship action error:', err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-lg p-5 sm:p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center justify-between gap-2 pr-8 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {language === 'bn' ? 'ফ্রেন্ডস ও রিকোয়েস্ট' : 'Friends & Requests'}
              </h3>
              <p className="text-xs text-slate-400">
                {language === 'bn'
                  ? 'রিকোয়েস্ট একসেপ্ট হলেই চ্যাট, কল ও প্রাইভেট গ্রুপ শুরু হবে'
                  : 'Accepted friends can chat, call, and join private groups'}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        {(onOpenQrScanner || onOpenNewChat) && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            {onOpenNewChat && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenNewChat();
                }}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/70 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                <span>{language === 'bn' ? 'বন্ধু খুঁজুন' : 'Find Friends'}</span>
              </button>
            )}
            {onOpenQrScanner && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenQrScanner();
                }}
                className="py-2 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-xs font-semibold text-emerald-300 flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'QR স্ক্যান করুন' : 'Scan QR'}</span>
              </button>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="grid grid-cols-4 p-1 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-semibold mb-3 gap-1">
          <button
            type="button"
            onClick={() => setTab('incoming')}
            className={`py-1.5 px-1 rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
              tab === 'incoming' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>{language === 'bn' ? 'আগত' : 'Requests'}</span>
            {incoming.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-bold">
                {incoming.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab('friends')}
            className={`py-1.5 px-1 rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
              tab === 'friends' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>{language === 'bn' ? 'বন্ধু' : 'Friends'}</span>
            <span className="text-[10px] text-slate-400">({accepted.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('sent')}
            className={`py-1.5 px-1 rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
              tab === 'sent' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>{language === 'bn' ? 'পাঠানো' : 'Sent'}</span>
            {outgoing.length > 0 && (
              <span className="text-[10px] text-amber-400">({outgoing.length})</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab('blocked')}
            className={`py-1.5 px-1 rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
              tab === 'blocked' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>{language === 'bn' ? 'ব্লকড' : 'Blocked'}</span>
            {blocked.length > 0 && (
              <span className="text-[10px] text-rose-400">({blocked.length})</span>
            )}
          </button>
        </div>

        {/* List Body */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
          {tab === 'incoming' &&
            (incoming.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs space-y-1">
                <UserPlus className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                <p className="font-semibold text-slate-300">
                  {language === 'bn' ? 'কোনো পেন্ডিং রিকোয়েস্ট নেই' : 'No incoming friend requests'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {language === 'bn'
                    ? 'কেউ আপনার QR কোড স্ক্যান বা সার্চ করে রিকোয়েস্ট পাঠালে এখানে দেখাবে।'
                    : 'Requests from QR scans or user searches will appear here.'}
                </p>
              </div>
            ) : (
              incoming.map((f) => {
                const other = getOtherPartyProfile(f, currentUser.userId);
                const isBusy = busyId === f.id;
                return (
                  <div
                    key={f.id}
                    className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={other.photoURL}
                        alt={other.displayName}
                        className="w-10 h-10 rounded-full object-cover bg-slate-800 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{other.displayName}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                          {other.username && <span className="font-mono text-emerald-400">@{other.username}</span>}
                          {f.source === 'qr' && (
                            <span className="px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 text-[9px] font-bold">
                              QR
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => runAction(f.id, () => acceptFriendRequest(f.id, currentUser))}
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        <span>{language === 'bn' ? 'একসেপ্ট' : 'Accept'}</span>
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => runAction(f.id, () => declineFriendRequest(f.id))}
                        className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer transition"
                        title={language === 'bn' ? 'বাতিল করুন' : 'Decline'}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => runAction(f.id, () => blockUser(currentUser, other))}
                        className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs cursor-pointer transition"
                        title={language === 'bn' ? 'ব্লক করুন' : 'Block'}
                      >
                        <ShieldBan className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            ))}

          {tab === 'friends' &&
            (accepted.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs space-y-1">
                <Users className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                <p className="font-semibold text-slate-300">
                  {language === 'bn' ? 'এখনো কোনো ফ্রেন্ড যুক্ত হয়নি' : 'No accepted friends yet'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {language === 'bn'
                    ? 'বন্ধু খুঁজতে সার্চ করুন বা QR কোড স্ক্যান করুন।'
                    : 'Search by @username or scan a QR code to connect with friends.'}
                </p>
              </div>
            ) : (
              accepted.map((f) => {
                const other = getOtherPartyProfile(f, currentUser.userId);
                const isBusy = busyId === f.id;
                const isConfirming = confirmUnfriendId === f.id;
                return (
                  <div
                    key={f.id}
                    className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={other.photoURL}
                          alt={other.displayName}
                          className="w-10 h-10 rounded-full object-cover bg-slate-800 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{other.displayName}</div>
                          {other.username && (
                            <div className="text-[11px] font-mono text-emerald-400 truncate">@{other.username}</div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onOpenChatWithFriend(other);
                            onClose();
                          }}
                          className="p-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white transition cursor-pointer"
                          title={language === 'bn' ? 'চ্যাট করুন' : 'Message'}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onOpenChatWithFriend(other, 'audio');
                            onClose();
                          }}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white transition cursor-pointer"
                          title={language === 'bn' ? 'অডিও কল' : 'Audio Call'}
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onOpenChatWithFriend(other, 'video');
                            onClose();
                          }}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white transition cursor-pointer"
                          title={language === 'bn' ? 'ভিডিও কল' : 'Video Call'}
                        >
                          <Video className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmUnfriendId(isConfirming ? null : f.id)}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                          title={language === 'bn' ? 'আনফ্রেন্ড বা ব্লক' : 'Unfriend / Block'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {isConfirming && (
                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-slate-400">
                          {language === 'bn' ? 'আনফ্রেন্ড করলে মেসেজ ও কল বন্ধ হবে।' : 'Unfriending locks 1-on-1 messages & calls.'}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              runAction(f.id, async () => {
                                await unfriendUser(f.id);
                                setConfirmUnfriendId(null);
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer"
                          >
                            {language === 'bn' ? 'আনফ্রেন্ড' : 'Unfriend'}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              runAction(f.id, async () => {
                                await blockUser(currentUser, other);
                                setConfirmUnfriendId(null);
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
                          >
                            {language === 'bn' ? 'ব্লক' : 'Block'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ))}

          {tab === 'sent' &&
            (outgoing.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs space-y-1">
                <Clock className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                <p className="font-semibold text-slate-300">
                  {language === 'bn' ? 'কোনো পাঠানো পেন্ডিং রিকোয়েস্ট নেই' : 'No pending sent requests'}
                </p>
              </div>
            ) : (
              outgoing.map((f) => {
                const other = getOtherPartyProfile(f, currentUser.userId);
                const isBusy = busyId === f.id;
                return (
                  <div
                    key={f.id}
                    className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={other.photoURL}
                        alt={other.displayName}
                        className="w-10 h-10 rounded-full object-cover bg-slate-800 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{other.displayName}</div>
                        <div className="text-[11px] text-amber-400">
                          {language === 'bn' ? 'একসেপ্টের অপেক্ষায়' : 'Waiting for acceptance'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => runAction(f.id, () => cancelFriendRequest(f.id))}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 text-[11px] font-semibold cursor-pointer transition shrink-0"
                    >
                      {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : language === 'bn' ? 'বাতিল' : 'Cancel'}
                    </button>
                  </div>
                );
              })
            ))}

          {tab === 'blocked' &&
            (blocked.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs space-y-1">
                <ShieldBan className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                <p className="font-semibold text-slate-300">
                  {language === 'bn' ? 'ব্লক তালিকায় কেউ নেই' : 'No blocked users'}
                </p>
              </div>
            ) : (
              blocked.map((f) => {
                const other = getOtherPartyProfile(f, currentUser.userId);
                const isBusy = busyId === f.id;
                return (
                  <div
                    key={f.id}
                    className="p-3 rounded-2xl bg-slate-950/70 border border-rose-500/20 flex items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={other.photoURL}
                        alt={other.displayName}
                        className="w-10 h-10 rounded-full object-cover bg-slate-800 shrink-0 opacity-75"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{other.displayName}</div>
                        <div className="text-[11px] text-rose-400">
                          {language === 'bn' ? 'ব্লক করা আছে' : 'Blocked'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => runAction(f.id, () => unblockUser(f.id))}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white text-[11px] font-semibold cursor-pointer transition shrink-0"
                    >
                      {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : language === 'bn' ? 'আনব্লক' : 'Unblock'}
                    </button>
                  </div>
                );
              })
            ))}
        </div>
      </div>
    </div>
  );
}
