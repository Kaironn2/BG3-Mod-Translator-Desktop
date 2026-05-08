import { SetupStepCard } from '@/features/translate/components/SetupStepCard'

interface MergeNameStepProps {
  value: string
  onChange: (value: string) => void
}

export function MergeNameStep({ value, onChange }: MergeNameStepProps): React.JSX.Element {
  return (
    <SetupStepCard step="03">
      <div>
        <h3 className="text-[15px] font-semibold text-neutral-200 tracking-tight m-0">
          Detalhes do merge
        </h3>
        <p className="text-xs text-neutral-500 mt-1 m-0">
          O nome do mod e usado para escopar as entradas no dicionario.
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
          Nome do mod
        </span>
        <input
          type="text"
          placeholder="ex: Order of the Dracolich"
          className="w-full bg-[#0f1114] border border-[#1f2329] rounded-lg px-3.5 py-2.5 text-sm text-neutral-200 outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 transition-colors placeholder:text-neutral-700"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    </SetupStepCard>
  )
}
