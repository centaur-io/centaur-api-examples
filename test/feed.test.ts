import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCentaurClient } from '../lib/centaur'
import { publicError, retryAfter } from '../lib/server/errors'
import { sampleFeed } from '../fixtures/feed'
import { handleAssets, handleFeed } from '../lib/server/handlers'
import { safeUrl } from '../lib/presentation'

const key = 'test-secret-do-not-expose'
const success = () => Response.json({ success: true, requestId: 'request-123', data: sampleFeed() })
beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
afterEach(() => vi.restoreAllMocks())

it('serializes filters and preserves the API pagination fields', async () => {
  const data = {
    ...sampleFeed(),
    meta: { hasMore: true, nextCursor: 'opaque&cursor', serverTime: '2026-01-15T12:00:00Z' },
  }
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ success: true, data }))
  const client = createCentaurClient({ apiKey: key, fetcher })
  expect(
    await client.feed({
      assetIds: [1, 10],
      traderIds: [42],
      assetClass: ['crypto'],
      cursor: 'opaque&cursor',
    }),
  ).toEqual(data)
  const [input, options] = fetcher.mock.calls[0]
  const url = new URL(String(input))
  expect(url.searchParams.get('assetIds')).toBe('1,10')
  expect(url.searchParams.get('cursor')).toBe('opaque&cursor')
  expect(url.searchParams.get('assetClass')).toBe('crypto')
  expect(options).toMatchObject({
    headers: { 'x-api-key': key },
    redirect: 'error',
    credentials: 'omit',
  })
})

it.each([{ assetIds: [] }, { traderIds: [] }, { assetClass: [] }])(
  'does not broaden explicit empty filters %j',
  async (query) => {
    const fetcher = vi.fn<typeof fetch>()
    await expect(createCentaurClient({ apiKey: key, fetcher }).feed(query)).rejects.toThrow(
      'must not be empty',
    )
    expect(fetcher).not.toHaveBeenCalled()
  },
)

it.each([401, 403, 422, 429, 503])(
  'keeps HTTP %s diagnostics server-side without automatic retry',
  async (status) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(
        {
          success: false,
          error: { code: 'TEST_ERROR', message: `unsafe ${key}` },
          requestId: 'request-123',
        },
        { status, headers: { 'retry-after': '30' } },
      ),
    )
    const error = await createCentaurClient({ apiKey: key, fetcher })
      .feed()
      .catch((error) => error)
    expect(error).toMatchObject({
      status,
      code: 'TEST_ERROR',
      requestId: 'request-123',
      retryAfter: '30',
    })
    expect(JSON.stringify(publicError(error))).not.toContain(key)
    expect(fetcher).toHaveBeenCalledTimes(1)
  },
)

it('uses a standard timeout and preserves native network/cancellation errors', async () => {
  const timeout = vi.spyOn(AbortSignal, 'timeout')
  const error = new DOMException('Timed out', 'TimeoutError')
  const fetcher = vi.fn<typeof fetch>().mockRejectedValue(error)
  await expect(createCentaurClient({ apiKey: key, fetcher }).feed()).rejects.toBe(error)
  expect(timeout).toHaveBeenCalledWith(10000)
  const abort = new AbortController()
  abort.abort()
  fetcher.mockImplementation(async (_, options) => {
    options?.signal?.throwIfAborted()
    return success()
  })
  await expect(
    createCentaurClient({ apiKey: key, fetcher }).feed({}, abort.signal),
  ).rejects.toMatchObject({ name: 'AbortError' })
})

it('reports a non-JSON outage without replacing it with samples', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response('unavailable', { status: 503 }))
  const response = await handleFeed(
    new Request('https://starter.example/api/feed'),
    () => ({ mode: 'live', apiKey: key }),
    fetcher,
  )
  expect(response.status).toBe(503)
  expect(await response.json()).not.toHaveProperty('data')
})

