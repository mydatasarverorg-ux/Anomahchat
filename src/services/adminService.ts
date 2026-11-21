import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { db, auth } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';
import { syncChatLastMessageFromLatest } from './chatService';
import {
  normalizePhoneNumber,
  extractPhoneDigits,
} from '../utils/phoneUtils';
import {
  syncBanStateToPhoneRegistry,
  clearExpiredSelfBanFromPhoneRegistry,
} from './phoneRegistryService';
import type {
  UserProfile,
  UserReport,
  SystemAnnouncement,
  AdminAuditLog,
  AnnouncementType,
  ReportReason,
  RecoveryTopic,
  PasswordRecoveryRequest,
  ChatRoom,
  ChatMessage,
} from '../types/chat';

export const SUPER_ADMIN_EMAIL = 'chinisdramaorg@gmail.com';
export const SUPPORT_DESK_ADDRESS = 'support@anomah.me';

function safeTimeMs(iso?: string | null): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function extractReadableFirestoreError(
  err: unknown,
  language: 'en' | 'bn' = 'en',
  fallback = 'Operation failed. Please try again.'
): string {
  if (!(err instanceof Error) || !err.message) return fallback;
  let message = err.message;
  try {
    const parsed = JSON.parse(err.message);
    if (parsed && typeof parsed.error === 'string' && parsed.error.trim()) {
      message = parsed.error.trim();
    }
  } catch {
    // Plain error message
  }

  const lower = message.toLowerCase();
  if (lower.includes('permission') || lower.includes('insufficient')) {
    return language === 'bn'
      ? 'নিরাপত্তা নীতি বা অনুমতির কারণে কাজটি সম্পন্ন করা যায়নি। তথ্য যাচাই করে আবার চেষ্টা করুন।'
      : 'Action was rejected by security rules. Please verify the inputs and your admin permissions.';
  }
  if (lower.includes('offline') || lower.includes('unavailable') || lower.includes('network')) {
    return language === 'bn'
      ? 'ইন্টারনেট সংযোগ বিচ্ছিন্ন রয়েছে। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।'
      : 'Network unavailable. Please check your connection and try again.';
  }
  return message || fallback;
}

export { normalizePhoneNumber, extractPhoneDigits };

export function doPhonesMatch(a?: string | null, b?: string | null): boolean {
  const da = extractPhoneDigits(a);
  const dbDigits = extractPhoneDigits(b);
  if (da.length < 6 || dbDigits.length < 6) return false;
  if (da === dbDigits) return true;
  const tailLen = Math.min(10, Math.min(da.length, dbDigits.length));
  return tailLen >= 8 && da.slice(-tailLen) === dbDigits.slice(-tailLen);
}

export function isSuperAdmin(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}

// Log admin action to immutable audit trail (strictly bounded to firestore.rules limits)
export async function logAdminAction(
  action: AdminAuditLog['action'],
  details: string,
  adminEmail: string,
  targetId?: string,
  targetName?: string
): Promise<void> {
  const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  try {
    const cleanAdmin = (adminEmail || SUPER_ADMIN_EMAIL).trim().slice(0, 150) || SUPER_ADMIN_EMAIL;
    const cleanDetails = (details || action).trim().slice(0, 1000) || action;
    const logEntry: Record<string, unknown> = {
      id: logId,
      adminEmail: cleanAdmin,
      action: action.slice(0, 100),
      details: cleanDetails,
      timestamp: new Date().toISOString(),
    };

    const cleanTargetId = targetId?.trim().slice(0, 128);
    const cleanTargetName = targetName?.trim().slice(0, 150);
    if (cleanTargetId) logEntry.targetId = cleanTargetId;
    if (cleanTargetName) logEntry.targetName = cleanTargetName;

    await setDoc(doc(db, 'admin_logs', logId), logEntry as unknown as AdminAuditLog);
  } catch (error) {
    console.error('Failed to write admin log:', error);
  }
}

