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
import type {
  UserProfile,
  UserReport,
  SystemAnnouncement,
  AdminAuditLog,
  AnnouncementType,
  ReportReason,
  PasswordRecoveryRequest,
  ChatRoom,
  ChatMessage,
} from '../types/chat';

export const SUPER_ADMIN_EMAIL = 'chinisdramaorg@gmail.com';

export function isSuperAdmin(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}

// Log admin action to audit trail
export async function logAdminAction(
  action: AdminAuditLog['action'],
  details: string,
  adminEmail: string,
  targetId?: string,
  targetName?: string
): Promise<void> {
  const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const path = `admin_logs/${logId}`;
  try {
    const logEntry: Record<string, unknown> = {
      id: logId,
      adminEmail,
      action,
      details,
      timestamp: new Date().toISOString(),
    };

    if (targetId) {
      logEntry.targetId = targetId;
    }
    if (targetName) {
      logEntry.targetName = targetName;
    }

    await setDoc(doc(db, 'admin_logs', logId), logEntry as unknown as AdminAuditLog);
  } catch (error) {
    console.error('Failed to write admin log:', error);
    // Don't block core action if logging encounters issue
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
  // Absolute protection for Root Super Admin
  if (isSuperAdmin(targetEmail)) {
    throw new Error('Root Super Admin account cannot be suspended.');
  }

  const path = `users/${targetUserId}`;
  try {
    const userRef = doc(db, 'users', targetUserId);
    const now = new Date();
    const nowIso = now.toISOString();

    let bannedUntil: string | null = null;
    let durationLogText = 'Permanent';

    if (typeof durationDays === 'number' && durationDays > 0) {
      const untilDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
      bannedUntil = untilDate.toISOString();
      durationLogText = `${durationDays} day(s) (until ${untilDate.toLocaleDateString()})`;
    }

    const updates: Record<string, unknown> = {
      isBanned: true,
      banReason: reason.trim() || 'Violating platform guidelines and community safety standards.',
      bannedAt: nowIso,
      bannedBy: adminEmail,
      bannedUntil,
      isOnline: false,
    };

    await updateDoc(userRef, updates);

    // Synchronize suspension status across all active chats involving this user
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
          chatUpdates.suspendedUserName = targetName || targetEmail;
        }
        await updateDoc(doc(db, 'chats', chatDoc.id), chatUpdates);
      }
    } catch (syncErr) {
      console.warn('Sync ban to chats notice:', syncErr);
    }

    await logAdminAction(
      'ban_user',
      `Suspended user account for ${durationLogText}. Reason: "${reason.trim()}"`,
      adminEmail,
      targetUserId,
      targetName || targetEmail
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Unban / Reactivate a user
export async function unbanUser(
  targetUserId: string,
  targetEmail: string,
  targetName: string,
  adminEmail: string
): Promise<void> {
  const path = `users/${targetUserId}`;
  try {
    const userRef = doc(db, 'users', targetUserId);
    await updateDoc(userRef, {
      isBanned: false,
      banReason: null,
      bannedAt: null,
      bannedBy: null,
      bannedUntil: null,
    });

    // Synchronize reinstatement across all active chats involving this user
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

// Issue an official warning to a user
export async function issueWarning(
  targetUserId: string,
  targetEmail: string,
  targetName: string,
  warningNotice: string,
  adminEmail: string
): Promise<void> {
  const path = `users/${targetUserId}`;
  try {
    const userRef = doc(db, 'users', targetUserId);
    const nowIso = new Date().toISOString();
    await updateDoc(userRef, {
      warningNotice: warningNotice.trim(),
      warningIssuedAt: nowIso,
      warningDismissed: false,
    });

    await logAdminAction(
      'issue_warning',
      `Issued official administrative warning: "${warningNotice.trim()}"`,
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

// Submit a new abuse / conduct report
export async function submitReport(reportData: {
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
}): Promise<void> {
  const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const path = `reports/${reportId}`;
  try {
    const newReport: Record<string, unknown> = {
      id: reportId,
      reporterId: reportData.reporterId,
      reporterName: reportData.reporterName,
      reporterEmail: reportData.reporterEmail || '',
      targetUserId: reportData.targetUserId,
      targetUserName: reportData.targetUserName,
      reason: reportData.reason,
      details: reportData.details.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    if (reportData.targetUserEmail) {
      newReport.targetUserEmail = reportData.targetUserEmail;
    }
    if (reportData.chatId) {
      newReport.chatId = reportData.chatId;
    }
    if (reportData.messageId) {
      newReport.messageId = reportData.messageId;
    }
    if (reportData.messageText) {
      newReport.messageText = reportData.messageText;
    }

    await setDoc(doc(db, 'reports', reportId), newReport as unknown as UserReport);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
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
      reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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

// Update report status (Admin only)
export async function updateReportStatus(
  reportId: string,
  status: 'resolved' | 'dismissed',
  resolutionNotes: string,
  adminEmail: string
): Promise<void> {
  const path = `reports/${reportId}`;
  try {
    const reportRef = doc(db, 'reports', reportId);
    await updateDoc(reportRef, {
      status,
      resolutionNotes: resolutionNotes.trim(),
      resolvedAt: new Date().toISOString(),
      resolvedBy: adminEmail,
    });

    await logAdminAction(
      status === 'resolved' ? 'resolve_report' : 'dismiss_report',
      `Marked report as ${status}. Notes: "${resolutionNotes.trim()}"`,
      adminEmail,
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
    await logAdminAction('dismiss_report', 'Deleted report entry from archive.', adminEmail, reportId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Subscribe to announcements (Public: active only or all for admin)
export function subscribeToAnnouncements(
  activeOnly: boolean,
  callback: (announcements: SystemAnnouncement[]) => void
): Unsubscribe {
  const path = 'announcements';
  const q = query(collection(db, path));

  return onSnapshot(
    q,
    (snapshot) => {
      let items = snapshot.docs.map((docSnap) => docSnap.data() as SystemAnnouncement);
      if (activeOnly) {
        items = items.filter((a) => a.active);
      }
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
    const ann: SystemAnnouncement = {
      id: annId,
      title: title.trim(),
      content: content.trim(),
      type,
      active: true,
      createdAt: new Date().toISOString(),
      createdBy: adminUid,
      authorName: adminName,
    };
    await setDoc(doc(db, 'announcements', annId), ann);
    await logAdminAction('create_announcement', `Published announcement: "${title.trim()}"`, adminEmail, annId);
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
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
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

// Admin message deletion (moderation)
export async function deleteAdminMessage(
  chatId: string,
  messageId: string,
  adminEmail: string,
  reason?: string
): Promise<void> {
  const path = `chats/${chatId}/messages/${messageId}`;
  try {
    await deleteDoc(doc(db, 'chats', chatId, 'messages', messageId));
    await logAdminAction(
      'delete_message',
      `Admin removed inappropriate message. Reason: "${reason || 'Safety moderation'}"`,
      adminEmail,
      messageId
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ----------------------------------------------------
// PASSWORD RECOVERY DESK (Admin Assisted Recovery)
// ----------------------------------------------------

// Submit a new password recovery request from login screen
export async function submitRecoveryRequest(data: {
  email: string;
  name?: string;
  username?: string;
  contactPhone?: string;
  details?: string;
}): Promise<string> {
  const cleanEmail = data.email.trim().toLowerCase();
  const reqId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const path = `recovery_requests/${reqId}`;

  const reqDoc: Record<string, unknown> = {
    id: reqId,
    email: cleanEmail,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  if (data.name?.trim()) reqDoc.name = data.name.trim();
  if (data.username?.trim()) reqDoc.username = data.username.trim().replace(/^@/, '');
  if (data.contactPhone?.trim()) reqDoc.contactPhone = data.contactPhone.trim();
  if (data.details?.trim()) reqDoc.details = data.details.trim();

  try {
    await setDoc(doc(db, 'recovery_requests', reqId), reqDoc as unknown as PasswordRecoveryRequest);
    return reqId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

// Subscribe to recovery requests (Admin only)
export function subscribeToRecoveryRequests(
  callback: (requests: PasswordRecoveryRequest[]) => void
): Unsubscribe {
  const path = 'recovery_requests';
  const q = query(collection(db, path));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) => docSnap.data() as PasswordRecoveryRequest);
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(items);
    },
    (error) => {
      console.warn('Recovery requests subscription notice:', error);
      if (!error.message.includes('offline') && !error.message.includes('unavailable')) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    }
  );
}

// Resolve a recovery request with temporary password / PIN instructions
export async function resolveRecoveryRequest(
  requestId: string,
  targetUserId: string | undefined,
  temporaryPassword: string,
  temporaryPin: string,
  adminNotes: string,
  adminEmail: string
): Promise<void> {
  const path = `recovery_requests/${requestId}`;
  try {
    const reqRef = doc(db, 'recovery_requests', requestId);
    const nowIso = new Date().toISOString();

    await updateDoc(reqRef, {
      status: 'resolved',
      temporaryPassword: temporaryPassword.trim() || undefined,
      temporaryPin: temporaryPin.trim() || undefined,
      adminNotes: adminNotes.trim(),
      resolvedAt: nowIso,
      resolvedBy: adminEmail,
    });

    // If targetUserId is provided and PIN was specified, set the user's secretPin directly in their profile
    if (targetUserId && temporaryPin.trim()) {
      await updateDoc(doc(db, 'users', targetUserId), {
        secretPin: temporaryPin.trim(),
        pinFailedAttempts: 0,
        pinLockedUntil: null,
      });
    }

    await logAdminAction(
      'resolve_recovery',
      `Resolved password recovery request. Admin assigned credentials/guidance. Notes: "${adminNotes.trim()}"`,
      adminEmail,
      requestId
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Dismiss a recovery request
export async function dismissRecoveryRequest(
  requestId: string,
  adminNotes: string,
  adminEmail: string
): Promise<void> {
  const path = `recovery_requests/${requestId}`;
  try {
    const reqRef = doc(db, 'recovery_requests', requestId);
    await updateDoc(reqRef, {
      status: 'dismissed',
      adminNotes: adminNotes.trim(),
      resolvedAt: new Date().toISOString(),
      resolvedBy: adminEmail,
    });

    await logAdminAction(
      'dismiss_recovery',
      `Dismissed password recovery request. Notes: "${adminNotes.trim()}"`,
      adminEmail,
      requestId
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Check recovery status by email (for user querying on login page)
export async function checkUserRecoveryRequests(email: string): Promise<PasswordRecoveryRequest[]> {
  const cleanEmail = email.trim().toLowerCase();
  const path = 'recovery_requests';
  try {
    const q = query(collection(db, path), where('email', '==', cleanEmail));
    const snap = await getDocs(q);
    const list: PasswordRecoveryRequest[] = [];
    snap.forEach((d) => list.push(d.data() as PasswordRecoveryRequest));
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  } catch (err) {
    console.warn('Check recovery error:', err);
    return [];
  }
}

// Directly reset user PIN by Super Admin
export async function adminSetUserPin(
  targetUserId: string,
  newPin: string,
  adminEmail: string
): Promise<void> {
  const path = `users/${targetUserId}`;
  try {
    const userRef = doc(db, 'users', targetUserId);
    await updateDoc(userRef, {
      secretPin: newPin.trim(),
      pinFailedAttempts: 0,
      pinLockedUntil: null,
    });
    await logAdminAction(
      'reset_pin',
      `Admin assigned a new secret PIN (${newPin.trim()}) for user account.`,
      adminEmail,
      targetUserId
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ----------------------------------------------------
// CHAT & MESSAGE INSPECTION & AUDIT (Admin moderation)
// ----------------------------------------------------

// Subscribe to all platform chats (Admin only)
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
      chats.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
      callback(chats);
    },
    (error) => {
      console.warn('Admin all chats subscription notice:', error);
      if (!error.message.includes('offline') && !error.message.includes('unavailable')) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    }
  );
}

// Subscribe to messages of a specific chat for admin inspection
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
      if (!error.message.includes('offline') && !error.message.includes('unavailable')) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    }
  );
}

