import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  updateDoc,
  deleteDoc,
  arrayUnion,
  increment,
  writeBatch,
  type DocumentReference,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';
import { extractChatTargetFromInput } from '../utils/accountShortcut';
import { ensureExistingUserPhoneInRegistry } from './phoneRegistryService';
import type {
  UserProfile,
  DirectoryUser,
  UserSecurityLock,
  ChatRoom,
  ChatMessage,
  MessageType,
  Friendship,
  FriendshipPartyPreview,
  GroupVisibility,
  GroupJoinPolicy,
  PublicGroupSummary,
  GroupJoinRequest,
} from '../types/chat';

export async function hashPhoneForDirectory(phone?: string | null): Promise<string | null> {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return null;
  const canonical = digits.length >= 10 ? digits.slice(-10) : digits;
  const data = new TextEncoder().encode(`anomah_dir_phone_v1:${canonical}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function directoryUserToUserProfile(u: DirectoryUser): UserProfile {
  return {
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
  };
}

function toDirectoryPayload(
  fields: Partial<UserProfile> & { userId: string; phoneLookupHash?: string | null }
): Record<string, unknown> {
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
  if (fields.phoneLookupHash !== undefined) {
    payload.phoneLookupHash = fields.phoneLookupHash;
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
  phoneNumber?: string | null;
  username?: string | null;
}): Promise<UserProfile> {
  const path = `users/${user.uid}`;
  try {
    const userRef = doc(db, 'users', user.uid);
    const [existingSnap, banSnap] = await Promise.all([
      getDoc(userRef),
      getDoc(doc(db, 'bans', user.uid)).catch(() => null),
    ]);
    const activeBanData = banSnap?.exists()
      ? (banSnap.data() as {
          isBanned?: boolean;
          reason?: string;
          bannedAt?: string;
          bannedBy?: string;
          bannedUntil?: string | null;
          bannedUntilMs?: number | null;
        })
      : null;

    const fallbackName = user.displayName || user.email?.split('@')[0] || 'User';
    const fallbackPhoto = user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`;
    const nowIso = new Date().toISOString();
    const cleanEmail = (user.email || '').trim().toLowerCase().slice(0, 150);
    const cleanPhone = (user.phoneNumber || '').trim().replace(/\s+/g, ' ').slice(0, 50);
    const cleanUsername = (user.username || '').trim().toLowerCase().replace(/^@/, '').slice(0, 50);

    if (existingSnap.exists()) {
      const data = existingSnap.data() as UserProfile;
      const resolvedName = (data.displayName || user.displayName || fallbackName).slice(0, 100);
      const resolvedPhoto = (data.photoURL || user.photoURL || fallbackPhoto).slice(0, 1000);
      const updated: Record<string, unknown> = {
        isOnline: activeBanData?.isBanned ? false : true,
        lastSeen: nowIso,
        displayName: resolvedName,
        photoURL: resolvedPhoto,
      };
      if (cleanEmail && data.email !== cleanEmail) {
        updated.email = cleanEmail;
      }
      if (cleanPhone.length >= 6 && !data.phoneNumber) {
        updated.phoneNumber = cleanPhone;
        if (!data.initialPhoneNumber) {
          updated.initialPhoneNumber = cleanPhone;
          updated.initialPhoneSetAt = nowIso;
        }
      } else if (data.phoneNumber && !data.initialPhoneNumber) {
        updated.initialPhoneNumber = data.phoneNumber;
        updated.initialPhoneSetAt = data.createdAt || nowIso;
      }
      await updateDoc(userRef, updated);

      const merged = {
        ...data,
        ...updated,
        ...(activeBanData?.isBanned
          ? {
              isBanned: true,
              banReason: activeBanData.reason || data.banReason,
              bannedAt: activeBanData.bannedAt || data.bannedAt,
              bannedBy: activeBanData.bannedBy || data.bannedBy,
              bannedUntil: activeBanData.bannedUntil ?? data.bannedUntil,
              bannedUntilMs: activeBanData.bannedUntilMs ?? data.bannedUntilMs,
            }
          : {}),
      } as UserProfile;
      const resolvedPhoneHash =
        merged.discoverableByPhone === true && merged.phoneNumber
          ? await hashPhoneForDirectory(merged.phoneNumber)
          : null;
      await syncDirectoryEntry(
        user.uid,
        toDirectoryPayload({
          userId: user.uid,
          displayName: merged.displayName,
          photoURL: merged.photoURL,
          about: merged.about,
          username: merged.username,
          phoneLookupHash: resolvedPhoneHash,
          status: merged.status || 'active',
          isOnline: Boolean(updated.isOnline),
          lastSeen: nowIso,
          isBanned: merged.isBanned,
        })
      );
      if (merged.phoneNumber && !merged.isBanned && merged.status !== 'deleted') {
        ensureExistingUserPhoneInRegistry(user.uid, merged.phoneNumber, merged.isBanned).catch(() => {});
      }
      return merged;
    } else {
      if (activeBanData?.isBanned) {
        return {
          userId: user.uid,
          displayName: fallbackName.slice(0, 100),
          email: cleanEmail,
          photoURL: fallbackPhoto.slice(0, 1000),
          status: 'active',
          isBanned: true,
          banReason: activeBanData.reason || 'Suspended by administrator',
          bannedAt: activeBanData.bannedAt || nowIso,
          bannedBy: activeBanData.bannedBy || 'admin',
          bannedUntil: activeBanData.bannedUntil || undefined,
          bannedUntilMs: activeBanData.bannedUntilMs ?? null,
          createdAt: nowIso,
        };
      }
      const newProfile: UserProfile = {
        userId: user.uid,
        displayName: fallbackName.slice(0, 100),
        email: cleanEmail,
        ...(cleanUsername.length >= 3 ? { username: cleanUsername } : {}),
        ...(cleanPhone.length >= 6
          ? {
              phoneNumber: cleanPhone,
              initialPhoneNumber: cleanPhone,
              initialPhoneSetAt: nowIso,
              phoneHistory: [],
              discoverableByPhone: false,
            }
          : {
              discoverableByPhone: false,
            }),
        photoURL: fallbackPhoto.slice(0, 1000),
        about: 'Available | Using Anomah Chat',
        status: 'active',
        isOnline: true,
        lastSeen: nowIso,
        createdAt: nowIso,
      };
      await setDoc(userRef, newProfile);
      await syncDirectoryEntry(
        user.uid,
        toDirectoryPayload({
          ...newProfile,
          phoneLookupHash: null,
        })
      );
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
        list.push(directoryUserToUserProfile(u));
      }
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
}

// Search-first privacy-safe discovery by @username, exact mobile hash, personal link, or name
export async function searchDirectoryUsers(
  currentUserId: string,
  rawQuery: string
): Promise<UserProfile[]> {
  const extractedLinkTarget = extractChatTargetFromInput(rawQuery);
  const trimmed = (extractedLinkTarget || rawQuery).trim();
  if (trimmed.length < 2) return [];

  const resultsMap = new Map<string, UserProfile>();
  const addResult = (u: DirectoryUser) => {
    if (u.userId === currentUserId) return;
    if (u.status !== 'active') return;
    if (!resultsMap.has(u.userId)) {
      resultsMap.set(u.userId, directoryUserToUserProfile(u));
    }
  };

  try {
    // 1. Exact uid:... deep-link lookup
    if (trimmed.toLowerCase().startsWith('uid:')) {
      const uidTarget = trimmed.slice(4).trim();
      if (uidTarget) {
        const snapDoc = await getDoc(doc(db, 'directory', uidTarget));
        if (snapDoc.exists()) {
          addResult(snapDoc.data() as DirectoryUser);
        }
      }
      return Array.from(resultsMap.values());
    }

    // 2. Exact privacy-preserving mobile number lookup (requires >= 7 digits, no letters)
    const digitsOnly = trimmed.replace(/\D/g, '');
    const looksLikePhone = !/[a-zA-Z@]/.test(trimmed) && digitsOnly.length >= 7;
    if (looksLikePhone) {
      const phoneHash = await hashPhoneForDirectory(trimmed);
      if (phoneHash) {
        const qPhone = query(
          collection(db, 'directory'),
          where('phoneLookupHash', '==', phoneHash),
          limit(5)
        );
        const snapPhone = await getDocs(qPhone);
        snapPhone.forEach((d) => addResult(d.data() as DirectoryUser));
      }
      return Array.from(resultsMap.values());
    }

    // 3. Exact @username lookup (works with single-field index)
    const cleanHandle = trimmed.toLowerCase().replace(/^@/, '');
    if (cleanHandle.length >= 3 && !cleanHandle.includes(' ')) {
      const qUsername = query(
        collection(db, 'directory'),
        where('username', '==', cleanHandle),
        limit(5)
      );
      const snapUser = await getDocs(qUsername);
      snapUser.forEach((d) => addResult(d.data() as DirectoryUser));
    }

    // 4. Bounded active directory name/handle match when not strictly searching with a full link
    if (!extractedLinkTarget && resultsMap.size < 15) {
      const qActive = query(
        collection(db, 'directory'),
        where('status', '==', 'active'),
        limit(50)
      );
      const snapActive = await getDocs(qActive);
      const needle = cleanHandle || trimmed.toLowerCase();
      snapActive.forEach((d) => {
        const u = d.data() as DirectoryUser;
        if (u.userId === currentUserId || u.status !== 'active') return;
        const nameMatch = u.displayName?.toLowerCase().includes(needle);
        const userMatch = Boolean(u.username && u.username.toLowerCase().includes(needle));
        if (nameMatch || userMatch) {
          addResult(u);
        }
      });
    }

    return Array.from(resultsMap.values()).slice(0, 20);
  } catch (error) {
    console.warn('Directory search notice:', error);
    return Array.from(resultsMap.values());
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
      lastMessageId: '',
      lastMessageText: 'Started conversation',
      lastMessageSenderId: 'system',
      lastMessageTime: nowIso,
      lastMessageReadBy: [],
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

// Create a group chat (supports Private Invite-Only and Public Direct/Approval groups)
export async function createGroupChat(
  currentUser: UserProfile,
  groupName: string,
  selectedMembers: UserProfile[],
  options?: {
    visibility?: GroupVisibility;
    joinPolicy?: GroupJoinPolicy;
    description?: string;
  }
): Promise<ChatRoom> {
  const path = 'chats';
  try {
    const dedupMap = new Map<string, UserProfile>();
    dedupMap.set(currentUser.userId, currentUser);
    selectedMembers.forEach((m) => {
      if (m.userId && m.userId !== currentUser.userId) {
        dedupMap.set(m.userId, m);
      }
    });
    const allMembers = Array.from(dedupMap.values());
    const participantIds = allMembers.map((m) => m.userId);
    const chatId = `group_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();
    const cleanName = groupName.trim().slice(0, 100);
    const cleanDescription = options?.description?.trim().slice(0, 300) || '';
    const visibility: GroupVisibility = options?.visibility === 'public' ? 'public' : 'private';
    const joinPolicy: GroupJoinPolicy =
      visibility === 'public'
        ? options?.joinPolicy === 'approval'
          ? 'approval'
          : 'direct'
        : 'invite_only';

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
      name: cleanName,
      ...(cleanDescription ? { description: cleanDescription } : {}),
      creatorId: currentUser.userId,
      adminIds: [currentUser.userId],
      visibility,
      joinPolicy,
      bannedUserIds: [],
      participantIds,
      participantDetails,
      lastMessageId: '',
      lastMessageText: `${currentUser.displayName} created ${visibility === 'public' ? 'public ' : ''}group "${cleanName}"`,
      lastMessageSenderId: 'system',
      lastMessageTime: nowIso,
      lastMessageReadBy: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const batch = writeBatch(db);
    const chatRef = doc(db, 'chats', chatId);
    batch.set(chatRef, newChat);

    if (visibility === 'public') {
      const publicSummary: PublicGroupSummary = {
        groupId: chatId,
        name: cleanName,
        ...(cleanDescription ? { description: cleanDescription } : {}),
        creatorId: currentUser.userId,
        adminIds: [currentUser.userId],
        joinPolicy: joinPolicy === 'approval' ? 'approval' : 'direct',
        memberCount: Math.max(1, Math.min(100, participantIds.length)),
        status: 'active',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      batch.set(doc(db, 'public_groups', chatId), publicSummary);
    }

    await batch.commit();
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

    let snippet = messageData.text;
    if (params.type === 'audio') snippet = '🎤 Voice note';
    if (params.type === 'image') snippet = '📷 Photo';

    const batch = writeBatch(db);
    batch.set(messageRef, messageData);
    batch.update(parentChatRef, {
      lastMessageId: messageId,
      lastMessageText: snippet.slice(0, 500),
      lastMessageSenderId: params.sender.userId,
      lastMessageTime: effectiveIso,
      lastMessageReadBy: [params.sender.userId],
      updatedAt: effectiveIso,
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

const inFlightReadMsgKeys = new Set<string>();
const inFlightChatLastReadKeys = new Set<string>();

// Mark messages as read by current user atomically with in-flight deduplication
export async function markChatMessagesAsRead(
  chatId: string,
  user: UserProfile,
  messages: ChatMessage[],
  chatRoom?: ChatRoom
) {
  if (!chatId || !user || !user.userId || !Array.isArray(messages) || messages.length === 0) {
    return;
  }

  const uid = user.userId;
  const toUpdate = messages.filter((msg) => {
    if (!msg?.id || msg.senderId === uid) return false;
    if (inFlightReadMsgKeys.has(`${chatId}:${msg.id}`)) return false;
    const inReadBy = Array.isArray(msg.readBy) && msg.readBy.includes(uid);
    const hasSeenDetails = Boolean(msg.seenByDetails && msg.seenByDetails[uid]);
    return !inReadBy || !hasSeenDetails;
  });

  const batchKeys: string[] = [];
  if (toUpdate.length > 0) {
    const nowIso = new Date().toISOString();
    const seenPayload = {
      displayName: (user.displayName || 'User').slice(0, 100),
      photoURL: (user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}`).slice(0, 1000),
      seenAt: nowIso,
    };

    try {
      const CHUNK_SIZE = 400;
      for (let i = 0; i < toUpdate.length; i += CHUNK_SIZE) {
        const chunk = toUpdate.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        for (const msg of chunk) {
          const key = `${chatId}:${msg.id}`;
          inFlightReadMsgKeys.add(key);
          batchKeys.push(key);
          const msgRef = doc(db, 'chats', chatId, 'messages', msg.id);
          batch.update(msgRef, {
            readBy: arrayUnion(uid),
            [`seenByDetails.${uid}`]: seenPayload,
          });
        }
        await batch.commit();
      }
    } catch (error) {
      console.warn('Mark read warning:', error);
    } finally {
      batchKeys.forEach((k) => inFlightReadMsgKeys.delete(k));
    }
  }

  // Sync inbox room lastMessageReadBy if the latest message from partner is not yet marked read on room doc
  const latestMsg = messages[messages.length - 1];
  const latestSenderId = chatRoom?.lastMessageSenderId || latestMsg?.senderId;
  const roomLastMsgId = chatRoom?.lastMessageId || '';
  const isSameLatestMsg =
    !roomLastMsgId || !latestMsg?.id || roomLastMsgId === latestMsg.id;
  const alreadySyncedOnRoom =
    isSameLatestMsg &&
    Array.isArray(chatRoom?.lastMessageReadBy) &&
    chatRoom.lastMessageReadBy.includes(uid);
  const roomSyncKey = `${chatId}:${uid}:${roomLastMsgId || latestMsg?.id || chatRoom?.lastMessageTime || ''}`;

  if (
    latestSenderId &&
    latestSenderId !== 'system' &&
    latestSenderId !== uid &&
    isSameLatestMsg &&
    !alreadySyncedOnRoom &&
    !inFlightChatLastReadKeys.has(roomSyncKey)
  ) {
    inFlightChatLastReadKeys.add(roomSyncKey);
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessageReadBy: arrayUnion(uid),
      });
    } catch (error) {
      console.warn('Chat lastMessageReadBy sync warning:', error);
    } finally {
      inFlightChatLastReadKeys.delete(roomSyncKey);
    }
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

