import { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { useLanguage } from '../context/LanguageContext';
import { useModalHistory } from '../hooks/useModalHistory';
import {
  extractDeepLinkTarget,
  extractDeviceApprovalQrPayload,
  type DeepLinkTarget,
  type DeviceApprovalQrPayload,
} from '../utils/accountShortcut';
import {
  X,
  QrCode,
  Camera,
  ImagePlus,
  RefreshCw,
  AlertTriangle,
  Link2,
  ArrowRight,
} from 'lucide-react';

interface QrScannerModalProps {
  onClose: () => void;
  onDetected?: (target: DeepLinkTarget) => void;
  onDeviceApproveQr?: (payload: DeviceApprovalQrPayload) => void;
  mode?: 'default' | 'device_approve';
}

export function QrScannerModal({
  onClose,
  onDetected,
  onDeviceApproveQr,
  mode = 'default',
}: QrScannerModalProps) {
  const { language } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectedRef = useRef(false);

  const [cameraStatus, setCameraStatus] = useState<'starting' | 'active' | 'denied' | 'unavailable'>('starting');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [manualLink, setManualLink] = useState('');

  useModalHistory(true, onClose);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
  }, []);

  const handleDecodedString = useCallback(
    (rawText: string) => {
      if (detectedRef.current) return;
      const approvalPayload = extractDeviceApprovalQrPayload(rawText);
      if (approvalPayload) {
        if (onDeviceApproveQr) {
          detectedRef.current = true;
          stopCamera();
          onDeviceApproveQr(approvalPayload);
          return;
        }
        setErrorText(
          language === 'bn'
            ? 'এই QR কোডটি ডিভাইস অনুমোদনের জন্য—আগে আপনার সক্রিয় ডিভাইস থেকে অনুমোদন মেনু ব্যবহার করুন।'
            : 'This is a Device Approval QR code.'
        );
        return;
      }

      if (mode === 'device_approve') {
        setErrorText(
          language === 'bn'
            ? 'এটি সঠিক PC/নতুন ডিভাইস লগইন QR কোড নয়। পিসি স্ক্রিনের QR কোডটি স্ক্যান করুন।'
            : 'This QR code is not a valid Device Login Approval QR. Scan the QR shown on your PC or new device.'
        );
        return;
      }

      const parsed = extractDeepLinkTarget(rawText);
      if (!parsed) {
        setErrorText(
          language === 'bn'
            ? 'এই QR কোডটি Anomah Chat প্রোফাইল, গ্রুপ বা ডিভাইস অনুমোদন QR নয়।'
            : 'This QR code is not a valid Anomah Chat link or device QR.'
        );
        return;
      }
      detectedRef.current = true;
      stopCamera();
      onDetected?.({ ...parsed, isQr: true });
    },
    [language, mode, onDetected, onDeviceApproveQr, stopCamera]
  );

  const startCamera = useCallback(async () => {
    stopCamera();
    detectedRef.current = false;
    setErrorText(null);
    setCameraStatus('starting');

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('unavailable');
      setErrorText(
        language === 'bn'
          ? 'এই ব্রাউজার বা ডিভাইসে লাইভ ক্যামেরা পাওয়া যায়নি। নিচে থেকে QR ছবি আপলোড করুন।'
          : 'Live camera is unavailable in this browser. Upload a QR image below instead.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stopCamera();
        return;
      }
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      await video.play();
      setCameraStatus('active');

      const scanFrame = () => {
        if (detectedRef.current) return;
        const v = videoRef.current;
        const c = canvasRef.current;
        if (v && c && v.readyState === v.HAVE_ENOUGH_DATA && v.videoWidth > 0 && v.videoHeight > 0) {
          c.width = v.videoWidth;
          c.height = v.videoHeight;
          const ctx = c.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(v, 0, 0, c.width, c.height);
            const imgData = ctx.getImageData(0, 0, c.width, c.height);
            const code = jsQR(imgData.data, imgData.width, imgData.height, {
              inversionAttempts: 'attemptBoth',
            });
            if (code?.data) {
              handleDecodedString(code.data);
              if (detectedRef.current) return;
            }
          }
        }
        rafRef.current = requestAnimationFrame(scanFrame);
      };
      rafRef.current = requestAnimationFrame(scanFrame);
    } catch (err: unknown) {
      const errName = err instanceof DOMException ? err.name : '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setCameraStatus('denied');
        setErrorText(
          language === 'bn'
            ? 'ক্যামেরা পারমিশন দেওয়া হয়নি। সেটিংস থেকে Camera অনুমতি চালু করে আবার চেষ্টা করুন, অথবা গ্যালারি থেকে QR ছবি বেছে নিন।'
            : 'Camera permission was denied. Allow Camera access in your browser/app settings and retry, or upload a QR image.'
        );
      } else {
        setCameraStatus('unavailable');
        setErrorText(
          language === 'bn'
            ? 'ক্যামেরা চালু করা যায়নি। আপনি চাইলে গ্যালারি থেকে QR ছবি স্ক্যান করতে পারেন।'
            : 'Could not open camera. You can upload a QR image from your gallery instead.'
        );
      }
    }
  }, [handleDecodedString, language, stopCamera]);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorText(null);

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        const maxDim = 1024;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height, {
          inversionAttempts: 'attemptBoth',
        });
        if (code?.data) {
          handleDecodedString(code.data);
        } else {
          setErrorText(
            language === 'bn'
              ? 'এই ছবিতে কোনো স্পষ্ট QR কোড পাওয়া যায়নি। পরিষ্কার স্ক্রিনশট বা ছবি দিন।'
              : 'No readable QR code found in this image. Try a clearer photo.'
          );
        }
      };
      if (typeof reader.result === 'string') {
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualLink.trim()) return;
    handleDecodedString(manualLink.trim());
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-md p-5 shadow-2xl relative max-h-[92vh] overflow-y-auto space-y-4">
        <button
          type="button"
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 pr-8">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              {mode === 'device_approve'
                ? language === 'bn'
                  ? 'নতুন ডিভাইস / PC QR স্ক্যান করুন'
                  : 'Scan PC / New Device QR'
                : language === 'bn'
                ? 'QR কোড স্ক্যান করুন'
                : 'Scan QR Code'}
            </h3>
            <p className="text-xs text-slate-400">
              {mode === 'device_approve'
                ? language === 'bn'
                  ? 'অন্য ডিভাইসের Waiting স্ক্রিনের QR কোড স্ক্যান করলে ১ ক্লিকেই অনুমোদন হবে'
                  : 'Scan the QR code displayed on your new device or PC to approve login instantly'
                : language === 'bn'
                ? 'প্রোফাইল, গ্রুপ বা নতুন ডিভাইস অনুমোদন QR কোড স্ক্যান করুন'
                : 'Scan a friend, group, or device login approval QR code'}
            </p>
          </div>
        </div>

        {/* Camera Viewport */}
        <div className="relative w-full aspect-square max-h-[290px] bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden flex items-center justify-center">
          <video
            ref={videoRef}
            muted
            playsInline
            className={`w-full h-full object-cover ${cameraStatus === 'active' ? 'block' : 'hidden'}`}
          />
          <canvas ref={canvasRef} className="hidden" />

          {cameraStatus === 'active' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="w-48 h-48 rounded-2xl border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(2,6,23,0.45)] relative">
                <div className="absolute inset-x-3 top-1/2 h-0.5 bg-emerald-400/80 animate-pulse" />
              </div>
            </div>
          )}

          {cameraStatus === 'starting' && (
            <div className="flex flex-col items-center gap-2 text-slate-400 p-6 text-center">
              <Camera className="w-8 h-8 text-emerald-400 animate-pulse" />
              <span className="text-xs">
                {language === 'bn' ? 'ক্যামেরা চালু হচ্ছে...' : 'Opening camera...'}
              </span>
            </div>
          )}

          {(cameraStatus === 'denied' || cameraStatus === 'unavailable') && (
            <div className="flex flex-col items-center gap-3 p-5 text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-300 leading-relaxed max-w-xs">
                {errorText ||
                  (language === 'bn'
                    ? 'ক্যামেরা পারমিশন প্রয়োজন।'
                    : 'Camera permission is required.')}
              </p>
              <button
                type="button"
                onClick={startCamera}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'ক্যামেরা আবার চেষ্টা করুন' : 'Retry Camera'}</span>
              </button>
            </div>
          )}
        </div>

        {cameraStatus === 'active' && errorText && (
          <div className="p-2.5 bg-amber-950/60 border border-amber-500/40 rounded-xl text-xs text-amber-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{errorText}</span>
          </div>
        )}

        {/* Gallery Upload Fallback */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer border border-slate-700/80"
        >
          <ImagePlus className="w-4 h-4 text-emerald-400" />
          <span>
            {language === 'bn' ? 'গ্যালারি থেকে QR ছবি স্ক্যান করুন' : 'Scan QR Image from Gallery'}
          </span>
        </button>

        {/* Manual Link Paste */}
        <form onSubmit={handleManualSubmit} className="pt-2 border-t border-slate-800 space-y-1.5">
          <label className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {mode === 'device_approve'
                ? language === 'bn'
                  ? 'অথবা ডিভাইস অনুমোদন কোড (anomahchat://...) পেস্ট করুন'
                  : 'Or paste device approval code (anomahchat://...)'
                : language === 'bn'
                ? 'অথবা চ্যাট/গ্রুপ লিংক বা @ইউজারনেম পেস্ট করুন'
                : 'Or paste a user/group link or @username'}
            </span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualLink}
              onChange={(e) => setManualLink(e.target.value)}
              placeholder={
                mode === 'device_approve'
                  ? 'anomahchat://device-approve?...'
                  : language === 'bn'
                  ? 'লিংক বা @username লিখুন...'
                  : 'Paste link or @username...'
              }
              className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={!manualLink.trim()}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
