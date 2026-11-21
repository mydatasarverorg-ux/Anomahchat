import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updatePassword,
  deleteUser,
  updateProfile as updateFirebaseProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, updateDoc, onSnapshot, deleteField } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase/config';
import {
  syncUserProfile,
  syncDirectoryEntry,
  setPresence,
  saveAppLockPin,
  removeAppLockPin,
  verifyAppLockPin,
  scheduleAccountDeletion,
  restoreAccount,
  checkAccountDeletionStatus,
  isUsernameAvailable,
  hashPhoneForDirectory,
} from '../services/chatService';
import {
  consumeRememberDevicePending,
  isDeviceAccountSaved,
  saveDeviceAccount,
} from '../utils/accountShortcut';
import { isSuperAdmin, SUPER_ADMIN_EMAIL } from '../services/adminService';
import { getCanonicalPhoneKey, validateMobileNumber } from '../utils/phoneUtils';
import {
  claimPhoneSlot,
  switchPhoneSlot,
  releasePhoneSlot,
  formatPhoneLimitError,
} from '../services/phoneRegistryService';
import {
  DEFAULT_ADMIN_SECURITY_SETTINGS,
  DEFAULT_SECURITY_SETTINGS,
  acknowledgeAdminLoginSession,
  approveDeviceSession,
  getOrCreateDeviceId,
  logoutAllOtherDeviceSessions,
  markDeviceSessionLoggedOut,
  registerOrSyncDeviceSession,
  rejectDeviceSession,
  remoteLogoutDeviceSession,
  removeSessionHistoryRecord,
  resolveEffectiveDeviceLimits,
  retryRejectedDeviceSession,
  subscribeToAdminSecuritySettings,
  subscribeToGlobalSecuritySettings,
  subscribeToUserDeviceSessions,
  toggleDeviceTrust,
} from '../services/deviceSessionService';
import type {
  AdminSecuritySettings,
  AppSecuritySettings,
  DeviceSession,
  PhoneChangeHistoryEntry,
  ThemeMode,
  UserProfile,
} from '../types/chat';

function getActiveLanguage(): 'en' | 'bn' {
  try {
    return localStorage.getItem('anomah_chat_language') === 'bn' ? 'bn' : 'en';
  } catch {
    return 'en';
  }
}

