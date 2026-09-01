interface StepCardProps {
  step: string
  title: string
  description: string
  children: React.ReactNode
}

export function StepCard({ step, title, description, children }: StepCardProps): React.JSX.Element {
  return (
    <section className="grid grid-cols-[56px_1fr] overflow-hidden rounded-xl border border-[#1f2329] bg-[#131518] transition-colors hover:border-neutral-700">
      <div className="flex items-start justify-center border-r border-[#1f2329] bg-[#0f1114] pt-4.5 font-mono text-[11px] font-bold tracking-[0.08em] text-neutral-600">
        {step}
      </div>
      <div className="flex flex-col gap-3.5 p-5">
        <div>
          <h3 className="m-0 text-[15px] font-semibold tracking-tight text-neutral-200">{title}</h3>
          <p className="mt-1 m-0 text-xs text-neutral-500">{description}</p>
        </div>
        {children}
      </div>
    </section>
  )
}
