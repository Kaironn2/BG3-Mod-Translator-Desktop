import { BrowserWindow, dialog, ipcMain, shell } from 'electron'

interface OpenDialogParams {
  filters?: Electron.FileFilter[]
  multiple?: boolean
}

interface SaveDialogParams {
  defaultName?: string
  filters?: Electron.FileFilter[]
}

export function registerFsHandlers(): void {
  ipcMain.handle('fs:openDialog', async (event, params: OpenDialogParams = {}) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win!, {
      properties: params.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
      filters: params.filters
    })
    return result.filePaths
  })

  ipcMain.handle('fs:saveDialog', async (event, params: SaveDialogParams = {}) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showSaveDialog(win!, {
      defaultPath: params.defaultName,
      filters: params.filters
    })
    return result.filePath ?? null
  })

  ipcMain.handle('fs:openFolder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory']
    })
    return result.filePaths[0] ?? null
  })

  ipcMain.handle('fs:openInShell', async (_event, targetPath: string) => {
    if (!targetPath) return
    const result = await shell.openPath(targetPath)
    return result === '' ? { success: true } : { success: false, error: result }
  })
}
