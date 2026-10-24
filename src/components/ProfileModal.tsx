import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { isUsernameAvailable } from '../services/chatService';
import {
  X,
  Check,
  User,
  Shield,
  KeyRound,
  Lock,
  Mail,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  AtSign,
} from 'lucide-react';

export function ProfileModal({ onClose }: { onClose: () => void }) {
  const { user, firebaseUser, updateProfile, changePassword, sendPasswordReset } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

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
          throw new Error('Username must be at least 3 characters.');
        }
        const avail = await isUsernameAvailable(cleanUsername, user?.userId);
        if (!avail) {
          throw new Error('This username is already taken. Please choose another.');
        }
      }

      if (secretPin.trim() && secretPin.trim().length < 4) {
        throw new Error('Secret PIN should be 4 to 6 digits.');
      }

      await updateProfile(displayName, about, photoURL, cleanUsername, secretPin.trim());
      setSuccessMessage('Profile and security settings saved successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      await changePassword(newPassword);
      setSuccessMessage('Password changed successfully!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to change password.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!user?.email) {
      setErrorMessage('No email associated with this account.');
      return;
    }
    setSaving(true);
    setErrorMessage(null);
    try {
      await sendPasswordReset(user.email);
      setSuccessMessage(`Password recovery email sent to ${user.email}. Check your inbox!`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to send recovery email.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-lg shadow-2xl relative max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              {activeTab === 'profile' ? <User className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Profile & Security Settings</h3>
              <p className="text-xs text-slate-400">Control your identity and quick login access</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-800/80 mx-5 mt-4 rounded-xl border border-slate-700/60 shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('profile');
              setErrorMessage(null);
            }}
            className={`py-2 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'profile'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile Details</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('security');
              setErrorMessage(null);
            }}
            className={`py-2 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'security'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Security & PIN</span>
          </button>
        </div>

        {/* Messages */}
        <div className="px-5 pt-3">
          {successMessage && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-xs text-emerald-200 flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}
          {errorMessage && (
            <div className="p-3 bg-red-950/80 border border-red-500/40 rounded-xl text-xs text-red-200 flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Tab Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'profile' ? (
            <form id="profile-form" onSubmit={handleSaveProfile} className="space-y-4">
              {/* Avatar Picker */}
              <div className="flex flex-col items-center">
                <div className="relative mb-3">
                  <img
                    src={photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=user'}
                    alt="Avatar"
                    className="w-20 h-20 rounded-full border-2 border-emerald-500 object-cover shadow-lg"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mb-2">Select an avatar style:</p>
                <div className="flex gap-2 justify-center flex-wrap">
                  {presetAvatars.map((url, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => setPhotoURL(url)}
                      className={`w-9 h-9 rounded-full border-2 overflow-hidden transition cursor-pointer ${
                        photoURL === url ? 'border-emerald-400 scale-110 shadow-md' : 'border-slate-700 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={url} alt={`preset ${i}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 transition"
                  maxLength={100}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">About / Status</label>
                <input
                  type="text"
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  placeholder="e.g. Busy | At the gym | In a meeting"
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 transition"
                  maxLength={200}
                />
              </div>

              <div className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl text-xs text-slate-400 flex items-center justify-between">
                <span>Account Email:</span>
                <span className="font-mono text-emerald-400">{user?.email || 'No email attached'}</span>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              {/* Username & Secret PIN Section */}
              <div className="p-4 bg-slate-800/60 border border-slate-700/70 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wide">
                  <AtSign className="w-4 h-4" />
                  <span>Unique Username & Quick PIN</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Set a unique username and a 4-6 digit secret PIN to log into your account on any device without entering a Google account!
                </p>

                {/* Username Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-300">Custom Username</label>
                    {usernameStatus === 'checking' && (
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Checking...
                      </span>
                    )}
                    {usernameStatus === 'available' && (
                      <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Available!
                      </span>
                    )}
                    {usernameStatus === 'taken' && (
                      <span className="text-[10px] text-red-400 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Already Taken!
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">@</span>
                    <input
                      type="text"
                      placeholder="e.g. mahimuhtasim"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      className="w-full pl-8 pr-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono transition"
                      maxLength={30}
                    />
                  </div>
                </div>

                {/* Secret PIN Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Secret Quick PIN (4-6 Digits)
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPin ? 'text' : 'password'}
                      placeholder="e.g. 123456"
                      value={secretPin}
                      onChange={(e) => setSecretPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono tracking-widest transition"
                      maxLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                    >
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Use this PIN to quickly unlock your account on another mobile phone.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={saving || usernameStatus === 'taken'}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Save Username & Secret PIN</span>
                </button>
              </div>

              {/* Password Recovery & Reset */}
              <div className="p-4 bg-slate-800/60 border border-slate-700/70 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-teal-400 uppercase tracking-wide">
                  <Lock className="w-4 h-4" />
                  <span>Password Management & Recovery</span>
                </div>

                {/* Change Password Form (if logged in with email) */}
                <form onSubmit={handleChangePassword} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">New Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 transition"
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm New Password</label>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 transition"
                      minLength={6}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={saving || !newPassword || !confirmPassword}
                    className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-50"
                  >
                    <span>Update Account Password</span>
                  </button>
                </form>

                {/* Send Password Recovery Link */}
                <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between">
                  <div className="text-[11px] text-slate-400">
                    <span>Forgot your current password?</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSendResetEmail}
                    disabled={saving}
                    className="px-3 py-1.5 bg-teal-600/30 hover:bg-teal-600/40 border border-teal-500/40 text-teal-300 rounded-xl text-xs font-medium flex items-center gap-1.5 cursor-pointer transition disabled:opacity-50"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Send Recovery Email</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === 'profile' && (
          <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0">
            <div className="text-[10px] text-slate-500">
              <span>Anomah Chat • <strong>Mahi A01</strong></span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium cursor-pointer"
              >
                Close
              </button>
              <button
                type="submit"
                form="profile-form"
                disabled={saving || !displayName.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md"
              >
                <Check className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Profile'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
