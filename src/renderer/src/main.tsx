import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initI18n } from './i18n'

window.addEventListener('error', (event) => {
  void window.api.log.write({
    scope: 'renderer.error',
    message: event.message,
    stack: event.error instanceof Error ? event.error.stack : undefined,
    meta: { filename: event.filename, lineno: event.lineno, colno: event.colno }
  })
})

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  void window.api.log.write({
    scope: 'renderer.unhandledRejection',
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined
  })
})

async function bootstrap(): Promise<void> {
  await initI18n()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}

void bootstrap()