async function deleteDocRefsInChunks(refs: DocumentReference[]): Promise<void> {
  const CHUNK_SIZE = 400;
  for (let i = 0; i < refs.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    refs.slice(i, i + CHUNK_SIZE).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

async function deleteCallsAndCandidates(chatId: string): Promise<void> {
  const callsSnap = await getDocs(collection(db, 'chats', chatId, 'calls')).catch(() => null);
  if (!callsSnap || callsSnap.empty) return;

  for (const callDoc of callsSnap.docs) {
    const [offerSnap, answerSnap] = await Promise.all([
      getDocs(collection(db, 'chats', chatId, 'calls', callDoc.id, 'offerCandidates')).catch(() => null),
      getDocs(collection(db, 'chats', chatId, 'calls', callDoc.id, 'answerCandidates')).catch(() => null),
    ]);
    const iceRefs = [
      ...(offerSnap?.docs.map((d) => d.ref) || []),
      ...(answerSnap?.docs.map((d) => d.ref) || []),
    ];
    if (iceRefs.length > 0) {
      await deleteDocRefsInChunks(iceRefs).catch(() => {});
    }
  }

  await deleteDocRefsInChunks(callsSnap.docs.map((d) => d.ref)).catch(() => {});
}

// Re-sync parent chat room preview snippet from the remaining newest message after deletions
export async function syncChatLastMessageFromLatest(
  chatId: string,
  deletedMessageId?: string
): Promise<void> {
  if (!chatId) return;
  try {
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);
    if (!chatSnap.exists()) return;
    const chatData = chatSnap.data() as ChatRoom;

    if (deletedMessageId && chatData.lastMessageId && chatData.lastMessageId !== deletedMessageId) {
      return;
    }

    const latestSnap = await getDocs(
      query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'desc'), limit(1))
    );

    if (latestSnap.empty) {
      const fallbackTime = chatData.createdAt || new Date().toISOString();
      await updateDoc(chatRef, {
        lastMessageId: '',
        lastMessageText: '',
        lastMessageSenderId: '',
        lastMessageTime: fallbackTime,
        lastMessageReadBy: [],
        updatedAt: fallbackTime,
      });
      return;
    }

    const latestDoc = latestSnap.docs[0];
    const latestMsg = latestDoc.data() as ChatMessage;
    const msgId = latestMsg.id || latestDoc.id;
    let snippet = (latestMsg.text || '').trim();
    if (latestMsg.type === 'audio') snippet = '🎤 Voice note';
    if (latestMsg.type === 'image') snippet = '📷 Photo';
    const msgTime = latestMsg.createdAt || chatData.createdAt || new Date().toISOString();

    await updateDoc(chatRef, {
      lastMessageId: msgId,
      lastMessageText: snippet.slice(0, 500),
      lastMessageSenderId: latestMsg.senderId || '',
      lastMessageTime: msgTime,
      lastMessageReadBy: Array.isArray(latestMsg.readBy) ? latestMsg.readBy.slice(0, 100) : [],
      updatedAt: msgTime,
    });
  } catch (error) {
    console.warn('Sync lastMessage after delete notice:', error);
  }
}

