import { Download } from 'lucide-react'
import type { ExportFormat } from '../types'
import { btnPrimary } from './styles'

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
      <select
        value={exportFormat}
        onChange={(event) => onFormatChange(event.target.value as ExportFormat)}
        className="h-[30px] rounded-md border border-neutral-700 bg-[#131518] px-2 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
      >
        <option value="xml">xml</option>
        <option value="pak">pak</option>
        <option value="zip">zip</option>
      </select>
      <button type="button" className={btnPrimary} onClick={onExport}>
        <Download />
        Exportar
      </button>
    </div>
  )
}
