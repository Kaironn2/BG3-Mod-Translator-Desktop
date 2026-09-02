export class NexusApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly detail?: string
  ) {
    super(`Nexus API error ${status}: ${message}`)
    this.name = 'NexusApiError'
  }
}

export class NexusConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NexusConfigError'
  }
}
