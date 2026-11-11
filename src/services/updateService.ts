import { doc, getDoc, getDocFromServer, setDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase/config';
import { logAdminAction } from './adminService';

export interface AppReleaseInfo {
  versionName: string; // e.g. "1.0.2"
  versionCode: number; // e.g. 102
  apkDownloadUrl: string; // Direct APK download URL
  fileSizeBytes?: number; // Size in bytes (optional)
  fileSizeText?: string; // e.g. "9.6 MB"
  changelogEn: string; // Release notes in English
  changelogBn: string; // Release notes in Bengali
  forceUpdate?: boolean; // If true, update is mandatory
  minSupportedVersion?: number;
  publishedAt: string; // ISO date
  publishedBy: string; // Admin email
}

const GITHUB_REPO = 'mydatasarverorg-ux/Anomahchat';

/**
 * Fallback to GitHub Releases API if Firestore is unreachable or out of date
 */
async function fetchGitHubLatestRelease(): Promise<AppReleaseInfo | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const tag = (data.tag_name || '').replace(/^v/i, '').trim();
    if (!tag) return null;

    // Convert tag e.g. "1.0.2" into versionCode 102
    const parts = tag.split('.').map((p: string) => parseInt(p, 10) || 0);
    const calculatedCode = (parts[0] || 1) * 100 + (parts[1] || 0) * 10 + (parts[2] || 0);

    // Look for APK in assets
    const apkAsset = Array.isArray(data.assets)
      ? data.assets.find((a: any) => a.name?.endsWith('.apk'))
      : null;

    const downloadUrl =
      apkAsset?.browser_download_url ||
      `https://github.com/${GITHUB_REPO}/releases/latest/download/AnomahChat.apk`;

    const sizeMb = apkAsset?.size ? `${(apkAsset.size / (1024 * 1024)).toFixed(1)} MB` : '9.6 MB';

    return {
      versionName: tag,
      versionCode: calculatedCode,
      apkDownloadUrl: downloadUrl,
      fileSizeText: sizeMb,
      fileSizeBytes: apkAsset?.size,
      changelogEn: data.body || 'New Anomah Chat release on GitHub.',
      changelogBn: 'গিটহাব থেকে নতুন আনমাহ্ চ্যাট রিলিজ আপডেট।',
      publishedAt: data.published_at || new Date().toISOString(),
      publishedBy: 'GitHub Actions',
      forceUpdate: false,
    };
  } catch {
    return null;
  }
}

export async function getLatestRelease(): Promise<AppReleaseInfo | null> {
  let firestoreRelease: AppReleaseInfo | null = null;
  try {
    const ref = doc(db, 'app_updates', 'latest');
    let snap;
    try {
      // Force fetching latest version directly from server to bypass cached snapshot
      snap = await getDocFromServer(ref);
    } catch {
      snap = await getDoc(ref);
    }
    if (snap.exists()) {
      firestoreRelease = snap.data() as AppReleaseInfo;
    }
  } catch (error) {
    console.warn('Failed to fetch latest release from Firestore:', error);
  }

  // Also query GitHub release fallback if Firestore has no release or low version
  if (!firestoreRelease) {
    return await fetchGitHubLatestRelease();
  }

  return firestoreRelease;
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
