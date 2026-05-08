import { useAppTranslation } from '@/i18n/useAppTranslation'
import { SetupStepCard } from '@/features/translate/components/SetupStepCard'

interface MergeNameStepProps {
  value: string
  onChange: (value: string) => void
}

export function MergeNameStep({ value, onChange }: MergeNameStepProps): React.JSX.Element {
  const { t } = useAppTranslation('merge')

  return (
    <SetupStepCard step="03">
      <div>
        <h3 className="m-0 text-[15px] font-semibold tracking-tight text-neutral-200">
          {t('nameStep.title')}
        </h3>
        <p className="mt-1 m-0 text-xs text-neutral-500">{t('nameStep.description')}</p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold tracking-[0.08em] text-neutral-500 uppercase">
          {t('nameStep.label')}
        </span>
        <input
          type="text"
          placeholder={t('nameStep.placeholder')}
          className="w-full rounded-lg border border-[#1f2329] bg-[#0f1114] px-3.5 py-2.5 text-sm text-neutral-200 outline-none transition-colors placeholder:text-neutral-700 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    </SetupStepCard>
  )
}
