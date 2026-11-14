import { CheckCircle2, Download, Loader2, Rocket, ShieldCheck, Sparkles } from 'lucide-react';
import { ALLOWED_APK_URL_PREFIX, isAllowedApkUrl, type AppReleaseInfo } from '../../services/updateService';
import { APP_VERSION } from '../../utils/appVersion';

interface AdminReleaseTabProps {
  language: string;
  currentLiveRelease: AppReleaseInfo | null;
  releaseVersionName: string;
  setReleaseVersionName: (v: string) => void;
  releaseVersionCode: string;
  setReleaseVersionCode: (v: string) => void;
  releaseApkUrl: string;
  setReleaseApkUrl: (v: string) => void;
  releaseApkSha256: string;
  setReleaseApkSha256: (v: string) => void;
  releaseFileSizeText: string;
  setReleaseFileSizeText: (v: string) => void;
  releaseChangelogBn: string;
  setReleaseChangelogBn: (v: string) => void;
  releaseChangelogEn: string;
  setReleaseChangelogEn: (v: string) => void;
  releaseForceUpdate: boolean;
  setReleaseForceUpdate: (v: boolean) => void;
  publishingRelease: boolean;
  onPublishRelease: (e: React.FormEvent) => void;
}

export function AdminReleaseTab({
  language,
  currentLiveRelease,
  releaseVersionName,
  setReleaseVersionName,
  releaseVersionCode,
  setReleaseVersionCode,
  releaseApkUrl,
  setReleaseApkUrl,
  releaseApkSha256,
  setReleaseApkSha256,
  releaseFileSizeText,
  setReleaseFileSizeText,
  releaseChangelogBn,
  setReleaseChangelogBn,
  releaseChangelogEn,
  setReleaseChangelogEn,
  releaseForceUpdate,
  setReleaseForceUpdate,
  publishingRelease,
  onPublishRelease,
}: AdminReleaseTabProps) {
  const urlValid = isAllowedApkUrl(releaseApkUrl);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-teal-950/40 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
            <Rocket className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              {language === 'bn' ? 'APK অটো-আপডেট ও রিলিজ সেন্টার' : 'APK Auto-Updater & Release Center'}
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {language === 'bn' ? 'সরাসরি ইন-অ্যাপ' : 'In-App Direct'}
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {language === 'bn'
                ? 'এখানে নতুন APK সংস্করণ প্রকাশ করলে সকল অ্যান্ড্রয়েড ডিভাইসে স্বয়ংক্রিয়ভাবে ইন-অ্যাপ আপডেট ডায়ালগ চলে যাবে এবং ১ ক্লিকে ইনস্টল হবে।'
                : 'Publishing a new APK release here immediately pushes the in-app update banner to all active Android APK installations worldwide.'}
            </p>
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2 shrink-0 text-right">
          <span className="text-[10px] text-slate-500 block uppercase font-mono font-bold">
            {language === 'bn' ? 'বর্তমান অ্যাপ বিল্ড' : 'Current App Build'}
          </span>
          <span className="text-xs font-mono font-bold text-emerald-400">
            v{APP_VERSION.versionName} ({APP_VERSION.versionCode})
          </span>
        </div>
      </div>

      {/* Live Active Release Card */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              {language === 'bn' ? 'লাইভ অ্যাক্টিভ রিলিজ (ক্লাউডে সেভ করা)' : 'Live Active Release (Cloud Synced)'}
            </h4>
          </div>
          {currentLiveRelease && (
            <span className="text-[11px] font-mono text-slate-400">
              {new Date(currentLiveRelease.publishedAt).toLocaleString()}
            </span>
          )}
        </div>

        {currentLiveRelease ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-1">
            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 block font-semibold">
                {language === 'bn' ? 'সংস্করণ নাম' : 'Version Name'}
              </span>
              <span className="text-sm font-bold text-emerald-400 font-mono">
                v{currentLiveRelease.versionName}
              </span>
            </div>

            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 block font-semibold">
                {language === 'bn' ? 'বিল্ড কোড' : 'Build Code'}
              </span>
              <span className="text-sm font-bold text-sky-400 font-mono">
                {currentLiveRelease.versionCode}
              </span>
            </div>

            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 block font-semibold">
                {language === 'bn' ? 'ফাইল সাইজ' : 'File Size'}
              </span>
              <span className="text-sm font-bold text-slate-200">
                {currentLiveRelease.fileSizeText || 'N/A'}
              </span>
            </div>

            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 block font-semibold">
                {language === 'bn' ? 'বাধ্যতামূলক আপডেট?' : 'Mandatory Update?'}
              </span>
              <span
                className={`text-xs font-bold inline-block px-2 py-0.5 rounded-full mt-1 ${
                  currentLiveRelease.forceUpdate
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {currentLiveRelease.forceUpdate
                  ? language === 'bn' ? 'হ্যাঁ (বাধ্যতামূলক)' : 'Yes (Required)'
                  : language === 'bn' ? 'না (ঐচ্ছিক)' : 'No (Optional)'}
              </span>
            </div>

            <div className="sm:col-span-2 lg:col-span-4 bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] text-slate-500 block font-semibold">
                  {language === 'bn' ? 'APK ডাউনলোড লিঙ্ক' : 'APK Download URL'}
                </span>
                <a
                  href={currentLiveRelease.apkDownloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-sky-400 hover:text-sky-300 truncate block font-mono underline"
                >
                  {currentLiveRelease.apkDownloadUrl}
                </a>
                {currentLiveRelease.apkSha256 && (
                  <span className="text-[10px] font-mono text-emerald-400/90 mt-1 block truncate">
                    SHA-256: {currentLiveRelease.apkSha256}
                  </span>
                )}
              </div>
              <a
                href={currentLiveRelease.apkDownloadUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1.5 cursor-pointer self-start sm:self-auto border border-slate-700"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'ডাউনলোড চেক করুন' : 'Test Download'}</span>
              </a>
            </div>

            {(currentLiveRelease.changelogBn || currentLiveRelease.changelogEn) && (
              <div className="sm:col-span-2 lg:col-span-4 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block font-semibold mb-1">
                  {language === 'bn' ? 'রিলিজ নোট ও পরিবর্তন' : 'Release Notes & Changelog'}
                </span>
                <p className="text-xs text-slate-300 whitespace-pre-wrap">
                  {language === 'bn'
                    ? currentLiveRelease.changelogBn || currentLiveRelease.changelogEn
                    : currentLiveRelease.changelogEn || currentLiveRelease.changelogBn}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="py-6 text-center text-slate-500 text-xs">
            {language === 'bn'
              ? 'এখনো কোনো রিলিজ প্রকাশ করা হয়নি। নিচে তথ্য দিয়ে প্রথম রিলিজ প্রকাশ করুন।'
              : 'No release published yet. Fill in the form below to publish your first release.'}
          </div>
        )}
      </div>

      {/* Publish New Release Form */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Rocket className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              {language === 'bn' ? 'নতুন APK রিলিজ প্রকাশ ফর্ম' : 'Publish New APK Release'}
            </h4>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            {language === 'bn' ? 'শুধুমাত্র সুপার অ্যাডমিন' : 'Super Admin Only'}
          </span>
        </div>

        <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-3 flex items-start gap-2.5 text-xs text-slate-300">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-emerald-300 block mb-0.5">
              {language === 'bn' ? 'সিকিউর URL ও SHA-256 ভেরিফিকেশন' : 'Strict Domain Allowlist & SHA-256 Integrity Check'}
            </span>
            <p className="text-[11px] text-slate-400">
              {language === 'bn'
                ? `নিরাপত্তার জন্য শুধুমাত্র অনুমোদিত GitHub Releases লিঙ্ক (${ALLOWED_APK_URL_PREFIX}) অনুমোদিত। SHA-256 দিলে ফোনে ডাউনলোডের পর হ্যাশ যাচাই করে তবেই ইনস্টল হবে।`
                : `Only official GitHub Releases URLs (${ALLOWED_APK_URL_PREFIX}) are accepted. Supplying the 64-char SHA-256 digest enables native binary verification prior to install.`}
            </p>
          </div>
        </div>

        <form onSubmit={onPublishRelease} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold block">
                {language === 'bn' ? 'সংস্করণ নাম (Version Name)' : 'Version Name'} *
              </label>
              <input
                type="text"
                placeholder="e.g. 1.0.6"
                value={releaseVersionName}
                onChange={(e) => setReleaseVersionName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-semibold block">
                {language === 'bn' ? 'বিল্ড কোড (Version Code)' : 'Version Code'} *
              </label>
              <input
                type="number"
                placeholder="e.g. 106"
                value={releaseVersionCode}
                onChange={(e) => setReleaseVersionCode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-semibold block">
                {language === 'bn' ? 'ফাইল সাইজ (File Size)' : 'File Size'}
              </label>
              <input
                type="text"
                placeholder="e.g. 9.6 MB"
                value={releaseFileSizeText}
                onChange={(e) => setReleaseFileSizeText(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-slate-300 font-semibold block">
              {language === 'bn' ? 'সরাসরি APK ডাউনলোড লিঙ্ক (Direct APK URL)' : 'Direct APK Download URL'} *
            </label>
            <input
              type="url"
              placeholder={`${ALLOWED_APK_URL_PREFIX}latest/download/AnomahChat.apk`}
              value={releaseApkUrl}
              onChange={(e) => setReleaseApkUrl(e.target.value)}
              className={`w-full px-3 py-2 bg-slate-900 border rounded-xl text-white font-mono text-xs focus:outline-none ${
                releaseApkUrl && !urlValid ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-emerald-500'
              }`}
              required
            />
            {releaseApkUrl && !urlValid && (
              <span className="text-[11px] text-red-400 block">
                Must start with {ALLOWED_APK_URL_PREFIX}
              </span>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-slate-300 font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{language === 'bn' ? 'APK SHA-256 হ্যাশ (ঐচ্ছিক, কিন্তু অত্যন্ত নিরাপদ)' : 'APK SHA-256 Checksum (Optional, Recommended)'}</span>
            </label>
            <input
              type="text"
              maxLength={64}
              placeholder="64-character lowercase hex digest from GitHub Release notes"
              value={releaseApkSha256}
              onChange={(e) => setReleaseApkSha256(e.target.value.replace(/[^a-fA-F0-9]/g, '').toLowerCase())}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold block">
                {language === 'bn' ? 'পরিবর্তনসমূহ (বাংলা)' : 'Changelog (Bengali)'}
              </label>
              <textarea
                rows={3}
                placeholder="নতুন কি কি যোগ হয়েছে বা ফিক্স করা হয়েছে..."
                value={releaseChangelogBn}
                onChange={(e) => setReleaseChangelogBn(e.target.value)}
                className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-semibold block">
                {language === 'bn' ? 'পরিবর্তনসমূহ (English)' : 'Changelog (English)'}
              </label>
              <textarea
                rows={3}
                placeholder="What's new in this build..."
                value={releaseChangelogEn}
                onChange={(e) => setReleaseChangelogEn(e.target.value)}
                className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none text-xs"
              />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">
                {language === 'bn' ? 'বাধ্যতামূলক আপডেট (Force Update)' : 'Force / Mandatory Update'}
              </span>
              <span className="text-[11px] text-slate-400">
                {language === 'bn'
                  ? 'অন করলে ইউজাররা আপডেট না করা পর্যন্ত পুরনো অ্যাপ ব্যবহার করতে পারবে না।'
                  : 'If enabled, users must update to this release before they can proceed using the app.'}
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={releaseForceUpdate}
                onChange={(e) => setReleaseForceUpdate(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={publishingRelease || !releaseVersionName.trim() || !releaseVersionCode || !urlValid}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow flex items-center gap-2 cursor-pointer"
            >
              {publishingRelease ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{language === 'bn' ? 'রিলিজ প্রকাশিত হচ্ছে...' : 'Publishing Release...'}</span>
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4" />
                  <span>{language === 'bn' ? 'নতুন রিলিজ লাইভ করুন' : 'Publish Release Live'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
