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
import { auth, db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';
import { isNativeApkApp } from '../utils/appVersion';
import type {
  AdminAuditLog,
  AdminSecuritySettings,
  AppSecuritySettings,
  DeviceSession,
  NewDeviceApprovalMode,
  PublicAuthFlags,
  UserDeviceLimits,
  UserProfile,
} from '../types/chat';
import type { DeviceApprovalQrPayload } from '../utils/accountShortcut';

const DEVICE_ID_STORAGE_KEY = 'anomah_device_id_v1';
const APPROX_LOC_CACHE_KEY = 'anomah_approx_loc_v1';
const SECURITY_SUPER_ADMIN_EMAIL = 'chinisdramaorg@gmail.com';
export const QR_CHALLENGE_TTL_MS = 120_000;

export const DEFAULT_SECURITY_SETTINGS: AppSecuritySettings = {
  defaultMobileLimit: 1,
  defaultWebLimit: 1,
  requireApprovalForNewDevice: false,
  newDeviceApprovalMode: 'optional',
  defaultOptionalApproval: false,
  enableMagicLinkLogin: false,
  enableQrDeviceApproval: true,
  updatedAt: '',
  updatedBy: SECURITY_SUPER_ADMIN_EMAIL,
};

export const DEFAULT_PUBLIC_AUTH_FLAGS: PublicAuthFlags = {
  enableMagicLinkLogin: false,
  enableQrDeviceApproval: true,
  updatedAt: '',
};

export const DEFAULT_ADMIN_SECURITY_SETTINGS: AdminSecuritySettings = {
  adminMobileLimit: 5,
  adminWebLimit: 5,
  adminLoginMode: 'fast_alert',
  updatedAt: '',
  updatedBy: SECURITY_SUPER_ADMIN_EMAIL,
};

export function generateQrChallengeToken(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function normalizeSecuritySettings(
  data: Partial<AppSecuritySettings> | undefined
): AppSecuritySettings {
  if (!data) return DEFAULT_SECURITY_SETTINGS;
  const legacyReq = data.requireApprovalForNewDevice !== false;
  const newDeviceApprovalMode: NewDeviceApprovalMode =
    data.newDeviceApprovalMode === 'off' ||
    data.newDeviceApprovalMode === 'optional' ||
    data.newDeviceApprovalMode === 'required'
      ? data.newDeviceApprovalMode
      : legacyReq
      ? 'optional'
      : 'off';

  return {
    defaultMobileLimit:
      typeof data.defaultMobileLimit === 'number' && data.defaultMobileLimit >= 0
        ? data.defaultMobileLimit
        : 1,
    defaultWebLimit:
      typeof data.defaultWebLimit === 'number' && data.defaultWebLimit >= 0
        ? data.defaultWebLimit
        : 1,
    requireApprovalForNewDevice: newDeviceApprovalMode !== 'off',
    newDeviceApprovalMode,
    defaultOptionalApproval: data.defaultOptionalApproval === true,
    enableMagicLinkLogin: data.enableMagicLinkLogin === true,
    enableQrDeviceApproval: data.enableQrDeviceApproval !== false,
    updatedAt: data.updatedAt || '',
    updatedBy: data.updatedBy || SECURITY_SUPER_ADMIN_EMAIL,
  };
}

export function isApprovalRequiredForUser(
  profile: UserProfile | null | undefined,
  globalSettings: AppSecuritySettings
): boolean {
  const mode: NewDeviceApprovalMode =
    globalSettings.newDeviceApprovalMode === 'off' ||
    globalSettings.newDeviceApprovalMode === 'optional' ||
    globalSettings.newDeviceApprovalMode === 'required'
      ? globalSettings.newDeviceApprovalMode
      : globalSettings.requireApprovalForNewDevice
      ? 'optional'
      : 'off';

  if (mode === 'off') return false;
  if (mode === 'required') return true;
  if (typeof profile?.requireDeviceApproval === 'boolean') {
    return profile.requireDeviceApproval;
  }
  return globalSettings.defaultOptionalApproval === true;
}

function isCurrentAuthVerifiedAdmin(targetUid?: string): boolean {
  const current = auth.currentUser;
  if (!current || !current.emailVerified) return false;
  if (targetUid && current.uid !== targetUid) return false;
  return current.email?.trim().toLowerCase() === SECURITY_SUPER_ADMIN_EMAIL;
}

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

export async function getPublicAuthFlags(): Promise<PublicAuthFlags> {
  try {
    const snap = await getDoc(doc(db, 'app_settings', 'public_flags'));
    if (!snap.exists()) return DEFAULT_PUBLIC_AUTH_FLAGS;
    const data = snap.data() as Partial<PublicAuthFlags>;
    return {
      enableMagicLinkLogin: data.enableMagicLinkLogin === true,
      enableQrDeviceApproval: data.enableQrDeviceApproval !== false,
      updatedAt: data.updatedAt || '',
    };
  } catch {
    return DEFAULT_PUBLIC_AUTH_FLAGS;
  }
}

export function subscribeToPublicAuthFlags(
  callback: (flags: PublicAuthFlags) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'app_settings', 'public_flags'),
    (snap) => {
      if (!snap.exists()) {
        callback(DEFAULT_PUBLIC_AUTH_FLAGS);
        return;
      }
      const data = snap.data() as Partial<PublicAuthFlags>;
      callback({
        enableMagicLinkLogin: data.enableMagicLinkLogin === true,
        enableQrDeviceApproval: data.enableQrDeviceApproval !== false,
        updatedAt: data.updatedAt || '',
      });
    },
    () => {
      callback(DEFAULT_PUBLIC_AUTH_FLAGS);
    }
  );
}

