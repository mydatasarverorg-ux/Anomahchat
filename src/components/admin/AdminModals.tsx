import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  KeyRound,
  Lock,
  MessageSquare,
  ShieldOff,
  X,
} from 'lucide-react';
import type { PasswordRecoveryRequest, UserProfile } from '../../types/chat';

interface AdminModalsProps {
  t: (key: any) => string;
  language: string;
  copiedText: string | null;
  onCopy: (text: string) => void;

  // Dossier Modal
  selectedDossierUser: UserProfile | null;
  onCloseDossier: () => void;
  onConfirmUnban: (u: UserProfile) => void;
  onInspectUserChats: (u: UserProfile) => void;
  onEnterGhostMode?: (u: UserProfile) => void;
  isClearingLock: boolean;
  onClearUserAppLock: () => void;
  get7DayActivity: (u: UserProfile) => { days: { dateStr: string; label: string; minutes: number }[]; maxVal: number };

  // Recovery Modal
  selectedRecovery: PasswordRecoveryRequest | null;
  onCloseRecovery: () => void;
  recoveryAdminNotes: string;
  setRecoveryAdminNotes: (v: string) => void;
  resolvingRecovery: boolean;
  onResolveRecovery: (e: React.FormEvent) => void;

  // Ban Modal
  banTarget: UserProfile | null;
  onCloseBan: () => void;
  banDuration: '1' | '3' | '7' | '30' | 'permanent';
  setBanDuration: (v: '1' | '3' | '7' | '30' | 'permanent') => void;
  banReason: string;
  setBanReason: (v: string) => void;
  isBanning: boolean;
  onConfirmBan: () => void;

  // Warn Modal
  warnTarget: UserProfile | null;
  onCloseWarn: () => void;
  warnText: string;
  setWarnText: (v: string) => void;
  isWarning: boolean;
  onConfirmWarn: () => void;
}

