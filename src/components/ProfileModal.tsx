import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useModalHistory } from '../hooks/useModalHistory';
import { isUsernameAvailable } from '../services/chatService';
import { isSuperAdmin, SUPER_ADMIN_EMAIL } from '../services/adminService';
import { validateMobileNumber } from '../utils/phoneUtils';
import { getPhoneSlotStatus, type PhoneSlotStatus } from '../services/phoneRegistryService';
import { PWAInstallButton } from './PWAInstallButton';
import { QrScannerModal } from './QrScannerModal';
import { ProfileSecuritySection } from './profile/ProfileSecuritySection';
import { ProfileDevicesSection } from './profile/ProfileDevicesSection';
import type { ThemeMode } from '../types/chat';
import {
  X,
  Check,
  User,
  Shield,
  Palette,
  Trash2,
  AlertCircle,
  Sun,
  Moon,
  Compass,
  Languages,
  ExternalLink,
  ArrowLeft,
  RefreshCw,
  Loader2,
  Bell,
  Phone,
  QrCode,
  Laptop,
  Clock,
  RotateCcw,
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

export type ProfileTabId =
  | 'profile'
  | 'security'
  | 'devices'
  | 'appearance'
  | 'language'
  | 'danger';

export function ProfileModal({
  onClose,
  onOpenAdmin,
  onOpenShareQR,
  initialTab = 'profile',
}: {
  onClose: () => void;
  onOpenAdmin?: () => void;
  onOpenShareQR?: () => void;
  initialTab?: ProfileTabId;
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
    globalSecuritySettings,
    publicAuthFlags,
    updateOptionalDevice2FA,
    approveDeviceByQr,
  } = useAuth();

  const { language, setLanguage, t } = useLanguage();
  const bn = language === 'bn';
  const isUserSuperAdmin = isSuperAdmin(user?.email) && Boolean(firebaseUser?.emailVerified);

  const [activeTab, setActiveTab] = useState<ProfileTabId>(initialTab);

  // Profile Fields
  const defaultAbout = 'Available | Using Anomah Chat';
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [about, setAbout] = useState(user?.about || defaultAbout);
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [discoverableByPhone, setDiscoverableByPhone] = useState(
    user?.discoverableByPhone === true
  );
  const [phoneSlotStatus, setPhoneSlotStatus] = useState<PhoneSlotStatus | null>(null);

  // Security Fields
  const [username, setUsername] = useState(user?.username || '');
  const [appLockPinInput, setAppLockPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken'
  >('idle');
  const [savedOnDevice, setSavedOnDevice] = useState(() => isDeviceAccountSaved(user?.userId));

  // Password Change Fields (ephemeral, cleared on tab change)
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

  // Devices & QR
  const [blockedWarningBanner, setBlockedWarningBanner] = useState<{
    label: string;
    resetSent: boolean;
  } | null>(null);
  const [showDeviceQrScanner, setShowDeviceQrScanner] = useState(false);
  const [qrApproveBusy, setQrApproveBusy] = useState(false);

  // Status & Messages
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatusMessage, setUpdateStatusMessage] = useState<string | null>(null);
  const [notifPermission, setNotifPermission] = useState<AppNotificationPermission>(() =>
    getAppNotificationPermission()
  );

  const flashSuccess = (msg: string, ms = 3500) => {
    setErrorMessage(null);
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), ms);
  };

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setAvatarLoadError(false);
  }, [photoURL]);

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
          bn
            ? 'ওয়েব/পিডব্লিউএ: ব্রাউজারে অ্যাপ সর্বদা লাইভ আপ-টু-ডেট থাকে!'
            : 'Web / PWA: Kept live and up-to-date automatically!'
        );
        return;
      }

      const latest = await getLatestRelease();
      if (latest && isUpdateAvailable(latest)) {
        window.dispatchEvent(
          new CustomEvent('anomah_open_update_modal', { detail: { release: latest } })
        );
        setUpdateStatusMessage(
          bn
            ? `নতুন APK সংস্করণ পাওয়া গেছে (v${latest.versionName})!`
            : `New APK version found (v${latest.versionName})!`
        );
      } else {
        setUpdateStatusMessage(
          bn
            ? `আপনার APK অ্যাপ আপ-টু-ডেট (v${APP_VERSION.versionName})`
            : `Already on latest APK build (v${APP_VERSION.versionName})`
        );
      }
    } catch {
      setUpdateStatusMessage(bn ? 'আপডেট চেক করতে ব্যর্থ হয়েছে' : 'Failed to check updates');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const avatarSeed = encodeURIComponent(user?.displayName || user?.userId || 'AnomahUser');
  const presetAvatars = [
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`,
    `https://api.dicebear.com/7.x/bottts/svg?seed=${avatarSeed}`,
    `https://api.dicebear.com/7.x/lorelei/svg?seed=${avatarSeed}`,
    `https://api.dicebear.com/7.x/notionists/svg?seed=${avatarSeed}`,
    `https://api.dicebear.com/7.x/thumbs/svg?seed=${avatarSeed}`,
    `https://api.dicebear.com/7.x/adventurer/svg?seed=${avatarSeed}`,
  ];

  useEffect(() => {
    setDisplayName(user?.displayName || '');
    setAbout(user?.about || defaultAbout);
    setPhotoURL(user?.photoURL || '');
    setPhoneNumber(user?.phoneNumber || '');
    setDiscoverableByPhone(user?.discoverableByPhone === true);
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

  useEffect(() => {
    if (activeTab !== 'security') {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
    }
  }, [activeTab]);

  useModalHistory(true, onClose);

  useEffect(() => {
    const clean = username.trim().toLowerCase().replace(/^@/, '');
    if (!clean || clean === (user?.username || '') || clean.length < 3) {
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

  const hasProfileChanges =
    displayName.trim() !== (user?.displayName || '').trim() ||
    about.trim() !== (user?.about || defaultAbout).trim() ||
    photoURL !== (user?.photoURL || '') ||
    phoneNumber.trim() !== (user?.phoneNumber || '').trim() ||
    discoverableByPhone !== (user?.discoverableByPhone === true);

  const handleResetProfileDraft = () => {
    setDisplayName(user?.displayName || '');
    setAbout(user?.about || defaultAbout);
    setPhotoURL(user?.photoURL || '');
    setPhoneNumber(user?.phoneNumber || '');
    setDiscoverableByPhone(user?.discoverableByPhone === true);
    setErrorMessage(null);
  };

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
            (bn ? 'দয়া করে সঠিক মোবাইল নম্বর দিন।' : 'Please enter a valid mobile number.')
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

      flashSuccess(t('profileSavedSuccess'), 3000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : t('profileUpdateError'));
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

      flashSuccess(t('profileSavedSuccess'), 3000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : t('profileUpdateError'));
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
      flashSuccess(
        bn ? 'অ্যাপ-লক পিন মুছে ফেলা হয়েছে।' : 'Quick App-Lock PIN removed.',
        3000
      );
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
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      flashSuccess(t('passwordChangedSuccess'), 4000);
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : 'Failed to update password.';
      const lower = rawMsg.toLowerCase();
      if (lower.includes('incorrect')) {
        setErrorMessage(
          bn
            ? 'বর্তমান (পুরনো) পাসওয়ার্ডটি সঠিক নয়। অনুগ্রহ করে যাচাই করে আবার চেষ্টা করুন।'
            : rawMsg
        );
      } else if (lower.includes('too many failed')) {
        setErrorMessage(
          bn
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
      flashSuccess(t('recoveryEmailSent', { email: user.email }), 4000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : t('recoveryEmailFailed'));
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
      setErrorMessage(err instanceof Error ? err.message : 'Failed to schedule deletion.');
    } finally {
      setSaving(false);
    }
  };

  const activeDevicesCount = userSessions.filter((s) => s.status === 'active').length;
  const alertDeviceCount = userSessions.filter(
    (s) =>
      s.status === 'pending_approval' ||
      (s.status === 'active' && s.adminAlertPending)
  ).length;

  type NavItem = {
    id: ProfileTabId;
    label: string;
    icon: typeof User;
    danger?: boolean;
    adminProtected?: boolean;
  };

  const navGroups: Array<{ title: string; items: NavItem[] }> = [
    {
      title: bn ? 'অ্যাকাউন্ট' : 'Account',
      items: [
        { id: 'profile', label: t('tabProfile'), icon: User },
        { id: 'security', label: t('tabSecurity'), icon: Shield },
        { id: 'devices', label: bn ? 'ডিভাইস ও 2FA' : 'Devices & 2FA', icon: Laptop },
      ],
    },
    {
      title: bn ? 'পছন্দসমূহ' : 'Preferences',
      items: [
        { id: 'appearance', label: t('tabAppearance'), icon: Palette },
        { id: 'language', label: t('tabLanguage'), icon: Languages },
      ],
    },
    {
      title: bn ? 'সুরক্ষা ও নিয়ন্ত্রণ' : 'Account Control',
      items: [
        isUserSuperAdmin
          ? {
              id: 'danger',
              label: bn ? 'রুট সুরক্ষা' : 'Root Security',
              icon: Shield,
              adminProtected: true,
            }
          : {
              id: 'danger',
              label: t('tabDanger'),
              icon: Trash2,
              danger: true,
            },
      ],
    },
  ];

  const flatNavItems = navGroups.flatMap((g) => g.items);

  const cooldownInfo = (() => {
    if (!user?.lastPhoneChangedAt || user.phoneChangeCooldownBypass) return null;
    const lastMs = new Date(user.lastPhoneChangedAt).getTime();
    const cooldownMs = 30 * 24 * 60 * 60 * 1000;
    if (!Number.isFinite(lastMs) || Date.now() - lastMs >= cooldownMs) return null;
    return Math.max(
      1,
      Math.ceil((cooldownMs - (Date.now() - lastMs)) / (24 * 60 * 60 * 1000))
    );
  })();

  const effectiveAvatarSrc =
    !avatarLoadError && photoURL
      ? photoURL
      : `https://api.dicebear.com/7.x/bottts/svg?seed=${avatarSeed}`;

  const renderAvatar = (sizeClass: string, ringClass = 'border border-slate-700') => {
    if (avatarLoadError && !photoURL) {
      return (
        <div
          className={`${sizeClass} ${ringClass} rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold text-emerald-400 shrink-0`}
        >
          {(displayName || user?.email || 'A').slice(0, 1).toUpperCase()}
        </div>
      );
    }
    return (
      <img
        src={effectiveAvatarSrc}
        alt={displayName || 'Profile avatar'}
        referrerPolicy="no-referrer"
        onError={() => setAvatarLoadError(true)}
        className={`${sizeClass} ${ringClass} rounded-full object-cover bg-slate-800 shrink-0`}
      />
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl h-[90vh] sm:h-[88vh] max-h-[760px] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Clean Single-Row Modal Header */}
        <div className="h-14 px-4 sm:px-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer border border-slate-800 whitespace-nowrap shrink-0"
              title={t('backToMessenger')}
            >
              <ArrowLeft className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">{t('backToMessenger')}</span>
              <span className="sm:hidden">{t('close')}</span>
            </button>
            <h2 className="text-sm font-bold text-white tracking-tight truncate">
              {t('settingsTitle')}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
            title={t('close')}
            aria-label={t('close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Standard 2-Pane Settings Layout */}
        <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
          {/* Mobile Horizontal Underline Navigation */}
          <div className="sm:hidden bg-slate-950/70 border-b border-slate-800 px-2 flex items-center gap-1 overflow-x-auto scrollbar-none shrink-0">
            {flatNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 min-h-[42px] text-xs font-medium transition cursor-pointer shrink-0 whitespace-nowrap border-b-2 ${
                    isActive
                      ? item.danger
                        ? 'border-rose-500 text-rose-400'
                        : 'border-emerald-500 text-white'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                  {item.id === 'devices' && (
                    <span className="text-[11px] font-mono tabular-nums text-slate-400">
                      ({activeDevicesCount})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Desktop Left Navigation Sidebar */}
          <aside className="hidden sm:flex w-60 bg-slate-950/70 border-r border-slate-800 p-3 flex-col justify-between shrink-0 overflow-y-auto">
            <div className="space-y-4">
              {/* Compact Identity Card */}
              <div className="flex items-center gap-3 px-2 py-2 border-b border-slate-800 pb-3">
                {renderAvatar('w-10 h-10')}
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold text-white block truncate">
                    {displayName || t('noName')}
                  </span>
                  <span className="text-[11px] text-slate-400 block truncate mt-0.5">
                    {user?.username ? `@${user.username}` : user?.email}
                  </span>
                </div>
              </div>

              {/* Grouped Sidebar Sections */}
              <nav className="space-y-4" aria-label="Settings navigation">
                {navGroups.map((group) => (
                  <div key={group.title} className="space-y-1">
                    <div className="px-2.5 pb-0.5 text-[11px] font-semibold text-slate-400">
                      {group.title}
                    </div>
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setActiveTab(item.id)}
                            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer w-full text-left whitespace-nowrap ${
                              isActive
                                ? item.danger
                                  ? 'bg-rose-500/10 text-rose-300 border border-rose-500/25'
                                  : item.adminProtected
                                  ? 'bg-slate-800 text-emerald-400 border border-emerald-500/25'
                                  : 'bg-slate-800 text-white border border-slate-700/80'
                                : item.danger
                                ? 'text-rose-400 hover:bg-rose-500/10 border border-transparent'
                                : item.adminProtected
                                ? 'text-emerald-400 hover:bg-slate-800/50 border border-transparent'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'
                            }`}
                          >
                            <span className="flex items-center gap-2.5 min-w-0">
                              <Icon className="w-4 h-4 shrink-0" />
                              <span className="truncate">{item.label}</span>
                            </span>
                            {item.id === 'devices' && (
                              <span className="flex items-center gap-1.5 shrink-0">
                                {alertDeviceCount > 0 && (
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                                )}
                                <span className="text-[11px] font-mono tabular-nums text-slate-400">
                                  {activeDevicesCount}
                                </span>
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>

              {/* Super Admin Console Shortcut */}
              {isUserSuperAdmin && onOpenAdmin && (
                <div className="pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAdmin();
                    }}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 border border-slate-800 transition cursor-pointer w-full whitespace-nowrap"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="truncate">{t('superAdminBadge')}</span>
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80 shrink-0" />
                  </button>
                </div>
              )}
            </div>

            {/* Sidebar Footer (Install / Version) */}
            <div className="space-y-2 pt-3 mt-4 border-t border-slate-800">
              <PWAInstallButton variant="sidebar" />

              {isNativeApkApp() && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] text-slate-400">
                      {bn ? 'অ্যাপ সংস্করণ' : 'Version'}
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-slate-300">
                      v{APP_VERSION.versionName}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCheckForUpdates}
                    disabled={checkingUpdate}
                    className="w-full py-2 px-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-[11px] font-medium border border-slate-800 flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    {checkingUpdate ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                        <span>{bn ? 'যাচাই হচ্ছে...' : 'Checking...'}</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3 h-3 text-emerald-400" />
                        <span>{bn ? 'আপডেট চেক করুন' : 'Check Updates'}</span>
                      </>
                    )}
                  </button>

                  {updateStatusMessage && (
                    <p className="text-[11px] text-center text-slate-400 px-1 leading-snug">
                      {updateStatusMessage}
                    </p>
                  )}
                </div>
              )}
            </div>
          </aside>

          {/* Right Content Canvas */}
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
            <div className="flex-1 overflow-y-auto p-4 sm:p-7">
              <div className="max-w-2xl mx-auto">
                {successMessage && (
                  <div className="mb-5 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center gap-2.5">
                    <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>{successMessage}</span>
                  </div>
                )}

                {errorMessage && (
                  <div className="mb-5 px-4 py-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* TAB 1: Profile Info */}
                {activeTab === 'profile' && (
                  <form id="profile-form" onSubmit={handleSaveProfile} className="space-y-6">
                    {/* Profile Identity Summary */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
                      <div className="flex items-center gap-4 min-w-0">
                        {renderAvatar(
                          'w-16 h-16',
                          'border-2 border-emerald-500/70'
                        )}
                        <div className="min-w-0">
                          <h4 className="text-base font-bold text-white tracking-tight truncate">
                            {displayName || t('noName')}
                          </h4>
                          <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400 mt-0.5">
                            {user?.username && (
                              <>
                                <span className="font-mono text-emerald-400">
                                  @{user.username}
                                </span>
                                <span aria-hidden="true">·</span>
                              </>
                            )}
                            <span className="truncate">{user?.email}</span>
                          </div>
                          {isUserSuperAdmin && onOpenAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onOpenAdmin();
                              }}
                              className="sm:hidden mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 cursor-pointer"
                            >
                              <Shield className="w-3.5 h-3.5" />
                              <span>{t('superAdminBadge')}</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {onOpenShareQR && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenShareQR();
                          }}
                          className="self-start sm:self-center px-3.5 py-2 rounded-xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-200 inline-flex items-center gap-2 transition cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{bn ? 'আমার QR কোড' : 'My QR Code'}</span>
                        </button>
                      )}
                    </div>

                    {/* Avatar Selection Strip */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2 px-0.5">
                        <label className="text-xs font-semibold text-slate-400">
                          {t('chooseAvatar')}
                        </label>
                        {firebaseUser?.photoURL &&
                          photoURL !== firebaseUser.photoURL && (
                            <button
                              type="button"
                              onClick={() => setPhotoURL(firebaseUser.photoURL || '')}
                              className="text-[11px] font-medium text-emerald-400 hover:underline cursor-pointer"
                            >
                              {bn ? 'Google ছবি ব্যবহার করুন' : 'Use Google Photo'}
                            </button>
                          )}
                      </div>

                      <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl flex flex-wrap items-center gap-3">
                        {presetAvatars.map((url, i) => {
                          const isSelected = photoURL === url;
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setPhotoURL(url)}
                              className={`relative w-11 h-11 rounded-full cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                                isSelected
                                  ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900 opacity-100'
                                  : 'opacity-75 hover:opacity-100 border border-slate-800'
                              }`}
                              aria-label={`Avatar preset ${i + 1}`}
                              aria-pressed={isSelected}
                            >
                              <img
                                src={url}
                                alt={`Avatar option ${i + 1}`}
                                referrerPolicy="no-referrer"
                                className="w-full h-full rounded-full object-cover bg-slate-800"
                              />
                              {isSelected && (
                                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow">
                                  <Check className="w-2.5 h-2.5" />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Section 1: Public Profile Fields */}
                    <div className="space-y-2.5">
                      <div className="text-xs font-semibold text-slate-400 px-0.5">
                        {bn ? 'প্রাথমিক পরিচয়' : 'Public Identity'}
                      </div>

                      <div className="p-4 sm:p-5 bg-slate-950/60 border border-slate-800 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-medium text-slate-300">
                            {t('displayNameLabel')}
                          </label>
                          <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full min-h-[38px] px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 transition"
                            placeholder={t('displayNamePlaceholder')}
                            required
                          />
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <label className="block text-xs font-medium text-slate-300">
                              {t('aboutLabel')}
                            </label>
                            <span className="text-[11px] font-mono tabular-nums text-slate-400">
                              {about.length}/150
                            </span>
                          </div>
                          <input
                            type="text"
                            value={about}
                            onChange={(e) => setAbout(e.target.value)}
                            className="w-full min-h-[38px] px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 transition"
                            placeholder={t('aboutPlaceholder')}
                            maxLength={150}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Mobile Number, Privacy & Quick Share */}
                    <div className="space-y-2.5">
                      <div className="text-xs font-semibold text-slate-400 px-0.5">
                        {bn ? 'ব্যক্তিগত নম্বর ও প্রাইভেসি' : 'Private Contact & Discovery'}
                      </div>

                      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl divide-y divide-slate-800/80 overflow-hidden">
                        {/* Mobile Number Row */}
                        <div className="p-4 sm:p-5 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <label className="block text-xs font-semibold text-white">
                              {bn
                                ? 'মোবাইল নম্বর (ব্যক্তিগত — পরিচয় ও সাপোর্ট)'
                                : 'Mobile Number (Private — Identity & Support)'}
                            </label>
                            {phoneSlotStatus && (
                              <span
                                className={`text-[11px] font-mono tabular-nums font-medium ${
                                  phoneSlotStatus.isBlocked &&
                                  !phoneSlotStatus.containsUid(user?.userId)
                                    ? 'text-rose-400'
                                    : phoneSlotStatus.usedSlots >= phoneSlotStatus.maxLimit &&
                                      !phoneSlotStatus.containsUid(user?.userId)
                                    ? 'text-amber-400'
                                    : 'text-emerald-400'
                                }`}
                              >
                                {phoneSlotStatus.isBlocked &&
                                !phoneSlotStatus.containsUid(user?.userId)
                                  ? bn
                                    ? 'নম্বর ব্লকড'
                                    : 'Blocked'
                                  : bn
                                  ? `স্লট: ${phoneSlotStatus.usedSlots}/${phoneSlotStatus.maxLimit}`
                                  : `Slots: ${phoneSlotStatus.usedSlots}/${phoneSlotStatus.maxLimit}`}
                              </span>
                            )}
                          </div>

                          <div className="relative">
                            <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="tel"
                              value={phoneNumber}
                              onChange={(e) => setPhoneNumber(e.target.value)}
                              className="w-full min-h-[38px] pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 font-mono transition"
                              placeholder="+880 1XXX-XXXXXX"
                              maxLength={50}
                              required
                            />
                          </div>

                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            {bn
                              ? 'আপনার নম্বর কখনোই প্রোফাইলে প্রদর্শিত হয় না; প্রতি নম্বরে সর্বোচ্চ ৩টি অ্যাকাউন্ট অনুমোদিত।'
                              : 'Never displayed publicly; maximum 3 accounts allowed per mobile number.'}
                          </p>

                          {user?.initialPhoneNumber &&
                            user.initialPhoneNumber !== user.phoneNumber && (
                              <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                                <span>
                                  {bn ? 'প্রথম রেজিস্ট্রিকৃত নম্বর:' : 'First Registered Number:'}
                                </span>
                                <span className="font-mono text-amber-300">
                                  {user.initialPhoneNumber}
                                </span>
                              </div>
                            )}

                          {cooldownInfo && (
                            <div className="px-3 py-2 bg-amber-950/25 border border-amber-500/30 rounded-xl text-[11px] text-amber-200 flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>
                                {bn
                                  ? `নম্বর পরিবর্তনের ৩০-দিনের নিরাপত্তা কুলডাউন সক্রিয় (${cooldownInfo} দিন বাকি)।`
                                  : `30-day number change cooldown active (${cooldownInfo} day(s) left).`}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Exact-Number Discovery Toggle */}
                        <div className="p-4 sm:px-5 flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white">
                              {bn
                                ? 'সঠিক মোবাইল নম্বর দিয়ে বন্ধুদের খুঁজতে দিন'
                                : 'Allow friends to find me by exact mobile number'}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                              {bn
                                ? 'কেবল যার কাছে আপনার পুরো নম্বর আছে সেই সার্চ করতে পারবে (গোপন হ্যাশ হিসেবে থাকে)।'
                                : 'Stored as a one-way cryptographic hash — strangers cannot see your number.'}
                            </p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={discoverableByPhone}
                            onClick={() => setDiscoverableByPhone((prev) => !prev)}
                            className={`w-11 h-6 rounded-full transition relative shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
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

                        {/* Personal Chat Link & QR Row */}
                        {onOpenShareQR && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenShareQR();
                            }}
                            className="w-full p-4 sm:px-5 hover:bg-slate-800/40 text-xs font-semibold text-emerald-400 flex items-center justify-between gap-3 transition cursor-pointer text-left"
                          >
                            <span className="flex items-center gap-3 min-w-0">
                              <span className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 shrink-0">
                                <QrCode className="w-4 h-4" />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate">
                                  {bn
                                    ? 'আমার পার্সোনাল চ্যাট লিংক ও QR কোড দেখুন'
                                    : 'View My Personal Chat Link & QR Code'}
                                </span>
                                <span className="block text-[11px] font-normal text-slate-400 mt-0.5">
                                  {bn
                                    ? 'বন্ধুদের সাথে সরাসরি লিংক বা QR শেয়ার করুন'
                                    : 'Share your direct encrypted invite link or QR'}
                                </span>
                              </span>
                            </span>
                            <ExternalLink className="w-3.5 h-3.5 opacity-80 shrink-0" />
                          </button>
                        )}
                      </div>
                    </div>
                  </form>
                )}

                {/* TAB 2: Security & PIN */}
                {activeTab === 'security' && (
                  <ProfileSecuritySection
                    language={language}
                    t={t}
                    user={user}
                    firebaseUser={firebaseUser}
                    hasPasswordProvider={hasPasswordProvider}
                    saving={saving}
                    username={username}
                    setUsername={setUsername}
                    usernameStatus={usernameStatus}
                    appLockPinInput={appLockPinInput}
                    setAppLockPinInput={setAppLockPinInput}
                    showPin={showPin}
                    setShowPin={setShowPin}
                    savedOnDevice={savedOnDevice}
                    onToggleSavedOnDevice={() => {
                      if (!user?.userId) return;
                      if (savedOnDevice) {
                        removeSavedDeviceAccount(user.userId);
                        setSavedOnDevice(false);
                        flashSuccess(
                          bn
                            ? 'এই ডিভাইস থেকে শর্টকাট কার্ড সরানো হয়েছে।'
                            : 'Account shortcut card removed from this device.',
                          3000
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
                        flashSuccess(
                          bn
                            ? 'এই ডিভাইসে অ্যাকাউন্ট শর্টকাট কার্ড সংরক্ষণ করা হয়েছে।'
                            : 'Account shortcut card saved on this device.',
                          3000
                        );
                      }
                    }}
                    currentPassword={currentPassword}
                    setCurrentPassword={setCurrentPassword}
                    newPassword={newPassword}
                    setNewPassword={setNewPassword}
                    confirmPassword={confirmPassword}
                    setConfirmPassword={setConfirmPassword}
                    showCurrentPassword={showCurrentPassword}
                    setShowCurrentPassword={setShowCurrentPassword}
                    showNewPassword={showNewPassword}
                    setShowNewPassword={setShowNewPassword}
                    onSaveSecurityAndPin={handleSaveSecurityAndPin}
                    onLockAppNow={() => {
                      onClose();
                      lockAppNow();
                    }}
                    onRemoveAppLock={handleRemoveAppLock}
                    onChangePassword={handleChangePassword}
                    onSendResetEmail={handleSendResetEmail}
                    onResendVerification={async () => {
                      setSaving(true);
                      setErrorMessage(null);
                      try {
                        await resendVerificationEmail();
                        flashSuccess(
                          bn
                            ? 'ভেরিফিকেশন ইমেইল পাঠানো হয়েছে! আপনার ইনবক্স দেখুন।'
                            : 'Verification email sent! Please check your inbox.'
                        );
                      } catch (e: unknown) {
                        setErrorMessage(
                          e instanceof Error ? e.message : 'Failed to send verification email.'
                        );
                      } finally {
                        setSaving(false);
                      }
                    }}
                  />
                )}

                {/* TAB 3: Devices & 2FA */}
                {activeTab === 'devices' && (
                  <ProfileDevicesSection
                    language={language}
                    t={t}
                    user={user}
                    hasPasswordProvider={hasPasswordProvider}
                    isVerifiedSuperAdmin={isVerifiedSuperAdmin}
                    userSessions={userSessions}
                    currentDeviceId={currentDeviceId}
                    deviceLimitsSummary={deviceLimitsSummary}
                    globalSecuritySettings={globalSecuritySettings}
                    publicAuthFlags={publicAuthFlags}
                    approvePendingDevice={approvePendingDevice}
                    acknowledgeAdminAlert={acknowledgeAdminAlert}
                    trustOrUntrustDevice={trustOrUntrustDevice}
                    forceLogoutOtherDevice={forceLogoutOtherDevice}
                    logoutAllOtherDevices={logoutAllOtherDevices}
                    removeDeviceHistoryItem={removeDeviceHistoryItem}
                    blockDeviceWithVerification={blockDeviceWithVerification}
                    updateOptionalDevice2FA={updateOptionalDevice2FA}
                    onOpenQrScanner={() => setShowDeviceQrScanner(true)}
                    qrApproveBusy={qrApproveBusy}
                    blockedWarningBanner={blockedWarningBanner}
                    onDismissBlockedBanner={() => setBlockedWarningBanner(null)}
                    savingReset={saving}
                    onSendResetFromBlocked={async () => {
                      if (!user?.email) return;
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
                            : bn
                            ? 'পাসওয়ার্ড রিসেট ইমেইল পাঠানো যায়নি।'
                            : 'Failed to send password reset email.'
                        );
                      } finally {
                        setSaving(false);
                      }
                    }}
                    onSuccess={(msg) => flashSuccess(msg)}
                    onError={(msg) => setErrorMessage(msg)}
                    onDeviceBlocked={(label) =>
                      setBlockedWarningBanner({ label, resetSent: false })
                    }
                  />
                )}

                {/* TAB 4: Appearance & Notifications */}
                {activeTab === 'appearance' && (
                  <div className="space-y-6">
                    <div className="pb-4 border-b border-slate-800">
                      <h4 className="text-base font-bold text-white tracking-tight">
                        {t('appearanceTitle')}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {t('appearanceSubtitle')}
                      </p>
                    </div>

                    {/* Visual Theme Selector Cards */}
                    <div className="space-y-2.5">
                      <div className="text-xs font-semibold text-slate-400 px-0.5">
                        {bn ? 'রঙ ও থিম নির্বাচন' : 'Theme Mode'}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          {
                            id: 'deep-slate' as ThemeMode,
                            nameKey: 'themeDeepSlateName',
                            descKey: 'themeDeepSlateDesc',
                            icon: Moon,
                            canvasClass: 'bg-[#0b1120] border-[#1e293b]',
                            sidebarClass: 'bg-[#020617] border-[#1e293b]',
                            bubbleInClass: 'bg-[#1e293b]',
                            bubbleOutClass: 'bg-[#059669]',
                          },
                          {
                            id: 'minimal-light' as ThemeMode,
                            nameKey: 'themeMinimalLightName',
                            descKey: 'themeMinimalLightDesc',
                            icon: Sun,
                            canvasClass: 'bg-[#f8fafc] border-[#e2e8f0]',
                            sidebarClass: 'bg-[#ffffff] border-[#e2e8f0]',
                            bubbleInClass: 'bg-[#e2e8f0]',
                            bubbleOutClass: 'bg-[#059669]',
                          },
                          {
                            id: 'telegram-blue' as ThemeMode,
                            nameKey: 'themeTelegramBlueName',
                            descKey: 'themeTelegramBlueDesc',
                            icon: Compass,
                            canvasClass: 'bg-[#0e1621] border-[#2b394a]',
                            sidebarClass: 'bg-[#17212b] border-[#2b394a]',
                            bubbleInClass: 'bg-[#182533]',
                            bubbleOutClass: 'bg-[#2b5278]',
                          },
                        ].map((item) => {
                          const Icon = item.icon;
                          const isSelected = theme === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setTheme(item.id)}
                              className={`p-3 rounded-2xl text-left transition cursor-pointer flex flex-col gap-3 border ${
                                isSelected
                                  ? 'bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/15'
                                  : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/40'
                              }`}
                            >
                              {/* Authentic Mini UI Preview Swatch */}
                              <div
                                className={`w-full h-20 rounded-xl border overflow-hidden flex ${item.canvasClass}`}
                              >
                                <div
                                  className={`w-8 h-full border-r p-1.5 flex flex-col gap-1.5 ${item.sidebarClass}`}
                                >
                                  <span className="w-4 h-4 rounded-full bg-[#10b981]/30 block" />
                                  <span className="w-full h-1 rounded-full bg-current opacity-15 block" />
                                  <span className="w-3/4 h-1 rounded-full bg-current opacity-10 block" />
                                </div>
                                <div className="flex-1 p-2 flex flex-col justify-between">
                                  <div className="flex flex-col gap-1.5">
                                    <span
                                      className={`w-3/4 h-3 rounded-lg block ${item.bubbleInClass}`}
                                    />
                                    <span
                                      className={`w-2/3 h-3 rounded-lg self-end block ${item.bubbleOutClass}`}
                                    />
                                  </div>
                                  <span
                                    className={`w-full h-2.5 rounded-md block opacity-75 ${item.sidebarClass}`}
                                  />
                                </div>
                              </div>

                              {/* Title & Selection Indicator */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <Icon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    <span className="text-xs font-bold text-white truncate">
                                      {t(item.nameKey as Parameters<typeof t>[0])}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                    {t(item.descKey as Parameters<typeof t>[0])}
                                  </p>
                                </div>
                                {isSelected && (
                                  <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                                    <Check className="w-3.5 h-3.5" />
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Message & Call Notifications */}
                    {isAppNotificationSupported() && (
                      <div className="space-y-2.5">
                        <div className="text-xs font-semibold text-slate-400 px-0.5">
                          {bn ? 'নোটিফিকেশন ও অ্যালার্ট' : 'Notifications & Alerts'}
                        </div>

                        <div className="p-4 sm:p-5 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3.5">
                              <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 shrink-0">
                                <Bell className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-semibold text-white">
                                    {bn
                                      ? 'মেসেজ ও কল নোটিফিকেশন'
                                      : 'Message & Call Notifications'}
                                  </span>
                                  <span
                                    className={`text-[11px] font-semibold ${
                                      notifPermission === 'granted'
                                        ? 'text-emerald-400'
                                        : notifPermission === 'denied'
                                        ? 'text-rose-400'
                                        : 'text-amber-400'
                                    }`}
                                  >
                                    ·{' '}
                                    {notifPermission === 'granted'
                                      ? bn
                                        ? 'চালু'
                                        : 'Active'
                                      : notifPermission === 'denied'
                                      ? bn
                                        ? 'ব্লক করা'
                                        : 'Blocked'
                                      : bn
                                      ? 'বন্ধ'
                                      : 'Off'}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                                  {bn
                                    ? 'অ্যাপ মিনিমাইজ অবস্থায় নতুন মেসেজ ও ইনকামিং কলের রিং-অ্যালার্ট পেতে এটি চালু রাখুন।'
                                    : 'Keep alerts enabled for new messages and incoming calls while minimized.'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {notifPermission !== 'granted' && (
                            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
                              <span className="text-[11px] text-slate-400">
                                {notifPermission === 'denied'
                                  ? bn
                                    ? 'ফোন/ব্রাউজার সেটিংস থেকে নোটিফিকেশন Allow করে দিন।'
                                    : 'Allow notifications in device or browser site settings.'
                                  : bn
                                  ? '১ ক্লিকেই অনুমতি সক্রিয় করুন।'
                                  : 'Click to grant notification permission.'}
                              </span>
                              <button
                                type="button"
                                onClick={async () => {
                                  const next = await requestAppNotificationPermission();
                                  setNotifPermission(next);
                                }}
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-semibold cursor-pointer transition shrink-0 whitespace-nowrap"
                              >
                                {bn ? 'চালু করুন' : 'Enable'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Mobile App & Updates Access (mirrors Desktop Sidebar Footer cleanly) */}
                    <div className="sm:hidden space-y-2.5">
                      <div className="text-xs font-semibold text-slate-400 px-0.5">
                        {bn ? 'অ্যাপ ও আপডেট' : 'App & Updates'}
                      </div>
                      <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
                        <PWAInstallButton variant="sidebar" />
                        {isNativeApkApp() && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-400">
                                {bn ? 'অ্যাপ সংস্করণ' : 'App Version'}
                              </span>
                              <span className="font-mono tabular-nums text-white">
                                v{APP_VERSION.versionName}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={handleCheckForUpdates}
                              disabled={checkingUpdate}
                              className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-xl text-xs font-medium border border-slate-800 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                            >
                              {checkingUpdate ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                              ) : (
                                <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                              )}
                              <span>
                                {checkingUpdate
                                  ? bn
                                    ? 'যাচাই হচ্ছে...'
                                    : 'Checking...'
                                  : bn
                                  ? 'আপডেট চেক করুন'
                                  : 'Check Updates'}
                              </span>
                            </button>
                            {updateStatusMessage && (
                              <p className="text-[11px] text-center text-slate-400">
                                {updateStatusMessage}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 5: Language */}
                {activeTab === 'language' && (
                  <div className="space-y-6">
                    <div className="pb-4 border-b border-slate-800">
                      <h4 className="text-base font-bold text-white tracking-tight">
                        {t('languageSettingsTitle')}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {t('languageSettingsSubtitle')}
                      </p>
                    </div>

                    <div className="space-y-2.5">
                      <div className="text-xs font-semibold text-slate-400 px-0.5">
                        {bn ? 'ইন্টারফেসের ভাষা' : 'Interface Language'}
                      </div>

                      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl divide-y divide-slate-800/80 overflow-hidden">
                        {[
                          {
                            id: 'en' as const,
                            glyph: 'Aa',
                            nameKey: 'langEnglishName',
                            descKey: 'langEnglishDesc',
                          },
                          {
                            id: 'bn' as const,
                            glyph: 'অআ',
                            nameKey: 'langBengaliName',
                            descKey: 'langBengaliDesc',
                          },
                        ].map((item) => {
                          const isSelected = language === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setLanguage(item.id)}
                              className={`w-full p-4 sm:px-5 text-left transition cursor-pointer flex items-center justify-between gap-3 ${
                                isSelected ? 'bg-emerald-500/10' : 'hover:bg-slate-800/40'
                              }`}
                            >
                              <div className="flex items-center gap-3.5 min-w-0">
                                <span className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0">
                                  {item.glyph}
                                </span>
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-white">
                                    {t(item.nameKey as Parameters<typeof t>[0])}
                                  </div>
                                  <div className="text-[11px] text-slate-400 mt-0.5">
                                    {t(item.descKey as Parameters<typeof t>[0])}
                                  </div>
                                </div>
                              </div>
                              {isSelected && (
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 shrink-0 whitespace-nowrap">
                                  <Check className="w-4 h-4" />
                                  <span>{t('currentLanguageBadge')}</span>
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 6: Account Safety / Danger Zone */}
                {activeTab === 'danger' &&
                  (isUserSuperAdmin ? (
                    <div className="space-y-6">
                      <div className="pb-4 border-b border-slate-800">
                        <h4 className="text-base font-bold text-white tracking-tight">
                          {bn ? 'সুপার অ্যাডমিন রুট সুরক্ষা' : 'Super Admin Root Protection'}
                        </h4>
                        <p className="text-xs text-slate-400 mt-1 font-mono">{SUPER_ADMIN_EMAIL}</p>
                      </div>

                      <div className="p-4 sm:p-5 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3 text-xs text-slate-300 leading-relaxed">
                        <p>
                          {bn
                            ? 'এই অ্যাকাউন্টটি (chinisdramaorg@gmail.com) সিস্টেমের মূল অ্যাডমিনিস্ট্রেটর অ্যাকাউন্ট। প্ল্যাটফর্মের নিরাপত্তা ও পরিচালন ব্যবস্থা অক্ষুণ্ণ রাখতে এই অ্যাকাউন্ট ডিলিট করার অপশন স্থায়ীভাবে নিষ্ক্রিয় রাখা হয়েছে।'
                            : 'This account is the Master Super Admin Root Account. To protect platform continuity and security governance, account deletion is permanently locked.'}
                        </p>
                        <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs pt-2 border-t border-slate-800/80">
                          <Check className="w-4 h-4 shrink-0" />
                          <span>
                            {bn
                              ? 'ভুলবশত ক্লিক করলেও কোনো প্রকার ডিলিট হওয়ার সুযোগ নেই।'
                              : 'Permanent deletion lockout active.'}
                          </span>
                        </div>
                      </div>

                      {onOpenAdmin && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenAdmin();
                            }}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold cursor-pointer transition inline-flex items-center gap-2 whitespace-nowrap"
                          >
                            <Shield className="w-4 h-4" />
                            <span>{bn ? 'অ্যাডমিন প্যানেল খুলুন' : 'Open Admin Console'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="pb-4 border-b border-slate-800">
                        <h4 className="text-base font-bold text-rose-400 tracking-tight flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          <span>{t('dangerZoneTitle')}</span>
                        </h4>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          {bn
                            ? 'স্থায়ীভাবে অ্যাকাউন্ট মুছে ফেলার সময়সূচী ও তথ্য সুরক্ষা নিয়মাবলি।'
                            : 'Permanent account deletion scheduling and 15-day grace policy.'}
                        </p>
                      </div>

                      <div className="p-4 sm:p-5 bg-rose-950/15 border border-rose-900/40 rounded-2xl space-y-4">
                        <p className="text-xs text-slate-300 leading-relaxed">{t('dangerZoneP1')}</p>
                        <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4 leading-relaxed">
                          <li>{t('dangerZoneL1')}</li>
                          <li>{t('dangerZoneL2')}</li>
                          <li>{t('dangerZoneL3')}</li>
                        </ul>
                        <div className="pt-3 border-t border-rose-500/20 flex justify-end">
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteModal(true)}
                            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer whitespace-nowrap"
                          >
                            {t('scheduleDeletionBtn')}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Sticky Footer Save Action for Profile Tab */}
            {activeTab === 'profile' && (
              <div className="px-4 sm:px-7 py-3 bg-slate-950/70 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
                <span className="text-[11px] text-slate-400 truncate">
                  {hasProfileChanges
                    ? bn
                      ? 'সংরক্ষিত নয় এমন পরিবর্তন রয়েছে'
                      : 'Unsaved changes'
                    : bn
                    ? 'প্রোফাইল তথ্য হালনাগাদ রয়েছে'
                    : 'All changes saved'}
                </span>

                <div className="flex items-center gap-2 shrink-0">
                  {hasProfileChanges && (
                    <button
                      type="button"
                      onClick={handleResetProfileDraft}
                      disabled={saving}
                      className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{bn ? 'রিসেট' : 'Discard'}</span>
                    </button>
                  )}

                  <button
                    type="submit"
                    form="profile-form"
                    disabled={saving || !displayName.trim() || !hasProfileChanges}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{saving ? t('saving') : t('saveProfileBtn')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Account Deletion Confirmation Modal */}
        {confirmDeleteModal && (
          <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
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
                  className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmScheduleDelete}
                  disabled={saving || deleteConfirmationText.trim().toUpperCase() !== 'DELETE'}
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  {t('confirm')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* QR Code Device Approval Scanner */}
        {showDeviceQrScanner && (
          <QrScannerModal
            mode="device_approve"
            onClose={() => setShowDeviceQrScanner(false)}
            onDeviceApproveQr={async (payload) => {
              setShowDeviceQrScanner(false);
              setQrApproveBusy(true);
              setErrorMessage(null);
              try {
                const approvedSession = await approveDeviceByQr(payload);
                flashSuccess(
                  bn
                    ? `"${approvedSession.deviceLabel}" ডিভাইসটি QR স্ক্যানের মাধ্যমে অনুমোদন দেওয়া হয়েছে!`
                    : `Approved "${approvedSession.deviceLabel}" via QR scan!`,
                  4000
                );
              } catch (err) {
                setErrorMessage(
                  err instanceof Error
                    ? err.message
                    : bn
                    ? 'QR দিয়ে ডিভাইস অনুমোদন দেওয়া যায়নি।'
                    : 'Failed to approve device via QR.'
                );
              } finally {
                setQrApproveBusy(false);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
