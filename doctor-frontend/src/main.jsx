import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// ── Design system — load in dependency order ──────────────────────────────
import './index.css'                   // Tailwind directive
import './styles/design-tokens.css'   // CSS variables (must be first)
import './styles/fonts.css'           // Google Fonts + heading rules
import './styles/global.css'          // Reset + body + scrollbar
import './styles/components.css'      // Cards, buttons, inputs, nav
import './styles/partogram.css'       // Clinical chart styles
import './styles/animations.css'      // @keyframes + utility classes

import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
