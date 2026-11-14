import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';
import type { UserProfile, DirectoryUser, UserSecurityLock, ChatRoom, ChatMessage, MessageType } from '../types/chat';

function toDirectoryPayload(fields: Partial<UserProfile> & { userId: string }): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    userId: fields.userId,
    displayName: (fields.displayName || 'User').slice(0, 100),
    photoURL: (fields.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${fields.userId}`).slice(0, 1000),
    about: (fields.about || 'Available | Using Anomah Chat').slice(0, 200),
    status: fields.status || 'active',
    isOnline: Boolean(fields.isOnline),
    lastSeen: fields.lastSeen || new Date().toISOString(),
    isBanned: Boolean(fields.isBanned),
  };
  if (fields.username) {
    payload.username = fields.username.toLowerCase();
  }
  return payload;
}

export async function syncDirectoryEntry(userId: string, fields: Record<string, unknown>): Promise<void> {
  try {
    const dirRef = doc(db, 'directory', userId);
    await setDoc(dirRef, fields, { merge: true });
  } catch (err) {
    console.warn('Directory sync warning:', err);
  }
}

// Upsert user profile upon login + sync public non-PII discovery directory
export async function syncUserProfile(user: {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}): Promise<UserProfile> {
  const path = `users/${user.uid}`;
  try {
    const userRef = doc(db, 'users', user.uid);
    const existingSnap = await getDoc(userRef);

    const fallbackName = user.displayName || user.email?.split('@')[0] || 'User';
    const fallbackPhoto = user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`;
    const nowIso = new Date().toISOString();
    const cleanEmail = (user.email || '').trim().toLowerCase().slice(0, 150);

    if (existingSnap.exists()) {
      const data = existingSnap.data() as UserProfile;
      const resolvedName = (user.displayName || data.displayName || fallbackName).slice(0, 100);
      const resolvedPhoto = (user.photoURL || data.photoURL || fallbackPhoto).slice(0, 1000);
      const updated: Record<string, unknown> = {
        isOnline: true,
        lastSeen: nowIso,
        displayName: resolvedName,
        photoURL: resolvedPhoto,
      };
      if (cleanEmail && data.email !== cleanEmail) {
        updated.email = cleanEmail;
      }
      await updateDoc(userRef, updated);

      const merged = { ...data, ...updated } as UserProfile;
      await syncDirectoryEntry(
        user.uid,
        toDirectoryPayload({
          userId: user.uid,
          displayName: merged.displayName,
          photoURL: merged.photoURL,
          about: merged.about,
          username: merged.username,
          status: merged.status || 'active',
          isOnline: true,
          lastSeen: nowIso,
          isBanned: merged.isBanned,
        })
      );
      return merged;
    } else {
      const newProfile: UserProfile = {
        userId: user.uid,
        displayName: fallbackName.slice(0, 100),
        email: cleanEmail,
        photoURL: fallbackPhoto.slice(0, 1000),
        about: 'Available | Using Anomah Chat',
        status: 'active',
        isOnline: true,
        lastSeen: nowIso,
        createdAt: nowIso,
      };
      await setDoc(userRef, newProfile);
      await syncDirectoryEntry(user.uid, toDirectoryPayload(newProfile));
      return newProfile;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

// Update presence (online / lastSeen / exit time / daily active minutes)
export async function setPresence(userId: string, isOnline: boolean, activeMinutesIncrement = 0) {
  try {
    const userRef = doc(db, 'users', userId);
    const now = new Date();
    const nowIso = now.toISOString();
    const todayKey = nowIso.slice(0, 10); // "YYYY-MM-DD"

    const updates: Record<string, any> = {
      isOnline,
      lastSeen: nowIso,
    };
    if (isOnline) {
      updates.lastLoginAt = nowIso;
    } else {
      updates.lastExitAt = nowIso;
    }

    if (activeMinutesIncrement > 0) {
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const udata = snap.data() as UserProfile;
        const currentDaily = udata.dailyActivity || {};
        const todayMin = (currentDaily[todayKey] || 0) + activeMinutesIncrement;
        const totalMin = (udata.totalActiveMinutes || 0) + activeMinutesIncrement;
        updates[`dailyActivity.${todayKey}`] = todayMin;
        updates.totalActiveMinutes = totalMin;
      }
    }

    await updateDoc(userRef, updates);
    await updateDoc(doc(db, 'directory', userId), {
      isOnline,
      lastSeen: nowIso,
    }).catch(() => {});
  } catch (error) {
    console.warn('Presence update notice:', error);
  }
}

// Subscribe to a partner's public non-PII directory profile for presence tracking
export function subscribeToDirectoryUser(
  userId: string,
  onUpdate: (user: DirectoryUser | null) => void
): Unsubscribe {
  const dirRef = doc(db, 'directory', userId);
  return onSnapshot(
    dirRef,
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as DirectoryUser);
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      console.warn('Directory subscribe notice:', error);
    }
  );
}

