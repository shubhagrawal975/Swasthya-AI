import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './i18n/i18n';
import './index.css';

const rootElement = document.getElementById('root');

function FatalScreen({ title, message, details }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0d1e35', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ maxWidth: 780, width: '100%', background: '#fff', color: '#0d1e35', borderRadius: 16, padding: '1.2rem 1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
        <h1 style={{ margin: 0, fontSize: '1.6rem' }}>{title}</h1>
        <p style={{ margin: '0.6rem 0 0.9rem', fontSize: '1rem' }}>{message}</p>
        {details && <pre style={{ marginTop: 8, background: '#f4f4f4', color: '#1f2937', borderRadius: 8, padding: 10, fontSize: '0.85rem', overflowX: 'auto' }}>{details}</pre>}
        <p style={{ marginTop: 10, fontSize: '0.85rem', color: '#4a5568' }}>Run from terminal:<br /><code style={{ background: '#eef2ff', padding: '2px 6px', borderRadius: 4 }}>cd frontend && npm run dev</code></p>
      </div>
    </div>
  );
}

class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('Global error boundary:', error, info); }
  render() {
    if (this.state.hasError) {
      return <FatalScreen title="Application error" message="Something went wrong while rendering the app." details={this.state.error?.message || 'Unknown error'} />;
    }
    return this.props.children;
  }
}

if (!rootElement) {
  document.body.innerHTML = '<div style="font-family:Arial,sans-serif;padding:2rem;text-align:center;color:#0d1e35;background:#f8fafc;min-height:100vh;display:flex;align-items:center;justify-content:center;"><div><h1>Root element not found</h1><p>Make sure your index.html has a <code>div#root</code>.</p></div></div>';
} else if (window.location.protocol === 'file:') {
  ReactDOM.createRoot(rootElement).render(
    <FatalScreen
      title="App must be served over HTTP(s)"
      message="Direct file:// loading is unsupported. Use a local server or deploy the static build."
      details="Run: cd frontend && npm run dev or npm run build && npx serve dist"
    />
  );
} else {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <GlobalErrorBoundary>
        <HashRouter>
          <App />
          <Toaster
            position="bottom-center"
            toastOptions={{
              duration: 3500,
              style: { background: '#0d1e35', color: '#fff', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '0.85rem', fontWeight: 600, borderRadius: '50px', padding: '10px 20px', maxWidth: '380px' },
              success: { iconTheme: { primary: '#3db87a', secondary: '#fff' } },
              error: { iconTheme: { primary: '#e53e3e', secondary: '#fff' } },
            }}
          />
        </HashRouter>
      </GlobalErrorBoundary>
    </React.StrictMode>
  );
}

