interface SetupStepCardProps {
  step: string
  children: React.ReactNode
}

export function SetupStepCard({ step, children }: SetupStepCardProps): React.JSX.Element {
  return (
    <section className="grid grid-cols-[56px_1fr] bg-[#131518] border border-[#1f2329] rounded-xl overflow-hidden hover:border-neutral-700 transition-colors">
      <div className="bg-[#0f1114] border-r border-[#1f2329] flex items-start justify-center pt-4.5 font-mono text-[11px] font-bold text-neutral-600 tracking-[0.08em]">
        {step}
      </div>
      <div className="p-5 flex flex-col gap-3.5">{children}</div>
    </section>
  )
}