// Delete message
export async function deleteChatMessage(chatId: string, messageId: string) {
  const path = `chats/${chatId}/messages/${messageId}`;
  try {
    const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
    await deleteDoc(msgRef);
    await syncChatLastMessageFromLatest(chatId, messageId);
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

    if (data.type === 'direct') {
      // Purge all messages & calls in deterministic dm_* room in chunks so deleted history never resurrects
      const msgsSnap = await getDocs(collection(db, 'chats', chatId, 'messages'));
      if (!msgsSnap.empty) {
        await deleteDocRefsInChunks(msgsSnap.docs.map((d) => d.ref));
      }

      await deleteCallsAndCandidates(chatId);
      await deleteDoc(chatRef);
      return;
    }

    const remaining = (data.participantIds || []).filter((id) => id !== currentUserId);
    if (remaining.length === 0) {
      await deleteGroupChatPermanently(chatId);
    } else {
      await leaveGroupChat(chatId, currentUserId);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Add new members to an existing group (also unbans if admin explicitly re-adds)
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
    const addedSet = new Set<string>();

    newMembers.forEach((m) => {
      currentIds.add(m.userId);
      addedSet.add(m.userId);
      details[m.userId] = {
        displayName: m.displayName,
        photoURL: m.photoURL || '',
        email: m.email || '',
      };
    });

    const nextIds = Array.from(currentIds);
    const nextBanned = (data.bannedUserIds || []).filter((id) => !addedSet.has(id));
    const nowIso = new Date().toISOString();
    const addedNames = newMembers.map((m) => m.displayName).join(', ');

    await updateDoc(chatRef, {
      participantIds: nextIds,
      participantDetails: details,
      bannedUserIds: nextBanned,
      lastMessageId: '',
      lastMessageText: `${addedByName} added ${addedNames}`.slice(0, 500),
      lastMessageSenderId: 'system',
      lastMessageTime: nowIso,
      lastMessageReadBy: [],
      updatedAt: nowIso,
    });

    if (data.visibility === 'public') {
      await updateDoc(doc(db, 'public_groups', chatId), {
        memberCount: Math.max(1, Math.min(100, nextIds.length)),
        updatedAt: nowIso,
      }).catch(() => {});
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

// Remove (or optionally ban from re-joining public group) a member from a group (Admin only)
export async function removeGroupMember(
  chatId: string,
  memberId: string,
  removedByName?: string,
  alsoBanFromRejoin = false
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
    const nextBanned = alsoBanFromRejoin
      ? Array.from(new Set([...(data.bannedUserIds || []), memberId]))
      : (data.bannedUserIds || []);
    const memberName = data.participantDetails?.[memberId]?.displayName || 'Member';
    const nowIso = new Date().toISOString();

    await updateDoc(chatRef, {
      participantIds: remainingIds,
      adminIds: remainingAdmins,
      bannedUserIds: nextBanned,
      lastMessageId: '',
      lastMessageText: `${removedByName || 'Admin'} removed ${memberName}${alsoBanFromRejoin ? ' (banned)' : ''}`.slice(0, 500),
      lastMessageSenderId: 'system',
      lastMessageTime: nowIso,
      lastMessageReadBy: [],
      updatedAt: nowIso,
    });

    if (data.visibility === 'public') {
      await updateDoc(doc(db, 'public_groups', chatId), {
        memberCount: Math.max(1, Math.min(100, remainingIds.length)),
        adminIds: remainingAdmins.length > 0 ? remainingAdmins : [data.creatorId || remainingIds[0]].filter(Boolean),
        updatedAt: nowIso,
      }).catch(() => {});
    }
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
    const nextAdmins = Array.from(currentAdmins);
    const nowIso = new Date().toISOString();

    await updateDoc(chatRef, {
      adminIds: nextAdmins,
      updatedAt: nowIso,
    });

    if (data.visibility === 'public') {
      await updateDoc(doc(db, 'public_groups', chatId), {
        adminIds: nextAdmins,
        updatedAt: nowIso,
      }).catch(() => {});
    }
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
    const nowIso = new Date().toISOString();

    await updateDoc(chatRef, {
      adminIds: currentAdmins,
      updatedAt: nowIso,
    });

    if (data.visibility === 'public') {
      await updateDoc(doc(db, 'public_groups', chatId), {
        adminIds: currentAdmins.length > 0 ? currentAdmins : [data.creatorId].filter(Boolean),
        updatedAt: nowIso,
      }).catch(() => {});
    }
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
      lastMessageId: '',
      lastMessageText: `${userName || 'A member'} left the group`.slice(0, 500),
      lastMessageSenderId: 'system',
      lastMessageTime: nowIso,
      lastMessageReadBy: [],
      updatedAt: nowIso,
    });

    if (data.visibility === 'public') {
      await updateDoc(doc(db, 'public_groups', chatId), {
        memberCount: Math.max(1, Math.min(100, remainingIds.length)),
        adminIds: remainingAdmins,
        updatedAt: nowIso,
      }).catch(() => {});
    }
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
    if (!msgsSnap.empty) {
      await deleteDocRefsInChunks(msgsSnap.docs.map((docItem) => docItem.ref));
    }

    const joinReqSnap = await getDocs(collection(db, 'chats', chatId, 'join_requests')).catch(() => null);
    if (joinReqSnap && !joinReqSnap.empty) {
      await deleteDocRefsInChunks(joinReqSnap.docs.map((docItem) => docItem.ref)).catch(() => {});
    }

    await deleteCallsAndCandidates(chatId);
    await deleteDoc(doc(db, 'public_groups', chatId)).catch(() => {});

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
    const cleanTitle = newTitle.trim().slice(0, 100);
    const chatRef = doc(db, 'chats', chatId);
    const nowIso = new Date().toISOString();
    await updateDoc(chatRef, {
      name: cleanTitle,
      updatedAt: nowIso,
    });
    await updateDoc(doc(db, 'public_groups', chatId), {
      name: cleanTitle,
      updatedAt: nowIso,
    }).catch(() => {});
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
    } catch {
      // Fallback if composite index on (username, status) is not provisioned yet
      const qFallback = query(
        collection(db, 'directory'),
        where('status', 'in', ['active', 'scheduled_for_deletion'])
      );
      const snap = await getDocs(qFallback);
      const matches = snap.docs.filter(
        (d) => ((d.data() as DirectoryUser).username || '').toLowerCase() === clean
      );
      if (matches.length === 0) return true;
      if (currentUserId && matches.length === 1 && matches[0].id === currentUserId) {
        return true;
      }
      return false;
    }
  } catch (err) {
    console.warn('Error checking username:', err);
    return false;
  }
}

