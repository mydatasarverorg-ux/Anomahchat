import {
  AtSign,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  MailCheck,
  Smartphone,
} from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import type { UserProfile } from '../../types/chat';

interface ProfileSecuritySectionProps {
  language: 'en' | 'bn';
  t: (key: any) => string;
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  hasPasswordProvider: boolean;
  saving: boolean;
  username: string;
  setUsername: (v: string) => void;
  usernameStatus: 'idle' | 'checking' | 'available' | 'taken';
  appLockPinInput: string;
  setAppLockPinInput: (v: string) => void;
  showPin: boolean;
  setShowPin: (v: boolean) => void;
  savedOnDevice: boolean;
  onToggleSavedOnDevice: () => void;
  currentPassword: string;
  setCurrentPassword: (v: string) => void;
  newPassword: string;
  setNewPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  showCurrentPassword: boolean;
  setShowCurrentPassword: (fn: (prev: boolean) => boolean) => void;
  showNewPassword: boolean;
  setShowNewPassword: (fn: (prev: boolean) => boolean) => void;
  onSaveSecurityAndPin: () => void;
  onLockAppNow: () => void;
  onRemoveAppLock: () => void;
  onChangePassword: (e: React.FormEvent) => void;
  onSendResetEmail: () => void;
  onResendVerification: () => Promise<void>;
}

