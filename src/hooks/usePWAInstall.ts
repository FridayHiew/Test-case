import { useState, useEffect, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Module-level cache for beforeinstallprompt event so it's not missed if fired early
let cachedPromptEvent: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<(event: BeforeInstallPromptEvent | null) => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    cachedPromptEvent = e as BeforeInstallPromptEvent;
    promptListeners.forEach((listener) => listener(cachedPromptEvent));
  });

  window.addEventListener('appinstalled', () => {
    cachedPromptEvent = null;
    promptListeners.forEach((listener) => listener(null));
  });
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(cachedPromptEvent);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    return isStandalone;
  });

  const [isIOS, setIsIOS] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(ua);
  });

  useEffect(() => {
    // Check display-mode media query changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const checkStandalone = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        setIsInstalled(true);
      }
    };
    
    if (mediaQuery.matches) {
      setIsInstalled(true);
    }

    try {
      mediaQuery.addEventListener('change', checkStandalone);
    } catch {
      mediaQuery.addListener(checkStandalone);
    }

    const listener = (prompt: BeforeInstallPromptEvent | null) => {
      setDeferredPrompt(prompt);
      if (!prompt) {
        // May have been installed
        const standalone =
          window.matchMedia('(display-mode: standalone)').matches ||
          (window.navigator as unknown as { standalone?: boolean }).standalone === true;
        setIsInstalled(standalone);
      }
    };

    promptListeners.add(listener);

    return () => {
      promptListeners.delete(listener);
      try {
        mediaQuery.removeEventListener('change', checkStandalone);
      } catch {
        mediaQuery.removeListener(checkStandalone);
      }
    };
  }, []);

  const install = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        cachedPromptEvent = null;
        setDeferredPrompt(null);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error triggering PWA install prompt:', err);
      return false;
    }
  }, [deferredPrompt]);

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
    deferredPrompt,
  };
}
