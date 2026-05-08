import { useEffect, useRef, useState } from 'react'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { cn } from '@/lib/utils'

interface ModSelectorProps {
  value: string
  onChange: (name: string) => void
  className?: string
}

export function ModSelector({ value, onChange, className }: ModSelectorProps): React.JSX.Element {
  const { t } = useAppTranslation(['common', 'translate'])
  const [mods, setMods] = useState<string[]>([])
  const [showInput, setShowInput] = useState(false)
  const [newName, setNewName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const selectId = 'mod-selector'
  const inputId = 'mod-new-input'

  useEffect(() => {
    window.api.mod.getAll().then((result) => setMods(result.map((m) => m.name)))
  }, [])

  useEffect(() => {
    if (showInput) inputRef.current?.focus()
  }, [showInput])

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) return
    await window.api.mod.upsert({ name })
    setMods((prev) => (prev.includes(name) ? prev : [...prev, name].sort()))
    onChange(name)
    setNewName('')
    setShowInput(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleAdd()
    if (e.key === 'Escape') {
      setShowInput(false)
      setNewName('')
    }
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={showInput ? inputId : selectId} className="text-xs text-neutral-400">
        {t('fields.mod', { ns: 'common' })}
      </label>
      <div className="flex gap-2">
        {showInput ? (
          <>
            <input
              id={inputId}
              ref={inputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('setup.modSelection.modNamePlaceholder', { ns: 'translate' })}
              className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 focus:border-neutral-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAdd}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
            >
              {t('actions.save', { ns: 'common' })}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowInput(false)
                setNewName('')
              }}
              className="rounded-md bg-neutral-800 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700"
            >
              {t('actions.cancel', { ns: 'common' })}
            </button>
          </>
        ) : (
          <>
            <select
              id={selectId}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 focus:border-neutral-500 focus:outline-none"
            >
              <option value="">{t('setup.modSelection.title', { ns: 'translate' })}</option>
              {mods.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowInput(true)}
              className="rounded-md bg-neutral-800 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700 whitespace-nowrap"
            >
              {t('setup.modSelection.new', { ns: 'translate' })}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
