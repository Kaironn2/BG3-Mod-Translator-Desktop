import { useEffect, useEffectEvent } from 'react'

interface LoadedEditorShortcutsOptions {
  onSave: () => Promise<void>
  onCycleExportFormat: () => void
  onOpenExport: () => Promise<void>
}

export function useLoadedEditorShortcuts({
  onSave,
  onCycleExportFormat,
  onOpenExport
}: LoadedEditorShortcutsOptions): void {
  const handleShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (!event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) return

    const key = event.key.toLowerCase()
    if (key === 's') {
      event.preventDefault()
      void onSave()
      return
    }

    if (key === 't') {
      event.preventDefault()
      onCycleExportFormat()
      return
    }

    if (key === 'e') {
      event.preventDefault()
      void onOpenExport()
    }
  })

  useEffect(() => {
    const listener = (event: KeyboardEvent) => handleShortcut(event)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [handleShortcut])
}
