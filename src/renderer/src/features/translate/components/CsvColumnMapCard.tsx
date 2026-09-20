import type { CsvColumnMap } from '@shared/parsers/types'
import { ThemedSelect } from '@/components/shared/ThemedSelect'
import { useAppTranslation } from '@/i18n/useAppTranslation'

interface CsvColumnMapCardProps {
  headers: string[]
  value: CsvColumnMap
  onChange: (value: CsvColumnMap) => void
}

export function CsvColumnMapCard({
  headers,
  value,
  onChange
}: CsvColumnMapCardProps): React.JSX.Element {
  const { t } = useAppTranslation('translate')
  const none = t('csvColumns.none')
  const headerOptions = headers.map((header) => ({ value: header, label: header }))

  return (
    <div className="grid grid-cols-3 gap-3">
      <ThemedSelect
        label={t('csvColumns.source')}
        value={value.sourceColumn}
        onChange={(sourceColumn) => onChange({ ...value, sourceColumn })}
        options={headerOptions}
      />
      <ThemedSelect
        label={t('csvColumns.target')}
        value={value.targetColumn ?? ''}
        onChange={(targetColumn) => onChange({ ...value, targetColumn: targetColumn || null })}
        options={[{ value: '', label: none }, ...headerOptions]}
      />
      <ThemedSelect
        label={t('csvColumns.uid')}
        value={value.uidColumn ?? ''}
        onChange={(uidColumn) => onChange({ ...value, uidColumn: uidColumn || null })}
        options={[{ value: '', label: none }, ...headerOptions]}
      />
    </div>
  )
}
