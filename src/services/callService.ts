import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { CallSignalData, ChatRoom, UserProfile } from '../types/chat';

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
