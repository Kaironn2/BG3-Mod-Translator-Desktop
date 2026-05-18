import { ipcMain } from 'electron'
import type { RepositoryRegistry } from '../database/repositories/registry'
import { logError } from '../services/log.service'
import type { Service, UsageService } from '../services/usage.service'

const VALID_SERVICES: Service[] = ['deepl', 'google']

function assertService(value: unknown): asserts value is Service {
  if (!VALID_SERVICES.includes(value as Service)) {
    throw new Error('invalid service')
  }
}

function assertDate(value: unknown, field: string): void {
  if (typeof value !== 'string' || Number.isNaN(new Date(value).getTime())) {
    throw new Error(`invalid date: ${field}`)
  }
}

export function registerMetricsHandlers(repos: RepositoryRegistry, usage: UsageService): void {
  ipcMain.handle('metrics:getUsage', (_event, payload: { service: Service }) => {
    try {
      assertService(payload?.service)
      return usage.getUsage(payload.service)
    } catch (err) {
      logError('metrics.getUsage', err, payload)
      throw err
    }
  })

  ipcMain.handle('metrics:getAllUsage', (_event) => {
    try {
      return [usage.getUsage('deepl'), usage.getUsage('google')]
    } catch (err) {
      logError('metrics.getAllUsage', err)
      throw err
    }
  })

  ipcMain.handle('metrics:setLimit', (_event, payload: { service: Service; charLimit: number }) => {
    try {
      assertService(payload?.service)
      return usage.setLimit(payload.service, payload.charLimit)
    } catch (err) {
      logError('metrics.setLimit', err, payload)
      throw err
    }
  })

  ipcMain.handle(
    'metrics:setRenewalAt',
    (_event, payload: { service: Service; renewalAt: string }) => {
      try {
        assertService(payload?.service)
        assertDate(payload?.renewalAt, 'renewalAt')
        return usage.setRenewalAt(payload.service, payload.renewalAt)
      } catch (err) {
        logError('metrics.setRenewalAt', err, payload)
        throw err
      }
    }
  )

  ipcMain.handle(
    'metrics:setConsumed',
    (_event, payload: { service: Service; consumedChars: number }) => {
      try {
        assertService(payload?.service)
        usage.setConsumed(payload.service, payload.consumedChars)
        return { success: true }
      } catch (err) {
        logError('metrics.setConsumed', err, payload)
        throw err
      }
    }
  )

  ipcMain.handle(
    'metrics:listRuns',
    (_event, payload?: { limit?: number; service?: Service; from?: string; to?: string }) => {
      try {
        const { limit = 50, service, from, to } = payload ?? {}
        if (service !== undefined) assertService(service)
        if (from !== undefined) assertDate(from, 'from')
        if (to !== undefined) assertDate(to, 'to')
        return repos.translationRun.listRecent({ limit, service, from, to })
      } catch (err) {
        logError('metrics.listRuns', err, payload)
        throw err
      }
    }
  )

  ipcMain.handle(
    'metrics:aggregateByDay',
    (_event, payload: { from: string; to: string; service?: Service }) => {
      try {
        assertDate(payload?.from, 'from')
        assertDate(payload?.to, 'to')
        if (payload?.service !== undefined) assertService(payload.service)
        return repos.translationRun.aggregateByDay({
          from: payload.from,
          to: payload.to,
          service: payload.service
        })
      } catch (err) {
        logError('metrics.aggregateByDay', err, payload)
        throw err
      }
    }
  )

  ipcMain.handle(
    'metrics:aggregateByMod',
    (_event, payload: { from: string; to: string; service?: Service }) => {
      try {
        assertDate(payload?.from, 'from')
        assertDate(payload?.to, 'to')
        if (payload?.service !== undefined) assertService(payload.service)
        return repos.translationRun.aggregateByMod({
          from: payload.from,
          to: payload.to,
          service: payload.service
        })
      } catch (err) {
        logError('metrics.aggregateByMod', err, payload)
        throw err
      }
    }
  )
}
