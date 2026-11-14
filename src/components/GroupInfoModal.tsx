import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import type { ChatRoom, UserProfile } from '../types/chat';
import {
  getAllUsers,
  addGroupMembers,
  removeGroupMember,
  makeGroupAdmin,
  dismissGroupAdmin,
  leaveGroupChat,
  deleteGroupChatPermanently,
  updateGroupTitle,
} from '../services/chatService';

interface GroupInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  chat: ChatRoom;
  currentUser: UserProfile;
  onLeaveGroup?: () => void;
  onDeleteGroup?: () => void;
}

export const GroupInfoModal: React.FC<GroupInfoModalProps> = ({
  isOpen,
  onClose,
  chat,
  currentUser,
  onLeaveGroup,
  onDeleteGroup,
}) => {
  const { t, language } = useLanguage();

  const [searchMemberQuery, setSearchMemberQuery] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(chat.name || '');
  const [activeMemberMenu, setActiveMemberMenu] = useState<string | null>(null);

  // Add Member sub-flow
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Confirm dialogs
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  // Sync title when chat changes
  useEffect(() => {
    setEditedTitle(chat.name || '');
  }, [chat.name]);

  // Load available users for adding to group
  useEffect(() => {
    if (showAddMembers && currentUser) {
      setLoadingUsers(true);
      getAllUsers(currentUser.userId)
        .then((all) => {
          // Filter out users already in the group
          const currentSet = new Set(chat.participantIds || []);
          const notInGroup = all.filter((u) => !currentSet.has(u.userId));
          setAvailableUsers(notInGroup);
        })
        .finally(() => setLoadingUsers(false));
    }
  }, [showAddMembers, chat.participantIds, currentUser]);

  if (!isOpen) return null;

  const isCreator = chat.creatorId === currentUser.userId;
  const isCurrentUserAdmin =
    isCreator || (chat.adminIds || []).includes(currentUser.userId);

  // Members list
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
      await removeGroupMember(chat.id, confirmRemoveId, currentUser.displayName);
      setConfirmRemoveId(null);
      setActiveMemberMenu(null);
    } catch (err) {
      console.error('Failed to remove member:', err);
    }
  };

  const handleAddMembersSubmit = async () => {
    if (selectedUserIds.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const usersToAdd = availableUsers.filter((u) => selectedUserIds.includes(u.userId));
      await addGroupMembers(chat.id, usersToAdd, currentUser.displayName);
      setShowAddMembers(false);
      setSelectedUserIds([]);
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
                <Users className="w-3.5 h-3.5 stroke-[2.5]" />
              </span>
            </div>

            {/* Editable Group Title */}
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

            <p className="text-xs text-slate-400 font-medium">
              {t('membersLabel', { count: memberIds.length })}
            </p>
          </div>

          {/* Members Section Header */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <h5 className="text-xs font-bold text-white uppercase tracking-wider">
                  {t('groupMembers')} ({memberIds.length})
                </h5>
              </div>

              {/* Add Member Button for Admins */}
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

            {/* In-Modal Add Members Tray */}
            {showAddMembers && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/40 space-y-3 animate-in slide-in-from-top-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-emerald-400">
                    {t('addMembersTitle')}
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
                    placeholder={t('searchUserPlaceholder')}
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {loadingUsers ? (
                  <div className="flex items-center justify-center py-4 text-slate-400 gap-2 text-xs">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>{t('findingUsers')}</span>
                  </div>
                ) : availableUsers.length === 0 ? (
                  <p className="text-center py-3 text-xs text-slate-500">
                    {language === 'bn'
                      ? 'যুক্ত করার মতো কোনো নতুন নিবন্ধিত ব্যবহারকারী নেই'
                      : 'All registered users are already members of this group'}
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                    {availableUsers
                      .filter((u) => {
                        const q = userSearchQuery.toLowerCase().replace(/^@/, '');
                        return (
                          u.displayName?.toLowerCase().includes(q) ||
                          u.username?.toLowerCase().includes(q) ||
                          u.about?.toLowerCase().includes(q)
                        );
                      })
                      .map((u) => {
                        const isSelected = selectedUserIds.includes(u.userId);
                        return (
                          <div
                            key={u.userId}
                            onClick={() => {
                              setSelectedUserIds((prev) =>
                                isSelected ? prev.filter((id) => id !== u.userId) : [...prev, u.userId]
                              );
                            }}
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
                                <span className="block text-[10px] text-slate-400 font-mono">
                                  {u.username ? `@${u.username}` : (u.about || '')}
                                </span>
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
            {/* Leave Group Button */}
            <button
              onClick={() => setConfirmLeave(true)}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-amber-400 hover:text-white bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('leaveGroupBtn')}</span>
            </button>

            {/* Vanish / Delete Group for Everyone (Admin only) */}
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
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmRemoveId(null)}
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
