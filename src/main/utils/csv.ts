export interface CsvTable {
  headers: string[]
  rows: string[][]
}

export function csvCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function parseCsv(content: string): Record<string, string>[] {
  const table = parseCsvTable(content)
  if (table.headers.length === 0) return []

  return table.rows.map((row) =>
    Object.fromEntries(table.headers.map((header, index) => [header, row[index]?.trim() ?? '']))
  )
}

export function parseCsvTable(content: string): CsvTable {
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  if (!normalized.trim()) return { headers: [], rows: [] }

  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false

  for (let index = 0; index < normalized.length; index++) {
    const char = normalized[index]
    const next = normalized[index + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"'
        index++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentCell)
      currentCell = ''
      continue
    }

    if (char === '\n' && !inQuotes) {
      currentRow.push(currentCell)
      rows.push(currentRow)
      currentRow = []
      currentCell = ''
      continue
    }

    currentCell += char
  }

  currentRow.push(currentCell)
  rows.push(currentRow)

  const nonEmptyRows = rows.filter((row) => row.some((cell) => cell.trim() !== ''))
  if (nonEmptyRows.length === 0) return { headers: [], rows: [] }

  return {
    headers: nonEmptyRows[0].map((header) => header.trim()),
    rows: nonEmptyRows.slice(1)
  }
}
