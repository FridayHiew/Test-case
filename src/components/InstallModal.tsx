import React from 'react';
import { Download, X, Laptop, Smartphone, CheckCircle, ExternalLink, HelpCircle } from 'lucide-react';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInstallable: boolean;
  onInstall: () => Promise<boolean>;
  isIOS: boolean;
}

export const InstallModal: React.FC<InstallModalProps> = ({
  isOpen,
  onClose,
  isInstallable,
  onInstall,
  isIOS
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/15 rounded-xl">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base">Install App into Device</h3>
              <p className="text-xs text-blue-100">AI Test Case Generator v1.01</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 text-slate-700 text-sm">
          {isInstallable ? (
            <div className="space-y-4 text-center py-2">
              <p className="text-slate-600">
                Install <strong>AI Test Case Generator</strong> to your desktop or mobile home screen for quick launch and offline capabilities.
              </p>
              <button
                type="button"
                onClick={async () => {
                  const success = await onInstall();
                  if (success) onClose();
                }}
                className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl shadow-md transition"
              >
                <Download className="w-4 h-4" />
                <span>Click to Install Now</span>
              </button>
            </div>
          ) : isIOS ? (
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-indigo-700 font-semibold text-xs uppercase tracking-wider">
                <Smartphone className="w-4 h-4" />
                <span>iOS Safari Installation</span>
              </div>
              <ol className="space-y-2.5 text-xs text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100 list-decimal list-inside leading-relaxed">
                <li>Tap the <strong>Share</strong> icon in the Safari navigation bar at the bottom.</li>
                <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                <li>Tap <strong>Add</strong> at the top right to complete installation.</li>
              </ol>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-blue-700 font-semibold text-xs uppercase tracking-wider">
                <Laptop className="w-4 h-4" />
                <span>Browser Installation Guide</span>
              </div>
              <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100 leading-relaxed">
                <p>
                  <strong>Chrome &amp; Edge on Laptop / Desktop:</strong>
                </p>
                <p>
                  Look at the right side of your browser address bar (URL bar). Click the <strong>Install app</strong> icon (a small computer monitor or down arrow icon), then click <strong>Install</strong>.
                </p>
                <div className="border-t border-slate-200/80 pt-2 mt-2">
                  <p>
                    Or click the browser menu (<strong>⋮</strong> three dots) ➔ <strong>Save and share</strong> / <strong>Apps</strong> ➔ <strong>Install AI Test Case Generator</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center space-x-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>Runs offline &amp; standalone</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-600 hover:text-slate-900 font-medium px-3 py-1 rounded-lg hover:bg-slate-100 transition"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
