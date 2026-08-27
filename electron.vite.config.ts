import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

export default defineConfig({
  main: {
    build: {
      // pnpm + electron-builder drops nested deps of electron-updater (debug -> ms).
      // Bundle the updater so those modules are not required from app.asar/node_modules.
      externalizeDeps: {
        exclude: ['electron-updater', 'ms']
      },
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          'merge.worker': resolve('src/main/workers/merge.worker.ts'),
          'translate.worker': resolve('src/main/workers/translate.worker.ts'),
          'xml-load.worker': resolve('src/main/workers/xml-load.worker.ts'),
          'import.worker': resolve('src/main/workers/import.worker.ts'),
          'prepare-input.worker': resolve('src/main/workers/prepare-input.worker.ts'),
          'similarity.worker': resolve('src/main/workers/similarity.worker.ts'),
          'delete.worker': resolve('src/main/workers/delete.worker.ts')
        }
      }
    }
  },
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
