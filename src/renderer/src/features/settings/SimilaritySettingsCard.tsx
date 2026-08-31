import { BookOpen } from 'lucide-react'
import { useAISettings } from '@/hooks/useAISettings'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { SettingsSectionCard } from './SettingsSectionCard'

function FieldRow({
  title,
  description,
  disabled,
  children
}: {
  title: string
  description: string
  disabled?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div
      className={`flex items-center justify-between gap-5 border-b border-[#1f2329] py-3 first:pt-0 last:border-b-0 last:pb-0 ${
        disabled ? 'pointer-events-none opacity-45' : ''
      }`}
    >
      <div className="min-w-0">
        <div className="text-sm font-medium text-neutral-200">{title}</div>
        <div className="mt-0.5 text-xs text-neutral-500">{description}</div>
      </div>
      <div className="flex shrink-0 items-center gap-3">{children}</div>
    </div>
  )
}

export function SimilaritySettingsCard(): React.JSX.Element {
  const { t } = useAppTranslation(['ai'])
  const { similarity, set } = useAISettings()

  const setCount = (value: number): void => {
    void set('ai_similarity_count', String(Math.min(10, Math.max(1, value))))
  }

  return (
    <SettingsSectionCard
      title={t('similarity.title')}
      subtitle={t('similarity.subtitle')}
      icon={<BookOpen size={16} />}
    >
      <FieldRow title={t('similarity.enable')} description={t('similarity.enableDesc')}>
        <button
          type="button"
          onClick={() => void set('ai_similarity_enabled', String(!similarity.enabled))}
          className={`relative h-5.5 w-9.5 cursor-pointer rounded-full border transition-colors ${
            similarity.enabled ? 'border-amber-500 bg-amber-500' : 'border-neutral-500 bg-[#252a32]'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
              similarity.enabled ? 'translate-x-4' : ''
            }`}
          />
        </button>
      </FieldRow>

      <FieldRow
        title={t('similarity.count')}
        description={t('similarity.countDesc')}
        disabled={!similarity.enabled}
      >
        <div className="inline-flex items-center overflow-hidden rounded-md border border-[#1f2329] bg-[#0f1114]">
          <button
            type="button"
            onClick={() => setCount(similarity.count - 1)}
            disabled={similarity.count <= 1}
            className="flex h-8 w-7 cursor-pointer items-center justify-center text-neutral-300 hover:bg-[#181b1f] disabled:cursor-not-allowed disabled:text-neutral-600"
          >
            −
          </button>
          <span className="min-w-8 border-x border-[#1f2329] text-center font-mono text-sm text-neutral-200 tabular-nums">
            {similarity.count}
          </span>
          <button
            type="button"
            onClick={() => setCount(similarity.count + 1)}
            disabled={similarity.count >= 10}
            className="flex h-8 w-7 cursor-pointer items-center justify-center text-neutral-300 hover:bg-[#181b1f] disabled:cursor-not-allowed disabled:text-neutral-600"
          >
            +
          </button>
        </div>
      </FieldRow>

      <FieldRow
        title={t('similarity.minScore')}
        description={t('similarity.minScoreDesc')}
        disabled={!similarity.enabled}
      >
        <input
          type="range"
          min={0}
          max={90}
          step={5}
          value={Math.round(similarity.minScore * 100)}
          onChange={(e) =>
            void set('ai_similarity_min_score', String(Number(e.target.value) / 100))
          }
          className="w-52 cursor-pointer accent-amber-500"
        />
        <span className="w-12 text-right font-mono text-sm font-semibold text-amber-400 tabular-nums">
          {similarity.minScore.toFixed(2)}
        </span>
      </FieldRow>
    </SettingsSectionCard>
  )
}
