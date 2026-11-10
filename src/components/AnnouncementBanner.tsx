import { useState, useEffect } from 'react';
import { subscribeToAnnouncements } from '../services/adminService';
import type { SystemAnnouncement } from '../types/chat';
import { Info, AlertTriangle, AlertOctagon, Bell, X } from 'lucide-react';

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
          icon: <AlertOctagon className="w-3.5 h-3.5 text-rose-400 shrink-0" />,
          labelColor: 'text-rose-400',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
          labelColor: 'text-amber-400',
        };
      case 'update':
        return {
          icon: <Bell className="w-3.5 h-3.5 text-sky-400 shrink-0" />,
          labelColor: 'text-sky-400',
        };
      case 'info':
      default:
        return {
          icon: <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
          labelColor: 'text-emerald-400',
        };
    }
  };

  const styles = getTypeStyles(activeAnnouncement.type);

  return (
    <div
      className="w-full px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs flex items-center justify-between gap-3 shadow-xs z-30 transition animate-in slide-in-from-top-1"
    >
      <div className="flex items-center gap-2.5 overflow-hidden">
        {styles.icon}
        <div className="flex items-center gap-2 truncate">
          <span className={`text-[11px] uppercase font-bold tracking-wider shrink-0 ${styles.labelColor}`}>
            {activeAnnouncement.type}
          </span>
          <span className="text-slate-600 shrink-0">·</span>
          <span className="font-semibold text-slate-100 truncate">{activeAnnouncement.title}:</span>
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
