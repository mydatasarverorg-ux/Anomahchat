import { useState, useEffect } from 'react';
import { subscribeToAnnouncements } from '../services/adminService';
import type { SystemAnnouncement } from '../types/chat';
import { Info, AlertTriangle, AlertOctagon, Sparkles, X } from 'lucide-react';

export function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      const stored = sessionStorage.getItem('dismissed_announcements');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const unsubscribe = subscribeToAnnouncements(true, (data) => {
      setAnnouncements(data);
    });
    return () => unsubscribe();
  }, []);

  const activeAnnouncement = announcements.find((a) => !dismissedIds.includes(a.id));

  if (!activeAnnouncement) return null;

  const handleDismiss = (id: string) => {
    const next = [...dismissedIds, id];
    setDismissedIds(next);
    try {
      sessionStorage.setItem('dismissed_announcements', JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const getTypeStyles = (type: SystemAnnouncement['type']) => {
    switch (type) {
      case 'alert':
        return {
          border: 'border-l-4 border-l-rose-500',
          icon: <AlertOctagon className="w-3.5 h-3.5 text-rose-400 shrink-0" />,
          badge: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
        };
      case 'warning':
        return {
          border: 'border-l-4 border-l-amber-500',
          icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
          badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
        };
      case 'update':
        return {
          border: 'border-l-4 border-l-purple-500',
          icon: <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />,
          badge: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
        };
      case 'info':
      default:
        return {
          border: 'border-l-4 border-l-emerald-500',
          icon: <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
          badge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
        };
    }
  };

  const styles = getTypeStyles(activeAnnouncement.type);

  return (
    <div
      className={`w-full px-4 py-2 bg-slate-900/95 border-b border-slate-800 text-xs flex items-center justify-between gap-3 shadow-sm z-30 transition animate-in slide-in-from-top-1 ${styles.border}`}
    >
      <div className="flex items-center gap-2.5 overflow-hidden">
        {styles.icon}
        <div className="flex items-center gap-2 truncate">
          <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-wider shrink-0 ${styles.badge}`}>
            {activeAnnouncement.type}
          </span>
          <span className="font-semibold text-white truncate">{activeAnnouncement.title}:</span>
          <span className="truncate text-slate-300 text-[11px]">{activeAnnouncement.content}</span>
        </div>
      </div>

      <button
        onClick={() => handleDismiss(activeAnnouncement.id)}
        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
        title="Dismiss notice"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
