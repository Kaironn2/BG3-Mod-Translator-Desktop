import type { ParserManifest } from '@shared/parsers/types'
import { FileSpreadsheet } from 'lucide-react'
import bg3Cover from '@/assets/parsers/baldurs-gate-3.webp'
import skyrimCover from '@/assets/parsers/the-elder-scrolls-skyrim.webp'
import untilThenCover from '@/assets/parsers/until-then.webp'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { cn } from '@/lib/utils'

const COVERS: Record<string, string> = {
  bg3: bg3Cover,
  skyrim: skyrimCover,
  'until-then': untilThenCover
}

interface ParserCardProps {
  parser: ParserManifest
  onSelect: (parser: ParserManifest) => void
}

export function ParserCard({ parser, onSelect }: ParserCardProps): React.JSX.Element {
  const { t } = useAppTranslation('translate')
  const cover = COVERS[parser.id]
  const comingSoon = parser.status === 'comingSoon'

  return (
    <button
      type="button"
      onClick={() => onSelect(parser)}
      className={cn(
        'group flex w-full flex-col overflow-hidden rounded-xl border border-[#1f2329] bg-[#131518] text-left transition-colors',
        comingSoon
          ? 'cursor-not-allowed opacity-70'
          : 'cursor-pointer hover:border-amber-500/70 hover:bg-[#181b1f]'
      )}
    >
      <div
        className={cn(
          'relative w-full overflow-hidden bg-[#0c0d0f]',
          cover ? 'aspect-[2/3]' : 'aspect-[4/3]'
        )}
      >
        {cover ? (
          <img
            src={cover}
            alt=""
            className={cn(
              'h-full w-full object-cover',
              comingSoon && 'grayscale group-hover:grayscale'
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-amber-400">
            <FileSpreadsheet size={36} />
          </div>
        )}
        {comingSoon ? (
          <span className="absolute top-2 right-2 rounded-md border border-[#2a2f38] bg-[#0f1114]/90 px-1.5 py-0.5 font-mono text-[10px] text-neutral-300">
            {t('hub.comingSoon')}
          </span>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <span className="truncate text-[13px] font-semibold text-neutral-200">{parser.name}</span>
        {parser.extensions.length > 0 ? (
          <span className="shrink-0 font-mono text-[10px] text-neutral-500">
            {parser.extensions.map((ext) => `.${ext}`).join(' ')}
          </span>
        ) : null}
      </div>
    </button>
  )
}
