import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Habilita "Instalar app" no navegador (Chrome/Edge no computador,
// Android; iOS usa "Adicionar à Tela de Início" independente de service
// worker) — Chrome/Edge exigem um service worker registrado com handler
// de fetch como critério de instalabilidade, além do manifest.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Instalação como app só é um extra — se falhar (ex: navegador sem
      // suporte), o resto do app continua funcionando normalmente.
    });
  });
}
