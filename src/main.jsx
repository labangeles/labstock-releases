import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { OnlineProvider } from './contexts/OnlineContext'

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: 'monospace', color: '#B91C1C', background: '#FEF2F2',
          minHeight: '100vh', boxSizing: 'border-box' }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Error de renderizado</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, wordBreak: 'break-word' }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button onClick={() => this.setState({ error: null })}
            style={{ marginTop: 16, padding: '8px 16px', cursor: 'pointer' }}>
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <OnlineProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </OnlineProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