// Ban or suspend a user with optional duration
export async function banUser(
  targetUserId: string,
  targetEmail: string,
  targetName: string,
  reason: string,
  adminEmail: string,
  durationDays?: number | 'permanent'
): Promise<void> {
  if (isSuperAdmin(targetEmail)) {
    throw new Error('Root Super Admin account cannot be suspended.');
  }

  const path = `users/${targetUserId}`;
  try {
    const userRef = doc(db, 'users', targetUserId);
    const existingUserSnap = await getDoc(userRef).catch(() => null);
    const targetPhone = existingUserSnap?.exists()
      ? (existingUserSnap.data() as UserProfile).phoneNumber
      : undefined;

    const now = new Date();
    const nowIso = now.toISOString();
    const cleanReason = (
      reason.trim() || 'Violating platform guidelines and community safety standards.'
    ).slice(0, 500);
    const cleanAdminEmail = (adminEmail || SUPER_ADMIN_EMAIL).trim().slice(0, 150);

    let bannedUntil: string | null = null;
    let bannedUntilMs: number | null = null;
    let durationLogText = 'Permanent';

    if (typeof durationDays === 'number' && durationDays > 0) {
      const untilMs = now.getTime() + durationDays * 24 * 60 * 60 * 1000;
      const untilDate = new Date(untilMs);
      bannedUntil = untilDate.toISOString();
      bannedUntilMs = untilMs;
      durationLogText = `${durationDays} day(s) (until ${untilDate.toLocaleDateString()})`;
    }

    const updates: Record<string, unknown> = {
      isBanned: true,
      banReason: cleanReason,
      bannedAt: nowIso,
      bannedBy: cleanAdminEmail,
      bannedUntil,
      bannedUntilMs,
      isOnline: false,
    };

    await setDoc(doc(db, 'bans', targetUserId), {
      userId: targetUserId,
      isBanned: true,
      reason: cleanReason,
      bannedAt: nowIso,
      bannedBy: cleanAdminEmail,
      bannedUntil,
      bannedUntilMs,
    });
    await updateDoc(userRef, updates);
    await syncBanStateToPhoneRegistry(targetUserId, targetPhone, true);
    await setDoc(
      doc(db, 'directory', targetUserId),
      { isBanned: true, isOnline: false },
      { merge: true }
    ).catch(() => {});

    try {
      const chatsSnap = await getDocs(
        query(collection(db, 'chats'), where('participantIds', 'array-contains', targetUserId))
      );
      for (const chatDoc of chatsSnap.docs) {
        const cdata = chatDoc.data() as ChatRoom;
        const chatUpdates: Record<string, unknown> = {
          [`participantDetails.${targetUserId}.isBanned`]: true,
        };
        if (cdata.type === 'direct') {
          chatUpdates.isSuspended = true;
          chatUpdates.suspendedUserId = targetUserId;
          chatUpdates.suspendedUserName = (targetName || targetEmail || 'User').slice(0, 150);
        }
        await updateDoc(doc(db, 'chats', chatDoc.id), chatUpdates);
      }
    } catch (syncErr) {
      console.warn('Sync ban to chats notice:', syncErr);
    }

    await logAdminAction(
      'ban_user',
      `Suspended user account for ${durationLogText}. Reason: "${cleanReason}"`.slice(0, 1000),
      cleanAdminEmail,
      targetUserId,
      targetName || targetEmail
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Unban / Reactivate a user (Admin only)
export async function unbanUser(
  targetUserId: string,
  targetEmail: string,
  targetName: string,
  adminEmail: string
): Promise<void> {
  const path = `users/${targetUserId}`;
  try {
    const userRef = doc(db, 'users', targetUserId);
    const existingUserSnap = await getDoc(userRef).catch(() => null);
    const targetPhone = existingUserSnap?.exists()
      ? (existingUserSnap.data() as UserProfile).phoneNumber
      : undefined;

    await deleteDoc(doc(db, 'bans', targetUserId)).catch(() => {});
    await updateDoc(userRef, {
      isBanned: false,
      banReason: null,
      bannedAt: null,
      bannedBy: null,
      bannedUntil: null,
      bannedUntilMs: null,
    });
    await syncBanStateToPhoneRegistry(targetUserId, targetPhone, false);

    await setDoc(
      doc(db, 'directory', targetUserId),
      { isBanned: false },
      { merge: true }
    ).catch(() => {});

    try {
      const chatsSnap = await getDocs(
        query(collection(db, 'chats'), where('participantIds', 'array-contains', targetUserId))
      );
      for (const chatDoc of chatsSnap.docs) {
        const cdata = chatDoc.data() as ChatRoom;
        const chatUpdates: Record<string, unknown> = {
          [`participantDetails.${targetUserId}.isBanned`]: false,
        };
        if (cdata.type === 'direct') {
          chatUpdates.isSuspended = false;
          chatUpdates.suspendedUserId = null;
          chatUpdates.suspendedUserName = null;
        }
        await updateDoc(doc(db, 'chats', chatDoc.id), chatUpdates);
      }
    } catch (syncErr) {
      console.warn('Sync unban to chats notice:', syncErr);
    }

    await logAdminAction(
      'unban_user',
      'Lifted suspension and reinstated account access.',
      adminEmail,
      targetUserId,
      targetName || targetEmail
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Self-reinstatement when temporary suspension timer expires (enforced server-side via request.time in firestore.rules)
export async function claimExpiredSuspension(userId: string): Promise<void> {
  const path = `users/${userId}`;
  try {
    const userRef = doc(db, 'users', userId);
    const existingUserSnap = await getDoc(userRef).catch(() => null);
    const targetPhone = existingUserSnap?.exists()
      ? (existingUserSnap.data() as UserProfile).phoneNumber
      : undefined;

    await deleteDoc(doc(db, 'bans', userId)).catch(() => {});
    await updateDoc(userRef, {
      isBanned: false,
      banReason: null,
      bannedAt: null,
      bannedBy: null,
      bannedUntil: null,
      bannedUntilMs: null,
    });
    await clearExpiredSelfBanFromPhoneRegistry(userId, targetPhone);

    await setDoc(
      doc(db, 'directory', userId),
      { isBanned: false },
      { merge: true }
    ).catch(() => {});

    const chatsSnap = await getDocs(
      query(collection(db, 'chats'), where('participantIds', 'array-contains', userId))
    );
    for (const chatDoc of chatsSnap.docs) {
      const cdata = chatDoc.data() as ChatRoom;
      const chatUpdates: Record<string, unknown> = {
        [`participantDetails.${userId}.isBanned`]: false,
      };
      if (cdata.type === 'direct' && cdata.suspendedUserId === userId) {
        chatUpdates.isSuspended = false;
        chatUpdates.suspendedUserId = null;
        chatUpdates.suspendedUserName = null;
      }
      await updateDoc(doc(db, 'chats', chatDoc.id), chatUpdates).catch(() => {});
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Issue an official warning to a user
export async function issueWarning(
  targetUserId: string,
  targetEmail: string,
  targetName: string,
  warningNotice: string,
  adminEmail: string
): Promise<void> {
  const path = `users/${targetUserId}`;
  const cleanNotice = warningNotice.trim().slice(0, 1000);
  if (!cleanNotice) {
    throw new Error('Warning message cannot be empty.');
  }

  try {
    const userRef = doc(db, 'users', targetUserId);
    const nowIso = new Date().toISOString();
    await updateDoc(userRef, {
      warningNotice: cleanNotice,
      warningIssuedAt: nowIso,
      warningDismissed: false,
    });

    await logAdminAction(
      'issue_warning',
      `Issued official administrative warning: "${cleanNotice}"`.slice(0, 1000),
      adminEmail,
      targetUserId,
      targetName || targetEmail
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Clear an official warning from a user
export async function clearWarning(
  targetUserId: string,
  targetEmail: string,
  targetName: string,
  adminEmail: string
): Promise<void> {
  const path = `users/${targetUserId}`;
  try {
    const userRef = doc(db, 'users', targetUserId);
    await updateDoc(userRef, {
      warningNotice: null,
      warningIssuedAt: null,
      warningDismissed: true,
    });

    await logAdminAction(
      'clear_warning',
      'Cleared active warning notice from profile.',
      adminEmail,
      targetUserId,
      targetName || targetEmail
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Dismiss warning by the user themselves
export async function acknowledgeWarning(userId: string): Promise<void> {
  const path = `users/${userId}`;
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      warningDismissed: true,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

const ALLOWED_REPORT_REASONS: ReportReason[] = [
  'harassment',
  'hate_speech',
  'spam',
  'scam',
  'inappropriate',
  'impersonation',
  'other',
];

const ALLOWED_REPORT_MSG_TYPES = ['text', 'image', 'audio', 'file'] as const;

// Submit a new abuse / conduct report
export async function submitReport(reportData: {
  reporterId: string;
  reporterName: string;
  reporterEmail: string;
  reporterPhoneNumber?: string;
  reporterInitialPhoneNumber?: string;
  targetUserId: string;
  targetUserName: string;
  targetUserEmail?: string;
  chatId?: string;
  messageId?: string;
  messageText?: string;
  reportedMessageType?: 'text' | 'image' | 'audio' | 'file';
  reason: ReportReason;
  details: string;
}): Promise<string> {
  const reporterId = (reportData.reporterId || '').trim().slice(0, 128);
  const targetUserId = (reportData.targetUserId || '').trim().slice(0, 128);

  if (!reporterId || !targetUserId) {
    throw new Error('Invalid reporter or target user identifier.');
  }
  if (reporterId === targetUserId) {
    throw new Error('You cannot submit a report against your own account.');
  }

  const safeReason: ReportReason = ALLOWED_REPORT_REASONS.includes(reportData.reason)
    ? reportData.reason
    : 'other';

  const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const path = `reports/${reportId}`;
  try {
    const newReport: Record<string, unknown> = {
      id: reportId,
      reporterId,
      reporterName: (reportData.reporterName || 'Anonymous User').trim().slice(0, 100) || 'Anonymous User',
      reporterEmail: (reportData.reporterEmail || '').trim().slice(0, 150),
      targetUserId,
      targetUserName: (reportData.targetUserName || 'User').trim().slice(0, 100) || 'User',
      reason: safeReason,
      details: (reportData.details || '').trim().slice(0, 2000),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const cleanReporterPhone = reportData.reporterPhoneNumber?.trim().slice(0, 50);
    const cleanReporterInitial = reportData.reporterInitialPhoneNumber?.trim().slice(0, 50);
    const cleanTargetEmail = reportData.targetUserEmail?.trim().slice(0, 150);
    const cleanChatId = reportData.chatId?.trim().slice(0, 128);
    const cleanMessageId = reportData.messageId?.trim().slice(0, 128);
    const cleanMessageText = reportData.messageText?.trim().slice(0, 1000);

    if (cleanReporterPhone) newReport.reporterPhoneNumber = cleanReporterPhone;
    if (cleanReporterInitial) newReport.reporterInitialPhoneNumber = cleanReporterInitial;
    if (cleanTargetEmail) newReport.targetUserEmail = cleanTargetEmail;
    if (cleanChatId) newReport.chatId = cleanChatId;
    if (cleanMessageId) newReport.messageId = cleanMessageId;
    if (cleanMessageText) newReport.messageText = cleanMessageText;
    if (
      reportData.reportedMessageType &&
      ALLOWED_REPORT_MSG_TYPES.includes(reportData.reportedMessageType)
    ) {
      newReport.reportedMessageType = reportData.reportedMessageType;
    }

    await setDoc(doc(db, 'reports', reportId), newReport as unknown as UserReport);
    return reportId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

export async function stampReportTargetSnapshot(
  reportId: string,
  targetUser: UserProfile
): Promise<void> {
  try {
    const updates: Record<string, unknown> = {};
    if (targetUser.phoneNumber) {
      updates.targetPhoneNumber = targetUser.phoneNumber.trim().slice(0, 50);
    }
    const initPhone = targetUser.initialPhoneNumber || targetUser.phoneNumber;
    if (initPhone) {
      updates.targetInitialPhoneNumber = initPhone.trim().slice(0, 50);
    }
    if (targetUser.createdAt) {
      updates.targetAccountCreatedAt = targetUser.createdAt.trim().slice(0, 64);
    }
    if (Array.isArray(targetUser.phoneHistory)) {
      updates.targetPhoneChangeCount = Math.min(100, targetUser.phoneHistory.length);
    }
    if (Object.keys(updates).length > 0) {
      await updateDoc(doc(db, 'reports', reportId), updates);
    }
  } catch {
    // Non-blocking snapshot preservation
  }
}

// Subscribe to all reports (Admin only)
export function subscribeToReports(callback: (reports: UserReport[]) => void): Unsubscribe {
  const path = 'reports';
  const q = query(collection(db, path));
  return onSnapshot(
    q,
    (snapshot) => {
      const reports = snapshot.docs.map((docSnap) => docSnap.data() as UserReport);
      reports.sort((a, b) => safeTimeMs(b.createdAt) - safeTimeMs(a.createdAt));
      callback(reports);
    },
    (error) => {
      console.warn('Reports subscription notice:', error);
      const msg = error.message.toLowerCase();
      if (!msg.includes('offline') && !msg.includes('unavailable') && !msg.includes('could not reach') && !msg.includes('timeout')) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    }
  );
}

// Update report status (Admin only) — preserves prior notes when reopening
export async function updateReportStatus(
  reportId: string,
  status: 'pending' | 'resolved' | 'dismissed',
  resolutionNotes: string,
  adminEmail: string
): Promise<void> {
  const path = `reports/${reportId}`;
  try {
    const reportRef = doc(db, 'reports', reportId);
    const cleanAdminEmail = (adminEmail || SUPER_ADMIN_EMAIL).trim().slice(0, 150);

    let cleanNotes: string;
    if (status === 'pending') {
      const snap = await getDoc(reportRef);
      const existingNotes = snap.exists() ? (snap.data() as UserReport).resolutionNotes?.trim() : '';
      const reopenEntry = `[Reopened ${new Date().toLocaleDateString()} by ${cleanAdminEmail}]`;
      cleanNotes = existingNotes
        ? `${existingNotes}\n${reopenEntry}`.slice(0, 1000)
        : (resolutionNotes.trim() || 'Reopened for further review.').slice(0, 1000);
    } else {
      const defaultNote =
        status === 'resolved'
          ? 'Addressed by admin.'
          : 'Dismissed by admin.';
      cleanNotes = (resolutionNotes.trim() || defaultNote).slice(0, 1000);
    }

    await updateDoc(reportRef, {
      status,
      resolutionNotes: cleanNotes,
      resolvedAt: new Date().toISOString(),
      resolvedBy: cleanAdminEmail,
    });

    const auditAction: AdminAuditLog['action'] =
      status === 'resolved'
        ? 'resolve_report'
        : status === 'dismissed'
        ? 'dismiss_report'
        : 'reopen_report';

    await logAdminAction(
      auditAction,
      `${status === 'pending' ? 'Reopened report for review' : `Marked report as ${status}`}. Notes: "${cleanNotes}"`.slice(0, 1000),
      cleanAdminEmail,
      reportId
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Delete a report (Admin only)
export async function deleteReport(reportId: string, adminEmail: string): Promise<void> {
  const path = `reports/${reportId}`;
  try {
    await deleteDoc(doc(db, 'reports', reportId));
    await logAdminAction('delete_report', `Deleted report entry (${reportId}) from archive.`, adminEmail, reportId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Subscribe to announcements (Signed-in active only uses where('active', '==', true); Admin views all)
export function subscribeToAnnouncements(
  activeOnly: boolean,
  callback: (announcements: SystemAnnouncement[]) => void
): Unsubscribe {
  const path = 'announcements';
  const q = activeOnly
    ? query(collection(db, path), where('active', '==', true))
    : query(collection(db, path));

  return onSnapshot(
    q,
    (snapshot) => {
      let items = snapshot.docs.map((docSnap) => docSnap.data() as SystemAnnouncement);
      if (activeOnly) {
        items = items.filter((a) => a.active);
      }
      items.sort((a, b) => safeTimeMs(b.createdAt) - safeTimeMs(a.createdAt));
      callback(items);
    },
    (error) => {
      console.warn('Announcements subscription notice:', error);
      const msg = error.message.toLowerCase();
      if (!msg.includes('offline') && !msg.includes('unavailable') && !msg.includes('could not reach') && !msg.includes('timeout')) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    }
  );
}

// Create announcement (Admin only)
export async function createAnnouncement(
  title: string,
  content: string,
  type: AnnouncementType,
  adminUid: string,
  adminName: string,
  adminEmail: string
): Promise<void> {
  const annId = `ann_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const path = `announcements/${annId}`;
  try {
    const cleanTitle = title.trim().slice(0, 150);
    const ann: SystemAnnouncement = {
      id: annId,
      title: cleanTitle,
      content: content.trim().slice(0, 3000),
      type,
      active: true,
      createdAt: new Date().toISOString(),
      createdBy: adminUid.slice(0, 128),
      authorName: (adminName || 'Super Admin').trim().slice(0, 100),
    };
    await setDoc(doc(db, 'announcements', annId), ann);
    await logAdminAction('create_announcement', `Published announcement: "${cleanTitle}"`.slice(0, 1000), adminEmail, annId);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// Toggle announcement active status (Admin only)
export async function toggleAnnouncement(
  announcementId: string,
  active: boolean,
  adminEmail: string
): Promise<void> {
  const path = `announcements/${announcementId}`;
  try {
    await updateDoc(doc(db, 'announcements', announcementId), { active });
    await logAdminAction(
      'toggle_announcement',
      `${active ? 'Activated' : 'Deactivated'} platform announcement banner.`,
      adminEmail,
      announcementId
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Delete announcement (Admin only)
export async function deleteAnnouncement(announcementId: string, adminEmail: string): Promise<void> {
  const path = `announcements/${announcementId}`;
  try {
    await deleteDoc(doc(db, 'announcements', announcementId));
    await logAdminAction('delete_announcement', 'Deleted announcement from platform.', adminEmail, announcementId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Subscribe to admin audit logs (Admin only)
export function subscribeToAdminLogs(callback: (logs: AdminAuditLog[]) => void): Unsubscribe {
  const path = 'admin_logs';
  const q = query(collection(db, path));
  return onSnapshot(
    q,
    (snapshot) => {
      const logs = snapshot.docs.map((docSnap) => docSnap.data() as AdminAuditLog);
      logs.sort((a, b) => safeTimeMs(b.timestamp) - safeTimeMs(a.timestamp));
      callback(logs);
    },
    (error) => {
      console.warn('Admin logs subscription notice:', error);
      const msg = error.message.toLowerCase();
      if (!msg.includes('offline') && !msg.includes('unavailable') && !msg.includes('could not reach') && !msg.includes('timeout')) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    }
  );
}

// Admin message deletion (moderation) — returns false if message was already deleted; optionally syncs reports
export async function deleteAdminMessage(
  chatId: string,
  messageId: string,
  adminEmail: string,
  reason?: string,
  linkedReportIds?: string[]
): Promise<boolean> {
  const path = `chats/${chatId}/messages/${messageId}`;
  try {
    const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
    const snap = await getDoc(msgRef);
    const existed = snap.exists();

    if (existed) {
      await deleteDoc(msgRef);
      await syncChatLastMessageFromLatest(chatId, messageId);
      await logAdminAction(
        'delete_message',
        `Admin removed inappropriate message in chat ${chatId.slice(0, 40)}. Reason: "${(reason || 'Safety moderation').slice(0, 300)}"`.slice(0, 1000),
        adminEmail,
        messageId
      );
    }

    if (linkedReportIds && linkedReportIds.length > 0) {
      await Promise.all(
        linkedReportIds.map((repId) =>
          updateDoc(doc(db, 'reports', repId), { targetMessageDeleted: true }).catch(() => {})
        )
      );
    }

    return existed;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    return false;
  }
}

// ----------------------------------------------------
// PASSWORD RECOVERY DESK (Support Ticket Only - Zero Plaintext Secrets)
// ----------------------------------------------------

const ALLOWED_RECOVERY_TOPICS: RecoveryTopic[] = ['app_lock', 'lost_email', 'suspended', 'other'];

export async function submitRecoveryRequest(data: {
  email?: string;
  name?: string;
  username?: string;
  contactPhone?: string;
  topic?: RecoveryTopic;
  requesterUid?: string;
  details?: string;
}): Promise<string> {
  const cleanEmail = (data.email || '').trim().toLowerCase().slice(0, 150);
  const cleanUsername = (data.username || '').trim().replace(/^@/, '').toLowerCase().slice(0, 50);
  const cleanPhone = normalizePhoneNumber(data.contactPhone);

  const hasValidEmail = cleanEmail.length >= 3 && cleanEmail.includes('@');
  if (cleanEmail.length > 0 && !hasValidEmail) {
    throw new Error('Please provide a valid email address.');
  }
  if (!hasValidEmail && extractPhoneDigits(cleanPhone).length < 5 && cleanUsername.length < 3) {
    throw new Error('Please provide an email address, mobile number, or @username so support can identify your account.');
  }

  const reqId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const path = `recovery_requests/${reqId}`;

  const reqDoc: Record<string, unknown> = {
    id: reqId,
    email: cleanEmail,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  if (data.name?.trim()) reqDoc.name = data.name.trim().slice(0, 100);
  if (cleanUsername) reqDoc.username = cleanUsername;
  if (cleanPhone) reqDoc.contactPhone = cleanPhone;
  if (data.topic && ALLOWED_RECOVERY_TOPICS.includes(data.topic)) {
    reqDoc.topic = data.topic;
  }
  const cleanUid = data.requesterUid?.trim().slice(0, 128);
  if (cleanUid && auth.currentUser?.uid === cleanUid) {
    reqDoc.requesterUid = cleanUid;
  }
  if (data.details?.trim()) reqDoc.details = data.details.trim().slice(0, 1000);

  try {
    await setDoc(doc(db, 'recovery_requests', reqId), reqDoc as unknown as PasswordRecoveryRequest);
    return reqId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

export function subscribeToRecoveryRequests(
  callback: (requests: PasswordRecoveryRequest[]) => void
): Unsubscribe {
  const path = 'recovery_requests';
  const q = query(collection(db, path));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) => docSnap.data() as PasswordRecoveryRequest);
      items.sort((a, b) => safeTimeMs(b.createdAt) - safeTimeMs(a.createdAt));
      callback(items);
    },
    (error) => {
      console.warn('Recovery requests subscription notice:', error);
      const msg = error.message.toLowerCase();
      if (!msg.includes('offline') && !msg.includes('unavailable') && !msg.includes('could not reach') && !msg.includes('timeout')) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    }
  );
}

export async function resolveRecoveryRequest(
  requestId: string,
  adminNotes: string,
  adminEmail: string
): Promise<void> {
  const path = `recovery_requests/${requestId}`;
  try {
    const reqRef = doc(db, 'recovery_requests', requestId);
    const nowIso = new Date().toISOString();
    const cleanNotes = (adminNotes.trim() || 'Resolved by administrator.').slice(0, 1000);
    const cleanAdminEmail = (adminEmail || SUPER_ADMIN_EMAIL).trim().slice(0, 150);

    await updateDoc(reqRef, {
      status: 'resolved',
      adminNotes: cleanNotes,
      resolvedAt: nowIso,
      resolvedBy: cleanAdminEmail,
    });

    await logAdminAction(
      'resolve_recovery',
      `Resolved support recovery ticket. Notes: "${cleanNotes}"`.slice(0, 1000),
      cleanAdminEmail,
      requestId
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function dismissRecoveryRequest(
  requestId: string,
  adminNotes: string,
  adminEmail: string
): Promise<void> {
  const path = `recovery_requests/${requestId}`;
  try {
    const reqRef = doc(db, 'recovery_requests', requestId);
    const cleanNotes = (adminNotes.trim() || 'Dismissed by administrator.').slice(0, 1000);
    const cleanAdminEmail = (adminEmail || SUPER_ADMIN_EMAIL).trim().slice(0, 150);

    await updateDoc(reqRef, {
      status: 'dismissed',
      adminNotes: cleanNotes,
      resolvedAt: new Date().toISOString(),
      resolvedBy: cleanAdminEmail,
    });

    await logAdminAction(
      'dismiss_recovery',
      `Dismissed support ticket. Notes: "${cleanNotes}"`.slice(0, 1000),
      cleanAdminEmail,
      requestId
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function reopenRecoveryRequest(
  requestId: string,
  adminEmail: string
): Promise<void> {
  const path = `recovery_requests/${requestId}`;
  try {
    const cleanAdminEmail = (adminEmail || SUPER_ADMIN_EMAIL).trim().slice(0, 150);
    const reqRef = doc(db, 'recovery_requests', requestId);
    const snap = await getDoc(reqRef);
    const existingNotes = snap.exists()
      ? (snap.data() as PasswordRecoveryRequest).adminNotes?.trim()
      : '';
    const reopenEntry = `[Reopened ${new Date().toLocaleDateString()} by ${cleanAdminEmail}]`;
    const nextNotes = existingNotes
      ? `${existingNotes}\n${reopenEntry}`.slice(0, 1000)
      : 'Reopened for further support.';

    await updateDoc(reqRef, {
      status: 'pending',
      adminNotes: nextNotes,
      resolvedAt: new Date().toISOString(),
      resolvedBy: cleanAdminEmail,
    });

    await logAdminAction(
      'reopen_recovery',
      'Reopened support ticket for further review.',
      cleanAdminEmail,
      requestId
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteRecoveryRequest(
  requestId: string,
  adminEmail: string
): Promise<void> {
  const path = `recovery_requests/${requestId}`;
  try {
    await deleteDoc(doc(db, 'recovery_requests', requestId));
    await logAdminAction(
      'delete_recovery',
      `Deleted support ticket (${requestId}) from archive.`,
      adminEmail,
      requestId
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function sendAdminPasswordResetEmail(
  targetEmail: string,
  adminEmail: string,
  ticketId?: string
): Promise<void> {
  const cleanEmail = targetEmail.trim().toLowerCase().slice(0, 150);
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Invalid email address for password reset.');
  }
  try {
    await sendPasswordResetEmail(auth, cleanEmail);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/user-not-found') {
      throw new Error(`No Firebase Auth account exists for ${cleanEmail}.`);
    }
    if (code === 'auth/invalid-email') {
      throw new Error(`Invalid email format: ${cleanEmail}`);
    }
    if (code === 'auth/too-many-requests') {
      throw new Error('Too many password reset emails sent recently. Please wait a few minutes.');
    }
    if (code === 'auth/network-request-failed') {
      throw new Error('Network error while sending password reset email.');
    }
    throw new Error(`Failed to send password reset email to ${cleanEmail}.`);
  }

  const nowIso = new Date().toISOString();
  if (ticketId) {
    await updateDoc(doc(db, 'recovery_requests', ticketId), {
      resetEmailSentAt: nowIso,
      resetEmailSentTo: cleanEmail,
    }).catch(() => {});
  }

  await logAdminAction(
    'send_password_reset',
    `Triggered Firebase Password Reset email to ${cleanEmail}.`.slice(0, 1000),
    adminEmail,
    ticketId || cleanEmail,
    cleanEmail
  );
}

// Clear a user's Quick App-Lock PIN (Admin recovery support without exposing/storing plaintext PIN)
export async function adminClearUserAppLock(
  targetUserId: string,
  adminEmail: string,
  ticketId?: string
): Promise<void> {
  const path = `users/${targetUserId}`;
  try {
    await deleteDoc(doc(db, 'users', targetUserId, 'private', 'security')).catch(() => {});
    await updateDoc(doc(db, 'users', targetUserId), {
      hasAppLockPin: false,
    });
    await logAdminAction(
      'clear_app_lock',
      `Cleared Quick App-Lock PIN for user account recovery${ticketId ? ` (Ticket: ${ticketId})` : ''}.`.slice(0, 1000),
      adminEmail,
      targetUserId
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Admin-only one-time backfill so legacy users appear in public non-PII directory immediately
export async function backfillDirectoryFromUsers(users: UserProfile[]): Promise<void> {
  for (const u of users) {
    if (!u?.userId) continue;
    try {
      const payload: Record<string, unknown> = {
        userId: u.userId,
        displayName: (u.displayName || 'User').slice(0, 100),
        photoURL: (u.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.userId}`).slice(0, 1000),
        about: (u.about || 'Available | Using Anomah Chat').slice(0, 200),
        status: u.status || 'active',
        isOnline: Boolean(u.isOnline),
        lastSeen: u.lastSeen || u.createdAt || new Date().toISOString(),
        isBanned: Boolean(u.isBanned),
      };
      if (u.username) {
        payload.username = u.username.toLowerCase();
      }
      await setDoc(doc(db, 'directory', u.userId), payload, { merge: true });
    } catch {
      // non-blocking per item
    }
  }
}

// ----------------------------------------------------
// CHAT & MESSAGE INSPECTION & AUDIT (Admin moderation)
// ----------------------------------------------------

export function subscribeToAllChatsForAdmin(
  callback: (chats: ChatRoom[]) => void
): Unsubscribe {
  const path = 'chats';
  const q = query(collection(db, path));
  return onSnapshot(
    q,
    (snapshot) => {
      const chats: ChatRoom[] = [];
      snapshot.forEach((d) => {
        chats.push({ id: d.id, ...(d.data() as Omit<ChatRoom, 'id'>) });
      });
      chats.sort((a, b) => safeTimeMs(b.updatedAt || b.createdAt) - safeTimeMs(a.updatedAt || a.createdAt));
      callback(chats);
    },
    (error) => {
      console.warn('Admin all chats subscription notice:', error);
      const msg = error.message.toLowerCase();
      if (!msg.includes('offline') && !msg.includes('unavailable') && !msg.includes('could not reach') && !msg.includes('timeout')) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    }
  );
}

export function subscribeToChatMessagesForAdmin(
  chatId: string,
  callback: (messages: ChatMessage[]) => void
): Unsubscribe {
  const path = `chats/${chatId}/messages`;
  const q = query(collection(db, path), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((d) => {
        msgs.push({ id: d.id, ...(d.data() as Omit<ChatMessage, 'id'>) });
      });
      callback(msgs);
    },
    (error) => {
      console.warn('Admin chat messages subscription notice:', error);
      const msg = error.message.toLowerCase();
      if (!msg.includes('offline') && !msg.includes('unavailable') && !msg.includes('could not reach') && !msg.includes('timeout')) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    }
  );
}
