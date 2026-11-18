import type { UserProfile } from '../types/chat';
import { isNativeApkApp } from './appVersion';

export interface SavedDeviceAccount {
  userId: string;
  displayName: string;
  photoURL: string;
  email: string;
  maskedEmail: string;
  provider: 'password' | 'google';
  savedAt: string;
}

export interface DeepLinkTarget {
  type: 'chat' | 'group';
  value: string;
  isQr?: boolean;
}

const SAVED_ACCOUNTS_STORAGE_KEY = 'anomah_saved_device_accounts_v1';
export const PENDING_CHAT_TARGET_KEY = 'anomah_pending_chat_target';
export const PENDING_DEEP_LINK_KEY = 'anomah_pending_deep_link_v2';
const CANONICAL_WEB_URL = 'https://mydatasarverorg-ux.github.io/Anomahchat/';

export function getPublicAppBaseUrl(): string {
  if (typeof window === 'undefined') return CANONICAL_WEB_URL;
  if (isNativeApkApp()) {
    return CANONICAL_WEB_URL;
  }
  return `${window.location.origin}${window.location.pathname}`;
}

export function maskEmailAddress(email: string): string {
  const clean = email.trim();
  const atIndex = clean.indexOf('@');
  if (atIndex <= 0) return clean;
  const local = clean.slice(0, atIndex);
  const domain = clean.slice(atIndex + 1);
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}

export function getSavedDeviceAccounts(): SavedDeviceAccount[] {
  try {
    const raw = localStorage.getItem(SAVED_ACCOUNTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SavedDeviceAccount =>
        Boolean(item) &&
        typeof item.userId === 'string' &&
        typeof item.email === 'string' &&
        typeof item.displayName === 'string' &&
        (item.provider === 'password' || item.provider === 'google')
    );
  } catch {
    return [];
  }
}

