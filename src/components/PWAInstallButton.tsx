import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useLanguage } from '../context/LanguageContext';
import { Download, Share2, PlusSquare, X, Smartphone, Monitor } from 'lucide-react';

interface PWAInstallButtonProps {
  variant?: 'header' | 'sidebar' | 'banner';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'sidebar' }) => {
  const { isInstallable, isInstalled, isIOS, isNativeApp, install } = usePWAInstall();
  const { language } = useLanguage();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [showDesktopGuide, setShowDesktopGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // If running inside Capacitor Native APK, already installed as PWA, or dismissed, hide
  if (isNativeApp || isInstalled || dismissed) {
    return null;
  }

  const handleAction = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (isInstallable) {
      const ok = await install();
      if (!ok) {
        setShowDesktopGuide(true);
      }
    } else {
      setShowDesktopGuide(true);
    }
  };

  const label = language === 'bn' ? 'অ্যাপ ইনস্টল করুন' : 'Install App';
  const tagline =
    language === 'bn'
      ? 'ডেক্সটপ বা মোবাইলে ১-ক্লিকে অ্যাপ হিসেবে চালান'
      : 'Install on PC or phone for instant full-screen experience';

  if (variant === 'banner') {
    return (
      <>
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900/90 border-b border-emerald-500/30 px-3 py-2 flex items-center justify-between gap-2 shadow-md animate-in slide-in-from-top-1 z-20">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
              <Monitor className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="truncate">
              <span className="text-xs font-bold text-white block leading-tight truncate">
                {language === 'bn' ? 'অনমাহ চ্যাট (PWA) ইনস্টল করুন' : 'Install Anomah Chat'}
              </span>
              <span className="text-[10px] text-emerald-300 block leading-tight truncate">
                {tagline}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleAction}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="p-1 text-slate-400 hover:text-white rounded-md transition cursor-pointer"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Desktop Browser Guided Install Modal */}
        {showDesktopGuide && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative text-white">
              <button
                onClick={() => setShowDesktopGuide(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                  <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {language === 'bn' ? 'কম্পিউটার বা ল্যাপটপে ইনস্টল করার নিয়ম' : 'Install on PC / Laptop'}
                  </h4>
                  <p className="text-[11px] text-slate-400">Google Chrome / Microsoft Edge</p>
                </div>
              </div>

              <div className="space-y-3 text-xs text-slate-200 bg-slate-950/80 p-4 rounded-xl border border-slate-800 mb-5">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    {language === 'bn' ? (
                      <span>
                        ব্রাউজারের অ্যাড্রেস বারের (URL Bar) ডানপাশে থাকা <strong>ইনস্টল আইকনে (📥)</strong> ক্লিক করুন।
                      </span>
                    ) : (
                      <span>
                        Click the <strong>Install App icon (📥)</strong> on the right side of your browser address bar.
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    {language === 'bn' ? (
                      <span>
                        অথবা ব্রাউজারের ওপরের ডানপাশের <strong>থ্রি-ডট মেনু (⋮)</strong> ক্লিক করে <strong>"Save and share"</strong> বা <strong>"Install Anomah Chat..."</strong> চাপুন।
                      </span>
                    ) : (
                      <span>
                        Or click the <strong>three-dots menu (⋮)</strong> at top right and choose <strong>"Install Anomah Chat..."</strong>.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowDesktopGuide(false)}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow"
              >
                {language === 'bn' ? 'ঠিক আছে' : 'Got it'}
              </button>
            </div>
          </div>
        )}

        {/* iOS Guided Install Modal */}
        {showIOSModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-5 shadow-2xl relative">
              <button
                onClick={() => setShowIOSModal(false)}
                className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                </div>
                <h4 className="text-sm font-bold text-white">
                  {language === 'bn' ? 'আইফোনে ইনস্টল করার নিয়ম' : 'Install on iPhone / iPad'}
                </h4>
              </div>

              <div className="space-y-2.5 text-xs text-slate-300 mb-4 bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="flex-1">
                    {language === 'bn' ? (
                      <span>সাফারি ব্রাউজারের নিচে <strong>শেয়ার বোতামে (Share)</strong> চাপ দিন।</span>
                    ) : (
                      <span>Tap the <strong>Share</strong> button in Safari toolbar.</span>
                    )}
                    <div className="inline-flex items-center gap-1 ml-1 text-emerald-400">
                      <Share2 className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="flex-1">
                    {language === 'bn' ? (
                      <span>একটু নিচে স্ক্রল করে <strong>Add to Home Screen</strong> চাপুন।</span>
                    ) : (
                      <span>Scroll down and tap <strong>Add to Home Screen</strong>.</span>
                    )}
                    <div className="inline-flex items-center gap-1 ml-1 text-emerald-400">
                      <PlusSquare className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSModal(false)}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                {language === 'bn' ? 'বুঝতে পেরেছি' : 'Got it'}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Sidebar / Header button variant
  return (
    <>
      <button
        onClick={handleAction}
        className="w-full px-3 py-2 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/30 text-emerald-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer shadow-sm group"
        title={tagline}
      >
        <div className="flex items-center gap-2">
          <Download className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
          <span>{label}</span>
        </div>
        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-400/30 rounded text-emerald-300">
          PWA
        </span>
      </button>

      {/* Desktop Modal */}
      {showDesktopGuide && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative text-white">
            <button
              onClick={() => setShowDesktopGuide(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                <Monitor className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  {language === 'bn' ? 'কম্পিউটার বা ল্যাপটপে ইনস্টল করার নিয়ম' : 'Install on PC / Laptop'}
                </h4>
                <p className="text-[11px] text-slate-400">Google Chrome / Microsoft Edge</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-200 bg-slate-950/80 p-4 rounded-xl border border-slate-800 mb-5">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  {language === 'bn' ? (
                    <span>
                      ব্রাউজারের অ্যাড্রেস বারের (URL Bar) ডানপাশে থাকা <strong>ইনস্টল আইকনে (📥)</strong> ক্লিক করুন।
                    </span>
                  ) : (
                    <span>
                      Click the <strong>Install App icon (📥)</strong> on the right side of your browser address bar.
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  {language === 'bn' ? (
                    <span>
                      অথবা ব্রাউজারের ওপরের ডানপাশের <strong>থ্রি-ডট মেনু (⋮)</strong> ক্লিক করে <strong>"Save and share"</strong> বা <strong>"Install Anomah Chat..."</strong> চাপুন।
                    </span>
                  ) : (
                    <span>
                      Or click the <strong>three-dots menu (⋮)</strong> at top right and choose <strong>"Install Anomah Chat..."</strong>.
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowDesktopGuide(false)}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow"
            >
              {language === 'bn' ? 'ঠিক আছে' : 'Got it'}
            </button>
          </div>
        </div>
      )}

      {/* iOS Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-5 shadow-2xl relative">
            <button
              onClick={() => setShowIOSModal(false)}
              className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-emerald-400" />
              </div>
              <h4 className="text-sm font-bold text-white">
                {language === 'bn' ? 'আইফোনে ইনস্টল করার নিয়ম' : 'Install on iPhone / iPad'}
              </h4>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300 mb-4 bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  1
                </div>
                <div className="flex-1">
                  {language === 'bn' ? (
                    <span>সাফারি ব্রাউজারের নিচে <strong>শেয়ার বোতামে (Share)</strong> চাপ দিন।</span>
                  ) : (
                    <span>Tap the <strong>Share</strong> button in Safari toolbar.</span>
                  )}
                  <div className="inline-flex items-center gap-1 ml-1 text-emerald-400">
                    <Share2 className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  2
                </div>
                <div className="flex-1">
                  {language === 'bn' ? (
                    <span>একটু নিচে স্ক্রল করে <strong>Add to Home Screen</strong> চাপুন।</span>
                  ) : (
                    <span>Scroll down and tap <strong>Add to Home Screen</strong>.</span>
                  )}
                  <div className="inline-flex items-center gap-1 ml-1 text-emerald-400">
                    <PlusSquare className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              {language === 'bn' ? 'বুঝতে পেরেছি' : 'Got it'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
