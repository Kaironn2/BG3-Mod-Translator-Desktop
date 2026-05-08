import { Download } from 'lucide-react'
import { ThemedSelect } from '@/components/shared/ThemedSelect'
import type { ExportFormat } from '../types'
import { btnPrimary } from './styles'

function ShortcutHint({
  children,
  subtle = false
}: {
  children: React.ReactNode
  subtle?: boolean
}): React.JSX.Element {
  return (
    <span
      className={
        subtle
          ? 'inline-flex items-center justify-center font-mono text-[10px] text-black/65'
          : 'inline-flex h-4.5 min-w-4.5 items-center justify-center rounded border border-[#2a2f37] border-b-2 bg-[#181b1f] px-1 font-mono text-[10px] text-neutral-400'
      }
    >
      {children}
    </span>
  )
}

interface ExportControlsProps {
  exportFormat: ExportFormat
  onFormatChange: (format: ExportFormat) => void
  onExport: () => Promise<void>
}

export function ExportControls({
  exportFormat,
  onFormatChange,
  onExport
}: ExportControlsProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5">
      <ThemedSelect
        value={exportFormat}
        onChange={(value) => onFormatChange(value as ExportFormat)}
        className="w-36"
        triggerClassName="h-[30px] border-neutral-700 bg-[#131518] px-3 text-xs text-neutral-200 hover:border-neutral-600"
        menuClassName="border-neutral-700"
        triggerAdornment={<ShortcutHint>Ctrl T</ShortcutHint>}
        options={[
          { value: 'xml', label: 'xml' },
          { value: 'pak', label: 'pak' },
          { value: 'zip', label: 'zip' }
        ]}
      />
      <button type="button" className={btnPrimary} onClick={onExport} title="Exportar (Ctrl+E)">
        <Download />
        Exportar
        <ShortcutHint subtle>Ctrl E</ShortcutHint>
      </button>
    </div>
  )
}
