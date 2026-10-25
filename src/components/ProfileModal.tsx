import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { isUsernameAvailable } from '../services/chatService';
import type { ThemeMode } from '../types/chat';
import {
  X,
  Check,
  User,
  Shield,
  Palette,
  Trash2,
  Lock,
  Mail,
  AlertCircle,
  Eye,
  EyeOff,
  AtSign,
  Sun,
  Moon,
  Compass,
  Languages,
} from 'lucide-react';

export function ProfileModal({ onClose }: { onClose: () => void }) {
  const {
    user,
    firebaseUser,
    updateProfile,
    changePassword,
    sendPasswordReset,
    theme,
    setTheme,
    requestAccountDeletion,
  } = useAuth();

  const { language, setLanguage, t } = useLanguage();

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'appearance' | 'language' | 'danger'>('profile');

  // Profile Fields
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [about, setAbout] = useState(user?.about || 'Available | Using Anomah Chat');
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');

  // Security Fields
  const [username, setUsername] = useState(user?.username || '');
  const [secretPin, setSecretPin] = useState(user?.secretPin || '');
  const [showPin, setShowPin] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  // Password Change Fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Account Deletion Confirmation
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [confirmDeleteModal, setConfirmDeleteModal] = useState(false);

  // Status & Messages
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const presetAvatars = [
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.displayName || 'Avatar1'}`,
    `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.displayName || 'Bot1'}`,
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  ];

  // Check username availability with debounce
  useEffect(() => {
    const clean = username.trim().toLowerCase().replace(/^@/, '');
    if (!clean || clean === (user?.username || '')) {
      setUsernameStatus('idle');
      return;
    }
    if (clean.length < 3) {
      setUsernameStatus('idle');
      return;
    }

    setUsernameStatus('checking');
    const timer = setTimeout(async () => {
      const avail = await isUsernameAvailable(clean, user?.userId);
      setUsernameStatus(avail ? 'available' : 'taken');
    }, 400);

    return () => clearTimeout(timer);
  }, [username, user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
      if (cleanUsername && cleanUsername !== user?.username) {
        if (cleanUsername.length < 3) {
          throw new Error(t('usernameMinLength'));
        }
        const avail = await isUsernameAvailable(cleanUsername, user?.userId);
        if (!avail) {
          throw new Error(t('usernameTakenError'));
        }
      }

      if (secretPin.trim() && secretPin.trim().length < 4) {
        throw new Error(t('pinMinLengthError'));
      }

      await updateProfile(displayName, about, photoURL, cleanUsername, secretPin.trim());
      setSuccessMessage(t('profileSavedSuccess'));
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : t('profileUpdateError'));
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (newPassword.length < 6) {
      setErrorMessage(t('passwordMinLengthError'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage(t('passwordMismatchError'));
      return;
    }

    setSaving(true);
    try {
      await changePassword(newPassword);
      setSuccessMessage(t('passwordChangedSuccess'));
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to change password.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!user?.email) return;
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await sendPasswordReset(user.email);
      setSuccessMessage(t('recoveryEmailSent', { email: user.email }));
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : t('recoveryEmailFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleAccountDeletion = async () => {
    if (deleteConfirmationText.trim().toUpperCase() !== 'DELETE') {
      setErrorMessage(t('confirmDeleteErrorText'));
      return;
    }

    setSaving(true);
    try {
      await requestAccountDeletion();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete account.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between shrink-0 bg-slate-900/95">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <span>{t('settingsTitle')}</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-mono">
              {t('versionBadge')}
            </span>
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 p-1 gap-1 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0 ${
              activeTab === 'profile'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>{t('tabProfile')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex-1 py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0 ${
              activeTab === 'security'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>{t('tabSecurity')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('appearance')}
            className={`flex-1 py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0 ${
              activeTab === 'appearance'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>{t('tabAppearance')}</span>
          </button>

          {/* Dedicated Language Settings Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('language')}
            className={`flex-1 py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0 ${
              activeTab === 'language'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Languages className="w-3.5 h-3.5" />
            <span>{t('tabLanguage')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('danger')}
            className={`py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0 ${
              activeTab === 'danger'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-red-400 hover:bg-red-500/10'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('tabDanger')}</span>
          </button>
        </div>

        {/* Alerts */}
        {successMessage && (
          <div className="mx-4 mt-3 p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mx-4 mt-3 p-3 bg-red-500/15 border border-red-500/30 text-red-300 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* TAB 1: Profile */}
          {activeTab === 'profile' && (
            <form id="profile-form" onSubmit={handleSaveProfile} className="space-y-4">
              <div className="flex flex-col items-center gap-3">
                <div className="relative group">
                  <img
                    src={photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.userId}`}
                    alt={displayName}
                    className="w-20 h-20 rounded-full object-cover border-2 border-emerald-500 bg-slate-800 shadow-lg"
                  />
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-[10px] text-white">
                    {t('avatarLabel')}
                  </div>
                </div>

                <div className="text-center">
                  <h3 className="text-sm font-bold text-white">{displayName || t('noName')}</h3>
                  <p className="text-xs text-slate-400">{user?.email}</p>
                </div>
              </div>

              {/* Preset Avatars */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  {t('chooseAvatar')}
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {presetAvatars.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPhotoURL(url)}
                      className={`relative rounded-xl overflow-hidden aspect-square border-2 transition cursor-pointer ${
                        photoURL === url ? 'border-emerald-500 scale-105' : 'border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      <img src={url} alt={`Preset ${i}`} className="w-full h-full object-cover bg-slate-800" />
                      {photoURL === url && (
                        <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">{t('displayNameLabel')}</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                  placeholder={t('displayNamePlaceholder')}
                  required
                />
              </div>

              {/* About / Bio */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">{t('aboutLabel')}</label>
                <input
                  type="text"
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                  placeholder={t('aboutPlaceholder')}
                  maxLength={150}
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={saving || !displayName.trim()}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 shadow-md"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{saving ? t('saving') : t('saveProfileBtn')}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: Security & PIN */}
          {activeTab === 'security' && (
            <div className="space-y-5">
              {/* Username & Secret PIN Form */}
              <div className="p-3.5 bg-slate-800/60 border border-slate-700/70 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-white text-xs font-bold pb-2 border-b border-slate-700/60">
                  <AtSign className="w-4 h-4 text-emerald-400" />
                  <span>{t('usernamePinConfigTitle')}</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">{t('uniqueUsernameLabel')}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400">@</span>
                    <input
                      type="text"
                      placeholder={t('usernamePlaceholder')}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition lowercase"
                    />
                  </div>
                  {usernameStatus === 'checking' && (
                    <span className="text-[10px] text-slate-400 mt-1 block">{t('checkingUsername')}</span>
                  )}
                  {usernameStatus === 'available' && (
                    <span className="text-[10px] text-emerald-400 mt-1 block">{t('usernameAvailable')}</span>
                  )}
                  {usernameStatus === 'taken' && (
                    <span className="text-[10px] text-red-400 mt-1 block">{t('usernameTaken')}</span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t('secretPinLabel')}
                  </label>
                  <div className="relative">
                    <input
                      type={showPin ? 'text' : 'password'}
                      placeholder={t('secretPinPlaceholder')}
                      value={secretPin}
                      onChange={(e) => setSecretPin(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                      maxLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-white cursor-pointer"
                    >
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {t('secretPinHelpText')}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{t('updatePinUsernameBtn')}</span>
                </button>
              </div>

              {/* Password Change Form */}
              {firebaseUser && (
                <div className="p-3.5 bg-slate-800/60 border border-slate-700/70 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-white text-xs font-bold pb-2 border-b border-slate-700/60">
                    <Lock className="w-4 h-4 text-emerald-400" />
                    <span>{t('passwordChangeTitle')}</span>
                  </div>

                  <form onSubmit={handleChangePassword} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">{t('newPasswordLabel')}</label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          placeholder={t('newPasswordPlaceholder')}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 transition"
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-white cursor-pointer"
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">{t('confirmPasswordLabel')}</label>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder={t('confirmPasswordPlaceholder')}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 transition"
                        minLength={6}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={saving || !newPassword || !confirmPassword}
                      className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                    >
                      <span>{t('changePasswordBtn')}</span>
                    </button>
                  </form>

                  {/* Send Password Recovery Link */}
                  <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">{t('forgotPasswordQuestion')}</span>
                    <button
                      type="button"
                      onClick={handleSendResetEmail}
                      disabled={saving}
                      className="px-3 py-1.5 bg-teal-600/30 hover:bg-teal-600/40 border border-teal-500/40 text-teal-300 rounded-xl text-xs font-medium flex items-center gap-1.5 cursor-pointer transition disabled:opacity-50"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>{t('sendRecoveryEmailBtn')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Appearance & Themes */}
          {activeTab === 'appearance' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-white mb-1">{t('appearanceTitle')}</h4>
                <p className="text-[11px] text-slate-400">
                  {t('appearanceSubtitle')}
                </p>
              </div>

              <div className="space-y-2.5">
                {/* Theme 1: Deep Slate (Midnight Dark) */}
                <div
                  onClick={() => setTheme('deep-slate')}
                  className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                    theme === 'deep-slate'
                      ? 'bg-slate-800 border-emerald-500 shadow-md ring-1 ring-emerald-500/30'
                      : 'bg-slate-800/40 hover:bg-slate-800/80 border-slate-700/70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-emerald-400">
                      <Moon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{t('themeDeepSlateName')}</div>
                      <div className="text-[11px] text-slate-400">
                        {t('themeDeepSlateDesc')}
                      </div>
                    </div>
                  </div>
                  {theme === 'deep-slate' && <Check className="w-4 h-4 text-emerald-400" />}
                </div>

                {/* Theme 2: Minimal Light */}
                <div
                  onClick={() => setTheme('minimal-light')}
                  className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                    theme === 'minimal-light'
                      ? 'bg-slate-800 border-emerald-500 shadow-md ring-1 ring-emerald-500/30'
                      : 'bg-slate-800/40 hover:bg-slate-800/80 border-slate-700/70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white text-slate-900 flex items-center justify-center">
                      <Sun className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{t('themeMinimalLightName')}</div>
                      <div className="text-[11px] text-slate-400">
                        {t('themeMinimalLightDesc')}
                      </div>
                    </div>
                  </div>
                  {theme === 'minimal-light' && <Check className="w-4 h-4 text-emerald-400" />}
                </div>

                {/* Theme 3: Telegram Blue */}
                <div
                  onClick={() => setTheme('telegram-blue')}
                  className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                    theme === 'telegram-blue'
                      ? 'bg-slate-800 border-emerald-500 shadow-md ring-1 ring-emerald-500/30'
                      : 'bg-slate-800/40 hover:bg-slate-800/80 border-slate-700/70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#242f3d] border border-blue-400/30 flex items-center justify-center text-sky-400">
                      <Compass className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{t('themeTelegramBlueName')}</div>
                      <div className="text-[11px] text-slate-400">
                        {t('themeTelegramBlueDesc')}
                      </div>
                    </div>
                  </div>
                  {theme === 'telegram-blue' && <Check className="w-4 h-4 text-emerald-400" />}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Language Settings */}
          {activeTab === 'language' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-white mb-1">{t('languageSettingsTitle')}</h4>
                <p className="text-[11px] text-slate-400">
                  {t('languageSettingsSubtitle')}
                </p>
              </div>

              <div className="space-y-3">
                {/* Language 1: English (Standard Default) */}
                <div
                  onClick={() => setLanguage('en')}
                  className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                    language === 'en'
                      ? 'bg-slate-800 border-emerald-500 shadow-md ring-1 ring-emerald-500/30'
                      : 'bg-slate-800/40 hover:bg-slate-800/80 border-slate-700/70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center font-bold text-sm text-emerald-400">
                      EN
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>{t('langEnglishName')}</span>
                        {language === 'en' && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold">
                            {t('currentLanguageBadge')}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {t('langEnglishDesc')}
                      </div>
                    </div>
                  </div>
                  {language === 'en' && (
                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  )}
                </div>

                {/* Language 2: Bengali (বাংলা) */}
                <div
                  onClick={() => setLanguage('bn')}
                  className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                    language === 'bn'
                      ? 'bg-slate-800 border-emerald-500 shadow-md ring-1 ring-emerald-500/30'
                      : 'bg-slate-800/40 hover:bg-slate-800/80 border-slate-700/70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-800/60 flex items-center justify-center font-bold text-sm text-emerald-300">
                      বাং
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>{t('langBengaliName')}</span>
                        {language === 'bn' && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold">
                            {t('currentLanguageBadge')}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {t('langBengaliDesc')}
                      </div>
                    </div>
                  </div>
                  {language === 'bn' && (
                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Account Deletion (Danger Zone with 15-day recovery) */}
          {activeTab === 'danger' && (
            <div className="space-y-4">
              <div className="p-4 bg-red-950/40 border border-red-500/40 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-red-400 font-bold text-xs">
                  <AlertCircle className="w-4 h-4" />
                  <span>{t('dangerZoneTitle')}</span>
                </div>

                <div className="text-xs text-red-200/90 leading-relaxed space-y-2">
                  <p>{t('dangerZoneP1')}</p>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-red-300/80">
                    <li>{t('dangerZoneL1')}</li>
                    <li>{t('dangerZoneL2')}</li>
                    <li>{t('dangerZoneL3')}</li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => setConfirmDeleteModal(true)}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-lg shadow-red-900/30 flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('scheduleDeletionBtn')}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0">
          <div className="text-[10px] text-slate-500">
            <span>Anomah Chat • <strong>{t('versionBadge')}</strong></span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium cursor-pointer"
          >
            {t('close')}
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Account Deletion */}
      {confirmDeleteModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-red-500/40 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-sm font-bold text-white mb-1">{t('confirmDeleteModalTitle')}</h3>
              <p className="text-xs text-slate-400">
                {t('confirmDeleteModalDesc')}
              </p>
            </div>

            <input
              type="text"
              placeholder={t('typeDeletePlaceholder')}
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-800 border border-red-500/50 rounded-xl text-xs text-white text-center font-bold tracking-widest focus:outline-none uppercase"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmDeleteModal(false);
                  setDeleteConfirmationText('');
                }}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleAccountDeletion}
                disabled={saving || deleteConfirmationText.trim().toUpperCase() !== 'DELETE'}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40 transition"
              >
                {saving ? t('saving') : t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
