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

// Update presence (online / lastSeen)
export async function setPresence(userId: string, isOnline: boolean) {
  const path = `users/${userId}`;
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      isOnline,
      lastSeen: new Date().toISOString(),
    });
  } catch (error) {
    // Graceful error handling for presence teardown
    console.warn('Presence update notice:', error);
  }
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
      handleFirestoreError(error, OperationType.GET, path);
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
          photoURL: currentUser.photoURL,
          email: currentUser.email,
        },
        [partner.userId]: {
          displayName: partner.displayName,
          photoURL: partner.photoURL,
          email: partner.email,
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
      handleFirestoreError(error, OperationType.GET, path);
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
    const parentChatRef = doc(db, 'chats', params.chatId);
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

// Mark messages as read by current user (Double Blue Ticks)
export async function markChatMessagesAsRead(chatId: string, userId: string, unreadMessages: ChatMessage[]) {
  const path = `chats/${chatId}/messages`;
  try {
    for (const msg of unreadMessages) {
      if (!msg.readBy.includes(userId)) {
        const msgRef = doc(db, 'chats', chatId, 'messages', msg.id);
        await updateDoc(msgRef, {
          readBy: [...msg.readBy, userId],
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
