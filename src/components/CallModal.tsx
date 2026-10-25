import { useEffect, useState } from 'react';
import type { CallSession } from '../types/chat';
import { useLanguage } from '../context/LanguageContext';
import { sounds } from '../utils/audioEffects';
import { PhoneOff, Mic, MicOff, Video, VideoOff, Volume2 } from 'lucide-react';

interface CallModalProps {
  session: CallSession;
  onEndCall: () => void;
}

export function CallModal({ session, onEndCall }: CallModalProps) {
  const { t } = useLanguage();
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(session.type === 'audio');
  const [status, setStatus] = useState<'ringing' | 'connected'>('ringing');

  useEffect(() => {
    // Play ringtone while ringing
    const ringInterval = setInterval(() => {
      if (status === 'ringing') {
        sounds.playCallRingtone();
      }
    }, 3000);

    // Auto-connect after 3.5 seconds to simulate real partner picking up
    const connectTimeout = setTimeout(() => {
      setStatus('connected');
    }, 3500);

    return () => {
      clearInterval(ringInterval);
      clearTimeout(connectTimeout);
    };
  }, [status]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (status === 'connected') {
      timer = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [status]);

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl overflow-hidden shadow-2xl flex flex-col items-center justify-between p-8 min-h-[500px]">
        {/* Top Info */}
        <div className="flex flex-col items-center text-center">
          <div className="text-xs uppercase tracking-wider font-semibold text-emerald-400 mb-2 flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 animate-pulse" />
            <span>
              {session.type === 'video' ? t('videoCall') : t('audioCall')}
            </span>
          </div>

          <h3 className="text-2xl font-bold text-white mb-1">{session.recipientName}</h3>
          <p className="text-xs text-slate-400">
            {status === 'ringing' ? t('callRinging') : formatSeconds(duration)}
          </p>
        </div>

        {/* Center Video/Avatar Stage */}
        <div className="relative my-8 flex items-center justify-center">
          {session.type === 'video' && !isVideoOff ? (
            <div className="w-64 h-64 md:w-80 md:h-60 rounded-2xl bg-slate-800 border-2 border-emerald-500/40 overflow-hidden relative shadow-inner flex items-center justify-center">
              <div className="text-center p-4">
                <img
                  src={session.recipientPhoto || 'https://api.dicebear.com/7.x/bottts/svg?seed=partner'}
                  alt={session.recipientName}
                  className="w-20 h-20 rounded-full mx-auto mb-2 border-2 border-emerald-400"
                />
                <span className="text-xs text-slate-300">{t('liveCameraStream')}</span>
              </div>
              <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-black/60 text-[10px] text-emerald-400 font-mono">
                HD 1080p
              </div>
            </div>
          ) : (
            <div className="relative">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-emerald-500/50 shadow-2xl relative">
                <img
                  src={session.recipientPhoto || 'https://api.dicebear.com/7.x/bottts/svg?seed=partner'}
                  alt={session.recipientName}
                  className="w-full h-full object-cover"
                />
              </div>
              {status === 'ringing' && (
                <span className="absolute -inset-2 rounded-full border border-emerald-400/40 animate-ping pointer-events-none" />
              )}
            </div>
          )}
        </div>

        {/* Bottom Call Controls */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition cursor-pointer ${
              isMuted ? 'bg-red-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
            title={isMuted ? t('unmute') : t('mute')}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {session.type === 'video' && (
            <button
              onClick={() => setIsVideoOff(!isVideoOff)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition cursor-pointer ${
                isVideoOff ? 'bg-red-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
              title={isVideoOff ? t('turnCameraOn') : t('turnCameraOff')}
            >
              {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>
          )}

          <button
            onClick={onEndCall}
            className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/30 transition cursor-pointer"
            title={t('endCall')}
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