export function AdminModals({
  t,
  language,
  copiedText,
  onCopy,
  selectedDossierUser,
  onCloseDossier,
  onConfirmUnban,
  onInspectUserChats,
  onEnterGhostMode,
  isClearingLock,
  onClearUserAppLock,
  get7DayActivity,
  selectedRecovery,
  onCloseRecovery,
  recoveryAdminNotes,
  setRecoveryAdminNotes,
  resolvingRecovery,
  onResolveRecovery,
  banTarget,
  onCloseBan,
  banDuration,
  setBanDuration,
  banReason,
  setBanReason,
  isBanning,
  onConfirmBan,
  warnTarget,
  onCloseWarn,
  warnText,
  setWarnText,
  isWarning,
  onConfirmWarn,
}: AdminModalsProps) {
  return (
    <>
      {selectedDossierUser && (
        <div className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-3 sm:p-4 animate-in fade-in select-none">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto space-y-4">
            <button
              onClick={onCloseDossier}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="relative">
                <img
                  src={selectedDossierUser.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${selectedDossierUser.userId}`}
                  alt={selectedDossierUser.displayName}
                  className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500 bg-slate-800 shadow"
                />
                {selectedDossierUser.isOnline && (
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-950" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold text-white truncate">{selectedDossierUser.displayName}</h4>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedDossierUser.isOnline ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {selectedDossierUser.isOnline ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
                <div className="text-xs text-slate-400 truncate">{selectedDossierUser.email}</div>
                {selectedDossierUser.username && (
                  <div className="text-[11px] text-emerald-400 font-mono">@{selectedDossierUser.username}</div>
                )}
              </div>
            </div>

            {selectedDossierUser.isBanned && (
              <div className="bg-red-950/40 border border-red-500/40 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="text-xs font-bold text-red-300 uppercase tracking-wider">
                      {selectedDossierUser.bannedUntil
                        ? language === 'bn' ? 'অ্যাকাউন্ট সাময়িক স্থগিত' : 'Account Temporarily Suspended'
                        : t('suspensionPermanentNotice')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    <span className="font-semibold text-slate-400">{language === 'bn' ? 'কারণ: ' : 'Reason: '}</span>
                    {selectedDossierUser.banReason || 'Platform guidelines violation.'}
                  </p>
                  {selectedDossierUser.bannedUntil && (
                    <p className="text-[11px] text-amber-300/90 font-mono">
                      {t('suspensionExpiresAt').replace('{date}', new Date(selectedDossierUser.bannedUntil).toLocaleString())}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onConfirmUnban(selectedDossierUser)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow shrink-0"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t('unsuspendUserBtn')}</span>
                </button>
              </div>
            )}

            <div className="bg-sky-950/40 border border-sky-500/30 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-white block truncate">
                    {t('inspectUserChatsAction').replace('{name}', selectedDossierUser.displayName)}
                  </span>
                  <span className="text-[11px] text-slate-400 block truncate">
                    {language === 'bn'
                      ? 'কার সাথে কার সাথে চ্যাট আছে এবং বার্তাগুলো পর্যবেক্ষণ করুন'
                      : 'Review all direct and group conversations with message history'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <button
                  onClick={() => onInspectUserChats(selectedDossierUser)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 border border-slate-700"
                >
                  <MessageSquare className="w-4 h-4 text-sky-400" />
                  <span>{t('inspectUserChatsBtn')}</span>
                </button>

                {onEnterGhostMode && (
                  <button
                    onClick={() => onEnterGhostMode(selectedDossierUser)}
                    className="px-3.5 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow flex items-center gap-1.5"
                  >
                    <Eye className="w-4 h-4" />
                    <span>{t('enterDmInboxBtn')}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block font-semibold">{t('dossierUserId')}</span>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="font-mono text-slate-300 truncate max-w-[170px]">{selectedDossierUser.userId}</span>
                  <button
                    onClick={() => onCopy(selectedDossierUser.userId)}
                    className="p-1 text-slate-400 hover:text-white cursor-pointer"
                    title="Copy UID"
                  >
                    {copiedText === selectedDossierUser.userId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block font-semibold">{t('dossierSecretPin')}</span>
                <div className="flex items-center justify-between mt-1 gap-2">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                    selectedDossierUser.hasAppLockPin ? 'text-emerald-400' : 'text-slate-400'
                  }`}>
                    <Lock className="w-3.5 h-3.5" />
                    {selectedDossierUser.hasAppLockPin
                      ? language === 'bn' ? 'SHA-256 অ্যাপ-লক সক্রিয়' : 'SHA-256 App-Lock Active'
                      : t('pinNotConfigured')}
                  </span>
                  {selectedDossierUser.hasAppLockPin && (
                    <button
                      onClick={onClearUserAppLock}
                      disabled={isClearingLock}
                      className="px-2.5 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-lg text-[11px] font-semibold cursor-pointer flex items-center gap-1 transition"
                    >
                      <ShieldOff className="w-3 h-3" />
                      <span>{isClearingLock ? 'Clearing...' : language === 'bn' ? 'লক রিসেট' : 'Clear Lock'}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block font-semibold">{t('dossierLastLogin')}</span>
                <span className="text-slate-300">
                  {selectedDossierUser.lastLoginAt ? new Date(selectedDossierUser.lastLoginAt).toLocaleString() : selectedDossierUser.lastSeen ? new Date(selectedDossierUser.lastSeen).toLocaleString() : 'N/A'}
                </span>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block font-semibold">{t('dossierLastExit')}</span>
                <span className="text-slate-300">
                  {selectedDossierUser.lastExitAt ? new Date(selectedDossierUser.lastExitAt).toLocaleString() : selectedDossierUser.isOnline ? 'Currently Active' : 'N/A'}
                </span>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    {t('activityChartTitle')}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Total: {selectedDossierUser.totalActiveMinutes || 0} mins
                </span>
              </div>

              {(() => {
                const { days, maxVal } = get7DayActivity(selectedDossierUser);
                return (
                  <div className="pt-3">
                    <div className="flex items-end justify-between gap-2 h-28 px-1 border-b border-slate-800 pb-2">
                      {days.map((item, idx) => {
                        const heightPct = Math.max(8, Math.min(100, (item.minutes / maxVal) * 100));
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                            <span className="text-[9px] font-mono text-emerald-300 opacity-80 group-hover:opacity-100 transition">
                              {item.minutes}m
                            </span>
                            <div className="w-full bg-slate-900 rounded-t-md h-full flex items-end overflow-hidden max-w-[36px]">
                              <div
                                style={{ height: `${heightPct}%` }}
                                className="w-full bg-gradient-to-t from-emerald-600 to-teal-400 rounded-t-md transition-all duration-300 group-hover:brightness-125"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between px-1 pt-1.5 text-[10px] text-slate-400 font-medium">
                      {days.map((item, idx) => (
                        <div key={idx} className="flex-1 text-center truncate">
                          {item.label}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {selectedRecovery && (
        <div className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4 select-none">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-amber-400">
                <KeyRound className="w-5 h-5" />
                <h4 className="text-sm font-bold text-white">{t('resolveRecoveryBtn')}</h4>
              </div>
              <button onClick={onCloseRecovery} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Applicant: <strong className="text-white">{selectedRecovery.email}</strong>
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
              {language === 'bn'
                ? 'নিরাপত্তার জন্য প্লেনটেক্সট পাসওয়ার্ড বা পিন সংরক্ষণ বন্ধ করা হয়েছে। প্রয়োজনে Dossier থেকে App-Lock রিসেট করুন এবং ইউজারকে Forgot Password ইমেইল ব্যবহার করতে বলুন।'
                : 'Plaintext credential storage is disabled for security. If needed, clear App-Lock from the user dossier and guide the user to Firebase Password Reset email.'}
            </p>

            <form onSubmit={onResolveRecovery} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300 block">{t('adminNotesLabel')}</label>
                <textarea
                  rows={3}
                  placeholder={t('adminNotesPlaceholder')}
                  value={recoveryAdminNotes}
                  onChange={(e) => setRecoveryAdminNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 resize-none"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={onCloseRecovery}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs cursor-pointer hover:bg-slate-750"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={resolvingRecovery || !recoveryAdminNotes.trim()}
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold cursor-pointer shadow transition"
                >
                  {resolvingRecovery ? 'Saving...' : t('confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {banTarget && (
        <div className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/40 rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
              <h4 className="text-sm font-bold text-white">{t('banUserModalTitle')}</h4>
              <p className="text-xs text-slate-400">
                {banTarget.displayName} ({banTarget.email})
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-300 font-semibold block">{t('suspensionDurationLabel')}</label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: '1', label: t('duration1Day') },
                  { id: '3', label: t('duration3Days') },
                  { id: '7', label: t('duration7Days') },
                  { id: '30', label: t('duration30Days') },
                  { id: 'permanent', label: t('durationPermanent'), full: true },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setBanDuration(opt.id as '1' | '3' | '7' | '30' | 'permanent')}
                    className={`px-2.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer text-center ${
                      opt.full ? 'col-span-2' : ''
                    } ${
                      banDuration === opt.id
                        ? 'bg-red-600/25 border-red-500 text-white font-bold ring-1 ring-red-500/60'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-300 font-semibold block">{t('banReasonLabel')}</label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder={t('banReasonPlaceholder')}
                rows={3}
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCloseBan}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={onConfirmBan}
                disabled={isBanning}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                {isBanning ? 'Suspending...' : t('confirmBanBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {warnTarget && (
        <div className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <AlertOctagon className="w-10 h-10 text-amber-500 mx-auto" />
              <h4 className="text-sm font-bold text-white">{t('warnModalTitle')}</h4>
              <p className="text-xs text-slate-400">
                {warnTarget.displayName} ({warnTarget.email})
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-300 font-semibold block">{t('warningNoticeLabel')}</label>
              <textarea
                value={warnText}
                onChange={(e) => setWarnText(e.target.value)}
                placeholder={t('warningNoticePlaceholder')}
                rows={3}
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCloseWarn}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={onConfirmWarn}
                disabled={isWarning || !warnText.trim()}
                className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                {isWarning ? 'Sending...' : t('confirmWarnBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
