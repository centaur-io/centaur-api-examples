import { feedEnvelopeSchema } from './contracts'
import { CentaurError, retryAfter, statusMessage } from './errors'

export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
export const REQUEST_TIMEOUT_MS = 10_000

async function readBoundedJson(response: Response) {
  const oversized = () =>
    new CentaurError(
      502,
      'RESPONSE_TOO_LARGE',
      'Centaur returned more data than this example accepts.',
    )
  if (Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES) {
    await response.body?.cancel()
    throw oversized()
  }
  if (
    !response.body ||
    !/^application\/json(?:;|$)/i.test(response.headers.get('content-type') ?? '')
  ) {
    await response.body?.cancel()
    throw new CentaurError(502, 'INVALID_RESPONSE', 'Centaur returned an unreadable response.')
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel()
        throw oversized()
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch {
    throw new CentaurError(502, 'INVALID_RESPONSE', 'Centaur returned invalid JSON.')
  }
}

export async function readFeed({
  apiKey,
  assetId,
  signal,
  fetcher = fetch,
}: {
  apiKey: string
  assetId?: number
  signal?: AbortSignal
  fetcher?: typeof fetch
}) {
  if (!apiKey.trim())
    throw new CentaurError(
      500,
      'CONFIGURATION_ERROR',
      'Set a server-side Centaur API key to use live mode.',
    )
  if (assetId !== undefined && (!Number.isSafeInteger(assetId) || assetId <= 0))
    throw new CentaurError(
      400,
      'INVALID_SELECTION',
      'Choose a configured asset or the general feed.',
    )
  const url = new URL('https://api.centaur.io/v2/feed')
  url.searchParams.set('limit', '20')
  if (assetId !== undefined) url.searchParams.set('assetIds', String(assetId))
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const deadline = performance.now() + REQUEST_TIMEOUT_MS
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout
  const checkDeadline = () => {
    if (signal?.aborted) throw new CentaurError(499, 'CANCELLED', 'The request was cancelled.')
    if (timeout.aborted || performance.now() >= deadline)
      throw new CentaurError(
        504,
        'UPSTREAM_TIMEOUT',
        'Centaur took too long to respond. Try Refresh later.',
      )
  }
  try {
    checkDeadline()
    const response = await fetcher(url, {
      method: 'GET',
      headers: { 'x-api-key': apiKey, Accept: 'application/json' },
      signal: requestSignal,
      redirect: 'manual',
      credentials: 'omit',
      cache: 'no-store',
    })
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel()
      throw new CentaurError(502, 'UPSTREAM_REDIRECT', 'Centaur returned an unexpected redirect.')
    }
    let body: unknown
    try {
      body = await readBoundedJson(response)
    } catch (error) {
      // A proxy can return a non-JSON outage page. Its HTTP status still carries retry meaning.
      if (response.ok || !(error instanceof CentaurError)) throw error
      throw new CentaurError(
        response.status,
        'UPSTREAM_ERROR',
        statusMessage(response.status),
        undefined,
        retryAfter(response.headers.get('retry-after')),
      )
    }
    checkDeadline()
    if (!response.ok) {
      const envelope = body as { error?: { code?: unknown }; requestId?: unknown } | null
      const code = envelope?.error?.code
      const requestId = envelope?.requestId
      const safeCode =
        typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(code) && !code.includes(apiKey)
          ? code
          : 'UPSTREAM_ERROR'
      const safeId =
        typeof requestId === 'string' &&
        /^[a-zA-Z0-9_-]{1,128}$/.test(requestId) &&
        !requestId.includes(apiKey)
          ? requestId
          : undefined
      throw new CentaurError(
        response.status,
        safeCode,
        statusMessage(response.status),
        safeId,
        retryAfter(response.headers.get('retry-after')),
      )
    }
    const result = feedEnvelopeSchema.safeParse(body)
    if (!result.success)
      throw new CentaurError(
        502,
        'INVALID_RESPONSE',
        'Centaur returned an unsupported feed response.',
      )
    checkDeadline()
    return result.data.data
  } catch (error) {
    if (error instanceof CentaurError) throw error
    checkDeadline()
    throw new CentaurError(
      502,
      'NETWORK_ERROR',
      'The starter could not reach Centaur. Try Refresh later.',
    )
  }
}
