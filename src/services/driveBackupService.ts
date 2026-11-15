import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  setPersistence,
  inMemoryPersistence,
  onAuthStateChanged,
  type Auth,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth as primaryAuth, db } from '../firebase/config';
import { isSuperAdmin, logAdminAction } from './adminService';
import { APP_VERSION } from '../utils/appVersion';
import type { ChatMessage, ChatRoom } from '../types/chat';

export const DRIVE_BACKUP_SCOPES = ['https://www.googleapis.com/auth/drive.file'] as const;
export const PREFERRED_BACKUP_DRIVE_EMAIL = 'anomahchatsarverorg@gmail.com';
const BACKUP_FOLDER_NAME = 'AnomahChat_Backups';
const DRIVE_SECONDARY_APP_NAME = 'anomah-drive-backup-auth';

export type BackupScopeMode = 'all' | 'older_than_days' | 'media_only' | 'single_chat';
export type CleanupMode = 'media_messages' | 'old_messages' | 'call_signaling' | 'full_chat_rooms';

export interface DriveConnectionInfo {
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
  isPreferredTarget: boolean;
}

export interface StorageScanReport {
  scannedAt: string;
  totalChats: number;
  directChats: number;
  groupChats: number;
  totalMessages: number;
  textAndCallMessages: number;
  mediaMessages: number;
  callSignalDocs: number;
  iceCandidateDocs: number;
  estimatedTextBytes: number;
  estimatedMediaBytes: number;
  estimatedSignalBytes: number;
  estimatedTotalBytes: number;
}

export interface ChatBackupEntry {
  room: ChatRoom;
  messages: ChatMessage[];
}

export interface ChatBackupPayload {
  schema: 'anomah-chat-backup-v1';
  appVersion: string;
  exportedAt: string;
  exportedByAdmin: string;
  targetDriveEmail: string;
  scope: BackupScopeMode;
  olderThanDays: number | null;
  cutoffDate: string | null;
  stats: {
    chatCount: number;
    messageCount: number;
    mediaMessageCount: number;
    estimatedBytes: number;
  };
  chats: ChatBackupEntry[];
}

export interface DriveBackupFileItem {
  id: string;
  name: string;
  sizeBytes: number;
  createdTime: string;
  webViewLink?: string;
  description?: string;
}

export interface CleanupResult {
  deletedMessages: number;
  deletedCallDocs: number;
  deletedIceDocs: number;
  deletedChatRooms: number;
  quotaHit: boolean;
}

// Strictly in-memory token cache (never stored in localStorage, sessionStorage, or Firestore)
let cachedDriveToken: string | null = null;
let cachedDriveEmail: string | null = null;
let cachedConnectedAt: string | null = null;
let primarySignOutWatcherInitialized = false;

function ensurePrimarySignOutWatcher() {
  if (primarySignOutWatcherInitialized) return;
  primarySignOutWatcherInitialized = true;
  onAuthStateChanged(primaryAuth, (user) => {
    if (!user || !isSuperAdmin(user.email)) {
      clearDriveBackupSession();
    }
  });
}

ensurePrimarySignOutWatcher();

export function clearDriveBackupSession(): void {
  cachedDriveToken = null;
  cachedDriveEmail = null;
  cachedConnectedAt = null;
}

export function getDriveConnectionStatus(): DriveConnectionInfo {
  const isPreferred = Boolean(
    cachedDriveEmail && cachedDriveEmail.toLowerCase() === PREFERRED_BACKUP_DRIVE_EMAIL.toLowerCase()
  );
  return {
    connected: Boolean(cachedDriveToken),
    email: cachedDriveEmail,
    connectedAt: cachedConnectedAt,
    isPreferredTarget: isPreferred,
  };
}

function assertVerifiedSuperAdmin(): string {
  const current = primaryAuth.currentUser;
  if (!current || !isSuperAdmin(current.email)) {
    throw new Error('Only verified Super Admin (chinisdramaorg@gmail.com) can access backup and cleanup.');
  }
  if (!current.emailVerified) {
    throw new Error('Super Admin email verification is required for backup and cleanup.');
  }
  return current.email!;
}

