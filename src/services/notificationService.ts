interface AndroidNotificationBridge {
  hasPermission?: () => boolean;
  requestPermission?: () => void;
  showNotification?: (id: string, title: string, body: string, type: string, chatId: string) => void;
  cancelNotification?: (id: string) => void;
}

function getAndroidBridge(): AndroidNotificationBridge | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as { AndroidNotifications?: AndroidNotificationBridge };
  return win.AndroidNotifications || null;
}

const activeBrowserNotifications = new Map<string, Notification>();

export type AppNotificationPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export function isAppNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(getAndroidBridge()?.showNotification) || 'Notification' in window;
}

export function getAppNotificationPermission(): AppNotificationPermission {
  const androidBridge = getAndroidBridge();
  if (androidBridge?.hasPermission) {
    try {
      return androidBridge.hasPermission() ? 'granted' : 'default';
    } catch {
      return 'default';
    }
  }
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestAppNotificationPermission(): Promise<AppNotificationPermission> {
  const androidBridge = getAndroidBridge();
  if (androidBridge?.requestPermission) {
    try {
      androidBridge.requestPermission();
      return androidBridge.hasPermission?.() ? 'granted' : 'default';
    } catch {
      return 'default';
    }
  }
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const result = await Notification.requestPermission();
    window.dispatchEvent(new CustomEvent('anomah_notification_permission_changed'));
    return result;
  } catch {
    return Notification.permission;
  }
}

export function isAppInBackground(): boolean {
  if (typeof document === 'undefined') return false;
  return document.visibilityState === 'hidden' || !document.hasFocus();
}

export async function showChatOrCallNotification(params: {
  id: string;
  title: string;
  body: string;
  type: 'message' | 'call';
  chatId?: string;
  icon?: string;
  onClick?: () => void;
}): Promise<void> {
  const androidBridge = getAndroidBridge();
  if (androidBridge?.showNotification) {
    try {
      androidBridge.showNotification(
        params.id,
        params.title,
        params.body,
        params.type,
        params.chatId || ''
      );
      return;
    } catch (err) {
      console.warn('Native Android notification warning:', err);
    }
  }

  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const iconUrl = params.icon || './pwa-192x192.png';
  const tag = params.id || params.chatId || 'anomah-notif';

  // Prefer direct Notification API first so onclick deep-linking works on Desktop browsers
  try {
    const existing = activeBrowserNotifications.get(tag);
    if (existing) {
      existing.close();
      activeBrowserNotifications.delete(tag);
    }

    const notif = new Notification(params.title, {
      body: params.body,
      icon: iconUrl,
      tag,
      requireInteraction: params.type === 'call',
    });
    activeBrowserNotifications.set(tag, notif);
    notif.onclose = () => {
      if (activeBrowserNotifications.get(tag) === notif) {
        activeBrowserNotifications.delete(tag);
      }
    };
    notif.onclick = () => {
      try {
        window.focus();
      } catch {
        // ignore focus restriction
      }
      notif.close();
      params.onClick?.();
    };
    return;
  } catch {
    // On Android Chrome / mobile PWAs, new Notification() throws TypeError -> fall through to ServiceWorker showNotification
  }

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && typeof registration.showNotification === 'function') {
        await registration.showNotification(params.title, {
          body: params.body,
          icon: iconUrl,
          badge: './pwa-192x192.png',
          tag,
          requireInteraction: params.type === 'call',
          data: { chatId: params.chatId || '' },
        });
      }
    }
  } catch (err) {
    console.warn('ServiceWorker notification warning:', err);
  }
}

export function cancelAppNotification(notifId?: string): void {
  if (!notifId) return;

  const androidBridge = getAndroidBridge();
  if (androidBridge?.cancelNotification) {
    try {
      androidBridge.cancelNotification(notifId);
    } catch {
      // ignore
    }
  }

  const browserNotif = activeBrowserNotifications.get(notifId);
  if (browserNotif) {
    try {
      browserNotif.close();
    } catch {
      // ignore
    }
    activeBrowserNotifications.delete(notifId);
  }

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.getNotifications({ tag: notifId }))
      .then((list) => {
        list?.forEach((n) => n.close());
      })
      .catch(() => {});
  }
}
