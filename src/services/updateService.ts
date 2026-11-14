import { doc, getDoc, getDocFromServer, setDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase/config';
import { logAdminAction } from './adminService';

export interface AppReleaseInfo {
  versionName: string; // e.g. "1.0.6"
  versionCode: number; // e.g. 106
  apkDownloadUrl: string; // Direct APK download URL (Strictly allowlisted to GitHub Releases)
  apkSha256?: string; // Optional SHA-256 hex digest verified by native installer
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
export const ALLOWED_APK_URL_PREFIX = `https://github.com/${GITHUB_REPO}/releases/`;

/**
 * Strict URL allowlist check to prevent arbitrary/malicious APK URL injection.
 */
export function isAllowedApkUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  return trimmed.startsWith(ALLOWED_APK_URL_PREFIX);
}

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

    // Convert tag e.g. "1.0.6" into versionCode 106
    const parts = tag.split('.').map((p: string) => parseInt(p, 10) || 0);
    const calculatedCode = (parts[0] || 1) * 100 + (parts[1] || 0) * 10 + (parts[2] || 0);

    // Look for APK in assets
    const apkAsset = Array.isArray(data.assets)
      ? data.assets.find((a: any) => a.name?.endsWith('.apk'))
      : null;

    const candidateUrl =
      apkAsset?.browser_download_url ||
      `https://github.com/${GITHUB_REPO}/releases/latest/download/AnomahChat.apk`;

    if (!isAllowedApkUrl(candidateUrl)) {
      return null;
    }

    const bodyText = typeof data.body === 'string' ? data.body : '';
    const shaMatch = bodyText.match(/SHA-?256[:\s`]+([a-fA-F0-9]{64})/i);
    const apkSha256 = shaMatch ? shaMatch[1].toLowerCase() : undefined;

    const sizeMb = apkAsset?.size ? `${(apkAsset.size / (1024 * 1024)).toFixed(1)} MB` : '9.6 MB';

    return {
      versionName: tag,
      versionCode: calculatedCode,
      apkDownloadUrl: candidateUrl,
      apkSha256,
      fileSizeText: sizeMb,
      fileSizeBytes: apkAsset?.size,
      changelogEn: bodyText || 'New Anomah Chat release on GitHub.',
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
      const data = snap.data() as AppReleaseInfo;
      if (isAllowedApkUrl(data.apkDownloadUrl)) {
        firestoreRelease = data;
      } else {
        console.warn('Ignored release with unverified APK URL');
      }
    }
  } catch (error) {
    console.warn('Failed to fetch latest release from Firestore:', error);
  }

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
        const data = snap.data() as AppReleaseInfo;
        if (isAllowedApkUrl(data.apkDownloadUrl)) {
          onUpdate(data);
        } else {
          console.warn('Ignored release notification with untrusted APK URL');
          onUpdate(null);
        }
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
  if (!isAllowedApkUrl(info.apkDownloadUrl)) {
    throw new Error(`APK Download URL must start with ${ALLOWED_APK_URL_PREFIX}`);
  }

  if (info.apkSha256 && !/^[a-fA-F0-9]{64}$/.test(info.apkSha256.trim())) {
    throw new Error('APK SHA-256 digest must be a valid 64-character hex string.');
  }

  const nowIso = new Date().toISOString();
  const fullRelease: Record<string, unknown> = {
    versionName: info.versionName.trim(),
    versionCode: Number(info.versionCode),
    apkDownloadUrl: info.apkDownloadUrl.trim(),
    changelogEn: info.changelogEn || '',
    changelogBn: info.changelogBn || '',
    forceUpdate: Boolean(info.forceUpdate),
    publishedAt: nowIso,
    publishedBy: adminEmail,
  };

  if (info.fileSizeText?.trim()) {
    fullRelease.fileSizeText = info.fileSizeText.trim();
  }
  if (info.fileSizeBytes) {
    fullRelease.fileSizeBytes = info.fileSizeBytes;
  }
  if (info.apkSha256?.trim()) {
    fullRelease.apkSha256 = info.apkSha256.trim().toLowerCase();
  }

  const ref = doc(db, 'app_updates', 'latest');
  await setDoc(ref, fullRelease);

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
