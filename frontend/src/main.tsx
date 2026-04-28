import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { getDeviceId, collectAndSendVisit } from './lib/fingerprint'

collectAndSendVisit(getDeviceId())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
