import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { APP_VERSION } from '../utils/appVersion';
import type { AppReleaseInfo } from '../services/updateService';
import {
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
  HardDrive,
  PackageCheck,
  RotateCcw,
  ExternalLink,
  ArrowDownToLine,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';

interface UpdateModalProps {
  release: AppReleaseInfo;
  onClose: () => void;
  isManualCheck?: boolean;
}

export function UpdateModal({ release, onClose, isManualCheck = false }: UpdateModalProps) {
  const { language } = useLanguage();
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Once download starts, back/escape button is strictly locked to require immediate install
  useEffect(() => {
    if ((release.forceUpdate || downloadStarted) && !isManualCheck) return;
    window.history.pushState({ modal: 'updateModal' }, '');
    const handlePopState = () => onClose();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, release.forceUpdate, isManualCheck, downloadStarted]);

  // Listen to native download completion event sent by Android MainActivity
  useEffect(() => {
    const win = window as any;
    win.onNativeApkDownloadComplete = () => {
      setDownloadComplete(true);
    };

    return () => {
      if (win.onNativeApkDownloadComplete) {
        win.onNativeApkDownloadComplete = null;
      }
    };
  }, []);

  const triggerApkDownload = () => {
    if (!release.apkDownloadUrl) return;
    const url = release.apkDownloadUrl;

    setDownloadStarted(true);
    setDownloadComplete(false);

    // Clean any legacy install locks so user is never blocked from updating
    try {
      localStorage.removeItem('anomah_last_installed_code');
    } catch {
      // ignore
    }

    // 1. Try Native Android Interface bridge with in-app auto-installer
    const win = window as any;
    if (win.AndroidUpdater) {
      try {
        if (typeof win.AndroidUpdater.downloadAndInstall === 'function') {
          win.AndroidUpdater.downloadAndInstall(url, release.versionName);
          return;
        } else if (typeof win.AndroidUpdater.downloadWithManager === 'function') {
          win.AndroidUpdater.downloadWithManager(url);
          return;
        }
      } catch (e) {
        console.warn('AndroidUpdater downloadAndInstall failed, trying openSystemDownload:', e);
        try {
          win.AndroidUpdater.openSystemDownload(url);
          return;
        } catch (ex) {
          console.warn('AndroidUpdater openSystemDownload failed:', ex);
        }
      }
    }

    // 2. Open via Capacitor / Android system browser intent
    try {
      const opened = window.open(url, '_system');
      if (opened) return;
    } catch {
      // ignore
    }

    // 3. Standard fallback: browser link click & navigation
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = `AnomahChat-v${release.versionName}.apk`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.location.href = url;
    }
  };

  const handleLaunchInstallerAgain = () => {
    const win = window as any;
    if (win.AndroidUpdater && typeof win.AndroidUpdater.installDownloadedApk === 'function') {
      try {
        win.AndroidUpdater.installDownloadedApk();
        return;
      } catch (e) {
        console.warn('installDownloadedApk failed:', e);
      }
    }
    // Fallback: re-trigger or open system download
    handleOpenInBrowser();
  };

  const handleOpenInBrowser = () => {
    if (!release.apkDownloadUrl) return;
    const url = release.apkDownloadUrl;
    const win = window as any;
    if (win.AndroidUpdater) {
      try {
        win.AndroidUpdater.openSystemDownload(url);
        return;
      } catch {
        // ignore
      }
    }
    try {
      window.open(url, '_system');
    } catch {
      window.location.href = url;
    }
  };

  const handleCopyLink = () => {
    if (!release.apkDownloadUrl) return;
    navigator.clipboard.writeText(release.apkDownloadUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const changelog = language === 'bn'
    ? (release.changelogBn || release.changelogEn || 'নতুন ফিচার এবং নিরাপত্তা আপডেট যোগ করা হয়েছে।')
    : (release.changelogEn || release.changelogBn || 'New features, performance enhancements, and bug fixes.');

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative flex flex-col max-h-[92vh] overflow-hidden">
        {/* Close Button (ONLY before download starts, and only if not mandatory) */}
        {!release.forceUpdate && !downloadStarted && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-slate-800 transition cursor-pointer"
            title={language === 'bn' ? 'বন্ধ করুন' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header Icon & Title */}
        <div className="text-center mb-4">
          <div className="w-13 h-13 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
            <ArrowDownToLine className="w-6 h-6" />
          </div>

          <h2 className="text-base sm:text-lg font-bold text-white mb-1">
            {language === 'bn' ? 'নতুন সংস্করণ প্রস্তুত!' : 'New Update Available!'}
          </h2>
          <p className="text-xs text-slate-400">
            {language === 'bn'
              ? 'আনমাহ্ মেসেঞ্জারের নতুন আপডেট প্রকাশ করা হয়েছে।'
              : 'A new version of Anomah Messenger is ready to install.'}
          </p>

          {/* Clean Unboxed Version Metadata */}
          <div className="flex items-center justify-center gap-2 mt-2 text-xs text-slate-400 font-mono">
            <span>v{APP_VERSION.versionName}</span>
            <span className="text-slate-600">→</span>
            <span className="text-emerald-400 font-semibold">v{release.versionName}</span>
            {release.fileSizeText && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400 font-sans">{release.fileSizeText}</span>
              </>
            )}
          </div>
        </div>

        {/* Changelog & Notes Box */}
        <div className="flex-1 overflow-y-auto mb-4 p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl">
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-200">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{language === 'bn' ? 'কী কী নতুন এসেছে:' : "What's New in this update:"}</span>
          </div>

          <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-line pl-6">
            {changelog}
          </div>

          {/* Storage & Auto-Clean Reassurance Note */}
          <div className="mt-3.5 pt-2.5 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-2">
            <HardDrive className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
            <span>
              {language === 'bn'
                ? 'ইনস্টলেশন সম্পন্ন হওয়ার পর ক্যাশ ফাইল স্বয়ংক্রিয়ভাবে মুছে যাবে। কোনো বাড়তি মেমোরি খরচ হবে না।'
                : 'Temporary installation files will be cleaned automatically after setup without consuming extra storage.'}
            </span>
          </div>
        </div>

        {/* Action Area: Post-download mandatory install state */}
        {downloadStarted ? (
          <div className="space-y-3 animate-in fade-in zoom-in-95">
            {downloadComplete ? (
              <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-4 text-center space-y-2 shadow-xs">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-white">
                  {language === 'bn' ? 'ডাউনলোড সম্পন্ন! ইনস্টলেশন প্রস্তুত' : 'Downloaded! Ready to Install'}
                </h3>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {language === 'bn'
                    ? 'অ্যান্ড্রয়েড ইনস্টলেশন উইন্ডোতে "Update" বা "Install" চাপুন। ইনস্টলেশন শেষ হলে "Done" বা "Open" দিলে অ্যাপ আপডেট হয়ে যাবে।'
                    : 'Tap "Update" on the Android installation prompt. Once finished, tap "Done" or "Open" to launch the new build.'}
                </p>
                <button
                  type="button"
                  onClick={handleLaunchInstallerAgain}
                  className="w-full mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition cursor-pointer active:scale-[0.99]"
                >
                  <PackageCheck className="w-4 h-4" />
                  <span>{language === 'bn' ? 'এখনই ইনস্টল করুন (Install Now)' : 'Open Installer Now'}</span>
                </button>
              </div>
            ) : (
              <div className="bg-slate-950/60 border border-slate-700/80 rounded-2xl p-4 text-center space-y-2.5 shadow-xs">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-white">
                  {language === 'bn' ? 'ইন-অ্যাপ আপডেট ডাউনলোড হচ্ছে...' : 'Downloading In-App Update...'}
                </h3>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {language === 'bn'
                    ? 'ডাউনলোড শেষ হওয়া মাত্রই সরাসরি ইনস্টলেশন উইন্ডো সামনে আসবে। ডাউনলোড অবস্থায় অ্যাপ বন্ধ করবেন না।'
                    : 'Installer window will open automatically when finished. Please stay on this screen.'}
                </p>
                <button
                  type="button"
                  onClick={handleLaunchInstallerAgain}
                  className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <PackageCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{language === 'bn' ? 'ইনস্টলার উইন্ডো খুলুন' : 'Open Installer'}</span>
                </button>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleOpenInBrowser}
                className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-[11px] font-medium transition cursor-pointer flex items-center justify-center gap-1.5 border border-slate-700/80"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                <span>{language === 'bn' ? 'ব্রাউজার ফোলব্যাক' : 'Browser Fallback'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-[11px] font-medium transition cursor-pointer flex items-center justify-center gap-1.5 border border-slate-700/80"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{language === 'bn' ? 'কপি হয়েছে' : 'Copied'}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>{language === 'bn' ? 'লিংক কপি' : 'Copy Link'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={triggerApkDownload}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer active:scale-[0.99]"
            >
              <Download className="w-4 h-4" />
              <span>{language === 'bn' ? 'এখনই আপডেট ডাউনলোড করুন' : 'Download Update Now'}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenInBrowser}
              className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-medium transition cursor-pointer flex items-center justify-center gap-1.5 border border-slate-700/80"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              <span>{language === 'bn' ? 'ব্রাউজার থেকে সরাসরি ডাউনলোড' : 'Download via Browser'}</span>
            </button>

            {!release.forceUpdate && (
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 px-4 bg-slate-800/80 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-medium transition cursor-pointer text-center"
              >
                {language === 'bn' ? 'পরে মনে করিয়ে দিন (Maybe Later)' : 'Remind Me Later'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
