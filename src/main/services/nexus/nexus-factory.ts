import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { app } from 'electron'
import { NexusApi } from './nexus.api'
import { NexusClient } from './nexus-client'
import { NexusConfigError } from './nexus-errors'

let cached: { api: NexusApi; client: NexusClient } | null = null

/**
 * Returns a shared NexusApi bound to the configured API key.
 *
 * Key resolution (dev-first, mirroring translation.ipc):
 *  1. process.env.NEXUS_API_KEY (loaded from .env in dev)
 *  2. packaged builds: set via config store / environment by the caller
 *
 * The key never leaves the main process. Packaged builds only ever need this
 * service on the release machine, not at runtime for end users.
 */
export function getNexusApi(): NexusApi {
  const key = process.env.NEXUS_API_KEY?.trim()
  if (!key) {
    throw new NexusConfigError(
      'NEXUS_API_KEY is not set. Add it to .env (dev) or the environment (release machine).'
    )
  }
  if (cached) return cached.api

  const client = new NexusClient({
    apiKey: key,
    userAgent: `Icosa/${app.getVersion()} (${is.dev ? 'dev' : 'release'})`
  })
  cached = { api: new NexusApi(client), client }
  return cached.api
}

/** Absolute path to the electron-builder output dir for the current checkout. */
export function getDistDir(): string {
  return join(app.getAppPath(), 'dist')
}