// Subscribe to own full profile (owner-only or admin)
export function subscribeToUserProfile(
  userId: string,
  onUpdate: (user: UserProfile | null) => void
): Unsubscribe {
  const userRef = doc(db, 'users', userId);
  return onSnapshot(
    userRef,
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as UserProfile);
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      console.warn('User profile subscribe notice:', error);
    }
  );
}

// Format accurate online or last seen text
export function formatLastSeenStatus(lastSeen?: string, isOnline?: boolean): {
  isOnline: boolean;
  statusText: string;
} {
  if (!lastSeen) {
    return isOnline ? { isOnline: true, statusText: 'Online' } : { isOnline: false, statusText: 'Offline' };
  }

  const lastSeenDate = new Date(lastSeen);
  const now = new Date();
  const diffMs = now.getTime() - lastSeenDate.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);

  if (isOnline && diffMin < 2) {
    return { isOnline: true, statusText: 'Online' };
  }

  if (diffMin < 1) {
    return { isOnline: false, statusText: 'Active just now' };
  }
  if (diffMin < 60) {
    return { isOnline: false, statusText: `Active ${diffMin}m ago` };
  }
  if (diffHours < 24) {
    return { isOnline: false, statusText: `Active ${diffHours}h ago` };
  }
  const isYesterday =
    now.getDate() - lastSeenDate.getDate() === 1 &&
    now.getMonth() === lastSeenDate.getMonth() &&
    now.getFullYear() === lastSeenDate.getFullYear();

  const timeStr = lastSeenDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isYesterday) {
    return { isOnline: false, statusText: `Last seen yesterday at ${timeStr}` };
  }
  return {
    isOnline: false,
    statusText: `Last seen ${lastSeenDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`,
  };
}

