import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Check, Camera, User, Sparkles } from 'lucide-react';

export function ProfileModal({ onClose }: { onClose: () => void }) {
  const { user, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [about, setAbout] = useState(user?.about || 'Available | Using AetherChat');
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
  const [saving, setSaving] = useState(false);

  const presetAvatars = [
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.displayName || 'Avatar1'}`,
    `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.displayName || 'Bot1'}`,
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  ];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      await updateProfile(displayName, about, photoURL);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-emerald-400" /> Edit Profile
        </h3>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Avatar Preview & Selection */}
          <div className="flex flex-col items-center">
            <div className="relative mb-3 group">
              <img
                src={photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=user'}
                alt="Avatar"
                className="w-20 h-20 rounded-full border-2 border-emerald-500 object-cover shadow-lg"
              />
            </div>

            <p className="text-[11px] text-slate-400 mb-2">Choose an avatar preset:</p>
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
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">About / Bio</label>
            <input
              type="text"
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="e.g. Busy | At the gym | In a meeting"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
              maxLength={200}
            />
          </div>

          <div className="pt-2 flex items-center justify-between">
            <div className="text-[10px] text-slate-500">
              <span>Anomah Chat • <strong>Mahi A01</strong></span>
              <span className="block text-[9px] text-slate-600">Built by Mahi Muhtasim</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !displayName.trim()}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
