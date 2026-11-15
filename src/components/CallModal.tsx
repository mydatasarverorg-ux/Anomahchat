import { useEffect, useRef, useState } from 'react';
import type { CallSession, UserProfile } from '../types/chat';
import { useLanguage } from '../context/LanguageContext';
import { sounds } from '../utils/audioEffects';
import {
  RTC_ICE_CONFIG,
  createCallSignal,
  answerCallSignal,
  updateCallSignalStatus,
  addIceCandidateSignal,
  subscribeToCallSignal,
  subscribeToIceCandidates,
  logCallToChat,
} from '../services/callService';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Volume2, AlertTriangle } from 'lucide-react';
import { cancelAppNotification } from '../services/notificationService';

interface CallModalProps {
  session: CallSession;
  currentUser: UserProfile;
  onEndCall: () => void;
}

export function CallModal({ session, currentUser, onEndCall }: CallModalProps) {
  const { t, language } = useLanguage();
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(session.type === 'audio');
  const [callState, setCallState] = useState<CallSession['status']>(
    session.role === 'callee' ? 'ringing' : 'calling'
  );
  const [errorText, setErrorText] = useState<string | null>(null);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const callIdRef = useRef<string | null>(session.callId || null);
  const endedRef = useRef(false);
  const connectedAtRef = useRef<number | null>(null);
  const callLoggedRef = useRef(false);
  const unsubSignalRef = useRef<(() => void) | null>(null);
  const unsubIceRef = useRef<(() => void) | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const callerId = session.role === 'caller' ? currentUser.userId : session.partnerId;

  const recordCallLogOnce = (finalStatus: 'ended' | 'declined' | 'missed') => {
    if (callLoggedRef.current) return;
    const activeCallId = callIdRef.current;
    if (!activeCallId || !session.chatId) return;
    callLoggedRef.current = true;

    const secs = connectedAtRef.current
      ? Math.max(1, Math.round((Date.now() - connectedAtRef.current) / 1000))
      : 0;

    let logStatus: 'completed' | 'missed' | 'declined' | 'cancelled' = 'cancelled';
    if (secs > 0) {
      logStatus = 'completed';
    } else if (finalStatus === 'declined') {
      logStatus = 'declined';
    } else if (finalStatus === 'missed') {
      logStatus = 'missed';
    } else {
      logStatus = session.role === 'caller' ? 'cancelled' : 'declined';
    }

    logCallToChat({
      chatId: session.chatId,
      callId: activeCallId,
      currentUser,
      callerId,
      callType: session.type,
      callStatus: logStatus,
      durationSeconds: secs,
    }).catch(() => {});
  };

  const cleanupMediaAndPeer = () => {
    unsubSignalRef.current?.();
    unsubSignalRef.current = null;
    unsubIceRef.current?.();
    unsubIceRef.current = null;

    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    remoteStreamRef.current = null;
  };

  const finishCall = async (nextStatus: 'ended' | 'declined' | 'missed' = 'ended', closeImmediately = true) => {
    if (endedRef.current) {
      if (closeImmediately) onEndCall();
      return;
    }
    endedRef.current = true;
    const activeCallId = callIdRef.current;
    cancelAppNotification(activeCallId || session.callId);
    recordCallLogOnce(nextStatus);
    cleanupMediaAndPeer();
    if (activeCallId && session.chatId) {
      await updateCallSignalStatus(session.chatId, activeCallId, nextStatus);
    }
    if (closeImmediately) {
      onEndCall();
    }
  };

  const attachRemoteMedia = (pc: RTCPeerConnection) => {
    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;

    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        if (!remoteStream.getTracks().some((t) => t.id === track.id)) {
          remoteStream.addTrack(track);
        }
        if (track.kind === 'video') {
          setHasRemoteVideo(true);
          track.onended = () => setHasRemoteVideo(false);
        }
      });
      if (!event.streams[0] && event.track) {
        remoteStream.addTrack(event.track);
        if (event.track.kind === 'video') setHasRemoteVideo(true);
      }

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch(() => {});
      }
    };

    const handleStateSync = () => {
      const connState = pc.connectionState;
      const iceState = pc.iceConnectionState;
      if (connState === 'connected' || iceState === 'connected' || iceState === 'completed') {
        if (!connectedAtRef.current) {
          connectedAtRef.current = Date.now();
        }
        setCallState('connected');
      } else if (connState === 'failed') {
        setErrorText(
          language === 'bn'
            ? 'নেটওয়ার্ক সংযোগ বিচ্ছিন্ন হয়েছে। কল শেষ করা হচ্ছে।'
            : 'Peer-to-peer connection failed due to network restrictions.'
        );
        setCallState('error');
      }
    };

    pc.onconnectionstatechange = handleStateSync;
    pc.oniceconnectionstatechange = handleStateSync;
  };

  const flushPendingIce = async (pc: RTCPeerConnection) => {
    const queue = [...pendingCandidatesRef.current];
    pendingCandidatesRef.current = [];
    for (const cand of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch {
        // Ignore stale ICE candidate
      }
    }
  };

  const addRemoteIceCandidate = async (pc: RTCPeerConnection, cand: RTCIceCandidateInit) => {
    if (!pc.remoteDescription) {
      pendingCandidatesRef.current.push(cand);
      return;
    }
    try {
      await pc.addIceCandidate(new RTCIceCandidate(cand));
    } catch {
      // Ignore benign duplicate/late ICE candidate
    }
  };

  // Ringtone loop while calling/ringing
  useEffect(() => {
    if (callState !== 'calling' && callState !== 'ringing') return;
    sounds.playCallRingtone();
    const ringInterval = setInterval(() => {
      sounds.playCallRingtone();
    }, 3000);
    return () => clearInterval(ringInterval);
  }, [callState]);

  // Real call duration timer (strictly only when WebRTC peer is connected)
  useEffect(() => {
    if (callState !== 'connected') return;
    const timer = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [callState]);

  // Caller initialization + Callee incoming signal watcher
  useEffect(() => {
    let mounted = true;
    let ringTimeout: ReturnType<typeof setTimeout> | null = null;

    const startOutgoingCall = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            language === 'bn'
              ? 'এই ডিভাইস বা ব্রাউজারে কলিং মিডিয়া সমর্থিত নয়।'
              : 'Camera/microphone access is unavailable in this browser.'
          );
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: session.type === 'video',
        });

        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current && session.type === 'video') {
          localVideoRef.current.srcObject = stream;
        }

        const pc = new RTCPeerConnection(RTC_ICE_CONFIG);
        pcRef.current = pc;
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        attachRemoteMedia(pc);

        const localIceQueue: RTCIceCandidate[] = [];
        pc.onicecandidate = (e) => {
          if (!e.candidate) return;
          if (callIdRef.current) {
            addIceCandidateSignal(session.chatId, callIdRef.current, 'offerCandidates', e.candidate).catch(() => {});
          } else {
            localIceQueue.push(e.candidate);
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const newCallId = await createCallSignal({
          chatId: session.chatId,
          caller: currentUser,
          calleeId: session.partnerId,
          calleeName: session.recipientName,
          calleePhoto: session.recipientPhoto,
          type: session.type,
          offer,
        });

        if (!mounted) {
          await updateCallSignalStatus(session.chatId, newCallId, 'ended');
          return;
        }

        callIdRef.current = newCallId;
        setCallState('ringing');

        for (const c of localIceQueue) {
          addIceCandidateSignal(session.chatId, newCallId, 'offerCandidates', c).catch(() => {});
        }

        unsubIceRef.current = subscribeToIceCandidates(
          session.chatId,
          newCallId,
          'answerCandidates',
          (cand) => {
            if (pcRef.current) addRemoteIceCandidate(pcRef.current, cand);
          }
        );

        unsubSignalRef.current = subscribeToCallSignal(session.chatId, newCallId, async (data) => {
          if (!mounted || !data) return;

          if (data.answer && pcRef.current && !pcRef.current.currentRemoteDescription) {
            try {
              setCallState('connecting');
              await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer as RTCSessionDescriptionInit));
              await flushPendingIce(pcRef.current);
            } catch (err) {
              console.warn('Set remote answer notice:', err);
            }
          }

          if (data.status === 'declined') {
            setCallState('declined');
            cleanupMediaAndPeer();
            setTimeout(() => {
              recordCallLogOnce('declined');
              if (mounted) onEndCall();
            }, 1400);
          } else if (data.status === 'ended' || data.status === 'missed') {
            setCallState(data.status);
            cleanupMediaAndPeer();
            setTimeout(() => {
              recordCallLogOnce(data.status as 'ended' | 'missed');
              if (mounted) onEndCall();
            }, 950);
          }
        });

        ringTimeout = setTimeout(() => {
          if (mounted && !endedRef.current && callIdRef.current) {
            setCallState((curr) => {
              if (curr === 'calling' || curr === 'ringing') {
                finishCall('missed', false);
                setTimeout(() => {
                  if (mounted) onEndCall();
                }, 1500);
                return 'missed';
              }
              return curr;
            });
          }
        }, 45000);
      } catch (err) {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : String(err);
        setErrorText(
          msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('notallowed')
            ? language === 'bn'
              ? 'কল করতে মাইক্রোফোন/ক্যামেরার অনুমতি প্রয়োজন।'
              : 'Microphone or camera permission was denied.'
            : msg
        );
        setCallState('error');
        cleanupMediaAndPeer();
      }
    };

    const watchIncomingSignal = () => {
      if (!session.callId) return;
      unsubSignalRef.current = subscribeToCallSignal(session.chatId, session.callId, (data) => {
        if (!mounted || !data) return;
        if (data.status === 'ended' || data.status === 'missed' || data.status === 'declined') {
          setCallState(data.status);
          cleanupMediaAndPeer();
          setTimeout(() => {
            recordCallLogOnce(data.status as 'ended' | 'missed' | 'declined');
            if (mounted) onEndCall();
          }, 900);
        }
      });
    };

    if (session.role === 'caller') {
      startOutgoingCall();
    } else {
      watchIncomingSignal();
    }

    return () => {
      mounted = false;
      if (ringTimeout) clearTimeout(ringTimeout);
      if (!endedRef.current) {
        const cid = callIdRef.current;
        if (cid && session.chatId && session.role === 'caller') {
          recordCallLogOnce('ended');
          updateCallSignalStatus(session.chatId, cid, 'ended');
        }
        cleanupMediaAndPeer();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAcceptIncoming = async () => {
    if (!session.callId || !session.signalData?.offer) return;
    cancelAppNotification(session.callId);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Media devices unavailable.');
      }
      setCallState('connecting');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: session.type === 'video',
      });

      localStreamRef.current = stream;
      if (localVideoRef.current && session.type === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection(RTC_ICE_CONFIG);
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      attachRemoteMedia(pc);

      pc.onicecandidate = (e) => {
        if (e.candidate && session.callId) {
          addIceCandidateSignal(session.chatId, session.callId, 'answerCandidates', e.candidate).catch(() => {});
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(session.signalData.offer as RTCSessionDescriptionInit));

      unsubIceRef.current = subscribeToIceCandidates(
        session.chatId,
        session.callId,
        'offerCandidates',
        (cand) => {
          if (pcRef.current) addRemoteIceCandidate(pcRef.current, cand);
        }
      );

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await answerCallSignal(session.chatId, session.callId, answer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorText(
        msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('notallowed')
          ? language === 'bn'
            ? 'কল রিসিভ করতে মাইক্রোফোন/ক্যামেরার অনুমতি দিন।'
            : 'Microphone or camera permission is required to accept the call.'
          : msg
      );
      setCallState('error');
      await finishCall('declined', false);
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
  };

  const toggleVideo = () => {
    const nextOff = !isVideoOff;
    setIsVideoOff(nextOff);
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !nextOff;
    });
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusLabel = () => {
    if (callState === 'calling') return language === 'bn' ? 'কল করা হচ্ছে...' : 'Calling...';
    if (callState === 'ringing') {
      return session.role === 'callee'
        ? language === 'bn' ? 'ইনকামিং কল...' : 'Incoming call...'
        : t('callRinging');
    }
    if (callState === 'connecting') return language === 'bn' ? 'সংযুক্ত হচ্ছে...' : 'Connecting...';
    if (callState === 'connected') return formatSeconds(duration);
    if (callState === 'declined') return language === 'bn' ? 'কল প্রত্যাখ্যান করা হয়েছে' : 'Call declined';
    if (callState === 'missed') return language === 'bn' ? 'কোনো উত্তর পাওয়া যায়নি' : 'No answer';
    if (callState === 'ended') return language === 'bn' ? 'কল শেষ হয়েছে' : 'Call ended';
    if (callState === 'error') return language === 'bn' ? 'কল ব্যর্থ হয়েছে' : 'Call error';
    return '';
  };

  const isIncomingRinging = session.role === 'callee' && callState === 'ringing';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4">
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl overflow-hidden shadow-2xl flex flex-col items-center justify-between p-8 min-h-[500px]">
        {/* Top Info */}
        <div className="flex flex-col items-center text-center">
          <div className="text-xs uppercase tracking-wider font-semibold text-emerald-400 mb-2 flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 animate-pulse" />
            <span>{session.type === 'video' ? t('videoCall') : t('audioCall')}</span>
          </div>

          <h3 className="text-2xl font-bold text-white mb-1">{session.recipientName}</h3>
          <p className="text-xs text-slate-400">{getStatusLabel()}</p>
        </div>

        {/* Center Video / Avatar Stage */}
        <div className="relative my-6 flex flex-col items-center justify-center w-full">
          {errorText && (
            <div className="mb-4 px-4 py-2.5 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2 max-w-sm text-center">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorText}</span>
            </div>
          )}

          {session.type === 'video' ? (
            <div className="w-full max-w-sm h-64 rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden relative shadow-md flex items-center justify-center">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-cover ${hasRemoteVideo ? 'block' : 'hidden'}`}
              />
              {!hasRemoteVideo && (
                <div className="text-center p-4">
                  <img
                    src={session.recipientPhoto || `https://api.dicebear.com/7.x/bottts/svg?seed=${session.partnerId}`}
                    alt={session.recipientName}
                    className="w-20 h-20 rounded-full mx-auto mb-2 border border-slate-600 object-cover"
                  />
                  <span className="text-xs text-slate-300">{getStatusLabel()}</span>
                </div>
              )}

              {/* Local Picture-in-Picture preview */}
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={`absolute bottom-2.5 right-2.5 w-24 h-32 rounded-xl object-cover border border-slate-600 bg-slate-900 shadow-lg ${
                  isVideoOff || isIncomingRinging ? 'hidden' : 'block'
                }`}
              />
            </div>
          ) : (
            <div className="relative">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-emerald-500/50 shadow-2xl relative">
                <img
                  src={session.recipientPhoto || `https://api.dicebear.com/7.x/bottts/svg?seed=${session.partnerId}`}
                  alt={session.recipientName}
                  className="w-full h-full object-cover"
                />
              </div>
              {(callState === 'calling' || callState === 'ringing') && (
                <span className="absolute -inset-2 rounded-full border border-emerald-400/40 animate-ping pointer-events-none" />
              )}
            </div>
          )}
        </div>

        {/* Bottom Call Controls */}
        <div className="flex items-center gap-4">
          {isIncomingRinging ? (
            <>
              <button
                type="button"
                onClick={() => finishCall('declined', true)}
                className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/30 transition cursor-pointer"
                title={language === 'bn' ? 'প্রত্যাখ্যান করুন' : 'Decline'}
              >
                <PhoneOff className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={handleAcceptIncoming}
                className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 transition cursor-pointer animate-pulse"
                title={language === 'bn' ? 'কল রিসিভ করুন' : 'Accept Call'}
              >
                <Phone className="w-6 h-6" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={toggleMute}
                disabled={callState === 'error' || callState === 'declined' || callState === 'missed'}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition cursor-pointer disabled:opacity-40 ${
                  isMuted ? 'bg-red-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
                title={isMuted ? t('unmute') : t('mute')}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              {session.type === 'video' && (
                <button
                  type="button"
                  onClick={toggleVideo}
                  disabled={callState === 'error' || callState === 'declined' || callState === 'missed'}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition cursor-pointer disabled:opacity-40 ${
                    isVideoOff ? 'bg-red-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                  title={isVideoOff ? t('turnCameraOn') : t('turnCameraOff')}
                >
                  {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                </button>
              )}

              <button
                type="button"
                onClick={() => finishCall('ended', true)}
                className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/30 transition cursor-pointer"
                title={t('endCall')}
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
