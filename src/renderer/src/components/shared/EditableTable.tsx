import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: keyof T
  header: string
  editable?: boolean
  width?: string
}

interface EditableTableProps<T extends { id: number }> {
  columns: Column<T>[]
  data: T[]
  onUpdate: (id: number, key: keyof T, value: string) => void
  className?: string
}

interface CellKey {
  id: number
  key: string
}

export function EditableTable<T extends { id: number }>({
  columns,
  data,
  onUpdate,
  className
}: EditableTableProps<T>): React.JSX.Element {
  const [editing, setEditing] = useState<CellKey | null>(null)
  const [draft, setDraft] = useState('')

  const startEdit = useCallback((id: number, key: string, current: string) => {
    setEditing({ id, key })
    setDraft(current)
  }, [])

  const commitEdit = useCallback(
    (row: T, key: keyof T) => {
      if (draft !== String(row[key])) {
        onUpdate(row.id, key, draft)
      }
      setEditing(null)
    },
    [draft, onUpdate]
  )

  const cancelEdit = useCallback(() => setEditing(null), [])

  return (
    <div className={cn('overflow-auto rounded-md border border-neutral-800', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-800 bg-neutral-900">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className="px-3 py-2 text-left text-xs font-medium text-neutral-400"
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id} className="border-b border-neutral-800/50 hover:bg-neutral-900/50">
              {columns.map((col) => {
                const isEditing = editing?.id === row.id && editing.key === String(col.key)
                const rawValue = row[col.key]
                const displayValue = rawValue == null ? '' : String(rawValue)

                return (
                  <td key={String(col.key)} className="px-3 py-1.5">
                    {isEditing && col.editable ? (
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={() => commitEdit(row, col.key)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit(row, col.key)
                          if (e.key === 'Escape') cancelEdit()
                        }}
                        className="w-full rounded border border-blue-500 bg-neutral-800 px-2 py-0.5 text-sm text-neutral-100 outline-none"
                      />
                    ) : (
                      <span
                        className={cn(
                          'block truncate text-neutral-300',
                          col.editable && 'cursor-pointer hover:text-white'
                        )}
                        title={displayValue}
                        onClick={() =>
                          col.editable && startEdit(row.id, String(col.key), displayValue)
                        }
                      >
                        {displayValue || <span className="text-neutral-600 italic">empty</span>}
                      </span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="py-8 text-center text-sm text-neutral-600">
                No entries
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
