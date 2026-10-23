import { CentaurApiError } from '../centaur'

export class CentaurError extends CentaurApiError {}

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
      return 'The integration owner must check account access and the required API permissions.'
    case 422:
      return 'Centaur rejected the selection. Check the requested identifiers.'
    case 429:
      return 'The API allowance is exhausted. Wait before trying again.'
    case 503:
      return 'Centaur is temporarily unavailable. Try again later.'
    default:
      return 'Centaur could not complete this request. Try again later.'
  }
}

export function publicError(error: unknown) {
  const safe =
    error instanceof CentaurError
      ? error
      : error instanceof CentaurApiError
        ? new CentaurError(
            error.status >= 400 && error.status <= 599 ? error.status : 502,
            'CENTAUR_API_ERROR',
            statusMessage(error.status),
            error.requestId,
            retryAfter(error.retryAfter ?? null),
          )
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
