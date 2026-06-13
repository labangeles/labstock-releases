import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { OnlineProvider } from './contexts/OnlineContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <OnlineProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </OnlineProvider>
    </ThemeProvider>
  </React.StrictMode>
)
