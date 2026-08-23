import { parentPort } from 'node:worker_threads'
import {
  createSimilarityWorkerRuntime,
  type SimilarityWorkerRequest
} from './similarity.worker.runtime'

if (parentPort === null) {
  throw new Error('similarity.worker must be spawned via worker_threads')
}

const port = parentPort
const handle = createSimilarityWorkerRuntime((msg) => port.postMessage(msg))

port.on('message', (msg: SimilarityWorkerRequest) => {
  handle(msg)
})
