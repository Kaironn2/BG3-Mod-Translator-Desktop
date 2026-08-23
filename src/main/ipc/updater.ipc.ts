import { ipcMain } from 'electron'
import {
  acknowledgeChangelog,
  checkForAppUpdate,
  getUpdaterState,
  installAppUpdate
} from '../services/updater.service'

export function registerUpdaterHandlers(): void {
  ipcMain.handle('updater:getState', () => getUpdaterState())
  ipcMain.handle('updater:check', () => checkForAppUpdate('manual'))
  ipcMain.handle('updater:install', () => installAppUpdate())
  ipcMain.handle('updater:ackChangelog', () => acknowledgeChangelog())
}
