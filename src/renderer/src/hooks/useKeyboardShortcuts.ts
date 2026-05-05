import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const SHORTCUTS: Record<string, string> = {
  '1': '/translate',
  '2': '/dictionary',
  '3': '/extract',
  '4': '/package',
  '5': '/settings'
}

export function useKeyboardShortcuts(): void {
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return
      const route = SHORTCUTS[e.key]
      if (!route) return
      e.preventDefault()
      navigate(route)
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])
}
