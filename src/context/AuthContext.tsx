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
  updateProfile as updateFirebaseProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
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
import {
  SUPER_ADMIN_EMAIL,
  normalizePhoneNumber,
  extractPhoneDigits,
} from '../services/adminService';
import type { UserProfile, ThemeMode } from '../types/chat';

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

  // Prevents locking the user out immediately during an explicit login/signup action
  const explicitAuthInProgressRef = useRef(false);

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
        try {
          const profile = await syncUserProfile({
            uid: current.uid,
            displayName: current.displayName,
            email: current.email,
            photoURL: current.photoURL,
          });
          if (verifyDeletionStatus(profile)) {
            if (explicitAuthInProgressRef.current) {
              markPinSessionUnlocked(profile.userId);
              setIsAppLocked(false);
            } else if (profile.hasAppLockPin && !isPinSessionUnlocked(profile.userId)) {
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
            await signOut(auth);
            setIsAppLocked(false);
          }
        } catch (err) {
          console.error('Failed to sync profile on state change:', err);
        }
      } else {
        setUser(null);
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
        setUser(profile);
        setPresence(res.user.uid, true);
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
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim().slice(0, 100);
    const cleanUsername = username ? username.trim().toLowerCase().replace(/^@/, '') : undefined;
    const cleanPhone = normalizePhoneNumber(phoneNumber);

    try {
      const res = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      if (res.user) {
        markPinSessionUnlocked(res.user.uid);
        setIsAppLocked(false);
        await updateFirebaseProfile(res.user, { displayName: cleanName });
        const profile = await syncUserProfile({
          uid: res.user.uid,
          displayName: cleanName,
          email: cleanEmail,
          photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanName)}`,
          phoneNumber: cleanPhone.length >= 6 ? cleanPhone : undefined,
        });

        // Send verification link non-blockingly so Super Admin / standard accounts can verify email
        sendEmailVerification(res.user).catch(() => {});

        // Persist phoneNumber explicitly (covers race with onAuthStateChanged) and username if valid
        const extraUpdates: Record<string, unknown> = {};
        if (cleanPhone.length >= 6 && profile.phoneNumber !== cleanPhone) {
          extraUpdates.phoneNumber = cleanPhone;
          extraUpdates.discoverableByPhone = true;
          profile.phoneNumber = cleanPhone;
          profile.discoverableByPhone = true;
          const hash = await hashPhoneForDirectory(cleanPhone);
          if (hash) await syncDirectoryEntry(res.user.uid, { phoneLookupHash: hash });
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
      }
    } catch (err: unknown) {
      console.warn('Email sign up error:', err);
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/email-already-in-use') {
        setAuthError('This email is already registered. Please sign in instead.');
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
        setUser(profile);
        setPresence(res.user.uid, true);
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
    if (user) {
      clearPinSessionUnlocked(user.userId);
      await setPresence(user.userId, false);
    }
    await signOut(auth);
    setUser(null);
    setFirebaseUser(null);
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

  const savePhoneNumber = async (phoneNumber: string, username?: string, discoverableByPhone = true) => {
    if (!user) return;
    const cleanPhone = normalizePhoneNumber(phoneNumber);
    if (cleanPhone.length < 6 || extractPhoneDigits(cleanPhone).length < 7) {
      throw new Error('Please enter a valid mobile number (at least 7 digits).');
    }

    const docUpdates: Record<string, unknown> = {
      phoneNumber: cleanPhone,
      discoverableByPhone,
    };

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
        docUpdates.username = cleanUsername;
      }
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
    const userRef = doc(db, 'users', user.userId);

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
    if (phoneNumber !== undefined) {
      const cleanPhone = normalizePhoneNumber(phoneNumber);
      if (cleanPhone) {
        if (cleanPhone.length < 6 || extractPhoneDigits(cleanPhone).length < 7) {
          throw new Error('Please enter a valid mobile number (at least 7 digits).');
        }
        resolvedPhone = cleanPhone;
      }
    }

    const resolvedDiscoverable =
      discoverableByPhone !== undefined ? discoverableByPhone : user.discoverableByPhone !== false;

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
    if (resolvedPhone && resolvedPhone !== user.phoneNumber) {
      docUpdates.phoneNumber = resolvedPhone;
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