function getSecondaryDriveAuth(): Auth {
  let secondaryApp: FirebaseApp | undefined = getApps().find(
    (app) => app.name === DRIVE_SECONDARY_APP_NAME
  );
  if (!secondaryApp) {
    secondaryApp = initializeApp(firebaseConfig, DRIVE_SECONDARY_APP_NAME);
  }
  return getAuth(secondaryApp);
}

/**
 * Connects a separate Google Drive account (default hint: anomahchatsarverorg@gmail.com)
 * using an isolated secondary Firebase Auth app with inMemoryPersistence so the
 * primary Super Admin session (chinisdramaorg@gmail.com) is NEVER replaced or disturbed.
 */
export async function connectDriveBackupAccount(
  hintEmail: string = PREFERRED_BACKUP_DRIVE_EMAIL
): Promise<DriveConnectionInfo> {
  assertVerifiedSuperAdmin();

  const secondaryAuth = getSecondaryDriveAuth();
  await setPersistence(secondaryAuth, inMemoryPersistence);

  const driveProvider = new GoogleAuthProvider();
  DRIVE_BACKUP_SCOPES.forEach((scope) => driveProvider.addScope(scope));
  driveProvider.setCustomParameters({
    prompt: 'select_account',
    login_hint: hintEmail,
  });

  const result = await signInWithPopup(secondaryAuth, driveProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken;
  const connectedEmail = result.user?.email || hintEmail;

  // Immediately clear secondary auth user state; keep only the in-memory Drive access token
  await signOut(secondaryAuth).catch(() => {});

  if (!token) {
    throw new Error('Google Drive access token was not returned. Please grant Google Drive permission and try again.');
  }

  cachedDriveToken = token;
  cachedDriveEmail = connectedEmail;
  cachedConnectedAt = new Date().toISOString();

  return getDriveConnectionStatus();
}

export async function disconnectDriveBackupAccount(): Promise<void> {
  clearDriveBackupSession();
  const existingApp = getApps().find((app) => app.name === DRIVE_SECONDARY_APP_NAME);
  if (existingApp) {
    await signOut(getAuth(existingApp)).catch(() => {});
  }
}

function requireDriveToken(): string {
  assertVerifiedSuperAdmin();
  if (!cachedDriveToken) {
    throw new Error('Google Drive is not connected yet. Connect your backup Drive account first.');
  }
  return cachedDriveToken;
}

async function driveFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = requireDriveToken();
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(url, { ...init, headers });
  if (response.status === 401) {
    clearDriveBackupSession();
    throw new Error('Google Drive session expired. Please reconnect your backup Google Drive account.');
  }
  return response;
}

function estimateByteLength(obj: unknown): number {
  try {
    return new Blob([JSON.stringify(obj)]).size;
  } catch {
    return JSON.stringify(obj).length;
  }
}

/**
 * Scans Firestore chats, messages, and WebRTC signaling subcollections to estimate 1 GiB usage.
 */
