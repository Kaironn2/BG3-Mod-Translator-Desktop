import { ipcMain, shell } from 'electron'
import {
  clearLogFile,
  getLogPath,
  type LogPayload,
  openLogFile,
  writeLog
} from '../services/log.service'

export function registerLogHandlers(): void {
  ipcMain.handle('log:getPath', () => getLogPath())

  ipcMain.handle('log:open', async () => {
    await openLogFile((p) => shell.openPath(p))
    return { success: true }
  })

  ipcMain.handle('log:clear', () => {
    clearLogFile()
    return { success: true }
  })

  ipcMain.handle('log:write', (_event, payload: LogPayload) => {
    writeLog(payload)
    return { success: true }
  })
}
