import { Capacitor } from '@capacitor/core';

export const APP_VERSION = {
  versionName: '1.0.1',
  versionCode: 101,
  channel: 'Stable',
  buildDate: '2026-11-09',
};

/**
 * Returns true if remoteVersion is strictly higher than current client version.
 */
export function isUpdateAvailable(remote: number | { versionCode: number }): boolean {
  const code = typeof remote === 'object' && remote !== null ? remote.versionCode : remote;
  return Number(code) > APP_VERSION.versionCode;
}

/**
 * Checks if current runtime is a Native Android APK (Capacitor / Android WebView wrapper)
 */
export function isNativeApkApp(): boolean {
  if (typeof window === 'undefined') return false;
  try {
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