export interface OwnerVerificationInput {
  password?: string;
  verifyGoogle?: boolean;
  allowPopupFallback?: boolean;
  appLockPin?: string;
  confirmedEmail?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  authError: string | null;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  deletionNotice: { daysRemaining: number } | null;
  isAppLocked: boolean;
  unlockAppWithPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  setAppLockPin: (pin: string) => Promise<void>;
  clearAppLockPin: () => Promise<void>;
  lockAppNow: () => void;
  resendVerificationEmail: () => Promise<void>;
  recoverAccount: () => Promise<void>;
  requestAccountDeletion: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (
    email: string,
    pass: string,
    name: string,
    username?: string,
    phoneNumber?: string
  ) => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  changePassword: (currentPass: string, newPass: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  savePhoneNumber: (phoneNumber: string, username?: string, discoverableByPhone?: boolean) => Promise<void>;
  updateProfile: (
    displayName: string,
    about: string,
    photoURL: string,
    username?: string,
    phoneNumber?: string,
    discoverableByPhone?: boolean
  ) => Promise<void>;
  clearAuthError: () => void;
  currentDeviceId: string;
  currentDeviceSession: DeviceSession | null;
  userSessions: DeviceSession[];
  pendingApprovalSessions: DeviceSession[];
  adminAlertSessions: DeviceSession[];
  isVerifiedSuperAdmin: boolean;
  deviceLimitsSummary: { mobile: number; web: number };
  hasPasswordProvider: boolean;
  approvePendingDevice: (targetDeviceId: string) => Promise<void>;
  rejectPendingDevice: (
    targetDeviceId: string,
    verification?: OwnerVerificationInput
  ) => Promise<void>;
  acknowledgeAdminAlert: (targetDeviceId: string, trustDevice: boolean) => Promise<void>;
  blockDeviceWithVerification: (
    targetDeviceId: string,
    verification?: OwnerVerificationInput
  ) => Promise<void>;
  trustOrUntrustDevice: (targetDeviceId: string, trusted: boolean) => Promise<void>;
  logoutAllOtherDevices: () => Promise<number>;
  removeDeviceHistoryItem: (targetDeviceId: string) => Promise<void>;
  retryCurrentDeviceApproval: () => Promise<void>;
  selfApproveCurrentDeviceWithPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  forceLogoutOtherDevice: (targetDeviceId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_UNLOCK_PREFIX = 'anomah_pin_unlocked_';

function markPinSessionUnlocked(uid: string) {
  try {
    sessionStorage.setItem(`${SESSION_UNLOCK_PREFIX}${uid}`, '1');
  } catch {
    // ignore storage limits
  }
}

function clearPinSessionUnlocked(uid: string) {
  try {
    sessionStorage.removeItem(`${SESSION_UNLOCK_PREFIX}${uid}`);
  } catch {
    // ignore
  }
}

function isPinSessionUnlocked(uid: string): boolean {
  try {
    return sessionStorage.getItem(`${SESSION_UNLOCK_PREFIX}${uid}`) === '1';
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [deletionNotice, setDeletionNotice] = useState<{ daysRemaining: number } | null>(null);
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [currentDeviceId] = useState<string>(() => getOrCreateDeviceId());
  const [userSessions, setUserSessions] = useState<DeviceSession[]>([]);
  const [currentDeviceSession, setCurrentDeviceSession] = useState<DeviceSession | null>(null);
  const [globalSecuritySettings, setGlobalSecuritySettings] =
    useState<AppSecuritySettings>(DEFAULT_SECURITY_SETTINGS);
  const [adminSecuritySettings, setAdminSecuritySettings] =
    useState<AdminSecuritySettings>(DEFAULT_ADMIN_SECURITY_SETTINGS);

  // Prevents locking the user out immediately during an explicit login/signup action
  const explicitAuthInProgressRef = useRef(false);
  const knownPendingAlertIdsRef = useRef<Set<string>>(new Set());
  const knownAdminAlertIdsRef = useRef<Set<string>>(new Set());
  const wasSessionActiveRef = useRef(false);

  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('anomah_chat_theme') as ThemeMode;
    return saved || 'deep-slate';
  });

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem('anomah_chat_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute(
        'content',
        newTheme === 'minimal-light' ? '#f8fafc' : newTheme === 'telegram-blue' ? '#0e1621' : '#0b1120'
      );
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute(
        'content',
        theme === 'minimal-light' ? '#f8fafc' : theme === 'telegram-blue' ? '#0e1621' : '#0b1120'
      );
    }
  }, [theme]);

  // Clean up any legacy insecure localStorage keys from older builds
  useEffect(() => {
    try {
      localStorage.removeItem('anomah_active_pin_user');
    } catch {
      // ignore
    }
  }, []);

  // Presence & Heartbeat tracking (only while unlocked)
  useEffect(() => {
    if (!user?.userId || isAppLocked) return;

    setPresence(user.userId, true);

    const heartbeat = setInterval(() => {
      if (document.visibilityState === 'visible') {
        setPresence(user.userId, true, 1);
      }
    }, 60000);

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        setPresence(user.userId, false);
      } else {
        setPresence(user.userId, true);
      }
    };

    const handleTeardown = () => {
      setPresence(user.userId, false);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handleTeardown);
    window.addEventListener('beforeunload', handleTeardown);

    return () => {
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handleTeardown);
      window.removeEventListener('beforeunload', handleTeardown);
    };
  }, [user?.userId, isAppLocked]);

  // Live synchronization of current user profile (ban status, unban, warnings, app lock)
  useEffect(() => {
    if (!user?.userId) return;

    const userDocRef = doc(db, 'users', user.userId);
    const unsubscribe = onSnapshot(
      userDocRef,
      (snap) => {
        if (snap.exists()) {
          const fresh = snap.data() as UserProfile;
          if (fresh.hasAppLockPin === false) {
            markPinSessionUnlocked(fresh.userId || user.userId);
            setIsAppLocked(false);
          }
          setUser((prev) => {
            if (!prev) return fresh;
            if (
              prev.isBanned !== fresh.isBanned ||
              prev.banReason !== fresh.banReason ||
              prev.bannedUntil !== fresh.bannedUntil ||
              prev.bannedUntilMs !== fresh.bannedUntilMs ||
              prev.warningNotice !== fresh.warningNotice ||
              prev.warningDismissed !== fresh.warningDismissed ||
              prev.warningIssuedAt !== fresh.warningIssuedAt ||
              prev.status !== fresh.status ||
              prev.displayName !== fresh.displayName ||
              prev.about !== fresh.about ||
              prev.photoURL !== fresh.photoURL ||
              prev.username !== fresh.username ||
              prev.phoneNumber !== fresh.phoneNumber ||
              prev.initialPhoneNumber !== fresh.initialPhoneNumber ||
              prev.lastPhoneChangedAt !== fresh.lastPhoneChangedAt ||
              prev.phoneChangeCooldownBypass !== fresh.phoneChangeCooldownBypass ||
              JSON.stringify(prev.phoneHistory || []) !== JSON.stringify(fresh.phoneHistory || []) ||
              JSON.stringify(prev.deviceLimits || null) !== JSON.stringify(fresh.deviceLimits || null) ||
              prev.discoverableByPhone !== fresh.discoverableByPhone ||
              prev.hasAppLockPin !== fresh.hasAppLockPin
            ) {
              return { ...prev, ...fresh };
            }
            return prev;
          });
        }
      },
      (error) => {
        console.warn('User profile sync subscription notice:', error);
      }
    );

    return () => unsubscribe();
  }, [user?.userId]);

  const isVerifiedSuperAdmin = Boolean(
    user && firebaseUser?.emailVerified && isSuperAdmin(user.email)
  );

  // Subscribe to Super Admin dedicated security policy only when verified Super Admin is signed in
  useEffect(() => {
    if (!user?.userId || !isVerifiedSuperAdmin) {
      setAdminSecuritySettings(DEFAULT_ADMIN_SECURITY_SETTINGS);
      return;
    }
    return subscribeToAdminSecuritySettings((settings) => {
      setAdminSecuritySettings(settings);
    });
  }, [user?.userId, isVerifiedSuperAdmin]);

  // Global security settings & real-time per-device session listener
  useEffect(() => {
    if (!user?.userId) {
      setUserSessions([]);
      setCurrentDeviceSession(null);
      knownPendingAlertIdsRef.current.clear();
      knownAdminAlertIdsRef.current.clear();
      wasSessionActiveRef.current = false;
      return;
    }

    const unsubSettings = subscribeToGlobalSecuritySettings((settings) => {
      setGlobalSecuritySettings(settings);
    });

    const unsubSessions = subscribeToUserDeviceSessions(user.userId, (sessions) => {
      setUserSessions(sessions);
      const mine = sessions.find((s) => s.deviceId === currentDeviceId) || null;
      if (mine) {
        if (mine.status === 'active') {
          wasSessionActiveRef.current = true;
        } else if (mine.status === 'rejected') {
          wasSessionActiveRef.current = false;
        } else if (mine.status === 'logged_out' && !explicitAuthInProgressRef.current) {
          wasSessionActiveRef.current = false;
          const lang = getActiveLanguage();
          setAuthError(
            lang === 'bn'
              ? 'অন্য ডিভাইস বা অ্যাডমিন থেকে আপনার এই সেশনটি লগ-আউট করা হয়েছে।'
              : 'This device session was signed out from another trusted device or by an administrator.'
          );
          clearPinSessionUnlocked(user.userId);
          setCurrentDeviceSession(mine);
          signOut(auth).catch(() => {});
          return;
        }
        setCurrentDeviceSession(mine);
      } else {
        setCurrentDeviceSession(null);
        if (wasSessionActiveRef.current && !explicitAuthInProgressRef.current) {
          wasSessionActiveRef.current = false;
          const lang = getActiveLanguage();
          setAuthError(
            lang === 'bn'
              ? 'অ্যাডমিন বা অন্য ডিভাইস থেকে এই সেশন রেকর্ডটি সরানো হয়েছে।'
              : 'This device session record was removed by an administrator.'
          );
          clearPinSessionUnlocked(user.userId);
          signOut(auth).catch(() => {});
          return;
        }
      }

      // Desktop/PWA notification when a new unapproved login awaits owner action
      if (mine?.status === 'active') {
        const pendingOthers = sessions.filter(
          (s) => s.status === 'pending_approval' && s.deviceId !== currentDeviceId
        );
        for (const p of pendingOthers) {
          if (!knownPendingAlertIdsRef.current.has(p.deviceId)) {
            knownPendingAlertIdsRef.current.add(p.deviceId);
            if (
              typeof window !== 'undefined' &&
              'Notification' in window &&
              Notification.permission === 'granted'
            ) {
              try {
                const lang = getActiveLanguage();
                new Notification(
                  lang === 'bn'
                    ? 'নতুন ডিভাইস থেকে লগইন সতর্কতা!'
                    : 'New Device Login Alert!',
                  {
                    body:
                      lang === 'bn'
                        ? `${p.deviceLabel} থেকে লগইনের চেষ্টা হয়েছে। অনুমোদন বা ব্লক করতে অ্যাপ খুলুন।`
                        : `${p.deviceLabel} is requesting access. Open the app to approve or reject.`,
                    tag: `login_alert_${p.deviceId}`,
                  }
                );
              } catch {
                // Ignore Notification errors on unsupported platforms
              }
            }
          }
        }

        // Fast-Alert notification for verified Super Admin new logins
        if (isVerifiedSuperAdmin) {
          const fastAlerts = sessions.filter(
            (s) =>
              s.status === 'active' &&
              s.adminAlertPending === true &&
              s.deviceId !== currentDeviceId
          );
          for (const a of fastAlerts) {
            if (!knownAdminAlertIdsRef.current.has(a.deviceId)) {
              knownAdminAlertIdsRef.current.add(a.deviceId);
              if (
                typeof window !== 'undefined' &&
                'Notification' in window &&
                Notification.permission === 'granted'
              ) {
                try {
                  const lang = getActiveLanguage();
                  new Notification(
                    lang === 'bn'
                      ? 'সুপার অ্যাডমিন নতুন ডিভাইস লগইন!'
                      : 'Super Admin New Device Login',
                    {
                      body:
                        lang === 'bn'
                          ? `${a.deviceLabel}${a.approxLocation ? ` (${a.approxLocation})` : ''} থেকে লগইন হয়েছে। আপনি না হলে ব্লক করুন।`
                          : `Signed in from ${a.deviceLabel}${a.approxLocation ? ` (${a.approxLocation})` : ''}. Review in app.`,
                      tag: `admin_alert_${a.deviceId}`,
                    }
                  );
                } catch {
                  // Ignore Notification errors on unsupported platforms
                }
              }
            }
          }
        }
      }
    });

    return () => {
      unsubSettings();
      unsubSessions();
    };
  }, [user?.userId, currentDeviceId, isVerifiedSuperAdmin]);

  // Check deletion status on login
  const verifyDeletionStatus = (profile: UserProfile): boolean => {
    const status = checkAccountDeletionStatus(profile);
    if (status.isScheduled) {
      if (status.isExpired) {
        setAuthError('This account was scheduled for deletion and the 15-day recovery period has expired.');
        return false;
      } else {
        setDeletionNotice({ daysRemaining: status.daysRemaining });
      }
    } else {
      setDeletionNotice(null);
    }
    return true;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (current) => {
      setFirebaseUser(current);
      if (current) {
        if (explicitAuthInProgressRef.current) {
          return;
        }
        try {
          const profile = await syncUserProfile({
            uid: current.uid,
            displayName: current.displayName,
            email: current.email,
            photoURL: current.photoURL,
          });
          if (verifyDeletionStatus(profile)) {
            const devSess = await registerOrSyncDeviceSession(profile);
            if (devSess?.status === 'logged_out') {
              wasSessionActiveRef.current = false;
              setCurrentDeviceSession(null);
              const lang = getActiveLanguage();
              setAuthError(
                lang === 'bn'
                  ? 'অ্যাডমিন থেকে এই ডিভাইস ক্যাটাগরির অনুমতি বন্ধ (লিমিট ০) করা হয়েছে।'
                  : 'Access from this device category has been restricted by an administrator.'
              );
              clearPinSessionUnlocked(profile.userId);
              await signOut(auth);
              setUser(null);
              setIsAppLocked(false);
              setLoading(false);
              return;
            }
            if (devSess) {
              wasSessionActiveRef.current = devSess.status === 'active';
              setCurrentDeviceSession(devSess);
            } else {
              wasSessionActiveRef.current = false;
              setCurrentDeviceSession(null);
            }
            if (profile.hasAppLockPin && !isPinSessionUnlocked(profile.userId)) {
              setIsAppLocked(true);
            } else {
              setIsAppLocked(false);
            }
            setUser(profile);
            if (isDeviceAccountSaved(profile.userId) && profile.email) {
              const isGoogleUser = !current.providerData.some((p) => p.providerId === 'password');
              saveDeviceAccount({
                userId: profile.userId,
                displayName: profile.displayName,
                photoURL: profile.photoURL || '',
                email: profile.email,
                provider: isGoogleUser ? 'google' : 'password',
              });
            }
          } else {
            if (!profile.isBanned && profile.phoneNumber) {
              await releasePhoneSlot(profile.userId, profile.phoneNumber);
            }
            await updateDoc(doc(db, 'users', profile.userId), { status: 'deleted' }).catch(() => {});
            await syncDirectoryEntry(profile.userId, {
              status: 'deleted',
              phoneLookupHash: null,
              username: deleteField(),
            }).catch(() => {});
            await markDeviceSessionLoggedOut(profile.userId, currentDeviceId).catch(() => {});
            await signOut(auth);
            setIsAppLocked(false);
          }
        } catch (err) {
          console.error('Failed to sync profile on state change:', err);
        }
      } else {
        setUser(null);
        setCurrentDeviceSession(null);
        setDeletionNotice(null);
        setIsAppLocked(false);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    setAuthError(null);
    explicitAuthInProgressRef.current = true;
    try {
      const res = await signInWithPopup(auth, googleProvider);
      if (res.user) {
        markPinSessionUnlocked(res.user.uid);
        setIsAppLocked(false);
        const profile = await syncUserProfile({
          uid: res.user.uid,
          displayName: res.user.displayName,
          email: res.user.email,
          photoURL: res.user.photoURL,
        });
        if (!verifyDeletionStatus(profile)) {
          if (!profile.isBanned && profile.phoneNumber) {
            await releasePhoneSlot(profile.userId, profile.phoneNumber);
          }
          await updateDoc(doc(db, 'users', profile.userId), { status: 'deleted' }).catch(() => {});
          await syncDirectoryEntry(profile.userId, {
            status: 'deleted',
            phoneLookupHash: null,
            username: deleteField(),
          }).catch(() => {});
          await signOut(auth);
          setIsAppLocked(false);
          return;
        }
        const devSess = await registerOrSyncDeviceSession(profile);
        if (devSess?.status === 'logged_out') {
          wasSessionActiveRef.current = false;
          setCurrentDeviceSession(null);
          const lang = getActiveLanguage();
          setAuthError(
            lang === 'bn'
              ? 'অ্যাডমিন থেকে এই ডিভাইস ক্যাটাগরির অনুমতি বন্ধ (লিমিট ০) করা হয়েছে।'
              : 'Access from this device category has been restricted by an administrator.'
          );
          clearPinSessionUnlocked(profile.userId);
          await signOut(auth);
          setIsAppLocked(false);
          return;
        }
        if (devSess) {
          wasSessionActiveRef.current = devSess.status === 'active';
          setCurrentDeviceSession(devSess);
        } else {
          wasSessionActiveRef.current = false;
          setCurrentDeviceSession(null);
        }
        setUser(profile);
        if (devSess?.status === 'active') {
          setPresence(res.user.uid, true);
        }
        if (consumeRememberDevicePending() || isDeviceAccountSaved(profile.userId)) {
          if (profile.email) {
            saveDeviceAccount({
              userId: profile.userId,
              displayName: profile.displayName,
              photoURL: profile.photoURL || '',
              email: profile.email,
              provider: 'google',
            });
          }
        }
      }
    } catch (err: unknown) {
      console.warn('Google sign-in attempt notice:', err);
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();

      if (msg.includes('popup-closed-by-user') || msg.includes('cancelled')) {
        setAuthError('Google sign-in was cancelled. Please tap "Continue with Google" to try again.');
      } else if (msg.includes('unauthorized-domain')) {
        setAuthError(
          'This domain is not authorized in Firebase Console yet. Please add your domain (e.g. "mydatasarverorg-ux.github.io") under Authentication > Settings > Authorized domains.'
        );
      } else {
        setAuthError(
          err instanceof Error
            ? err.message
            : 'Unable to complete Google sign-in. Please try again or use Email login.'
        );
      }
    } finally {
      explicitAuthInProgressRef.current = false;
      setLoading(false);
    }
  };

  const signUpWithEmail = async (
    email: string,
    pass: string,
    name: string,
    username?: string,
    phoneNumber?: string
  ) => {
    setLoading(true);
    setAuthError(null);
    explicitAuthInProgressRef.current = true;
    const lang = getActiveLanguage();
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim().slice(0, 100);
    const cleanUsername = username ? username.trim().toLowerCase().replace(/^@/, '') : undefined;
    const phoneCheck = validateMobileNumber(phoneNumber, lang);

    try {
      if (!phoneCheck.valid) {
        throw new Error(
          phoneCheck.error ||
            (lang === 'bn' ? 'দয়া করে সঠিক মোবাইল নম্বর দিন।' : 'Please enter a valid mobile number.')
        );
      }
      const cleanPhone = phoneCheck.normalized;

      const res = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      if (res.user) {
        let claimedSlot = false;
        try {
          await claimPhoneSlot(res.user.uid, cleanPhone, lang);
          claimedSlot = true;

          markPinSessionUnlocked(res.user.uid);
          setIsAppLocked(false);
          await updateFirebaseProfile(res.user, { displayName: cleanName });
          const profile = await syncUserProfile({
            uid: res.user.uid,
            displayName: cleanName,
            email: cleanEmail,
            photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanName)}`,
            phoneNumber: cleanPhone,
          });

          // Send verification link non-blockingly so Super Admin / standard accounts can verify email
          sendEmailVerification(res.user).catch(() => {});

          const extraUpdates: Record<string, unknown> = {};
          if (profile.phoneNumber !== cleanPhone) {
            extraUpdates.phoneNumber = cleanPhone;
            extraUpdates.discoverableByPhone = false;
            profile.phoneNumber = cleanPhone;
            profile.discoverableByPhone = false;
            await syncDirectoryEntry(res.user.uid, { phoneLookupHash: null });
          }
          if (cleanUsername && cleanUsername.length >= 3) {
            const available = await isUsernameAvailable(cleanUsername, res.user.uid);
            if (available) {
              extraUpdates.username = cleanUsername;
              await syncDirectoryEntry(res.user.uid, { username: cleanUsername });
              profile.username = cleanUsername;
            }
          }
          if (Object.keys(extraUpdates).length > 0) {
            await updateDoc(doc(db, 'users', res.user.uid), extraUpdates);
          }

          const devSess = await registerOrSyncDeviceSession(profile);
          if (devSess) {
            if (devSess.status === 'active') wasSessionActiveRef.current = true;
            setCurrentDeviceSession(devSess);
          }
          setUser(profile);
          setPresence(res.user.uid, true);
          if (consumeRememberDevicePending()) {
            saveDeviceAccount({
              userId: profile.userId,
              displayName: profile.displayName,
              photoURL: profile.photoURL || '',
              email: cleanEmail,
              provider: 'password',
            });
          }
        } catch (innerErr) {
          if (claimedSlot) {
            await releasePhoneSlot(res.user.uid, cleanPhone).catch(() => {});
          }
          await deleteUser(res.user).catch(() => {});
          await signOut(auth).catch(() => {});
          setUser(null);
          throw innerErr;
        }
      }
    } catch (err: unknown) {
      console.warn('Email sign up error:', err);
      const phoneLimitMsg = formatPhoneLimitError(err, lang);
      const code = (err as { code?: string })?.code || '';
      if (phoneLimitMsg) {
        setAuthError(phoneLimitMsg);
      } else if (code === 'auth/email-already-in-use') {
        setAuthError(
          lang === 'bn'
            ? 'এই ইমেইলটি দিয়ে ইতিমধ্যেই অ্যাকাউন্ট খোলা আছে। অনুগ্রহ করে সাইন ইন করুন।'
            : 'This email is already registered. Please sign in instead.'
        );
      } else if (code === 'auth/weak-password') {
        setAuthError('Password should be at least 6 characters long.');
      } else if (code === 'auth/invalid-email') {
        setAuthError('Please enter a valid email address.');
      } else {
        setAuthError(err instanceof Error ? err.message : 'Unable to create account. Please check your details.');
      }
      throw err;
    } finally {
      explicitAuthInProgressRef.current = false;
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    setAuthError(null);
    explicitAuthInProgressRef.current = true;
    const cleanEmail = email.trim().toLowerCase();

    try {
      const res = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      if (res.user) {
        markPinSessionUnlocked(res.user.uid);
        setIsAppLocked(false);
        const profile = await syncUserProfile({
          uid: res.user.uid,
          displayName: res.user.displayName,
          email: cleanEmail,
          photoURL: res.user.photoURL,
        });
        if (!verifyDeletionStatus(profile)) {
          if (!profile.isBanned && profile.phoneNumber) {
            await releasePhoneSlot(profile.userId, profile.phoneNumber);
          }
          await updateDoc(doc(db, 'users', profile.userId), { status: 'deleted' }).catch(() => {});
          await syncDirectoryEntry(profile.userId, {
            status: 'deleted',
            phoneLookupHash: null,
            username: deleteField(),
          }).catch(() => {});
          await signOut(auth);
          setIsAppLocked(false);
          return;
        }
        const devSess = await registerOrSyncDeviceSession(profile);
        if (devSess?.status === 'logged_out') {
          wasSessionActiveRef.current = false;
          setCurrentDeviceSession(null);
          const lang = getActiveLanguage();
          setAuthError(
            lang === 'bn'
              ? 'অ্যাডমিন থেকে এই ডিভাইস ক্যাটাগরির অনুমতি বন্ধ (লিমিট ০) করা হয়েছে।'
              : 'Access from this device category has been restricted by an administrator.'
          );
          clearPinSessionUnlocked(profile.userId);
          await signOut(auth);
          setIsAppLocked(false);
          return;
        }
        if (devSess) {
          wasSessionActiveRef.current = devSess.status === 'active';
          setCurrentDeviceSession(devSess);
        } else {
          wasSessionActiveRef.current = false;
          setCurrentDeviceSession(null);
        }
        setUser(profile);
        if (devSess?.status === 'active') {
          setPresence(res.user.uid, true);
        }
        if (consumeRememberDevicePending() || isDeviceAccountSaved(profile.userId)) {
          saveDeviceAccount({
            userId: profile.userId,
            displayName: profile.displayName,
            photoURL: profile.photoURL || '',
            email: cleanEmail,
            provider: 'password',
          });
        }
      }
    } catch (err: unknown) {
      console.warn('Email sign in error:', err);
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setAuthError('Incorrect email or password. Please verify and try again.');
      } else if (code === 'auth/invalid-email') {
        setAuthError('Please enter a valid email address.');
      } else {
        setAuthError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.');
      }
      throw err;
    } finally {
      explicitAuthInProgressRef.current = false;
      setLoading(false);
    }
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) {
      throw new Error('No active signed-in session.');
    }
    await auth.currentUser.reload().catch(() => {});
    setFirebaseUser(auth.currentUser);
    if (auth.currentUser.emailVerified) {
      return;
    }
    await sendEmailVerification(auth.currentUser);
  };

  const unlockAppWithPin = async (pin: string) => {
    if (!user) return { success: false, error: 'No active session.' };
    const result = await verifyAppLockPin(user.userId, pin);
    if (result.success) {
      markPinSessionUnlocked(user.userId);
      setIsAppLocked(false);
    }
    return result;
  };

  const setAppLockPin = async (pin: string) => {
    if (!user) throw new Error('Not signed in.');
    await saveAppLockPin(user.userId, pin);
    markPinSessionUnlocked(user.userId);
    setUser((prev) => (prev ? { ...prev, hasAppLockPin: true } : prev));
  };

  const clearAppLockPin = async () => {
    if (!user) throw new Error('Not signed in.');
    await removeAppLockPin(user.userId);
    markPinSessionUnlocked(user.userId);
    setIsAppLocked(false);
    setUser((prev) => (prev ? { ...prev, hasAppLockPin: false } : prev));
  };

  const lockAppNow = () => {
    if (!user?.hasAppLockPin) return;
    clearPinSessionUnlocked(user.userId);
    setIsAppLocked(true);
  };

  const sendPasswordReset = async (email: string) => {
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      console.warn('Password reset error:', code || 'unknown');
      if (code === 'auth/user-not-found') {
        throw new Error('No registered account was found with this email address.');
      } else if (code === 'auth/too-many-requests') {
        throw new Error('Too many requests. Please wait a few minutes before trying again.');
      } else {
        throw new Error('Failed to send password reset email. Please check the address.');
      }
    }
  };

  const changePassword = async (currentPass: string, newPass: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      throw new Error('You must be signed in with an email account to update your password.');
    }
    const hasPasswordProvider = currentUser.providerData.some((p) => p.providerId === 'password');
    if (!hasPasswordProvider) {
      throw new Error(
        'This account uses Google Sign-In and does not have a password yet. Use "Send Set-Password Email" to create one.'
      );
    }
    if (!currentPass) {
      throw new Error('Please enter your current password.');
    }
    if (!newPass || newPass.length < 6) {
      throw new Error('New password must be at least 6 characters.');
    }

    try {
      // Strictly verify the old/current password directly against Firebase Auth servers first
      const credential = EmailAuthProvider.credential(currentUser.email, currentPass);
      await reauthenticateWithCredential(currentUser, credential);

      if (currentPass === newPass) {
        throw new Error('SAME_PASSWORD_NOT_ALLOWED');
      }

      await updatePassword(currentUser, newPass);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      const rawMsg = err instanceof Error ? err.message : '';
      console.warn('Change password notice:', code || (rawMsg === 'SAME_PASSWORD_NOT_ALLOWED' ? 'same-password' : 'validation'));

      if (rawMsg === 'SAME_PASSWORD_NOT_ALLOWED') {
        throw new Error('New password must be different from your current password.');
      }
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        throw new Error('Current password is incorrect. Please verify and try again.');
      }
      if (code === 'auth/too-many-requests') {
        throw new Error('Too many failed password attempts. Please wait a few minutes and try again.');
      }
      if (code === 'auth/weak-password') {
        throw new Error('New password should be at least 6 characters long.');
      }
      if (code === 'auth/requires-recent-login') {
        throw new Error('Session verification expired. Please re-enter your current password or sign in again.');
      }
      if (code === 'auth/network-request-failed') {
        throw new Error('Network error. Please check your internet connection and try again.');
      }
      throw new Error('Unable to update password right now. Please check your inputs and try again.');
    }
  };

  const signOutUser = async () => {
    wasSessionActiveRef.current = false;
    if (user) {
      clearPinSessionUnlocked(user.userId);
      await setPresence(user.userId, false);
      await markDeviceSessionLoggedOut(user.userId, currentDeviceId);
    }
    await signOut(auth);
    setUser(null);
    setFirebaseUser(null);
    setUserSessions([]);
    setCurrentDeviceSession(null);
    setDeletionNotice(null);
    setIsAppLocked(false);
  };

  const requestAccountDeletion = async () => {
    if (!user) return;
    if (user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      console.warn('Super Admin root account deletion prevented.');
      return;
    }
    await scheduleAccountDeletion(user.userId);
    await signOutUser();
  };

  const recoverAccount = async () => {
    if (!user) return;
    await restoreAccount(user.userId);
    const updated = {
      ...user,
      status: 'active' as const,
      deleteRequestedAt: undefined,
      deleteScheduledAt: undefined,
    };
    setUser(updated);
    setDeletionNotice(null);
  };

  const savePhoneNumber = async (phoneNumber: string, username?: string, discoverableByPhone = false) => {
    if (!user) return;
    const lang = getActiveLanguage();
    const validation = validateMobileNumber(phoneNumber, lang);
    if (!validation.valid) {
      throw new Error(
        validation.error ||
          (lang === 'bn' ? 'দয়া করে সঠিক মোবাইল নম্বর দিন।' : 'Please enter a valid mobile number.')
      );
    }
    const cleanPhone = validation.normalized;

    const cleanUsername = username?.trim().toLowerCase().replace(/^@/, '');
    if (cleanUsername) {
      if (cleanUsername.length < 3) {
        throw new Error('Username must be at least 3 characters.');
      }
      if (cleanUsername !== user.username) {
        const isAvail = await isUsernameAvailable(cleanUsername, user.userId);
        if (!isAvail) {
          throw new Error('This username is already taken. Please choose another username.');
        }
      }
    }

    try {
      await switchPhoneSlot(user.userId, user.phoneNumber, cleanPhone, lang);
    } catch (err) {
      const formatted = formatPhoneLimitError(err, lang);
      throw new Error(formatted || (err instanceof Error ? err.message : 'Unable to save mobile number.'));
    }

    const nowIso = new Date().toISOString();
    const docUpdates: Record<string, unknown> = {
      phoneNumber: cleanPhone,
      discoverableByPhone,
    };
    if (!user.initialPhoneNumber) {
      docUpdates.initialPhoneNumber = cleanPhone;
      docUpdates.initialPhoneSetAt = nowIso;
    }
    if (cleanUsername && cleanUsername !== user.username) {
      docUpdates.username = cleanUsername;
    }

    await updateDoc(doc(db, 'users', user.userId), docUpdates);
    const phoneLookupHash = discoverableByPhone ? await hashPhoneForDirectory(cleanPhone) : null;
    await syncDirectoryEntry(user.userId, {
      ...(cleanUsername && cleanUsername !== user.username ? { username: cleanUsername } : {}),
      phoneLookupHash,
    });

    setUser((prev) =>
      prev
        ? {
            ...prev,
            phoneNumber: cleanPhone,
            ...(!prev.initialPhoneNumber ? { initialPhoneNumber: cleanPhone, initialPhoneSetAt: nowIso } : {}),
            discoverableByPhone,
            ...(cleanUsername ? { username: cleanUsername } : {}),
          }
        : prev
    );
  };

  const updateProfile = async (
    displayName: string,
    about: string,
    photoURL: string,
    username?: string,
    phoneNumber?: string,
    discoverableByPhone?: boolean
  ) => {
    if (!user) return;
    const lang = getActiveLanguage();
    const userRef = doc(db, 'users', user.userId);
    const nowIso = new Date().toISOString();

    const resolvedUsername =
      username !== undefined
        ? username.trim()
          ? username.trim().toLowerCase().replace(/^@/, '')
          : deleteField()
        : user.username || undefined;

    if (typeof resolvedUsername === 'string' && resolvedUsername !== user.username) {
      if (resolvedUsername.length < 3) {
        throw new Error('Username must be at least 3 characters.');
      }
      const isAvail = await isUsernameAvailable(resolvedUsername, user.userId);
      if (!isAvail) {
        throw new Error('This username is already taken. Please choose another username.');
      }
    }

    let resolvedPhone: string | undefined = user.phoneNumber;
    let isCanonicalPhoneChange = false;
    if (phoneNumber !== undefined && phoneNumber.trim()) {
      const validation = validateMobileNumber(phoneNumber, lang);
      if (!validation.valid) {
        throw new Error(
          validation.error ||
            (lang === 'bn' ? 'দয়া করে সঠিক মোবাইল নম্বর দিন।' : 'Please enter a valid mobile number.')
        );
      }
      const oldKey = getCanonicalPhoneKey(user.phoneNumber);
      isCanonicalPhoneChange = Boolean(oldKey && oldKey !== validation.canonicalKey);
      resolvedPhone =
        oldKey && validation.canonicalKey === oldKey && user.phoneNumber
          ? user.phoneNumber
          : validation.normalized;

      if (isCanonicalPhoneChange) {
        if (user.isBanned || (user.warningNotice && !user.warningDismissed)) {
          throw new Error(
            lang === 'bn'
              ? 'অ্যাকাউন্টে সতর্কবার্তা বা নিষেধাজ্ঞা থাকা অবস্থায় মোবাইল নম্বর পরিবর্তন করা যাবে না।'
              : 'Mobile number cannot be changed while an active warning or suspension is unresolved.'
          );
        }

        const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
        if (user.lastPhoneChangedAt && !user.phoneChangeCooldownBypass) {
          const lastChangeMs = new Date(user.lastPhoneChangedAt).getTime();
          if (Number.isFinite(lastChangeMs) && Date.now() - lastChangeMs < COOLDOWN_MS) {
            const daysLeft = Math.max(
              1,
              Math.ceil((COOLDOWN_MS - (Date.now() - lastChangeMs)) / (24 * 60 * 60 * 1000))
            );
            throw new Error(
              lang === 'bn'
                ? `নিরাপত্তার স্বার্থে প্রতি ৩০ দিনে একবারের বেশি মোবাইল নম্বর বদলানো যাবে না (আরও ${daysLeft} দিন বাকি)। জরুরি হলে সাপোর্ট অ্যাডমিনের সাথে যোগাযোগ করুন।`
                : `For security, mobile number can only be changed once every 30 days (${daysLeft} days remaining). Contact support admin if urgent.`
            );
          }
        }
      }

      try {
        await switchPhoneSlot(user.userId, user.phoneNumber, resolvedPhone, lang);
      } catch (err) {
        const formatted = formatPhoneLimitError(err, lang);
        throw new Error(formatted || (err instanceof Error ? err.message : 'Unable to update mobile number.'));
      }
    }

    const resolvedDiscoverable =
      discoverableByPhone !== undefined ? discoverableByPhone : user.discoverableByPhone === true;

    const cleanDisplayName = displayName.trim().slice(0, 100);
    const cleanAbout = about.trim().slice(0, 200);
    const cleanPhoto = photoURL.trim().slice(0, 1000);

    const docUpdates: Record<string, unknown> = {
      displayName: cleanDisplayName,
      about: cleanAbout,
      photoURL: cleanPhoto,
      discoverableByPhone: resolvedDiscoverable,
    };
    if (resolvedUsername !== undefined) {
      docUpdates.username = resolvedUsername;
    }

    let nextHistory: PhoneChangeHistoryEntry[] | undefined = user.phoneHistory;
    let nextInitialPhone = user.initialPhoneNumber;
    let nextInitialPhoneSetAt = user.initialPhoneSetAt;
    let nextLastChangedAt = user.lastPhoneChangedAt;

    if (resolvedPhone && resolvedPhone !== user.phoneNumber) {
      docUpdates.phoneNumber = resolvedPhone;
      if (!nextInitialPhone) {
        nextInitialPhone = user.phoneNumber || resolvedPhone;
        nextInitialPhoneSetAt = user.createdAt || nowIso;
        docUpdates.initialPhoneNumber = nextInitialPhone;
        docUpdates.initialPhoneSetAt = nextInitialPhoneSetAt;
      }
      if (isCanonicalPhoneChange) {
        const existingHistory = Array.isArray(user.phoneHistory) ? user.phoneHistory : [];
        const entry: PhoneChangeHistoryEntry = {
          phone: resolvedPhone,
          ...(user.phoneNumber ? { previousPhone: user.phoneNumber } : {}),
          changedAt: nowIso,
        };
        nextHistory = [...existingHistory, entry].slice(-20);
        nextLastChangedAt = nowIso;
        docUpdates.phoneHistory = nextHistory;
        docUpdates.lastPhoneChangedAt = nowIso;
        docUpdates.lastPhoneChangedAtMs = Date.now();
        if (user.phoneChangeCooldownBypass) {
          docUpdates.phoneChangeCooldownBypass = false;
        }
      }
    }

    await updateDoc(userRef, docUpdates);

    if (auth.currentUser) {
      updateFirebaseProfile(auth.currentUser, {
        displayName: cleanDisplayName,
        ...(cleanPhoto.startsWith('http') ? { photoURL: cleanPhoto } : {}),
      }).catch(() => {});
    }

    const phoneLookupHash =
      resolvedDiscoverable && resolvedPhone ? await hashPhoneForDirectory(resolvedPhone) : null;

    const dirUpdates: Record<string, unknown> = {
      userId: user.userId,
      displayName: cleanDisplayName,
      about: cleanAbout,
      photoURL: cleanPhoto,
      phoneLookupHash,
      status: user.status || 'active',
    };
    if (resolvedUsername !== undefined) {
      dirUpdates.username = resolvedUsername;
    }
    await syncDirectoryEntry(user.userId, dirUpdates);

    const merged: UserProfile = {
      ...user,
      displayName: cleanDisplayName,
      about: cleanAbout,
      photoURL: cleanPhoto,
      phoneNumber: resolvedPhone,
      initialPhoneNumber: nextInitialPhone,
      initialPhoneSetAt: nextInitialPhoneSetAt,
      phoneHistory: nextHistory,
      lastPhoneChangedAt: nextLastChangedAt,
      ...(isCanonicalPhoneChange ? { phoneChangeCooldownBypass: false } : {}),
      discoverableByPhone: resolvedDiscoverable,
      username: typeof resolvedUsername === 'string' ? resolvedUsername : undefined,
    };
    setUser(merged);
    if (isDeviceAccountSaved(user.userId) && user.email) {
      const isGoogleUser = !auth.currentUser?.providerData.some((p) => p.providerId === 'password');
      saveDeviceAccount({
        userId: user.userId,
        displayName: cleanDisplayName,
        photoURL: cleanPhoto,
        email: user.email,
        provider: isGoogleUser ? 'google' : 'password',
      });
    }
  };

  const hasPasswordProvider = Boolean(
    firebaseUser?.providerData?.some((p) => p.providerId === 'password')
  );

  const pendingApprovalSessions =
    currentDeviceSession?.status === 'active'
      ? userSessions.filter(
          (s) => s.status === 'pending_approval' && s.deviceId !== currentDeviceId
        )
      : [];

  const adminAlertSessions =
    isVerifiedSuperAdmin && currentDeviceSession?.status === 'active'
      ? userSessions.filter(
          (s) =>
            s.adminAlertPending === true &&
            s.deviceId !== currentDeviceId &&
            s.status === 'active'
        )
      : [];

  const deviceLimitsSummary = resolveEffectiveDeviceLimits(user, globalSecuritySettings, {
    isVerifiedAdmin: isVerifiedSuperAdmin,
    adminSettings: adminSecuritySettings,
  });

  const verifyOwnerIdentity = async (
    verification?: OwnerVerificationInput
  ): Promise<void> => {
    if (!user || !auth.currentUser) {
      throw new Error('No active signed-in session.');
    }
    const lang = getActiveLanguage();
    const isPasswordAcct = auth.currentUser.providerData.some((p) => p.providerId === 'password');

    if (isPasswordAcct) {
      if (!user.email) {
        throw new Error(lang === 'bn' ? 'অ্যাকাউন্টের ইমেইল পাওয়া যায়নি।' : 'Account email missing.');
      }
      if (!verification?.password || !verification.password.trim()) {
        throw new Error(
          lang === 'bn'
            ? 'মালিকানা যাচাই করতে আপনার অ্যাকাউন্টের পাসওয়ার্ড দিন।'
            : 'Please enter your account password to verify ownership.'
        );
      }
      try {
        const cred = EmailAuthProvider.credential(user.email, verification.password);
        await reauthenticateWithCredential(auth.currentUser, cred);
        return;
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code || '';
        if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
          throw new Error(
            lang === 'bn'
              ? 'পাসওয়ার্ড ভুল হয়েছে। ভুলে গেলে নিচের ইমেইল রিসেট বাটন ব্যবহার করুন।'
              : 'Incorrect password. Use the Email Reset option if you forgot it.'
          );
        }
        throw new Error(
          lang === 'bn'
            ? 'পাসওয়ার্ড যাচাই করা যায়নি। পুনরায় চেষ্টা করুন।'
            : 'Could not verify password. Please try again.'
        );
      }
    }

    if (verification?.verifyGoogle) {
      try {
        await reauthenticateWithPopup(auth.currentUser, googleProvider);
        return;
      } catch {
        throw new Error(
          lang === 'bn'
            ? 'Google যাচাই সম্পন্ন হয়নি। দয়া করে আবার চেষ্টা করুন।'
            : 'Google verification was cancelled or failed. Please try again.'
        );
      }
    }

    if (verification?.allowPopupFallback) {
      if (user.hasAppLockPin) {
        if (!verification.appLockPin || verification.appLockPin.trim().length < 4) {
          throw new Error(
            lang === 'bn'
              ? 'পপআপ না খুললে আপনার ৪-৬ ডিজিটের অ্যাপ-লক পিন দিয়ে যাচাই করুন।'
              : 'Enter your 4-6 digit App-Lock PIN to verify ownership.'
          );
        }
        const pinResult = await verifyAppLockPin(user.userId, verification.appLockPin.trim());
        if (!pinResult.success) {
          throw new Error(
            pinResult.error ||
              (lang === 'bn' ? 'অ্যাপ-লক পিন সঠিক নয়।' : 'Incorrect App-Lock PIN.')
          );
        }
        return;
      }

      const expectedEmail = (user.email || auth.currentUser.email || '').trim().toLowerCase();
      const providedEmail = (verification.confirmedEmail || '').trim().toLowerCase();
      if (!expectedEmail || providedEmail !== expectedEmail) {
        throw new Error(
          lang === 'bn'
            ? 'যাচাই করতে আপনার অ্যাকাউন্টের সঠিক ইমেইল ঠিকানা লিখে নিশ্চিত করুন।'
            : 'Please type your registered account email address to confirm ownership.'
        );
      }
      return;
    }

    throw new Error(
      lang === 'bn'
        ? 'এই কাজের জন্য মালিকানা যাচাইকরণ আবশ্যক।'
        : 'Owner identity verification is required for this action.'
    );
  };

  const approvePendingDevice = async (targetDeviceId: string) => {
    if (!user) return;
    await approveDeviceSession(user.userId, targetDeviceId, currentDeviceId, user);
  };

  const rejectPendingDevice = async (
    targetDeviceId: string,
    verification?: OwnerVerificationInput
  ) => {
    if (!user || !auth.currentUser) return;
    await verifyOwnerIdentity(verification);
    await rejectDeviceSession(
      user.userId,
      targetDeviceId,
      currentDeviceId,
      'Rejected by trusted owner device'
    );
  };

  const acknowledgeAdminAlert = async (targetDeviceId: string, trustDevice: boolean) => {
    if (!user) return;
    await acknowledgeAdminLoginSession(user.userId, targetDeviceId, trustDevice);
  };

  const blockDeviceWithVerification = async (
    targetDeviceId: string,
    verification?: OwnerVerificationInput
  ) => {
    if (!user || !auth.currentUser || targetDeviceId === currentDeviceId) return;
    await verifyOwnerIdentity(verification);
    await rejectDeviceSession(
      user.userId,
      targetDeviceId,
      currentDeviceId,
      'Blocked by account owner from device controls'
    );
  };

  const trustOrUntrustDevice = async (targetDeviceId: string, trusted: boolean) => {
    if (!user) return;
    await toggleDeviceTrust(user.userId, targetDeviceId, trusted);
  };

  const logoutAllOtherDevices = async (): Promise<number> => {
    if (!user) return 0;
    return logoutAllOtherDeviceSessions(user.userId, currentDeviceId);
  };

  const removeDeviceHistoryItem = async (targetDeviceId: string) => {
    if (!user) return;
    await removeSessionHistoryRecord(user.userId, targetDeviceId, currentDeviceId);
  };

  const retryCurrentDeviceApproval = async () => {
    if (!user) return;
    await retryRejectedDeviceSession(user.userId, currentDeviceId);
  };

  const selfApproveCurrentDeviceWithPin = async (
    pin: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not signed in.' };
    const result = await verifyAppLockPin(user.userId, pin);
    if (!result.success) return result;
    await approveDeviceSession(user.userId, currentDeviceId, `${currentDeviceId}_pin_verified`, user);
    markPinSessionUnlocked(user.userId);
    wasSessionActiveRef.current = true;
    return { success: true };
  };

  const forceLogoutOtherDevice = async (targetDeviceId: string) => {
    if (!user || targetDeviceId === currentDeviceId) return;
    await remoteLogoutDeviceSession(user.userId, targetDeviceId);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        authError,
        theme,
        setTheme,
        deletionNotice,
        isAppLocked,
        unlockAppWithPin,
        setAppLockPin,
        clearAppLockPin,
        lockAppNow,
        resendVerificationEmail,
        recoverAccount,
        requestAccountDeletion,
        signInWithGoogle,
        signUpWithEmail,
        signInWithEmail,
        sendPasswordReset,
        changePassword,
        signOutUser,
        savePhoneNumber,
        updateProfile,
        clearAuthError: () => setAuthError(null),
        currentDeviceId,
        currentDeviceSession,
        userSessions,
        pendingApprovalSessions,
        adminAlertSessions,
        isVerifiedSuperAdmin,
        deviceLimitsSummary,
        hasPasswordProvider,
        approvePendingDevice,
        rejectPendingDevice,
        acknowledgeAdminAlert,
        blockDeviceWithVerification,
        trustOrUntrustDevice,
        logoutAllOtherDevices,
        removeDeviceHistoryItem,
        retryCurrentDeviceApproval,
        selfApproveCurrentDeviceWithPin,
        forceLogoutOtherDevice,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
