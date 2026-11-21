import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useModalHistory } from '../hooks/useModalHistory';
import { isUsernameAvailable } from '../services/chatService';
import { isSuperAdmin, SUPER_ADMIN_EMAIL } from '../services/adminService';
import { validateMobileNumber } from '../utils/phoneUtils';
import { getPhoneSlotStatus, type PhoneSlotStatus } from '../services/phoneRegistryService';
import { PWAInstallButton } from './PWAInstallButton';
import type { ThemeMode } from '../types/chat';
import {
  X,
  Check,
  User,
  Shield,
  Palette,
  Trash2,
  Lock,
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
  RefreshCw,
  Loader2,
  MailCheck,
  KeyRound,
  Bell,
  Phone,
  QrCode,
  Smartphone,
  Laptop,
  LogOut,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Mail,
} from 'lucide-react';
import {
  isDeviceAccountSaved,
  saveDeviceAccount,
  removeSavedDeviceAccount,
} from '../utils/accountShortcut';
import { APP_VERSION, isUpdateAvailable, isNativeApkApp } from '../utils/appVersion';
import { getLatestRelease } from '../services/updateService';
import {
  isAppNotificationSupported,
  getAppNotificationPermission,
  requestAppNotificationPermission,
  type AppNotificationPermission,
} from '../services/notificationService';

