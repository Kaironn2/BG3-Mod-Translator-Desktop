import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'

export const PRIORITY_DROP_ID = 'drop:priority'
export const OTHER_DROP_ID = 'drop:other'

interface DroppableModListProps {
  id: string
  highlighted?: boolean
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}

export function DroppableModList({
  id,
  highlighted = false,
  className,
  style,
  children
}: DroppableModListProps): React.JSX.Element {
  const { setNodeRef } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(className, 'transition-colors duration-150', highlighted && 'border-amber-500')}
    >
      {children}
    </div>
  )
}
