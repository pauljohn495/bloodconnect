import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import logoUrl from './assets/bloodconnect_logo.png'

const iconLink = document.querySelector("link[rel='icon']")
if (iconLink) {
  iconLink.href = logoUrl
  iconLink.type = 'image/png'
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
