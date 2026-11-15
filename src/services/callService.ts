import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { CallSignalData, ChatMessage, ChatRoom, UserProfile } from '../types/chat';

export const RTC_ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

function sanitizeCandidate(candidate: RTCIceCandidate): Record<string, unknown> {
  const json = candidate.toJSON();
  return {
    candidate: json.candidate || '',
    sdpMid: json.sdpMid ?? null,
    sdpMLineIndex: typeof json.sdpMLineIndex === 'number' ? json.sdpMLineIndex : null,
    usernameFragment: json.usernameFragment ?? null,
  };
}

export async function createCallSignal(params: {
  chatId: string;
  caller: UserProfile;
  calleeId: string;
  calleeName: string;
  calleePhoto?: string;
  type: 'audio' | 'video';
  offer: RTCSessionDescriptionInit;
}): Promise<string> {
  const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const nowIso = new Date().toISOString();
  const callRef = doc(db, 'chats', params.chatId, 'calls', callId);

  const payload: CallSignalData = {
    id: callId,
    chatId: params.chatId,
    callerId: params.caller.userId,
    callerName: params.caller.displayName.slice(0, 100),
    callerPhoto: (params.caller.photoURL || '').slice(0, 1000),
    calleeId: params.calleeId,
    calleeName: params.calleeName.slice(0, 100),
    calleePhoto: (params.calleePhoto || '').slice(0, 1000),
    type: params.type,
    status: 'ringing',
    offer: {
      type: params.offer.type || 'offer',
      sdp: params.offer.sdp || '',
    },
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await setDoc(callRef, payload);
  return callId;
}

export async function answerCallSignal(
  chatId: string,
  callId: string,
  answer: RTCSessionDescriptionInit
): Promise<void> {
  const callRef = doc(db, 'chats', chatId, 'calls', callId);
  await updateDoc(callRef, {
    status: 'answered',
    answer: {
      type: answer.type || 'answer',
      sdp: answer.sdp || '',
    },
    updatedAt: new Date().toISOString(),
  });
}

export async function updateCallSignalStatus(
  chatId: string,
  callId: string,
  status: 'declined' | 'ended' | 'missed'
): Promise<void> {
  if (!chatId || !callId) return;
  try {
    const callRef = doc(db, 'chats', chatId, 'calls', callId);
    await updateDoc(callRef, {
      status,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Call status update notice:', err);
  }
}

export async function addIceCandidateSignal(
  chatId: string,
  callId: string,
  side: 'offerCandidates' | 'answerCandidates',
  candidate: RTCIceCandidate
): Promise<void> {
  const candId = `cand_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const candRef = doc(db, 'chats', chatId, 'calls', callId, side, candId);
  await setDoc(candRef, sanitizeCandidate(candidate));
}

export function subscribeToCallSignal(
  chatId: string,
  callId: string,
  onUpdate: (data: CallSignalData | null) => void
): Unsubscribe {
  const callRef = doc(db, 'chats', chatId, 'calls', callId);
  return onSnapshot(
    callRef,
    (snap) => {
      onUpdate(snap.exists() ? (snap.data() as CallSignalData) : null);
    },
    (err) => {
      console.warn('Call signal listener notice:', err);
    }
  );
}

export function subscribeToIceCandidates(
  chatId: string,
  callId: string,
  side: 'offerCandidates' | 'answerCandidates',
  onCandidate: (candidateInit: RTCIceCandidateInit) => void
): Unsubscribe {
  const seen = new Set<string>();
  const colRef = collection(db, 'chats', chatId, 'calls', callId, side);
  return onSnapshot(
    colRef,
    (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === 'added' && !seen.has(change.doc.id)) {
          seen.add(change.doc.id);
          const data = change.doc.data() as RTCIceCandidateInit;
          if (data?.candidate) {
            onCandidate(data);
          }
        }
      });
    },
    (err) => {
      console.warn('ICE candidate listener notice:', err);
    }
  );
}

/**
 * Listens across the user's active direct chats for fresh incoming ringing calls.
 */
export function subscribeToIncomingDirectCalls(
  currentUserId: string,
  directChats: ChatRoom[],
  onIncoming: (call: CallSignalData | null) => void
): Unsubscribe {
  const activeByChat = new Map<string, CallSignalData>();

  const emitLatest = () => {
    const now = Date.now();
    const candidates = Array.from(activeByChat.values()).filter((c) => {
      const ageMs = now - new Date(c.createdAt).getTime();
      return c.status === 'ringing' && c.calleeId === currentUserId && ageMs < 65000;
    });
    candidates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    onIncoming(candidates[0] || null);
  };

  const unsubscribers: Unsubscribe[] = directChats
    .filter((c) => c.type === 'direct' && !c.isSuspended)
    .map((chat) => {
      const q = query(
        collection(db, 'chats', chat.id, 'calls'),
        where('status', '==', 'ringing')
      );
      return onSnapshot(
        q,
        (snap) => {
          let found: CallSignalData | null = null;
          snap.forEach((docSnap) => {
            const call = docSnap.data() as CallSignalData;
            const ageMs = Date.now() - new Date(call.createdAt).getTime();
            if (call.calleeId === currentUserId && ageMs < 65000) {
              if (!found || new Date(call.createdAt).getTime() > new Date(found.createdAt).getTime()) {
                found = call;
              }
            }
          });
          if (found) {
            activeByChat.set(chat.id, found);
          } else {
            activeByChat.delete(chat.id);
          }
          emitLatest();
        },
        (err) => {
          console.warn('Incoming call watcher notice:', err);
        }
      );
    });

  return () => {
    unsubscribers.forEach((u) => u());
  };
}

export function formatCallDurationCompact(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export async function logCallToChat(params: {
  chatId: string;
  callId: string;
  currentUser: UserProfile;
  callerId: string;
  callType: 'audio' | 'video';
  callStatus: 'completed' | 'missed' | 'declined' | 'cancelled';
  durationSeconds: number;
}): Promise<void> {
  if (!params.chatId || !params.callId || !params.currentUser?.userId) return;
  if (params.currentUser.isBanned) return;

  const safeCallId = params.callId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeCallId) return;
  const messageId = `calllog_${safeCallId}`.slice(0, 128);

  try {
    const parentChatRef = doc(db, 'chats', params.chatId);
    const parentSnap = await getDoc(parentChatRef);
    if (!parentSnap.exists()) return;
    const parentData = parentSnap.data() as ChatRoom;
    if (parentData.isSuspended) return;

    const messageRef = doc(db, 'chats', params.chatId, 'messages', messageId);
    const existingSnap = await getDoc(messageRef);
    if (existingSnap.exists()) return;

    const clientNowMs = Date.now();
    let lastTimeMs = 0;
    if (parentData.lastMessageTime) {
      const parsed = new Date(parentData.lastMessageTime).getTime();
      if (!isNaN(parsed) && parsed > 0) {
        lastTimeMs = parsed;
      }
    }
    const effectiveTimeMs = Math.max(clientNowMs, lastTimeMs + 1000);
    const effectiveIso = new Date(effectiveTimeMs).toISOString();
    const safeDuration = Math.max(0, Math.round(params.durationSeconds));

    const icon = params.callType === 'video' ? '📹' : '📞';
    const labelEn = params.callType === 'video' ? 'Video call' : 'Voice call';
    let summaryText = `${icon} ${labelEn}`;
    let inboxSnippet = summaryText;

    if (params.callStatus === 'completed') {
      const durText = formatCallDurationCompact(safeDuration);
      summaryText = `${icon} ${labelEn} · ${durText}`;
      inboxSnippet = summaryText;
    } else if (params.callStatus === 'declined') {
      summaryText = `${icon} Declined ${params.callType === 'video' ? 'video' : 'voice'} call`;
      inboxSnippet = summaryText;
    } else if (params.callStatus === 'missed') {
      summaryText = `${icon} Missed ${params.callType === 'video' ? 'video' : 'voice'} call`;
      inboxSnippet = summaryText;
    } else {
      summaryText = `${icon} Cancelled ${params.callType === 'video' ? 'video' : 'voice'} call`;
      inboxSnippet = `${icon} Missed ${params.callType === 'video' ? 'video' : 'voice'} call`;
    }

    const messageData: ChatMessage = {
      id: messageId,
      chatId: params.chatId,
      senderId: params.currentUser.userId,
      senderName: (params.currentUser.displayName || 'User').slice(0, 100),
      senderPhoto: (params.currentUser.photoURL || '').slice(0, 1000),
      text: summaryText,
      type: 'call',
      callId: safeCallId,
      callerId: params.callerId,
      callType: params.callType,
      callStatus: params.callStatus,
      callDuration: safeDuration,
      readBy: [params.currentUser.userId],
      createdAt: effectiveIso,
    };

    await setDoc(messageRef, messageData);
    await updateDoc(parentChatRef, {
      lastMessageText: inboxSnippet.slice(0, 500),
      lastMessageSenderId: params.currentUser.userId,
      lastMessageTime: effectiveIso,
      updatedAt: effectiveIso,
    });
  } catch (err) {
    console.warn('Call log write notice:', err);
  }
}
