import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useModalHistory } from '../hooks/useModalHistory';
import {
  MessageSquare,
  Globe,
  Shield,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  KeyRound,
  X,
  Languages,
  Phone,
  AtSign,
  Sparkles,
} from 'lucide-react';
import {
  submitRecoveryRequest,
  SUPPORT_DESK_ADDRESS,
  extractReadableFirestoreError,
} from '../services/adminService';
import { validateMobileNumber, extractPhoneDigits } from '../utils/phoneUtils';
import {
  getSavedDeviceAccounts,
  removeSavedDeviceAccount,
  setPendingChatTarget,
  setRememberDevicePending,
  type SavedDeviceAccount,
} from '../utils/accountShortcut';

export function LoginScreen() {
  const {
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    sendMagicSignInLink,
    completeMagicSignInLink,
    dismissMagicLinkPrompt,
    pendingMagicLinkPrompt,
    publicAuthFlags,
    sendPasswordReset,
    loading,
    authError,
    clearAuthError,
  } = useAuth();

  const { language, setLanguage, t } = useLanguage();

  // Mode: 'email-signin' | 'email-signup'
  const [authMode, setAuthMode] = useState<'email-signin' | 'email-signup'>('email-signin');

  // Form Fields
  const [name, setName] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Passwordless Magic Link UI State
  const [magicLinkMode, setMagicLinkMode] = useState(false);
  const [magicLinkSentTo, setMagicLinkSentTo] = useState<string | null>(null);
  const [magicConfirmEmail, setMagicConfirmEmail] = useState('');
  const [magicConfirmBusy, setMagicConfirmBusy] = useState(false);

  // Status & Notifications
  const [localError, setLocalError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // Recovery Support Desk Form Fields
  const [recoveryTab, setRecoveryTab] = useState<'email' | 'request'>('email');
  const [recoveryTopic, setRecoveryTopic] = useState<'app_lock' | 'lost_email' | 'suspended' | 'other'>('app_lock');
  const [supportEmail, setSupportEmail] = useState('');
  const [recoveryName, setRecoveryName] = useState('');
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [recoveryPhone, setRecoveryPhone] = useState('');
  const [recoveryDetails, setRecoveryDetails] = useState('');
  const [recoverySubmitting, setRecoverySubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Saved Quick-Tap Accounts on this device (zero passwords stored)
  const [savedAccounts, setSavedAccounts] = useState<SavedDeviceAccount[]>(() => getSavedDeviceAccounts());
  const [selectedSavedAccount, setSelectedSavedAccount] = useState<SavedDeviceAccount | null>(null);
  const [rememberDevice, setRememberDevice] = useState(true);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useModalHistory(showForgotModal, () => setShowForgotModal(false));

  // Preserve ?chat= target across sign-in/sign-up
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const target = params.get('chat');
      if (target?.trim()) {
        setPendingChatTarget(target.trim());
      }
    } catch {
      // ignore
    }
  }, []);

  // Automatically exit Magic Link mode if administrator disables it globally
  useEffect(() => {
    if (!publicAuthFlags.enableMagicLinkLogin && magicLinkMode) {
      setMagicLinkMode(false);
      setMagicLinkSentTo(null);
    }
  }, [publicAuthFlags.enableMagicLinkLogin, magicLinkMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();
    setLocalError(null);
    setInfoMessage(null);

    try {
      setRememberDevicePending(rememberDevice);
      if (authMode === 'email-signup') {
        if (!name.trim()) {
          setLocalError(language === 'bn' ? 'আপনার পুরো নাম লিখুন।' : 'Please enter your full name or nickname.');
          return;
        }
        const phoneCheck = validateMobileNumber(signupPhone, language);
        if (!phoneCheck.valid) {
          setLocalError(
            phoneCheck.error ||
              (language === 'bn'
                ? 'সঠিক মোবাইল নম্বর দিন (একই নম্বরে সর্বোচ্চ ৩টি অ্যাকাউন্ট খোলা যাবে)।'
                : 'Please enter a valid mobile number (max 3 accounts per number).')
          );
          return;
        }
        const cleanUser = signupUsername.trim().replace(/^@/, '');
        if (cleanUser && cleanUser.length < 3) {
          setLocalError(
            language === 'bn'
              ? 'ইউজারনেম দিলে কমপক্ষে ৩ অক্ষরের হতে হবে।'
              : 'Username must be at least 3 characters if provided.'
          );
          return;
        }
        if (!email.trim() || !password.trim()) {
          setLocalError(language === 'bn' ? 'ইমেইল ও পাসওয়ার্ড লিখুন।' : 'Please enter an email and password.');
          return;
        }
        if (password.length < 6) {
          setLocalError(t('passwordMinLengthError'));
          return;
        }
        await signUpWithEmail(email, password, name, cleanUser || undefined, signupPhone);
      } else {
        const resolvedEmail = selectedSavedAccount ? selectedSavedAccount.email : email;
        if (magicLinkMode && publicAuthFlags.enableMagicLinkLogin) {
          if (!resolvedEmail.trim()) {
            setLocalError(
              language === 'bn'
                ? 'ম্যাজিক লিংক পেতে আপনার ইমেইল লিখুন।'
                : 'Please enter your email address for the Magic Link.'
            );
            return;
          }
          await sendMagicSignInLink(resolvedEmail);
          const cleanTarget = resolvedEmail.trim().toLowerCase();
          setMagicLinkSentTo(cleanTarget);
          setInfoMessage(
            language === 'bn'
              ? `${cleanTarget} ঠিকানায় ১-ক্লিক লগইন ম্যাজিক লিংক পাঠানো হয়েছে! ইনবক্স বা স্প্যাম ফোল্ডার চেক করে লিংকে ক্লিক করুন।`
              : `One-click Magic Sign-In Link sent to ${cleanTarget}! Open your inbox (or spam) and tap the link to sign in.`
          );
        } else {
          if (!resolvedEmail.trim() || !password.trim()) {
            setLocalError(language === 'bn' ? 'ইমেইল ও পাসওয়ার্ড লিখুন।' : 'Please enter your email and password.');
            return;
          }
          await signInWithEmail(resolvedEmail, password);
        }
      }
    } catch (err: unknown) {
      if (magicLinkMode && err instanceof Error && err.message) {
        setLocalError(err.message);
      }
      // Standard auth errors handled in AuthContext or localError
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    setModalError(null);
    try {
      await sendPasswordReset(forgotEmail.trim());
      setInfoMessage(t('recoveryEmailSent', { email: forgotEmail.trim() }));
      setShowForgotModal(false);
      setForgotEmail('');
    } catch (err: unknown) {
      const msg = extractReadableFirestoreError(err, language, t('recoveryEmailFailed'));
      setModalError(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  const activeError = localError || authError;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-3 md:p-6 relative safe-area-container">
      {/* Top Bar Quick Language Switcher */}
      <div className="w-full max-w-4xl flex justify-end mb-2.5 px-2">
        <div className="inline-flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl shadow-xs">
          <Languages className="w-3.5 h-3.5 text-emerald-400 ml-1.5" />
          <button
            onClick={() => setLanguage('en')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              language === 'en'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            English
          </button>
          <button
            onClick={() => setLanguage('bn')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              language === 'bn'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            বাংলা
          </button>
        </div>
      </div>

      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
        
        {/* Left Branding Showcase */}
        <div className="p-6 md:p-10 bg-slate-950/60 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800">
          <div>
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block mb-4">
              {t('loginHeroBadge')}
            </span>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-white">{t('appName')}</h1>
                  <span className="text-xs text-slate-400 font-mono font-medium">
                    {t('versionBadge')}
                  </span>
                </div>
                <p className="text-xs text-emerald-400 font-medium">{t('ownedBy')}</p>
              </div>
            </div>

            <p className="text-slate-300 text-xs md:text-sm leading-relaxed mb-6">
              {t('loginTagline')}
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>{t('loginFeature1Title')}:</strong> {t('loginFeature1Desc')}</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>{t('loginFeature2Title')}:</strong> {t('loginFeature2Desc')}</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>{t('loginFeature3Title')}:</strong> {t('loginFeature3Desc')}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-slate-400" /> By Mahi Muhtasim
            </span>
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" /> {t('versionBadge')}
            </span>
          </div>
        </div>

        {/* Right Authentication Form */}
        <div className="p-6 md:p-8 flex flex-col justify-center">
          {/* Sign In / Create Account Switcher */}
          <div className="grid grid-cols-2 p-1.5 bg-slate-800/90 rounded-2xl mb-4 border border-slate-700/70">
            <button
              type="button"
              onClick={() => {
                setAuthMode('email-signin');
                setLocalError(null);
                clearAuthError();
              }}
              className={`py-2 text-xs font-semibold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                authMode === 'email-signin'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>{t('loginTabEmailSignIn')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('email-signup');
                setSelectedSavedAccount(null);
                setLocalError(null);
                clearAuthError();
              }}
              className={`py-2 text-xs font-semibold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                authMode === 'email-signup'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>{t('loginTabEmailSignUp')}</span>
            </button>
          </div>

          {/* Quick-Tap Saved Accounts on This Device (Zero passwords stored) */}
          {authMode === 'email-signin' && savedAccounts.length > 0 && !selectedSavedAccount && (
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
                <span className="font-semibold text-slate-300">
                  {language === 'bn' ? 'এই ডিভাইসে সেভ করা অ্যাকাউন্ট' : 'Quick Sign-In on This Device'}
                </span>
                <span className="text-[10px]">
                  {language === 'bn' ? 'ট্যাপ করে দ্রুত ঢুকুন' : 'Tap to continue'}
                </span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
                {savedAccounts.map((acc) => (
                  <div
                    key={acc.userId}
                    onClick={() => {
                      setLocalError(null);
                      setInfoMessage(null);
                      setMagicLinkSentTo(null);
                      clearAuthError();
                      if (acc.provider === 'google') {
                        setRememberDevicePending(true);
                        signInWithGoogle();
                      } else if (acc.provider === 'magic_link') {
                        setSelectedSavedAccount(acc);
                        setEmail(acc.email);
                        setPassword('');
                        if (publicAuthFlags.enableMagicLinkLogin) {
                          setMagicLinkMode(true);
                        } else {
                          setMagicLinkMode(false);
                          setInfoMessage(
                            language === 'bn'
                              ? 'Magic Link বর্তমানে বন্ধ রয়েছে। পাসওয়ার্ড দিয়ে লগইন করুন, পাসওয়ার্ড না থাকলে "Forgot Password?" থেকে পাসওয়ার্ড সেট করুন অথবা Google ব্যবহার করুন।'
                              : 'Magic Link is currently disabled. Sign in with your password, tap "Forgot Password?" to set one, or use Google.'
                          );
                          setTimeout(() => passwordInputRef.current?.focus(), 60);
                        }
                      } else {
                        setSelectedSavedAccount(acc);
                        setEmail(acc.email);
                        setPassword('');
                        setMagicLinkMode(false);
                        setTimeout(() => passwordInputRef.current?.focus(), 60);
                      }
                    }}
                    className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-950/80 hover:bg-slate-800/90 border border-slate-800 hover:border-emerald-500/50 transition cursor-pointer group"
                  >
                    <img
                      src={acc.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${acc.userId}`}
                      alt={acc.displayName}
                      className="w-8 h-8 rounded-full object-cover bg-slate-800 border border-slate-700 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white truncate">{acc.displayName}</div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {acc.maskedEmail} ·{' '}
                        {acc.provider === 'google'
                          ? 'Google'
                          : acc.provider === 'magic_link'
                          ? language === 'bn'
                            ? 'ম্যাজিক লিংক'
                            : 'Magic Link'
                          : language === 'bn'
                          ? 'পাসওয়ার্ড'
                          : 'Password'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = removeSavedDeviceAccount(acc.userId);
                        setSavedAccounts(next);
                      }}
                      title={language === 'bn' ? 'ডিভাইস থেকে মুছুন' : 'Remove from device'}
                      className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notifications */}
          {infoMessage && (
            <div className="mb-3 p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-xs text-emerald-200 flex items-start gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1">{infoMessage}</div>
            </div>
          )}

          {activeError && (
            <div className="mb-3 p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-xs text-red-200 flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p>{activeError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setLocalError(null);
                    clearAuthError();
                  }}
                  className="mt-0.5 text-[11px] underline text-red-300 hover:text-white cursor-pointer"
                >
                  {t('close')}
                </button>
              </div>
            </div>
          )}

          {/* Email Auth Form */}
          <form onSubmit={handleSubmit} className="space-y-3 mb-3">
            {authMode === 'email-signup' && (
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    {t('loginFullNameLabel')} <span className="text-emerald-400">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder={language === 'bn' ? 'যেমন: আপনার নাম' : 'e.g. John Doe'}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                      maxLength={100}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      {language === 'bn' ? 'মোবাইল নম্বর' : 'Mobile Number'} <span className="text-emerald-400">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        required
                        placeholder="+880 1XXX-XXXXXX"
                        value={signupPhone}
                        onChange={(e) => setSignupPhone(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                        maxLength={50}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {language === 'bn'
                        ? 'একই নম্বরে সর্বোচ্চ ৩টি অ্যাকাউন্ট খোলা যাবে (ভুয়া নম্বর গ্রহণযোগ্য নয়)'
                        : 'Max 3 accounts per number · Fake numbers blocked'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      {t('loginUsernameLabel')}
                    </label>
                    <div className="relative">
                      <AtSign className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="username"
                        value={signupUsername}
                        onChange={(e) => setSignupUsername(e.target.value.replace(/\s+/g, ''))}
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                        maxLength={50}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {selectedSavedAccount && authMode === 'email-signin' ? (
              <div className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={selectedSavedAccount.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${selectedSavedAccount.userId}`}
                    alt={selectedSavedAccount.displayName}
                    className="w-9 h-9 rounded-full object-cover border border-emerald-500/40 bg-slate-800 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{selectedSavedAccount.displayName}</div>
                    <div className="text-[11px] text-emerald-300/80 truncate">{selectedSavedAccount.maskedEmail}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSavedAccount(null);
                    setEmail('');
                    setPassword('');
                  }}
                  className="text-[11px] text-slate-300 hover:text-white underline shrink-0 cursor-pointer"
                >
                  {language === 'bn' ? 'অন্য অ্যাকাউন্ট' : 'Switch'}
                </button>
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  {t('loginEmailLabel')}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>
            )}

            {/* Password Field (Hidden when using Passwordless Magic Link mode) */}
            {!(authMode === 'email-signin' && magicLinkMode && publicAuthFlags.enableMagicLinkLogin) ? (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    {t('loginPasswordLabel')}{' '}
                    {authMode === 'email-signup' && (
                      <span className="text-slate-400 font-normal">(min 6)</span>
                    )}
                  </label>
                  {authMode === 'email-signin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setModalError(null);
                        if (selectedSavedAccount?.email) {
                          setForgotEmail(selectedSavedAccount.email);
                          setSupportEmail(selectedSavedAccount.email);
                        }
                        setShowForgotModal(true);
                      }}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                    >
                      {t('loginForgotPasswordBtn')}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    ref={passwordInputRef}
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                    minLength={authMode === 'email-signup' ? 6 : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer p-0.5"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-950/35 border border-emerald-500/35 text-[11px] text-emerald-200/90 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {language === 'bn'
                      ? 'পাসওয়ার্ড ছাড়াই ইমেইল ম্যাজিক লিংক লগইন'
                      : 'Passwordless Email Magic Link'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 leading-relaxed">
                  {magicLinkSentTo
                    ? language === 'bn'
                      ? `${magicLinkSentTo} ইনবক্সে যাওয়া লিংকে ক্লিক করলেই সরাসরি লগইন হয়ে যাবে। না পেলে Spam/Promotions ফোল্ডার দেখুন।`
                      : `Tap the one-click link sent to ${magicLinkSentTo}. Check Spam/Promotions if needed.`
                    : language === 'bn'
                    ? 'আপনার ইমেইলে একটি সুরক্ষিত ওয়ান-টাইম লগইন লিংক পাঠানো হবে। কোনো পাসওয়ার্ড টাইপ করতে হবে না।'
                    : 'We will email a secure one-time sign-in link to your inbox—no password needed.'}
                </p>
              </div>
            )}

            {/* Toggle between Password Sign-In and Magic Link Sign-In (when Admin enabled) */}
            {authMode === 'email-signin' && publicAuthFlags.enableMagicLinkLogin && (
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setMagicLinkMode((prev) => !prev);
                    setMagicLinkSentTo(null);
                    setLocalError(null);
                    clearAuthError();
                  }}
                  className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1.5 cursor-pointer transition"
                >
                  {magicLinkMode ? (
                    <>
                      <Lock className="w-3 h-3" />
                      <span>
                        {language === 'bn'
                          ? 'পাসওয়ার্ড দিয়ে লগইনে ফিরে যান'
                          : 'Use Password Instead'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3" />
                      <span>
                        {language === 'bn'
                          ? 'পাসওয়ার্ড ছাড়া Magic Link দিয়ে লগইন করুন'
                          : 'Sign In with Email Magic Link (No Password)'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Opt-in Remember Account Card (Passwordless Quick-Tap) */}
            {!selectedSavedAccount && (
              <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer select-none pt-0.5">
                <input
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500/40"
                />
                <span>
                  {language === 'bn'
                    ? 'দ্রুত লগইনের জন্য এই ডিভাইসে অ্যাকাউন্ট মনে রাখুন (পাসওয়ার্ড নয়)'
                    : 'Save account card on this device (no password stored)'}
                </span>
              </label>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition cursor-pointer disabled:opacity-50 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('loading')}</span>
                </>
              ) : authMode === 'email-signin' && magicLinkMode && publicAuthFlags.enableMagicLinkLogin ? (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {magicLinkSentTo
                      ? language === 'bn'
                        ? 'আবার ম্যাজিক লিংক পাঠান'
                        : 'Resend Magic Login Link'
                      : language === 'bn'
                      ? 'ইমেইলে ম্যাজিক লিংক পাঠান'
                      : 'Send Magic Sign-In Link'}
                  </span>
                </>
              ) : (
                <>
                  <span>
                    {authMode === 'email-signup' ? t('loginSignUpBtn') : t('loginSignInBtn')}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-2.5">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-3 text-[10px] text-slate-500 font-medium tracking-wider uppercase shrink-0">
              {t('loginOrDivider')}
            </span>
            <div className="border-t border-slate-800 w-full" />
          </div>

          {/* Google Sign-in Button */}
          <button
            type="button"
            onClick={() => {
              setPassword('');
              clearAuthError();
              setRememberDevicePending(rememberDevice);
              signInWithGoogle();
            }}
            disabled={loading}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-xl text-xs font-medium flex items-center justify-center gap-2.5 transition cursor-pointer disabled:opacity-50 hover:border-slate-600"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{t('loginGoogleBtn')}</span>
          </button>
        </div>
      </div>

      {/* Password Reset & Admin Support Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in select-none">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <KeyRound className="w-5 h-5 text-emerald-400" />
              <h4 className="text-base font-bold text-white">
                {t('recoveryDeskTitle')}
              </h4>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              {t('recoveryDeskSubtitle')}
            </p>

            {/* Mode Switcher Tabs (Reset Email / Support Ticket) */}
            <div className="grid grid-cols-2 p-1 bg-slate-950 border border-slate-800 rounded-xl mb-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setRecoveryTab('email');
                  setModalError(null);
                }}
                className={`py-1.5 px-2 rounded-lg transition cursor-pointer text-center truncate ${
                  recoveryTab === 'email'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t('loginSendResetBtn')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRecoveryTab('request');
                  setModalError(null);
                }}
                className={`py-1.5 px-2 rounded-lg transition cursor-pointer text-center truncate ${
                  recoveryTab === 'request'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t('submitRecoveryBtn')}
              </button>
            </div>

            {modalError && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {/* TAB 1: Automated Firebase Reset Email */}
            {recoveryTab === 'email' && (
              <form onSubmit={handleForgotPassword} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300 block">{t('applicantEmail')}</label>
                  <input
                    type="email"
                    required
                    maxLength={150}
                    placeholder="your.email@example.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  {t('loginForgotModalDesc')}
                </p>
                <button
                  type="submit"
                  disabled={forgotLoading || !forgotEmail.trim()}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
                >
                  {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>{t('loginSendResetBtn')}</span>}
                </button>
              </form>
            )}

            {/* TAB 2: Submit Admin Support Ticket (No plaintext credentials ever stored) */}
            {recoveryTab === 'request' && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setModalError(null);
                  const cleanEmail = supportEmail.trim();
                  const hasEmail = cleanEmail.length >= 3 && cleanEmail.includes('@');
                  const hasPhone = extractPhoneDigits(recoveryPhone).length >= 6;
                  const hasUsername = recoveryUsername.trim().replace(/^@/, '').length >= 3;

                  if (cleanEmail.length > 0 && !hasEmail) {
                    setModalError(
                      language === 'bn'
                        ? 'সঠিক ফরম্যাটের ইমেইল লিখুন অথবা ফাঁকা রাখুন।'
                        : 'Please enter a valid email format or leave blank if forgotten.'
                    );
                    return;
                  }

                  if (recoveryTopic === 'lost_email') {
                    if (!hasPhone && !hasUsername && !hasEmail) {
                      setModalError(
                        language === 'bn'
                          ? 'ইমেইল ভুলে গেলে অন্তত আপনার নিবন্ধিত মোবাইল নম্বর অথবা @ইউজারনেম দিন।'
                          : 'Please enter your registered mobile number or @username so we can locate your account.'
                      );
                      return;
                    }
                  } else if (!hasEmail) {
                    setModalError(
                      language === 'bn'
                        ? 'আপনার নিবন্ধিত ইমেইল ঠিকানা লিখুন।'
                        : 'Please enter your registered email address.'
                    );
                    return;
                  }

                  setRecoverySubmitting(true);
                  const topicLabels = {
                    app_lock: 'App-Lock PIN Reset',
                    lost_email: 'Lost Email / Login Access',
                    suspended: 'Suspension / Ban Appeal',
                    other: 'Account Help',
                  };
                  const combinedDetails = recoveryDetails.trim()
                    ? `[${topicLabels[recoveryTopic]}] ${recoveryDetails.trim()}`
                    : `[${topicLabels[recoveryTopic]}] User requested administrator assistance.`;

                  try {
                    const ticketId = await submitRecoveryRequest({
                      email: cleanEmail,
                      name: recoveryName.trim() || undefined,
                      username: recoveryUsername.trim() || undefined,
                      contactPhone: recoveryPhone.trim() || undefined,
                      topic: recoveryTopic,
                      details: combinedDetails.slice(0, 1000),
                    });
                    setInfoMessage(`${t('recoverySubmittedSuccess')} (Ticket ID: ${ticketId})`);
                    setShowForgotModal(false);
                    setRecoveryDetails('');
                    setRecoveryName('');
                    setRecoveryUsername('');
                    setRecoveryPhone('');
                    setSupportEmail('');
                  } catch (err: unknown) {
                    setModalError(
                      extractReadableFirestoreError(err, language, 'Failed to submit support ticket.')
                    );
                  } finally {
                    setRecoverySubmitting(false);
                  }
                }}
                className="space-y-3"
              >
                {/* Automatically Routed Support Desk Address Banner (Read-Only) */}
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-[11px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Mail className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-slate-400 shrink-0">
                      {language === 'bn' ? 'প্রাপক:' : 'To:'}
                    </span>
                    <span className="font-mono font-bold text-emerald-400 truncate">
                      {SUPPORT_DESK_ADDRESS}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                    {language === 'bn' ? 'স্বয়ংক্রিয়ভাবে সেট' : 'Auto-routed'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300 block">
                    {language === 'bn' ? 'সমস্যার ধরন নির্বাচন করুন' : 'Select Issue Category'}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    {[
                      {
                        id: 'app_lock' as const,
                        label: language === 'bn' ? 'অ্যাপ-লক পিন ভুলে গেছি' : 'Forgot App-Lock PIN',
                      },
                      {
                        id: 'lost_email' as const,
                        label: language === 'bn' ? 'ইমেইল/অ্যাক্সেস হারিয়েছি' : 'Lost Email / Access',
                      },
                      {
                        id: 'suspended' as const,
                        label: language === 'bn' ? 'অ্যাকাউন্ট স্থগিত / আপিল' : 'Suspension Appeal',
                      },
                      {
                        id: 'other' as const,
                        label: language === 'bn' ? 'অন্যান্য সহায়তা' : 'Other Help',
                      },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setRecoveryTopic(cat.id);
                          setModalError(null);
                        }}
                        className={`px-2.5 py-1.5 rounded-xl border text-left font-semibold transition cursor-pointer truncate ${
                          recoveryTopic === cat.id
                            ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm'
                            : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {recoveryTopic === 'lost_email' && (
                  <p className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 leading-relaxed">
                    {language === 'bn'
                      ? 'আপনি যেহেতু ইমেইল ভুলে গেছেন, ইমেইল ঘরটি ফাঁকা রাখতে পারেন — নিচে আপনার নিবন্ধিত মোবাইল নম্বর অথবা @ইউজারনেম দিন।'
                      : 'Lost your email? You may leave email blank — enter your registered mobile number or @username below to verify your account.'}
                  </p>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300 block">
                    {t('applicantEmail')}{' '}
                    {recoveryTopic === 'lost_email' ? (
                      <span className="text-slate-400 font-normal">
                        ({language === 'bn' ? 'ঐচ্ছিক / বিকল্প ইমেইল' : 'Optional'})
                      </span>
                    ) : (
                      <span className="text-emerald-400">*</span>
                    )}
                  </label>
                  <input
                    type="email"
                    required={recoveryTopic !== 'lost_email'}
                    maxLength={150}
                    placeholder={
                      recoveryTopic === 'lost_email'
                        ? language === 'bn'
                          ? 'বিকল্প যোগাযোগের ইমেইল (ঐচ্ছিক)'
                          : 'alternate.contact@example.com (optional)'
                        : 'registered.email@example.com'
                    }
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300 block">{t('applicantName')}</label>
                    <input
                      type="text"
                      maxLength={100}
                      placeholder={language === 'bn' ? 'আপনার নাম' : 'Your Name'}
                      value={recoveryName}
                      onChange={(e) => setRecoveryName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300 block">
                      Username {recoveryTopic === 'lost_email' && <span className="text-emerald-400">*</span>}
                    </label>
                    <input
                      type="text"
                      maxLength={50}
                      placeholder="@username"
                      value={recoveryUsername}
                      onChange={(e) => setRecoveryUsername(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300 block">
                    {t('applicantPhone')}{' '}
                    {recoveryTopic === 'lost_email' && <span className="text-emerald-400">*</span>}
                  </label>
                  <input
                    type="tel"
                    maxLength={50}
                    placeholder="+880 1XXX-XXXXXX"
                    value={recoveryPhone}
                    onChange={(e) => setRecoveryPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-300 block">{t('applicantDetails')}</label>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {recoveryDetails.length}/920
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    maxLength={920}
                    placeholder={
                      language === 'bn'
                        ? 'আপনার সমস্যা বা যুক্তি/তথ্য সংক্ষেপে লিখুন...'
                        : 'Explain what happened or any verification info...'
                    }
                    value={recoveryDetails}
                    onChange={(e) => setRecoveryDetails(e.target.value.slice(0, 920))}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={
                    recoverySubmitting ||
                    (recoveryTopic === 'lost_email'
                      ? extractPhoneDigits(recoveryPhone).length < 6 &&
                        recoveryUsername.trim().replace(/^@/, '').length < 3 &&
                        !(supportEmail.trim().length >= 3 && supportEmail.includes('@'))
                      : !(supportEmail.trim().length >= 3 && supportEmail.includes('@')))
                  }
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition shadow"
                >
                  {recoverySubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <KeyRound className="w-4 h-4" />
                  )}
                  <span>{t('submitRecoveryBtn')}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Cross-Device Magic Link Email Confirmation Modal */}
      {pendingMagicLinkPrompt && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4 relative">
            <button
              type="button"
              onClick={dismissMagicLinkPrompt}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              aria-label={t('close')}
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  {language === 'bn' ? 'ম্যাজিক লিংক যাচাই করুন' : 'Confirm Magic Link Email'}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {language === 'bn'
                    ? 'নিরাপত্তার জন্য যে ইমেইলে লিংক পাঠিয়েছিলেন সেটি লিখুন'
                    : 'Re-enter the email that received this link'}
                </p>
              </div>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!magicConfirmEmail.trim()) return;
                setMagicConfirmBusy(true);
                try {
                  setRememberDevicePending(rememberDevice);
                  await completeMagicSignInLink(magicConfirmEmail.trim());
                } finally {
                  setMagicConfirmBusy(false);
                }
              }}
              className="space-y-3"
            >
              <input
                type="email"
                required
                autoFocus
                value={magicConfirmEmail}
                onChange={(e) => setMagicConfirmEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={dismissMagicLinkPrompt}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={magicConfirmBusy || !magicConfirmEmail.trim()}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {magicConfirmBusy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>{language === 'bn' ? 'লগইন সম্পন্ন করুন' : 'Complete Sign-In'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
