/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createRoot } from 'react-dom/client';
import { track } from '@vercel/analytics';
import App from './App.tsx';

declare global {
  interface Window {
    puckedgeTrack?: (eventName: string, properties?: Record<string, any>) => void;
    __puckedgeQueue?: Array<{ name: string; props?: Record<string, any> }>;
    umami?: {
      track?: (eventName: string, data?: Record<string, string | number>) => void;
    };
    trackEvent?: (eventName: string, data?: Record<string, string | number>) => void;
  }
}

type TrackPropertyValue = string | number | boolean | null;

// Safely wrapped custom event tracking for Umami Analytics
export function trackEvent(eventName: string, data?: Record<string, string | number>) {
  try {
    if (!eventName) return;
    (window as any).umami?.track(eventName, data);
  } catch {
    // Graceful fallback when blocked or in local preview
  }
}

// Safely wrapped custom event tracking from @vercel/analytics
export function safeTrack(eventName: string, properties?: Record<string, unknown>) {
  try {
    if (!eventName) return;
    if (properties && typeof properties === 'object') {
      const cleanProps: Record<string, TrackPropertyValue> = {};
      for (const [key, val] of Object.entries(properties)) {
        if (
          typeof val === 'string' ||
          typeof val === 'number' ||
          typeof val === 'boolean' ||
          val === null
        ) {
          cleanProps[key] = val;
        }
      }
      if (Object.keys(cleanProps).length > 0) {
        track(eventName, cleanProps);
        return;
      }
    }
    track(eventName);
  } catch {
    // Graceful fallback for local development or when blocked by ad blockers
  }
}

window.puckedgeTrack = safeTrack;
window.trackEvent = trackEvent;

// Flush any events that were dispatched prior to module script initialization
try {
  if (Array.isArray(window.__puckedgeQueue)) {
    const queued = [...window.__puckedgeQueue];
    window.__puckedgeQueue = [];
    queued.forEach((item) => {
      if (item && item.name) {
        safeTrack(item.name, item.props);
      }
    });
  }
} catch {
  // Ignore queue flush errors
}

// Mount the React root with <Analytics /> component
let rootElement = document.getElementById('root');
if (!rootElement) {
  rootElement = document.createElement('div');
  rootElement.id = 'root';
  document.body.appendChild(rootElement);
}

createRoot(rootElement).render(<App />);
