import { ProgressBar } from '@/components/shared/ProgressBar'
import type { TranslationRow } from '@/hooks/useTranslation'

interface TranslationProgressProps {
  current: number
  total: number
  rows: TranslationRow[]
  outputPath: string | null
  error: string | null
}

export function TranslationProgress({
  current,
  total,
  rows,
  outputPath,
  error
}: TranslationProgressProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <ProgressBar current={current} total={total} />

      {error && <p className="rounded-md bg-red-950 px-3 py-2 text-sm text-red-400">{error}</p>}

      {outputPath && (
        <p className="rounded-md bg-green-950 px-3 py-2 text-sm text-green-400">
          Done - {outputPath}
        </p>
      )}

      {rows.length > 0 && (
        <div className="max-h-72 overflow-y-auto rounded-md border border-neutral-800">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-neutral-900">
              <tr>
                <th className="w-10 px-3 py-2 text-left text-neutral-500">#</th>
                <th className="px-3 py-2 text-left text-neutral-500">Source</th>
                <th className="px-3 py-2 text-left text-neutral-500">Target</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.index} className="border-t border-neutral-800/50">
                  <td className="px-3 py-1.5 text-neutral-600">{row.index}</td>
                  <td className="px-3 py-1.5 text-neutral-400">{row.source}</td>
                  <td className="px-3 py-1.5 text-neutral-200">{row.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
