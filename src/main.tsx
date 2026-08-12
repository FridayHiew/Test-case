import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Safely patch WebGPU adapter requestDevice to attach uncapturederror listener automatically
if (typeof window !== 'undefined') {
  // Global event listeners for WebGPU uncaptured errors
  window.addEventListener('uncapturederror', (event: any) => {
    if (event.preventDefault) event.preventDefault();
    if (event.stopPropagation) event.stopPropagation();
  }, true);

  window.addEventListener('error', (event: any) => {
    const msg = String(event?.message || event?.error?.message || '');
    if (msg.includes('WebGPU') || msg.includes('uncaptured')) {
      if (event.preventDefault) event.preventDefault();
      if (event.stopPropagation) event.stopPropagation();
    }
  }, true);

  window.addEventListener('unhandledrejection', (event: any) => {
    const reasonStr = String(event?.reason || '');
    if (reasonStr.includes('WebGPU') || reasonStr.includes('uncaptured')) {
      if (event.preventDefault) event.preventDefault();
      if (event.stopPropagation) event.stopPropagation();
    }
  }, true);

  // Monkey-patch GPUAdapter.prototype.requestDevice if navigator.gpu exists
  if ((navigator as any)?.gpu?.requestAdapter) {
    const origRequestAdapter = (navigator as any).gpu.requestAdapter;
    (navigator as any).gpu.requestAdapter = async function (...args: any[]) {
      try {
        const adapter = await origRequestAdapter.apply(this, args);
        if (adapter && !adapter._patchedForUncapturedError) {
          adapter._patchedForUncapturedError = true;
          const origRequestDevice = adapter.requestDevice;
          if (origRequestDevice) {
            adapter.requestDevice = async function (...devArgs: any[]) {
              try {
                const device = await origRequestDevice.apply(this, devArgs);
                if (device && typeof device.addEventListener === 'function') {
                  device.addEventListener('uncapturederror', (evt: any) => {
                    if (evt.preventDefault) evt.preventDefault();
                    if (evt.stopPropagation) evt.stopPropagation();
                  });
                }
                return device;
              } catch (err) {
                console.warn('WebGPU requestDevice caught error:', err);
                throw err;
              }
            };
          }
        }
        return adapter;
      } catch (err) {
        console.warn('WebGPU requestAdapter caught error:', err);
        throw err;
      }
    };
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);


