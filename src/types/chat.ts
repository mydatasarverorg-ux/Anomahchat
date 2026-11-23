export type ThemeMode = 'deep-slate' | 'minimal-light' | 'telegram-blue';

export interface PhoneChangeHistoryEntry {
  phone: string;
  previousPhone?: string;
  changedAt: string;
}

export interface UserDeviceLimits {
  mobile?: number;
  web?: number;
}

export type NewDeviceApprovalMode = 'off' | 'optional' | 'required';

export interface DeviceSession {
  deviceId: string;
  userId: string;
  platformCategory: 'mobile' | 'web';
  runtimeType: 'apk' | 'pwa' | 'web';
  deviceLabel: string;
  approxLocation?: string | null;
  status: 'active' | 'pending_approval' | 'rejected' | 'logged_out';
  isPrimaryTrusted?: boolean;
  adminAlertPending?: boolean;
  limitBlocked?: boolean;
  approvedByDeviceId?: string | null;
  rejectedByDeviceId?: string | null;
  rejectionNote?: string | null;
  approvalChallenge?: string | null;
  approvalChallengeExpiresAtMs?: number | null;
  approvalMethod?: 'device_tap' | 'qr_scan' | 'app_lock_pin' | 'admin' | null;
  qrApprovedAt?: string | null;
  createdAt: string;
  lastActiveAt: string;
  loginAt?: string;
}

