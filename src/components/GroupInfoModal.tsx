import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Users,
  Shield,
  Crown,
  UserPlus,
  UserMinus,
  LogOut,
  Trash2,
  Pencil,
  Check,
  Search,
  MoreVertical,
  Loader2,
  AlertTriangle,
  Globe,
  Lock,
  QrCode,
  Clock,
  SlidersHorizontal,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import type {
  ChatRoom,
  Friendship,
  GroupJoinPolicy,
  GroupJoinRequest,
  GroupVisibility,
  UserProfile,
} from '../types/chat';
import {
  addGroupMembers,
  removeGroupMember,
  makeGroupAdmin,
  dismissGroupAdmin,
  leaveGroupChat,
  deleteGroupChatPermanently,
  updateGroupTitle,
  subscribeToGroupJoinRequests,
  approveGroupJoinRequest,
  declineGroupJoinRequest,
  updateGroupSettings,
} from '../services/chatService';

interface GroupInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  chat: ChatRoom;
  currentUser: UserProfile;
  friendships?: Friendship[];
  onLeaveGroup?: () => void;
  onDeleteGroup?: () => void;
  onOpenGroupShareQR?: (chat: ChatRoom) => void;
}

export const GroupInfoModal: React.FC<GroupInfoModalProps> = ({
  isOpen,
  onClose,
  chat,
  currentUser,
  friendships = [],
  onLeaveGroup,
  onDeleteGroup,
  onOpenGroupShareQR,
}) => {
  const { t, language } = useLanguage();

  const [searchMemberQuery, setSearchMemberQuery] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(chat.name || '');
  const [activeMemberMenu, setActiveMemberMenu] = useState<string | null>(null);

  // Friends-only Add Member sub-flow (Admin only)
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [selectedUsersMap, setSelectedUsersMap] = useState<Record<string, UserProfile>>({});
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Admin Privacy & Join Policy Settings
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);
  const [editVisibility, setEditVisibility] = useState<GroupVisibility>(
    chat.visibility === 'public' ? 'public' : 'private'
  );
  const [editJoinPolicy, setEditJoinPolicy] = useState<'direct' | 'approval'>(
    chat.joinPolicy === 'approval' ? 'approval' : 'direct'
  );
  const [editDescription, setEditDescription] = useState(chat.description || '');
  const [savingSettings, setSavingSettings] = useState(false);

  // Public Group Join Requests (Admin only)
  const [joinRequests, setJoinRequests] = useState<GroupJoinRequest[]>([]);
  const [busyReqId, setBusyReqId] = useState<string | null>(null);

  // Confirm dialogs
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [banOnRemove, setBanOnRemove] = useState(false);

  const isCreator = chat.creatorId === currentUser.userId;
  const isCurrentUserAdmin =
    isCreator || (chat.adminIds || []).includes(currentUser.userId);

  useEffect(() => {
    setEditedTitle(chat.name || '');
    setEditVisibility(chat.visibility === 'public' ? 'public' : 'private');
    setEditJoinPolicy(chat.joinPolicy === 'approval' ? 'approval' : 'direct');
    setEditDescription(chat.description || '');
  }, [chat.name, chat.visibility, chat.joinPolicy, chat.description]);

  // Subscribe to pending join requests for admins of public groups
  useEffect(() => {
    if (!isOpen || !isCurrentUserAdmin || chat.visibility !== 'public') {
      setJoinRequests([]);
      return;
    }
    const unsub = subscribeToGroupJoinRequests(chat.id, (reqs) => {
      setJoinRequests(reqs);
    });
    return () => unsub();
  }, [isOpen, isCurrentUserAdmin, chat.id, chat.visibility]);

  // Close nested dialogs or modal on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirmLeave) {
        setConfirmLeave(false);
      } else if (confirmDelete) {
        setConfirmDelete(false);
      } else if (confirmRemoveId) {
        setConfirmRemoveId(null);
      } else if (showAddMembers) {
        setShowAddMembers(false);
      } else if (showPrivacySettings) {
        setShowPrivacySettings(false);
      } else if (isEditingTitle) {
        setIsEditingTitle(false);
      } else {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    confirmLeave,
    confirmDelete,
    confirmRemoveId,
    showAddMembers,
    showPrivacySettings,
    isEditingTitle,
    onClose,
  ]);

  // Strictly accepted friends NOT already in this group
  const availableFriends = useMemo<UserProfile[]>(() => {
    const existingSet = new Set(chat.participantIds || []);
    const list: UserProfile[] = [];
    for (const f of friendships) {
      if (f.status !== 'accepted') continue;
      const isReq = f.requesterId === currentUser.userId;
      const partnerId = isReq ? f.receiverId : f.requesterId;
      if (!partnerId || existingSet.has(partnerId)) continue;
      const preview = isReq ? f.receiverProfile : f.requesterProfile;
      list.push({
        userId: partnerId,
        displayName: preview?.displayName || 'Friend',
        email: '',
        photoURL: preview?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${partnerId}`,
        username: preview?.username,
        createdAt: f.createdAt,
      });
    }
    const q = userSearchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q)
    );
  }, [friendships, chat.participantIds, currentUser.userId, userSearchQuery]);

  if (!isOpen) return null;

  const memberIds = chat.participantIds || [];
  const filteredMemberIds = memberIds.filter((uid) => {
    if (!searchMemberQuery.trim()) return true;
    const details = chat.participantDetails?.[uid];
    const name = details?.displayName?.toLowerCase() || '';
    const email = details?.email?.toLowerCase() || '';
    const q = searchMemberQuery.toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  const handleSaveTitle = async () => {
    if (!editedTitle.trim() || editedTitle.trim() === chat.name) {
      setIsEditingTitle(false);
      return;
    }
    try {
      await updateGroupTitle(chat.id, editedTitle.trim());
      setIsEditingTitle(false);
    } catch (err) {
      console.error('Failed to update group title:', err);
    }
  };

  const handleSavePrivacySettings = async () => {
    if (savingSettings) return;
    setSavingSettings(true);
    try {
      const nextPolicy: GroupJoinPolicy =
        editVisibility === 'public' ? editJoinPolicy : 'invite_only';
      await updateGroupSettings(chat.id, {
        description: editDescription,
        visibility: editVisibility,
        joinPolicy: nextPolicy,
      });
      setShowPrivacySettings(false);
    } catch (err) {
      console.error('Failed to update group privacy settings:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleMakeAdmin = async (targetId: string) => {
    setActiveMemberMenu(null);
    try {
      await makeGroupAdmin(chat.id, targetId);
    } catch (err) {
      console.error('Failed to make admin:', err);
    }
  };

  const handleDismissAdmin = async (targetId: string) => {
    setActiveMemberMenu(null);
    try {
      await dismissGroupAdmin(chat.id, targetId);
    } catch (err) {
      console.error('Failed to dismiss admin:', err);
    }
  };

  const handleConfirmRemove = async () => {
    if (!confirmRemoveId) return;
    try {
      await removeGroupMember(chat.id, confirmRemoveId, currentUser.displayName, banOnRemove);
      setConfirmRemoveId(null);
      setBanOnRemove(false);
      setActiveMemberMenu(null);
    } catch (err) {
      console.error('Failed to remove member:', err);
    }
  };

  const selectedUserIds = Object.keys(selectedUsersMap);

  const toggleSelectAddMember = (target: UserProfile) => {
    setSelectedUsersMap((prev) => {
      const next = { ...prev };
      if (next[target.userId]) {
        delete next[target.userId];
      } else {
        next[target.userId] = target;
      }
      return next;
    });
  };

  const handleAddMembersSubmit = async () => {
    const usersToAdd = Object.values(selectedUsersMap);
    if (usersToAdd.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      await addGroupMembers(chat.id, usersToAdd, currentUser.displayName);
      setShowAddMembers(false);
      setSelectedUsersMap({});
      setUserSearchQuery('');
    } catch (err) {
      console.error('Failed to add members:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecuteLeave = async () => {
    try {
      await leaveGroupChat(chat.id, currentUser.userId, currentUser.displayName);
      setConfirmLeave(false);
      onClose();
      if (onLeaveGroup) onLeaveGroup();
    } catch (err) {
      console.error('Failed to leave group:', err);
    }
  };

  const handleExecuteDelete = async () => {
    try {
      await deleteGroupChatPermanently(chat.id);
      setConfirmDelete(false);
      onClose();
      if (onDeleteGroup) onDeleteGroup();
    } catch (err) {
      console.error('Failed to delete group:', err);
    }
  };

  const groupAvatar =
    chat.groupPhoto ||
    `https://api.dicebear.com/7.x/identicon/svg?seed=${chat.id}&backgroundColor=0f172a`;
  const isPublic = chat.visibility === 'public';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in select-none">
      <div
        onClick={(e) => {
          e.stopPropagation();
          setActiveMemberMenu(null);
        }}
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/95">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">{t('groupInfoTitle')}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Group Profile Hero Card */}
          <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80">
            <div className="relative mb-3">
              <img
                src={groupAvatar}
                alt={chat.name || 'Group'}
                className="w-20 h-20 rounded-2xl object-cover bg-slate-800 border-2 border-emerald-500/40 shadow-lg"
              />
              <span className="absolute -bottom-1 -right-1 p-1 bg-emerald-500 text-slate-950 rounded-lg shadow">
                {isPublic ? (
                  <Globe className="w-3.5 h-3.5 stroke-[2.5]" />
                ) : (
                  <Lock className="w-3.5 h-3.5 stroke-[2.5]" />
                )}
              </span>
            </div>

            {isEditingTitle && isCurrentUserAdmin ? (
              <div className="flex items-center gap-2 w-full max-w-xs justify-center mb-1">
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="px-3 py-1 bg-slate-900 border border-emerald-500 rounded-xl text-sm font-bold text-white text-center focus:outline-none w-full"
                  autoFocus
                  maxLength={100}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle();
                    if (e.key === 'Escape') setIsEditingTitle(false);
                  }}
                />
                <button
                  onClick={handleSaveTitle}
                  className="p-1.5 rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-1 group">
                <h4 className="text-base font-bold text-white truncate max-w-[280px]">
                  {chat.name || t('filterGroup')}
                </h4>
                {isCurrentUserAdmin && (
                  <button
                    onClick={() => setIsEditingTitle(true)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer opacity-70 group-hover:opacity-100"
                    title={language === 'bn' ? 'নাম পরিবর্তন' : 'Edit Name'}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center justify-center gap-2 flex-wrap mt-1">
              <span className="text-xs text-slate-400 font-medium">
                {t('membersLabel', { count: memberIds.length })}
              </span>
              <span className="text-slate-600">·</span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                  isPublic
                    ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                <span>
                  {isPublic
                    ? chat.joinPolicy === 'approval'
                      ? language === 'bn'
                        ? 'পাবলিক · অনুমোদন সাপেক্ষ'
                        : 'Public · Approval'
                      : language === 'bn'
                      ? 'পাবলিক · সরাসরি জয়েন'
                      : 'Public · Direct Join'
                    : language === 'bn'
                    ? 'প্রাইভেট গ্রুপ'
                    : 'Private Group'}
                </span>
              </span>
            </div>

            {chat.description && (
              <p className="text-xs text-slate-400 mt-2 max-w-sm leading-relaxed">{chat.description}</p>
            )}

            {/* Quick Share Group QR + Admin Privacy Settings */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
              {onOpenGroupShareQR && isPublic && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenGroupShareQR(chat);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>{language === 'bn' ? 'গ্রুপ QR ও লিংক' : 'Share Group QR'}</span>
                </button>
              )}
              {isCurrentUserAdmin && (
                <button
                  type="button"
                  onClick={() => setShowPrivacySettings(!showPrivacySettings)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
                  <span>{language === 'bn' ? 'প্রাইভেসি ও জয়েন পলিসি' : 'Group Privacy'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Admin Privacy Settings Tray */}
          {showPrivacySettings && isCurrentUserAdmin && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-sky-500/40 space-y-3 animate-in slide-in-from-top-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-sky-400">
                  {language === 'bn' ? 'গ্রুপ প্রাইভেসি ও জয়েন সেটিংস' : 'Group Privacy & Join Policy'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPrivacySettings(false)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 font-semibold">
                  {language === 'bn' ? 'গ্রুপের বিবরণ' : 'Description'}
                </label>
                <input
                  type="text"
                  maxLength={300}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder={language === 'bn' ? 'গ্রুপ সম্পর্কে লিখুন...' : 'Describe this group...'}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setEditVisibility('private')}
                  className={`py-2 px-3 rounded-xl border font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                    editVisibility === 'private'
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{language === 'bn' ? 'প্রাইভেট' : 'Private'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditVisibility('public')}
                  className={`py-2 px-3 rounded-xl border font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                    editVisibility === 'public'
                      ? 'bg-sky-500/15 border-sky-500/50 text-sky-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>{language === 'bn' ? 'পাবলিক' : 'Public'}</span>
                </button>
              </div>

              {editVisibility === 'public' && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setEditJoinPolicy('direct')}
                    className={`py-1.5 px-2.5 rounded-xl border font-medium cursor-pointer ${
                      editJoinPolicy === 'direct'
                        ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    {language === 'bn' ? 'সরাসরি জয়েন' : 'Direct Join'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditJoinPolicy('approval')}
                    className={`py-1.5 px-2.5 rounded-xl border font-medium cursor-pointer ${
                      editJoinPolicy === 'approval'
                        ? 'bg-amber-600/20 border-amber-500/40 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    {language === 'bn' ? 'অ্যাডমিন অনুমোদন' : 'Admin Approval'}
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowPrivacySettings(false)}
                  className="px-3 py-1.5 rounded-xl text-xs text-slate-300 hover:bg-slate-900 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  disabled={savingSettings}
                  onClick={handleSavePrivacySettings}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1.5 cursor-pointer"
                >
                  {savingSettings && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{language === 'bn' ? 'সেভ করুন' : 'Save Policy'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Pending Public Join Requests (Admin Only) */}
          {isCurrentUserAdmin && joinRequests.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>
                    {language === 'bn'
                      ? `জয়েন রিকোয়েস্ট (${joinRequests.length})`
                      : `Pending Join Requests (${joinRequests.length})`}
                  </span>
                </span>
              </div>
              <div className="space-y-1.5">
                {joinRequests.map((req) => {
                  const isBusy = busyReqId === req.userId;
                  return (
                    <div
                      key={req.userId}
                      className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={
                            req.photoURL ||
                            `https://api.dicebear.com/7.x/bottts/svg?seed=${req.userId}`
                          }
                          alt={req.displayName}
                          className="w-8 h-8 rounded-full object-cover bg-slate-800 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{req.displayName}</div>
                          {req.username && (
                            <div className="text-[10px] font-mono text-emerald-400">@{req.username}</div>
                          )}
                          {req.message && (
                            <div className="text-[10px] text-slate-400 truncate">{req.message}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={async () => {
                            setBusyReqId(req.userId);
                            try {
                              await approveGroupJoinRequest(chat.id, req, currentUser.displayName);
                            } finally {
                              setBusyReqId(null);
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer"
                        >
                          {language === 'bn' ? 'একসেপ্ট' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={async () => {
                            setBusyReqId(req.userId);
                            try {
                              await declineGroupJoinRequest(chat.id, req.userId);
                            } finally {
                              setBusyReqId(null);
                            }
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Members Section Header */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <h5 className="text-xs font-bold text-white uppercase tracking-wider">
                  {t('groupMembers')} ({memberIds.length})
                </h5>
              </div>

              {/* Strictly Admin-only Add Members (Friends-only) */}
              {isCurrentUserAdmin && (
                <button
                  onClick={() => setShowAddMembers(!showAddMembers)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 hover:text-white text-xs font-bold transition cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{t('addMembersTitle')}</span>
                </button>
              )}
            </div>

            {/* In-Modal Add Members Tray (Strictly Accepted Friends) */}
            {showAddMembers && isCurrentUserAdmin && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/40 space-y-3 animate-in slide-in-from-top-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-emerald-400">
                    {language === 'bn' ? 'ফ্রেন্ড তালিকা থেকে সদস্য যুক্ত করুন' : 'Add Friends to Group'}
                  </span>
                  <button
                    onClick={() => setShowAddMembers(false)}
                    className="text-slate-400 hover:text-white p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder={language === 'bn' ? 'আপনার ফ্রেন্ড খুঁজুন...' : 'Filter your friends...'}
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {selectedUserIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
                    {Object.values(selectedUsersMap).map((sel) => (
                      <span
                        key={sel.userId}
                        onClick={() => toggleSelectAddMember(sel)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[10px] text-emerald-300 cursor-pointer hover:bg-rose-500/15 hover:text-rose-300 hover:border-rose-500/30 transition"
                      >
                        <span>{sel.displayName}</span>
                        <X className="w-2.5 h-2.5" />
                      </span>
                    ))}
                  </div>
                )}

                {availableFriends.length === 0 ? (
                  <p className="text-center py-3 text-xs text-slate-400 leading-relaxed">
                    {language === 'bn'
                      ? 'গ্রুপে যোগ করার মতো নতুন কোনো ফ্রেন্ড নেই। শুধু আপনার একসেপ্টেড ফ্রেন্ডদেরই গ্রুপে এড করা যাবে।'
                      : 'No accepted friends left to add. Only accepted friends can be added directly.'}
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                    {availableFriends.map((u) => {
                      const isSelected = Boolean(selectedUsersMap[u.userId]);
                      return (
                        <div
                          key={u.userId}
                          onClick={() => toggleSelectAddMember(u)}
                          className={`flex items-center justify-between p-2 rounded-xl transition cursor-pointer border ${
                            isSelected
                              ? 'bg-emerald-500/15 border-emerald-500/50'
                              : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <img
                              src={u.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.userId}`}
                              alt={u.displayName}
                              className="w-7 h-7 rounded-full object-cover bg-slate-800"
                            />
                            <div>
                              <span className="block text-xs font-semibold text-white">
                                {u.displayName}
                              </span>
                              {u.username && (
                                <span className="block text-[10px] text-emerald-400 font-mono">
                                  @{u.username}
                                </span>
                              )}
                            </div>
                          </div>
                          <div
                            className={`w-4 h-4 rounded-md border flex items-center justify-center transition ${
                              isSelected
                                ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                                : 'border-slate-700 bg-slate-900'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => setShowAddMembers(false)}
                    className="px-3 py-1.5 rounded-xl text-xs text-slate-300 hover:bg-slate-900 transition"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    disabled={selectedUserIds.length === 0 || submitting}
                    onClick={handleAddMembersSubmit}
                    className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 flex items-center gap-1.5 transition"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>
                      {t('addMembersBtn')} ({selectedUserIds.length})
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Member Search Bar */}
            {memberIds.length > 5 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder={language === 'bn' ? 'সদস্য খুঁজুন...' : 'Search members...'}
                  value={searchMemberQuery}
                  onChange={(e) => setSearchMemberQuery(e.target.value)}
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {/* Members List Cards */}
            <div className="space-y-1.5">
              {filteredMemberIds.map((uid) => {
                const details = chat.participantDetails?.[uid];
                const displayName = details?.displayName || 'User';
                const photoURL = details?.photoURL;
                const isMemberCreator = chat.creatorId === uid;
                const isMemberAdmin =
                  isMemberCreator || (chat.adminIds || []).includes(uid);
                const isSelf = uid === currentUser.userId;

                return (
                  <div
                    key={uid}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 transition relative"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}`}
                        alt={displayName}
                        className="w-9 h-9 rounded-full object-cover bg-slate-800 border border-slate-700/80 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white truncate">
                            {displayName}
                          </span>
                          {isSelf && (
                            <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 text-[9px] font-bold">
                              {language === 'bn' ? 'আপনি' : 'You'}
                            </span>
                          )}
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {isMemberCreator ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[9px] font-bold">
                              <Crown className="w-2.5 h-2.5" />
                              <span>{t('groupCreatorBadge')}</span>
                            </span>
                          ) : isMemberAdmin ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold">
                              <Shield className="w-2.5 h-2.5" />
                              <span>{t('groupAdminBadge')}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500">
                              {language === 'bn' ? 'সদস্য' : 'Member'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Admin Actions Menu for this member */}
                    {isCurrentUserAdmin && !isSelf && (
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMemberMenu(activeMemberMenu === uid ? null : uid);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {activeMemberMenu === uid && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-8 z-30 w-44 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 animate-in fade-in"
                          >
                            {!isMemberAdmin ? (
                              <button
                                onClick={() => handleMakeAdmin(uid)}
                                className="w-full px-3 py-2 text-left text-xs text-emerald-300 hover:bg-emerald-500/15 flex items-center gap-2 cursor-pointer font-medium transition"
                              >
                                <Shield className="w-3.5 h-3.5" />
                                <span>{t('makeAdminAction')}</span>
                              </button>
                            ) : (
                              !isMemberCreator && (
                                <button
                                  onClick={() => handleDismissAdmin(uid)}
                                  className="w-full px-3 py-2 text-left text-xs text-amber-300 hover:bg-amber-500/15 flex items-center gap-2 cursor-pointer font-medium transition"
                                >
                                  <Shield className="w-3.5 h-3.5" />
                                  <span>{t('dismissAdminAction')}</span>
                                </button>
                              )
                            )}

                            {!isMemberCreator && (
                              <button
                                onClick={() => {
                                  setActiveMemberMenu(null);
                                  setBanOnRemove(false);
                                  setConfirmRemoveId(uid);
                                }}
                                className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-red-500/15 flex items-center gap-2 cursor-pointer font-medium transition border-t border-slate-800"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                                <span>{t('removeMemberAction')}</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Danger Zone: Leave Group / Vanish Group */}
          <div className="pt-4 border-t border-slate-800/80 space-y-2">
            <button
              onClick={() => setConfirmLeave(true)}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-amber-400 hover:text-white bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('leaveGroupBtn')}</span>
            </button>

            {isCurrentUserAdmin && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{t('deleteGroupForEveryoneBtn')}</span>
              </button>
            )}
          </div>
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

      {/* Confirmation Dialog: Leave Group */}
      {confirmLeave && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-amber-500/40 rounded-2xl p-5 space-y-3 shadow-2xl">
            <div className="flex items-center gap-2.5 text-amber-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h4 className="text-sm font-bold text-white">{t('leaveGroupConfirmTitle')}</h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {t('leaveGroupConfirmBody')}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmLeave(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleExecuteLeave}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition"
              >
                {t('leaveGroupBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Delete Group for Everyone */}
      {confirmDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-red-500/40 rounded-2xl p-5 space-y-3 shadow-2xl">
            <div className="flex items-center gap-2.5 text-red-400">
              <Trash2 className="w-5 h-5 shrink-0" />
              <h4 className="text-sm font-bold text-white">{t('deleteGroupConfirmTitle')}</h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {t('deleteGroupConfirmBody')}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleExecuteDelete}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition"
              >
                {t('deleteGroupForEveryoneBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Remove Member */}
      {confirmRemoveId && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-red-500/40 rounded-2xl p-5 space-y-3 shadow-2xl">
            <div className="flex items-center gap-2.5 text-red-400">
              <UserMinus className="w-5 h-5 shrink-0" />
              <h4 className="text-sm font-bold text-white">
                {language === 'bn' ? 'সদস্যকে সরাতে চান?' : 'Remove Member?'}
              </h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {language === 'bn'
                ? `আপনি কি নিশ্চিতভাবে "${chat.participantDetails?.[confirmRemoveId]?.displayName || 'এই সদস্য'}" কে গ্রুপ থেকে সরাতে চান?`
                : `Are you sure you want to remove "${chat.participantDetails?.[confirmRemoveId]?.displayName || 'this member'}" from the group?`}
            </p>
            {isPublic && (
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={banOnRemove}
                  onChange={(e) => setBanOnRemove(e.target.checked)}
                  className="rounded border-slate-600 accent-red-500"
                />
                <span>
                  {language === 'bn'
                    ? 'পাবলিক লিংক দিয়ে পুনরায় জয়েন করা ব্লক করুন'
                    : 'Also ban from re-joining this public group'}
                </span>
              </label>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setConfirmRemoveId(null);
                  setBanOnRemove(false);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleConfirmRemove}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition"
              >
                {t('removeMemberAction')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
