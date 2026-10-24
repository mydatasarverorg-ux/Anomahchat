import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  MessageSquare,
  Globe,
  Shield,
  Sparkles,
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
  AtSign,
  X,
} from 'lucide-react';

export function LoginScreen() {
  const {
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    loginWithSecretPin,
    sendPasswordReset,
    loading,
    authError,
    clearAuthError,
  } = useAuth();

  // Mode: 'email-signin' | 'email-signup' | 'pin-login'
  const [authMode, setAuthMode] = useState<'email-signin' | 'email-signup' | 'pin-login'>('email-signin');

  // Form Fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // PIN Form Fields
  const [pinIdentifier, setPinIdentifier] = useState('');
  const [enteredPin, setEnteredPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  // Status & Notifications
  const [localError, setLocalError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();
    setLocalError(null);
    setInfoMessage(null);

    try {
      if (authMode === 'pin-login') {
        if (!pinIdentifier.trim() || !enteredPin.trim()) {
          setLocalError('Please enter both your Username/Email and Secret PIN.');
          return;
        }
        await loginWithSecretPin(pinIdentifier, enteredPin);
      } else if (authMode === 'email-signup') {
        if (!name.trim()) {
          setLocalError('Please enter your full name or nickname.');
          return;
        }
        if (!email.trim() || !password.trim()) {
          setLocalError('Please enter an email and password.');
          return;
        }
        if (password.length < 6) {
          setLocalError('Password must be at least 6 characters.');
          return;
        }
        await signUpWithEmail(email, password, name, username);
      } else {
        // email-signin
        if (!email.trim() || !password.trim()) {
          setLocalError('Please enter your email and password.');
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
      setInfoMessage(`Password reset link sent to ${forgotEmail}. Please check your inbox.`);
      setShowForgotModal(false);
      setForgotEmail('');
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Failed to send reset email.');
    } finally {
      setForgotLoading(false);
    }
  };

  const activeError = localError || authError;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 text-slate-100 flex items-center justify-center p-3 md:p-6">
      <div className="w-full max-w-4xl bg-slate-900/95 border border-emerald-500/30 rounded-3xl shadow-2xl backdrop-blur-xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
        
        {/* Left Branding Showcase */}
        <div className="p-6 md:p-10 bg-gradient-to-br from-emerald-600/20 to-teal-800/30 flex flex-col justify-between border-b md:border-b-0 md:border-r border-emerald-500/20">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold mb-5">
              <Sparkles className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
              <span>Worldwide Cloud Messenger</span>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0">
                <MessageSquare className="w-6 h-6 text-slate-950 fill-slate-950" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-white">Anomah Chat</h1>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold">
                    Mahi A01
                  </span>
                </div>
                <p className="text-xs text-emerald-400 font-medium">Built & Owned by Mahi Muhtasim</p>
              </div>
            </div>

            <p className="text-slate-300 text-xs md:text-sm leading-relaxed mb-6">
              Connect and chat 1-to-1 or in groups with anyone around the globe in real time. Choose your preferred login method: Email, Secret PIN, or Google!
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Multi-Device Login:</strong> Log into any phone via Email & Password or Secret PIN.</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Voice Notes & Media:</strong> Live audio recording and fast image sharing.</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Full Privacy Protection:</strong> No need to add your personal Google account to someone else's phone.</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-emerald-500/20 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-emerald-400" /> By Mahi Muhtasim
            </span>
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-teal-400" /> Version: Mahi A01
            </span>
          </div>
        </div>

        {/* Right Authentication Form */}
        <div className="p-6 md:p-8 flex flex-col justify-center">
          
          {/* Main Mode Selector: Email vs Secret PIN */}
          <div className="grid grid-cols-2 p-1.5 bg-slate-800/90 rounded-2xl mb-4 border border-slate-700/70">
            <button
              type="button"
              onClick={() => {
                setAuthMode('email-signin');
                setLocalError(null);
                clearAuthError();
              }}
              className={`py-2 text-xs font-semibold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                authMode === 'email-signin' || authMode === 'email-signup'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email & Password</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('pin-login');
                setLocalError(null);
                clearAuthError();
              }}
              className={`py-2 text-xs font-semibold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                authMode === 'pin-login'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Secret PIN Login</span>
            </button>
          </div>

          {/* Sub-selector for Email (Sign In vs Create Account) */}
          {(authMode === 'email-signin' || authMode === 'email-signup') && (
            <div className="flex items-center justify-center gap-4 mb-3 text-xs">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('email-signin');
                  setLocalError(null);
                  clearAuthError();
                }}
                className={`font-semibold pb-1 cursor-pointer transition border-b-2 ${
                  authMode === 'email-signin'
                    ? 'border-emerald-400 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <span className="text-slate-600">•</span>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('email-signup');
                  setLocalError(null);
                  clearAuthError();
                }}
                className={`font-semibold pb-1 cursor-pointer transition border-b-2 ${
                  authMode === 'email-signup'
                    ? 'border-emerald-400 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Create New Account
              </button>
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
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3 mb-3">
            {authMode === 'pin-login' ? (
              /* PIN Login Fields */
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Username or Registered Email
                  </label>
                  <div className="relative">
                    <AtSign className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. mahimuhtasim or name@gmail.com"
                      value={pinIdentifier}
                      onChange={(e) => setPinIdentifier(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Your 4-6 Digit Secret PIN
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPin ? 'text' : 'password'}
                      required
                      placeholder="••••"
                      value={enteredPin}
                      onChange={(e) => setEnteredPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono tracking-widest transition"
                      maxLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer p-0.5"
                    >
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Fast unlock without needing a Google account on this phone.
                  </span>
                </div>
              </>
            ) : (
              /* Email Auth Fields */
              <>
                {authMode === 'email-signup' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Mahi Muhtasim"
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
                    Email Address
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
                      Password {authMode === 'email-signup' && <span className="text-slate-400 font-normal">(min 6 chars)</span>}
                    </label>
                    {authMode === 'email-signin' && (
                      <button
                        type="button"
                        onClick={() => setShowForgotModal(true)}
                        className="text-[10px] text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                      >
                        Forgot password?
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
              </>
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
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>
                    {authMode === 'pin-login'
                      ? 'Unlock Account with PIN'
                      : authMode === 'email-signup'
                      ? 'Create Free Account & Start'
                      : 'Sign In to Anomah Chat'}
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
              OR
            </span>
            <div className="border-t border-slate-800 w-full" />
          </div>

          {/* Google Sign-in Button */}
          <button
            type="button"
            onClick={signInWithGoogle}
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
            <span>Continue with Google</span>
          </button>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative">
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
            <h4 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <Mail className="w-4 h-4 text-emerald-400" /> Reset Password
            </h4>
            <p className="text-xs text-slate-400 mb-4">
              Enter your registered email address. We will send you an official password recovery link.
            </p>
            <form onSubmit={handleForgotPassword} className="space-y-3">
              <input
                type="email"
                required
                placeholder="your.email@example.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={forgotLoading || !forgotEmail.trim()}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Send Reset Link</span>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
