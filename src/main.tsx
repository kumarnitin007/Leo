import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './mobile.css'
import './styles/journal.css'
import './crisp-paper.css'

// CrispPaper: verify Bricolage Grotesque loaded, warn if fallback active
if (typeof document !== 'undefined') {
  document.fonts.ready.then(() => {
    const loaded = document.fonts.check("16px 'Bricolage Grotesque'");
    if (!loaded) {
      console.warn('[CrispPaper] Bricolage Grotesque font failed to load — falling back to Georgia.');
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

