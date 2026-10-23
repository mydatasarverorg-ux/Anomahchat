import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase/config';
import { syncUserProfile, setPresence } from '../services/chatService';
import type { UserProfile } from '../types/chat';

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  updateProfile: (displayName: string, about: string, photoURL: string) => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

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
          setUser(profile);
          // Set user presence online
          setPresence(current.uid, true);
        } catch (err) {
          console.error('Failed to sync profile:', err);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    // Handle unload presence
    const handleBeforeUnload = () => {
      if (auth.currentUser) {
        setPresence(auth.currentUser.uid, false);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unsubscribe();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const [authError, setAuthError] = useState<string | null>(null);

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
      }
    } catch (err: unknown) {
      console.warn('Google sign in error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('popup-closed-by-user')) {
        setAuthError('Sign-in cancelled. Please click "Continue with Google" to complete login.');
      } else if (msg.includes('popup-blocked')) {
        setAuthError('Popup blocked by browser. Please allow popups for this site and try again.');
      } else {
        setAuthError('Unable to complete Google sign-in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const signOutUser = async () => {
    if (user) {
      await setPresence(user.userId, false);
    }
    await signOut(auth);
    setUser(null);
    setFirebaseUser(null);
  };

  const updateProfile = async (displayName: string, about: string, photoURL: string) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.userId);
    const updated = {
      displayName: displayName.trim().slice(0, 100),
      about: about.trim().slice(0, 200),
      photoURL: photoURL.trim().slice(0, 1000),
    };
    await updateDoc(userRef, updated);
    setUser((prev) => (prev ? { ...prev, ...updated } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        authError,
        signInWithGoogle,
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
