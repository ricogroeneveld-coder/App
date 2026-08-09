import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'

// Optional crash reporting — enabled by setting VITE_SENTRY_DSN at build
// time (see README). Loaded dynamically so builds without a DSN ship zero
// Sentry code; ErrorBoundary picks up the capture hook when present.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  import('@sentry/react').then((Sentry) => {
    Sentry.init({ dsn: sentryDsn, sendDefaultPii: false });
    window.__sentryCapture = Sentry.captureException;
  }).catch(() => { /* blocked/offline — the app runs fine without it */ });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)