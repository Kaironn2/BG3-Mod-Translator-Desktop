import { ipcMain } from 'electron'
import { getDb } from '../database/connection'
import { LanguageRepository } from '../database/repositories/language.repo'

export function registerLanguageHandlers(): void {
  ipcMain.handle('language:getAll', () => {
    const db = getDb()
    const repo = new LanguageRepository(db)
    return repo.getAll()
  })
}
