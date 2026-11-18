import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useModalHistory } from '../hooks/useModalHistory';
import {
  searchDirectoryUsers,
  getOrCreateDirectChat,
  createGroupChat,
  formatLastSeenStatus,
  sendFriendRequest,
  acceptFriendRequest,
  cancelFriendRequest,
  getFriendshipId,
  searchPublicGroups,
  joinPublicGroupDirect,
  requestToJoinPublicGroup,
} from '../services/chatService';
import type {
  UserProfile,
  ChatRoom,
  Friendship,
  PublicGroupSummary,
  GroupVisibility,
  GroupJoinPolicy,
} from '../types/chat';
import {
  X,
  Search,
  UserPlus,
  Users,
  Check,
  MessageSquare,
  Loader2,
  Phone,
  Video,
  QrCode,
  ShieldCheck,
  Globe,
  Lock,
  Clock,
  ScanLine,
  ShieldBan,
} from 'lucide-react';

interface NewChatModalProps {
  existingChats: ChatRoom[];
  friendships: Friendship[];
  onClose: () => void;
  onSelectChat: (chat: ChatRoom) => void;
  onStartDirectCall?: (chat: ChatRoom, partner: UserProfile, type: 'audio' | 'video') => void;
  onOpenShareQR?: () => void;
  onOpenQrScanner?: () => void;
}

