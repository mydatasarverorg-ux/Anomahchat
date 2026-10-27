import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { isUsernameAvailable } from '../services/chatService';
import { isSuperAdmin } from '../services/adminService';
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
  ExternalLink,
  ArrowLeft,
} from 'lucide-react';

export function ProfileModal({
  onClose,
  onOpenAdmin,
}: {
  onClose: () => void;
  onOpenAdmin?: () => void;
}) {
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

  // Intercept mobile hardware / browser back button & Esc key
  useEffect(() => {
    window.history.pushState({ modal: 'profileModal' }, '');
    const handlePopState = () => {
      onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

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

      await updateProfile(
        displayName.trim(),
        about.trim(),
        photoURL,
        cleanUsername || undefined,
        secretPin ? secretPin.trim() : undefined
      );

      setSuccessMessage(t('profileSavedSuccess'));
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('profileUpdateError');
      setErrorMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePin = async () => {
    if (secretPin.length < 4 || secretPin.length > 6) {
      setErrorMessage(t('pinMinLengthError'));
      return;
    }
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await updateProfile(
        user?.displayName || displayName,
        user?.about || about,
        user?.photoURL || photoURL,
        user?.username || username,
        secretPin.trim()
      );
      setSuccessMessage(t('profileSavedSuccess'));
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('profileUpdateError');
      setErrorMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setErrorMessage(t('passwordMinLengthError'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage(t('passwordMismatchError'));
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await changePassword(newPassword);
      setSuccessMessage(t('passwordChangedSuccess'));
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update password.';
      setErrorMessage(msg);
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
      const msg = err instanceof Error ? err.message : t('recoveryEmailFailed');
      setErrorMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmScheduleDelete = async () => {
    if (deleteConfirmationText.trim().toUpperCase() !== 'DELETE') {
      setErrorMessage(t('confirmDeleteErrorText'));
      return;
    }
    setSaving(true);
    setErrorMessage(null);
    try {
      await requestAccountDeletion();
      setConfirmDeleteModal(false);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to schedule deletion.';
      setErrorMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-2xl h-[85vh] max-h-[700px] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="h-14 px-4 sm:px-5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer border border-slate-750"
              title={t('backToMessenger')}
            >
              <ArrowLeft className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">{t('backToMessenger')}</span>
              <span className="sm:hidden">{t('close')}</span>
            </button>
            <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <span>{t('settingsTitle')}</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title={t('close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Master Settings Layout (Sidebar Navigation + Content Area) */}
        <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
          {/* Settings Sidebar */}
          <div className="w-full sm:w-56 bg-slate-950/50 border-b sm:border-b-0 sm:border-r border-slate-800 p-2 sm:p-3 space-y-1 shrink-0 overflow-x-auto sm:overflow-y-auto">
            {/* User Mini Badge */}
            <div className="hidden sm:flex items-center gap-2.5 p-2 mb-2 rounded-xl bg-slate-900 border border-slate-800/80">
              <img
                src={photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.userId}`}
                alt={displayName}
                className="w-8 h-8 rounded-full object-cover bg-slate-800 border border-slate-700"
              />
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-white block truncate">{displayName}</span>
                <span className="text-[10px] text-slate-400 block truncate">{user?.email}</span>
              </div>
            </div>

            {/* Navigation Items */}
            <div className="flex sm:flex-col gap-1 overflow-x-auto sm:overflow-visible">
              {[
                { id: 'profile', label: t('tabProfile'), icon: User },
                { id: 'security', label: t('tabSecurity'), icon: Shield },
                { id: 'appearance', label: t('tabAppearance'), icon: Palette },
                { id: 'language', label: t('tabLanguage'), icon: Languages },
                { id: 'danger', label: t('tabDanger'), icon: Trash2, danger: true },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 sm:w-full text-left ${
                      isActive
                        ? item.danger
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : item.danger
                        ? 'text-rose-400 hover:bg-rose-500/10'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}

              {/* Super Admin Special Item (Only visible for chinisdramaorg@gmail.com) */}
              {isSuperAdmin(user?.email) && onOpenAdmin && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenAdmin();
                  }}
                  className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-emerald-400 hover:bg-emerald-950/40 border border-emerald-500/20 transition cursor-pointer shrink-0 sm:w-full mt-2"
                >
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span>{t('superAdminBadge')}</span>
                  </div>
                  <ExternalLink className="w-3 h-3 text-emerald-400 opacity-80" />
                </button>
              )}
            </div>
          </div>

          {/* Settings Content Pane */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-900/60 flex flex-col justify-between">
            <div>
              {/* Feedback Alerts */}
              {successMessage && (
                <div className="mb-4 p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{successMessage}</span>
                </div>
              )}

              {errorMessage && (
                <div className="mb-4 p-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* TAB 1: Profile Info */}
              {activeTab === 'profile' && (
                <form id="profile-form" onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="flex items-center gap-4 pb-2 border-b border-slate-800">
                    <img
                      src={photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.userId}`}
                      alt={displayName}
                      className="w-16 h-16 rounded-full object-cover border-2 border-emerald-500 bg-slate-800 shadow-md shrink-0"
                    />
                    <div>
                      <h4 className="text-sm font-bold text-white">{displayName || t('noName')}</h4>
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
                        <img
                          key={i}
                          src={url}
                          alt="Avatar option"
                          onClick={() => setPhotoURL(url)}
                          className={`w-10 h-10 rounded-full object-cover cursor-pointer border-2 transition hover:scale-105 ${
                            photoURL === url ? 'border-emerald-400 shadow-md ring-2 ring-emerald-500/30' : 'border-transparent opacity-70 hover:opacity-100'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Display Name */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-300">{t('displayNameLabel')}</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      placeholder={t('displayNamePlaceholder')}
                      required
                    />
                  </div>

                  {/* About / Bio */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-300">{t('aboutLabel')}</label>
                    <input
                      type="text"
                      value={about}
                      onChange={(e) => setAbout(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      placeholder={t('aboutPlaceholder')}
                      maxLength={150}
                    />
                  </div>
                </form>
              )}

              {/* TAB 2: Security & PIN */}
              {activeTab === 'security' && (
                <div className="space-y-4">
                  {/* Username & Secret PIN Form */}
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      {t('usernamePinConfigTitle')}
                    </h4>

                    {/* Unique Username */}
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-300">{t('uniqueUsernameLabel')}</label>
                      <div className="relative">
                        <AtSign className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder={t('usernamePlaceholder')}
                          className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
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

                    {/* Secret PIN */}
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-300">{t('secretPinLabel')}</label>
                      <div className="relative">
                        <input
                          type={showPin ? 'text' : 'password'}
                          value={secretPin}
                          onChange={(e) => setSecretPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder={t('secretPinPlaceholder')}
                          className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono tracking-widest"
                          maxLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPin(!showPin)}
                          className="absolute right-3 top-2 text-slate-400 hover:text-white"
                        >
                          {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400">{t('secretPinHelpText')}</p>
                    </div>

                    <button
                      type="button"
                      onClick={handleUpdatePin}
                      disabled={saving || secretPin.length < 4}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold disabled:opacity-50 cursor-pointer transition shadow"
                    >
                      {saving ? t('saving') : t('updatePinUsernameBtn')}
                    </button>
                  </div>

                  {/* Password Change / Recovery */}
                  <form onSubmit={handleChangePassword} className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      {t('passwordChangeTitle')}
                    </h4>

                    <div className="space-y-2">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder={t('newPasswordPlaceholder')}
                        className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={t('confirmPasswordPlaceholder')}
                        className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={handleSendResetEmail}
                        className="text-[11px] text-emerald-400 hover:underline cursor-pointer"
                      >
                        {t('sendRecoveryEmailBtn')}
                      </button>
                      <button
                        type="submit"
                        disabled={saving || !newPassword}
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50 cursor-pointer transition"
                      >
                        {t('changePasswordBtn')}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 3: Appearance / Themes */}
              {activeTab === 'appearance' && (
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-bold text-white">{t('appearanceTitle')}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">{t('appearanceSubtitle')}</p>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 pt-2">
                    {[
                      {
                        id: 'deep-slate' as ThemeMode,
                        nameKey: 'themeDeepSlateName',
                        descKey: 'themeDeepSlateDesc',
                        icon: Moon,
                        color: 'bg-slate-900 border-emerald-500/50',
                      },
                      {
                        id: 'minimal-light' as ThemeMode,
                        nameKey: 'themeMinimalLightName',
                        descKey: 'themeMinimalLightDesc',
                        icon: Sun,
                        color: 'bg-slate-800 border-sky-400/50',
                      },
                      {
                        id: 'telegram-blue' as ThemeMode,
                        nameKey: 'themeTelegramBlueName',
                        descKey: 'themeTelegramBlueDesc',
                        icon: Compass,
                        color: 'bg-[#0f172a] border-emerald-400/50',
                      },
                    ].map((item) => {
                      const Icon = item.icon;
                      const isSelected = theme === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => setTheme(item.id)}
                          className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-emerald-950/20 border-emerald-500 text-white shadow-sm'
                              : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-400 shrink-0">
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white">{t(item.nameKey as any)}</div>
                              <div className="text-[11px] text-slate-400">{t(item.descKey as any)}</div>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 4: Language Selection */}
              {activeTab === 'language' && (
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-bold text-white">{t('languageSettingsTitle')}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">{t('languageSettingsSubtitle')}</p>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 pt-2">
                    {[
                      { id: 'en' as const, nameKey: 'langEnglishName', descKey: 'langEnglishDesc' },
                      { id: 'bn' as const, nameKey: 'langBengaliName', descKey: 'langBengaliDesc' },
                    ].map((item) => {
                      const isSelected = language === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => setLanguage(item.id)}
                          className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-emerald-950/20 border-emerald-500 text-white shadow-sm'
                              : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-800/40'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-bold text-white">{t(item.nameKey as any)}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{t(item.descKey as any)}</div>
                          </div>
                          {isSelected && (
                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/30">
                              {t('currentLanguageBadge')}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 5: Danger Zone (Account Deletion) */}
              {activeTab === 'danger' && (
                <div className="p-4 bg-rose-950/20 border border-rose-900/40 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-rose-400">
                    <AlertCircle className="w-4 h-4" />
                    <h4 className="text-xs font-bold uppercase tracking-wider">{t('dangerZoneTitle')}</h4>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{t('dangerZoneP1')}</p>
                  <ul className="text-[11px] text-slate-400 space-y-1 list-disc pl-4">
                    <li>{t('dangerZoneL1')}</li>
                    <li>{t('dangerZoneL2')}</li>
                    <li>{t('dangerZoneL3')}</li>
                  </ul>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteModal(true)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow"
                  >
                    {t('scheduleDeletionBtn')}
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Form Actions for Profile Tab */}
            {activeTab === 'profile' && (
              <div className="pt-4 border-t border-slate-800 flex justify-end">
                <button
                  type="submit"
                  form="profile-form"
                  disabled={saving || !displayName.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{saving ? t('saving') : t('saveProfileBtn')}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Account Deletion Confirmation Modal */}
        {confirmDeleteModal && (
          <div className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-rose-500/40 rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4">
              <div className="text-center space-y-1">
                <h4 className="text-sm font-bold text-white">{t('confirmDeleteModalTitle')}</h4>
                <p className="text-xs text-slate-400">{t('confirmDeleteModalDesc')}</p>
              </div>
              <input
                type="text"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                placeholder={t('typeDeletePlaceholder')}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white text-center font-mono font-bold"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteModal(false)}
                  className="flex-1 py-1.5 bg-slate-800 text-slate-300 rounded-xl text-xs cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmScheduleDelete}
                  disabled={saving || deleteConfirmationText.trim().toUpperCase() !== 'DELETE'}
                  className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  {t('confirm')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
