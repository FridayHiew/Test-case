import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Safely configure global WebGPU error suppressors without modifying read-only browser objects
if (typeof window !== 'undefined') {
  try {
    window.addEventListener('uncapturederror', (event: any) => {
      if (event?.preventDefault) event.preventDefault();
      if (event?.stopPropagation) event.stopPropagation();
    }, true);

    window.addEventListener('error', (event: any) => {
      const msg = String(event?.message || event?.error?.message || '');
      if (msg.includes('WebGPU') || msg.includes('uncaptured')) {
        if (event?.preventDefault) event.preventDefault();
        if (event?.stopPropagation) event.stopPropagation();
      }
    }, true);

    window.addEventListener('unhandledrejection', (event: any) => {
      const reasonStr = String(event?.reason?.message || event?.reason || '');
      if (reasonStr.includes('WebGPU') || reasonStr.includes('uncaptured')) {
        if (event?.preventDefault) event.preventDefault();
        if (event?.stopPropagation) event.stopPropagation();
      }
    }, true);
  } catch (err) {
    console.warn('Non-fatal WebGPU event listener setup error:', err);
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}


