import { Download } from 'lucide-react'
import { ThemedSelect } from '@/components/shared/ThemedSelect'
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
      <ThemedSelect
        value={exportFormat}
        onChange={(value) => onFormatChange(value as ExportFormat)}
        className="w-24"
        triggerClassName="h-[30px] px-2 text-xs"
        options={[
          { value: 'xml', label: 'xml' },
          { value: 'pak', label: 'pak' },
          { value: 'zip', label: 'zip' }
        ]}
      />
      <button type="button" className={btnPrimary} onClick={onExport}>
        <Download />
        Exportar
      </button>
    </div>
  )
}
