import { useDictionaryIO } from './useDictionaryIO'
import { useDictionaryMutations } from './useDictionaryMutations'
import { useDictionaryQuery } from './useDictionaryQuery'

export function useDictionary() {
  const query = useDictionaryQuery()
  const mutations = useDictionaryMutations(query.entries, query.setEntries)
  const io = useDictionaryIO()

  return { ...query, ...mutations, ...io }
}
