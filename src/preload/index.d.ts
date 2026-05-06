import type { AppWindow } from './api-types'

declare global {
  interface Window extends AppWindow {}
}
