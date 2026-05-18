'use client';
import { useEffect, useState } from 'react';

/**
 * Shows a native-style "Add to Home Screen" banner when the browser fires
 * the beforeinstallprompt event (Chrome/Android). Hidden on iOS — Safari
 * handles the install prompt natively via the share sheet.
 */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Only show if user hasn't dismissed it before
      const dismissed = localStorage.getItem('wuat_install_dismissed');
      if (!dismissed) setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShow(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('wuat_install_dismissed', '1');
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 bg-white rounded-2xl shadow-xl border border-pink-100 p-4 flex items-center gap-3 animate-bounce-in">
      <img src="/icons/icon-72x72.png" alt="Walk Up & Talk" className="w-12 h-12 rounded-xl flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-800 text-sm">Add to Home Screen</p>
        <p className="text-xs text-gray-500 truncate">Get the full Walk Up & Talk app experience</p>
      </div>
      <div className="flex flex-col gap-1 flex-shrink-0">
        <button
          onClick={handleInstall}
          className="bg-pink-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-pink-600 transition"
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          className="text-gray-400 text-xs text-center hover:text-gray-600 transition"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