export async function scanFirestoreChatStorage(
  onProgress?: (label: string) => void
): Promise<StorageScanReport> {
  assertVerifiedSuperAdmin();

  onProgress?.('Scanning chat rooms...');
  const chatsSnap = await getDocs(collection(db, 'chats'));

  let directChats = 0;
  let groupChats = 0;
  let totalMessages = 0;
  let textAndCallMessages = 0;
  let mediaMessages = 0;
  let callSignalDocs = 0;
  let iceCandidateDocs = 0;
  let estimatedTextBytes = 0;
  let estimatedMediaBytes = 0;
  let estimatedSignalBytes = 0;

  let index = 0;
  for (const chatDoc of chatsSnap.docs) {
    index += 1;
    const roomData = chatDoc.data() as ChatRoom;
    if (roomData.type === 'group') groupChats += 1;
    else directChats += 1;

    estimatedTextBytes += estimateByteLength(roomData);
    onProgress?.(`Scanning room ${index} / ${chatsSnap.size}...`);

    const msgsSnap = await getDocs(collection(db, 'chats', chatDoc.id, 'messages'));
    msgsSnap.forEach((mDoc) => {
      const mData = mDoc.data() as ChatMessage;
      totalMessages += 1;
      const bytes = estimateByteLength(mData);
      if (mData.type === 'image' || mData.type === 'audio' || mData.type === 'file' || mData.mediaUrl) {
        mediaMessages += 1;
        estimatedMediaBytes += bytes;
      } else {
        textAndCallMessages += 1;
        estimatedTextBytes += bytes;
      }
    });

    const callsSnap = await getDocs(collection(db, 'chats', chatDoc.id, 'calls')).catch(() => null);
    if (callsSnap) {
      for (const cDoc of callsSnap.docs) {
        callSignalDocs += 1;
        estimatedSignalBytes += estimateByteLength(cDoc.data());

        const [offerSnap, answerSnap] = await Promise.all([
          getDocs(collection(db, 'chats', chatDoc.id, 'calls', cDoc.id, 'offerCandidates')).catch(() => null),
          getDocs(collection(db, 'chats', chatDoc.id, 'calls', cDoc.id, 'answerCandidates')).catch(() => null),
        ]);
        if (offerSnap) {
          iceCandidateDocs += offerSnap.size;
          offerSnap.forEach((cand) => {
            estimatedSignalBytes += estimateByteLength(cand.data());
          });
        }
        if (answerSnap) {
          iceCandidateDocs += answerSnap.size;
          answerSnap.forEach((cand) => {
            estimatedSignalBytes += estimateByteLength(cand.data());
          });
        }
      }
    }
  }

  return {
    scannedAt: new Date().toISOString(),
    totalChats: chatsSnap.size,
    directChats,
    groupChats,
    totalMessages,
    textAndCallMessages,
    mediaMessages,
    callSignalDocs,
    iceCandidateDocs,
    estimatedTextBytes,
    estimatedMediaBytes,
    estimatedSignalBytes,
    estimatedTotalBytes: estimatedTextBytes + estimatedMediaBytes + estimatedSignalBytes,
  };
}

/**
 * Collects chat rooms & messages from Firestore into a portable JSON backup payload.
 */
export async function collectChatBackupPayload(
  options: {
    scope: BackupScopeMode;
    olderThanDays?: number;
    singleChatId?: string;
    targetDriveEmail?: string;
  },
  onProgress?: (label: string) => void
): Promise<ChatBackupPayload> {
  const adminEmail = assertVerifiedSuperAdmin();

  const olderThanDays =
    options.scope === 'older_than_days' && options.olderThanDays && options.olderThanDays > 0
      ? options.olderThanDays
      : null;

  const cutoffMs = olderThanDays ? Date.now() - olderThanDays * 24 * 60 * 60 * 1000 : null;
  const cutoffIso = cutoffMs ? new Date(cutoffMs).toISOString() : null;

  onProgress?.('Fetching chat rooms from Firestore...');
  const chatsSnap = await getDocs(collection(db, 'chats'));

  const filteredRooms = chatsSnap.docs.filter((docSnap) => {
    if (options.scope === 'single_chat' && options.singleChatId) {
      return docSnap.id === options.singleChatId;
    }
    return true;
  });

  const entries: ChatBackupEntry[] = [];
  let totalMessageCount = 0;
  let mediaMessageCount = 0;

  let idx = 0;
  for (const chatDoc of filteredRooms) {
    idx += 1;
    const room = { id: chatDoc.id, ...(chatDoc.data() as Omit<ChatRoom, 'id'>) };
    onProgress?.(`Exporting messages (${idx} / ${filteredRooms.length})...`);

    const msgCollection = collection(db, 'chats', chatDoc.id, 'messages');
    const msgQuery =
      cutoffIso !== null
        ? query(msgCollection, where('createdAt', '<=', cutoffIso))
        : msgCollection;

    const msgsSnap = await getDocs(msgQuery);
    const messages: ChatMessage[] = [];

    msgsSnap.forEach((mDoc) => {
      const msg = { id: mDoc.id, ...(mDoc.data() as Omit<ChatMessage, 'id'>) };
      if (options.scope === 'media_only') {
        const isMedia = msg.type === 'image' || msg.type === 'audio' || msg.type === 'file' || Boolean(msg.mediaUrl);
        if (!isMedia) return;
      }
      if (msg.type === 'image' || msg.type === 'audio' || msg.type === 'file' || msg.mediaUrl) {
        mediaMessageCount += 1;
      }
      messages.push(msg);
    });

    messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (messages.length > 0 || options.scope === 'all' || options.scope === 'single_chat') {
      entries.push({ room, messages });
      totalMessageCount += messages.length;
    }
  }

  const basePayload: ChatBackupPayload = {
    schema: 'anomah-chat-backup-v1',
    appVersion: APP_VERSION.versionName,
    exportedAt: new Date().toISOString(),
    exportedByAdmin: adminEmail,
    targetDriveEmail: options.targetDriveEmail || cachedDriveEmail || PREFERRED_BACKUP_DRIVE_EMAIL,
    scope: options.scope,
    olderThanDays,
    cutoffDate: cutoffIso,
    stats: {
      chatCount: entries.length,
      messageCount: totalMessageCount,
      mediaMessageCount,
      estimatedBytes: 0,
    },
    chats: entries,
  };

  basePayload.stats.estimatedBytes = estimateByteLength(basePayload);
  return basePayload;
}