export async function getGlobalSecuritySettings(): Promise<AppSecuritySettings> {
  try {
    const snap = await getDoc(doc(db, 'app_settings', 'security'));
    if (!snap.exists()) return DEFAULT_SECURITY_SETTINGS;
    return normalizeSecuritySettings(snap.data() as Partial<AppSecuritySettings>);
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
      callback(normalizeSecuritySettings(snap.data() as Partial<AppSecuritySettings>));
    },
    () => {
      callback(DEFAULT_SECURITY_SETTINGS);
    }
  );
}

export async function getAdminSecuritySettings(): Promise<AdminSecuritySettings> {
  if (!isCurrentAuthVerifiedAdmin()) return DEFAULT_ADMIN_SECURITY_SETTINGS;
  try {
    const snap = await getDoc(doc(db, 'app_settings', 'admin_security'));
    if (!snap.exists()) return DEFAULT_ADMIN_SECURITY_SETTINGS;
    const data = snap.data() as Partial<AdminSecuritySettings>;
    return {
      adminMobileLimit:
        typeof data.adminMobileLimit === 'number' && data.adminMobileLimit >= 0
          ? Math.min(20, Math.round(data.adminMobileLimit))
          : DEFAULT_ADMIN_SECURITY_SETTINGS.adminMobileLimit,
      adminWebLimit:
        typeof data.adminWebLimit === 'number' && data.adminWebLimit >= 0
          ? Math.min(20, Math.round(data.adminWebLimit))
          : DEFAULT_ADMIN_SECURITY_SETTINGS.adminWebLimit,
      adminLoginMode:
        data.adminLoginMode === 'strict_approval' ? 'strict_approval' : 'fast_alert',
      updatedAt: data.updatedAt || '',
      updatedBy: data.updatedBy || SECURITY_SUPER_ADMIN_EMAIL,
    };
  } catch {
    return DEFAULT_ADMIN_SECURITY_SETTINGS;
  }
}

