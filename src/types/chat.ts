export type ThemeMode = 'deep-slate' | 'minimal-light' | 'telegram-blue';

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
  lastLoginAt?: string;
  lastExitAt?: string;
  totalActiveMinutes?: number;
  dailyActivity?: Record<string, number>; // date "YYYY-MM-DD" -> active minutes
  createdAt: string;
  // Account Deletion & 15-Day Grace Period
  status?: 'active' | 'scheduled_for_deletion' | 'deleted';
  deleteRequestedAt?: string;
  deleteScheduledAt?: string;
  // Theme Preference
  themePreference?: ThemeMode;
  // Super Admin & Moderation Controls
  role?: 'admin' | 'user';
  isBanned?: boolean;
  banReason?: string;
  bannedAt?: string;
  bannedBy?: string;
  bannedUntil?: string; // ISO timestamp when temporary suspension expires
  warningNotice?: string;
  warningIssuedAt?: string;
  warningDismissed?: boolean;
}

export interface PasswordRecoveryRequest {
  id: string;
  email: string;
  name?: string;
  username?: string;
  contactPhone?: string;
  details?: string;
  status: 'pending' | 'resolved' | 'dismissed';
  temporaryPassword?: string;
  temporaryPin?: string;
  adminNotes?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
}

export type ReportReason =
  | 'harassment'
  | 'hate_speech'
  | 'spam'
  | 'scam'
  | 'inappropriate'
  | 'impersonation'
  | 'other';

export interface UserReport {
  id: string;
  reporterId: string;
  reporterName: string;
  reporterEmail: string;
  targetUserId: string;
  targetUserName: string;
  targetUserEmail?: string;
  chatId?: string;
  messageId?: string;
  messageText?: string;
  reason: ReportReason;
  details: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
}

export type AnnouncementType = 'info' | 'warning' | 'alert' | 'update';

export interface SystemAnnouncement {
  id: string;
  title: string;
  content: string;
  type: AnnouncementType;
  active: boolean;
  createdAt: string;
  createdBy: string;
  authorName: string;
  expiresAt?: string;
}

export interface AdminAuditLog {
  id: string;
  adminEmail: string;
  action:
    | 'ban_user'
    | 'unban_user'
    | 'issue_warning'
    | 'clear_warning'
    | 'delete_message'
    | 'delete_chat'
    | 'resolve_report'
    | 'dismiss_report'
    | 'resolve_recovery'
    | 'dismiss_recovery'
    | 'reset_pin'
    | 'create_announcement'
    | 'toggle_announcement'
    | 'delete_announcement';
  targetId?: string;
  targetName?: string;
  details: string;
  timestamp: string;
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
  seenByDetails?: Record<string, {
    displayName: string;
    photoURL?: string;
    seenAt: string;
  }>;
  replyToId?: string;
  replyToText?: string;
  replyToSender?: string;
  replyToType?: MessageType;
  reactions?: Record<string, string[]>; // emoji -> array of userIds
  isEdited?: boolean;
  editedAt?: string;
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
    isBanned?: boolean;
  }>;
  isSuspended?: boolean;
  suspendedUserId?: string | null;
  suspendedUserName?: string | null;
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

