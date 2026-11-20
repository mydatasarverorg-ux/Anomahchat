import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';
import { isNativeApkApp } from '../utils/appVersion';
import type {
  AdminAuditLog,
  AppSecuritySettings,
  DeviceSession,
  UserDeviceLimits,
  UserProfile,
} from '../types/chat';

const DEVICE_ID_STORAGE_KEY = 'anomah_device_id_v1';
const APPROX_LOC_CACHE_KEY = 'anomah_approx_loc_v1';
const SECURITY_SUPER_ADMIN_EMAIL = 'chinisdramaorg@gmail.com';

export const DEFAULT_SECURITY_SETTINGS: AppSecuritySettings = {
  defaultMobileLimit: 1,
  defaultWebLimit: 1,
  requireApprovalForNewDevice: true,
  updatedAt: '',
  updatedBy: SECURITY_SUPER_ADMIN_EMAIL,
};

async function writeSecurityAuditLog(
  action: AdminAuditLog['action'],
  details: string,
  adminEmail: string,
  targetId?: string,
  targetName?: string
): Promise<void> {
  const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  try {
    const cleanAdmin =
      (adminEmail || SECURITY_SUPER_ADMIN_EMAIL).trim().slice(0, 150) || SECURITY_SUPER_ADMIN_EMAIL;
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
  } catch (err) {
    console.warn('Security audit log warning:', err);
  }
}

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'dev_server_default';
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,100}$/.test(existing)) {
      return existing;
    }
    const raw =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().replace(/-/g, '')
        : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
    const nextId = `dev_${raw}`.slice(0, 80);
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, nextId);
    return nextId;
  } catch {
    return `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function getCurrentDeviceMetadata(): {
  deviceId: string;
  platformCategory: 'mobile' | 'web';
  runtimeType: 'apk' | 'pwa' | 'web';
  deviceLabel: string;
} {
  const deviceId = getOrCreateDeviceId();
  if (typeof window === 'undefined') {
    return {
      deviceId,
      platformCategory: 'web',
      runtimeType: 'web',
      deviceLabel: 'Web Browser',
    };
  }

  const ua = window.navigator.userAgent || '';
  const uaLower = ua.toLowerCase();
  const isApk = isNativeApkApp();
  const isStandalonePwa =
    !isApk &&
    (window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true);

  const runtimeType: 'apk' | 'pwa' | 'web' = isApk ? 'apk' : isStandalonePwa ? 'pwa' : 'web';

  const isMobileUa =
    /android|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(uaLower) ||
    (window.navigator.maxTouchPoints > 1 && window.innerWidth <= 1024);

  const platformCategory: 'mobile' | 'web' = isApk || isMobileUa ? 'mobile' : 'web';

  let osName = 'Device';
  if (/android/i.test(ua)) osName = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) osName = 'iOS';
  else if (/windows/i.test(ua)) osName = 'Windows PC';
  else if (/macintosh|mac os/i.test(ua)) osName = 'Mac';
  else if (/linux/i.test(ua)) osName = 'Linux PC';

  let browserName = 'Browser';
  if (isApk) {
    browserName = 'Anomah APK';
  } else if (/edg\//i.test(ua)) {
    browserName = 'Edge';
  } else if (/chrome|crios/i.test(ua)) {
    browserName = 'Chrome';
  } else if (/firefox|fxios/i.test(ua)) {
    browserName = 'Firefox';
  } else if (/safari/i.test(ua)) {
    browserName = 'Safari';
  }

  const suffix = isApk ? '' : isStandalonePwa ? ` (${browserName} PWA)` : ` · ${browserName}`;
  const deviceLabel = `${osName}${suffix}`.slice(0, 150);

  return {
    deviceId,
    platformCategory,
    runtimeType,
    deviceLabel,
  };
}

export async function fetchApproxLocation(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const cached = sessionStorage.getItem(APPROX_LOC_CACHE_KEY);
    if (cached) return cached;
  } catch {
    // ignore storage
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1600);
    const resp = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const data = (await resp.json()) as { city?: string; country_name?: string; country?: string };
    const parts = [data.city, data.country_name || data.country].filter(Boolean);
    if (parts.length === 0) return null;
    const loc = `${parts.join(', ')} (Approx.)`.slice(0, 120);
    try {
      sessionStorage.setItem(APPROX_LOC_CACHE_KEY, loc);
    } catch {
      // ignore storage
    }
    return loc;
  } catch {
    return null;
  }
}

export async function getGlobalSecuritySettings(): Promise<AppSecuritySettings> {
  try {
    const snap = await getDoc(doc(db, 'app_settings', 'security'));
    if (!snap.exists()) return DEFAULT_SECURITY_SETTINGS;
    const data = snap.data() as Partial<AppSecuritySettings>;
    return {
      defaultMobileLimit:
        typeof data.defaultMobileLimit === 'number' && data.defaultMobileLimit >= 0
          ? data.defaultMobileLimit
          : 1,
      defaultWebLimit:
        typeof data.defaultWebLimit === 'number' && data.defaultWebLimit >= 0
          ? data.defaultWebLimit
          : 1,
      requireApprovalForNewDevice: data.requireApprovalForNewDevice !== false,
      updatedAt: data.updatedAt || '',
      updatedBy: data.updatedBy || SECURITY_SUPER_ADMIN_EMAIL,
    };
  } catch {
    return DEFAULT_SECURITY_SETTINGS;
  }
}

export function subscribeToGlobalSecuritySettings(
  callback: (settings: AppSecuritySettings) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'app_settings', 'security'),
    (snap) => {
      if (!snap.exists()) {
        callback(DEFAULT_SECURITY_SETTINGS);
        return;
      }
      const data = snap.data() as Partial<AppSecuritySettings>;
      callback({
        defaultMobileLimit:
          typeof data.defaultMobileLimit === 'number' && data.defaultMobileLimit >= 0
            ? data.defaultMobileLimit
            : 1,
        defaultWebLimit:
          typeof data.defaultWebLimit === 'number' && data.defaultWebLimit >= 0
            ? data.defaultWebLimit
            : 1,
        requireApprovalForNewDevice: data.requireApprovalForNewDevice !== false,
        updatedAt: data.updatedAt || '',
        updatedBy: data.updatedBy || SECURITY_SUPER_ADMIN_EMAIL,
      });
    },
    () => {
      callback(DEFAULT_SECURITY_SETTINGS);
    }
  );
}

export function resolveEffectiveDeviceLimits(
  profile: UserProfile | null | undefined,
  globalSettings: AppSecuritySettings
): { mobile: number; web: number } {
  const userMob = profile?.deviceLimits?.mobile;
  const userWeb = profile?.deviceLimits?.web;
  return {
    mobile:
      typeof userMob === 'number' && Number.isFinite(userMob) && userMob >= 0
        ? Math.min(20, Math.round(userMob))
        : globalSettings.defaultMobileLimit,
    web:
      typeof userWeb === 'number' && Number.isFinite(userWeb) && userWeb >= 0
        ? Math.min(20, Math.round(userWeb))
        : globalSettings.defaultWebLimit,
  };
}

export async function adminUpdateGlobalSecuritySettings(
  settings: {
    defaultMobileLimit: number;
    defaultWebLimit: number;
    requireApprovalForNewDevice: boolean;
  },
  adminEmail: string
): Promise<void> {
  const path = 'app_settings/security';
  const cleanAdmin =
    (adminEmail || SECURITY_SUPER_ADMIN_EMAIL).trim().slice(0, 150) || SECURITY_SUPER_ADMIN_EMAIL;
  const payload: AppSecuritySettings = {
    defaultMobileLimit: Math.min(20, Math.max(0, Math.round(settings.defaultMobileLimit))),
    defaultWebLimit: Math.min(20, Math.max(0, Math.round(settings.defaultWebLimit))),
    requireApprovalForNewDevice: Boolean(settings.requireApprovalForNewDevice),
    updatedAt: new Date().toISOString(),
    updatedBy: cleanAdmin,
  };
  try {
    await setDoc(doc(db, 'app_settings', 'security'), payload);
    await writeSecurityAuditLog(
      'update_device_policy',
      `Updated global device limits: Mobile=${payload.defaultMobileLimit}, PC/Web=${payload.defaultWebLimit}, Approval=${payload.requireApprovalForNewDevice}`,
      cleanAdmin,
      'security',
      'Global Device Policy'
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function adminUpdateUserDeviceLimits(
  targetUserId: string,
  limits: UserDeviceLimits | null,
  adminEmail: string,
  targetName?: string
): Promise<void> {
  const path = `users/${targetUserId}`;
  const cleanAdmin =
    (adminEmail || SECURITY_SUPER_ADMIN_EMAIL).trim().slice(0, 150) || SECURITY_SUPER_ADMIN_EMAIL;
  const cleanLimits: UserDeviceLimits | null =
    limits === null
      ? null
      : {
          ...(typeof limits.mobile === 'number' && Number.isFinite(limits.mobile)
            ? { mobile: Math.min(20, Math.max(0, Math.round(limits.mobile))) }
            : {}),
          ...(typeof limits.web === 'number' && Number.isFinite(limits.web)
            ? { web: Math.min(20, Math.max(0, Math.round(limits.web))) }
            : {}),
        };
  try {
    await updateDoc(doc(db, 'users', targetUserId), {
      deviceLimits: cleanLimits,
    });
    await writeSecurityAuditLog(
      'update_device_policy',
      cleanLimits
        ? `Set custom device limits for ${targetName || targetUserId}: Mobile=${cleanLimits.mobile ?? 'default'}, Web/PC=${cleanLimits.web ?? 'default'}.`
        : `Reset device limits for ${targetName || targetUserId} to global defaults.`,
      cleanAdmin,
      targetUserId,
      targetName || targetUserId
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminUnlockPhoneCooldown(
  targetUserId: string,
  adminEmail: string,
  targetName?: string
): Promise<void> {
  const path = `users/${targetUserId}`;
  const cleanAdmin =
    (adminEmail || SECURITY_SUPER_ADMIN_EMAIL).trim().slice(0, 150) || SECURITY_SUPER_ADMIN_EMAIL;
  try {
    await updateDoc(doc(db, 'users', targetUserId), {
      phoneChangeCooldownBypass: true,
    });
    await writeSecurityAuditLog(
      'unlock_phone_cooldown',
      `Unlocked 30-day mobile number change cooldown for ${targetName || targetUserId}.`,
      cleanAdmin,
      targetUserId,
      targetName || targetUserId
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function registerOrSyncDeviceSession(
  profile: UserProfile
): Promise<DeviceSession | null> {
  const meta = getCurrentDeviceMetadata();
  const path = `users/${profile.userId}/sessions/${meta.deviceId}`;
  try {
    const [globalSettings, sessionsSnap, approxLoc] = await Promise.all([
      getGlobalSecuritySettings(),
      getDocs(collection(db, 'users', profile.userId, 'sessions')),
      fetchApproxLocation(),
    ]);

    const limits = resolveEffectiveDeviceLimits(profile, globalSettings);
    const categoryLimit = meta.platformCategory === 'mobile' ? limits.mobile : limits.web;

    const allSessions: DeviceSession[] = [];
    sessionsSnap.forEach((d) => allSessions.push(d.data() as DeviceSession));

    const existing = allSessions.find((s) => s.deviceId === meta.deviceId);
    const otherActive = allSessions.filter(
      (s) => s.deviceId !== meta.deviceId && s.status === 'active'
    );
    const otherActiveInCat = otherActive.filter(
      (s) => s.platformCategory === meta.platformCategory
    );

    const isLimitBlocked = categoryLimit === 0 || otherActiveInCat.length >= categoryLimit;
    const nowIso = new Date().toISOString();

    let nextStatus: DeviceSession['status'] = 'active';
    let isPrimaryTrusted = existing?.isPrimaryTrusted ?? false;

    if (existing) {
      if (existing.status === 'active') {
        if (categoryLimit === 0) {
          nextStatus = 'logged_out';
        } else {
          nextStatus = 'active';
        }
      } else if (existing.status === 'rejected') {
        nextStatus = 'rejected';
      } else if (existing.status === 'pending_approval') {
        if (otherActive.length === 0 && !isLimitBlocked) {
          nextStatus = 'active';
          isPrimaryTrusted = true;
        } else {
          nextStatus = 'pending_approval';
        }
      } else {
        // Re-login from 'logged_out'
        if (categoryLimit === 0) {
          nextStatus = 'pending_approval';
        } else if (otherActive.length === 0) {
          nextStatus = 'active';
          isPrimaryTrusted = true;
        } else if (!globalSettings.requireApprovalForNewDevice && !isLimitBlocked) {
          nextStatus = 'active';
        } else {
          nextStatus = 'pending_approval';
        }
      }
    } else {
      if (categoryLimit === 0) {
        nextStatus = 'pending_approval';
      } else if (otherActive.length === 0) {
        nextStatus = 'active';
        isPrimaryTrusted = true;
      } else if (!globalSettings.requireApprovalForNewDevice && !isLimitBlocked) {
        nextStatus = 'active';
      } else {
        nextStatus = 'pending_approval';
      }
    }

    const sessionDoc: DeviceSession = {
      deviceId: meta.deviceId,
      userId: profile.userId,
      platformCategory: meta.platformCategory,
      runtimeType: meta.runtimeType,
      deviceLabel: meta.deviceLabel,
      ...(approxLoc ? { approxLocation: approxLoc } : existing?.approxLocation ? { approxLocation: existing.approxLocation } : {}),
      status: nextStatus,
      isPrimaryTrusted,
      limitBlocked: isLimitBlocked,
      ...(existing?.approvedByDeviceId ? { approvedByDeviceId: existing.approvedByDeviceId } : {}),
      ...(existing?.rejectedByDeviceId ? { rejectedByDeviceId: existing.rejectedByDeviceId } : {}),
      ...(existing?.rejectionNote ? { rejectionNote: existing.rejectionNote } : {}),
      createdAt: existing?.createdAt || nowIso,
      loginAt: existing?.status === 'logged_out' || !existing ? nowIso : existing.loginAt || nowIso,
      lastActiveAt: nowIso,
    };

    await setDoc(doc(db, 'users', profile.userId, 'sessions', meta.deviceId), sessionDoc);
    return sessionDoc;
  } catch (err) {
    console.warn('Device session sync warning:', err, path);
    return null;
  }
}

export function subscribeToUserDeviceSessions(
  userId: string,
  callback: (sessions: DeviceSession[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'users', userId, 'sessions'),
    (snap) => {
      const list = snap.docs.map((d) => d.data() as DeviceSession);
      list.sort(
        (a, b) =>
          new Date(b.lastActiveAt || b.createdAt).getTime() -
          new Date(a.lastActiveAt || a.createdAt).getTime()
      );
      callback(list);
    },
    (error) => {
      console.warn('Device sessions subscription warning:', error);
    }
  );
}

export async function approveDeviceSession(
  userId: string,
  targetDeviceId: string,
  approverDeviceId: string,
  profile?: UserProfile | null
): Promise<void> {
  const [globalSettings, sessionsSnap] = await Promise.all([
    getGlobalSecuritySettings(),
    getDocs(collection(db, 'users', userId, 'sessions')),
  ]);

  const sessions = sessionsSnap.docs.map((d) => d.data() as DeviceSession);
  const target = sessions.find((s) => s.deviceId === targetDeviceId);
  if (!target) return;

  const limits = resolveEffectiveDeviceLimits(profile, globalSettings);
  const categoryLimit = target.platformCategory === 'mobile' ? limits.mobile : limits.web;

  if (categoryLimit === 0) {
    throw new Error(
      `Admin has set ${target.platformCategory} device limit to 0 for this account.`
    );
  }

  const activeInCat = sessions
    .filter(
      (s) =>
        s.deviceId !== targetDeviceId &&
        s.status === 'active' &&
        s.platformCategory === target.platformCategory
    )
    .sort(
      (a, b) =>
        new Date(a.lastActiveAt || a.createdAt).getTime() -
        new Date(b.lastActiveAt || b.createdAt).getTime()
    );

  // If category quota is full, log out oldest active sessions (preferring non-approver first)
  let excess = activeInCat.length - (categoryLimit - 1);
  if (excess > 0) {
    const candidates = [
      ...activeInCat.filter((s) => s.deviceId !== approverDeviceId),
      ...activeInCat.filter((s) => s.deviceId === approverDeviceId),
    ];
    for (const oldSess of candidates) {
      if (excess <= 0) break;
      await updateDoc(doc(db, 'users', userId, 'sessions', oldSess.deviceId), {
        status: 'logged_out',
        lastActiveAt: new Date().toISOString(),
      });
      excess -= 1;
    }
  }

  await updateDoc(doc(db, 'users', userId, 'sessions', targetDeviceId), {
    status: 'active',
    limitBlocked: false,
    approvedByDeviceId: approverDeviceId,
    rejectedByDeviceId: null,
    rejectionNote: null,
    lastActiveAt: new Date().toISOString(),
  });
}

export async function rejectDeviceSession(
  userId: string,
  targetDeviceId: string,
  rejectorDeviceId: string,
  note?: string
): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'sessions', targetDeviceId), {
    status: 'rejected',
    rejectedByDeviceId: rejectorDeviceId,
    rejectionNote: (note || 'Blocked by account owner').slice(0, 300),
    lastActiveAt: new Date().toISOString(),
  });
}

export async function retryRejectedDeviceSession(
  userId: string,
  deviceId: string
): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'sessions', deviceId), {
    status: 'pending_approval',
    rejectedByDeviceId: null,
    rejectionNote: null,
    loginAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  });
}

export async function markDeviceSessionLoggedOut(
  userId: string,
  deviceId: string
): Promise<void> {
  try {
    const ref = doc(db, 'users', userId, 'sessions', deviceId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    await updateDoc(ref, {
      status: 'logged_out',
      lastActiveAt: new Date().toISOString(),
    });
  } catch {
    // non-blocking cleanup on sign-out
  }
}

export async function adminForceLogoutDeviceSession(
  targetUserId: string,
  deviceId: string,
  adminEmail: string,
  targetName?: string
): Promise<void> {
  const path = `users/${targetUserId}/sessions/${deviceId}`;
  try {
    await updateDoc(doc(db, 'users', targetUserId, 'sessions', deviceId), {
      status: 'logged_out',
      rejectedByDeviceId: 'admin',
      rejectionNote: 'Force logged out by Super Admin',
      lastActiveAt: new Date().toISOString(),
    });
    await writeSecurityAuditLog(
      'force_logout_device',
      `Forced logout of device session (${deviceId}) for ${targetName || targetUserId}.`,
      adminEmail,
      targetUserId,
      targetName || targetUserId
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminApproveDeviceSession(
  targetUserId: string,
  deviceId: string,
  adminEmail: string,
  profile: UserProfile
): Promise<void> {
  const path = `users/${targetUserId}/sessions/${deviceId}`;
  try {
    await approveDeviceSession(targetUserId, deviceId, 'super_admin', profile);
    await writeSecurityAuditLog(
      'approve_device_session',
      `Approved device session (${deviceId}) for ${profile.displayName || targetUserId}.`,
      adminEmail,
      targetUserId,
      profile.displayName || targetUserId
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminDeleteDeviceSession(
  targetUserId: string,
  deviceId: string,
  adminEmail: string,
  targetName?: string
): Promise<void> {
  const path = `users/${targetUserId}/sessions/${deviceId}`;
  try {
    await deleteDoc(doc(db, 'users', targetUserId, 'sessions', deviceId));
    await writeSecurityAuditLog(
      'force_logout_device',
      `Removed device session record (${deviceId}) for ${targetName || targetUserId}.`,
      adminEmail,
      targetUserId,
      targetName || targetUserId
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
