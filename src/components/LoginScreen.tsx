import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
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
} from 'lucide-react';
import { submitRecoveryRequest } from '../services/adminService';

export function LoginScreen() {
  const {
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & Notifications
  const [localError, setLocalError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // Recovery Support Desk Form Fields
  const [recoveryTab, setRecoveryTab] = useState<'email' | 'request'>('email');
  const [recoveryName, setRecoveryName] = useState('');
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [recoveryPhone, setRecoveryPhone] = useState('');
  const [recoveryDetails, setRecoveryDetails] = useState('');
  const [recoverySubmitting, setRecoverySubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();
    setLocalError(null);
    setInfoMessage(null);

    try {
      if (authMode === 'email-signup') {
        if (!name.trim()) {
          setLocalError(language === 'bn' ? 'আপনার পুরো নাম লিখুন।' : 'Please enter your full name or nickname.');
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
        await signUpWithEmail(email, password, name);
      } else {
        if (!email.trim() || !password.trim()) {
          setLocalError(language === 'bn' ? 'ইমেইল ও পাসওয়ার্ড লিখুন।' : 'Please enter your email and password.');
          return;
        }
        await signInWithEmail(email, password);
      }
    } catch {
      // Error handled in AuthContext or localError
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    try {
      await sendPasswordReset(forgotEmail.trim());
      setInfoMessage(t('recoveryEmailSent', { email: forgotEmail }));
      setShowForgotModal(false);
      setForgotEmail('');
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : t('recoveryEmailFailed'));
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
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  {t('loginFullNameLabel')}
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
            )}

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

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-300">
                  {t('loginPasswordLabel')} {authMode === 'email-signup' && <span className="text-slate-400 font-normal">(min 6)</span>}
                </label>
                {authMode === 'email-signin' && (
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                  >
                    {t('loginForgotPasswordBtn')}
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                  minLength={6}
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
              signInWithGoogle();
            }}
            disabled={loading}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700/80 rounded-xl text-xs font-medium flex items-center justify-center gap-2.5 transition cursor-pointer disabled:opacity-50 hover:border-slate-600"
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
                onClick={() => setRecoveryTab('email')}
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
                onClick={() => setRecoveryTab('request')}
                className={`py-1.5 px-2 rounded-lg transition cursor-pointer text-center truncate ${
                  recoveryTab === 'request'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t('submitRecoveryBtn')}
              </button>
            </div>

            {/* TAB 1: Automated Firebase Reset Email */}
            {recoveryTab === 'email' && (
              <form onSubmit={handleForgotPassword} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300 block">{t('applicantEmail')}</label>
                  <input
                    type="email"
                    required
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
                  if (!forgotEmail.trim()) return;
                  setRecoverySubmitting(true);
                  try {
                    await submitRecoveryRequest({
                      email: forgotEmail.trim(),
                      name: recoveryName.trim() || undefined,
                      username: recoveryUsername.trim() || undefined,
                      contactPhone: recoveryPhone.trim() || undefined,
                      details: recoveryDetails.trim() || undefined,
                    });
                    setInfoMessage(t('recoverySubmittedSuccess'));
                    setShowForgotModal(false);
                    setRecoveryDetails('');
                  } catch (err: unknown) {
                    setLocalError(err instanceof Error ? err.message : 'Failed to submit support ticket.');
                  } finally {
                    setRecoverySubmitting(false);
                  }
                }}
                className="space-y-3"
              >
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300 block">
                    {t('applicantEmail')} <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="registered.email@example.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300 block">{t('applicantName')}</label>
                    <input
                      type="text"
                      placeholder="Your Name"
                      value={recoveryName}
                      onChange={(e) => setRecoveryName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300 block">Username</label>
                    <input
                      type="text"
                      placeholder="@username"
                      value={recoveryUsername}
                      onChange={(e) => setRecoveryUsername(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300 block">{t('applicantPhone')}</label>
                  <input
                    type="text"
                    placeholder="+880 1..."
                    value={recoveryPhone}
                    onChange={(e) => setRecoveryPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300 block">{t('applicantDetails')}</label>
                  <textarea
                    rows={2}
                    placeholder="Explain what happened or any verification info..."
                    value={recoveryDetails}
                    onChange={(e) => setRecoveryDetails(e.target.value)}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={recoverySubmitting || !forgotEmail.trim()}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
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
    </div>
  );
}