export function subscribeToAdminSecuritySettings(
  callback: (settings: AdminSecuritySettings) => void
): Unsubscribe {
  if (!isCurrentAuthVerifiedAdmin()) {
    callback(DEFAULT_ADMIN_SECURITY_SETTINGS);
    return () => {};
  }
  return onSnapshot(
    doc(db, 'app_settings', 'admin_security'),
    (snap) => {
      if (!snap.exists()) {
        callback(DEFAULT_ADMIN_SECURITY_SETTINGS);
        return;
      }
      const data = snap.data() as Partial<AdminSecuritySettings>;
      callback({
        adminMobileLimit:
          typeof data.adminMobileLimit === 'number' && data.adminMobileLimit >= 0
            ? Math.min(20, Math.round(data.adminMobileLimit))
            : DEFAULT_ADMIN_SECURITY_SETTINGS.adminMobileLimit,
        adminWebLimit:
          typeof data.adminWebLimit === 'number' && data.adminWebLimit >= 0
            ? Math.min(20, Math.round(data.adminWebLimit))
            : DEFAULT_ADMIN_SECURITY_SETTINGS.adminWebLimit,
        adminLoginMode:
          data.adminLoginMode === 'strict_approval' ? 'strict_approval' : 'fast_alert',
        updatedAt: data.updatedAt || '',
        updatedBy: data.updatedBy || SECURITY_SUPER_ADMIN_EMAIL,
      });
    },
    () => {
      callback(DEFAULT_ADMIN_SECURITY_SETTINGS);
    }
  );
}

export function resolveEffectiveDeviceLimits(
  profile: UserProfile | null | undefined,
  globalSettings: AppSecuritySettings,
  options?: {
    isVerifiedAdmin?: boolean;
    adminSettings?: AdminSecuritySettings;
  }
): { mobile: number; web: number } {
  const userMob = profile?.deviceLimits?.mobile;
  const userWeb = profile?.deviceLimits?.web;

  const isTargetSuperAdmin =
    Boolean(options?.isVerifiedAdmin) ||
    profile?.email?.trim().toLowerCase() === SECURITY_SUPER_ADMIN_EMAIL;

  const fallbackMobile = isTargetSuperAdmin
    ? options?.adminSettings?.adminMobileLimit ?? DEFAULT_ADMIN_SECURITY_SETTINGS.adminMobileLimit
    : globalSettings.defaultMobileLimit;
  const fallbackWeb = isTargetSuperAdmin
    ? options?.adminSettings?.adminWebLimit ?? DEFAULT_ADMIN_SECURITY_SETTINGS.adminWebLimit
    : globalSettings.defaultWebLimit;

  return {
    mobile:
      typeof userMob === 'number' && Number.isFinite(userMob) && userMob >= 0
        ? Math.min(20, Math.round(userMob))
        : fallbackMobile,
    web:
      typeof userWeb === 'number' && Number.isFinite(userWeb) && userWeb >= 0
        ? Math.min(20, Math.round(userWeb))
        : fallbackWeb,
  };
}

