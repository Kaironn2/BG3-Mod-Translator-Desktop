import type { BrowserWindow } from 'electron'

export function getActiveWindow(getWindow: () => BrowserWindow | null): BrowserWindow | null {
  const win = getWindow()
  return win && !win.isDestroyed() ? win : null
}