async function getOrCreateBackupFolderId(): Promise<string> {
  const q = encodeURIComponent(
    `name='${BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const searchRes = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive`
  );
  if (!searchRes.ok) {
    const errText = await searchRes.text().catch(() => '');
    throw new Error(`Unable to inspect Google Drive backup folder (${searchRes.status}): ${errText}`);
  }
  const searchJson = (await searchRes.json()) as { files?: Array<{ id: string; name: string }> };
  if (searchJson.files && searchJson.files.length > 0) {
    return searchJson.files[0].id;
  }

  const createRes = await driveFetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: BACKUP_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
        description: 'Automated Anomah Chat Admin Backups',
      }),
    }
  );
  if (!createRes.ok) {
    const errText = await createRes.text().catch(() => '');
    throw new Error(`Unable to create Google Drive folder (${createRes.status}): ${errText}`);
  }
  const created = (await createRes.json()) as { id: string };
  return created.id;
}

/**
 * Uploads the exported chat backup JSON to AnomahChat_Backups inside the connected Google Drive.
 * Uses multipart upload for small backups (<4MB) and resumable upload for large backups.
 */
export async function uploadBackupToGoogleDrive(
  payload: ChatBackupPayload,
  onProgress?: (label: string) => void
): Promise<DriveBackupFileItem> {
  const adminEmail = assertVerifiedSuperAdmin();
  requireDriveToken();

  onProgress?.('Preparing AnomahChat_Backups folder on Google Drive...');
  const folderId = await getOrCreateBackupFolderId();

  const dateTag = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `anomah-chat-backup-${payload.scope}-${dateTag}.json`;
  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });

  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    parents: [folderId],
    description: `Anomah Chat backup (${payload.stats.chatCount} chats, ${payload.stats.messageCount} messages)`,
  };

  let uploadedRaw: {
    id: string;
    name: string;
    size?: string;
    createdTime?: string;
    webViewLink?: string;
    description?: string;
  };

  if (blob.size < 4 * 1024 * 1024) {
    onProgress?.('Uploading backup file to Google Drive...');
    const boundary = `anomah_boundary_${Date.now()}`;
    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${jsonString}\r\n` +
      `--${boundary}--`;

    const res = await driveFetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,createdTime,webViewLink,description',
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Google Drive upload failed (${res.status}): ${errText}`);
    }
    uploadedRaw = await res.json();
  } else {
    onProgress?.(`Starting large backup upload (${(blob.size / (1024 * 1024)).toFixed(2)} MB)...`);
    const initRes = await driveFetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,createdTime,webViewLink,description',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': 'application/json',
          'X-Upload-Content-Length': String(blob.size),
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initRes.ok) {
      const errText = await initRes.text().catch(() => '');
      throw new Error(`Failed to initiate Google Drive resumable upload (${initRes.status}): ${errText}`);
    }

    const uploadUrl = initRes.headers.get('Location');
    if (!uploadUrl) {
      throw new Error('Google Drive did not return a resumable upload location.');
    }

    onProgress?.('Transferring backup data to Google Drive...');
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: blob,
    });

    if (!putRes.ok) {
      const errText = await putRes.text().catch(() => '');
      throw new Error(`Google Drive resumable transfer failed (${putRes.status}): ${errText}`);
    }
    uploadedRaw = await putRes.json();
  }

  if (!uploadedRaw?.id) {
    throw new Error('Upload verification failed: Google Drive file ID missing.');
  }

  await logAdminAction(
    'backup_chats',
    `Uploaded backup "${uploadedRaw.name}" (${payload.stats.chatCount} chats, ${payload.stats.messageCount} messages) to ${cachedDriveEmail || 'Google Drive'}.`,
    adminEmail,
    uploadedRaw.id,
    uploadedRaw.name
  );

  return {
    id: uploadedRaw.id,
    name: uploadedRaw.name,
    sizeBytes: Number(uploadedRaw.size || blob.size),
    createdTime: uploadedRaw.createdTime || new Date().toISOString(),
    webViewLink: uploadedRaw.webViewLink,
    description: uploadedRaw.description,
  };
}

