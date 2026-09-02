import { NEXUS_API_BASE_URL } from './nexus.constants'
import { NexusApiError, NexusConfigError } from './nexus-errors'

const DEFAULT_TIMEOUT_MS = 30_000

export interface NexusClientOptions {
  apiKey: string
  baseUrl?: string
  timeoutMs?: number
  /** Identifies the integration in Nexus request logs (e.g. "Icosa/1.17.0"). */
  userAgent?: string
}

interface RequestInput {
  method: 'GET' | 'POST' | 'PUT'
  path: string
  /** Absolute URL; overrides baseUrl + path (presigned S3 PUTs). */
  url?: string
  body?: unknown
  timeoutMs?: number
  /** PUT to presigned S3 URLs must not carry the apikey header. */
  skipAuthHeaders?: boolean
  rawBody?: Uint8Array
  headers?: Record<string, string>
  /** When set, runs after a 2xx response and its result becomes the resolved value. */
  pickHeaders?: (headers: Headers) => Record<string, string>
  /** Skip JSON parsing of the response body (S3 returns XML/error text). */
  skipJsonParse?: boolean
}

export class NexusClient {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly timeoutMs: number
  private readonly userAgent?: string

  constructor(options: NexusClientOptions) {
    const apiKey = options.apiKey?.trim()
    if (!apiKey) {
      throw new NexusConfigError('Nexus API key is required')
    }
    this.apiKey = apiKey
    this.baseUrl = (options.baseUrl ?? NEXUS_API_BASE_URL).replace(/\/+$/, '')
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.userAgent = options.userAgent
  }

  async get<T>(path: string, timeoutMs?: number): Promise<T> {
    return this.request<T>({ method: 'GET', path, timeoutMs })
  }

  async postJson<T>(path: string, body: unknown, timeoutMs?: number): Promise<T> {
    return this.request<T>({ method: 'POST', path, body, timeoutMs })
  }

  async postVoid(path: string, timeoutMs?: number): Promise<void> {
    await this.request<unknown>({ method: 'POST', path, timeoutMs })
  }

  /** PUT file bytes to a presigned URL (S3). No auth headers, long timeout. */
  async putBytes(
    url: string,
    bytes: Uint8Array,
    headers: Record<string, string>,
    timeoutMs?: number
  ): Promise<void> {
    await this.request<unknown>({
      method: 'PUT',
      path: url,
      url,
      rawBody: bytes,
      headers,
      skipAuthHeaders: true,
      timeoutMs: timeoutMs ?? 30 * 60_000
    })
  }

  /** Raw request whose 2xx response headers are returned (S3 part ETags). */
  requestWithResponse<T>(input: RequestInput): Promise<T> {
    return this.request<T>(input)
  }

  /** POST raw XML body to a presigned URL (S3 multipart complete). */
  async postXml(url: string, xml: string, timeoutMs?: number): Promise<void> {
    await this.request<unknown>({
      method: 'POST',
      path: url,
      url,
      rawBody: Buffer.from(xml, 'utf-8'),
      headers: {
        'Content-Type': 'application/xml',
        'Content-Length': String(Buffer.byteLength(xml, 'utf-8'))
      },
      skipAuthHeaders: true,
      timeoutMs: timeoutMs ?? 60_000,
      skipJsonParse: true
    })
  }

  private async request<T>(input: RequestInput): Promise<T> {
    const url = input.url ?? `${this.baseUrl}${input.path}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? this.timeoutMs)
    try {
      const headers: Record<string, string> = { ...input.headers }
      if (!input.skipAuthHeaders) {
        headers.apikey = this.apiKey
        headers.Accept = 'application/json'
        if (this.userAgent) headers['User-Agent'] = this.userAgent
      }
      if (input.body !== undefined) {
        headers['Content-Type'] = 'application/json'
      }

      const response = await fetch(url, {
        method: input.method,
        headers,
        body: input.rawBody
          ? Buffer.from(input.rawBody)
          : input.body !== undefined
            ? JSON.stringify(input.body)
            : undefined,
        signal: controller.signal
      })

      if (!response.ok) {
        throw await this.toApiError(response)
      }
      if (input.pickHeaders) {
        return input.pickHeaders(response.headers) as T
      }
      if (response.status === 204) return undefined as T

      const text = await response.text()
      if (!text) return undefined as T
      if (input.skipJsonParse) return undefined as T
      try {
        return JSON.parse(text) as T
      } catch {
        throw new NexusApiError(response.status, `Invalid JSON response from ${input.path}`)
      }
    } catch (err) {
      if (err instanceof NexusApiError) throw err
      if (err instanceof Error && err.name === 'AbortError') {
        throw new NexusApiError(0, `Request timed out: ${input.method} ${url}`)
      }
      throw err instanceof Error ? err : new Error(String(err))
    } finally {
      clearTimeout(timeout)
    }
  }

  private async toApiError(response: Response): Promise<NexusApiError> {
    let message = response.statusText
    let detail: string | undefined
    try {
      const text = await response.text()
      if (text) {
        const parsed = JSON.parse(text) as { title?: string; detail?: string }
        message = parsed.title ?? message
        detail = parsed.detail
      }
    } catch {
      // keep statusText
    }
    return new NexusApiError(response.status, message, detail)
  }
}
