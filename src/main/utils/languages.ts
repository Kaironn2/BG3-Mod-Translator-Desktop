export { toBg3LanguageFolder } from '../../shared/parsers/bg3/languages'

export function normalizeLangs(a: string, b: string): [string, string, swapped: boolean] {
  const swapped = a > b
  return swapped ? [b, a, true] : [a, b, false]
}