export function saveDeviceAccount(
  account: Omit<SavedDeviceAccount, 'maskedEmail' | 'savedAt'>
): SavedDeviceAccount[] {
  if (!account.userId || !account.email) return getSavedDeviceAccounts();
  const cleanEmail = account.email.trim().toLowerCase();
  const entry: SavedDeviceAccount = {
    userId: account.userId,
    displayName: account.displayName.trim() || cleanEmail.split('@')[0],
    photoURL: account.photoURL || '',
    email: cleanEmail,
    maskedEmail: maskEmailAddress(cleanEmail),
    provider: account.provider,
    savedAt: new Date().toISOString(),
  };

  const existing = getSavedDeviceAccounts().filter(
    (item) => item.userId !== entry.userId && item.email.toLowerCase() !== cleanEmail
  );
  const next = [entry, ...existing].slice(0, 5);
  try {
    localStorage.setItem(SAVED_ACCOUNTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage quota
  }
  return next;
}

export function isDeviceAccountSaved(userId?: string | null): boolean {
  if (!userId) return false;
  return getSavedDeviceAccounts().some((item) => item.userId === userId);
}

export function removeSavedDeviceAccount(userId: string): SavedDeviceAccount[] {
  const next = getSavedDeviceAccounts().filter((item) => item.userId !== userId);
  try {
    localStorage.setItem(SAVED_ACCOUNTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function buildPersonalChatLink(
  user: Pick<UserProfile, 'userId' | 'username'>
): string {
  const baseUrl = getPublicAppBaseUrl();
  const target = user.username ? `@${user.username}` : `uid:${user.userId}`;
  return `${baseUrl}?chat=${encodeURIComponent(target)}`;
}

export function buildGroupInviteLink(groupId: string): string {
  const baseUrl = getPublicAppBaseUrl();
  return `${baseUrl}?group=${encodeURIComponent(groupId.trim())}`;
}

export function extractDeepLinkTarget(rawInput: string): DeepLinkTarget | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  try {
    if (
      trimmed.includes('://') ||
      trimmed.includes('?chat=') ||
      trimmed.includes('&chat=') ||
      trimmed.includes('?group=') ||
      trimmed.includes('&group=')
    ) {
      const normalized = trimmed.startsWith('http')
        ? trimmed
        : trimmed.startsWith('anomahchat://')
        ? trimmed.replace('anomahchat://', 'https://anomah.chat/')
        : trimmed;
      const url = normalized.startsWith('http')
        ? new URL(normalized)
        : new URL(normalized, 'https://anomah.chat');

      const groupParam = url.searchParams.get('group');
      const qrFlag = url.searchParams.get('qr') === '1' || url.searchParams.get('qr') === 'true';
      if (groupParam && groupParam.trim()) {
        return { type: 'group', value: groupParam.trim(), isQr: qrFlag };
      }

      const chatParam = url.searchParams.get('chat');
      if (chatParam && chatParam.trim()) {
        return { type: 'chat', value: chatParam.trim(), isQr: qrFlag };
      }
    }
  } catch {
    // ignore malformed URL
  }

  // Raw direct identifier inside QR code (@username or uid:...)
  if (/^@[a-zA-Z0-9_.-]{3,50}$/.test(trimmed) || /^uid:[a-zA-Z0-9_-]{4,128}$/.test(trimmed)) {
    return { type: 'chat', value: trimmed, isQr: true };
  }
  if (/^group_[a-zA-Z0-9_-]{3,128}$/.test(trimmed)) {
    return { type: 'group', value: trimmed, isQr: true };
  }

  return null;
}

export function extractChatTargetFromInput(rawInput: string): string | null {
  const parsed = extractDeepLinkTarget(rawInput);
  return parsed?.type === 'chat' ? parsed.value : null;
}

export function setPendingDeepLinkTarget(target: DeepLinkTarget | null): void {
  try {
    if (!target) {
      sessionStorage.removeItem(PENDING_DEEP_LINK_KEY);
      sessionStorage.removeItem(PENDING_CHAT_TARGET_KEY);
    } else {
      sessionStorage.setItem(PENDING_DEEP_LINK_KEY, JSON.stringify(target));
    }
  } catch {
    // ignore
  }
}

export function getPendingDeepLinkTarget(): DeepLinkTarget | null {
  try {
    const raw = sessionStorage.getItem(PENDING_DEEP_LINK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DeepLinkTarget>;
      if ((parsed.type === 'chat' || parsed.type === 'group') && typeof parsed.value === 'string' && parsed.value.trim()) {
        return { type: parsed.type, value: parsed.value.trim(), isQr: Boolean(parsed.isQr) };
      }
    }
    const legacy = sessionStorage.getItem(PENDING_CHAT_TARGET_KEY);
    if (legacy && legacy.trim()) {
      return { type: 'chat', value: legacy.trim(), isQr: false };
    }
    return null;
  } catch {
    return null;
  }
}

export function setPendingChatTarget(target: string | null): void {
  setPendingDeepLinkTarget(target ? { type: 'chat', value: target, isQr: false } : null);
}

export function getPendingChatTarget(): string | null {
  const target = getPendingDeepLinkTarget();
  return target?.type === 'chat' ? target.value : null;
}

export function isRunningStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  if (isNativeApkApp()) return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    nav.standalone === true
  );
}

export function isAndroidMobileBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  if (isNativeApkApp() || isRunningStandalonePwa()) return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return ua.includes('android') && !ua.includes('wv');
}

export function buildAndroidAppIntentUrl(target: DeepLinkTarget): string {
  const paramKey = target.type === 'group' ? 'group' : 'chat';
  const query = `${paramKey}=${encodeURIComponent(target.value)}${target.isQr ? '&qr=1' : ''}`;
  const fallbackUrl = `${CANONICAL_WEB_URL}?${query}`;
  return `intent://open?${query}#Intent;scheme=anomahchat;package=com.mahimuhtasim.anomahchat;S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
}

const PENDING_REMEMBER_DEVICE_KEY = 'anomah_pending_remember_device';

export function setRememberDevicePending(remember: boolean): void {
  try {
    if (remember) {
      sessionStorage.setItem(PENDING_REMEMBER_DEVICE_KEY, '1');
    } else {
      sessionStorage.removeItem(PENDING_REMEMBER_DEVICE_KEY);
    }
  } catch {
    // ignore
  }
}

export function consumeRememberDevicePending(): boolean {
  try {
    const val = sessionStorage.getItem(PENDING_REMEMBER_DEVICE_KEY) === '1';
    sessionStorage.removeItem(PENDING_REMEMBER_DEVICE_KEY);
    return val;
  } catch {
    return false;
  }
}
