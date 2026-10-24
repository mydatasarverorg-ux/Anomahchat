export interface UserProfile {
  userId: string;
  displayName: string;
  email: string;
  photoURL: string;
  about?: string;
  username?: string;
  secretPin?: string;
  pinFailedAttempts?: number;
  pinLockedUntil?: string;
  isOnline?: boolean;
  lastSeen?: string;
  createdAt: string;
}

export type MessageType = 'text' | 'image' | 'audio' | 'file';

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  text: string;
  type: MessageType;
  mediaUrl?: string;
  audioDuration?: number;
  readBy: string[];
  replyToId?: string;
  replyToText?: string;
  replyToSender?: string;
  reactions?: Record<string, string[]>; // emoji -> array of userIds
  createdAt: string;
}

export interface ChatRoom {
  id: string;
  type: 'direct' | 'group';
  name?: string;
  participantIds: string[];
  participantDetails?: Record<string, {
    displayName: string;
    photoURL?: string;
    email: string;
  }>;
  lastMessageText?: string;
  lastMessageSenderId?: string;
  lastMessageTime?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CallSession {
  active: boolean;
  type: 'audio' | 'video';
  recipientName: string;
  recipientPhoto?: string;
  status: 'calling' | 'connected' | 'ended';
  isMuted: boolean;
  isVideoOff: boolean;
  durationSeconds: number;
}
