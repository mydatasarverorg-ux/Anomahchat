import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAllUsers, getOrCreateDirectChat, createGroupChat } from '../services/chatService';
import type { UserProfile, ChatRoom } from '../types/chat';
import { X, Search, UserPlus, Users, Check, MessageSquare, Loader2 } from 'lucide-react';

interface NewChatModalProps {
  onClose: () => void;
  onSelectChat: (chat: ChatRoom) => void;
}

export function NewChatModal({ onClose, onSelectChat }: NewChatModalProps) {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'direct' | 'group'>('direct');
  const [groupName, setGroupName] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    getAllUsers(user.userId)
      .then((data) => setUsers(data))
      .finally(() => setLoading(false));
  }, [user]);

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  const handleStartDirectChat = async (partner: UserProfile) => {
    if (!user || creating) return;
    setCreating(true);
    try {
      const room = await getOrCreateDirectChat(user, partner);
      onSelectChat(room);
      onClose();
    } catch (err) {
      console.error('Failed to create/open chat:', err);
    } finally {
      setCreating(false);
    }
  };

  const toggleSelectUser = (uid: string) => {
    if (selectedUserIds.includes(uid)) {
      setSelectedUserIds(selectedUserIds.filter((id) => id !== uid));
    } else {
      setSelectedUserIds([...selectedUserIds, uid]);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !groupName.trim() || selectedUserIds.length === 0 || creating) return;
    setCreating(true);
    try {
      const members = users.filter((u) => selectedUserIds.includes(u.userId));
      const room = await createGroupChat(user, groupName.trim(), members);
      onSelectChat(room);
      onClose();
    } catch (err) {
      console.error('Failed to create group:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-4">
          <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-400" /> Start a Conversation
          </h3>
          <div className="flex bg-slate-800 p-1 rounded-xl text-xs">
            <button
              onClick={() => setMode('direct')}
              className={`flex-1 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'direct' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" /> Direct Chat
            </button>
            <button
              onClick={() => setMode('group')}
              className={`flex-1 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'group' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> New Group
            </button>
          </div>
        </div>

        {mode === 'group' && (
          <div className="mb-3">
            <label className="block text-xs font-semibold text-slate-300 mb-1">Group Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Friends & Family, Work Project..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
              maxLength={100}
            />
          </div>
        )}

        {/* Search Contact */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-[200px] max-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mb-2" />
              <span className="text-xs">Finding active users...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-10 px-4 text-slate-400">
              <p className="text-xs mb-1">No other registered users found yet.</p>
              <p className="text-[11px] text-slate-500">
                Share the app link or open an incognito window with another profile to chat between 2 people!
              </p>
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isSelected = selectedUserIds.includes(u.userId);
              return (
                <div
                  key={u.userId}
                  onClick={() => {
                    if (mode === 'direct') {
                      handleStartDirectChat(u);
                    } else {
                      toggleSelectUser(u.userId);
                    }
                  }}
                  className={`flex items-center gap-3 p-2.5 rounded-xl transition cursor-pointer border ${
                    isSelected
                      ? 'bg-emerald-950/60 border-emerald-500/50'
                      : 'bg-slate-800/40 hover:bg-slate-800 border-slate-700/50'
                  }`}
                >
                  <div className="relative">
                    <img
                      src={u.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.userId}`}
                      alt={u.displayName}
                      className="w-9 h-9 rounded-full bg-slate-700 object-cover"
                    />
                    {u.isOnline && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-900 rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate flex items-center justify-between">
                      <span>{u.displayName}</span>
                      {u.isOnline && (
                        <span className="text-[10px] text-emerald-400 font-normal">Online</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">{u.about || u.email}</div>
                  </div>
                  {mode === 'group' && (
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${
                        isSelected
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-slate-600 bg-slate-700/50'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
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
              {selectedUserIds.length} participant{selectedUserIds.length === 1 ? '' : 's'} selected
            </span>
            <button
              onClick={handleCreateGroup}
              disabled={creating || !groupName.trim() || selectedUserIds.length === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Create Group</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
