import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { clearLegacyGameStorage } from './lib/gameStorage'

// La partida vive solo en memoria. Borramos el progreso de versiones anteriores
// antes de montar la app para que no se reutilice nada al refrescar.
clearLegacyGameStorage()

// Si el navegador restaura la página desde el bfcache, forzamos una recarga para
// que la partida también arranque desde cero al volver a la pestaña.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
