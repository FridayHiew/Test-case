import React, { ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetCacheAndReload = async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));
      }
    } catch (e) {
      console.warn('Cache clear error:', e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-2xl shadow-xl border border-slate-200/80 p-6 space-y-5">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-xl">
                <AlertOctagon className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Application Rendering Notice</h2>
                <p className="text-xs text-slate-500">The app encountered a runtime issue and safely recovered</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-900 text-emerald-400 rounded-xl text-xs font-mono overflow-x-auto max-h-44 space-y-1">
              <div className="text-rose-400 font-semibold">{this.state.error?.name}: {this.state.error?.message}</div>
              {this.state.errorInfo?.componentStack && (
                <div className="text-[11px] text-slate-400 whitespace-pre-wrap leading-tight">
                  {this.state.errorInfo.componentStack}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 inline-flex items-center justify-center space-x-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition shadow-sm cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reload Application</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetCacheAndReload}
                className="inline-flex items-center justify-center space-x-2 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition cursor-pointer"
                title="Clears local cache, service workers, and reloads"
              >
                <Trash2 className="w-4 h-4 text-slate-500" />
                <span>Reset Cache & Restart</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