// Indexed lookup in directory by username, uid:..., or UID
export async function findDirectoryUserByIdentifier(identifier: string): Promise<DirectoryUser | null> {
  const extracted = extractChatTargetFromInput(identifier);
  const rawInput = (extracted || identifier).trim();
  const isUidPrefix = rawInput.toLowerCase().startsWith('uid:');
  const raw = isUidPrefix ? rawInput.slice(4).trim() : rawInput.replace(/^@/, '');
  const clean = raw.toLowerCase();
  if (!clean) return null;

  try {
    if (!isUidPrefix) {
      const qUsername = query(
        collection(db, 'directory'),
        where('username', '==', clean),
        limit(3)
      );
      const snapUser = await getDocs(qUsername);
      const activeMatch = snapUser.docs
        .map((d) => d.data() as DirectoryUser)
        .find((u) => u.status === 'active');
      if (activeMatch) {
        return activeMatch;
      }
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
// QUICK APP-LOCK PIN (Client Screen-Lock via PBKDF2-SHA256 + Fail-Closed Guard)
// ------------------------------------------------------------------

const PIN_PBKDF2_PREFIX = 'pbkdf2$';
const PIN_PBKDF2_ITERATIONS = 120000;
const inMemoryPinGuard = new Map<string, { failedCount: number; lockedUntil: number }>();

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateSalt(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return `${PIN_PBKDF2_PREFIX}${bytesToHex(arr)}`;
}

export async function hashAppLockPin(pin: string, salt: string): Promise<string> {
  const cleanPin = pin.trim();
  const encoder = new TextEncoder();
  if (salt.startsWith(PIN_PBKDF2_PREFIX)) {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(cleanPin),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    const derived = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: encoder.encode(salt),
        iterations: PIN_PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );
    return bytesToHex(new Uint8Array(derived));
  }
  const data = encoder.encode(`${salt}:${cleanPin}`);
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
  inMemoryPinGuard.delete(userId);
  try {
    localStorage.setItem(`anomah_app_lock_${userId}`, JSON.stringify(payload));
    localStorage.removeItem(`anomah_app_lock_guard_${userId}`);
  } catch {
    // ignore storage quota
  }
}

export async function removeAppLockPin(userId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'private', 'security')).catch(() => {});
  await updateDoc(doc(db, 'users', userId), { hasAppLockPin: false });
  inMemoryPinGuard.delete(userId);
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
  const memGuard = inMemoryPinGuard.get(userId);
  let failedCount = memGuard?.failedCount || 0;
  let lockedUntil = memGuard?.lockedUntil || 0;
  try {
    const raw = localStorage.getItem(guardKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      failedCount = Math.max(failedCount, Number(parsed.failedCount || 0));
      lockedUntil = Math.max(lockedUntil, Number(parsed.lockedUntil || 0));
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
  let securityDocExplicitlyMissing = false;
  try {
    const snap = await getDoc(doc(db, 'users', userId, 'private', 'security'));
    if (snap.exists()) {
      lockConfig = snap.data() as UserSecurityLock;
      try {
        localStorage.setItem(`anomah_app_lock_${userId}`, JSON.stringify(lockConfig));
      } catch {
        // ignore storage quota
      }
    } else {
      securityDocExplicitlyMissing = true;
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
    if (securityDocExplicitlyMissing) {
      try {
        const userSnap = await getDoc(doc(db, 'users', userId));
        if (userSnap.exists() && (userSnap.data() as UserProfile).hasAppLockPin === false) {
          inMemoryPinGuard.delete(userId);
          return { success: true };
        }
      } catch {
        // Fail closed below
      }
    }
    return {
      success: false,
      error: 'Unable to verify App-Lock configuration right now. Check your connection or sign out and sign in again.',
    };
  }

  const candidateHash = await hashAppLockPin(enteredPin, lockConfig.salt);
  if (candidateHash === lockConfig.pinHash) {
    inMemoryPinGuard.delete(userId);
    try {
      localStorage.removeItem(guardKey);
    } catch {}
    return { success: true };
  }

  const nextFailed = failedCount + 1;
  const nextLockedUntil = nextFailed >= 5 ? Date.now() + 5 * 60 * 1000 : 0;
  inMemoryPinGuard.set(userId, { failedCount: nextFailed, lockedUntil: nextLockedUntil });
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

// ------------------------------------------------------------------
// FRIEND REQUESTS & ACCEPTED FRIENDSHIP GATE
// ------------------------------------------------------------------

export function getFriendshipId(uidA: string, uidB: string): string {
  const [minId, maxId] = [uidA, uidB].sort();
  return `pair_${minId}_${maxId}`;
}

function toFriendshipPreview(user: {
  displayName?: string;
  photoURL?: string;
  username?: string;
}): FriendshipPartyPreview {
  const preview: FriendshipPartyPreview = {
    displayName: (user.displayName || 'User').slice(0, 100),
    photoURL: (user.photoURL || '').slice(0, 1000),
  };
  if (user.username && user.username.trim()) {
    preview.username = user.username.trim().toLowerCase().slice(0, 50);
  }
  return preview;
}

export function subscribeToUserFriendships(
  userId: string,
  onUpdate: (friendships: Friendship[]) => void
): Unsubscribe {
  const q = query(collection(db, 'friendships'), where('userIds', 'array-contains', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: Friendship[] = [];
      snapshot.forEach((docItem) => {
        list.push(docItem.data() as Friendship);
      });
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      onUpdate(list);
    },
    (error) => {
      console.warn('Friendships subscribe notice:', error);
    }
  );
}

export async function getFriendshipBetween(uidA: string, uidB: string): Promise<Friendship | null> {
  if (!uidA || !uidB || uidA === uidB) return null;
  try {
    const pairId = getFriendshipId(uidA, uidB);
    const snap = await getDoc(doc(db, 'friendships', pairId));
    if (!snap.exists()) return null;
    return snap.data() as Friendship;
  } catch (error) {
    console.warn('Get friendship notice:', error);
    return null;
  }
}

export async function sendFriendRequest(
  currentUser: UserProfile,
  partner: Pick<UserProfile, 'userId' | 'displayName' | 'photoURL' | 'username' | 'isBanned'>,
  source: 'search' | 'qr' | 'link' = 'search'
): Promise<Friendship> {
  if (currentUser.userId === partner.userId) {
    throw new Error('Cannot send friend request to yourself.');
  }
  if (partner.isBanned) {
    throw new Error('This user account is currently suspended.');
  }

  const pairId = getFriendshipId(currentUser.userId, partner.userId);
  const path = `friendships/${pairId}`;
  const ref = doc(db, 'friendships', pairId);
  const nowIso = new Date().toISOString();

  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      const existing = existingSnap.data() as Friendship;
      if (existing.status === 'blocked') {
        throw new Error(
          existing.blockedBy === currentUser.userId
            ? 'You have blocked this user. Unblock them first from your Friends & Requests list.'
            : 'You cannot send a friend request to this user.'
        );
      }
      if (existing.status === 'accepted' || existing.status === 'pending') {
        return existing;
      }
      // status === 'declined': resend fresh request
      await updateDoc(ref, {
        requesterId: currentUser.userId,
        receiverId: partner.userId,
        status: 'pending',
        source,
        requesterProfile: toFriendshipPreview(currentUser),
        receiverProfile: toFriendshipPreview(partner),
        updatedAt: nowIso,
      });
      return {
        ...existing,
        requesterId: currentUser.userId,
        receiverId: partner.userId,
        status: 'pending',
        source,
        requesterProfile: toFriendshipPreview(currentUser),
        receiverProfile: toFriendshipPreview(partner),
        updatedAt: nowIso,
      };
    }

    const sortedIds = [currentUser.userId, partner.userId].sort();
    const payload: Friendship = {
      id: pairId,
      userIds: sortedIds,
      requesterId: currentUser.userId,
      receiverId: partner.userId,
      status: 'pending',
      blockedBy: null,
      source,
      requesterProfile: toFriendshipPreview(currentUser),
      receiverProfile: toFriendshipPreview(partner),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await setDoc(ref, payload);
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function acceptFriendRequest(
  friendshipId: string,
  acceptor: Pick<UserProfile, 'userId' | 'displayName' | 'photoURL' | 'username'>
): Promise<void> {
  const path = `friendships/${friendshipId}`;
  try {
    const nowIso = new Date().toISOString();
    await updateDoc(doc(db, 'friendships', friendshipId), {
      status: 'accepted',
      receiverProfile: toFriendshipPreview(acceptor),
      updatedAt: nowIso,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function declineFriendRequest(friendshipId: string): Promise<void> {
  const path = `friendships/${friendshipId}`;
  try {
    await updateDoc(doc(db, 'friendships', friendshipId), {
      status: 'declined',
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function cancelFriendRequest(friendshipId: string): Promise<void> {
  const path = `friendships/${friendshipId}`;
  try {
    await deleteDoc(doc(db, 'friendships', friendshipId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

export async function unfriendUser(friendshipId: string): Promise<void> {
  const path = `friendships/${friendshipId}`;
  try {
    await updateDoc(doc(db, 'friendships', friendshipId), {
      status: 'declined',
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function blockUser(
  currentUser: UserProfile,
  partner: Pick<UserProfile, 'userId' | 'displayName' | 'photoURL' | 'username'>
): Promise<void> {
  const pairId = getFriendshipId(currentUser.userId, partner.userId);
  const path = `friendships/${pairId}`;
  const ref = doc(db, 'friendships', pairId);
  const nowIso = new Date().toISOString();

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const sortedIds = [currentUser.userId, partner.userId].sort();
      const pendingPayload: Friendship = {
        id: pairId,
        userIds: sortedIds,
        requesterId: currentUser.userId,
        receiverId: partner.userId,
        status: 'pending',
        blockedBy: null,
        source: 'search',
        requesterProfile: toFriendshipPreview(currentUser),
        receiverProfile: toFriendshipPreview(partner),
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      await setDoc(ref, pendingPayload);
    }
    await updateDoc(ref, {
      status: 'blocked',
      blockedBy: currentUser.userId,
      updatedAt: nowIso,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function unblockUser(friendshipId: string): Promise<void> {
  const path = `friendships/${friendshipId}`;
  try {
    await updateDoc(doc(db, 'friendships', friendshipId), {
      status: 'declined',
      blockedBy: null,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

// ------------------------------------------------------------------
// PUBLIC & PRIVATE GROUP DISCOVERY, DIRECT JOIN & APPROVAL REQUESTS
// ------------------------------------------------------------------

export async function searchPublicGroups(rawQuery = ''): Promise<PublicGroupSummary[]> {
  try {
    const q = query(
      collection(db, 'public_groups'),
      where('status', '==', 'active'),
      limit(50)
    );
    const snap = await getDocs(q);
    const all = snap.docs.map((d) => d.data() as PublicGroupSummary);
    const needle = rawQuery.trim().toLowerCase();
    const filtered = needle
      ? all.filter(
          (g) =>
            g.name.toLowerCase().includes(needle) ||
            (g.description || '').toLowerCase().includes(needle) ||
            g.groupId.toLowerCase() === needle
        )
      : all;
    return filtered.sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));
  } catch (error) {
    console.warn('Public groups search notice:', error);
    return [];
  }
}

export async function getPublicGroupSummary(groupId: string): Promise<PublicGroupSummary | null> {
  const cleanId = groupId.trim();
  if (!cleanId) return null;
  try {
    const snap = await getDoc(doc(db, 'public_groups', cleanId));
    if (!snap.exists()) return null;
    const data = snap.data() as PublicGroupSummary;
    return data.status === 'active' ? data : null;
  } catch (error) {
    console.warn('Public group lookup notice:', error);
    return null;
  }
}

export async function joinPublicGroupDirect(groupId: string, user: UserProfile): Promise<ChatRoom> {
  const path = `chats/${groupId}`;
  try {
    const pubRef = doc(db, 'public_groups', groupId);
    const pubSnap = await getDoc(pubRef);
    if (!pubSnap.exists()) {
      throw new Error('This group is private or no longer exists.');
    }
    const pub = pubSnap.data() as PublicGroupSummary;
    if (pub.status !== 'active') {
      throw new Error('This public group is no longer active.');
    }
    if (pub.joinPolicy !== 'direct') {
      throw new Error('This group requires admin approval to join.');
    }

    const nowIso = new Date().toISOString();
    const chatRef = doc(db, 'chats', groupId);
    await updateDoc(chatRef, {
      participantIds: arrayUnion(user.userId),
      [`participantDetails.${user.userId}`]: {
        displayName: user.displayName,
        photoURL: user.photoURL || '',
        email: user.email || '',
      },
      updatedAt: nowIso,
    });

    await updateDoc(pubRef, {
      memberCount: increment(1),
      updatedAt: nowIso,
    }).catch(() => {});

    const updatedChatSnap = await getDoc(chatRef);
    if (updatedChatSnap.exists()) {
      return { id: groupId, ...(updatedChatSnap.data() as Omit<ChatRoom, 'id'>) };
    }
    throw new Error('Joined group, please refresh your chat list.');
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function requestToJoinPublicGroup(
  groupId: string,
  user: UserProfile,
  message?: string
): Promise<GroupJoinRequest> {
  const path = `chats/${groupId}/join_requests/${user.userId}`;
  const reqRef = doc(db, 'chats', groupId, 'join_requests', user.userId);
  const nowIso = new Date().toISOString();
  try {
    const existingSnap = await getDoc(reqRef);
    const cleanMsg = (message || '').trim().slice(0, 200);
    if (existingSnap.exists()) {
      const existing = existingSnap.data() as GroupJoinRequest;
      if (existing.status === 'pending') return existing;
      if (existing.status === 'declined') {
        await updateDoc(reqRef, {
          status: 'pending',
          ...(cleanMsg ? { message: cleanMsg } : {}),
          updatedAt: nowIso,
        });
        return {
          ...existing,
          status: 'pending',
          ...(cleanMsg ? { message: cleanMsg } : {}),
          updatedAt: nowIso,
        };
      }
    }

    const payload: GroupJoinRequest = {
      userId: user.userId,
      chatId: groupId,
      displayName: (user.displayName || 'User').slice(0, 100),
      ...(user.photoURL ? { photoURL: user.photoURL.slice(0, 1000) } : {}),
      ...(user.username ? { username: user.username.slice(0, 50) } : {}),
      ...(cleanMsg ? { message: cleanMsg } : {}),
      status: 'pending',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await setDoc(reqRef, payload);
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function getMyGroupJoinRequest(
  groupId: string,
  userId: string
): Promise<GroupJoinRequest | null> {
  if (!groupId || !userId) return null;
  try {
    const snap = await getDoc(doc(db, 'chats', groupId, 'join_requests', userId));
    return snap.exists() ? (snap.data() as GroupJoinRequest) : null;
  } catch {
    return null;
  }
}

export function subscribeToGroupJoinRequests(
  groupId: string,
  onUpdate: (requests: GroupJoinRequest[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'chats', groupId, 'join_requests'),
    where('status', '==', 'pending')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) => d.data() as GroupJoinRequest);
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(list);
    },
    (error) => {
      console.warn('Join requests subscribe notice:', error);
    }
  );
}

export async function approveGroupJoinRequest(
  chatId: string,
  request: GroupJoinRequest,
  adminName: string
): Promise<void> {
  const path = `chats/${chatId}`;
  try {
    const chatRef = doc(db, 'chats', chatId);
    const snap = await getDoc(chatRef);
    if (!snap.exists()) throw new Error('Group not found');
    const data = snap.data() as ChatRoom;

    const currentIds = new Set(data.participantIds || []);
    currentIds.add(request.userId);
    const nextIds = Array.from(currentIds);
    const details = { ...(data.participantDetails || {}) };
    details[request.userId] = {
      displayName: request.displayName,
      photoURL: request.photoURL || '',
      email: '',
    };
    const nextBanned = (data.bannedUserIds || []).filter((id) => id !== request.userId);
    const nowIso = new Date().toISOString();

    await updateDoc(chatRef, {
      participantIds: nextIds,
      participantDetails: details,
      bannedUserIds: nextBanned,
      lastMessageId: '',
      lastMessageText: `${adminName} approved ${request.displayName} to join`.slice(0, 500),
      lastMessageSenderId: 'system',
      lastMessageTime: nowIso,
      lastMessageReadBy: [],
      updatedAt: nowIso,
    });

    await updateDoc(doc(db, 'chats', chatId, 'join_requests', request.userId), {
      status: 'approved',
      updatedAt: nowIso,
    });

    if (data.visibility === 'public') {
      await updateDoc(doc(db, 'public_groups', chatId), {
        memberCount: Math.max(1, Math.min(100, nextIds.length)),
        updatedAt: nowIso,
      }).catch(() => {});
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function declineGroupJoinRequest(chatId: string, reqUserId: string): Promise<void> {
  const path = `chats/${chatId}/join_requests/${reqUserId}`;
  try {
    await updateDoc(doc(db, 'chats', chatId, 'join_requests', reqUserId), {
      status: 'declined',
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function updateGroupSettings(
  chatId: string,
  updates: {
    name?: string;
    description?: string;
    visibility: GroupVisibility;
    joinPolicy: GroupJoinPolicy;
  }
): Promise<void> {
  const path = `chats/${chatId}`;
  try {
    const chatRef = doc(db, 'chats', chatId);
    const snap = await getDoc(chatRef);
    if (!snap.exists()) throw new Error('Group not found');
    const data = snap.data() as ChatRoom;

    const nowIso = new Date().toISOString();
    const resolvedName = (updates.name?.trim() || data.name || 'Group').slice(0, 100);
    const resolvedDesc = (updates.description !== undefined ? updates.description : (data.description || ''))
      .trim()
      .slice(0, 300);
    const resolvedJoinPolicy: GroupJoinPolicy =
      updates.visibility === 'public'
        ? updates.joinPolicy === 'approval'
          ? 'approval'
          : 'direct'
        : 'invite_only';

    await updateDoc(chatRef, {
      name: resolvedName,
      description: resolvedDesc,
      visibility: updates.visibility,
      joinPolicy: resolvedJoinPolicy,
      updatedAt: nowIso,
    });

    const pubRef = doc(db, 'public_groups', chatId);
    if (updates.visibility === 'public') {
      const creatorId = data.creatorId || data.participantIds?.[0] || '';
      const adminIds =
        data.adminIds && data.adminIds.length > 0 ? data.adminIds : creatorId ? [creatorId] : [];
      const summary: PublicGroupSummary = {
        groupId: chatId,
        name: resolvedName,
        ...(resolvedDesc ? { description: resolvedDesc } : {}),
        ...(data.groupPhoto ? { groupPhoto: data.groupPhoto } : {}),
        creatorId,
        adminIds,
        joinPolicy: resolvedJoinPolicy === 'approval' ? 'approval' : 'direct',
        memberCount: Math.max(1, Math.min(100, (data.participantIds || []).length)),
        status: 'active',
        createdAt: data.createdAt || nowIso,
        updatedAt: nowIso,
      };
      await setDoc(pubRef, summary, { merge: true });
    } else {
      await deleteDoc(pubRef).catch(() => {});
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}