export async function adminUpdateGlobalSecuritySettings(
  settings: {
    defaultMobileLimit: number;
    defaultWebLimit: number;
    requireApprovalForNewDevice?: boolean;
    newDeviceApprovalMode?: NewDeviceApprovalMode;
    defaultOptionalApproval?: boolean;
    enableMagicLinkLogin?: boolean;
    enableQrDeviceApproval?: boolean;
  },
  adminEmail: string
): Promise<void> {
  const path = 'app_settings/security';
  const cleanAdmin =
    (adminEmail || SECURITY_SUPER_ADMIN_EMAIL).trim().slice(0, 150) || SECURITY_SUPER_ADMIN_EMAIL;
  const nowIso = new Date().toISOString();
  const mode: NewDeviceApprovalMode =
    settings.newDeviceApprovalMode === 'off' ||
    settings.newDeviceApprovalMode === 'optional' ||
    settings.newDeviceApprovalMode === 'required'
      ? settings.newDeviceApprovalMode
      : settings.requireApprovalForNewDevice === false
      ? 'off'
      : 'optional';

  const payload: AppSecuritySettings = {
    defaultMobileLimit: Math.min(20, Math.max(0, Math.round(settings.defaultMobileLimit))),
    defaultWebLimit: Math.min(20, Math.max(0, Math.round(settings.defaultWebLimit))),
    requireApprovalForNewDevice: mode !== 'off',
    newDeviceApprovalMode: mode,
    defaultOptionalApproval: settings.defaultOptionalApproval === true,
    enableMagicLinkLogin: settings.enableMagicLinkLogin === true,
    enableQrDeviceApproval: settings.enableQrDeviceApproval !== false,
    updatedAt: nowIso,
    updatedBy: cleanAdmin,
  };

  const publicFlagsPayload: PublicAuthFlags = {
    enableMagicLinkLogin: payload.enableMagicLinkLogin === true,
    enableQrDeviceApproval: payload.enableQrDeviceApproval !== false,
    updatedAt: nowIso,
  };

  try {
    await Promise.all([
      setDoc(doc(db, 'app_settings', 'security'), payload),
      setDoc(doc(db, 'app_settings', 'public_flags'), publicFlagsPayload),
    ]);
    await writeSecurityAuditLog(
      'update_device_policy',
      `Updated global policy: Mobile=${payload.defaultMobileLimit}, PC/Web=${payload.defaultWebLimit}, 2FA=${mode}, MagicLink=${publicFlagsPayload.enableMagicLinkLogin}, QrApproval=${publicFlagsPayload.enableQrDeviceApproval}`,
      cleanAdmin,
      'security',
      'Global Security & Auth Policy'
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserRequireDeviceApproval(
  userId: string,
  enabled: boolean
): Promise<void> {
  const path = `users/${userId}`;
  try {
    await updateDoc(doc(db, 'users', userId), {
      requireDeviceApproval: Boolean(enabled),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminUpdateAdminSecuritySettings(
  settings: {
    adminMobileLimit: number;
    adminWebLimit: number;
    adminLoginMode: 'fast_alert' | 'strict_approval';
  },
  adminEmail: string
): Promise<void> {
  const path = 'app_settings/admin_security';
  const cleanAdmin =
    (adminEmail || SECURITY_SUPER_ADMIN_EMAIL).trim().slice(0, 150) || SECURITY_SUPER_ADMIN_EMAIL;
  const payload: AdminSecuritySettings = {
    adminMobileLimit: Math.min(20, Math.max(0, Math.round(settings.adminMobileLimit))),
    adminWebLimit: Math.min(20, Math.max(0, Math.round(settings.adminWebLimit))),
    adminLoginMode:
      settings.adminLoginMode === 'strict_approval' ? 'strict_approval' : 'fast_alert',
    updatedAt: new Date().toISOString(),
    updatedBy: cleanAdmin,
  };
  try {
    await setDoc(doc(db, 'app_settings', 'admin_security'), payload);
    await writeSecurityAuditLog(
      'update_device_policy',
      `Updated Super Admin device policy: Mobile=${payload.adminMobileLimit}, Web/PC=${payload.adminWebLimit}, Mode=${payload.adminLoginMode}`,
      cleanAdmin,
      'admin_security',
      'Super Admin Security Policy'
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
        : `Reset device limits for ${targetName || targetUserId} to default policy.`,
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
  const isVerifiedAdmin = isCurrentAuthVerifiedAdmin(profile.userId);

  try {
    const [globalSettings, adminSettings, sessionsSnap, approxLoc] = await Promise.all([
      getGlobalSecuritySettings(),
      isVerifiedAdmin ? getAdminSecuritySettings() : Promise.resolve(DEFAULT_ADMIN_SECURITY_SETTINGS),
      getDocs(collection(db, 'users', profile.userId, 'sessions')),
      fetchApproxLocation(),
    ]);

    const limits = resolveEffectiveDeviceLimits(profile, globalSettings, {
      isVerifiedAdmin,
      adminSettings,
    });
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
    let adminAlertPending = existing?.adminAlertPending ?? false;
    let shouldWriteAdminLoginLog = false;

    const canReuseTrusted = Boolean(
      existing &&
        existing.isPrimaryTrusted === true &&
        !existing.rejectedByDeviceId &&
        !isLimitBlocked
    );

    const canUseAdminFastAlert = Boolean(
      isVerifiedAdmin &&
        !isLimitBlocked &&
        adminSettings.adminLoginMode === 'fast_alert' &&
        !existing?.rejectedByDeviceId
    );

    const userRequiresApproval = isApprovalRequiredForUser(profile, globalSettings);

    if (existing) {
      if (existing.status === 'rejected') {
        nextStatus = 'rejected';
        isPrimaryTrusted = false;
        adminAlertPending = false;
      } else if (existing.status === 'active') {
        if (categoryLimit === 0) {
          nextStatus = 'logged_out';
          adminAlertPending = false;
        } else {
          nextStatus = 'active';
        }
      } else if (existing.status === 'pending_approval') {
        if (otherActive.length === 0 && !isLimitBlocked) {
          nextStatus = 'active';
          isPrimaryTrusted = true;
          adminAlertPending = false;
        } else if (canUseAdminFastAlert) {
          nextStatus = 'active';
          adminAlertPending = true;
          shouldWriteAdminLoginLog = true;
        } else {
          nextStatus = 'pending_approval';
        }
      } else {
        // Re-login from 'logged_out'
        if (categoryLimit === 0) {
          nextStatus = 'pending_approval';
          adminAlertPending = false;
        } else if (otherActive.length === 0) {
          nextStatus = 'active';
          isPrimaryTrusted = true;
          adminAlertPending = false;
        } else if (canReuseTrusted) {
          nextStatus = 'active';
          adminAlertPending = false;
        } else if (canUseAdminFastAlert) {
          nextStatus = 'active';
          adminAlertPending = true;
          shouldWriteAdminLoginLog = true;
        } else if (!userRequiresApproval && !isLimitBlocked) {
          nextStatus = 'active';
          adminAlertPending = false;
        } else {
          nextStatus = 'pending_approval';
          adminAlertPending = false;
        }
      }
    } else {
      if (categoryLimit === 0) {
        nextStatus = 'pending_approval';
        adminAlertPending = false;
      } else if (otherActive.length === 0) {
        nextStatus = 'active';
        isPrimaryTrusted = true;
        adminAlertPending = false;
      } else if (canUseAdminFastAlert) {
        nextStatus = 'active';
        isPrimaryTrusted = false;
        adminAlertPending = true;
        shouldWriteAdminLoginLog = true;
      } else if (!userRequiresApproval && !isLimitBlocked) {
        nextStatus = 'active';
        adminAlertPending = false;
      } else {
        nextStatus = 'pending_approval';
        adminAlertPending = false;
      }
    }

    const nowMs = Date.now();
    const canKeepExistingChallenge = Boolean(
      nextStatus === 'pending_approval' &&
        existing?.status === 'pending_approval' &&
        existing.approvalChallenge &&
        typeof existing.approvalChallengeExpiresAtMs === 'number' &&
        existing.approvalChallengeExpiresAtMs > nowMs + 15_000
    );

    const approvalChallenge =
      nextStatus === 'pending_approval' && globalSettings.enableQrDeviceApproval !== false
        ? canKeepExistingChallenge
          ? existing!.approvalChallenge!
          : generateQrChallengeToken()
        : null;

    const approvalChallengeExpiresAtMs =
      approvalChallenge !== null
        ? canKeepExistingChallenge
          ? existing!.approvalChallengeExpiresAtMs!
          : nowMs + QR_CHALLENGE_TTL_MS
        : null;

    const sessionDoc: DeviceSession = {
      deviceId: meta.deviceId,
      userId: profile.userId,
      platformCategory: meta.platformCategory,
      runtimeType: meta.runtimeType,
      deviceLabel: meta.deviceLabel,
      ...(approxLoc
        ? { approxLocation: approxLoc }
        : existing?.approxLocation
        ? { approxLocation: existing.approxLocation }
        : {}),
      status: nextStatus,
      isPrimaryTrusted,
      adminAlertPending,
      limitBlocked: isLimitBlocked,
      ...(existing?.approvedByDeviceId ? { approvedByDeviceId: existing.approvedByDeviceId } : {}),
      ...(existing?.rejectedByDeviceId ? { rejectedByDeviceId: existing.rejectedByDeviceId } : {}),
      ...(existing?.rejectionNote ? { rejectionNote: existing.rejectionNote } : {}),
      approvalChallenge,
      approvalChallengeExpiresAtMs,
      ...(existing?.approvalMethod ? { approvalMethod: existing.approvalMethod } : {}),
      ...(existing?.qrApprovedAt ? { qrApprovedAt: existing.qrApprovedAt } : {}),
      createdAt: existing?.createdAt || nowIso,
      loginAt: existing?.status === 'logged_out' || !existing ? nowIso : existing.loginAt || nowIso,
      lastActiveAt: nowIso,
    };

    await setDoc(doc(db, 'users', profile.userId, 'sessions', meta.deviceId), sessionDoc);

    if (shouldWriteAdminLoginLog) {
      await writeSecurityAuditLog(
        'admin_device_login',
        `Super Admin signed in from ${meta.deviceLabel} (${meta.runtimeType.toUpperCase()})${
          approxLoc ? ` near ${approxLoc}` : ''
        } via Fast Alert mode.`,
        profile.email || SECURITY_SUPER_ADMIN_EMAIL,
        meta.deviceId,
        meta.deviceLabel
      );
    }

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
  profile?: UserProfile | null,
  approvalMethod: 'device_tap' | 'qr_scan' | 'app_lock_pin' | 'admin' = 'device_tap'
): Promise<void> {
  const isVerifiedAdmin = isCurrentAuthVerifiedAdmin(userId);
  const [globalSettings, adminSettings, sessionsSnap] = await Promise.all([
    getGlobalSecuritySettings(),
    isVerifiedAdmin ? getAdminSecuritySettings() : Promise.resolve(DEFAULT_ADMIN_SECURITY_SETTINGS),
    getDocs(collection(db, 'users', userId, 'sessions')),
  ]);

  const sessions = sessionsSnap.docs.map((d) => d.data() as DeviceSession);
  const target = sessions.find((s) => s.deviceId === targetDeviceId);
  if (!target) return;

  const limits = resolveEffectiveDeviceLimits(profile, globalSettings, {
    isVerifiedAdmin,
    adminSettings,
  });
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
        isPrimaryTrusted: false,
        adminAlertPending: false,
        lastActiveAt: new Date().toISOString(),
      });
      excess -= 1;
    }
  }

  const nowIso = new Date().toISOString();
  await updateDoc(doc(db, 'users', userId, 'sessions', targetDeviceId), {
    status: 'active',
    isPrimaryTrusted: true,
    adminAlertPending: false,
    limitBlocked: false,
    approvedByDeviceId: approverDeviceId,
    rejectedByDeviceId: null,
    rejectionNote: null,
    approvalChallenge: null,
    approvalChallengeExpiresAtMs: null,
    approvalMethod,
    qrApprovedAt: approvalMethod === 'qr_scan' ? nowIso : null,
    lastActiveAt: nowIso,
  });
}

export async function issuePendingDeviceQrChallenge(
  userId: string,
  deviceId: string
): Promise<{ challenge: string; expiresAtMs: number } | null> {
  const ref = doc(db, 'users', userId, 'sessions', deviceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as DeviceSession;
  if (data.status !== 'pending_approval') return null;

  const challenge = generateQrChallengeToken();
  const expiresAtMs = Date.now() + QR_CHALLENGE_TTL_MS;
  await updateDoc(ref, {
    approvalChallenge: challenge,
    approvalChallengeExpiresAtMs: expiresAtMs,
    lastActiveAt: new Date().toISOString(),
  });
  return { challenge, expiresAtMs };
}

export async function approveDeviceViaQrPayload(
  currentUser: UserProfile,
  approverDeviceId: string,
  payload: DeviceApprovalQrPayload,
  lang: 'en' | 'bn' = 'en'
): Promise<DeviceSession> {
  const publicFlags = await getPublicAuthFlags();
  if (!publicFlags.enableQrDeviceApproval) {
    throw new Error(
      lang === 'bn'
        ? 'অ্যাডমিন বর্তমানে QR ডিভাইস অনুমোদন ফিচারটি বন্ধ রেখেছেন।'
        : 'QR device approval is currently disabled by the administrator.'
    );
  }

  if (payload.userId !== currentUser.userId) {
    throw new Error(
      lang === 'bn'
        ? 'এই QR কোডটি অন্য অ্যাকাউন্টের! অনুমোদনের জন্য দুই ডিভাইসেই একই অ্যাকাউন্টে সাইন-ইন থাকতে হবে।'
        : 'This QR code belongs to a different account. Both devices must be signed into the same account.'
    );
  }

  if (payload.deviceId === approverDeviceId) {
    throw new Error(
      lang === 'bn'
        ? 'এই ডিভাইসটি ইতিমধ্যেই সক্রিয় রয়েছে।'
        : 'This device session is already active.'
    );
  }

  if (Date.now() > payload.expiresAtMs) {
    throw new Error(
      lang === 'bn'
        ? 'QR কোডটির মেয়াদ (২ মিনিট) শেষ হয়ে গেছে। অন্য স্ক্রিন থেকে "Refresh QR" চেপে আবার স্ক্যান করুন।'
        : 'This QR code has expired (2 min limit). Tap "Refresh QR" on the other device and scan again.'
    );
  }

  const targetRef = doc(db, 'users', payload.userId, 'sessions', payload.deviceId);
  const targetSnap = await getDoc(targetRef);
  if (!targetSnap.exists()) {
    throw new Error(
      lang === 'bn'
        ? 'ডিভাইস সেশনটি আর খুঁজে পাওয়া যায়নি। নতুন ডিভাইস থেকে পেজটি রিলোড করুন।'
        : 'Pending device session not found. Please reload the waiting screen.'
    );
  }

  const target = targetSnap.data() as DeviceSession;
  if (target.status !== 'pending_approval') {
    throw new Error(
      target.status === 'active'
        ? lang === 'bn'
          ? 'এই ডিভাইসটি ইতিমধ্যেই অনুমোদিত হয়ে গেছে।'
          : 'This device has already been approved.'
        : lang === 'bn'
        ? 'এই ডিভাইস সেশনটি বর্তমানে অনুমোদনের অপেক্ষায় নেই।'
        : 'This device session is no longer awaiting approval.'
    );
  }

  if (
    !target.approvalChallenge ||
    target.approvalChallenge !== payload.challenge ||
    typeof target.approvalChallengeExpiresAtMs !== 'number' ||
    Date.now() > target.approvalChallengeExpiresAtMs
  ) {
    throw new Error(
      lang === 'bn'
        ? 'QR কোডটি পুরোনো বা অবৈধ হয়ে গেছে। স্ক্রিনের নতুন QR কোডটি স্ক্যান করুন।'
        : 'This QR code is stale or already used. Please scan the newest QR code shown on the screen.'
    );
  }

  await approveDeviceSession(
    payload.userId,
    payload.deviceId,
    approverDeviceId,
    currentUser,
    'qr_scan'
  );
  return target;
}

export async function rejectDeviceSession(
  userId: string,
  targetDeviceId: string,
  rejectorDeviceId: string,
  note?: string
): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'sessions', targetDeviceId), {
    status: 'rejected',
    isPrimaryTrusted: false,
    adminAlertPending: false,
    rejectedByDeviceId: rejectorDeviceId,
    rejectionNote: (note || 'Blocked by account owner').slice(0, 300),
    lastActiveAt: new Date().toISOString(),
  });
}

export async function acknowledgeAdminLoginSession(
  userId: string,
  targetDeviceId: string,
  trustDevice: boolean
): Promise<void> {
  const ref = doc(db, 'users', userId, 'sessions', targetDeviceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as DeviceSession;
  if (data.status !== 'active') return;
  await updateDoc(ref, {
    adminAlertPending: false,
    ...(trustDevice ? { isPrimaryTrusted: true } : {}),
    lastActiveAt: new Date().toISOString(),
  });
}

export async function toggleDeviceTrust(
  userId: string,
  targetDeviceId: string,
  trusted: boolean
): Promise<void> {
  const ref = doc(db, 'users', userId, 'sessions', targetDeviceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as DeviceSession;
  if (data.status !== 'active') {
    throw new Error('Only active device sessions can be marked as trusted.');
  }
  await updateDoc(ref, {
    isPrimaryTrusted: trusted,
    adminAlertPending: false,
    lastActiveAt: new Date().toISOString(),
  });
}

export async function retryRejectedDeviceSession(
  userId: string,
  deviceId: string
): Promise<void> {
  const publicFlags = await getPublicAuthFlags();
  const challenge = publicFlags.enableQrDeviceApproval ? generateQrChallengeToken() : null;
  const expiresAtMs = challenge ? Date.now() + QR_CHALLENGE_TTL_MS : null;
  await updateDoc(doc(db, 'users', userId, 'sessions', deviceId), {
    status: 'pending_approval',
    isPrimaryTrusted: false,
    adminAlertPending: false,
    rejectedByDeviceId: null,
    rejectionNote: null,
    approvalChallenge: challenge,
    approvalChallengeExpiresAtMs: expiresAtMs,
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
      adminAlertPending: false,
      lastActiveAt: new Date().toISOString(),
    });
  } catch {
    // non-blocking cleanup on sign-out
  }
}

export async function remoteLogoutDeviceSession(
  userId: string,
  targetDeviceId: string
): Promise<void> {
  const ref = doc(db, 'users', userId, 'sessions', targetDeviceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  await updateDoc(ref, {
    status: 'logged_out',
    isPrimaryTrusted: false,
    adminAlertPending: false,
    lastActiveAt: new Date().toISOString(),
  });
}

export async function logoutAllOtherDeviceSessions(
  userId: string,
  currentDeviceId: string
): Promise<number> {
  const snap = await getDocs(collection(db, 'users', userId, 'sessions'));
  const nowIso = new Date().toISOString();
  let count = 0;
  for (const d of snap.docs) {
    const sess = d.data() as DeviceSession;
    if (
      sess.deviceId !== currentDeviceId &&
      (sess.status === 'active' || sess.status === 'pending_approval')
    ) {
      await updateDoc(doc(db, 'users', userId, 'sessions', sess.deviceId), {
        status: 'logged_out',
        isPrimaryTrusted: false,
        adminAlertPending: false,
        lastActiveAt: nowIso,
      });
      count += 1;
    }
  }
  return count;
}

export async function removeSessionHistoryRecord(
  userId: string,
  targetDeviceId: string,
  currentDeviceId: string
): Promise<void> {
  if (targetDeviceId === currentDeviceId) return;
  const ref = doc(db, 'users', userId, 'sessions', targetDeviceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as DeviceSession;
  if (data.status === 'active') {
    throw new Error('Sign out or block an active session before deleting its history.');
  }
  await deleteDoc(ref);
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
      isPrimaryTrusted: false,
      adminAlertPending: false,
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
    await approveDeviceSession(targetUserId, deviceId, 'super_admin', profile, 'admin');
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
