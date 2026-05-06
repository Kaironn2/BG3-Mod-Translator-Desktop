export function normalizeLangs(a: string, b: string): [string, string, swapped: boolean] {
  const swapped = a > b
  return swapped ? [b, a, true] : [a, b, false]
}