export async function listDriveBackupFiles(): Promise<DriveBackupFileItem[]> {
  assertVerifiedSuperAdmin();
  requireDriveToken();

  const folderId = await getOrCreateBackupFolderId();
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime desc&pageSize=50&fields=files(id,name,size,createdTime,webViewLink,description)`
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Unable to list Google Drive backups (${res.status}): ${errText}`);
  }
  const data = (await res.json()) as {
    files?: Array<{
      id: string;
      name: string;
      size?: string;
      createdTime?: string;
      webViewLink?: string;
      description?: string;
    }>;
  };
  return (data.files || []).map((f) => ({
    id: f.id,
    name: f.name,
    sizeBytes: Number(f.size || 0),
    createdTime: f.createdTime || '',
    webViewLink: f.webViewLink,
    description: f.description,
  }));
}

export async function downloadDriveBackupContent(fileId: string): Promise<ChatBackupPayload> {
  assertVerifiedSuperAdmin();
  requireDriveToken();

  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Unable to download backup from Google Drive (${res.status}): ${errText}`);
  }
  const parsed = (await res.json()) as ChatBackupPayload;
  if (!parsed || !Array.isArray(parsed.chats)) {
    throw new Error('The selected Google Drive file is not a valid Anomah Chat backup.');
  }
  return parsed;
}

export async function deleteDriveBackupFile(fileId: string): Promise<void> {
  assertVerifiedSuperAdmin();
  requireDriveToken();

  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    { method: 'DELETE' }
  );
  if (!res.ok && res.status !== 204) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Unable to delete backup file (${res.status}): ${errText}`);
  }
}