// Fetch active users from public non-PII directory (never reads other users' PII/email)
export async function getAllUsers(currentUserId: string): Promise<UserProfile[]> {
  const path = 'directory';
  try {
    const q = query(collection(db, path), where('status', '==', 'active'));
    const snap = await getDocs(q);
    const list: UserProfile[] = [];
    snap.forEach((docItem) => {
      const u = docItem.data() as DirectoryUser;
      if (u.userId !== currentUserId) {
        list.push({
          userId: u.userId,
          displayName: u.displayName,
          email: '',
          photoURL: u.photoURL,
          about: u.about,
          username: u.username,
          isOnline: u.isOnline,
          lastSeen: u.lastSeen,
          status: u.status,
          isBanned: u.isBanned,
          createdAt: u.lastSeen || new Date().toISOString(),
        });
      }
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
}

// Subscribe to chats for current user
export function subscribeToUserChats(
  userId: string,
  onUpdate: (chats: ChatRoom[]) => void
): Unsubscribe {
  const path = 'chats';
  const q = query(
    collection(db, path),
    where('participantIds', 'array-contains', userId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const chats: ChatRoom[] = [];
      snapshot.forEach((docItem) => {
        chats.push({ id: docItem.id, ...(docItem.data() as Omit<ChatRoom, 'id'>) });
      });
      chats.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      onUpdate(chats);
    },
    (error) => {
      console.warn('Chats snapshot notice:', error);
      const msg = error.message.toLowerCase();
      if (!msg.includes('unavailable') && !msg.includes('offline') && !msg.includes('could not reach') && !msg.includes('timeout')) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    }
  );
}

// Create or retrieve 1-to-1 direct chat
export async function getOrCreateDirectChat(
  currentUser: UserProfile,
  partner: UserProfile
): Promise<ChatRoom> {
  const path = 'chats';
  try {
    const sortedIds = [currentUser.userId, partner.userId].sort();
    const chatId = `dm_${sortedIds[0]}_${sortedIds[1]}`;
    const chatRef = doc(db, 'chats', chatId);
    const existing = await getDoc(chatRef);

    if (existing.exists()) {
      return { id: chatId, ...(existing.data() as Omit<ChatRoom, 'id'>) };
    }

    const nowIso = new Date().toISOString();
    const newChat: Omit<ChatRoom, 'id'> = {
      type: 'direct',
      participantIds: sortedIds,
      participantDetails: {
        [currentUser.userId]: {
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL || '',
          email: currentUser.email || '',
        },
        [partner.userId]: {
          displayName: partner.displayName,
          photoURL: partner.photoURL || '',
          email: partner.email || '',
        },
      },
      lastMessageText: 'Started conversation',
      lastMessageSenderId: currentUser.userId,
      lastMessageTime: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await setDoc(chatRef, newChat);
    return { id: chatId, ...newChat };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

// Create a group chat
export async function createGroupChat(
  currentUser: UserProfile,
  groupName: string,
  selectedMembers: UserProfile[]
): Promise<ChatRoom> {
  const path = 'chats';
  try {
    const allMembers = [currentUser, ...selectedMembers];
    const participantIds = allMembers.map((m) => m.userId);
    const chatId = `group_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const participantDetails: Record<string, { displayName: string; photoURL?: string; email?: string }> = {};
    allMembers.forEach((m) => {
      participantDetails[m.userId] = {
        displayName: m.displayName,
        photoURL: m.photoURL || '',
        email: m.email || '',
      };
    });

    const newChat: Omit<ChatRoom, 'id'> = {
      type: 'group',
      name: groupName.trim().slice(0, 100),
      creatorId: currentUser.userId,
      adminIds: [currentUser.userId],
      participantIds,
      participantDetails,
      lastMessageText: `${currentUser.displayName} created group "${groupName}"`,
      lastMessageSenderId: currentUser.userId,
      lastMessageTime: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const chatRef = doc(db, 'chats', chatId);
    await setDoc(chatRef, newChat);
    return { id: chatId, ...newChat };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

// Subscribe to messages in a chat
export function subscribeToChatMessages(
  chatId: string,
  onUpdate: (messages: ChatMessage[]) => void
): Unsubscribe {
  const path = `chats/${chatId}/messages`;
  const q = query(
    collection(db, path),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((docItem) => {
        msgs.push({ id: docItem.id, ...(docItem.data() as Omit<ChatMessage, 'id'>) });
      });
      msgs.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return (a.id || '').localeCompare(b.id || '');
      });
      onUpdate(msgs);
    },
    (error) => {
      console.warn('Messages snapshot notice:', error);
      const msg = error.message.toLowerCase();
      if (!msg.includes('unavailable') && !msg.includes('offline') && !msg.includes('could not reach') && !msg.includes('timeout')) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    }
  );
}

// Send a message
export async function sendMessage(params: {
  chatId: string;
  sender: UserProfile;
  text: string;
  type?: MessageType;
  mediaUrl?: string;
  audioDuration?: number;
  replyTo?: { id: string; text: string; senderName: string };
}): Promise<void> {
  const path = `chats/${params.chatId}/messages`;
  try {
    if (params.sender.isBanned) {
      throw new Error('Your account has been suspended by administration. You cannot send messages.');
    }

    const parentChatRef = doc(db, 'chats', params.chatId);
    const parentSnap = await getDoc(parentChatRef);
    let parentData: ChatRoom | null = null;
    if (parentSnap.exists()) {
      parentData = parentSnap.data() as ChatRoom;
      if (parentData.isSuspended) {
        throw new Error('This conversation is locked because a participant has been suspended.');
      }
      if (parentData.type === 'direct') {
        const partnerId = parentData.participantIds?.find((id) => id !== params.sender.userId);
        if (partnerId) {
          if (parentData.participantDetails?.[partnerId]?.isBanned) {
            throw new Error('This user has been suspended. Messaging is disabled.');
          }
          if (
            parentData.participantDetails?.[partnerId]?.status === 'scheduled_for_deletion' ||
            parentData.participantDetails?.[partnerId]?.status === 'deleted'
          ) {
            throw new Error('This account has been deleted. You cannot send messages.');
          }
          // Read non-PII directory doc instead of PII users collection
          const partnerDirSnap = await getDoc(doc(db, 'directory', partnerId));
          if (partnerDirSnap.exists()) {
            const partnerProfile = partnerDirSnap.data() as DirectoryUser;
            if (partnerProfile.status === 'scheduled_for_deletion' || partnerProfile.status === 'deleted') {
              throw new Error('This account has been deleted. You cannot send messages.');
            }
          }
        }
      }
    }

    const clientNowMs = Date.now();
    let lastTimeMs = 0;
    if (parentData?.lastMessageTime) {
      const parsed = new Date(parentData.lastMessageTime).getTime();
      if (!isNaN(parsed) && parsed > 0) {
        lastTimeMs = parsed;
      }
    }
    const effectiveTimeMs = Math.max(clientNowMs, lastTimeMs + 1000);
    const effectiveIso = new Date(effectiveTimeMs).toISOString();

    const messageId = `msg_${effectiveTimeMs}_${Math.random().toString(36).substring(2, 7)}`;
    const messageRef = doc(db, 'chats', params.chatId, 'messages', messageId);

    const messageData: ChatMessage = {
      id: messageId,
      chatId: params.chatId,
      senderId: params.sender.userId,
      senderName: params.sender.displayName,
      senderPhoto: params.sender.photoURL,
      text: (params.text || '').trim().slice(0, 5000),
      type: params.type || 'text',
      readBy: [params.sender.userId],
      createdAt: effectiveIso,
    };

    if (params.mediaUrl) {
      messageData.mediaUrl = params.mediaUrl;
    }
    if (params.audioDuration) {
      messageData.audioDuration = params.audioDuration;
    }
    if (params.replyTo) {
      messageData.replyToId = params.replyTo.id;
      messageData.replyToText = params.replyTo.text.slice(0, 300);
      messageData.replyToSender = params.replyTo.senderName;
    }

    await setDoc(messageRef, messageData);

    let snippet = messageData.text;
    if (params.type === 'audio') snippet = '🎤 Voice note';
    if (params.type === 'image') snippet = '📷 Photo';

    await updateDoc(parentChatRef, {
      lastMessageText: snippet.slice(0, 500),
      lastMessageSenderId: params.sender.userId,
      lastMessageTime: effectiveIso,
      updatedAt: effectiveIso,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

// Mark messages as read by current user
export async function markChatMessagesAsRead(
  chatId: string,
  user: UserProfile,
  unreadMessages: ChatMessage[]
) {
  if (!chatId || !user || !user.userId || !Array.isArray(unreadMessages) || unreadMessages.length === 0) {
    return;
  }
  try {
    const unreadForUser = unreadMessages.filter(
      (msg) => msg.senderId !== user.userId && Array.isArray(msg.readBy) && !msg.readBy.includes(user.userId)
    );
    if (unreadForUser.length === 0) return;

    const nowIso = new Date().toISOString();
    for (const msg of unreadForUser) {
      const msgRef = doc(db, 'chats', chatId, 'messages', msg.id);
      const existingDetails = msg.seenByDetails || {};
      await updateDoc(msgRef, {
        readBy: [...(msg.readBy || []), user.userId],
        seenByDetails: {
          ...existingDetails,
          [user.userId]: {
            displayName: user.displayName || 'User',
            photoURL: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.userId}`,
            seenAt: nowIso,
          },
        },
      });
    }
  } catch (error) {
    console.warn('Mark read warning:', error);
  }
}

// Toggle emoji reaction
export async function toggleMessageReaction(
  chatId: string,
  messageId: string,
  userId: string,
  emoji: string
) {
  const path = `chats/${chatId}/messages/${messageId}`;
  try {
    const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
    const snap = await getDoc(msgRef);
    if (!snap.exists()) return;

    const data = snap.data() as ChatMessage;
    const currentReactions = data.reactions || {};
    const usersForEmoji = currentReactions[emoji] || [];

    let updatedUsers: string[];
    if (usersForEmoji.includes(userId)) {
      updatedUsers = usersForEmoji.filter((id) => id !== userId);
    } else {
      updatedUsers = [...usersForEmoji, userId];
    }

    const newReactions = { ...currentReactions };
    if (updatedUsers.length > 0) {
      newReactions[emoji] = updatedUsers;
    } else {
      delete newReactions[emoji];
    }

    await updateDoc(msgRef, { reactions: newReactions });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Delete message
export async function deleteChatMessage(chatId: string, messageId: string) {
  const path = `chats/${chatId}/messages/${messageId}`;
  try {
    const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
    await deleteDoc(msgRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Edit message text
export async function editChatMessage(chatId: string, messageId: string, newText: string) {
  const path = `chats/${chatId}/messages/${messageId}`;
  try {
    const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
    await updateDoc(msgRef, {
      text: newText.trim(),
      isEdited: true,
      editedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Delete or leave conversation
export async function deleteChatRoom(chatId: string, currentUserId: string) {
  const path = `chats/${chatId}`;
  try {
    const chatRef = doc(db, 'chats', chatId);
    const snap = await getDoc(chatRef);
    if (!snap.exists()) return;
    const data = snap.data() as ChatRoom;

    const remaining = data.participantIds.filter((id) => id !== currentUserId);
    if (remaining.length <= 1 || data.type === 'direct') {
      await deleteDoc(chatRef);
    } else {
      await updateDoc(chatRef, {
        participantIds: remaining,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Add new members to an existing group
export async function addGroupMembers(
  chatId: string,
  newMembers: UserProfile[],
  addedByName: string
): Promise<void> {
  const path = `chats/${chatId}`;
  try {
    const chatRef = doc(db, 'chats', chatId);
    const snap = await getDoc(chatRef);
    if (!snap.exists()) throw new Error('Group not found');
    const data = snap.data() as ChatRoom;

    const currentIds = new Set(data.participantIds || []);
    const details = { ...(data.participantDetails || {}) };

    newMembers.forEach((m) => {
      currentIds.add(m.userId);
      details[m.userId] = {
        displayName: m.displayName,
        photoURL: m.photoURL || '',
        email: m.email || '',
      };
    });

    const nowIso = new Date().toISOString();
    const addedNames = newMembers.map((m) => m.displayName).join(', ');

    await updateDoc(chatRef, {
      participantIds: Array.from(currentIds),
      participantDetails: details,
      lastMessageText: `${addedByName} added ${addedNames}`,
      lastMessageTime: nowIso,
      updatedAt: nowIso,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

// Remove a member from a group (Admin only)
export async function removeGroupMember(
  chatId: string,
  memberId: string,
  removedByName?: string
): Promise<void> {
  const path = `chats/${chatId}`;
  try {
    const chatRef = doc(db, 'chats', chatId);
    const snap = await getDoc(chatRef);
    if (!snap.exists()) throw new Error('Group not found');
    const data = snap.data() as ChatRoom;

    if (data.creatorId === memberId) {
      throw new Error('Group creator cannot be removed from the group.');
    }

    const remainingIds = (data.participantIds || []).filter((id) => id !== memberId);
    const remainingAdmins = (data.adminIds || []).filter((id) => id !== memberId);
    const memberName = data.participantDetails?.[memberId]?.displayName || 'Member';
    const nowIso = new Date().toISOString();

    await updateDoc(chatRef, {
      participantIds: remainingIds,
      adminIds: remainingAdmins,
      lastMessageText: `${removedByName || 'Admin'} removed ${memberName}`,
      lastMessageTime: nowIso,
      updatedAt: nowIso,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

// Make a member an Admin (Co-Admin)
export async function makeGroupAdmin(chatId: string, targetUserId: string): Promise<void> {
  const path = `chats/${chatId}`;
  try {
    const chatRef = doc(db, 'chats', chatId);
    const snap = await getDoc(chatRef);
    if (!snap.exists()) throw new Error('Group not found');
    const data = snap.data() as ChatRoom;

    const currentAdmins = new Set(data.adminIds || (data.creatorId ? [data.creatorId] : []));
    currentAdmins.add(targetUserId);

    await updateDoc(chatRef, {
      adminIds: Array.from(currentAdmins),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

// Dismiss an Admin back to standard member
export async function dismissGroupAdmin(chatId: string, targetUserId: string): Promise<void> {
  const path = `chats/${chatId}`;
  try {
    const chatRef = doc(db, 'chats', chatId);
    const snap = await getDoc(chatRef);
    if (!snap.exists()) throw new Error('Group not found');
    const data = snap.data() as ChatRoom;

    if (data.creatorId === targetUserId) {
      throw new Error('Group creator cannot be dismissed as admin.');
    }

    const currentAdmins = (data.adminIds || []).filter((id) => id !== targetUserId);

    await updateDoc(chatRef, {
      adminIds: currentAdmins,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

// Leave a group chat
export async function leaveGroupChat(
  chatId: string,
  userId: string,
  userName?: string
): Promise<void> {
  const path = `chats/${chatId}`;
  try {
    const chatRef = doc(db, 'chats', chatId);
    const snap = await getDoc(chatRef);
    if (!snap.exists()) return;
    const data = snap.data() as ChatRoom;

    const remainingIds = (data.participantIds || []).filter((id) => id !== userId);

    if (remainingIds.length === 0) {
      await deleteGroupChatPermanently(chatId);
      return;
    }

    let remainingAdmins = (data.adminIds || []).filter((id) => id !== userId);
    if (remainingAdmins.length === 0 && remainingIds.length > 0) {
      remainingAdmins = [remainingIds[0]];
    }

    const nowIso = new Date().toISOString();
    await updateDoc(chatRef, {
      participantIds: remainingIds,
      adminIds: remainingAdmins,
      lastMessageText: `${userName || 'A member'} left the group`,
      lastMessageTime: nowIso,
      updatedAt: nowIso,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

// Delete group completely for everyone
export async function deleteGroupChatPermanently(chatId: string): Promise<void> {
  const path = `chats/${chatId}`;
  try {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const msgsSnap = await getDocs(messagesRef);
    const deletePromises = msgsSnap.docs.map((docItem) => deleteDoc(docItem.ref));
    await Promise.all(deletePromises);

    const chatRef = doc(db, 'chats', chatId);
    await deleteDoc(chatRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

// Update group title/name
export async function updateGroupTitle(chatId: string, newTitle: string): Promise<void> {
  const path = `chats/${chatId}`;
  try {
    const chatRef = doc(db, 'chats', chatId);
    const nowIso = new Date().toISOString();
    await updateDoc(chatRef, {
      name: newTitle.trim().slice(0, 100),
      updatedAt: nowIso,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

// Check if a username is available via indexed directory query (signed-in)
export async function isUsernameAvailable(username: string, currentUserId?: string): Promise<boolean> {
  const clean = username.trim().toLowerCase().replace(/^@/, '');
  if (!clean || clean.length < 3) return false;
  try {
    const q = query(
      collection(db, 'directory'),
      where('username', '==', clean),
      where('status', 'in', ['active', 'scheduled_for_deletion'])
    );
    const snap = await getDocs(q);
    if (snap.empty) return true;
    if (currentUserId && snap.docs.length === 1 && snap.docs[0].id === currentUserId) {
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Error checking username:', err);
    return false;
  }
}

// Indexed lookup in directory by username or UID (no full-collection scan)
export async function findDirectoryUserByIdentifier(identifier: string): Promise<DirectoryUser | null> {
  const raw = identifier.trim().replace(/^@/, '');
  const clean = raw.toLowerCase();
  if (!clean) return null;

  try {
    const qUsername = query(
      collection(db, 'directory'),
      where('username', '==', clean),
      where('status', '==', 'active')
    );
    const snapUser = await getDocs(qUsername);
    if (!snapUser.empty) {
      return snapUser.docs[0].data() as DirectoryUser;
    }

    const dirDocRef = doc(db, 'directory', raw);
    const snapDoc = await getDoc(dirDocRef);
    if (snapDoc.exists()) {
      const u = snapDoc.data() as DirectoryUser;
      if (u.status === 'active') return u;
    }
    return null;
  } catch (err) {
    console.warn('Directory lookup notice:', err);
    return null;
  }
}

// ------------------------------------------------------------------
// QUICK APP-LOCK PIN (Free Client-Side WebCrypto SHA-256 + Owner-Private Doc)
// Replaces insecure unauthenticated plaintext PIN login.
// ------------------------------------------------------------------

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return bytesToHex(arr);
}

export async function hashAppLockPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin.trim()}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
}

export async function saveAppLockPin(userId: string, pin: string): Promise<void> {
  const cleanPin = pin.trim();
  if (!/^\d{4,6}$/.test(cleanPin)) {
    throw new Error('App-Lock PIN must be 4 to 6 digits.');
  }
  const salt = generateSalt();
  const pinHash = await hashAppLockPin(cleanPin, salt);
  const payload: UserSecurityLock = {
    pinHash,
    salt,
    updatedAt: new Date().toISOString(),
  };

  await setDoc(doc(db, 'users', userId, 'private', 'security'), payload);
  await updateDoc(doc(db, 'users', userId), { hasAppLockPin: true });
  try {
    localStorage.setItem(`anomah_app_lock_${userId}`, JSON.stringify(payload));
  } catch {
    // ignore storage quota
  }
}

export async function removeAppLockPin(userId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'private', 'security')).catch(() => {});
  await updateDoc(doc(db, 'users', userId), { hasAppLockPin: false });
  try {
    localStorage.removeItem(`anomah_app_lock_${userId}`);
    localStorage.removeItem(`anomah_app_lock_guard_${userId}`);
  } catch {
    // ignore
  }
}

export async function verifyAppLockPin(
  userId: string,
  enteredPin: string
): Promise<{ success: boolean; error?: string }> {
  const guardKey = `anomah_app_lock_guard_${userId}`;
  let failedCount = 0;
  let lockedUntil = 0;
  try {
    const raw = localStorage.getItem(guardKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      failedCount = Number(parsed.failedCount || 0);
      lockedUntil = Number(parsed.lockedUntil || 0);
    }
  } catch {
    // ignore
  }

  if (lockedUntil > Date.now()) {
    const mins = Math.ceil((lockedUntil - Date.now()) / 60000);
    return {
      success: false,
      error: `Too many failed unlock attempts. Try again in ${mins} minute(s), or sign out and sign back in.`,
    };
  }

  let lockConfig: UserSecurityLock | null = null;
  try {
    const snap = await getDoc(doc(db, 'users', userId, 'private', 'security'));
    if (snap.exists()) {
      lockConfig = snap.data() as UserSecurityLock;
      localStorage.setItem(`anomah_app_lock_${userId}`, JSON.stringify(lockConfig));
    }
  } catch {
    try {
      const cached = localStorage.getItem(`anomah_app_lock_${userId}`);
      if (cached) lockConfig = JSON.parse(cached) as UserSecurityLock;
    } catch {
      // ignore
    }
  }

  if (!lockConfig?.pinHash || !lockConfig?.salt) {
    return { success: true };
  }

  const candidateHash = await hashAppLockPin(enteredPin, lockConfig.salt);
  if (candidateHash === lockConfig.pinHash) {
    try {
      localStorage.removeItem(guardKey);
    } catch {}
    return { success: true };
  }

  const nextFailed = failedCount + 1;
  const nextLockedUntil = nextFailed >= 5 ? Date.now() + 5 * 60 * 1000 : 0;
  try {
    localStorage.setItem(
      guardKey,
      JSON.stringify({ failedCount: nextFailed, lockedUntil: nextLockedUntil })
    );
  } catch {}

  if (nextLockedUntil > 0) {
    return {
      success: false,
      error: 'Too many failed attempts. Locked for 5 minutes (or sign out and sign in again).',
    };
  }

  return {
    success: false,
    error: `Incorrect App-Lock PIN. ${5 - nextFailed} attempt(s) left.`,
  };
}

// 15-Day Account Deletion Schedule
export async function scheduleAccountDeletion(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const now = new Date();
  const deleteDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

  await updateDoc(userRef, {
    status: 'scheduled_for_deletion',
    deleteRequestedAt: now.toISOString(),
    deleteScheduledAt: deleteDate.toISOString(),
    isOnline: false,
    lastSeen: now.toISOString(),
  });
  await updateDoc(doc(db, 'directory', userId), {
    status: 'scheduled_for_deletion',
    isOnline: false,
    lastSeen: now.toISOString(),
  }).catch(() => {});
}

// Restore / Cancel Account Deletion
export async function restoreAccount(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const nowIso = new Date().toISOString();
  await updateDoc(userRef, {
    status: 'active',
    deleteRequestedAt: null,
    deleteScheduledAt: null,
    isOnline: true,
    lastSeen: nowIso,
  });
  await updateDoc(doc(db, 'directory', userId), {
    status: 'active',
    isOnline: true,
    lastSeen: nowIso,
  }).catch(() => {});
}

// Calculate days remaining for scheduled deletion
export function checkAccountDeletionStatus(user: UserProfile): {
  isScheduled: boolean;
  isExpired: boolean;
  daysRemaining: number;
} {
  if (user.status !== 'scheduled_for_deletion' || !user.deleteScheduledAt) {
    return { isScheduled: false, isExpired: false, daysRemaining: 15 };
  }

  const scheduledDate = new Date(user.deleteScheduledAt).getTime();
  const now = Date.now();
  const diffMs = scheduledDate - now;

  if (diffMs <= 0) {
    return { isScheduled: true, isExpired: true, daysRemaining: 0 };
  }

  const daysRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  return { isScheduled: true, isExpired: false, daysRemaining };
}