export function NewChatModal({
  existingChats,
  friendships,
  onClose,
  onSelectChat,
  onStartDirectCall,
  onOpenShareQR,
  onOpenQrScanner,
}: NewChatModalProps) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [mode, setMode] = useState<'direct' | 'group' | 'public_groups'>('direct');

  // Group creation states
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupVisibility, setGroupVisibility] = useState<GroupVisibility>('private');
  const [groupJoinPolicy, setGroupJoinPolicy] = useState<'direct' | 'approval'>('direct');
  const [selectedUsers, setSelectedUsers] = useState<UserProfile[]>([]);

  // Public groups discovery states
  const [publicGroups, setPublicGroups] = useState<PublicGroupSummary[]>([]);
  const [loadingPublicGroups, setLoadingPublicGroups] = useState(false);
  const [requestedGroupIds, setRequestedGroupIds] = useState<Record<string, boolean>>({});
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useModalHistory(true, onClose);

  const friendshipByPartnerId = useMemo(() => {
    const map = new Map<string, Friendship>();
    if (!user) return map;
    for (const f of friendships) {
      const otherId = f.userIds.find((id) => id !== user.userId);
      if (otherId) map.set(otherId, f);
    }
    return map;
  }, [friendships, user]);

  // Strictly accepted friends (required for Private & Public group member selection)
  const acceptedFriends = useMemo<UserProfile[]>(() => {
    if (!user) return [];
    const list: UserProfile[] = [];
    for (const f of friendships) {
      if (f.status !== 'accepted') continue;
      const isRequester = f.requesterId === user.userId;
      const partnerId = isRequester ? f.receiverId : f.requesterId;
      const preview = isRequester ? f.receiverProfile : f.requesterProfile;
      list.push({
        userId: partnerId,
        displayName: preview?.displayName || 'Friend',
        email: '',
        photoURL: preview?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${partnerId}`,
        username: preview?.username,
        createdAt: f.createdAt,
      });
    }
    return list;
  }, [friendships, user]);

  // Accepted friends + legacy active direct chats (excluding declined/blocked/pending)
  const directConnections = useMemo<UserProfile[]>(() => {
    if (!user) return [];
    const map = new Map<string, UserProfile>();
    acceptedFriends.forEach((f) => map.set(f.userId, f));

    for (const chat of existingChats) {
      if (chat.type !== 'direct') continue;
      const partnerId = chat.participantIds.find((id) => id !== user.userId);
      if (!partnerId || map.has(partnerId)) continue;
      const rel = friendshipByPartnerId.get(partnerId);
      if (rel && rel.status !== 'accepted') continue;
      const details = chat.participantDetails?.[partnerId];
      if (!details || details.status === 'scheduled_for_deletion' || details.status === 'deleted') continue;
      map.set(partnerId, {
        userId: partnerId,
        displayName: details.displayName || 'User',
        email: '',
        photoURL: details.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${partnerId}`,
        isBanned: details.isBanned,
        status: details.status || 'active',
        createdAt: chat.updatedAt,
      });
    }
    return Array.from(map.values());
  }, [acceptedFriends, existingChats, friendshipByPartnerId, user]);

  // Privacy-first user directory search in Direct tab (>= 2 chars)
  useEffect(() => {
    if (!user || mode !== 'direct') {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    const trimmed = search.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const matches = await searchDirectoryUsers(user.userId, trimmed);
        if (!cancelled) {
          setSearchResults(matches);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, user, mode]);

  // Public groups search when on 'public_groups' tab
  useEffect(() => {
    if (mode !== 'public_groups') return;
    let cancelled = false;
    setLoadingPublicGroups(true);
    const timer = setTimeout(async () => {
      try {
        const list = await searchPublicGroups(search);
        if (!cancelled) setPublicGroups(list);
      } finally {
        if (!cancelled) setLoadingPublicGroups(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mode, search]);

  const isSearchActive = search.trim().length >= 2;
  const displayedDirectUsers = isSearchActive ? searchResults : directConnections;
  const filteredFriendsForGroup = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return acceptedFriends;
    return acceptedFriends.filter(
      (f) =>
        f.displayName.toLowerCase().includes(q) ||
        (f.username || '').toLowerCase().includes(q)
    );
  }, [acceptedFriends, search]);

  const existingDirectPartnerIds = useMemo(() => {
    const set = new Set<string>();
    if (!user) return set;
    existingChats.forEach((c) => {
      if (c.type === 'direct') {
        const pid = c.participantIds.find((id) => id !== user.userId);
        if (pid) set.add(pid);
      }
    });
    return set;
  }, [existingChats, user]);

  const canChatDirectly = (partnerId: string): boolean => {
    const rel = friendshipByPartnerId.get(partnerId);
    if (rel) return rel.status === 'accepted';
    return existingDirectPartnerIds.has(partnerId);
  };

  const handleStartDirectChat = async (partner: UserProfile, callType?: 'audio' | 'video') => {
    if (!user || creating || partner.isBanned || !canChatDirectly(partner.userId)) return;
    setCreating(true);
    setActionFeedback(null);
    try {
      const room = await getOrCreateDirectChat(user, partner);
      if (callType && onStartDirectCall) {
        onStartDirectCall(room, partner, callType);
      } else {
        onSelectChat(room);
      }
      onClose();
    } catch (err) {
      setActionFeedback(err instanceof Error ? err.message : 'Unable to start chat.');
    } finally {
      setCreating(false);
    }
  };

  const handleSendFriendRequest = async (partner: UserProfile) => {
    if (!user || busyActionId) return;
    setBusyActionId(partner.userId);
    setActionFeedback(null);
    try {
      await sendFriendRequest(user, partner, 'search');
      setActionFeedback(
        language === 'bn'
          ? `${partner.displayName}-কে ফ্রেন্ড রিকোয়েস্ট পাঠানো হয়েছে। একসেপ্ট করলে চ্যাট শুরু হবে।`
          : `Friend request sent to ${partner.displayName}.`
      );
    } catch (err) {
      setActionFeedback(err instanceof Error ? err.message : 'Could not send request.');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleAcceptRequest = async (friendship: Friendship, partner: UserProfile) => {
    if (!user || busyActionId) return;
    setBusyActionId(partner.userId);
    setActionFeedback(null);
    try {
      await acceptFriendRequest(friendship.id, user);
      const room = await getOrCreateDirectChat(user, partner);
      onSelectChat(room);
      onClose();
    } catch (err) {
      setActionFeedback(err instanceof Error ? err.message : 'Could not accept request.');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleCancelRequest = async (partnerId: string) => {
    if (!user || busyActionId) return;
    setBusyActionId(partnerId);
    setActionFeedback(null);
    try {
      await cancelFriendRequest(getFriendshipId(user.userId, partnerId));
    } catch (err) {
      setActionFeedback(err instanceof Error ? err.message : 'Could not cancel request.');
    } finally {
      setBusyActionId(null);
    }
  };

  const toggleSelectUser = (target: UserProfile) => {
    setSelectedUsers((prev) => {
      if (prev.some((u) => u.userId === target.userId)) {
        return prev.filter((u) => u.userId !== target.userId);
      }
      return [...prev, target];
    });
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !groupName.trim() || creating) return;
    if (groupVisibility === 'private' && selectedUsers.length === 0) return;

    setCreating(true);
    setActionFeedback(null);
    try {
      const joinPolicy: GroupJoinPolicy =
        groupVisibility === 'public' ? groupJoinPolicy : 'invite_only';
      const room = await createGroupChat(user, groupName.trim(), selectedUsers, {
        visibility: groupVisibility,
        joinPolicy,
        description: groupDesc,
      });
      onSelectChat(room);
      onClose();
    } catch (err) {
      setActionFeedback(err instanceof Error ? err.message : 'Failed to create group.');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinPublicGroup = async (g: PublicGroupSummary) => {
    if (!user || busyActionId) return;
    const existingMemberChat = existingChats.find((c) => c.id === g.groupId);
    if (existingMemberChat) {
      onSelectChat(existingMemberChat);
      onClose();
      return;
    }

    setBusyActionId(g.groupId);
    setActionFeedback(null);
    try {
      if (g.joinPolicy === 'direct') {
        const room = await joinPublicGroupDirect(g.groupId, user);
        onSelectChat(room);
        onClose();
      } else {
        await requestToJoinPublicGroup(g.groupId, user);
        setRequestedGroupIds((prev) => ({ ...prev, [g.groupId]: true }));
        setActionFeedback(
          language === 'bn'
            ? `"${g.name}" গ্রুপে জয়েন রিকোয়েস্ট পাঠানো হয়েছে। অ্যাডমিন একসেপ্ট করলে চ্যাট তালিকা দেখতে পাবেন।`
            : `Join request sent to "${g.name}".`
        );
      }
    } catch (err) {
      setActionFeedback(
        err instanceof Error
          ? err.message
          : language === 'bn'
          ? 'গ্রুপে যোগ দেওয়া যায়নি।'
          : 'Unable to join public group.'
      );
    } finally {
      setBusyActionId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl relative max-h-[92vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-3">
          <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-400" /> {t('newChatHeader')}
          </h3>
          <div className="grid grid-cols-3 bg-slate-950/70 p-1 rounded-xl text-[11px] border border-slate-800 gap-1">
            <button
              type="button"
              onClick={() => {
                setMode('direct');
                setActionFeedback(null);
              }}
              className={`py-1.5 px-1 rounded-lg font-medium transition cursor-pointer flex items-center justify-center gap-1 ${
                mode === 'direct' ? 'bg-slate-800 text-white font-semibold shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="truncate">{language === 'bn' ? 'বন্ধু / সার্চ' : 'Direct'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('group');
                setActionFeedback(null);
              }}
              className={`py-1.5 px-1 rounded-lg font-medium transition cursor-pointer flex items-center justify-center gap-1 ${
                mode === 'group' ? 'bg-slate-800 text-white font-semibold shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span className="truncate">{t('newGroupTab')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('public_groups');
                setActionFeedback(null);
              }}
              className={`py-1.5 px-1 rounded-lg font-medium transition cursor-pointer flex items-center justify-center gap-1 ${
                mode === 'public_groups' ? 'bg-slate-800 text-white font-semibold shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="truncate">{language === 'bn' ? 'পাবলিক গ্রুপ' : 'Public Groups'}</span>
            </button>
          </div>
        </div>

        {/* Group Settings Header inside Group Mode */}
        {mode === 'group' && (
          <div className="mb-3 space-y-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">{t('groupNameLabel')}</label>
              <input
                type="text"
                required
                placeholder={t('groupNamePlaceholder')}
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                maxLength={100}
              />
            </div>

            <input
              type="text"
              placeholder={language === 'bn' ? 'গ্রুপের সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)...' : 'Group description (optional)...'}
              value={groupDesc}
              onChange={(e) => setGroupDesc(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              maxLength={300}
            />

            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => setGroupVisibility('private')}
                className={`py-1.5 px-2.5 rounded-xl border font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                  groupVisibility === 'private'
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'প্রাইভেট গ্রুপ' : 'Private Group'}</span>
              </button>
              <button
                type="button"
                onClick={() => setGroupVisibility('public')}
                className={`py-1.5 px-2.5 rounded-xl border font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                  groupVisibility === 'public'
                    ? 'bg-sky-500/15 border-sky-500/50 text-sky-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'পাবলিক গ্রুপ' : 'Public Group'}</span>
              </button>
            </div>

            {groupVisibility === 'public' ? (
              <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-semibold text-slate-400 block">
                  {language === 'bn' ? 'নতুন সদস্য কীভাবে জয়েন করবে?' : 'How new members join:'}
                </span>
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setGroupJoinPolicy('direct')}
                    className={`py-1.5 px-2 rounded-lg border font-medium cursor-pointer transition ${
                      groupJoinPolicy === 'direct'
                        ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    {language === 'bn' ? 'সরাসরি জয়েন' : 'Direct Join'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupJoinPolicy('approval')}
                    className={`py-1.5 px-2 rounded-lg border font-medium cursor-pointer transition ${
                      groupJoinPolicy === 'approval'
                        ? 'bg-amber-600/20 border-amber-500/40 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    {language === 'bn' ? 'অ্যাডমিন অনুমোদন' : 'Admin Approval'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-slate-400 px-0.5">
                {language === 'bn'
                  ? 'প্রাইভেট গ্রুপ শুধু অ্যাডমিন সদস্য এড করতে পারবেন এবং পাবলিক সার্চে দেখা যাবে না।'
                  : 'Private groups are hidden from search and only admins can add friends.'}
              </p>
            )}
          </div>
        )}

        {/* Smart Search Bar */}
        <div className="relative mb-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            autoFocus={mode !== 'group'}
            placeholder={
              mode === 'public_groups'
                ? language === 'bn'
                  ? 'পাবলিক গ্রুপের নাম বা আইডি লিখে খুঁজুন...'
                  : 'Search public groups by name...'
                : mode === 'group'
                ? language === 'bn'
                  ? 'ফ্রেন্ড তালিকা থেকে সদস্য ফিল্টার করুন...'
                  : 'Filter your accepted friends...'
                : language === 'bn'
                ? '@ইউজারনেম, নাম, মোবাইল নম্বর বা চ্যাট লিংক...'
                : 'Search @username, name, mobile or link...'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Section Header + QR Shortcuts */}
        <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
          <span className="text-[11px] font-semibold text-slate-400">
            {mode === 'public_groups'
              ? language === 'bn'
                ? 'সক্রিয় পাবলিক গ্রুপ'
                : 'Active Public Groups'
              : mode === 'group'
              ? language === 'bn'
                ? `আপনার ফ্রেন্ড লিস্ট (${acceptedFriends.length})`
                : `Your Friends (${acceptedFriends.length})`
              : isSearchActive
              ? language === 'bn'
                ? 'সার্চ ফলাফল'
                : 'Search Results'
              : language === 'bn'
              ? 'আমার ফ্রেন্ডস ও চ্যাট'
              : 'My Friends & Chats'}
          </span>

          <div className="flex items-center gap-3">
            {onOpenQrScanner && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenQrScanner();
                }}
                className="text-[11px] text-sky-400 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
              >
                <ScanLine className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'QR স্ক্যান' : 'Scan QR'}</span>
              </button>
            )}
            {onOpenShareQR && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenShareQR();
                }}
                className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'আমার QR' : 'My QR'}</span>
              </button>
            )}
          </div>
        </div>

        {actionFeedback && (
          <div className="mb-2 p-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-[11px] text-emerald-200 flex items-center justify-between gap-2">
            <span>{actionFeedback}</span>
            <button
              type="button"
              onClick={() => setActionFeedback(null)}
              className="text-emerald-300 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Selected Chips in Group Mode */}
        {mode === 'group' && selectedUsers.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2 max-h-16 overflow-y-auto">
            {selectedUsers.map((sel) => (
              <span
                key={sel.userId}
                onClick={() => toggleSelectUser(sel)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[11px] text-emerald-300 cursor-pointer hover:bg-rose-500/15 hover:text-rose-300 hover:border-rose-500/30 transition"
              >
                <span>{sel.displayName}</span>
                <X className="w-3 h-3" />
              </span>
            ))}
          </div>
        )}

        {/* List Body */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-[175px] max-h-[290px]">
          {mode === 'public_groups' ? (
            loadingPublicGroups ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mb-2" />
                <span className="text-xs">
                  {language === 'bn' ? 'পাবলিক গ্রুপ খোঁজা হচ্ছে...' : 'Loading public groups...'}
                </span>
              </div>
            ) : publicGroups.length === 0 ? (
              <div className="text-center py-8 px-4 text-slate-400 space-y-2">
                <Globe className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs font-semibold text-slate-300">
                  {language === 'bn' ? 'কোনো পাবলিক গ্রুপ পাওয়া যায়নি' : 'No public groups found'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {language === 'bn'
                    ? 'আপনি "নতুন গ্রুপ" ট্যাব থেকে চাইলে নতুন পাবলিক গ্রুপ তৈরি করতে পারেন।'
                    : 'Create your own public group from the New Group tab.'}
                </p>
              </div>
            ) : (
              publicGroups.map((g) => {
                const alreadyJoined = existingChats.some((c) => c.id === g.groupId);
                const isRequested = Boolean(requestedGroupIds[g.groupId]);
                const isBusy = busyActionId === g.groupId;
                return (
                  <div
                    key={g.groupId}
                    className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={
                          g.groupPhoto ||
                          `https://api.dicebear.com/7.x/identicon/svg?seed=${g.groupId}&backgroundColor=0f172a`
                        }
                        alt={g.name}
                        className="w-9 h-9 rounded-xl object-cover bg-slate-900 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{g.name}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                          <span>{g.memberCount} {language === 'bn' ? 'সদস্য' : 'members'}</span>
                          <span>·</span>
                          <span className={g.joinPolicy === 'direct' ? 'text-emerald-400' : 'text-amber-400'}>
                            {g.joinPolicy === 'direct'
                              ? language === 'bn'
                                ? 'সরাসরি জয়েন'
                                : 'Direct Join'
                              : language === 'bn'
                              ? 'অ্যাডমিন অনুমোদন'
                              : 'Approval'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isBusy || isRequested}
                      onClick={() => handleJoinPublicGroup(g)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold shrink-0 cursor-pointer transition flex items-center gap-1 ${
                        alreadyJoined
                          ? 'bg-slate-700 hover:bg-slate-600 text-white'
                          : isRequested
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 cursor-default'
                          : g.joinPolicy === 'direct'
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-sky-600 hover:bg-sky-500 text-white'
                      }`}
                    >
                      {isBusy && <Loader2 className="w-3 h-3 animate-spin" />}
                      <span>
                        {alreadyJoined
                          ? language === 'bn'
                            ? 'চ্যাট খুলুন'
                            : 'Open'
                          : isRequested
                          ? language === 'bn'
                            ? 'রিকোয়েস্ট পাঠানো'
                            : 'Requested'
                          : g.joinPolicy === 'direct'
                          ? language === 'bn'
                            ? 'জয়েন করুন'
                            : 'Join'
                          : language === 'bn'
                          ? 'রিকোয়েস্ট'
                          : 'Request'}
                      </span>
                    </button>
                  </div>
                );
              })
            )
          ) : mode === 'group' ? (
            filteredFriendsForGroup.length === 0 ? (
              <div className="text-center py-7 px-4 text-slate-400 space-y-2">
                <Users className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs font-semibold text-slate-200">
                  {acceptedFriends.length === 0
                    ? language === 'bn'
                      ? 'গ্রুপে এড করার জন্য আপনার ফ্রেন্ড লিস্টে এখনো কেউ নেই'
                      : 'No accepted friends to add yet'
                    : language === 'bn'
                    ? 'কোনো ফ্রেন্ড পাওয়া যায়নি'
                    : 'No matching friends'}
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {language === 'bn'
                    ? 'গ্রুপ তৈরি করতে কেবল নিজের ফ্রেন্ড তালিকা থেকেই সদস্য নেওয়া যাবে। প্রাইভেট গ্রুপের আগে বন্ধু যুক্ত করুন বা পাবলিক গ্রুপ তৈরি করুন।'
                    : 'Only accepted friends can be added to a group. Add friends first or create a Public Group.'}
                </p>
              </div>
            ) : (
              filteredFriendsForGroup.map((u) => {
                const isSelected = selectedUsers.some((s) => s.userId === u.userId);
                return (
                  <div
                    key={u.userId}
                    onClick={() => toggleSelectUser(u)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl transition border cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-950/60 border-emerald-500/50'
                        : 'bg-slate-800/40 hover:bg-slate-800 border-slate-700/50'
                    }`}
                  >
                    <img
                      src={u.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.userId}`}
                      alt={u.displayName}
                      className="w-9 h-9 rounded-full bg-slate-700 object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{u.displayName}</div>
                      {u.username && (
                        <div className="text-[11px] text-emerald-400 font-mono truncate">@{u.username}</div>
                      )}
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center border transition shrink-0 ${
                        isSelected
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-slate-600 bg-slate-700/50'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                );
              })
            )
          ) : searching ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mb-2" />
              <span className="text-xs">{t('findingUsers')}</span>
            </div>
          ) : displayedDirectUsers.length === 0 ? (
            <div className="text-center py-7 px-4 text-slate-400 space-y-2.5">
              <div className="mx-auto w-10 h-10 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-slate-200">
                {isSearchActive
                  ? language === 'bn'
                    ? 'এই নামে বা নম্বরে কোনো ইউজার পাওয়া যায়নি'
                    : 'No matching user found'
                  : language === 'bn'
                  ? 'বন্ধুকে খুঁজতে ওপরে সার্চ করুন বা QR স্ক্যান করুন'
                  : 'Search above or scan QR to add friends'}
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {isSearchActive
                  ? language === 'bn'
                    ? 'সঠিক @ইউজারনেম, বন্ধুর সম্পূর্ণ মোবাইল নম্বর, অথবা শেয়ার করা লিংক দিয়ে খুঁজুন।'
                    : 'Try exact @username, full mobile number, display name, or personal link.'
                  : language === 'bn'
                  ? 'রিকোয়েস্ট একসেপ্ট হওয়ার পর এখানে চ্যাট ও কলের জন্য ফ্রেন্ড লিস্ট দেখতে পাবেন।'
                  : 'Once your friend requests are accepted, your friends appear here for instant chat & calls.'}
              </p>
            </div>
          ) : (
            displayedDirectUsers.map((u) => {
              const isSuspended = Boolean(u.isBanned);
              const presence = formatLastSeenStatus(u.lastSeen, u.isOnline);
              const rel = friendshipByPartnerId.get(u.userId);
              const isFriend = canChatDirectly(u.userId);
              const isBlocked = rel?.status === 'blocked';
              const isPending = rel?.status === 'pending';
              const isIncomingPending = isPending && rel?.receiverId === user?.userId;
              const isOutgoingPending = isPending && rel?.requesterId === user?.userId;
              const isBusy = busyActionId === u.userId;

              return (
                <div
                  key={u.userId}
                  onClick={() => {
                    if (isSuspended || isBlocked) return;
                    if (isFriend) {
                      handleStartDirectChat(u);
                    }
                  }}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl transition border ${
                    isSuspended || isBlocked
                      ? 'opacity-65 cursor-not-allowed bg-slate-800/20 border-slate-800'
                      : isFriend
                      ? 'bg-slate-800/40 hover:bg-slate-800 border-slate-700/50 cursor-pointer'
                      : 'bg-slate-900/70 border-slate-800'
                  }`}
                >
                  <div className="relative shrink-0">
                    <img
                      src={u.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.userId}`}
                      alt={u.displayName}
                      className="w-9 h-9 rounded-full bg-slate-700 object-cover"
                    />
                    {presence.isOnline && !isSuspended && isFriend && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-900 rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                      <span className="truncate">{u.displayName}</span>
                      {isSuspended && (
                        <span className="px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold shrink-0">
                          {t('userUnavailableBadge')}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {u.username ? `@${u.username}` : u.about || ''}
                    </div>
                  </div>

                  {!isSuspended && (
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {isBlocked ? (
                        <span className="px-2 py-1 rounded-lg bg-rose-500/15 text-rose-300 text-[10px] font-bold flex items-center gap-1">
                          <ShieldBan className="w-3 h-3" />
                          <span>{language === 'bn' ? 'ব্লকড' : 'Blocked'}</span>
                        </span>
                      ) : isFriend ? (
                        <>
                          {onStartDirectCall && (
                            <>
                              <button
                                type="button"
                                disabled={creating}
                                onClick={() => handleStartDirectChat(u, 'audio')}
                                title={t('audioCall')}
                                className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-emerald-600 text-slate-300 hover:text-white border border-slate-700/70 transition cursor-pointer"
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={creating}
                                onClick={() => handleStartDirectChat(u, 'video')}
                                title={t('videoCall')}
                                className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-emerald-600 text-slate-300 hover:text-white border border-slate-700/70 transition cursor-pointer"
                              >
                                <Video className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </>
                      ) : isIncomingPending && rel ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleAcceptRequest(rel, u)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                        >
                          {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          <span>{language === 'bn' ? 'একসেপ্ট' : 'Accept'}</span>
                        </button>
                      ) : isOutgoingPending ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleCancelRequest(u.userId)}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-rose-500/20 text-amber-300 hover:text-rose-300 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
                          title={language === 'bn' ? 'রিকোয়েস্ট বাতিল করুন' : 'Cancel request'}
                        >
                          {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
                          <span>{language === 'bn' ? 'পেন্ডিং' : 'Pending'}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleSendFriendRequest(u)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                        >
                          {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                          <span>{language === 'bn' ? 'রিকোয়েস্ট' : 'Add Friend'}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {mode === 'group' && (
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between mt-2">
            <span className="text-xs text-slate-400">
              {t('participantCount', { count: selectedUsers.length })}
            </span>
            <button
              onClick={handleCreateGroup}
              disabled={
                creating ||
                !groupName.trim() ||
                (groupVisibility === 'private' && selectedUsers.length === 0)
              }
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>{t('createGroupBtn')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
