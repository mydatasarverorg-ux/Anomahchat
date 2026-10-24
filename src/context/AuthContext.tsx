import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword,
  updateProfile as updateFirebaseProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase/config';
import { syncUserProfile, setPresence, verifySecretPin } from '../services/chatService';
import type { UserProfile } from '../types/chat';

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string, username?: string) => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  loginWithSecretPin: (identifier: string, pin: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  changePassword: (newPass: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  updateProfile: (
    displayName: string,
    about: string,
    photoURL: string,
    username?: string,
    secretPin?: string
  ) => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Check if returning from redirect sign-in on Android mobile APK
    getRedirectResult(auth)
      .then(async (res) => {
        if (res?.user) {
          try {
            const profile = await syncUserProfile({
              uid: res.user.uid,
              displayName: res.user.displayName,
              email: res.user.email,
              photoURL: res.user.photoURL,
            });
            setUser(profile);
            setPresence(res.user.uid, true);
          } catch (err) {
            console.error('Failed to sync profile after redirect:', err);
          }
        }
      })
      .catch((err) => {
        console.warn('Redirect sign-in check notice:', err);
      });

    // Listen to Firebase Auth state
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
          setUser(profile);
          setPresence(current.uid, true);
        } catch (err) {
          console.error('Failed to sync profile on state change:', err);
        }
      } else {
        // If not Firebase auth, check if Secret PIN session is saved locally
        const pinSession = localStorage.getItem('anomah_active_pin_user');
        if (pinSession) {
          try {
            const parsed = JSON.parse(pinSession) as UserProfile;
            const snap = await getDoc(doc(db, 'users', parsed.userId));
            if (snap.exists()) {
              const fresh = snap.data() as UserProfile;
              setUser(fresh);
              setPresence(fresh.userId, true);
            } else {
              setUser(parsed);
            }
          } catch {
            localStorage.removeItem('anomah_active_pin_user');
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
      setLoading(false);
    });

    const handleBeforeUnload = () => {
      if (user) {
        setPresence(user.userId, false);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unsubscribe();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      if (res.user) {
        const profile = await syncUserProfile({
          uid: res.user.uid,
          displayName: res.user.displayName,
          email: res.user.email,
          photoURL: res.user.photoURL,
        });
        setUser(profile);
        setPresence(res.user.uid, true);
      }
    } catch (err: unknown) {
      console.warn('Popup attempt result, checking mobile redirect fallback:', err);
      const msg = err instanceof Error ? err.message : String(err);

      if (
        msg.includes('popup-blocked') ||
        msg.includes('operation-not-supported') ||
        msg.includes('disallowed_useragent') ||
        msg.includes('popup-closed') ||
        (typeof window !== 'undefined' && 'Capacitor' in window)
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr) {
          console.error('Redirect sign in error:', redirectErr);
          setAuthError('Unable to connect to Google account. Please check your internet connection.');
        }
      } else {
        setAuthError('Sign-in cancelled. Please tap "Sign in with Google" to continue.');
      }
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name: string, username?: string) => {
    setLoading(true);
    setAuthError(null);
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim().slice(0, 100);
    const cleanUsername = username ? username.trim().toLowerCase().replace(/^@/, '') : undefined;

    try {
      const res = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      if (res.user) {
        await updateFirebaseProfile(res.user, { displayName: cleanName });
        const profile = await syncUserProfile({
          uid: res.user.uid,
          displayName: cleanName,
          email: cleanEmail,
          photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanName)}`,
        });
        if (cleanUsername) {
          await updateDoc(doc(db, 'users', res.user.uid), { username: cleanUsername });
          profile.username = cleanUsername;
        }
        setUser(profile);
        setPresence(res.user.uid, true);
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
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    setAuthError(null);
    const cleanEmail = email.trim().toLowerCase();

    try {
      const res = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      if (res.user) {
        const profile = await syncUserProfile({
          uid: res.user.uid,
          displayName: res.user.displayName,
          email: cleanEmail,
          photoURL: res.user.photoURL,
        });
        setUser(profile);
        setPresence(res.user.uid, true);
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
      setLoading(false);
    }
  };

  const loginWithSecretPin = async (identifier: string, pin: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const res = await verifySecretPin(identifier, pin);
      if (!res.success || !res.user) {
        throw new Error(res.error || 'Invalid credentials');
      }
      setUser(res.user);
      localStorage.setItem('anomah_active_pin_user', JSON.stringify(res.user));
      setPresence(res.user.userId, true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAuthError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordReset = async (email: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
    } catch (err: unknown) {
      console.warn('Password reset error:', err);
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/user-not-found') {
        throw new Error('No registered account was found with this email address.');
      } else {
        throw new Error('Failed to send password reset email. Please check the address.');
      }
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (newPass: string) => {
    if (!auth.currentUser) {
      throw new Error('You must be signed in with an email account to update your password.');
    }
    setLoading(true);
    try {
      await updatePassword(auth.currentUser, newPass);
    } catch (err: unknown) {
      console.warn('Change password error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('requires-recent-login')) {
        throw new Error('For security, please log out and log back in before changing password.');
      }
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const signOutUser = async () => {
    if (user) {
      await setPresence(user.userId, false);
    }
    localStorage.removeItem('anomah_active_pin_user');
    await signOut(auth);
    setUser(null);
    setFirebaseUser(null);
  };

  const updateProfile = async (
    displayName: string,
    about: string,
    photoURL: string,
    username?: string,
    secretPin?: string
  ) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.userId);
    const cleanUsername = username ? username.trim().toLowerCase().replace(/^@/, '') : user.username;
    const cleanPin = secretPin ? secretPin.trim() : user.secretPin;

    const updated: Partial<UserProfile> = {
      displayName: displayName.trim().slice(0, 100),
      about: about.trim().slice(0, 200),
      photoURL: photoURL.trim().slice(0, 1000),
      username: cleanUsername,
      secretPin: cleanPin,
    };
    await updateDoc(userRef, updated);
    const merged = { ...user, ...updated };
    setUser(merged);
    if (localStorage.getItem('anomah_active_pin_user')) {
      localStorage.setItem('anomah_active_pin_user', JSON.stringify(merged));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        authError,
        signInWithGoogle,
        signUpWithEmail,
        signInWithEmail,
        loginWithSecretPin,
        sendPasswordReset,
        changePassword,
        signOutUser,
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
