import { useAuth } from '../context/AuthContext';
import { MessageSquare, Globe, Shield, Sparkles, CheckCircle2, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';

export function LoginScreen() {
  const { signInWithGoogle, loading, authError, clearAuthError } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-slate-900/95 border border-emerald-500/30 rounded-3xl shadow-2xl backdrop-blur-xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
        
        {/* Left Branding Showcase */}
        <div className="p-8 md:p-10 bg-gradient-to-br from-emerald-600/20 to-teal-800/30 flex flex-col justify-between border-b md:border-b-0 md:border-r border-emerald-500/20">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold mb-6">
              <Sparkles className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
              <span>Worldwide Cloud Messenger</span>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/30">
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

            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              Connect and chat personal 1-to-1 or in groups with anyone around the globe in real time. Powered by Anomah Chat Cloud, created by Mahi Muhtasim.
            </p>

            <div className="space-y-3.5">
              <div className="flex items-start gap-3 text-xs text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>100% Real-Time & Persistent:</strong> Data stays saved safely in Firebase Firestore online database.</span>
              </div>
              <div className="flex items-start gap-3 text-xs text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Voice Notes & Media:</strong> Record live audio messages and share images instantly.</span>
              </div>
              <div className="flex items-start gap-3 text-xs text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Double Blue Ticks:</strong> See when your messages are sent, delivered, and read by your partner.</span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-emerald-500/20 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-emerald-400" /> By Mahi Muhtasim
            </span>
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-teal-400" /> Version: Mahi A01
            </span>
          </div>
        </div>

        {/* Right Authentication Form */}
        <div className="p-8 md:p-10 flex flex-col justify-center">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-1">Welcome to Anomah Chat</h2>
            <p className="text-xs text-emerald-400 font-medium mb-1">Official Build • Mahi Muhtasim (vMahi A01)</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Sign in with your Google account to get your online profile and start chatting with anyone worldwide.
            </p>
          </div>

          {/* Auth Error Notification */}
          {authError && (
            <div className="mb-5 p-3.5 bg-red-950/60 border border-red-500/40 rounded-2xl flex items-start gap-2.5 text-xs text-red-200">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p>{authError}</p>
                <button
                  onClick={clearAuthError}
                  className="mt-1 text-[11px] underline text-red-300 hover:text-white"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Google Sign-in Button */}
          <button
            onClick={signInWithGoogle}
            disabled={loading}
            className="w-full py-4 px-5 bg-white hover:bg-slate-100 text-slate-900 rounded-2xl font-semibold flex items-center justify-center gap-3 transition-all duration-200 shadow-xl hover:shadow-2xl disabled:opacity-60 cursor-pointer mb-5 group"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-slate-800" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
                <span className="text-sm font-semibold">Sign in with Google</span>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:translate-x-1 transition ml-auto" />
              </>
            )}
          </button>

          {/* Quick instructions for sharing and multi-user chat */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 text-xs text-slate-300 space-y-2">
            <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" /> How to chat with people worldwide:
            </div>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-400">
              <li>Sign in with your Google account.</li>
              <li>Click <strong>Share App Link</strong> to share this URL with a friend in another country or open in an Incognito window.</li>
              <li>Your friend logs in with their account, and you will see each other live in the contact directory!</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