export function ProfileSecuritySection({
  language,
  t,
  user,
  firebaseUser,
  hasPasswordProvider,
  saving,
  username,
  setUsername,
  usernameStatus,
  appLockPinInput,
  setAppLockPinInput,
  showPin,
  setShowPin,
  savedOnDevice,
  onToggleSavedOnDevice,
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  showCurrentPassword,
  setShowCurrentPassword,
  showNewPassword,
  setShowNewPassword,
  onSaveSecurityAndPin,
  onLockAppNow,
  onRemoveAppLock,
  onChangePassword,
  onSendResetEmail,
  onResendVerification,
}: ProfileSecuritySectionProps) {
  const bn = language === 'bn';

  return (
    <div className="space-y-5">
      {/* Section Title */}
      <div className="pb-3 border-b border-slate-800">
        <h4 className="text-sm font-bold text-white">{t('tabSecurity')}</h4>
        <p className="text-xs text-slate-400 mt-0.5">
          {bn
            ? 'ইমেইল ভেরিফিকেশন, ইউজারনেম, দ্রুত অ্যাপ-লক পিন এবং পাসওয়ার্ড পরিচালনা করুন।'
            : 'Manage email verification, username handle, quick App-Lock PIN, and password.'}
        </p>
      </div>

      {/* Email Verification & Shortcut Card (Grouped flat panel with hairline divider) */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl divide-y divide-slate-800/80">
        <div className="p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <MailCheck
              className={`w-4 h-4 shrink-0 ${
                firebaseUser?.emailVerified ? 'text-emerald-400' : 'text-amber-400'
              }`}
            />
            <div className="min-w-0">
              <div className="text-xs font-bold text-white">
                {firebaseUser?.emailVerified
                  ? bn
                    ? 'ইমেইল ভেরিফায়েড'
                    : 'Email Verified'
                  : bn
                  ? 'ইমেইল ভেরিফায়েড নয়'
                  : 'Email Not Verified'}
              </div>
              <div className="text-[11px] text-slate-400 truncate">{user?.email}</div>
            </div>
          </div>
          {!firebaseUser?.emailVerified && (
            <button
              type="button"
              onClick={onResendVerification}
              disabled={saving}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-[11px] font-bold shrink-0 cursor-pointer whitespace-nowrap"
            >
              {bn ? 'ভেরিফাই লিংক পাঠান' : 'Send Link'}
            </button>
          )}
        </div>

        <div className="p-4 flex items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Smartphone className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-white">
                {bn
                  ? 'এই ডিভাইসে অ্যাকাউন্ট শর্টকাট কার্ড সংরক্ষণ'
                  : 'Save Account Shortcut Card on This Device'}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                {bn
                  ? 'লগআউট করার পরও নাম ও মাস্কড ইমেইল কার্ড হিসেবে থাকবে (কোনো পাসওয়ার্ড বা পিন সেভ হয় না)।'
                  : 'Shows your masked profile card on the login screen for faster sign-in. Passwords and PINs are never saved.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={savedOnDevice}
            onClick={onToggleSavedOnDevice}
            className={`w-11 h-6 rounded-full transition relative shrink-0 cursor-pointer ${
              savedOnDevice ? 'bg-emerald-500' : 'bg-slate-700'
            }`}
          >
            <span
              className={`block w-4 h-4 bg-white rounded-full shadow transition-transform ${
                savedOnDevice ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Username & Quick App-Lock PIN */}
      <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-4">
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
          <span className="text-xs font-bold text-white">{t('usernamePinConfigTitle')}</span>
          {user?.hasAppLockPin && (
            <span className="text-[11px] font-semibold text-emerald-400 inline-flex items-center gap-1">
              <KeyRound className="w-3.5 h-3.5" />
              {bn ? 'অ্যাপ-লক চালু' : 'PIN Active'}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Unique Username */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              {t('uniqueUsernameLabel')}
            </label>
            <div className="relative">
              <AtSign className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('usernamePlaceholder')}
                className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="text-[11px] min-h-[16px]">
              {usernameStatus === 'checking' && (
                <span className="text-slate-400">{t('checkingUsername')}</span>
              )}
              {usernameStatus === 'available' && (
                <span className="text-emerald-400">{t('usernameAvailable')}</span>
              )}
              {usernameStatus === 'taken' && (
                <span className="text-rose-400">{t('usernameTaken')}</span>
              )}
            </div>
          </div>

          {/* Quick App-Lock PIN */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              {t('secretPinLabel')}
            </label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                value={appLockPinInput}
                onChange={(e) =>
                  setAppLockPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder={
                  user?.hasAppLockPin
                    ? bn
                      ? 'নতুন ৪-৬ ডিজিট পিন'
                      : 'New 4-6 digit PIN'
                    : t('secretPinPlaceholder')
                }
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono tracking-widest"
                maxLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white cursor-pointer"
              >
                {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              {bn
                ? 'অ্যাপ খুললে ৪-৬ ডিজিটের পিন দিয়ে ১ ক্লিকে আনলক হবে।'
                : 'Unlock messenger in 1 tap with your 4-6 digit PIN.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onSaveSecurityAndPin}
            disabled={
              saving ||
              (!appLockPinInput.trim() &&
                username.trim().toLowerCase() === (user?.username || ''))
            }
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold disabled:opacity-50 cursor-pointer transition"
          >
            {saving ? t('saving') : t('updatePinUsernameBtn')}
          </button>

          {user?.hasAppLockPin && (
            <>
              <button
                type="button"
                onClick={onLockAppNow}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium cursor-pointer transition inline-flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>{bn ? 'এখনই লক করুন' : 'Lock Now'}</span>
              </button>

              <button
                type="button"
                onClick={onRemoveAppLock}
                disabled={saving}
                className="px-3 py-2 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-medium cursor-pointer transition"
              >
                {bn ? 'পিন বন্ধ করুন' : 'Remove PIN'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Password Change / Recovery */}
      <form
        onSubmit={onChangePassword}
        className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3.5"
      >
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('passwordChangeTitle')}</span>
          </h4>
          {hasPasswordProvider && (
            <span className="text-[11px] text-emerald-400 font-medium">
              {bn ? 'সুরক্ষিত যাচাইকরণ' : 'Verified Update'}
            </span>
          )}
        </div>

        {hasPasswordProvider ? (
          <>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-slate-300">
                  {t('currentPasswordLabel')} <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder={t('currentPasswordPlaceholder')}
                    autoComplete="current-password"
                    required
                    className="w-full px-3 py-2 pr-9 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                    aria-label="Toggle current password visibility"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-300">
                    {t('newPasswordLabel')} <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t('newPasswordPlaceholder')}
                      autoComplete="new-password"
                      minLength={6}
                      required
                      className="w-full px-3 py-2 pr-9 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                      aria-label="Toggle new password visibility"
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-300">
                    {t('confirmPasswordLabel')} <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('confirmPasswordPlaceholder')}
                    autoComplete="new-password"
                    minLength={6}
                    required
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={onSendResetEmail}
                disabled={saving}
                className="text-[11px] text-emerald-400 hover:underline disabled:opacity-50 cursor-pointer text-left"
              >
                {t('forgotCurrentPasswordBtn')}
              </button>
              <button
                type="submit"
                disabled={
                  saving || !currentPassword || newPassword.length < 6 || !confirmPassword
                }
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold disabled:opacity-50 cursor-pointer transition"
              >
                {saving ? t('saving') : t('changePasswordBtn')}
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-300 leading-relaxed">
              {t('googleOnlyPasswordNotice')}
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onSendResetEmail}
                disabled={saving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold disabled:opacity-50 cursor-pointer transition"
              >
                {saving ? t('saving') : t('sendSetPasswordEmailBtn')}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
