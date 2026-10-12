export class CentaurError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
    readonly retryAfter?: string,
  ) {
    super(message)
    this.name = 'CentaurError'
  }
}

export function retryAfter(value: string | null): string | undefined {
  if (!value || value.length > 64) return undefined
  if (/^\d{1,8}$/.test(value)) return value
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date.toUTCString() === value ? value : undefined
}

export function statusMessage(status: number) {
  switch (status) {
    case 401:
      return 'The integration owner must check the Centaur API key.'
    case 403:
      return 'The integration owner must check API access and the feed.read permission.'
    case 422:
      return 'Centaur rejected the selection. Check the configured asset identifiers.'
    case 429:
      return 'The API allowance is exhausted. Wait before trying Refresh again.'
    case 503:
      return 'Centaur is temporarily unavailable. Try Refresh later.'
    default:
      return 'Centaur could not complete this request. Try Refresh later.'
  }
}

export function publicError(error: unknown) {
  const safe =
    error instanceof CentaurError
      ? error
      : new CentaurError(500, 'INTERNAL_ERROR', 'The starter could not complete this request.')
  return {
    status: safe.status,
    body: {
      error: {
        code: safe.code,
        message: safe.message,
        requestId: safe.requestId,
        retryAfter: safe.retryAfter,
      },
    },
    headers: {
      'Cache-Control': 'no-store',
      ...(safe.retryAfter ? { 'Retry-After': safe.retryAfter } : {}),
    },
  }
}
