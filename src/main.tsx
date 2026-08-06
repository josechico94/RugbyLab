// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initAuth } from './shared/auth/initAuth'
import './shared/styles/global.css'

// Una sola suscripción a Firebase Auth para toda la app.
initAuth()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
