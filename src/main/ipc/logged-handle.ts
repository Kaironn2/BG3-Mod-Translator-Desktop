import { ipcMain } from 'electron'
import { logError } from '../services/log.service'

// IPC invoke errors are caught by Electron and sent to the renderer, so they never
// hit uncaughtException. Wrap handle() so every failed channel is written to disk.
export function patchIpcLogging(): void {
  const originalHandle = ipcMain.handle.bind(ipcMain)
  ipcMain.handle = ((channel: string, listener: (...args: never[]) => unknown) =>
    originalHandle(channel, async (event, ...args) => {
      try {
        return await listener(event as never, ...(args as never[]))
      } catch (err) {
        if (channel !== 'log:write') logError(`ipc.${channel}`, err)
        throw err
      }
    })) as typeof ipcMain.handle
}
