import { doc, getDoc, setDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase/config';
import { logAdminAction } from './adminService';

export interface AppReleaseInfo {
  versionName: string; // e.g. "1.1.0"
  versionCode: number; // e.g. 110
  apkDownloadUrl: string; // Direct APK download URL
  fileSizeBytes?: number; // Size in bytes (optional)
  fileSizeText?: string; // e.g. "18.4 MB"
  changelogEn: string; // Release notes in English
  changelogBn: string; // Release notes in Bengali
  forceUpdate?: boolean; // If true, update is mandatory
  minSupportedVersion?: number;
  publishedAt: string; // ISO date
  publishedBy: string; // Admin email
}

const UPDATE_DOC_PATH = 'app_updates/latest';

export async function getLatestRelease(): Promise<AppReleaseInfo | null> {
  try {
    const snap = await getDoc(doc(db, 'app_updates', 'latest'));
    if (snap.exists()) {
      return snap.data() as AppReleaseInfo;
    }
    return null;
  } catch (error) {
    console.warn('Failed to fetch latest release info:', error);
    return null;
  }
}

export function subscribeToLatestRelease(
  onUpdate: (release: AppReleaseInfo | null) => void
): Unsubscribe {
  const ref = doc(db, 'app_updates', 'latest');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as AppReleaseInfo);
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      console.warn('Latest release subscription warning:', err);
    }
  );
}

export async function publishAppRelease(
  info: Omit<AppReleaseInfo, 'publishedAt'>,
  adminEmail: string
): Promise<void> {
  const nowIso = new Date().toISOString();
  const fullRelease: AppReleaseInfo = {
    ...info,
    publishedAt: nowIso,
    publishedBy: adminEmail,
  };

  const ref = doc(db, 'app_updates', 'latest');
  await setDoc(ref, fullRelease);

  // Also log into admin audit trail
  try {
    await logAdminAction(
      'create_announcement',
      `Published APK Release v${info.versionName} (Build ${info.versionCode}) with download URL: ${info.apkDownloadUrl}`,
      adminEmail,
      `release_${info.versionCode}`,
      `APK Release v${info.versionName}`
    );
  } catch (e) {
    console.warn('Admin log warning for app release:', e);
  }
}
