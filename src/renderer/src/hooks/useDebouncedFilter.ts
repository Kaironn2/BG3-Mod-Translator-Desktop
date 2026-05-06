import { useEffect, useState } from 'react'

export function useDebouncedFilter(value: string, delay = 250): string {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(id)
  }, [delay, value])

  return debounced
}