export interface AppSecuritySettings {
  defaultMobileLimit: number;
  defaultWebLimit: number;
  requireApprovalForNewDevice: boolean;
  newDeviceApprovalMode?: NewDeviceApprovalMode;
  defaultOptionalApproval?: boolean;
  enableMagicLinkLogin?: boolean;
  enableQrDeviceApproval?: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface PublicAuthFlags {
  enableMagicLinkLogin: boolean;
  enableQrDeviceApproval: boolean;
  updatedAt: string;
}

export interface AdminSecuritySettings {
  adminMobileLimit: number;
  adminWebLimit: number;
  adminLoginMode: 'fast_alert' | 'strict_approval';
  updatedAt: string;
  updatedBy: string;
}

export interface UserProfile {
  userId: string;
  displayName: string;
  email: string;
  phoneNumber?: string;
  initialPhoneNumber?: string;
  initialPhoneSetAt?: string;
  phoneHistory?: PhoneChangeHistoryEntry[];
  lastPhoneChangedAt?: string;
  lastPhoneChangedAtMs?: number;
  phoneChangeCooldownBypass?: boolean;
  deviceLimits?: UserDeviceLimits | null;
  requireDeviceApproval?: boolean | null;
  discoverableByPhone?: boolean;
  photoURL: string;
  about?: string;
  username?: string;
  hasAppLockPin?: boolean;
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
  bannedUntilMs?: number | null; // Epoch ms used for server-time expiry enforcement in Firestore Rules
  warningNotice?: string;
  warningIssuedAt?: string;
  warningDismissed?: boolean;
}

export interface DirectoryUser {
  userId: string;
  displayName: string;
  photoURL: string;
  about?: string;
  username?: string;
  phoneLookupHash?: string;
  isOnline?: boolean;
  lastSeen?: string;
  status: 'active' | 'scheduled_for_deletion' | 'deleted';
  isBanned?: boolean;
}

export interface UserSecurityLock {
  pinHash: string;
  salt: string;
  updatedAt: string;
}

export interface PhoneRegistryEntry {
  phoneHash: string;
  accountUids: string[];
  maxLimit: number;
  isBlocked: boolean;
  manualBlock?: boolean;
  blockedReason?: string | null;
  bannedUids?: string[];
  manuallyReleasedUids?: string[];
  createdAt: string;
  updatedAt: string;
}

export type RecoveryTopic = 'app_lock' | 'lost_email' | 'suspended' | 'other';

export interface PasswordRecoveryRequest {
  id: string;
  email: string;
  name?: string;
  username?: string;
  contactPhone?: string;
  topic?: RecoveryTopic;
  requesterUid?: string;
  details?: string;
  status: 'pending' | 'resolved' | 'dismissed';
  adminNotes?: string;
  resetEmailSentAt?: string;
  resetEmailSentTo?: string;
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
  reporterPhoneNumber?: string;
  reporterInitialPhoneNumber?: string;
  targetUserId: string;
  targetUserName: string;
  targetUserEmail?: string;
  targetPhoneNumber?: string;
  targetInitialPhoneNumber?: string;
  targetAccountCreatedAt?: string;
  targetPhoneChangeCount?: number;
  chatId?: string;
  messageId?: string;
  messageText?: string;
  reportedMessageType?: 'text' | 'image' | 'audio' | 'file';
  targetMessageDeleted?: boolean;
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
    | 'reopen_report'
    | 'delete_report'
    | 'resolve_recovery'
    | 'dismiss_recovery'
    | 'reopen_recovery'
    | 'delete_recovery'
    | 'send_password_reset'
    | 'reset_pin'
    | 'clear_app_lock'
    | 'create_announcement'
    | 'toggle_announcement'
    | 'delete_announcement'
    | 'backup_chats'
    | 'cleanup_storage'
    | 'restore_chats'
    | 'block_phone_number'
    | 'unblock_phone_number'
    | 'manage_phone_slots'
    | 'update_device_policy'
    | 'force_logout_device'
    | 'approve_device_session'
    | 'admin_device_login'
    | 'unlock_phone_cooldown';
  targetId?: string;
  targetName?: string;
  details: string;
  timestamp: string;
}

export type MessageType = 'text' | 'image' | 'audio' | 'file' | 'call';

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
  callId?: string;
  callerId?: string;
  callType?: 'audio' | 'video';
  callStatus?: 'completed' | 'missed' | 'declined' | 'cancelled';
  callDuration?: number;
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

export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'blocked';

export interface FriendshipPartyPreview {
  displayName: string;
  photoURL?: string;
  username?: string;
}

export interface Friendship {
  id: string; // canonical sorted: pair_${minUid}_${maxUid}
  userIds: string[]; // [minUid, maxUid]
  requesterId: string;
  receiverId: string;
  status: FriendshipStatus;
  blockedBy?: string | null;
  source?: 'search' | 'qr' | 'link';
  requesterProfile?: FriendshipPartyPreview;
  receiverProfile?: FriendshipPartyPreview;
  createdAt: string;
  updatedAt: string;
}

export type GroupVisibility = 'private' | 'public';
export type GroupJoinPolicy = 'invite_only' | 'direct' | 'approval';

export interface PublicGroupSummary {
  groupId: string;
  name: string;
  description?: string;
  groupPhoto?: string;
  creatorId: string;
  adminIds: string[];
  joinPolicy: 'direct' | 'approval';
  memberCount: number;
  status: 'active' | 'deleted';
  createdAt: string;
  updatedAt: string;
}

export interface GroupJoinRequest {
  userId: string;
  chatId: string;
  displayName: string;
  photoURL?: string;
  username?: string;
  message?: string;
  status: 'pending' | 'approved' | 'declined';
  createdAt: string;
  updatedAt: string;
}

export interface ChatRoom {
  id: string;
  type: 'direct' | 'group';
  name?: string;
  description?: string;
  creatorId?: string;
  adminIds?: string[];
  groupPhoto?: string;
  visibility?: GroupVisibility;
  joinPolicy?: GroupJoinPolicy;
  bannedUserIds?: string[];
  participantIds: string[];
  participantDetails?: Record<string, {
    displayName: string;
    photoURL?: string;
    email?: string;
    isBanned?: boolean;
    status?: 'active' | 'scheduled_for_deletion' | 'deleted';
  }>;
  isSuspended?: boolean;
  suspendedUserId?: string | null;
  suspendedUserName?: string | null;
  lastMessageId?: string;
  lastMessageText?: string;
  lastMessageSenderId?: string;
  lastMessageTime?: string;
  lastMessageReadBy?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CallSignalData {
  id: string;
  chatId: string;
  callerId: string;
  callerName: string;
  callerPhoto?: string;
  calleeId: string;
  calleeName: string;
  calleePhoto?: string;
  type: 'audio' | 'video';
  status: 'ringing' | 'answered' | 'declined' | 'ended' | 'missed';
  offer?: { type: string; sdp: string };
  answer?: { type: string; sdp: string };
  createdAt: string;
  updatedAt: string;
}

export interface CallSession {
  active: boolean;
  callId?: string;
  chatId: string;
  role: 'caller' | 'callee';
  type: 'audio' | 'video';
  partnerId: string;
  recipientName: string;
  recipientPhoto?: string;
  status: 'calling' | 'ringing' | 'connecting' | 'connected' | 'declined' | 'missed' | 'ended' | 'error';
  isMuted: boolean;
  isVideoOff: boolean;
  durationSeconds: number;
  signalData?: CallSignalData;
}
