import { ipcMain } from 'electron'
import type { RepositoryRegistry } from '../database/repositories/registry'

export function registerLanguageHandlers(repos: RepositoryRegistry): void {
  ipcMain.handle('language:getAll', () => {
    return repos.language.getAll()
  })
}
