import { useEffect, useRef, useState } from 'react';
import { sendMessage } from '../services/chatService';
import type { UserProfile } from '../types/chat';
import { sounds } from '../utils/audioEffects';

interface UseVoiceRecorderParams {
  chatId: string;
  user: UserProfile | null;
  disabled: boolean;
  language: string;
  t: (key: any, params?: Record<string, any>) => string;
}

export function useVoiceRecorder({
  chatId,
  user,
  disabled,
  language,
  t,
}: UseVoiceRecorderParams) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<Record<string, number>>({});
  const [micError, setMicError] = useState<string | null>(null);
  const [showMicPermissionModal, setShowMicPermissionModal] = useState(false);
  const [isSendingVoice, setIsSendingVoice] = useState(false);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeAudioRef = useRef<{ id: string; audio: HTMLAudioElement } | null>(null);

  const getSupportedMimeType = (): string => {
    if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return '';
    const candidateTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ];
    for (const candidate of candidateTypes) {
      try {
        if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(candidate)) {
          return candidate;
        }
      } catch {
        // Continue checking next candidate
      }
    }
    return '';
  };

  const stopRecording = (cancel = false) => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setIsRecording(false);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      return;
    }

    if (cancel) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {}
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      audioChunksRef.current = [];
      setIsRecording(false);
      setRecordDuration(0);
    } else {
      setIsRecording(false);
      try {
        recorder.stop();
      } catch (err) {
        console.warn('Notice stopping recorder:', err);
      }
    }
  };

  const startRecording = async () => {
    if (disabled) return;
    setMicError(null);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setMicError(t('micNotSupported'));
        setShowMicPermissionModal(true);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const preferredMime = getSupportedMimeType();
      let recorder: MediaRecorder;
      try {
        if (preferredMime) {
          recorder = new MediaRecorder(stream, {
            mimeType: preferredMime,
            audioBitsPerSecond: 24000,
          });
        } else {
          recorder = new MediaRecorder(stream);
        }
      } catch {
        recorder = new MediaRecorder(stream);
      }

      const chosenMime = recorder.mimeType || preferredMime || 'audio/webm';

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => {
            try {
              track.stop();
            } catch {}
          });
          mediaStreamRef.current = null;
        }

        const chunks = [...audioChunksRef.current];
        audioChunksRef.current = [];
        const elapsedSeconds = Math.max(
          1,
          Math.round((Date.now() - recordingStartTimeRef.current) / 1000)
        );

        if (chunks.length === 0) {
          setIsSendingVoice(false);
          setIsRecording(false);
          return;
        }

        const audioBlob = new Blob(chunks, { type: chosenMime });
        if (audioBlob.size === 0) {
          setIsSendingVoice(false);
          setIsRecording(false);
          return;
        }

        setIsSendingVoice(true);
        const reader = new FileReader();
        reader.onload = async () => {
          const base64Audio = reader.result as string;
          if (user && base64Audio) {
            if (base64Audio.length > 850000) {
              setMicError(
                language === 'bn'
                  ? 'অডিও ফাইলের আকার অনেক বড় হয়ে গেছে। অনুগ্রহ করে ছোট ভয়েস নোট রেকর্ড করুন।'
                  : 'Audio file size is too large. Please record a shorter voice note.'
              );
              setIsSendingVoice(false);
              return;
            }

            try {
              sounds.playMessageSent();
              await sendMessage({
                chatId,
                sender: user,
                text: t('voiceNoteLabel'),
                type: 'audio',
                mediaUrl: base64Audio,
                audioDuration: elapsedSeconds,
              });
            } catch (err) {
              console.warn('Voice message delivery notice:', err);
            } finally {
              setIsSendingVoice(false);
            }
          } else {
            setIsSendingVoice(false);
          }
        };
        reader.onerror = () => {
          setIsSendingVoice(false);
        };
        reader.readAsDataURL(audioBlob);
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
      recordingStartTimeRef.current = Date.now();
      setRecordDuration(0);
      setIsRecording(true);

      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = setInterval(() => {
        const secs = Math.round((Date.now() - recordingStartTimeRef.current) / 1000);
        setRecordDuration(secs);
        if (secs >= 90) {
          stopRecording(false);
        }
      }, 500);
    } catch (err: any) {
      console.warn('Microphone permission or device access notice:', err?.name || err?.message || err);
      const isDenied =
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        err?.name === 'SecurityError' ||
        String(err?.message || '').toLowerCase().includes('permission') ||
        String(err?.message || '').toLowerCase().includes('denied');

      if (isDenied) {
        setShowMicPermissionModal(true);
        setMicError(t('micPermissionError'));
      } else if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setMicError(t('micNotSupported'));
      } else {
        setMicError(t('micPermissionError'));
      }
      setIsRecording(false);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    }
  };

  const playVoiceNote = (messageId: string, url?: string) => {
    if (playingAudioId === messageId && activeAudioRef.current) {
      activeAudioRef.current.audio.pause();
      setPlayingAudioId(null);
      return;
    }

    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.audio.pause();
        activeAudioRef.current.audio.currentTime = 0;
      } catch {}
      activeAudioRef.current = null;
    }

    if (!url) {
      sounds.playBeep();
      setPlayingAudioId(messageId);
      setTimeout(() => {
        setPlayingAudioId((curr) => (curr === messageId ? null : curr));
      }, 2000);
      return;
    }

    try {
      const audio = new Audio(url);
      audio.preload = 'auto';

      audio.ontimeupdate = () => {
        if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
          const progress = Math.min(100, Math.max(0, (audio.currentTime / audio.duration) * 100));
          setAudioProgress((prev) => ({ ...prev, [messageId]: progress }));
        }
      };

      audio.onended = () => {
        setPlayingAudioId((curr) => (curr === messageId ? null : curr));
        setAudioProgress((prev) => ({ ...prev, [messageId]: 0 }));
        activeAudioRef.current = null;
      };

      audio.onerror = (e) => {
        console.warn('Voice note playback error:', e);
        setPlayingAudioId(null);
        setAudioProgress((prev) => ({ ...prev, [messageId]: 0 }));
        activeAudioRef.current = null;
        sounds.playBeep();
      };

      activeAudioRef.current = { id: messageId, audio };
      setPlayingAudioId(messageId);

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Playback play() promise error:', err);
          setPlayingAudioId(null);
          activeAudioRef.current = null;
        });
      }
    } catch (err) {
      console.error('Voice note audio error:', err);
      setPlayingAudioId(null);
    }
  };

  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (activeAudioRef.current) {
        try {
          activeAudioRef.current.audio.pause();
          activeAudioRef.current.audio.src = '';
        } catch {}
        activeAudioRef.current = null;
      }
    };
  }, [chatId]);

  const formatAudioTime = (seconds = 0) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return {
    isRecording,
    recordDuration,
    playingAudioId,
    audioProgress,
    micError,
    setMicError,
    showMicPermissionModal,
    setShowMicPermissionModal,
    isSendingVoice,
    startRecording,
    stopRecording,
    playVoiceNote,
    formatAudioTime,
  };
}
