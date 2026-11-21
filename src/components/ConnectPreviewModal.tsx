import { useEffect, useRef, useState } from 'react';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  directoryUserToUserProfile,
  findDirectoryUserByIdentifier,
  getFriendshipBetween,
  getFriendshipId,
  getMyGroupJoinRequest,
  getOrCreateDirectChat,
  getPublicGroupSummary,
  joinPublicGroupDirect,
  requestToJoinPublicGroup,
  sendFriendRequest,
  unblockUser,
} from '../services/chatService';
import { useLanguage } from '../context/LanguageContext';
import { useModalHistory } from '../hooks/useModalHistory';
import type { DeepLinkTarget } from '../utils/accountShortcut';
import type {
  ChatRoom,
  DirectoryUser,
  Friendship,
  GroupJoinRequest,
  PublicGroupSummary,
  UserProfile,
} from '../types/chat';
import {
  X,
  UserPlus,
  Check,
  Clock,
  MessageSquare,
  ShieldAlert,
  Globe,
  Lock,
  Users,
  Loader2,
  QrCode,
  ShieldBan,
} from 'lucide-react';

interface ConnectPreviewModalProps {
  target: DeepLinkTarget;
  currentUser: UserProfile;
  existingChats: ChatRoom[];
  friendships: Friendship[];
  onClose: () => void;
  onOpenChat: (chat: ChatRoom) => void;
  onOpenShareSelf?: () => void;
}

