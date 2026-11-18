import { useEffect, useId, useRef } from 'react';

interface OverlayEntry {
  id: string;
  onClose: () => void;
}

const overlayStack: OverlayEntry[] = [];
let hasPushedOverlayState = false;
let pendingBackTimeout: ReturnType<typeof setTimeout> | null = null;
let ignoreNextPopCount = 0;

function ensureGlobalListenersAttached() {
  if (typeof window === 'undefined') return;
  const win = window as unknown as { __anomahOverlayListenersAttached?: boolean };
  if (win.__anomahOverlayListenersAttached) return;
  win.__anomahOverlayListenersAttached = true;

  window.addEventListener('popstate', () => {
    if (ignoreNextPopCount > 0) {
      ignoreNextPopCount -= 1;
      return;
    }
    const top = overlayStack[overlayStack.length - 1];
    if (!top) {
      hasPushedOverlayState = false;
      return;
    }
    // The browser already popped the overlay history entry; re-push immediately if more overlays remain underneath.
    overlayStack.pop();
    if (overlayStack.length > 0) {
      window.history.pushState({ __anomahOverlay: true }, '');
      hasPushedOverlayState = true;
    } else {
      hasPushedOverlayState = false;
    }
    top.onClose();
  });

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    const top = overlayStack[overlayStack.length - 1];
    if (top) {
      top.onClose();
    }
  });
}

function registerOverlay(id: string, onClose: () => void) {
  ensureGlobalListenersAttached();

  if (pendingBackTimeout) {
    clearTimeout(pendingBackTimeout);
    pendingBackTimeout = null;
  }

  const existingIdx = overlayStack.findIndex((item) => item.id === id);
  if (existingIdx !== -1) {
    overlayStack[existingIdx].onClose = onClose;
    return;
  }

  overlayStack.push({ id, onClose });
  if (!hasPushedOverlayState) {
    window.history.pushState({ __anomahOverlay: true }, '');
    hasPushedOverlayState = true;
  }
}

function unregisterOverlay(id: string) {
  const idx = overlayStack.findIndex((item) => item.id === id);
  if (idx !== -1) {
    overlayStack.splice(idx, 1);
  }

  if (overlayStack.length === 0 && hasPushedOverlayState) {
    if (pendingBackTimeout) clearTimeout(pendingBackTimeout);
    pendingBackTimeout = setTimeout(() => {
      pendingBackTimeout = null;
      if (overlayStack.length === 0 && hasPushedOverlayState) {
        hasPushedOverlayState = false;
        const state = window.history.state as { __anomahOverlay?: boolean } | null;
        if (state?.__anomahOverlay) {
          ignoreNextPopCount += 1;
          window.history.back();
        }
      }
    }, 20);
  }
}

/**
 * Coordinates mobile hardware Back / browser Back and Escape key across modals and overlays
 * without pushing duplicate history entries on re-renders or leaking history state on close.
 */
export function useModalHistory(enabled: boolean, onClose: () => void) {
  const rawId = useId();
  const entryId = `overlay_${rawId}`;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!enabled) {
      unregisterOverlay(entryId);
      return;
    }
    registerOverlay(entryId, () => onCloseRef.current());
    return () => {
      unregisterOverlay(entryId);
    };
  }, [enabled, entryId]);
}
