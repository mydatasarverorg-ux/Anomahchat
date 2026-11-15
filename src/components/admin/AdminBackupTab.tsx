import { useState, useEffect } from 'react';
import {
  HardDrive,
  CloudUpload,
  Trash2,
  RefreshCw,
  ShieldCheck,
  Download,
  AlertTriangle,
  CheckCircle2,
  FolderArchive,
  Eye,
  X,
  Database,
  LogOut,
  Info,
  Image as ImageIcon,
  MessageSquare,
  PhoneCall,
} from 'lucide-react';
import {
  PREFERRED_BACKUP_DRIVE_EMAIL,
  getDriveConnectionStatus,
  connectDriveBackupAccount,
  disconnectDriveBackupAccount,
  scanFirestoreChatStorage,
  collectChatBackupPayload,
  uploadBackupToGoogleDrive,
  listDriveBackupFiles,
  downloadDriveBackupContent,
  deleteDriveBackupFile,
  triggerLocalBackupDownload,
  cleanupFirestoreAfterBackup,
  type DriveConnectionInfo,
  type StorageScanReport,
  type BackupScopeMode,
  type CleanupMode,
  type DriveBackupFileItem,
  type ChatBackupPayload,
  type CleanupResult,
} from '../../services/driveBackupService';
import type { ChatRoom } from '../../types/chat';

