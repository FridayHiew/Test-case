import React, { useState, useEffect } from 'react';
import { Download, Sparkles, X } from 'lucide-react';

export default function PwaPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Also check if app is already running in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowBanner(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    // Show the prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    // We've used the prompt, and can't use it again
    setDeferredPrompt(null);
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl shadow-md p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0 transition-all duration-300">
      <div className="flex items-center space-x-3.5">
        <div className="p-2.5 bg-white/10 rounded-lg shrink-0">
          <Sparkles className="w-5 h-5 text-blue-200" />
        </div>
        <div className="space-y-0.5 min-w-0">
          <h4 className="text-sm font-semibold truncate">Install AI Test Case Generator to your device</h4>
          <p className="text-xs text-blue-100">Run as a standalone desktop app with full offline capabilities.</p>
        </div>
      </div>
      <div className="flex items-center space-x-3 shrink-0 self-end sm:self-center">
        <button
          type="button"
          onClick={() => setShowBanner(false)}
          className="text-xs text-blue-100 hover:text-white px-2.5 py-1.5 rounded transition"
        >
          Not Now
        </button>
        <button
          type="button"
          onClick={handleInstallClick}
          className="flex items-center space-x-1.5 py-1.5 px-4 bg-white text-blue-700 hover:bg-blue-50 active:bg-blue-100 font-bold text-xs rounded-lg shadow-sm transition"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install Offline App</span>
        </button>
      </div>
    </div>
  );
}
