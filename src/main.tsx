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
  }
}

// Safely wrapped custom event tracking from @vercel/analytics
export function safeTrack(eventName: string, properties?: Record<string, any>) {
  try {
    track(eventName, properties);
  } catch (err) {
    // Graceful fallback for local development or environments without Vercel keys
  }
}

window.puckedgeTrack = safeTrack;

// Flush any events that were dispatched prior to module script initialization
if (Array.isArray(window.__puckedgeQueue)) {
  const queued = [...window.__puckedgeQueue];
  window.__puckedgeQueue = [];
  queued.forEach((item) => {
    safeTrack(item.name, item.props);
  });
}

// Mount the React root with <Analytics /> component
let rootElement = document.getElementById('root');
if (!rootElement) {
  rootElement = document.createElement('div');
  rootElement.id = 'root';
  document.body.appendChild(rootElement);
}

createRoot(rootElement).render(<App />);
