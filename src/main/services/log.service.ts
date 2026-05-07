import fs from 'fs'
import { app, shell } from 'electron'
import path from 'path'

type LogLevel = 'error' | 'warn' | 'info'

export interface LogPayload {
  level?: LogLevel
  scope: string
  message: string
  stack?: string
  meta?: unknown
}

const REDACTED = '[redacted]'
const SENSITIVE_KEY_RE = /(key|secret|token|authorization|password)/i

export function getLogPath(): string {
  return path.join(app.getPath('userData'), 'logs', 'icosa-errors.log')
}

export function writeLog(payload: LogPayload): void {
  const logPath = getLogPath()
  fs.mkdirSync(path.dirname(logPath), { recursive: true })
  const record = {
    timestamp: new Date().toISOString(),
    level: payload.level ?? 'error',
    scope: payload.scope,
    message: payload.message,
    stack: payload.stack,
    meta: sanitize(payload.meta)
  }
  fs.appendFileSync(logPath, `${JSON.stringify(record)}\n`, 'utf-8')
}

export function logError(scope: string, err: unknown, meta?: unknown): void {
  const error = normalizeError(err)
  writeLog({
    level: 'error',
    scope,
    message: error.message,
    stack: error.stack,
    meta
  })
}

export async function openLogFile(): Promise<void> {
  const logPath = getLogPath()
  fs.mkdirSync(path.dirname(logPath), { recursive: true })
  if (!fs.existsSync(logPath)) fs.writeFileSync(logPath, '', 'utf-8')
  const error = await shell.openPath(logPath)
  if (error) throw new Error(error)
}

export function clearLogFile(): void {
  const logPath = getLogPath()
  fs.mkdirSync(path.dirname(logPath), { recursive: true })
  fs.writeFileSync(logPath, '', 'utf-8')
}

function normalizeError(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) return { message: err.message, stack: err.stack }
  return { message: String(err) }
}

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[max-depth]'
  if (value == null) return value
  if (typeof value === 'string') return redactString(value)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1))
  if (typeof value !== 'object') return String(value)

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_KEY_RE.test(key) ? REDACTED : sanitize(item, depth + 1)
    ])
  )
}

function redactString(value: string): string {
  return value
    .replace(/DeepL-Auth-Key\s+[^\s"']+/gi, `DeepL-Auth-Key ${REDACTED}`)
    .replace(/Bearer\s+[^\s"']+/gi, `Bearer ${REDACTED}`)
    .replace(/sk-[A-Za-z0-9_-]+/g, REDACTED)
}