export function ConnectPreviewModal({
  target,
  currentUser,
  existingChats,
  friendships,
  onClose,
  onOpenChat,
  onOpenShareSelf,
}: ConnectPreviewModalProps) {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [autoSentBanner, setAutoSentBanner] = useState(false);

  // User target state
  const [dirUser, setDirUser] = useState<DirectoryUser | null>(null);
  const [friendshipState, setFriendshipState] = useState<Friendship | null>(null);

  // Group target state
  const [publicGroup, setPublicGroup] = useState<PublicGroupSummary | null>(null);
  const [joinRequest, setJoinRequest] = useState<GroupJoinRequest | null>(null);
  const [joinNote, setJoinNote] = useState('');

  const autoTriggeredRef = useRef(false);

  useModalHistory(true, onClose);

  // Keep local friendshipState synced with live parent friendships array
  useEffect(() => {
    if (!dirUser) return;
    const pairId = getFriendshipId(currentUser.userId, dirUser.userId);
    const live = friendships.find((f) => f.id === pairId) || null;
    if (live) {
      setFriendshipState(live);
    }
  }, [friendships, dirUser, currentUser.userId]);

  useEffect(() => {
    let cancelled = false;
    autoTriggeredRef.current = false;
    setLoading(true);
    setErrorMsg(null);
    setAutoSentBanner(false);
    setDirUser(null);
    setPublicGroup(null);
    setJoinRequest(null);

    (async () => {
      try {
        if (target.type === 'chat') {
          const found = await findDirectoryUserByIdentifier(target.value);
          if (cancelled) return;
          if (!found || found.status === 'deleted' || found.status === 'scheduled_for_deletion') {
            setErrorMsg(
              language === 'bn'
                ? 'এই প্রোফাইলটি পাওয়া যায়নি বা অ্যাকাউন্টটি আর সক্রিয় নেই।'
                : 'This user profile could not be found or is no longer active.'
            );
            setLoading(false);
            return;
          }
          if (found.userId === currentUser.userId) {
            onClose();
            if (onOpenShareSelf) onOpenShareSelf();
            return;
          }
          setDirUser(found);
          const pairId = getFriendshipId(currentUser.userId, found.userId);
          const existingRel =
            friendships.find((f) => f.id === pairId) ||
            (await getFriendshipBetween(currentUser.userId, found.userId));
          if (cancelled) return;
          setFriendshipState(existingRel);

          // QR scan auto-send Friend Request (only if not banned, not blocked, not already friends or pending)
          if (
            target.isQr &&
            !found.isBanned &&
            (!existingRel || existingRel.status === 'declined') &&
            !autoTriggeredRef.current
          ) {
            autoTriggeredRef.current = true;
            try {
              const sent = await sendFriendRequest(
                currentUser,
                directoryUserToUserProfile(found),
                'qr'
              );
              if (!cancelled) {
                setFriendshipState(sent);
                setAutoSentBanner(true);
              }
            } catch (err) {
              if (!cancelled) {
                setErrorMsg(err instanceof Error ? err.message : 'Unable to send friend request.');
              }
            }
          }
        } else {
          // Group link / QR
          const alreadyMember = existingChats.find((c) => c.id === target.value);
          if (alreadyMember) {
            setPublicGroup({
              groupId: alreadyMember.id,
              name: alreadyMember.name || 'Group',
              description: alreadyMember.description,
              groupPhoto: alreadyMember.groupPhoto,
              creatorId: alreadyMember.creatorId || '',
              adminIds: alreadyMember.adminIds || [],
              joinPolicy: alreadyMember.joinPolicy === 'approval' ? 'approval' : 'direct',
              memberCount: alreadyMember.participantIds.length,
              status: 'active',
              createdAt: alreadyMember.createdAt,
              updatedAt: alreadyMember.updatedAt,
            });
            setLoading(false);
            return;
          }

          const pub = await getPublicGroupSummary(target.value);
          if (cancelled) return;
          if (!pub) {
            setErrorMsg(
              language === 'bn'
                ? 'এই গ্রুপটি প্রাইভেট অথবা আর সক্রিয় নেই। প্রাইভেট গ্রুপে শুধু অ্যাডমিন সদস্য যুক্ত করতে পারেন।'
                : 'This group is private or unavailable. Only an admin can add members to a private group.'
            );
            setLoading(false);
            return;
          }
          setPublicGroup(pub);
          if (pub.joinPolicy === 'approval') {
            const req = await getMyGroupJoinRequest(pub.groupId, currentUser.userId);
            if (!cancelled) setJoinRequest(req);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : 'Failed to load link target.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.type, target.value, target.isQr, currentUser.userId]);

  const partnerProfile = dirUser ? directoryUserToUserProfile(dirUser) : null;
  const existingDmRoom = dirUser
    ? existingChats.find(
        (c) => c.type === 'direct' && c.participantIds.includes(dirUser.userId)
      )
    : undefined;
  const isAlreadyMember = publicGroup
    ? existingChats.some((c) => c.id === publicGroup.groupId)
    : false;

  const canOpenChat = Boolean(
    friendshipState?.status === 'accepted' ||
      (existingDmRoom &&
        friendshipState?.status !== 'blocked' &&
        friendshipState?.status !== 'declined' &&
        friendshipState?.status !== 'pending')
  );

  const handleSendFriendRequest = async () => {
    if (!partnerProfile || busy) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await sendFriendRequest(
        currentUser,
        partnerProfile,
        target.isQr ? 'qr' : 'link'
      );
      setFriendshipState(res);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const handleAcceptRequest = async () => {
    if (!friendshipState || !partnerProfile || busy) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      await acceptFriendRequest(friendshipState.id, currentUser);
      const room = await getOrCreateDirectChat(currentUser, partnerProfile);
      onOpenChat(room);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to accept');
    } finally {
      setBusy(false);
    }
  };

  const handleOpenDirectChat = async () => {
    if (!partnerProfile || busy) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const room = existingDmRoom || (await getOrCreateDirectChat(currentUser, partnerProfile));
      onOpenChat(room);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Cannot open chat');
    } finally {
      setBusy(false);
    }
  };

  const handleJoinDirectGroup = async () => {
    if (!publicGroup || busy) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const room = await joinPublicGroupDirect(publicGroup.groupId, currentUser);
      onOpenChat(room);
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : language === 'bn'
          ? 'গ্রুপে যোগ দেওয়া যায়নি (হয়তো আপনি ব্লক/নিষিদ্ধ আছেন)।'
          : 'Unable to join this public group.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRequestApprovalGroup = async () => {
    if (!publicGroup || busy) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const req = await requestToJoinPublicGroup(publicGroup.groupId, currentUser, joinNote);
      setJoinRequest(req);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : language === 'bn'
          ? 'জয়েন রিকোয়েস্ট পাঠানো যায়নি।'
          : 'Unable to send join request.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-sm p-5 sm:p-6 shadow-2xl relative space-y-4">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-7 h-7 animate-spin text-emerald-400" />
            <span className="text-xs">
              {language === 'bn' ? 'প্রোফাইল যাচাই করা হচ্ছে...' : 'Loading preview...'}
            </span>
          </div>
        ) : dirUser && partnerProfile ? (
          <div className="space-y-4 text-center pt-2">
            <img
              src={partnerProfile.photoURL}
              alt={partnerProfile.displayName}
              className="w-20 h-20 rounded-full object-cover mx-auto bg-slate-800 border-2 border-emerald-500/40 shadow-lg"
            />
            <div>
              <h3 className="text-base font-bold text-white">{partnerProfile.displayName}</h3>
              {partnerProfile.username && (
                <p className="text-xs font-mono text-emerald-400 mt-0.5">@{partnerProfile.username}</p>
              )}
              {dirUser.about && (
                <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{dirUser.about}</p>
              )}
            </div>

            {autoSentBanner && friendshipState?.status === 'pending' && (
              <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-200 flex items-center justify-center gap-2">
                <QrCode className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  {language === 'bn'
                    ? 'QR স্ক্যান সম্পন্ন! ফ্রেন্ড রিকোয়েস্ট স্বয়ংক্রিয়ভাবে পাঠানো হয়েছে।'
                    : 'QR scanned! Friend request sent automatically.'}
                </span>
              </div>
            )}

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200">
                {errorMsg}
              </div>
            )}

            {dirUser.isBanned ? (
              <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-500/30 text-xs text-amber-200 flex items-center justify-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  {language === 'bn' ? 'এই অ্যাকাউন্টটি বর্তমানে স্থগিত রয়েছে।' : 'This account is suspended.'}
                </span>
              </div>
            ) : friendshipState?.status === 'blocked' ? (
              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/30 text-xs text-rose-200 flex items-center justify-center gap-2">
                  <ShieldBan className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>
                    {friendshipState.blockedBy === currentUser.userId
                      ? language === 'bn'
                        ? 'আপনি এই ইউজারকে ব্লক করে রেখেছেন।'
                        : 'You have blocked this user.'
                      : language === 'bn'
                      ? 'এই ইউজারের সাথে সংযোগ স্থাপন করা যাচ্ছে না।'
                      : 'Unable to connect with this user.'}
                  </span>
                </div>
                {friendshipState.blockedBy === currentUser.userId && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setErrorMsg(null);
                      try {
                        await unblockUser(friendshipState.id);
                        setFriendshipState(null);
                      } catch (err) {
                        setErrorMsg(
                          err instanceof Error
                            ? err.message
                            : language === 'bn'
                            ? 'আনব্লক করা যায়নি।'
                            : 'Failed to unblock user.'
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-emerald-600 text-white text-xs font-bold cursor-pointer transition"
                  >
                    {language === 'bn' ? 'আনব্লক করুন' : 'Unblock User'}
                  </button>
                )}
              </div>
            ) : canOpenChat ? (
              <button
                type="button"
                disabled={busy}
                onClick={handleOpenDirectChat}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition shadow"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                <span>{language === 'bn' ? 'চ্যাট শুরু করুন' : 'Open Chat'}</span>
              </button>
            ) : friendshipState?.status === 'pending' ? (
              friendshipState.receiverId === currentUser.userId ? (
                <div className="space-y-2">
                  <p className="text-xs text-emerald-300 font-medium">
                    {language === 'bn'
                      ? 'তিনি আপনাকে ফ্রেন্ড রিকোয়েস্ট পাঠিয়েছেন!'
                      : 'Sent you a friend request!'}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        setErrorMsg(null);
                        try {
                          await declineFriendRequest(friendshipState.id);
                          onClose();
                        } catch (err) {
                          setErrorMsg(
                            err instanceof Error
                              ? err.message
                              : language === 'bn'
                              ? 'রিকোয়েস্ট প্রত্যাখ্যান করা যায়নি।'
                              : 'Failed to decline request.'
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                    >
                      {language === 'bn' ? 'প্রত্যাখ্যান' : 'Decline'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleAcceptRequest}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      <span>{language === 'bn' ? 'একসেপ্ট করুন' : 'Accept & Chat'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-amber-300 flex items-center justify-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>
                      {language === 'bn'
                        ? 'একসেপ্ট করার পর চ্যাট ও কল চালু হবে'
                        : 'Pending approval — chat opens once accepted'}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setErrorMsg(null);
                      try {
                        await cancelFriendRequest(friendshipState.id);
                        setFriendshipState(null);
                        setAutoSentBanner(false);
                      } catch (err) {
                        setErrorMsg(
                          err instanceof Error
                            ? err.message
                            : language === 'bn'
                            ? 'রিকোয়েস্ট বাতিল করা যায়নি।'
                            : 'Failed to cancel request.'
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 text-xs font-semibold cursor-pointer transition"
                  >
                    {language === 'bn' ? 'রিকোয়েস্ট বাতিল করুন' : 'Cancel Request'}
                  </button>
                </div>
              )
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={handleSendFriendRequest}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition shadow"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                <span>{language === 'bn' ? 'ফ্রেন্ড রিকোয়েস্ট পাঠান' : 'Send Friend Request'}</span>
              </button>
            )}
          </div>
        ) : publicGroup ? (
          <div className="space-y-4 text-center pt-2">
            <img
              src={
                publicGroup.groupPhoto ||
                `https://api.dicebear.com/7.x/identicon/svg?seed=${publicGroup.groupId}&backgroundColor=0f172a`
              }
              alt={publicGroup.name}
              className="w-20 h-20 rounded-2xl object-cover mx-auto bg-slate-800 border-2 border-emerald-500/40 shadow-lg"
            />
            <div>
              <h3 className="text-base font-bold text-white">{publicGroup.name}</h3>
              <div className="flex items-center justify-center gap-2 mt-1.5 text-[11px]">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                  <Globe className="w-3 h-3" />
                  <span>{language === 'bn' ? 'পাবলিক গ্রুপ' : 'Public Group'}</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                  <Users className="w-3 h-3" />
                  <span>{publicGroup.memberCount}</span>
                </span>
              </div>
              {publicGroup.description && (
                <p className="text-xs text-slate-400 mt-2">{publicGroup.description}</p>
              )}
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200">
                {errorMsg}
              </div>
            )}

            {isAlreadyMember ? (
              <button
                type="button"
                onClick={() => {
                  const found = existingChats.find((c) => c.id === publicGroup.groupId);
                  if (found) onOpenChat(found);
                  onClose();
                }}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition"
              >
                <MessageSquare className="w-4 h-4" />
                <span>{language === 'bn' ? 'গ্রুপ চ্যাট খুলুন' : 'Open Group Chat'}</span>
              </button>
            ) : publicGroup.joinPolicy === 'direct' ? (
              <button
                type="button"
                disabled={busy}
                onClick={handleJoinDirectGroup}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition shadow"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                <span>{language === 'bn' ? 'গ্রুপে যোগ দিন' : 'Join Public Group'}</span>
              </button>
            ) : joinRequest?.status === 'pending' ? (
              <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-500/30 text-xs text-amber-200 flex items-center justify-center gap-2">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  {language === 'bn'
                    ? 'জয়েন রিকোয়েস্ট পাঠানো হয়েছে। অ্যাডমিন একসেপ্ট করলে গ্রুপ খুলবে।'
                    : 'Join request sent. Waiting for group admin approval.'}
                </span>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span>
                    {language === 'bn'
                      ? 'এই গ্রুপে যোগ দিতে অ্যাডমিনের অনুমোদন প্রয়োজন'
                      : 'Admin approval is required to join this group'}
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={200}
                  value={joinNote}
                  onChange={(e) => setJoinNote(e.target.value)}
                  placeholder={language === 'bn' ? 'ছোট বার্তা (ঐচ্ছিক)...' : 'Optional note for admins...'}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleRequestApprovalGroup}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  <span>{language === 'bn' ? 'জয়েন রিকোয়েস্ট পাঠান' : 'Request to Join Group'}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center space-y-3">
            <ShieldAlert className="w-10 h-10 text-amber-400 mx-auto" />
            <p className="text-xs text-slate-300 leading-relaxed">
              {errorMsg || (language === 'bn' ? 'লিংকটি লোড করা যায়নি।' : 'Unable to resolve this link.')}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white cursor-pointer"
            >
              {language === 'bn' ? 'বন্ধ করুন' : 'Close'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