export function triggerLocalBackupDownload(payload: ChatBackupPayload): void {
  const dateTag = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `anomah-chat-backup-${payload.scope}-${dateTag}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

async function deleteDocListInBatches(
  docs: QueryDocumentSnapshot[],
  onStep?: (deletedCount: number) => void
): Promise<{ count: number; quotaHit: boolean }> {
  let count = 0;
  const BATCH_SIZE = 20;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const slice = docs.slice(i, i + BATCH_SIZE);
    try {
      await Promise.all(slice.map((d) => deleteDoc(d.ref)));
      count += slice.length;
      onStep?.(count);
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      if (msg.includes('resource-exhausted') || msg.includes('quota')) {
        return { count, quotaHit: true };
      }
      throw err;
    }
  }
  return { count, quotaHit: false };
}

/**
 * Safely cleans Firestore chat data in batches to reclaim 1 GiB Spark Free Tier space.
 * Preserves user accounts (`users`, `directory`, `app_updates`) unless explicitly cleaning rooms.
 */
export async function cleanupFirestoreAfterBackup(
  options: {
    mode: CleanupMode;
    olderThanDays?: number;
    singleChatId?: string;
  },
  onProgress?: (label: string) => void
): Promise<CleanupResult> {
  const adminEmail = assertVerifiedSuperAdmin();

  const olderThanDays =
    options.olderThanDays && options.olderThanDays > 0 ? options.olderThanDays : null;
  const cutoffIso = olderThanDays
    ? new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const result: CleanupResult = {
    deletedMessages: 0,
    deletedCallDocs: 0,
    deletedIceDocs: 0,
    deletedChatRooms: 0,
    quotaHit: false,
  };

  onProgress?.('Fetching chat rooms for cleanup...');
  const chatsSnap = await getDocs(collection(db, 'chats'));
  const targetRooms = chatsSnap.docs.filter((d) =>
    options.singleChatId ? d.id === options.singleChatId : true
  );

  let roomIdx = 0;
  for (const chatDoc of targetRooms) {
    if (result.quotaHit) break;
    roomIdx += 1;
    onProgress?.(`Cleaning room ${roomIdx} / ${targetRooms.length}...`);

    // 1. Messages cleanup
    if (
      options.mode === 'media_messages' ||
      options.mode === 'old_messages' ||
      options.mode === 'full_chat_rooms'
    ) {
      const msgCol = collection(db, 'chats', chatDoc.id, 'messages');
      const msgQuery =
        options.mode === 'old_messages' && cutoffIso
          ? query(msgCol, where('createdAt', '<=', cutoffIso))
          : msgCol;

      const msgsSnap = await getDocs(msgQuery);
      const docsToDelete = msgsSnap.docs.filter((mDoc) => {
        const data = mDoc.data() as ChatMessage;
        if (options.mode === 'media_messages') {
          const isMedia =
            data.type === 'image' ||
            data.type === 'audio' ||
            data.type === 'file' ||
            Boolean(data.mediaUrl);
          if (!isMedia) return false;
          if (cutoffIso && data.createdAt > cutoffIso) return false;
        }
        return true;
      });

      if (docsToDelete.length > 0) {
        const res = await deleteDocListInBatches(docsToDelete, (done) => {
          onProgress?.(`Room ${roomIdx}/${targetRooms.length}: deleted ${done}/${docsToDelete.length} messages...`);
        });
        result.deletedMessages += res.count;
        if (res.quotaHit) {
          result.quotaHit = true;
          break;
        }
      }
    }

    // 2. WebRTC Call signaling & ICE candidate subcollections cleanup
    if (options.mode === 'call_signaling' || options.mode === 'full_chat_rooms') {
      const callsSnap = await getDocs(collection(db, 'chats', chatDoc.id, 'calls')).catch(() => null);
      if (callsSnap && callsSnap.size > 0) {
        for (const callDoc of callsSnap.docs) {
          if (result.quotaHit) break;

          const [offerSnap, answerSnap] = await Promise.all([
            getDocs(collection(db, 'chats', chatDoc.id, 'calls', callDoc.id, 'offerCandidates')).catch(() => null),
            getDocs(collection(db, 'chats', chatDoc.id, 'calls', callDoc.id, 'answerCandidates')).catch(() => null),
          ]);

          if (offerSnap && offerSnap.size > 0) {
            const res = await deleteDocListInBatches(offerSnap.docs);
            result.deletedIceDocs += res.count;
            if (res.quotaHit) {
              result.quotaHit = true;
              break;
            }
          }
          if (answerSnap && answerSnap.size > 0) {
            const res = await deleteDocListInBatches(answerSnap.docs);
            result.deletedIceDocs += res.count;
            if (res.quotaHit) {
              result.quotaHit = true;
              break;
            }
          }

          try {
            await deleteDoc(callDoc.ref);
            result.deletedCallDocs += 1;
          } catch (err) {
            const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
            if (msg.includes('resource-exhausted') || msg.includes('quota')) {
              result.quotaHit = true;
              break;
            }
          }
        }
      }
    }

    // 3. Full chat room removal (only when mode === 'full_chat_rooms' and room emptied)
    if (options.mode === 'full_chat_rooms' && !result.quotaHit) {
      try {
        await deleteDoc(doc(db, 'chats', chatDoc.id));
        result.deletedChatRooms += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
        if (msg.includes('resource-exhausted') || msg.includes('quota')) {
          result.quotaHit = true;
          break;
        }
      }
    }
  }

  await logAdminAction(
    'cleanup_storage',
    `Cleaned Firebase storage (${options.mode}): ${result.deletedMessages} messages, ${result.deletedCallDocs} calls, ${result.deletedIceDocs} ICE candidates, ${result.deletedChatRooms} rooms removed.${result.quotaHit ? ' (Stopped at daily free quota)' : ''}`,
    adminEmail,
    options.singleChatId || 'all_chats'
  );

  return result;
}
