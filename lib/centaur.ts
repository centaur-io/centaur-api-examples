// Centaur API client. Copy this file into any server-side TypeScript project.
// Uses standard fetch. Tested with Node.js 24. Keep the API key on the server.

export type AssetClass = 'crypto' | 'stocks' | 'indices' | 'commodities' | 'fx'

export type FeedItem = {
  id: string
  writtenAt: string
  trader: { id: number; name: string }
  source: {
    platform: 'TELEGRAM' | 'X'
    url: string | null
    text: string | null
    attachments: { type: string; url: string }[]
  }
  events: {
    id: number
    type: 'open' | 'close' | 'increase' | 'decrease'
    direction: 'long' | 'short'
    price: number | null
    quoteSymbol: string | null
    assetId: number
    assumed: boolean
    retrospective: boolean
    asset: { id: number; name: string; symbol: string }
  }[]
}

export type Asset = {
  id: number
  name: string
  symbol: string
  slug: string | null
  resolvedAssetClass: AssetClass | 'other' // Use with the feed's assetClass filter, except 'other'.
}

export type Trader = { id: number; name: string; slug: string | null }

export type Page<T> = {
  results: T[]
  meta: { hasMore: boolean; nextCursor: string | null; serverTime: string; dataComputedAt?: string }
}

export type Positioning = {
  assetId: number
  openLongPositionsCount: number
  openShortPositionsCount: number
  totalOpenPositionsCount: number
  distinctHoldersCount: number
  longPercentage: number | null
  shortPercentage: number | null
  dataComputedAt: string
}
export type FeedData = Page<FeedItem>

export type FeedQuery = {
  assetIds?: number[]
  traderIds?: number[]
  assetClass?: AssetClass[]
  limit?: number
  cursor?: string
}

export class CentaurApiError extends Error {
  name = 'CentaurApiError'
  status: number
  code: string
  requestId?: string
  retryAfter?: string
  constructor(
    status: number,
    code: string,
    message: string,
    requestId?: string,
    retryAfter?: string,
  ) {
    super(message)
    this.status = status
    this.code = code
    this.requestId = requestId
    this.retryAfter = retryAfter
  }
}

export function createCentaurClient({
  apiKey,
  baseUrl = 'https://api.centaur.io',
  timeoutMs = 10_000,
  fetcher = fetch,
}: {
  apiKey: string
  baseUrl?: string
  timeoutMs?: number
  fetcher?: typeof fetch
}) {
  if (!apiKey) throw new Error('Pass a Centaur API key from your server configuration.')

  async function get<T>(path: string, params: object, signal?: AbortSignal): Promise<T> {
    const url = new URL(path, baseUrl)
    for (const [name, value] of Object.entries(params)) {
      if (value === undefined) continue
      // The API reads an empty list as "no filter". Fail instead of widening the request.
      if (Array.isArray(value) && value.length === 0) throw new Error(`${name} must not be empty.`)
      url.searchParams.set(name, String(value))
    }
    const timeout = AbortSignal.timeout(timeoutMs)
    const response = await fetcher(url, {
      headers: { 'x-api-key': apiKey, accept: 'application/json' },
      redirect: 'error',
      cache: 'no-store',
      credentials: 'omit',
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    })
    const body = await response.json().catch((error: unknown) => {
      if (error instanceof SyntaxError) return null
      throw error // Preserve timeouts, cancellation and response-stream failures.
    })
    if (!response.ok || body?.success !== true)
      throw new CentaurApiError(
        response.status,
        body?.error?.code ?? `HTTP_${response.status}`,
        body?.error?.message ?? `Centaur returned HTTP ${response.status}.`,
        body?.requestId,
        response.headers.get('retry-after') ?? undefined,
      )
    return body.data
  }

  return {
    positioning: (assetId: number, signal?: AbortSignal) =>
      get<{ results: Positioning[]; meta: { missingAssetIds: number[]; serverTime: string } }>(
        '/v2/assets/positioning',
        { assetIds: [assetId] },
        signal,
      ),
    /** Up to 20 newest source-message groups by default. Pass meta.nextCursor as cursor for older ones. */
    feed: (query: FeedQuery = {}, signal?: AbortSignal) =>
      get<Page<FeedItem>>('/v2/feed', query, signal),
    /** Candidates for a name or symbol. Pick the intended ID yourself; names can be ambiguous. */
    findAssets: (search: string, signal?: AbortSignal) =>
      get<Page<Asset>>('/v2/assets', { search, limit: 20 }, signal),
    findTraders: (search: string, signal?: AbortSignal) =>
      get<Page<Trader>>('/v2/traders', { search, limit: 20 }, signal),
  }
}