interface AdminBackupTabProps {
  language: 'en' | 'bn';
  allChats: ChatRoom[];
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(3)} GB`;
}

const SPARK_FREE_LIMIT_BYTES = 1024 * 1024 * 1024; // 1 GiB

export function AdminBackupTab({
  language,
  allChats,
  onSuccess,
  onError,
}: AdminBackupTabProps) {
  const bn = language === 'bn';

  const [driveStatus, setDriveStatus] = useState<DriveConnectionInfo>(() =>
    getDriveConnectionStatus()
  );
  const [connectingDrive, setConnectingDrive] = useState(false);

  const [scanReport, setScanReport] = useState<StorageScanReport | null>(null);
  const [scanningStorage, setScanningStorage] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string>('');

  const [backupScope, setBackupScope] = useState<BackupScopeMode>('all');
  const [olderThanDays, setOlderThanDays] = useState<number>(90);
  const [selectedChatId, setSelectedChatId] = useState<string>('');
  const [backingUp, setBackingUp] = useState(false);
  const [lastVerifiedBackup, setLastVerifiedBackup] = useState<DriveBackupFileItem | null>(null);

  const [driveFiles, setDriveFiles] = useState<DriveBackupFileItem[]>([]);
  const [loadingDriveFiles, setLoadingDriveFiles] = useState(false);

  const [cleanupMode, setCleanupMode] = useState<CleanupMode>('media_messages');
  const [cleanupDays, setCleanupDays] = useState<number>(90);
  const [cleanupConfirmModal, setCleanupConfirmModal] = useState(false);
  const [cleanupConfirmInput, setCleanupConfirmInput] = useState('');
  const [cleaningUp, setCleaningUp] = useState(false);
  const [lastCleanupResult, setLastCleanupResult] = useState<CleanupResult | null>(null);

  const [deleteDriveTarget, setDeleteDriveTarget] = useState<DriveBackupFileItem | null>(null);
  const [deletingDriveFile, setDeletingDriveFile] = useState(false);

  const [previewPayload, setPreviewPayload] = useState<ChatBackupPayload | null>(null);
  const [previewChatIndex, setPreviewChatIndex] = useState<number>(0);
  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null);

  useEffect(() => {
    if (allChats.length > 0 && !selectedChatId) {
      setSelectedChatId(allChats[0].id);
    }
  }, [allChats, selectedChatId]);

  const refreshDriveFiles = async () => {
    const status = getDriveConnectionStatus();
    if (!status.connected) return;
    setLoadingDriveFiles(true);
    try {
      const files = await listDriveBackupFiles();
      setDriveFiles(files);
    } catch (err) {
      setDriveStatus(getDriveConnectionStatus());
      onError(err instanceof Error ? err.message : 'Unable to fetch Drive backup files.');
    } finally {
      setLoadingDriveFiles(false);
    }
  };

  useEffect(() => {
    if (driveStatus.connected) {
      refreshDriveFiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driveStatus.connected]);

  const handleConnectDrive = async () => {
    setConnectingDrive(true);
    onError('');
    try {
      const info = await connectDriveBackupAccount(PREFERRED_BACKUP_DRIVE_EMAIL);
      setDriveStatus(info);
      onSuccess(
        bn
          ? `Google Drive সফলভাবে যুক্ত হয়েছে: ${info.email}`
          : `Google Drive connected: ${info.email}`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onError(msg);
    } finally {
      setConnectingDrive(false);
    }
  };

  const handleDisconnectDrive = async () => {
    await disconnectDriveBackupAccount();
    setDriveStatus(getDriveConnectionStatus());
    setDriveFiles([]);
    onSuccess(bn ? 'Google Drive সংযোগ বিচ্ছিন্ন করা হয়েছে।' : 'Google Drive disconnected.');
  };

  const handleScanStorage = async () => {
    setScanningStorage(true);
    setProgressLabel(bn ? 'স্টোরেজ হিসাব করা হচ্ছে...' : 'Scanning Firestore storage...');
    try {
      const report = await scanFirestoreChatStorage((label) => setProgressLabel(label));
      setScanReport(report);
      onSuccess(
        bn
          ? `স্ক্যান সম্পন্ন: আনুমানিক ${formatBytes(report.estimatedTotalBytes)} ব্যবহৃত হয়েছে।`
          : `Scan complete: ~${formatBytes(report.estimatedTotalBytes)} estimated usage.`
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Storage scan failed.');
    } finally {
      setScanningStorage(false);
      setProgressLabel('');
    }
  };

  const buildPayloadFromSelection = async (): Promise<ChatBackupPayload> => {
    return collectChatBackupPayload(
      {
        scope: backupScope,
        olderThanDays: backupScope === 'older_than_days' ? olderThanDays : undefined,
        singleChatId: backupScope === 'single_chat' ? selectedChatId : undefined,
        targetDriveEmail: driveStatus.email || PREFERRED_BACKUP_DRIVE_EMAIL,
      },
      (label) => setProgressLabel(label)
    );
  };

  const handleBackupToDrive = async () => {
    if (!driveStatus.connected) {
      onError(
        bn
          ? 'প্রথমে anomahchatsarverorg@gmail.com দিয়ে Google Drive কানেক্ট করুন।'
          : 'Please connect your backup Google Drive account first.'
      );
      return;
    }

    setBackingUp(true);
    setProgressLabel(bn ? 'চ্যাট ডেটা সংগ্রহ করা হচ্ছে...' : 'Collecting chat data...');
    try {
      const payload = await buildPayloadFromSelection();
      if (payload.stats.chatCount === 0 && payload.stats.messageCount === 0) {
        onError(
          bn
            ? 'নির্বাচিত ফিল্টারে ব্যাকআপ করার মতো কোনো চ্যাট বা মেসেজ পাওয়া যায়নি।'
            : 'No chats or messages matched the selected filter.'
        );
        return;
      }

      const uploaded = await uploadBackupToGoogleDrive(payload, (label) =>
        setProgressLabel(label)
      );
      setLastVerifiedBackup(uploaded);
      await refreshDriveFiles();
      onSuccess(
        bn
          ? `ব্যাকআপ সম্পন্ন! "${uploaded.name}" (${payload.stats.messageCount}টি মেসেজ) Google Drive-এ সংরক্ষিত হয়েছে।`
          : `Backup saved to Google Drive: "${uploaded.name}" (${payload.stats.messageCount} messages).`
      );
    } catch (err) {
      setDriveStatus(getDriveConnectionStatus());
      onError(err instanceof Error ? err.message : 'Backup upload failed.');
    } finally {
      setBackingUp(false);
      setProgressLabel('');
    }
  };

  const handleDownloadLocalBackup = async () => {
    setBackingUp(true);
    setProgressLabel(bn ? 'লোকাল ব্যাকআপ ফাইল তৈরি হচ্ছে...' : 'Preparing local JSON backup...');
    try {
      const payload = await buildPayloadFromSelection();
      triggerLocalBackupDownload(payload);
      onSuccess(
        bn
          ? `ব্যাকআপ ফাইল ডাউনলোড হয়েছে (${payload.stats.messageCount}টি মেসেজ)।`
          : `Downloaded JSON backup (${payload.stats.messageCount} messages).`
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Local backup export failed.');
    } finally {
      setBackingUp(false);
      setProgressLabel('');
    }
  };

  const handleConfirmCleanup = async () => {
    if (cleanupConfirmInput.trim().toUpperCase() !== 'CLEAN') return;

    setCleaningUp(true);
    setProgressLabel(bn ? 'Firebase ডেটা ক্লিন করা হচ্ছে...' : 'Cleaning Firebase storage...');
    try {
      const res = await cleanupFirestoreAfterBackup(
        {
          mode: cleanupMode,
          olderThanDays:
            cleanupMode === 'old_messages' || cleanupMode === 'media_messages'
              ? cleanupDays
              : undefined,
        },
        (label) => setProgressLabel(label)
      );
      setLastCleanupResult(res);
      setCleanupConfirmModal(false);
      setCleanupConfirmInput('');
      onSuccess(
        bn
          ? `ক্লিনআপ সম্পন্ন: ${res.deletedMessages}টি মেসেজ, ${res.deletedCallDocs}টি কল লগ ও ${res.deletedChatRooms}টি চ্যাট রুম মুছে ফেলা হয়েছে।`
          : `Cleanup finished: deleted ${res.deletedMessages} messages, ${res.deletedCallDocs} calls, ${res.deletedChatRooms} rooms.`
      );
      // Re-scan storage quietly
      scanFirestoreChatStorage()
        .then((r) => setScanReport(r))
        .catch(() => {});
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Firebase cleanup failed.');
    } finally {
      setCleaningUp(false);
      setProgressLabel('');
    }
  };

  const handlePreviewBackupFile = async (file: DriveBackupFileItem) => {
    setLoadingPreviewId(file.id);
    try {
      const payload = await downloadDriveBackupContent(file.id);
      setPreviewPayload(payload);
      setPreviewChatIndex(0);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to open Drive backup.');
    } finally {
      setLoadingPreviewId(null);
    }
  };

  const handleDownloadDriveFileToDevice = async (file: DriveBackupFileItem) => {
    setLoadingPreviewId(file.id);
    try {
      const payload = await downloadDriveBackupContent(file.id);
      triggerLocalBackupDownload(payload);
      onSuccess(bn ? `"${file.name}" ডিভাইসে ডাউনলোড হয়েছে।` : `Downloaded "${file.name}".`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Download failed.');
    } finally {
      setLoadingPreviewId(null);
    }
  };

  const handleConfirmDeleteDriveFile = async () => {
    if (!deleteDriveTarget) return;
    setDeletingDriveFile(true);
    try {
      await deleteDriveBackupFile(deleteDriveTarget.id);
      const removedName = deleteDriveTarget.name;
      setDeleteDriveTarget(null);
      await refreshDriveFiles();
      onSuccess(
        bn
          ? `Google Drive থেকে "${removedName}" ডিলিট করা হয়েছে।`
          : `Deleted "${removedName}" from Google Drive.`
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to delete Drive file.');
    } finally {
      setDeletingDriveFile(false);
    }
  };

  const usagePercent = scanReport
    ? Math.min(100, (scanReport.estimatedTotalBytes / SPARK_FREE_LIMIT_BYTES) * 100)
    : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-8">
      {/* Zero Data Leak & Admin Isolation Guarantee */}
      <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <div className="font-bold text-emerald-300">
            {bn
              ? 'নিরাপত্তা ও গোপনীয়তা সুরক্ষা (Zero Data Leak Architecture)'
              : 'Security & Zero Data Leak Architecture'}
          </div>
          <p className="text-slate-300 leading-relaxed">
            {bn
              ? `আপনার সুপার অ্যাডমিন লগইন (chinisdramaorg@gmail.com) একদম আলাদা ও অক্ষত থাকবে। "${PREFERRED_BACKUP_DRIVE_EMAIL}"-এর Google Drive শুধু এই অ্যাপের তৈরি ব্যাকআপ ফোল্ডার (AnomahChat_Backups) পর্যন্ত সীমাবদ্ধ থাকবে—ব্যক্তিগত অন্য কোনো ফাইলে প্রবেশ করবে না। অ্যাক্সেস টোকেন কখনোই ব্রাউজার স্টোরেজে বা ডেটাবেসে সেভ হয় না।`
              : `Your Super Admin session (chinisdramaorg@gmail.com) remains untouched. "${PREFERRED_BACKUP_DRIVE_EMAIL}" only grants access to files created by this app inside "AnomahChat_Backups" (drive.file scope)—never personal files. Tokens stay strictly in RAM.`}
          </p>
        </div>
      </div>

      {/* Live Progress Strip */}
      {progressLabel && (
        <div className="bg-sky-950/50 border border-sky-500/40 rounded-xl px-4 py-2.5 flex items-center gap-2.5 text-xs text-sky-200 font-medium">
          <RefreshCw className="w-4 h-4 animate-spin text-sky-400 shrink-0" />
          <span>{progressLabel}</span>
        </div>
      )}

      {/* Step 1: Google Drive Connection */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {bn ? '১. ব্যাকআপ Google Drive সংযুক্ত করুন' : '1. Connect Backup Google Drive'}
              </h3>
              <p className="text-xs text-slate-400">
                {bn
                  ? `নির্ধারিত ড্রাইভ অ্যাকাউন্ট: ${PREFERRED_BACKUP_DRIVE_EMAIL}`
                  : `Target backup Drive account: ${PREFERRED_BACKUP_DRIVE_EMAIL}`}
              </p>
            </div>
          </div>

          {driveStatus.connected ? (
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 ${
                  driveStatus.isPreferredTarget
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{driveStatus.email}</span>
              </span>
              <button
                onClick={handleConnectDrive}
                disabled={connectingDrive}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
              >
                {bn ? 'অ্যাকাউন্ট বদলান' : 'Switch'}
              </button>
              <button
                onClick={handleDisconnectDrive}
                className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-semibold border border-rose-500/30 flex items-center gap-1 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{bn ? 'বিচ্ছিন্ন' : 'Disconnect'}</span>
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectDrive}
              disabled={connectingDrive}
              className="inline-flex items-center gap-2.5 bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs px-4 py-2.5 rounded-xl shadow transition cursor-pointer disabled:opacity-60"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>
                {connectingDrive
                  ? bn
                    ? 'সংযুক্ত হচ্ছে...'
                    : 'Connecting...'
                  : bn
                    ? 'Google Drive যুক্ত করুন (Anomah Backup)'
                    : 'Sign in with Google Drive'}
              </span>
            </button>
          )}
        </div>

        {driveStatus.connected && !driveStatus.isPreferredTarget && (
          <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-3 text-xs text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              {bn
                ? `সতর্কতা: আপনি "${driveStatus.email}" দিয়ে কানেক্ট করেছেন, "${PREFERRED_BACKUP_DRIVE_EMAIL}" দিয়ে নয়। চাইলে "অ্যাকাউন্ট বদলান" ক্লিক করে সঠিক ড্রাইভ অ্যাকাউন্টটি দিন।`
                : `Notice: Connected as "${driveStatus.email}" instead of "${PREFERRED_BACKUP_DRIVE_EMAIL}". Use "Switch" if you intended the dedicated backup Drive.`}
            </span>
          </div>
        )}

        {/* Helpful Google Cloud Test User note */}
        <details className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-xs text-slate-300">
          <summary className="cursor-pointer font-semibold text-slate-200 flex items-center gap-2 select-none">
            <Info className="w-4 h-4 text-sky-400 shrink-0" />
            <span>
              {bn
                ? `প্রথমবার ${PREFERRED_BACKUP_DRIVE_EMAIL} কানেক্ট করার সময় "Access blocked / Testing" দেখালে কী করবেন?`
                : `What to do if Google shows "Access blocked / Testing" on ${PREFERRED_BACKUP_DRIVE_EMAIL}?`}
            </span>
          </summary>
          <ol className="mt-2.5 space-y-1.5 list-decimal list-inside text-slate-400 leading-relaxed">
            <li>
              {bn
                ? 'ওয়েব ব্রাউজারে (Chrome) ব্যবহার করুন—Android APK-তে Google Drive পপ-আপ কাজ নাও করতে পারে।'
                : 'Use the web browser version (Chrome) for Google Drive backups.'}
            </li>
            <li>
              {bn
                ? 'Google Cloud Console → "Google Auth Platform" (বা OAuth consent screen) → "Audience / Test users"-এ যান।'
                : 'Open Google Cloud Console → Google Auth Platform / OAuth consent screen → Audience / Test users.'}
            </li>
            <li>
              {bn
                ? `সেখানে "Add users" ক্লিক করে "${PREFERRED_BACKUP_DRIVE_EMAIL}" যোগ করে Save দিন—এরপর সাথে সাথে কানেক্ট হয়ে যাবে।`
                : `Click "Add users", add "${PREFERRED_BACKUP_DRIVE_EMAIL}", save, and reconnect here.`}
            </li>
          </ol>
        </details>
      </div>

      {/* Step 2: Firestore 1 GiB Storage Scanner */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {bn ? '২. Firebase ১ GiB স্টোরেজ মনিটর' : '2. Firebase 1 GiB Storage Scanner'}
              </h3>
              <p className="text-xs text-slate-400">
                {bn
                  ? 'বর্তমান চ্যাট, ছবি, ভয়েস নোট ও কল সিগনালিংয়ে কতটুকু জায়গা খরচ হয়েছে দেখুন'
                  : 'Inspect estimated Firestore usage across texts, media, and WebRTC signaling'}
              </p>
            </div>
          </div>

          <button
            onClick={handleScanStorage}
            disabled={scanningStorage}
            className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanningStorage ? 'animate-spin' : ''}`} />
            <span>{scanningStorage ? (bn ? 'স্ক্যান হচ্ছে...' : 'Scanning...') : (bn ? 'স্টোরেজ স্ক্যান করুন' : 'Scan Usage')}</span>
          </button>
        </div>

        {scanReport && (
          <div className="space-y-3">
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold">
                  {bn ? 'মোট ব্যবহৃত আনুমানিক স্টোরেজ:' : 'Estimated Firestore Chat Storage:'}{' '}
                  <span className="text-white font-bold">{formatBytes(scanReport.estimatedTotalBytes)}</span> / 1.00 GB
                </span>
                <span className="font-mono text-amber-400 font-bold">{usagePercent.toFixed(2)}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    usagePercent > 80 ? 'bg-rose-500' : usagePercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.max(2, usagePercent)}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-sky-400 font-semibold">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{bn ? 'টেক্সট ও কল লগ' : 'Texts & Call Logs'}</span>
                </div>
                <div className="text-lg font-bold text-white mt-1">
                  {formatBytes(scanReport.estimatedTextBytes)}
                </div>
                <div className="text-[11px] text-slate-400">
                  {scanReport.textAndCallMessages} {bn ? 'টি মেসেজ' : 'messages'} · {scanReport.totalChats}{' '}
                  {bn ? 'টি রুম' : 'rooms'}
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-rose-400 font-semibold">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>{bn ? 'ছবি, ভয়েস ও ফাইল' : 'Images, Voice & Files'}</span>
                </div>
                <div className="text-lg font-bold text-white mt-1">
                  {formatBytes(scanReport.estimatedMediaBytes)}
                </div>
                <div className="text-[11px] text-slate-400">
                  {scanReport.mediaMessages} {bn ? 'টি মিডিয়া মেসেজ' : 'media messages'}
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>{bn ? 'WebRTC কল সিগনাল' : 'WebRTC Call Signaling'}</span>
                </div>
                <div className="text-lg font-bold text-white mt-1">
                  {formatBytes(scanReport.estimatedSignalBytes)}
                </div>
                <div className="text-[11px] text-slate-400">
                  {scanReport.callSignalDocs} {bn ? 'কল' : 'calls'} · {scanReport.iceCandidateDocs} ICE
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Step 3 & Step 4 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Step 3: Export & Upload Backup */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <CloudUpload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {bn ? '৩. Google Drive-এ ব্যাকআপ নিন' : '3. Back Up Chats to Google Drive'}
              </h3>
              <p className="text-xs text-slate-400">
                {bn
                  ? 'ক্লিন করার আগে নিরাপদ JSON ব্যাকআপ সেভ করুন'
                  : 'Save a complete JSON backup before cleaning Firestore'}
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                {bn ? 'কতটুকু ডেটা ব্যাকআপ নেবেন:' : 'Backup Scope:'}
              </label>
              <select
                value={backupScope}
                onChange={(e) => setBackupScope(e.target.value as BackupScopeMode)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-500"
              >
                <option value="all">{bn ? 'সব চ্যাট ও মেসেজ (সম্পূর্ণ ব্যাকআপ)' : 'All Chats & Messages (Full Backup)'}</option>
                <option value="older_than_days">{bn ? 'নির্দিষ্ট দিনের পুরনো মেসেজ' : 'Messages Older Than X Days'}</option>
                <option value="media_only">{bn ? 'শুধুমাত্র ছবি, ভয়েস ও ফাইল' : 'Media Messages Only (Images / Audio / Files)'}</option>
                <option value="single_chat">{bn ? 'নির্দিষ্ট একটি চ্যাট রুম' : 'Specific Chat Room'}</option>
              </select>
            </div>

            {backupScope === 'older_than_days' && (
              <div>
                <label className="block text-slate-400 mb-1">
                  {bn ? 'কত দিনের পুরনো (দিন):' : 'Older than (days):'}
                </label>
                <select
                  value={olderThanDays}
                  onChange={(e) => setOlderThanDays(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none"
                >
                  <option value={30}>{bn ? '৩০ দিনের পুরনো' : '30 days'}</option>
                  <option value={90}>{bn ? '৯০ দিনের (৩ মাস) পুরনো' : '90 days (3 months)'}</option>
                  <option value={180}>{bn ? '১৮০ দিনের (৬ মাস) পুরনো' : '180 days (6 months)'}</option>
                  <option value={365}>{bn ? '৩৬৫ দিনের (১ বছর) পুরনো' : '365 days (1 year)'}</option>
                </select>
              </div>
            )}

            {backupScope === 'single_chat' && (
              <div>
                <label className="block text-slate-400 mb-1">
                  {bn ? 'চ্যাট বেছে নিন:' : 'Select Chat:'}
                </label>
                <select
                  value={selectedChatId}
                  onChange={(e) => setSelectedChatId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none"
                >
                  {allChats.map((c) => {
                    const label =
                      c.type === 'group'
                        ? `Group: ${c.name || c.id}`
                        : `DM: ${Object.values(c.participantDetails || {})
                            .map((p) => p.displayName)
                            .join(' & ') || c.id}`;
                    return (
                      <option key={c.id} value={c.id}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              onClick={handleBackupToDrive}
              disabled={backingUp || !driveStatus.connected}
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <CloudUpload className="w-4 h-4" />
              <span>{bn ? 'Google Drive-এ আপলোড করুন' : 'Upload to Google Drive'}</span>
            </button>

            <button
              onClick={handleDownloadLocalBackup}
              disabled={backingUp}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{bn ? 'ডাউনলোড (.json)' : 'Download JSON'}</span>
            </button>
          </div>

          {lastVerifiedBackup && (
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate">
                {bn ? 'সর্বশেষ ভেরিফাইড ব্যাকআপ:' : 'Verified on Drive:'} <strong>{lastVerifiedBackup.name}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Step 4: Safe Firebase Cleanup */}
        <div className="bg-slate-950/70 border border-rose-500/30 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {bn ? '৪. Firebase ১ GiB স্টোরেজ খালি করুন' : '4. Clean Firebase to Reclaim 1 GiB'}
              </h3>
              <p className="text-xs text-slate-400">
                {bn
                  ? 'ড্রাইভে ব্যাকআপ নেওয়ার পর Firebase থেকে পুরনো ডেটা মুছে জায়গা ফিরিয়ে আনুন'
                  : 'Remove backed-up data from Firestore (Drive copy stays safe)'}
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                {bn ? 'কীভাবে ক্লিন করবেন:' : 'Cleanup Mode:'}
              </label>
              <select
                value={cleanupMode}
                onChange={(e) => setCleanupMode(e.target.value as CleanupMode)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-rose-500"
              >
                <option value="media_messages">
                  {bn ? 'শুধু পুরনো ছবি, ভয়েস ও ফাইল মুছুন (টেক্সট থাকবে — সেরা উপায়)' : 'Delete Media Messages Only (Keep Texts — Recommended)'}
                </option>
                <option value="old_messages">
                  {bn ? 'নির্দিষ্ট দিনের পুরনো সব মেসেজ মুছুন' : 'Delete All Messages Older Than X Days'}
                </option>
                <option value="call_signaling">
                  {bn ? 'শুধু পুরনো WebRTC কল সিগনালিং ও ICE ক্যান্ডিডেট মুছুন' : 'Clean WebRTC Call Signaling & ICE Subcollections'}
                </option>
                <option value="full_chat_rooms">
                  {bn ? 'সব চ্যাট রুম + সব মেসেজ সম্পূর্ণ মুছুন (ইউজার অ্যাকাউন্ট থাকবে)' : 'Purge ALL Chat Rooms & Messages (Keep User Accounts)'}
                </option>
              </select>
            </div>

            {(cleanupMode === 'media_messages' || cleanupMode === 'old_messages') && (
              <div>
                <label className="block text-slate-400 mb-1">
                  {bn ? 'বয়স সীমা (এর আগের ডেটা মুছবে):' : 'Delete items older than:'}
                </label>
                <select
                  value={cleanupDays}
                  onChange={(e) => setCleanupDays(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none"
                >
                  <option value={0}>{bn ? 'সবগুলোই (সময়সীমা ছাড়া)' : 'All matching items (no age limit)'}</option>
                  <option value={30}>{bn ? '৩০ দিনের পুরনো' : '30 days'}</option>
                  <option value={90}>{bn ? '৯০ দিনের (৩ মাস) পুরনো' : '90 days (3 months)'}</option>
                  <option value={180}>{bn ? '১৮০ দিনের (৬ মাস) পুরনো' : '180 days (6 months)'}</option>
                  <option value={365}>{bn ? '৩৬৫ দিনের (১ বছর) পুরনো' : '365 days (1 year)'}</option>
                </select>
              </div>
            )}

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 leading-relaxed">
              {bn
                ? 'মনে রাখবেন: Firebase ফ্রি প্ল্যানে প্রতিদিন সর্বোচ্চ ২০,০০০ ডকুমেন্ট ডিলিট করা যায়। ইউজারদের অ্যাকাউন্ট ও প্রোফাইল (users/directory) কোনোভাবেই ডিলিট হবে না।'
                : 'Note: Spark Free Tier allows 20,000 deletes/day. User accounts and profiles (users/directory) are never deleted here.'}
            </div>
          </div>

          <button
            onClick={() => {
              setCleanupConfirmInput('');
              setCleanupConfirmModal(true);
            }}
            disabled={cleaningUp}
            className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            <span>{bn ? 'Firebase ডেটা ক্লিন করুন' : 'Clean Selected Data from Firebase'}</span>
          </button>

          {lastCleanupResult && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 space-y-1">
              <div className="font-bold text-emerald-400">
                {bn ? 'সর্বশেষ ক্লিনআপ ফলাফল:' : 'Last Cleanup Summary:'}
              </div>
              <div>
                {bn
                  ? `মেসেজ: ${lastCleanupResult.deletedMessages} · কল ডক: ${lastCleanupResult.deletedCallDocs} · ICE: ${lastCleanupResult.deletedIceDocs} · রুম: ${lastCleanupResult.deletedChatRooms}`
                  : `Messages: ${lastCleanupResult.deletedMessages} · Calls: ${lastCleanupResult.deletedCallDocs} · ICE: ${lastCleanupResult.deletedIceDocs} · Rooms: ${lastCleanupResult.deletedChatRooms}`}
              </div>
              {lastCleanupResult.quotaHit && (
                <div className="text-amber-400">
                  {bn
                    ? 'দৈনিক ২০,০০০ ডিলিট কোটা পূর্ণ হয়েছে — বাকি অংশ আগামীকাল আবার চালালে হয়ে যাবে।'
                    : 'Daily 20,000 delete quota reached — run again tomorrow to finish remaining items.'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Step 5: Drive Backup Archive Browser */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {bn ? '৫. Google Drive-এ সংরক্ষিত ব্যাকআপ আর্কাইভ' : '5. Saved Backups on Google Drive'}
              </h3>
              <p className="text-xs text-slate-400">
                {bn
                  ? 'Firebase থেকে মুছে ফেললেও এখান থেকে যেকোনো ব্যাকআপের চ্যাট ও ছবি দেখতে বা ডাউনলোড করতে পারবেন'
                  : 'Inspect archived chats & media directly from Drive even after cleaning Firebase'}
              </p>
            </div>
          </div>

          {driveStatus.connected && (
            <button
              onClick={refreshDriveFiles}
              disabled={loadingDriveFiles}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDriveFiles ? 'animate-spin' : ''}`} />
              <span>{bn ? 'রিফ্রেশ' : 'Refresh'}</span>
            </button>
          )}
        </div>

        {!driveStatus.connected ? (
          <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
            {bn
              ? 'আর্কাইভ তালিকা দেখতে ধাপ ১ থেকে Google Drive যুক্ত করুন।'
              : 'Connect Google Drive in Step 1 to view your saved backups.'}
          </div>
        ) : driveFiles.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
            {loadingDriveFiles
              ? bn
                ? 'ব্যাকআপ তালিকা লোড হচ্ছে...'
                : 'Loading backup files...'
              : bn
                ? 'AnomahChat_Backups ফোল্ডারে এখনো কোনো ব্যাকআপ ফাইল নেই।'
                : 'No backup files in AnomahChat_Backups yet.'}
          </div>
        ) : (
          <div className="space-y-2.5">
            {driveFiles.map((file) => (
              <div
                key={file.id}
                className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate">{file.name}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {formatBytes(file.sizeBytes)} ·{' '}
                    {file.createdTime ? new Date(file.createdTime).toLocaleString() : ''}
                  </div>
                  {file.description && (
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">{file.description}</div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handlePreviewBackupFile(file)}
                    disabled={loadingPreviewId === file.id}
                    className="px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{loadingPreviewId === file.id ? '...' : bn ? 'পড়ুন' : 'Inspect'}</span>
                  </button>
                  <button
                    onClick={() => handleDownloadDriveFileToDevice(file)}
                    disabled={loadingPreviewId === file.id}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
                    title={bn ? 'ডাউনলোড' : 'Download'}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteDriveTarget(file)}
                    className="p-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition cursor-pointer"
                    title={bn ? 'ড্রাইভ থেকে মুছুন' : 'Delete from Drive'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Explicit Confirmation Modal: Firebase Cleanup */}
      {cleanupConfirmModal && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  {bn ? 'Firebase ডেটা ডিলিট নিশ্চিত করুন' : 'Confirm Firebase Storage Cleanup'}
                </h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {bn
                    ? 'এই কাজটি সম্পন্ন হলে নির্বাচিত চ্যাট/মিডিয়া ডেটা Firebase থেকে স্থায়ীভাবে মুছে যাবে এবং ১ GiB স্টোরেজ খালি হবে।'
                    : 'This will permanently delete the selected items from Firestore to reclaim 1 GiB free storage.'}
                </p>
              </div>
            </div>

            {!lastVerifiedBackup && (
              <div className="bg-amber-950/50 border border-amber-500/40 rounded-xl p-3 text-xs text-amber-200">
                {bn
                  ? 'সতর্কতা: এই সেশনে এখনো Google Drive-এ কোনো ভেরিফাইড ব্যাকআপ নেওয়া হয়নি! নিশ্চিত না হলে আগে ধাপ ৩ থেকে ব্যাকআপ নিন।'
                  : 'Warning: No verified Google Drive backup was uploaded in this session yet!'}
              </div>
            )}

            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1.5">
                {bn ? 'নিশ্চিত করতে নিচে CLEAN লিখুন:' : 'Type CLEAN below to confirm:'}
              </label>
              <input
                type="text"
                value={cleanupConfirmInput}
                onChange={(e) => setCleanupConfirmInput(e.target.value)}
                placeholder="CLEAN"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                onClick={() => setCleanupConfirmModal(false)}
                disabled={cleaningUp}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                {bn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                onClick={handleConfirmCleanup}
                disabled={cleaningUp || cleanupConfirmInput.trim().toUpperCase() !== 'CLEAN'}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer disabled:opacity-40"
              >
                {cleaningUp ? (bn ? 'মুছে ফেলা হচ্ছে...' : 'Deleting...') : (bn ? 'হ্যাঁ, ক্লিন করুন' : 'Confirm Cleanup')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Explicit Confirmation Modal: Delete File from Google Drive */}
      {deleteDriveTarget && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  {bn ? 'Google Drive ফাইল ডিলিট নিশ্চিত করুন' : 'Delete Backup from Google Drive?'}
                </h4>
                <p className="text-xs text-slate-300 mt-1 break-all">
                  {bn
                    ? `আপনি কি নিশ্চিতভাবে "${deleteDriveTarget.name}" ফাইলটি Google Drive থেকে মুছে ফেলতে চান? এটি আর ফিরিয়ে আনা যাবে না।`
                    : `Permanently delete "${deleteDriveTarget.name}" from Google Drive? This action cannot be undone.`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setDeleteDriveTarget(null)}
                disabled={deletingDriveFile}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                {bn ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                onClick={handleConfirmDeleteDriveFile}
                disabled={deletingDriveFile}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {deletingDriveFile ? (bn ? 'মুছছে...' : 'Deleting...') : (bn ? 'হ্যাঁ, ডিলিট করুন' : 'Delete File')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Backup Viewer Modal */}
      {previewPayload && (
        <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-white truncate">
                  {bn ? 'আর্কাইভ ব্যাকআপ রিডার' : 'Archived Backup Reader'}
                </h4>
                <p className="text-[11px] text-slate-400 truncate">
                  {new Date(previewPayload.exportedAt).toLocaleString()} · {previewPayload.stats.chatCount}{' '}
                  {bn ? 'চ্যাট' : 'chats'} · {previewPayload.stats.messageCount}{' '}
                  {bn ? 'মেসেজ' : 'messages'}
                </p>
              </div>
              <button
                onClick={() => setPreviewPayload(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 min-h-0 flex flex-col sm:flex-row">
              <div className="sm:w-64 border-b sm:border-b-0 sm:border-r border-slate-800 overflow-y-auto p-2 space-y-1 bg-slate-950/50 shrink-0 max-h-40 sm:max-h-none">
                {previewPayload.chats.map((entry, idx) => {
                  const title =
                    entry.room.type === 'group'
                      ? entry.room.name || entry.room.id
                      : Object.values(entry.room.participantDetails || {})
                          .map((p) => p.displayName)
                          .join(' & ') || entry.room.id;
                  return (
                    <button
                      key={entry.room.id}
                      onClick={() => setPreviewChatIndex(idx)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs transition cursor-pointer ${
                        idx === previewChatIndex
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold'
                          : 'text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="truncate">{title}</div>
                      <div className="text-[10px] text-slate-500">{entry.messages.length} msgs</div>
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-900/50">
                {previewPayload.chats[previewChatIndex]?.messages.length ? (
                  previewPayload.chats[previewChatIndex].messages.map((m) => (
                    <div
                      key={m.id}
                      className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-emerald-400">{m.senderName}</span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(m.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {m.text && <p className="text-slate-200 whitespace-pre-wrap break-words">{m.text}</p>}
                      {m.type === 'image' && m.mediaUrl && (
                        <img
                          src={m.mediaUrl}
                          alt="Archived media"
                          className="max-h-56 rounded-lg border border-slate-800 object-contain"
                        />
                      )}
                      {m.type === 'audio' && m.mediaUrl && (
                        <audio controls src={m.mediaUrl} className="w-full max-w-xs h-8" />
                      )}
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-xs text-slate-500">
                    {bn ? 'এই চ্যাটে কোনো মেসেজ নেই।' : 'No messages in this archived room.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
