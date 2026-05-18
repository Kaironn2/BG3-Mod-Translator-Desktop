import type { RepositoryRegistry } from '../database/repositories/registry'
import type { TranslationUsageRepository } from '../database/repositories/translation-usage.repo'
import type { TranslationUsage } from '../database/schema'

export type Service = 'deepl' | 'google'

export type UsageRow = TranslationUsage

const DEFAULT_CHAR_LIMIT = 500_000

function defaultRenewalAt(): string {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
}

// Advance an ISO UTC timestamp by exactly one calendar month.
// The day is clamped to the last valid day of the target month
// (e.g. Jan 31 -> Feb 28/29, Mar 31 -> Apr 30).
export function advanceOneMonth(isoUtc: string): string {
  const d = new Date(isoUtc)
  const originalDay = d.getUTCDate()

  d.setUTCMonth(d.getUTCMonth() + 1)

  // If the day overflowed (e.g. Jan 31 -> Mar 3 in a non-leap year),
  // set to 0 to get the last day of the intended month.
  if (d.getUTCDate() < originalDay) {
    d.setUTCDate(0)
  }

  return d.toISOString()
}

export class UsageService {
  constructor(private repo: TranslationUsageRepository) {}

  getUsage(service: Service): UsageRow {
    this.applyRenewalIfDue(service)
    return this.readOrInit(service)
  }

  setLimit(service: Service, charLimit: number): UsageRow {
    if (charLimit <= 0) {
      throw new Error(`charLimit must be > 0, got ${charLimit}`)
    }
    this.readOrInit(service)
    return this.repo.setLimit(service, charLimit)
  }

  setRenewalAt(service: Service, isoUtc: string): UsageRow {
    const parsed = new Date(isoUtc)
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Invalid ISO date string: ${isoUtc}`)
    }
    this.readOrInit(service)
    return this.repo.setRenewalAt(service, isoUtc)
  }

  setConsumed(service: Service, consumedChars: number): void {
    if (consumedChars < 0) {
      throw new Error(`consumedChars must be >= 0, got ${consumedChars}`)
    }
    this.readOrInit(service)
    this.repo.setConsumed(service, consumedChars)
  }

  getRemaining(service: Service): number {
    const row = this.getUsage(service)
    return Math.max(0, row.charLimit - row.consumedChars)
  }

  consume(service: Service, chars: number): UsageRow {
    if (chars < 0) {
      throw new Error(`chars must be >= 0, got ${chars}`)
    }
    this.applyRenewalIfDue(service)
    return this.repo.addConsumed(service, chars)
  }

  private applyRenewalIfDue(service: Service): void {
    const row = this.readOrInit(service)
    const now = Date.now()
    const renewalTime = new Date(row.renewalAt).getTime()

    if (now < renewalTime) return

    let nextRenewal = row.renewalAt
    while (new Date(nextRenewal).getTime() <= now) {
      nextRenewal = advanceOneMonth(nextRenewal)
    }

    this.repo.reset(service, nextRenewal)
  }

  private readOrInit(service: Service): UsageRow {
    return this.repo.upsertDefaults(service, {
      charLimit: DEFAULT_CHAR_LIMIT,
      renewalAt: defaultRenewalAt()
    })
  }
}

export function createUsageService(repos: RepositoryRegistry): UsageService {
  return new UsageService(repos.translationUsage)
}
