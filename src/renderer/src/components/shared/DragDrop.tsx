import { useState, useCallback } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DragDropProps {
  accept: string[]
  onFile: (path: string) => void
  label?: string
  className?: string
}

function isAccepted(name: string, accept: string[]): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return accept.includes(ext)
}

export function DragDrop({ accept, onFile, label, className }: DragDropProps): React.JSX.Element {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      setError(null)

      const file = e.dataTransfer.files[0]
      if (!file) return

      if (!isAccepted(file.name, accept)) {
        setError(`Accepted formats: .${accept.join(', .')}`)
        return
      }

      const filePath = window.api.fs.getPathForFile(file)
      onFile(filePath)
    },
    [accept, onFile]
  )

  const handleBrowse = useCallback(async () => {
    setError(null)
    const filters = [{ name: 'Mod files', extensions: accept }]
    const paths = await window.api.fs.openDialog({ filters })
    if (paths[0]) onFile(paths[0])
  }, [accept, onFile])

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors',
        isDragging
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-neutral-700 bg-neutral-900 hover:border-neutral-600',
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Upload size={32} className="text-neutral-500" />
      <div className="text-center">
        <p className="text-sm text-neutral-300">{label ?? 'Drag and drop your file here'}</p>
        <p className="mt-1 text-xs text-neutral-500">.{accept.join(', .')}</p>
      </div>
      <button
        onClick={handleBrowse}
        className="rounded-md bg-neutral-800 px-4 py-1.5 text-xs text-neutral-200 transition-colors hover:bg-neutral-700"
      >
        Browse file
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