describe('starter route boundary', () => {
  it.each([
    'assetId=',
    'assetId=0',
    'assetId=-1',
    'assetId=1.5',
    'assetId=01',
    'assetId=12345678901',
    'assetId=btc',
    'assetId=1&assetId=10',
    'asset=btc',
    'url=https://untrusted.example',
    'key=visitor',
    'cursor=any',
  ])('rejects feed query %s before upstream configuration or calls', async (query) => {
    const configure = vi.fn(() => ({ mode: 'live' as const, apiKey: key }))
    const fetcher = vi.fn<typeof fetch>()
    const response = await handleFeed(
      new Request(`https://starter.example/api/feed?${query}`),
      configure,
      fetcher,
    )
    expect(response.status).toBe(400)
    expect(configure).not.toHaveBeenCalled()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it.each([
    '',
    'search=',
    'search=%20%20',
    `search=${'a'.repeat(101)}`,
    'search=a&search=b',
    'search=a&limit=50',
  ])('rejects asset search %j before upstream configuration or calls', async (query) => {
    const configure = vi.fn(() => ({ mode: 'live' as const, apiKey: key }))
    const fetcher = vi.fn<typeof fetch>()
    const response = await handleAssets(
      new Request(`https://starter.example/api/assets?${query}`),
      configure,
      fetcher,
    )
    expect(response.status).toBe(400)
    expect(configure).not.toHaveBeenCalled()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('serves deterministic samples without live calls even if a key exists', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const request = new Request('https://starter.example/api/feed?assetId=900001')
    const config = () => ({ mode: 'sample' as const, apiKey: key })
    const a = await handleFeed(request, config, fetcher)
    const b = await handleFeed(request, config, fetcher)
    const body = await a.json()
    expect(body).toEqual(await b.json())
    expect(body.mode).toBe('sample')
    expect(body.data.results).toHaveLength(2)
    expect(
      body.data.results.every((item: { events: { assetId: number }[] }) =>
        item.events.every((event) => event.assetId === 900001),
      ),
    ).toBe(true)
    expect(a.headers.get('Cache-Control')).toBe('no-store')
    const search = await handleAssets(
      new Request('https://starter.example/api/assets?search=%20sol%20'),
      config,
      fetcher,
    )
    expect((await search.json()).data.results.map((asset: { id: number }) => asset.id)).toEqual([
      900003,
    ])
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('passes the chosen asset ID and search to the API with only the server key', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => success())
    const headers = { 'x-api-key': 'visitor-key', Authorization: 'Bearer visitor' }
    const live = () => ({ mode: 'live' as const, apiKey: key })
    const feed = await handleFeed(
      new Request('https://starter.example/api/feed?assetId=10', { headers }),
      live,
      fetcher,
    )
    expect((await feed.json()).mode).toBe('live')
    await handleAssets(
      new Request('https://starter.example/api/assets?search=Bitcoin%20Cash', { headers }),
      live,
      fetcher,
    )
    const [feedUrl, searchUrl] = fetcher.mock.calls.map(([input]) => new URL(String(input)))
    expect(Object.fromEntries(feedUrl.searchParams)).toEqual({ assetIds: '10', limit: '20' })
    expect(searchUrl.pathname).toBe('/v2/assets')
    expect(Object.fromEntries(searchUrl.searchParams)).toEqual({
      search: 'Bitcoin Cash',
      limit: '20',
    })
    for (const [, options] of fetcher.mock.calls)
      expect(options?.headers).toEqual({ 'x-api-key': key, accept: 'application/json' })
  })

  it.each([
    [handleFeed, '/api/feed'],
    [handleAssets, '/api/assets?search=btc'],
  ])('never substitutes samples for missing live credentials', async (handle, path) => {
    const response = await handle(new Request(`https://starter.example${path}`), () => ({
      mode: 'live',
    }))
    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ error: { code: 'CONFIGURATION_ERROR' } })
  })
})

it('validates links and Retry-After without active content', () => {
  expect(safeUrl('javascript:alert(1)')).toBeUndefined()
  expect(safeUrl('https://user:pass@example.com')).toBeUndefined()
  expect(safeUrl('/samples/btc-plan.svg')).toBeUndefined()
  expect(safeUrl('/samples/btc-plan.svg', true)).toBe('/samples/btc-plan.svg')
  expect(retryAfter('30')).toBe('30')
  expect(retryAfter('Mon, 12 Oct 2026 16:00:00 GMT')).toBe('Mon, 12 Oct 2026 16:00:00 GMT')
  expect(retryAfter('retry tomorrow')).toBeUndefined()
})

it('preserves a native body-stream timeout after response headers arrive', async () => {
  const timeout = new DOMException('Body timed out', 'TimeoutError')
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(
      new ReadableStream({
        start(controller) {
          controller.error(timeout)
        },
      }),
    ),
  )
  await expect(createCentaurClient({ apiKey: key, fetcher }).feed()).rejects.toBe(timeout)
})

it('logs upstream diagnostics only on the server when the starter request fails', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Unrecognized key: assetClass' },
        requestId: 'upstream-123',
      },
      { status: 422 },
    ),
  )
  const response = await handleFeed(
    new Request('http://localhost/api/feed'),
    () => ({ mode: 'live', apiKey: key }),
    fetcher,
  )
  expect(console.error).toHaveBeenCalledWith(
    expect.objectContaining({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Unrecognized key: assetClass',
      requestId: 'upstream-123',
    }),
  )
  const body = await response.json()
  expect(body.error.requestId).toBe('upstream-123')
  expect(JSON.stringify(body)).not.toContain('Unrecognized key')
  expect(JSON.stringify(body)).not.toContain(key)
})
