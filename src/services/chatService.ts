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
import type { UserProfile, ChatRoom, ChatMessage, MessageType } from '../types/chat';

// Upsert user profile upon login
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

    if (existingSnap.exists()) {
      const data = existingSnap.data() as UserProfile;
      const updated: Partial<UserProfile> = {
        isOnline: true,
        lastSeen: nowIso,
        displayName: user.displayName || data.displayName || fallbackName,
        photoURL: user.photoURL || data.photoURL || fallbackPhoto,
      };
      await updateDoc(userRef, updated);
      return { ...data, ...updated } as UserProfile;
    } else {
      const newProfile: UserProfile = {
        userId: user.uid,
        displayName: (fallbackName).slice(0, 100),
        email: (user.email || '').slice(0, 150),
        photoURL: fallbackPhoto.slice(0, 1000),
        about: 'Available | Using Anomah Chat',
        isOnline: true,
        lastSeen: nowIso,
        createdAt: nowIso,
      };
      await setDoc(userRef, newProfile);
      return newProfile;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

// Update presence (online / lastSeen / exit time / daily active minutes)
export async function setPresence(userId: string, isOnline: boolean, activeMinutesIncrement = 0) {
  const path = `users/${userId}`;
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
  } catch (error) {
    // Graceful error handling for presence teardown
    console.warn('Presence update notice:', error);
  }
}

