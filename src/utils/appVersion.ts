import { Capacitor } from '@capacitor/core';

export const APP_VERSION = {
  versionName: '1.0.10',
  versionCode: 110,
  channel: 'Stable',
  buildDate: '2026-11-17',
};

/**
 * Returns true if remoteVersion is strictly higher than current client version.
 * Supports both numeric versionCode and semver versionName comparison.
 */
export function isUpdateAvailable(
  remote: number | { versionCode?: number; versionName?: string } | null | undefined
): boolean {
  if (!remote) return false;

  let remoteCode: number | undefined;
  let remoteName: string | undefined;

  if (typeof remote === 'number') {
    remoteCode = remote;
  } else if (typeof remote === 'object') {
    remoteCode = typeof remote.versionCode === 'number' ? remote.versionCode : Number(remote.versionCode);
    remoteName = typeof remote.versionName === 'string' ? remote.versionName : undefined;
  }

  // Compare semver versionName first when provided (handles multi-digit minor/patch cleanly)
  if (remoteName && typeof remoteName === 'string') {
    const parse = (v: string) =>
      v
        .replace(/[^0-9.]/g, '')
        .split('.')
        .map((n) => parseInt(n, 10) || 0);

    const rParts = parse(remoteName);
    const cParts = parse(APP_VERSION.versionName);

    const len = Math.max(rParts.length, cParts.length, 3);
    for (let i = 0; i < len; i++) {
      const r = rParts[i] || 0;
      const c = cParts[i] || 0;
      if (r > c) return true;
      if (r < c) return false;
    }
  }

  // Fallback / same-versionName build bump via numeric versionCode
  if (remoteCode !== undefined && !isNaN(remoteCode)) {
    return remoteCode > APP_VERSION.versionCode;
  }

  return false;
}

/**
 * Checks if current runtime is a Native Android APK (Capacitor / Android WebView wrapper)
 */
export function isNativeApkApp(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if ((window as unknown as { AndroidUpdater?: unknown })?.AndroidUpdater) return true;
    if (Capacitor.isNativePlatform()) return true;
    if ((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })?.Capacitor?.isNativePlatform?.()) return true;
    if (window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:') return true;
    const ua = window.navigator.userAgent.toLowerCase();
    if (ua.includes('capacitor') || ua.includes('wv') || ua.includes('anomahchatapk')) return true;
    if (window.location.search.includes('platform=apk')) return true;
  } catch {
    return false;
  }
  return false;
}

/**
 * Checks if current runtime is a Progressive Web App (PWA) or standard browser
 */
export function isPwaOrWeb(): boolean {
  return !isNativeApkApp();
}