export function ProfileModal({
  onClose,
  onOpenAdmin,
  onOpenShareQR,
  initialTab = 'profile',
}: {
  onClose: () => void;
  onOpenAdmin?: () => void;
  onOpenShareQR?: () => void;
  initialTab?: 'profile' | 'security' | 'appearance' | 'language' | 'danger';
}) {
  const {
    user,
    firebaseUser,
    updateProfile,
    setAppLockPin,
    clearAppLockPin,
    lockAppNow,
    resendVerificationEmail,
    changePassword,
    sendPasswordReset,
    theme,
    setTheme,
    requestAccountDeletion,
    userSessions,
    currentDeviceId,
    deviceLimitsSummary,
    isVerifiedSuperAdmin,
    approvePendingDevice,
    acknowledgeAdminAlert,
    blockDeviceWithVerification,
    trustOrUntrustDevice,
    logoutAllOtherDevices,
    removeDeviceHistoryItem,
    forceLogoutOtherDevice,
  } = useAuth();

  const { language, setLanguage, t } = useLanguage();
  const isUserSuperAdmin = isSuperAdmin(user?.email) && Boolean(firebaseUser?.emailVerified);

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'appearance' | 'language' | 'danger'>(initialTab);

  // Profile Fields
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [about, setAbout] = useState(user?.about || 'Available | Using Anomah Chat');
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [discoverableByPhone, setDiscoverableByPhone] = useState(user?.discoverableByPhone !== false);
  const [phoneSlotStatus, setPhoneSlotStatus] = useState<PhoneSlotStatus | null>(null);

  // Security Fields (Quick App-Lock PIN is hashed client-side, never stored in plaintext)
  const [username, setUsername] = useState(user?.username || '');
  const [appLockPinInput, setAppLockPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [savedOnDevice, setSavedOnDevice] = useState(() => isDeviceAccountSaved(user?.userId));

  // Password Change Fields (ephemeral, never persisted or logged)
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const hasPasswordProvider = Boolean(
    firebaseUser?.providerData?.some((p) => p.providerId === 'password')
  );

  // Account Deletion Confirmation
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [confirmDeleteModal, setConfirmDeleteModal] = useState(false);

  // Connected Devices Control State
  const [confirmLogoutAllOther, setConfirmLogoutAllOther] = useState(false);
  const [deviceBusyId, setDeviceBusyId] = useState<string | null>(null);
  const [blockTargetDeviceId, setBlockTargetDeviceId] = useState<string | null>(null);
  const [blockVerifyPassword, setBlockVerifyPassword] = useState('');
  const [blockShowPassword, setBlockShowPassword] = useState(false);
  const [showBlockFallbackInput, setShowBlockFallbackInput] = useState(false);
  const [blockFallbackSecret, setBlockFallbackSecret] = useState('');
  const [blockVerifyError, setBlockVerifyError] = useState<string | null>(null);
  const [blockedWarningBanner, setBlockedWarningBanner] = useState<{
    label: string;
    resetSent: boolean;
  } | null>(null);

  // Status & Messages
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatusMessage, setUpdateStatusMessage] = useState<string | null>(null);
  const [notifPermission, setNotifPermission] = useState<AppNotificationPermission>(() =>
    getAppNotificationPermission()
  );

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const syncNotif = () => setNotifPermission(getAppNotificationPermission());
    window.addEventListener('anomah_notification_permission_changed', syncNotif);
    window.addEventListener('focus', syncNotif);
    return () => {
      window.removeEventListener('anomah_notification_permission_changed', syncNotif);
      window.removeEventListener('focus', syncNotif);
    };
  }, []);

  const handleCheckForUpdates = async () => {
    setCheckingUpdate(true);
    setUpdateStatusMessage(null);
    try {
      if (!isNativeApkApp()) {
        if ('serviceWorker' in navigator) {
          try {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const r of regs) {
              await r.update();
            }
          } catch {
            // Ignore SW update error
          }
        }
        setUpdateStatusMessage(
          language === 'bn'
            ? 'ওয়েব/পিডব্লিউএ: ব্রাউজারে অ্যাপ সর্বদা লাইভ আপ-টু-ডেট থাকে!'
            : 'Web / PWA: Kept live and up-to-date automatically in browser!'
        );
        return;
      }

      const latest = await getLatestRelease();
      if (latest && isUpdateAvailable(latest)) {
        window.dispatchEvent(new CustomEvent('anomah_open_update_modal', { detail: { release: latest } }));
        setUpdateStatusMessage(
          language === 'bn'
            ? `নতুন APK সংস্করণ পাওয়া গেছে (v${latest.versionName})!`
            : `New APK version found (v${latest.versionName})!`
        );
      } else {
        setUpdateStatusMessage(
          language === 'bn'
            ? `আপনার APK অ্যাপ আপ-টু-ডেট (v${APP_VERSION.versionName})`
            : `Already on latest APK build (v${APP_VERSION.versionName})`
        );
      }
    } catch {
      setUpdateStatusMessage(
        language === 'bn' ? 'আপডেট চেক করতে ব্যর্থ হয়েছে' : 'Failed to check updates'
      );
    } finally {
      setCheckingUpdate(false);
    }
  };

  const presetAvatars = [
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.displayName || 'Avatar1'}`,
    `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.displayName || 'Bot1'}`,
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  ];

  useEffect(() => {
    setDisplayName(user?.displayName || '');
    setAbout(user?.about || 'Available | Using Anomah Chat');
    setPhotoURL(user?.photoURL || '');
    setPhoneNumber(user?.phoneNumber || '');
    setDiscoverableByPhone(user?.discoverableByPhone !== false);
    setUsername(user?.username || '');
    setSavedOnDevice(isDeviceAccountSaved(user?.userId));
    setAppLockPinInput('');
    setShowPin(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [
    user?.userId,
    user?.hasAppLockPin,
    user?.username,
    user?.displayName,
    user?.about,
    user?.photoURL,
    user?.phoneNumber,
    user?.discoverableByPhone,
  ]);

  // Wipe sensitive password inputs from component memory when navigating away from Security tab
  useEffect(() => {
    if (activeTab !== 'security') {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setBlockTargetDeviceId(null);
      setBlockVerifyPassword('');
      setBlockShowPassword(false);
      setBlockVerifyError(null);
      setConfirmLogoutAllOther(false);
    }
  }, [activeTab]);

  useModalHistory(true, onClose);

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

  useEffect(() => {
    const check = validateMobileNumber(phoneNumber, language);
    if (!check.valid) {
      setPhoneSlotStatus(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const st = await getPhoneSlotStatus(check.normalized);
      if (!cancelled) setPhoneSlotStatus(st);
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phoneNumber, language]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
      if (cleanUsername && cleanUsername !== (user?.username || '')) {
        if (cleanUsername.length < 3) {
          throw new Error(t('usernameMinLength'));
        }
        const avail = await isUsernameAvailable(cleanUsername, user?.userId);
        if (!avail) {
          throw new Error(t('usernameTakenError'));
        }
      }

      const phoneCheck = validateMobileNumber(phoneNumber, language);
      if (!phoneCheck.valid) {
        throw new Error(
          phoneCheck.error ||
            (language === 'bn'
              ? 'দয়া করে সঠিক মোবাইল নম্বর দিন।'
              : 'Please enter a valid mobile number.')
        );
      }

      await updateProfile(
        displayName.trim(),
        about.trim(),
        photoURL,
        cleanUsername,
        phoneCheck.normalized,
        discoverableByPhone
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

  const handleSaveSecurityAndPin = async () => {
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
      if (cleanUsername !== (user?.username || '')) {
        if (cleanUsername && cleanUsername.length < 3) {
          throw new Error(t('usernameMinLength'));
        }
        await updateProfile(
          user?.displayName || displayName,
          user?.about || about,
          user?.photoURL || photoURL,
          cleanUsername
        );
      }

      if (appLockPinInput.trim()) {
        if (appLockPinInput.length < 4 || appLockPinInput.length > 6) {
          throw new Error(t('pinMinLengthError'));
        }
        await setAppLockPin(appLockPinInput.trim());
        setAppLockPinInput('');
      }

      setSuccessMessage(t('profileSavedSuccess'));
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('profileUpdateError');
      setErrorMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAppLock = async () => {
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await clearAppLockPin();
      setAppLockPinInput('');
      setSuccessMessage(language === 'bn' ? 'অ্যাপ-লক পিন মুছে ফেলা হয়েছে।' : 'Quick App-Lock PIN removed.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to remove App-Lock PIN.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPasswordProvider) return;
    if (!currentPassword) {
      setErrorMessage(t('currentPasswordRequiredError'));
      return;
    }
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
      await changePassword(currentPassword, newPassword);
      setSuccessMessage(t('passwordChangedSuccess'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : 'Failed to update password.';
      const lower = rawMsg.toLowerCase();
      if (lower.includes('incorrect')) {
        setErrorMessage(
          language === 'bn'
            ? 'বর্তমান (পুরনো) পাসওয়ার্ডটি সঠিক নয়। অনুগ্রহ করে যাচাই করে আবার চেষ্টা করুন।'
            : rawMsg
        );
      } else if (lower.includes('too many failed')) {
        setErrorMessage(
          language === 'bn'
            ? 'অনেকবার ভুল পাসওয়ার্ড দেওয়া হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।'
            : rawMsg
        );
      } else if (lower.includes('must be different')) {
        setErrorMessage(t('samePasswordError'));
      } else {
        setErrorMessage(rawMsg);
      }
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

        {/* Master Settings Layout */}
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
                ...(isUserSuperAdmin
                  ? [
                      {
                        id: 'danger' as const,
                        label: language === 'bn' ? 'অ্যাডমিন রুট সুরক্ষা' : 'Root Security',
                        icon: Shield,
                        adminProtected: true,
                      },
                    ]
                  : [
                      {
                        id: 'danger' as const,
                        label: t('tabDanger'),
                        icon: Trash2,
                        danger: true,
                      },
                    ]),
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const isItemDanger = 'danger' in item && item.danger;
                const isItemProtected = 'adminProtected' in item && item.adminProtected;

                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as typeof activeTab)}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 sm:w-full text-left ${
                      isActive
                        ? isItemDanger
                          ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                          : isItemProtected
                          ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-white border border-slate-700/80 shadow-xs'
                        : isItemDanger
                        ? 'text-rose-400 hover:bg-rose-500/10'
                        : isItemProtected
                        ? 'text-emerald-400 hover:bg-slate-800/50'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.id === 'security' && (
                      <span className="flex items-center gap-1 shrink-0">
                        {userSessions.some(
                          (s) =>
                            s.status === 'pending_approval' ||
                            (s.status === 'active' && s.adminAlertPending)
                        ) && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 font-mono">
                          {userSessions.filter((s) => s.status === 'active').length}
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Super Admin Special Item */}
              {isUserSuperAdmin && onOpenAdmin && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenAdmin();
                  }}
                  className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-emerald-400 hover:bg-emerald-950/30 border border-emerald-500/20 transition cursor-pointer shrink-0 sm:w-full mt-2"
                >
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span>{t('superAdminBadge')}</span>
                  </div>
                  <ExternalLink className="w-3 h-3 text-emerald-400 opacity-80" />
                </button>
              )}

              <div className="mt-2">
                <PWAInstallButton variant="sidebar" />
              </div>

              {/* In-App APK Version & Auto-Update Check (Strictly for Native APK) */}
              {isNativeApkApp() && (
                <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                      {language === 'bn' ? 'অ্যাপ সংস্করণ' : 'App Version'}
                    </span>
                    <span className="text-xs font-mono font-medium text-slate-300">
                      v{APP_VERSION.versionName} (APK)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCheckForUpdates}
                    disabled={checkingUpdate}
                    className="w-full py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-[11px] font-medium border border-slate-800 flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    {checkingUpdate ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                        <span>{language === 'bn' ? 'যাচাই হচ্ছে...' : 'Checking...'}</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{language === 'bn' ? 'আপডেট চেক করুন' : 'Check for Updates'}</span>
                      </>
                    )}
                  </button>

                  {updateStatusMessage && (
                    <p className="text-[10px] text-center text-slate-400 px-1 transition animate-in fade-in">
                      {updateStatusMessage}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Settings Content Pane */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-900/60 flex flex-col justify-between">
            <div>
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

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-300">
                      {language === 'bn' ? 'মোবাইল নম্বর (ব্যক্তিগত — পরিচয় ও সাপোর্ট)' : 'Mobile Number (Private — Identity & Support)'}
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        placeholder="+880 1XXX-XXXXXX"
                        maxLength={50}
                        required
                      />
                    </div>
                    <p className="text-[10px] text-slate-400">
                      {language === 'bn'
                        ? 'আপনার মোবাইল নম্বর কখনোই কারও প্রোফাইলে প্রদর্শিত হয় না; প্রতি নম্বরে সর্বোচ্চ ৩টি অ্যাকাউন্ট অনুমোদিত।'
                        : 'Your number is never shown publicly; maximum 3 accounts per mobile number.'}
                    </p>
                    {phoneSlotStatus && (
                      <div className="flex items-center gap-2 flex-wrap pt-0.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                            phoneSlotStatus.isBlocked && !phoneSlotStatus.containsUid(user?.userId)
                              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              : phoneSlotStatus.usedSlots >= phoneSlotStatus.maxLimit &&
                                !phoneSlotStatus.containsUid(user?.userId)
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                          }`}
                        >
                          {phoneSlotStatus.isBlocked && !phoneSlotStatus.containsUid(user?.userId)
                            ? language === 'bn'
                              ? 'এই নম্বরটি ব্লকড রয়েছে'
                              : 'This number is blocked'
                            : phoneSlotStatus.usedSlots >= phoneSlotStatus.maxLimit &&
                              !phoneSlotStatus.containsUid(user?.userId)
                            ? language === 'bn'
                              ? `সর্বোচ্চ সীমা পূর্ণ (${phoneSlotStatus.usedSlots}/${phoneSlotStatus.maxLimit})`
                              : `Slot limit full (${phoneSlotStatus.usedSlots}/${phoneSlotStatus.maxLimit})`
                            : language === 'bn'
                            ? `এই নম্বরের স্লট: ${phoneSlotStatus.usedSlots}/${phoneSlotStatus.maxLimit} অ্যাকাউন্ট`
                            : `Number slots: ${phoneSlotStatus.usedSlots}/${phoneSlotStatus.maxLimit} accounts`}
                        </span>
                      </div>
                    )}
                    {user?.initialPhoneNumber && user.initialPhoneNumber !== user.phoneNumber && (
                      <div className="mt-1 px-2.5 py-1.5 bg-slate-950/70 border border-slate-800 rounded-xl text-[10px] text-slate-300 flex items-center justify-between gap-2">
                        <span className="text-slate-400">
                          {language === 'bn' ? 'প্রথম রেজিস্ট্রিকৃত মূল নম্বর:' : 'First Registered Number:'}
                        </span>
                        <span className="font-mono font-semibold text-amber-300">{user.initialPhoneNumber}</span>
                      </div>
                    )}
                    {(() => {
                      if (!user?.lastPhoneChangedAt || user.phoneChangeCooldownBypass) return null;
                      const lastMs = new Date(user.lastPhoneChangedAt).getTime();
                      const cooldownMs = 30 * 24 * 60 * 60 * 1000;
                      if (!Number.isFinite(lastMs) || Date.now() - lastMs >= cooldownMs) return null;
                      const daysLeft = Math.max(
                        1,
                        Math.ceil((cooldownMs - (Date.now() - lastMs)) / (24 * 60 * 60 * 1000))
                      );
                      return (
                        <div className="mt-1 px-2.5 py-1.5 bg-amber-950/30 border border-amber-500/30 rounded-xl text-[10px] text-amber-200 flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                          <span>
                            {language === 'bn'
                              ? `নম্বর পরিবর্তনের ৩০-দিনের নিরাপত্তা কুলডাউন সক্রিয় (আরও ${daysLeft} দিন বাকি)।`
                              : `30-day number change cooldown active (${daysLeft} day(s) remaining).`}
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Privacy-preserving exact mobile lookup toggle */}
                  <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white">
                        {language === 'bn'
                          ? 'সঠিক মোবাইল নম্বর দিয়ে বন্ধুদের খুঁজতে দিন'
                          : 'Allow friends to find me by exact mobile number'}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                        {language === 'bn'
                          ? 'চালু থাকলে কেবল যার কাছে আপনার পুরো নম্বর আছে, সেই নম্বর সার্চ করে চ্যাট করতে পারবে (নম্বর গোপন হ্যাশ হিসেবে থাকে)।'
                          : 'Stored as a one-way cryptographic hash only—strangers cannot see or browse your number.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={discoverableByPhone}
                      onClick={() => setDiscoverableByPhone((prev) => !prev)}
                      className={`w-11 h-6 rounded-full transition relative shrink-0 cursor-pointer ${
                        discoverableByPhone ? 'bg-emerald-500' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`block w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          discoverableByPhone ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {onOpenShareQR && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenShareQR();
                      }}
                      className="w-full py-2.5 px-3.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-2xl text-xs font-semibold text-emerald-300 flex items-center justify-between transition cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <QrCode className="w-4 h-4 text-emerald-400" />
                        <span>
                          {language === 'bn'
                            ? 'আমার পার্সোনাল চ্যাট লিংক ও QR কোড দেখুন'
                            : 'View My Personal Chat Link & QR Code'}
                        </span>
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                    </button>
                  )}
                </form>
              )}

              {/* TAB 2: Security & Quick App-Lock PIN */}
              {activeTab === 'security' && (
                <div className="space-y-4">
                  {/* Email Verification Status */}
                  <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MailCheck className={`w-4 h-4 shrink-0 ${firebaseUser?.emailVerified ? 'text-emerald-400' : 'text-amber-400'}`} />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white">
                          {firebaseUser?.emailVerified
                            ? (language === 'bn' ? 'ইমেইল ভেরিফায়েড' : 'Email Verified')
                            : (language === 'bn' ? 'ইমেইল ভেরিফায়েড নয়' : 'Email Not Verified')}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">{user?.email}</div>
                      </div>
                    </div>
                    {!firebaseUser?.emailVerified && (
                      <button
                        type="button"
                        onClick={async () => {
                          setSaving(true);
                          setErrorMessage(null);
                          try {
                            await resendVerificationEmail();
                            setSuccessMessage(
                              language === 'bn'
                                ? 'ভেরিফিকেশন ইমেইল পাঠানো হয়েছে! আপনার ইনবক্স দেখুন।'
                                : 'Verification email sent! Please check your inbox.'
                            );
                          } catch (e: unknown) {
                            setErrorMessage(e instanceof Error ? e.message : 'Failed to send verification email.');
                          } finally {
                            setSaving(false);
                          }
                        }}
                        disabled={saving}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-[11px] font-bold shrink-0 cursor-pointer"
                      >
                        {language === 'bn' ? 'ভেরিফাই লিংক পাঠান' : 'Send Link'}
                      </button>
                    )}
                  </div>

                  {/* Username & Quick App-Lock PIN */}
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        {t('usernamePinConfigTitle')}
                      </h4>
                      {user?.hasAppLockPin && (
                        <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                          <KeyRound className="w-3 h-3" />
                          {language === 'bn' ? 'অ্যাপ-লক চালু আছে' : 'App-Lock Active'}
                        </span>
                      )}
                    </div>

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

                    {/* Quick App-Lock PIN */}
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-300">{t('secretPinLabel')}</label>
                      <div className="relative">
                        <input
                          type={showPin ? 'text' : 'password'}
                          inputMode="numeric"
                          value={appLockPinInput}
                          onChange={(e) => setAppLockPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder={
                            user?.hasAppLockPin
                              ? (language === 'bn' ? 'নতুন পিন সেট করতে লিখুন (৪-৬ ডিজিট)' : 'Enter new 4-6 digits to change PIN')
                              : t('secretPinPlaceholder')
                          }
                          className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono tracking-widest"
                          maxLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPin(!showPin)}
                          className="absolute right-3 top-2 text-slate-400 hover:text-white cursor-pointer"
                        >
                          {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {t('secretPinHelpText')}{' '}
                        {language === 'bn'
                          ? '(লগইন থাকা অবস্থায় অ্যাপ খুললে শুধু ৪-৬ ডিজিটের পিন দিয়েই ১ ক্লিকে আনলক হবে।)'
                          : '(While signed in on this device, unlock messenger in 1 tap with your 4-6 digit PIN.)'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSaveSecurityAndPin}
                        disabled={saving || (!appLockPinInput.trim() && username.trim().toLowerCase() === (user?.username || ''))}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold disabled:opacity-50 cursor-pointer transition shadow"
                      >
                        {saving ? t('saving') : t('updatePinUsernameBtn')}
                      </button>

                      {user?.hasAppLockPin && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              lockAppNow();
                            }}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold cursor-pointer transition flex items-center gap-1"
                          >
                            <Lock className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{language === 'bn' ? 'এখনই লক করুন' : 'Lock Now'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleRemoveAppLock}
                            disabled={saving}
                            className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold cursor-pointer transition"
                          >
                            {language === 'bn' ? 'পিন বন্ধ করুন' : 'Remove PIN'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Device Quick-Tap Account Shortcut Toggle */}
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white">
                          {language === 'bn'
                            ? 'এই ডিভাইসে অ্যাকাউন্ট শর্টকাট কার্ড সংরক্ষণ'
                            : 'Save Account Shortcut Card on This Device'}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                          {language === 'bn'
                            ? 'লগআউট করার পরও নাম ও মাস্কড ইমেইল কার্ড হিসেবে থাকবে (কোনো পাসওয়ার্ড বা পিন ডিভাইসে সেভ হয় না)।'
                            : 'Shows your masked profile card on the login screen for faster sign-in. Passwords and PINs are never saved.'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={savedOnDevice}
                      onClick={() => {
                        if (!user?.userId) return;
                        if (savedOnDevice) {
                          removeSavedDeviceAccount(user.userId);
                          setSavedOnDevice(false);
                          setSuccessMessage(
                            language === 'bn'
                              ? 'এই ডিভাইস থেকে শর্টকাট কার্ড সরানো হয়েছে।'
                              : 'Account shortcut card removed from this device.'
                          );
                        } else if (user.email) {
                          saveDeviceAccount({
                            userId: user.userId,
                            displayName: user.displayName,
                            photoURL: user.photoURL || '',
                            email: user.email,
                            provider: hasPasswordProvider ? 'password' : 'google',
                          });
                          setSavedOnDevice(true);
                          setSuccessMessage(
                            language === 'bn'
                              ? 'এই ডিভাইসে অ্যাকাউন্ট শর্টকাট কার্ড সংরক্ষণ করা হয়েছে।'
                              : 'Account shortcut card saved on this device.'
                          );
                        }
                        setTimeout(() => setSuccessMessage(null), 3000);
                      }}
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

                  {/* Connected Devices & Active Sessions */}
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                          {language === 'bn' ? 'সংযুক্ত ডিভাইসসমূহ' : 'Connected Devices'}
                        </h4>
                        {isVerifiedSuperAdmin && (
                          <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 text-[9px] font-bold">
                            {language === 'bn' ? 'সুপার অ্যাডমিন নীতি' : 'Super Admin Policy'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-300">
                          {(() => {
                            const activeM = userSessions.filter(
                              (s) => s.status === 'active' && s.platformCategory === 'mobile'
                            ).length;
                            const activeW = userSessions.filter(
                              (s) => s.status === 'active' && s.platformCategory === 'web'
                            ).length;
                            return language === 'bn'
                              ? `মোবাইল: ${activeM}/${deviceLimitsSummary.mobile} · ওয়েব/পিসি: ${activeW}/${deviceLimitsSummary.web}`
                              : `Mobile: ${activeM}/${deviceLimitsSummary.mobile} · Web/PC: ${activeW}/${deviceLimitsSummary.web}`;
                          })()}
                        </span>

                        {userSessions.some(
                          (s) =>
                            s.deviceId !== currentDeviceId &&
                            (s.status === 'active' || s.status === 'pending_approval')
                        ) &&
                          !confirmLogoutAllOther && (
                            <button
                              type="button"
                              onClick={() => setConfirmLogoutAllOther(true)}
                              className="px-2 py-0.5 rounded-md bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[10px] font-bold cursor-pointer transition"
                            >
                              {language === 'bn' ? 'অন্য সব ডিভাইস লগ-আউট' : 'Log Out All Other'}
                            </button>
                          )}
                      </div>
                    </div>

                    {confirmLogoutAllOther && (
                      <div className="p-2.5 bg-rose-950/35 border border-rose-500/35 rounded-xl flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <span className="text-rose-200">
                          {language === 'bn'
                            ? 'এই ডিভাইস বাদে বাকি সব সক্রিয় ডিভাইস থেকে লগ-আউট করতে চান?'
                            : 'Sign out every other device except this one?'}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setConfirmLogoutAllOther(false)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-[10px] font-semibold cursor-pointer"
                          >
                            {t('cancel')}
                          </button>
                          <button
                            type="button"
                            disabled={deviceBusyId === '__all__'}
                            onClick={async () => {
                              setDeviceBusyId('__all__');
                              setErrorMessage(null);
                              try {
                                const count = await logoutAllOtherDevices();
                                setConfirmLogoutAllOther(false);
                                setSuccessMessage(
                                  language === 'bn'
                                    ? `${count}টি অন্য ডিভাইস থেকে লগ-আউট সম্পন্ন হয়েছে।`
                                    : `Signed out ${count} other device(s).`
                                );
                                setTimeout(() => setSuccessMessage(null), 3500);
                              } catch (err) {
                                setErrorMessage(
                                  err instanceof Error
                                    ? err.message
                                    : language === 'bn'
                                    ? 'অন্যান্য ডিভাইস লগ-আউট করা যায়নি।'
                                    : 'Failed to log out other devices.'
                                );
                              } finally {
                                setDeviceBusyId(null);
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-[10px] font-bold cursor-pointer"
                          >
                            {language === 'bn' ? 'হ্যাঁ, সব লগ-আউট' : 'Confirm Log Out'}
                          </button>
                        </div>
                      </div>
                    )}

                    {blockedWarningBanner && (
                      <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl space-y-2 text-[11px]">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 text-amber-200">
                            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <span>
                              {language === 'bn'
                                ? `"${blockedWarningBanner.label}" ব্লক ও লগ-আউট হয়েছে। আপনার অ্যাকাউন্ট সম্পূর্ণ সুরক্ষিত রাখতে এখনই পাসওয়ার্ড পরিবর্তন করুন।`
                                : `"${blockedWarningBanner.label}" has been blocked and signed out. Change or reset your password immediately to keep your account safe.`}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setBlockedWarningBanner(null)}
                            className="text-slate-400 hover:text-white cursor-pointer shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {hasPasswordProvider && user?.email && (
                          <button
                            type="button"
                            disabled={saving || blockedWarningBanner.resetSent}
                            onClick={async () => {
                              setSaving(true);
                              setErrorMessage(null);
                              try {
                                await sendPasswordReset(user.email);
                                setBlockedWarningBanner((prev) =>
                                  prev ? { ...prev, resetSent: true } : null
                                );
                              } catch (err) {
                                setErrorMessage(
                                  err instanceof Error
                                    ? err.message
                                    : language === 'bn'
                                    ? 'পাসওয়ার্ড রিসেট ইমেইল পাঠানো যায়নি।'
                                    : 'Failed to send password reset email.'
                                );
                              } finally {
                                setSaving(false);
                              }
                            }}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white rounded-lg text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Mail className="w-3 h-3" />
                            <span>
                              {blockedWarningBanner.resetSent
                                ? language === 'bn'
                                  ? 'পাসওয়ার্ড রিসেট ইমেইল পাঠানো হয়েছে!'
                                  : 'Password Reset Email Sent!'
                                : language === 'bn'
                                ? 'ইমেইলে পাসওয়ার্ড রিসেট লিংক পাঠান'
                                : 'Send Password Reset Email'}
                            </span>
                          </button>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      {userSessions
                        .filter((s) => s.status === 'active' || s.status === 'pending_approval')
                        .map((sess) => {
                          const isCurrent = sess.deviceId === currentDeviceId;
                          const rtLabel =
                            sess.runtimeType === 'apk'
                              ? 'APK'
                              : sess.runtimeType === 'pwa'
                              ? 'PWA'
                              : 'Web';
                          const isVerifyingThisBlock = blockTargetDeviceId === sess.deviceId;
                          const isBusy = deviceBusyId === sess.deviceId;

                          return (
                            <div
                              key={sess.deviceId}
                              className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2 text-xs"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2.5 min-w-0">
                                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
                                    {sess.platformCategory === 'mobile' ? (
                                      <Smartphone className="w-4 h-4" />
                                    ) : (
                                      <Laptop className="w-4 h-4" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-semibold text-white truncate max-w-[160px]">
                                        {sess.deviceLabel}
                                      </span>
                                      <span className="px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-[9px] font-mono text-slate-300">
                                        {rtLabel}
                                      </span>
                                      {isCurrent && (
                                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold">
                                          {language === 'bn' ? 'এই ডিভাইস' : 'THIS DEVICE'}
                                        </span>
                                      )}
                                      {sess.isPrimaryTrusted && sess.status === 'active' && (
                                        <span className="px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 text-[9px] font-bold">
                                          {language === 'bn' ? 'বিশ্বস্ত' : 'TRUSTED'}
                                        </span>
                                      )}
                                      {sess.status === 'pending_approval' && (
                                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold">
                                          {language === 'bn' ? 'অপেক্ষমাণ' : 'PENDING'}
                                        </span>
                                      )}
                                      {sess.adminAlertPending && sess.status === 'active' && (
                                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/35 text-[9px] font-bold">
                                          {language === 'bn' ? 'নতুন সতর্কতা' : 'NEW ALERT'}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                      {sess.approxLocation ? `${sess.approxLocation} · ` : ''}
                                      {language === 'bn' ? 'সক্রিয়: ' : 'Active: '}
                                      {new Date(sess.lastActiveAt || sess.createdAt).toLocaleString(
                                        language === 'bn' ? 'bn-BD' : 'en-US'
                                      )}
                                    </div>
                                    {sess.loginAt && (
                                      <div className="text-[10px] text-slate-500 truncate">
                                        {language === 'bn' ? 'লগইন: ' : 'Login: '}
                                        {new Date(sess.loginAt).toLocaleString(
                                          language === 'bn' ? 'bn-BD' : 'en-US'
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {!isCurrent && (
                                  <div className="flex items-center gap-1 flex-wrap justify-end shrink-0">
                                    {sess.status === 'pending_approval' && (
                                      <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={async () => {
                                          setDeviceBusyId(sess.deviceId);
                                          setErrorMessage(null);
                                          try {
                                            await approvePendingDevice(sess.deviceId);
                                            setSuccessMessage(
                                              language === 'bn'
                                                ? `${sess.deviceLabel} অনুমোদন দেওয়া হয়েছে।`
                                                : `Approved ${sess.deviceLabel}.`
                                            );
                                            setTimeout(() => setSuccessMessage(null), 3000);
                                          } catch (err) {
                                            setErrorMessage(
                                              err instanceof Error
                                                ? err.message
                                                : language === 'bn'
                                                ? 'ডিভাইস অনুমোদন দেওয়া যায়নি।'
                                                : 'Failed to approve device.'
                                            );
                                          } finally {
                                            setDeviceBusyId(null);
                                          }
                                        }}
                                        className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/35 rounded-lg text-[10px] font-bold cursor-pointer flex items-center gap-1"
                                      >
                                        <ShieldCheck className="w-3 h-3" />
                                        <span>{language === 'bn' ? 'অনুমোদন' : 'Approve'}</span>
                                      </button>
                                    )}

                                    {sess.status === 'active' && sess.adminAlertPending && (
                                      <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={async () => {
                                          setDeviceBusyId(sess.deviceId);
                                          setErrorMessage(null);
                                          try {
                                            await acknowledgeAdminAlert(sess.deviceId, true);
                                          } catch (err) {
                                            setErrorMessage(
                                              err instanceof Error
                                                ? err.message
                                                : language === 'bn'
                                                ? 'ডিভাইস বিশ্বস্ত হিসেবে সংরক্ষণ করা যায়নি।'
                                                : 'Failed to trust device alert.'
                                            );
                                          } finally {
                                            setDeviceBusyId(null);
                                          }
                                        }}
                                        className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/35 rounded-lg text-[10px] font-bold cursor-pointer flex items-center gap-1"
                                      >
                                        <ShieldCheck className="w-3 h-3" />
                                        <span>{language === 'bn' ? 'আমিই (বিশ্বস্ত)' : 'Trust'}</span>
                                      </button>
                                    )}

                                    {sess.status === 'active' && !sess.adminAlertPending && (
                                      <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={async () => {
                                          setDeviceBusyId(sess.deviceId);
                                          setErrorMessage(null);
                                          try {
                                            await trustOrUntrustDevice(
                                              sess.deviceId,
                                              !sess.isPrimaryTrusted
                                            );
                                          } catch (err) {
                                            setErrorMessage(
                                              err instanceof Error
                                                ? err.message
                                                : language === 'bn'
                                                ? 'ডিভাইস ট্রাস্ট পরিবর্তন করা যায়নি।'
                                                : 'Failed to update device trust status.'
                                            );
                                          } finally {
                                            setDeviceBusyId(null);
                                          }
                                        }}
                                        className={`px-2 py-1 rounded-lg text-[10px] font-semibold border cursor-pointer transition ${
                                          sess.isPrimaryTrusted
                                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                            : 'bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border-sky-500/30'
                                        }`}
                                      >
                                        {sess.isPrimaryTrusted
                                          ? language === 'bn'
                                            ? 'আনট্রাস্ট'
                                            : 'Untrust'
                                          : language === 'bn'
                                          ? 'বিশ্বস্ত করুন'
                                          : 'Trust'}
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={async () => {
                                        setDeviceBusyId(sess.deviceId);
                                        setErrorMessage(null);
                                        try {
                                          await forceLogoutOtherDevice(sess.deviceId);
                                          setSuccessMessage(
                                            language === 'bn'
                                              ? `${sess.deviceLabel} থেকে সেশন লগ-আউট করা হয়েছে।`
                                              : `Logged out ${sess.deviceLabel}.`
                                          );
                                          setTimeout(() => setSuccessMessage(null), 3000);
                                        } catch (err) {
                                          setErrorMessage(
                                            err instanceof Error
                                              ? err.message
                                              : language === 'bn'
                                              ? 'ডিভাইসটি লগ-আউট করা যায়নি।'
                                              : 'Failed to log out device.'
                                          );
                                        } finally {
                                          setDeviceBusyId(null);
                                        }
                                      }}
                                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-[10px] font-semibold cursor-pointer flex items-center gap-1"
                                    >
                                      <LogOut className="w-3 h-3" />
                                      <span>{language === 'bn' ? 'লগআউট' : 'Logout'}</span>
                                    </button>

                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() => {
                                        setBlockVerifyError(null);
                                        setBlockVerifyPassword('');
                                        setShowBlockFallbackInput(false);
                                        setBlockFallbackSecret('');
                                        setBlockTargetDeviceId(
                                          isVerifyingThisBlock ? null : sess.deviceId
                                        );
                                      }}
                                      className="px-2 py-1 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-lg text-[10px] font-bold cursor-pointer flex items-center gap-1"
                                    >
                                      <ShieldAlert className="w-3 h-3" />
                                      <span>{language === 'bn' ? 'আমি না · ব্লক' : 'Not Me · Block'}</span>
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Inline Owner Verification before Blocking */}
                              {!isCurrent && isVerifyingThisBlock && (
                                <div className="p-2.5 bg-rose-950/30 border border-rose-500/30 rounded-xl space-y-2">
                                  <div className="flex items-center justify-between gap-2 text-[11px] text-rose-200 font-semibold">
                                    <span>
                                      {language === 'bn'
                                        ? 'মালিকানা যাচাই করে অচেনা ডিভাইসটি ব্লক করুন:'
                                        : 'Verify ownership before blocking this device:'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setBlockTargetDeviceId(null);
                                        setBlockVerifyPassword('');
                                        setShowBlockFallbackInput(false);
                                        setBlockFallbackSecret('');
                                        setBlockVerifyError(null);
                                      }}
                                      className="text-slate-400 hover:text-white cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  {blockVerifyError && (
                                    <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-[10px] text-rose-300">
                                      {blockVerifyError}
                                    </div>
                                  )}

                                  {hasPasswordProvider ? (
                                    <div className="flex flex-col sm:flex-row gap-2">
                                      <div className="relative flex-1">
                                        <input
                                          type={blockShowPassword ? 'text' : 'password'}
                                          value={blockVerifyPassword}
                                          onChange={(e) => setBlockVerifyPassword(e.target.value)}
                                          placeholder={
                                            language === 'bn'
                                              ? 'বর্তমান অ্যাকাউন্ট পাসওয়ার্ড দিন'
                                              : 'Enter account password'
                                          }
                                          className="w-full px-3 py-1.5 pr-8 bg-slate-950 border border-slate-700 rounded-lg text-[11px] text-white focus:outline-none focus:border-rose-500"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => setBlockShowPassword((p) => !p)}
                                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                                        >
                                          {blockShowPassword ? (
                                            <EyeOff className="w-3 h-3" />
                                          ) : (
                                            <Eye className="w-3 h-3" />
                                          )}
                                        </button>
                                      </div>
                                      <button
                                        type="button"
                                        disabled={isBusy || !blockVerifyPassword.trim()}
                                        onClick={async () => {
                                          setDeviceBusyId(sess.deviceId);
                                          setBlockVerifyError(null);
                                          try {
                                            await blockDeviceWithVerification(sess.deviceId, {
                                              password: blockVerifyPassword,
                                            });
                                            setBlockTargetDeviceId(null);
                                            setBlockVerifyPassword('');
                                            setBlockedWarningBanner({
                                              label: sess.deviceLabel,
                                              resetSent: false,
                                            });
                                          } catch (err) {
                                            setBlockVerifyError(
                                              err instanceof Error ? err.message : 'Verification failed.'
                                            );
                                          } finally {
                                            setDeviceBusyId(null);
                                          }
                                        }}
                                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold cursor-pointer shrink-0"
                                      >
                                        {language === 'bn' ? 'যাচাই ও ব্লক করুন' : 'Verify & Block'}
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      <div className="flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          disabled={isBusy}
                                          onClick={async () => {
                                            setDeviceBusyId(sess.deviceId);
                                            setBlockVerifyError(null);
                                            try {
                                              await blockDeviceWithVerification(sess.deviceId, {
                                                verifyGoogle: true,
                                              });
                                              setBlockTargetDeviceId(null);
                                              setShowBlockFallbackInput(false);
                                              setBlockFallbackSecret('');
                                              setBlockedWarningBanner({
                                                label: sess.deviceLabel,
                                                resetSent: false,
                                              });
                                            } catch (err) {
                                              setBlockVerifyError(
                                                err instanceof Error ? err.message : 'Verification failed.'
                                              );
                                            } finally {
                                              setDeviceBusyId(null);
                                            }
                                          }}
                                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                                        >
                                          {language === 'bn' ? 'Google দিয়ে যাচাই ও ব্লক' : 'Verify with Google & Block'}
                                        </button>
                                        <button
                                          type="button"
                                          disabled={isBusy}
                                          onClick={() => {
                                            setBlockVerifyError(null);
                                            setShowBlockFallbackInput((prev) => !prev);
                                          }}
                                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-semibold cursor-pointer"
                                        >
                                          {user?.hasAppLockPin
                                            ? language === 'bn'
                                              ? 'পিন দিয়ে যাচাই'
                                              : 'Use App-Lock PIN'
                                            : language === 'bn'
                                            ? 'পপআপ ছাড়া ইমেইল যাচাই'
                                            : 'Verify via Email'}
                                        </button>
                                      </div>

                                      {showBlockFallbackInput && (
                                        <div className="flex flex-col sm:flex-row gap-2">
                                          <input
                                            type={user?.hasAppLockPin ? 'password' : 'email'}
                                            inputMode={user?.hasAppLockPin ? 'numeric' : 'email'}
                                            maxLength={user?.hasAppLockPin ? 6 : 150}
                                            value={blockFallbackSecret}
                                            onChange={(e) =>
                                              setBlockFallbackSecret(
                                                user?.hasAppLockPin
                                                  ? e.target.value.replace(/\D/g, '').slice(0, 6)
                                                  : e.target.value
                                              )
                                            }
                                            placeholder={
                                              user?.hasAppLockPin
                                                ? language === 'bn'
                                                  ? '৪-৬ ডিজিটের পিন'
                                                  : '4-6 digit App-Lock PIN'
                                                : language === 'bn'
                                                ? 'অ্যাকাউন্টের ইমেইল লিখুন'
                                                : 'Enter your account email'
                                            }
                                            className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-[11px] text-white focus:outline-none focus:border-rose-500"
                                          />
                                          <button
                                            type="button"
                                            disabled={isBusy || !blockFallbackSecret.trim()}
                                            onClick={async () => {
                                              setDeviceBusyId(sess.deviceId);
                                              setBlockVerifyError(null);
                                              try {
                                                await blockDeviceWithVerification(sess.deviceId, {
                                                  allowPopupFallback: true,
                                                  ...(user?.hasAppLockPin
                                                    ? { appLockPin: blockFallbackSecret }
                                                    : { confirmedEmail: blockFallbackSecret }),
                                                });
                                                setBlockTargetDeviceId(null);
                                                setShowBlockFallbackInput(false);
                                                setBlockFallbackSecret('');
                                                setBlockedWarningBanner({
                                                  label: sess.deviceLabel,
                                                  resetSent: false,
                                                });
                                              } catch (err) {
                                                setBlockVerifyError(
                                                  err instanceof Error ? err.message : 'Verification failed.'
                                                );
                                              } finally {
                                                setDeviceBusyId(null);
                                              }
                                            }}
                                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold cursor-pointer shrink-0"
                                          >
                                            {language === 'bn' ? 'নিশ্চিত ও ব্লক' : 'Confirm & Block'}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      {userSessions.filter((s) => s.status === 'active' || s.status === 'pending_approval').length === 0 && (
                        <p className="text-[11px] text-slate-500">
                          {language === 'bn' ? 'কোনো সক্রিয় ডিভাইস পাওয়া যায়নি।' : 'No active sessions recorded yet.'}
                        </p>
                      )}
                    </div>

                    {/* Recent & Blocked Sessions History */}
                    {userSessions.some(
                      (s) => s.status === 'rejected' || s.status === 'logged_out'
                    ) && (
                      <div className="pt-2.5 border-t border-slate-800/80 space-y-1.5">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {language === 'bn'
                            ? 'সাম্প্রতিক ও ব্লকড সেশন ইতিহাস'
                            : 'Recent & Blocked Session History'}
                        </div>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {userSessions
                            .filter((s) => s.status === 'rejected' || s.status === 'logged_out')
                            .map((sess) => {
                              const isRejected = sess.status === 'rejected';
                              return (
                                <div
                                  key={sess.deviceId}
                                  className="px-2.5 py-2 bg-slate-900/60 border border-slate-800/70 rounded-xl flex items-center justify-between gap-2 text-[11px]"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-medium text-slate-200 truncate max-w-[160px]">
                                        {sess.deviceLabel}
                                      </span>
                                      <span
                                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                          isRejected
                                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                            : 'bg-slate-800 text-slate-400'
                                        }`}
                                      >
                                        {isRejected
                                          ? language === 'bn'
                                            ? 'ব্লকড'
                                            : 'BLOCKED'
                                          : language === 'bn'
                                          ? 'লগ-আউট'
                                          : 'LOGGED OUT'}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 truncate">
                                      {sess.approxLocation ? `${sess.approxLocation} · ` : ''}
                                      {new Date(sess.lastActiveAt || sess.createdAt).toLocaleString(
                                        language === 'bn' ? 'bn-BD' : 'en-US'
                                      )}
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    disabled={deviceBusyId === sess.deviceId}
                                    onClick={async () => {
                                      setDeviceBusyId(sess.deviceId);
                                      setErrorMessage(null);
                                      try {
                                        await removeDeviceHistoryItem(sess.deviceId);
                                      } catch (err) {
                                        setErrorMessage(
                                          err instanceof Error
                                            ? err.message
                                            : language === 'bn'
                                            ? 'সেশন ইতিহাস মুছতে সমস্যা হয়েছে।'
                                            : 'Failed to remove device record.'
                                        );
                                      } finally {
                                        setDeviceBusyId(null);
                                      }
                                    }}
                                    title={
                                      language === 'bn'
                                        ? isRejected
                                          ? 'ব্লক লিস্ট ও রেকর্ড থেকে সরান'
                                          : 'ইতিহাস মুছুন'
                                        : isRejected
                                        ? 'Unblock & remove record'
                                        : 'Remove record'
                                    }
                                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700 text-[10px] font-semibold cursor-pointer inline-flex items-center gap-1 shrink-0"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>
                                      {isRejected
                                        ? language === 'bn'
                                          ? 'আনব্লক/মুছুন'
                                          : 'Unblock'
                                        : language === 'bn'
                                        ? 'মুছুন'
                                        : 'Remove'}
                                    </span>
                                  </button>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Password Change / Recovery */}
                  <form onSubmit={handleChangePassword} className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{t('passwordChangeTitle')}</span>
                      </h4>
                      {hasPasswordProvider && (
                        <span className="text-[10px] text-emerald-400 font-semibold">
                          {language === 'bn' ? 'সুরক্ষিত যাচাইকরণ' : 'Verified Update'}
                        </span>
                      )}
                    </div>

                    {hasPasswordProvider ? (
                      <>
                        <div className="space-y-2.5">
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
                                className="w-full px-3 py-1.5 pr-9 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                              />
                              <button
                                type="button"
                                onClick={() => setShowCurrentPassword((prev) => !prev)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                                aria-label="Toggle current password visibility"
                              >
                                {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>

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
                                className="w-full px-3 py-1.5 pr-9 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                              />
                              <button
                                type="button"
                                onClick={() => setShowNewPassword((prev) => !prev)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                                aria-label="Toggle new password visibility"
                              >
                                {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
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
                              className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleSendResetEmail}
                            disabled={saving}
                            className="text-[11px] text-emerald-400 hover:underline disabled:opacity-50 cursor-pointer text-left"
                          >
                            {t('forgotCurrentPasswordBtn')}
                          </button>
                          <button
                            type="submit"
                            disabled={saving || !currentPassword || newPassword.length < 6 || !confirmPassword}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold disabled:opacity-50 cursor-pointer transition shadow"
                          >
                            {saving ? t('saving') : t('changePasswordBtn')}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-[11px] text-slate-300 leading-relaxed bg-slate-900/70 border border-slate-800 rounded-xl p-3">
                          {t('googleOnlyPasswordNotice')}
                        </p>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={handleSendResetEmail}
                            disabled={saving}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold disabled:opacity-50 cursor-pointer transition shadow"
                          >
                            {saving ? t('saving') : t('sendSetPasswordEmailBtn')}
                          </button>
                        </div>
                      </div>
                    )}
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
                      },
                      {
                        id: 'minimal-light' as ThemeMode,
                        nameKey: 'themeMinimalLightName',
                        descKey: 'themeMinimalLightDesc',
                        icon: Sun,
                      },
                      {
                        id: 'telegram-blue' as ThemeMode,
                        nameKey: 'themeTelegramBlueName',
                        descKey: 'themeTelegramBlueDesc',
                        icon: Compass,
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
                              <div className="text-xs font-bold text-white">{t(item.nameKey as Parameters<typeof t>[0])}</div>
                              <div className="text-[11px] text-slate-400">{t(item.descKey as Parameters<typeof t>[0])}</div>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>

                  {/* Background & Live Notification Permissions Card */}
                  {isAppNotificationSupported() && (
                    <div className="mt-4 p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                            <Bell className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">
                              {language === 'bn' ? 'মেসেজ ও কল নোটিফিকেশন' : 'Message & Call Notifications'}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                              {language === 'bn'
                                ? 'অ্যাপ মিনিমাইজ বা অন্য অ্যাপে থাকা অবস্থায় নতুন মেসেজ ও ইনকামিং কলের রিং-অ্যালার্ট পেতে এটি চালু রাখুন।'
                                : 'Keep alerts enabled to get notified for new messages and incoming calls while minimized or in another tab.'}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 border ${
                            notifPermission === 'granted'
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : notifPermission === 'denied'
                              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          {notifPermission === 'granted'
                            ? language === 'bn'
                              ? 'চালু আছে'
                              : 'Active'
                            : notifPermission === 'denied'
                            ? language === 'bn'
                              ? 'ব্লক করা'
                              : 'Blocked'
                            : language === 'bn'
                            ? 'বন্ধ আছে'
                            : 'Off'}
                        </span>
                      </div>

                      {notifPermission !== 'granted' && (
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <span className="text-[10px] text-slate-400">
                            {notifPermission === 'denied'
                              ? language === 'bn'
                                ? 'ফোন/ব্রাউজার সেটিংস থেকে নোটিফিকেশন Allow করে দিন।'
                                : 'Allow notifications in device or browser site settings.'
                              : language === 'bn'
                              ? '১ ক্লিকেই অনুমতি সক্রিয় করুন।'
                              : 'Click to grant permission.'}
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              const next = await requestAppNotificationPermission();
                              setNotifPermission(next);
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-bold cursor-pointer transition shadow-xs shrink-0"
                          >
                            {language === 'bn' ? 'নোটিফিকেশন চালু করুন' : 'Enable Notifications'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
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
                            <div className="text-xs font-bold text-white">{t(item.nameKey as Parameters<typeof t>[0])}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{t(item.descKey as Parameters<typeof t>[0])}</div>
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

              {/* TAB 5: Danger Zone */}
              {activeTab === 'danger' && (
                isUserSuperAdmin ? (
                  <div className="p-5 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-950/80 border border-emerald-500/40 rounded-2xl space-y-4 shadow-md animate-in fade-in">
                    <div className="flex items-center gap-3 text-emerald-400">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                        <Shield className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                          {language === 'bn' ? 'সুপার অ্যাডমিন রুট অ্যাকাউন্ট — স্থায়ী সুরক্ষা সক্রিয়' : 'Super Admin Root Account — Permanent Protection Active'}
                        </h4>
                        <span className="text-[10px] text-emerald-300 font-mono font-bold bg-emerald-950/70 px-2 py-0.5 rounded-md border border-emerald-500/30 mt-0.5 inline-block">
                          {SUPER_ADMIN_EMAIL}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-950/70 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2.5 leading-relaxed">
                      <p>
                        {language === 'bn'
                          ? 'এই অ্যাকাউন্টটি (chinisdramaorg@gmail.com) সিস্টেমের মূল অ্যাডমিনিস্ট্রেটর অ্যাকাউন্ট। সম্পূর্ণ প্ল্যাটফর্মের নিরাপত্তা, নিয়ন্ত্রণ এবং পরিচালন ব্যবস্থা অক্ষুণ্ণ রাখতে এই অ্যাকাউন্ট ডিলিট বা বাতিল করার অপশন স্থায়ীভাবে নিষ্ক্রিয় রাখা হয়েছে।'
                          : 'This account (chinisdramaorg@gmail.com) is the Master Super Admin Root Account. To ensure uninterrupted platform security, governance, and control, this account is permanently protected against deletion.'}
                      </p>
                      <div className="flex items-center gap-2 text-emerald-400 font-semibold text-[11px] pt-1">
                        <Check className="w-4 h-4 shrink-0" />
                        <span>
                          {language === 'bn'
                            ? 'ভুলবশত ক্লিক করলেও কোনো প্রকার ডিলিট হওয়ার সুযোগ নেই।'
                            : 'Permanent deletion lockout active. No accidental deletion is possible.'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-500 italic">
                        {language === 'bn' ? 'স্ট্যাটাস: অপরিবর্তনীয় ও সুরক্ষিত' : 'Status: Immutable & Protected'}
                      </span>
                      {onOpenAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenAdmin();
                          }}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold cursor-pointer transition shadow flex items-center gap-1.5"
                        >
                          <Shield className="w-3.5 h-3.5" />
                          <span>{language === 'bn' ? 'অ্যাডমিন প্যানেল খুলুন' : 'Open Admin Panel'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
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
                )
              )}
            </div>

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
