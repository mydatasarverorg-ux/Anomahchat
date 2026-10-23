import { useState } from 'react';
import { Copy, Check, Globe, Users, QrCode, X } from 'lucide-react';

export function ShareLinkModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Chat with Anyone Worldwide</h3>
            <p className="text-xs text-slate-400">Share this URL to connect across devices & countries</p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mb-4">
          Anyone who opens this link can log in to <strong>Anomah Chat</strong> from their smartphone, tablet, or PC anywhere in the world and chat with you in real time. Created by Mahi Muhtasim (vMahi A01).
        </p>

        <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3 mb-4 flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={currentUrl}
            className="flex-1 bg-transparent text-xs text-slate-200 outline-none select-all"
          />
          <button
            onClick={copyToClipboard}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        <div className="bg-emerald-950/40 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-300 space-y-1">
          <div className="font-semibold flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Quick Testing Tip:
          </div>
          <p className="text-[11px] text-emerald-200/80">
            Open this URL in an <strong>Incognito window</strong> or on your <strong>mobile phone</strong> to see real-time two-way chatting, delivery blue ticks, and voice notes live in action!
          </p>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
