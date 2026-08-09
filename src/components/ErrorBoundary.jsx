import React from 'react';
import GameBackground from '@/components/GameBackground';

/**
 * Last-resort catch for render-time exceptions. Without this, one bad
 * screen (a null field in a realtime payload, a broken third-party SDK
 * call) unmounts the entire app to a blank white screen with no way back.
 *
 * Deliberately dependency-free: it wraps everything in main.jsx, including
 * the router and every context provider, so it has to render correctly
 * even if THOSE are what threw. No hooks, no useLang, no react-router
 * Link — just plain markup and a hard `window.location` reload.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error', error, info);
    // Sentry, when a build ships with VITE_SENTRY_DSN (see main.jsx). Kept
    // as a window hook so this boundary stays dependency-free.
    try { window.__sentryCapture?.(error); } catch { /* never throw from here */ }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="h-dvh overflow-hidden text-white flex flex-col items-center justify-center p-6 text-center relative">
        <GameBackground />
        <p className="text-5xl mb-4">😵</p>
        <p className="text-xl font-extrabold tracking-tight mb-1">Something went wrong</p>
        <p className="text-slate-400 text-sm font-medium mb-8 max-w-xs">
          The app hit an unexpected error. Your game data is safe — reloading should fix it.
        </p>
        <div className="flex flex-col gap-2.5 w-full max-w-xs">
          <button
            onClick={() => window.location.reload()}
            className="violet-solid-btn h-12 text-sm font-bold"
          >
            Reload
          </button>
          <button
            onClick={() => { window.location.href = '/'; }}
            className="violet-btn h-11 text-sm font-bold"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }
}