// Subscribe to a single user's real-time profile for presence tracking
export function subscribeToUserProfile(
  userId: string,
  onUpdate: (user: UserProfile | null) => void
): Unsubscribe {
  const path = `users/${userId}`;
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

  // If marked online and pinged within last 2 minutes, treat as genuinely active
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

// Fetch all registered users
export async function getAllUsers(currentUserId: string): Promise<UserProfile[]> {
  const path = 'users';
  try {
    const snap = await getDocs(collection(db, path));
    const list: UserProfile[] = [];
    snap.forEach((docItem) => {
      const u = docItem.data() as UserProfile;
      if (u.userId !== currentUserId) {
        list.push(u);
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
      // Sort by updatedAt descending
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
    // Predictable chat ID for 1-to-1 pairs: dm_{minId}_{maxId}
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

    const participantDetails: Record<string, { displayName: string; photoURL?: string; email: string }> = {};
    allMembers.forEach((m) => {
      participantDetails[m.userId] = {
        displayName: m.displayName,
        photoURL: m.photoURL,
        email: m.email,
      };
    });

    const newChat: Omit<ChatRoom, 'id'> = {
      type: 'group',
      name: groupName.trim().slice(0, 100),
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
    // Strictly block suspended senders from sending any message anywhere
    if (params.sender.isBanned) {
      throw new Error('Your account has been suspended by administration. You cannot send messages.');
    }

    // Check parent chat suspension status (direct chats with suspended users are completely locked)
    const parentChatRef = doc(db, 'chats', params.chatId);
    const parentSnap = await getDoc(parentChatRef);
    if (parentSnap.exists()) {
      const parentData = parentSnap.data() as ChatRoom;
      if (parentData.isSuspended) {
        throw new Error('This conversation is locked because a participant has been suspended.');
      }
      if (parentData.type === 'direct') {
        const partnerId = parentData.participantIds?.find((id) => id !== params.sender.userId);
        if (partnerId && parentData.participantDetails?.[partnerId]?.isBanned) {
          throw new Error('This user has been suspended. Messaging is disabled.');
        }
      }
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();
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
      createdAt: nowIso,
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

    // Save message in subcollection
    await setDoc(messageRef, messageData);

    // Update parent chat snippet
    let snippet = messageData.text;
    if (params.type === 'audio') snippet = '🎤 Voice note';
    if (params.type === 'image') snippet = '📷 Photo';

    await updateDoc(parentChatRef, {
      lastMessageText: snippet.slice(0, 500),
      lastMessageSenderId: params.sender.userId,
      lastMessageTime: nowIso,
      updatedAt: nowIso,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

// Mark messages as read by current user (Double Blue Ticks & Seen Avatars)
export async function markChatMessagesAsRead(
  chatId: string,
  user: UserProfile,
  unreadMessages: ChatMessage[]
) {
  const path = `chats/${chatId}/messages`;
  try {
    const nowIso = new Date().toISOString();
    for (const msg of unreadMessages) {
      if (!msg.readBy.includes(user.userId)) {
        const msgRef = doc(db, 'chats', chatId, 'messages', msg.id);
        const existingDetails = msg.seenByDetails || {};
        await updateDoc(msgRef, {
          readBy: [...msg.readBy, user.userId],
          seenByDetails: {
            ...existingDetails,
            [user.userId]: {
              displayName: user.displayName,
              photoURL: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.userId}`,
              seenAt: nowIso,
            },
          },
        });
      }
    }
  } catch (error) {
    // Non-blocking for UI
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

    // If direct chat or last participant, delete chat and clean up
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

// Check if a username is available
export async function isUsernameAvailable(username: string, currentUserId?: string): Promise<boolean> {
  const clean = username.trim().toLowerCase().replace(/^@/, '');
  if (!clean || clean.length < 3) return false;
  try {
    const q = query(collection(db, 'users'), where('username', '==', clean));
    const snap = await getDocs(q);
    if (snap.empty) return true;
    if (currentUserId && snap.docs.length === 1 && snap.docs[0].id === currentUserId) {
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Error checking username:', err);
    return true;
  }
}

// Find user by Username, Email, or User ID (case-insensitive & whitespace trimmed)
export async function findUserByIdentifier(identifier: string): Promise<UserProfile | null> {
  const raw = identifier.trim().replace(/^@/, '');
  const clean = raw.toLowerCase();
  if (!clean) return null;

  try {
    // 1. Try querying by username (exact lowercase)
    const qUsername = query(collection(db, 'users'), where('username', '==', clean));
    const snapUser = await getDocs(qUsername);
    if (!snapUser.empty) {
      return snapUser.docs[0].data() as UserProfile;
    }

    // 2. Try querying by email (lowercase)
    const qEmail = query(collection(db, 'users'), where('email', '==', clean));
    const snapEmail = await getDocs(qEmail);
    if (!snapEmail.empty) {
      return snapEmail.docs[0].data() as UserProfile;
    }

    // 3. Try direct doc lookup by UID
    const userDocRef = doc(db, 'users', raw);
    const snapDoc = await getDoc(userDocRef);
    if (snapDoc.exists()) {
      return snapDoc.data() as UserProfile;
    }

    // 4. In-memory scan fallback across users (handles legacy case discrepancies or spaces)
    const allUsersSnap = await getDocs(collection(db, 'users'));
    for (const docSnap of allUsersSnap.docs) {
      const u = docSnap.data() as UserProfile;
      if (
        (u.username && u.username.toLowerCase() === clean) ||
        (u.email && u.email.toLowerCase() === clean) ||
        u.userId === raw ||
        (u.displayName && u.displayName.toLowerCase() === clean)
      ) {
        return u;
      }
    }

    return null;
  } catch (err) {
    console.error('Error finding user by identifier:', err);
    return null;
  }
}

// Verify secret PIN and manage brute-force lockout
export async function verifySecretPin(
  identifier: string,
  enteredPin: string
): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
  const user = await findUserByIdentifier(identifier);
  if (!user) {
    return { success: false, error: 'No account found with this username, email or ID. Please check and try again.' };
  }

  // Check lockout status
  const now = new Date();
  if (user.pinLockedUntil) {
    const lockTime = new Date(user.pinLockedUntil);
    if (lockTime > now) {
      const remainingMinutes = Math.ceil((lockTime.getTime() - now.getTime()) / 60000);
      return {
        success: false,
        error: `Account is temporarily locked due to too many failed attempts. Try again in ${remainingMinutes} minute(s).`,
      };
    }
  }

  if (!user.secretPin) {
    return {
      success: false,
      error: 'No Secret PIN has been configured for this account yet. Please sign in with Email & Password or Google, then set your PIN in Settings.',
    };
  }

  const userRef = doc(db, 'users', user.userId);

  if (user.secretPin === enteredPin.trim()) {
    // Reset failed attempts upon successful login
    try {
      await updateDoc(userRef, {
        pinFailedAttempts: 0,
        pinLockedUntil: null,
        isOnline: true,
        lastSeen: now.toISOString(),
      });
    } catch (updateErr) {
      console.warn('Failed to reset attempts on pin login:', updateErr);
    }
    return { success: true, user: { ...user, pinFailedAttempts: 0, pinLockedUntil: undefined, isOnline: true } };
  } else {
    // Incorrect PIN -> increment failed attempts
    const failed = (user.pinFailedAttempts || 0) + 1;
    const updates: Partial<UserProfile> = { pinFailedAttempts: failed };
    if (failed >= 5) {
      const lockUntil = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
      updates.pinLockedUntil = lockUntil;
      try {
        await updateDoc(userRef, updates);
      } catch (e) {
        console.warn('Lockout update warning:', e);
      }
      return {
        success: false,
        error: 'Too many incorrect attempts. This account is locked for 15 minutes for your security.',
      };
    } else {
      try {
        await updateDoc(userRef, updates);
      } catch (e) {
        console.warn('Attempt update warning:', e);
      }
      const remaining = 5 - failed;
      return {
        success: false,
        error: `Incorrect Secret PIN! ${remaining} attempt(s) remaining before security lockout.`,
      };
    }
  }
}

// 15-Day Account Deletion Schedule
export async function scheduleAccountDeletion(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const now = new Date();
  const deleteDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days later

  await updateDoc(userRef, {
    status: 'scheduled_for_deletion',
    deleteRequestedAt: now.toISOString(),
    deleteScheduledAt: deleteDate.toISOString(),
    isOnline: false,
    lastSeen: now.toISOString(),
  });
}

// Restore / Cancel Account Deletion
export async function restoreAccount(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    status: 'active',
    deleteRequestedAt: null,
    deleteScheduledAt: null,
    isOnline: true,
    lastSeen: new Date().toISOString(),
  });
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
