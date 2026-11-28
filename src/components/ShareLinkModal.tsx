import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useModalHistory } from '../hooks/useModalHistory';
import { buildGroupInviteLink, buildPersonalChatLink } from '../utils/accountShortcut';
import type { ChatRoom } from '../types/chat';
import {
  Copy,
  Check,
  Globe,
  Users,
  X,
  QrCode,
  Share2,
  Download,
  AtSign,
  ScanLine,
  Lock,
} from 'lucide-react';

export function ShareLinkModal({
  onClose,
  onOpenProfileSettings,
  onOpenQrScanner,
  groupChat,
}: {
  onClose: () => void;
  onOpenProfileSettings?: () => void;
  onOpenQrScanner?: () => void;
  groupChat?: ChatRoom | null;
}) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [tab, setTab] = useState<'group' | 'personal' | 'app'>(
    groupChat ? 'group' : user ? 'personal' : 'app'
  );
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useModalHistory(true, onClose);

  useEffect(() => {
    if (groupChat) {
      setTab('group');
    }
  }, [groupChat]);

  const appUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
  const personalLink = user ? buildPersonalChatLink(user) : appUrl;
  const groupLink = groupChat ? buildGroupInviteLink(groupChat.id) : appUrl;
  const activeUrl =
    tab === 'group' && groupChat
      ? groupLink
      : tab === 'personal'
      ? personalLink
      : appUrl;

  useEffect(() => {
    if (!activeUrl) return;
    let cancelled = false;
    QRCode.toDataURL(activeUrl, {
      width: 240,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeUrl]);

  const copyToClipboard = () => {
    navigator.clipboard?.writeText(activeUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title:
            tab === 'group' && groupChat
              ? `${groupChat.name || 'Group'} · Anomah Messenger`
              : user?.displayName
              ? `${user.displayName} · Anomah Messenger`
              : t('appName'),
          text:
            tab === 'group' && groupChat
              ? language === 'bn'
                ? `এই লিংক বা QR স্ক্যান করে "${groupChat.name || 'Group'}" গ্রুপে যোগ দিন:`
                : `Tap this link or scan the QR to join "${groupChat.name || 'Group'}":`
              : tab === 'personal'
              ? language === 'bn'
                ? 'এই লিংকে ক্লিক করে বা QR স্ক্যান করে আনমাহ্ মেসেঞ্জারে আমার সাথে যুক্ত হন:'
                : 'Tap this link or scan my QR to connect with me on Anomah Messenger:'
              : t('shareSubtitle'),
          url: activeUrl,
        });
      } catch {
        // user cancelled share sheet
      }
    } else {
      copyToClipboard();
    }
  };

  const isGroupMode = tab === 'group' && Boolean(groupChat);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4 pr-8">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            {tab === 'app' ? <Globe className="w-5 h-5" /> : <QrCode className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              {isGroupMode
                ? language === 'bn'
                  ? 'গ্রুপ ইনভাইট লিংক ও QR'
                  : 'Group Invite Link & QR'
                : tab === 'personal'
                ? language === 'bn'
                  ? 'আমার প্রোফাইল লিংক ও QR কোড'
                  : 'My Chat Link & QR Code'
                : t('shareTitle')}
            </h3>
            <p className="text-xs text-slate-400">
              {isGroupMode
                ? language === 'bn'
                  ? 'পাবলিক গ্রুপে স্ক্যান বা লিংকে ক্লিক করলেই জয়েন করা যাবে'
                  : 'Share this QR or link for members to find & join this group'
                : tab === 'personal'
                ? language === 'bn'
                  ? 'স্ক্যান করলে অটো ফ্রেন্ড রিকোয়েস্ট চলে আসবে — একসেপ্ট করলেই চ্যাট শুরু'
                  : 'Scanning auto-sends a friend request for you to accept'
                : t('shareSubtitle')}
            </p>
          </div>
        </div>

        {/* Mode Switcher */}
        {!groupChat && user && (
          <div className="grid grid-cols-2 p-1 bg-slate-950 border border-slate-800 rounded-xl mb-4 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setTab('personal');
                setCopied(false);
              }}
              className={`py-1.5 px-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                tab === 'personal' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? 'আমার QR ও লিংক' : 'My Chat QR'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('app');
                setCopied(false);
              }}
              className={`py-1.5 px-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                tab === 'app' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? 'অ্যাপ ইনভাইট' : 'Invite to App'}</span>
            </button>
          </div>
        )}

        {isGroupMode && groupChat ? (
          <div className="space-y-3.5">
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col items-center text-center">
              {qrDataUrl && (
                <div className="p-2.5 bg-white rounded-2xl shadow-lg mb-3">
                  <img
                    src={qrDataUrl}
                    alt="Group Invite QR Code"
                    className="w-40 h-40 object-contain"
                  />
                </div>
              )}
              <div className="text-sm font-bold text-white">{groupChat.name || 'Group'}</div>
              <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                {groupChat.visibility === 'public' ? (
                  <>
                    <Globe className="w-3 h-3 text-emerald-400" />
                    <span>
                      {groupChat.joinPolicy === 'approval'
                        ? language === 'bn'
                          ? 'পাবলিক · অ্যাডমিন অনুমোদন'
                          : 'Public · Admin Approval'
                        : language === 'bn'
                        ? 'পাবলিক · সরাসরি যোগদান'
                        : 'Public · Direct Join'}
                    </span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3 h-3 text-amber-400" />
                    <span>{language === 'bn' ? 'প্রাইভেট গ্রুপ' : 'Private Group'}</span>
                  </>
                )}
              </div>
              {groupChat.visibility !== 'public' && (
                <p className="text-[11px] text-amber-300/90 mt-2 leading-relaxed">
                  {language === 'bn'
                    ? 'নোট: এটি প্রাইভেট গ্রুপ। শুধু অ্যাডমিন নিজের ফ্রেন্ড লিস্ট থেকে সদস্য যুক্ত করতে পারবেন; লিংক দিয়ে বাইরের কেউ সরাসরি জয়েন করতে পারবে না।'
                    : 'Note: This group is Private. Non-members cannot join via link; only admins can add accepted friends.'}
                </p>
              )}
            </div>

            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-2.5 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={groupLink}
                className="flex-1 bg-transparent text-[11px] text-slate-200 outline-none select-all font-mono"
              />
              <button
                type="button"
                onClick={copyToClipboard}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? t('copied') : t('copy')}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleNativeShare}
                className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer border border-slate-700/80"
              >
                <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{language === 'bn' ? 'লিংক শেয়ার করুন' : 'Share Link'}</span>
              </button>
              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download={`anomah-group-${groupChat.id}-qr.png`}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition border border-slate-700/80"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{language === 'bn' ? 'QR সেভ করুন' : 'Save QR'}</span>
                </a>
              )}
            </div>
          </div>
        ) : tab === 'personal' && user ? (
          <div className="space-y-3.5">
            {/* QR Code Card */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col items-center text-center">
              {qrDataUrl && (
                <div className="p-2.5 bg-white rounded-2xl shadow-lg mb-3">
                  <img
                    src={qrDataUrl}
                    alt="Personal Chat QR Code"
                    className="w-40 h-40 object-contain"
                  />
                </div>
              )}
              <div className="text-sm font-bold text-white">{user.displayName}</div>
              {user.username ? (
                <div className="text-xs font-mono text-emerald-400 mt-0.5">@{user.username}</div>
              ) : (
                <div className="mt-1.5 flex flex-col items-center gap-1">
                  <span className="text-[11px] text-amber-300">
                    {language === 'bn'
                      ? 'সহজ @ইউজারনেম লিংকের জন্য প্রোফাইলে ইউজারনেম সেট করতে পারেন'
                      : 'Set a @username for a cleaner personal link'}
                  </span>
                  {onOpenProfileSettings && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenProfileSettings();
                      }}
                      className="text-[11px] text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <AtSign className="w-3 h-3" />
                      <span>{language === 'bn' ? 'ইউজারনেম সেট করুন' : 'Set @username'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Personal Link Copy Box */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-2.5 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={personalLink}
                className="flex-1 bg-transparent text-[11px] text-slate-200 outline-none select-all font-mono"
              />
              <button
                type="button"
                onClick={copyToClipboard}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? t('copied') : t('copy')}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleNativeShare}
                className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer border border-slate-700/80"
              >
                <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{language === 'bn' ? 'লিংক শেয়ার করুন' : 'Share Link'}</span>
              </button>
              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download={`anomah-${user.username || 'chat'}-qr.png`}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition border border-slate-700/80"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{language === 'bn' ? 'QR সেভ করুন' : 'Save QR'}</span>
                </a>
              )}
            </div>

            {onOpenQrScanner && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenQrScanner();
                }}
                className="w-full py-2.5 px-3 bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <ScanLine className="w-4 h-4" />
                <span>{language === 'bn' ? 'অন্যের QR স্ক্যান করুন' : 'Scan Someone’s QR Code'}</span>
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">{t('shareBody')}</p>

            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3 mb-4 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={appUrl}
                className="flex-1 bg-transparent text-xs text-slate-200 outline-none select-all font-mono"
              />
              <button
                onClick={copyToClipboard}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{t('copied')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{t('copy')}</span>
                  </>
                )}
              </button>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 space-y-1">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-400" /> {t('shareTipTitle')}
              </div>
              <p className="text-[11px] text-slate-400">{t('shareTipBody')}</p>
            </div>
          </>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium cursor-pointer"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
