import { parentPort, workerData } from 'node:worker_threads'
import { type PrepareInputWorkerInput, runPrepareInputWorker } from './prepare-input.worker.runtime'

if (parentPort === null) {
  throw new Error('prepare-input.worker must be spawned via worker_threads')
}

const port = parentPort

;(async () => {
  try {
    await runPrepareInputWorker(workerData as PrepareInputWorkerInput, (msg) =>
      port.postMessage(msg)
    )
    process.exit(0)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    port.postMessage({ phase: 'error', message })
    process.exit(1)
  }
})()
