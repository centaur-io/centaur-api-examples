import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFeed, MAX_RESPONSE_BYTES, REQUEST_TIMEOUT_MS } from '../lib/centaur/feed'
import { publicError, retryAfter } from '../lib/centaur/errors'
import { sampleFeed } from '../fixtures/feed'
import { handleFeed } from '../lib/server/feed-handler'
import { safeUrl } from '../lib/centaur/contracts'

const key = 'test-secret-do-not-expose'
const success = () => Response.json({ success: true, requestId: 'request-123', data: sampleFeed() })
afterEach(() => vi.restoreAllMocks())

describe('portable API request', () => {
  it('rejects overdue success even before the timeout callback runs', async () => {
    let clock = 0
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
      clock = REQUEST_TIMEOUT_MS + 1
      return success()
    })
    await expect(readFeed({ apiKey: key, fetcher })).rejects.toMatchObject({
      status: 504,
      code: 'UPSTREAM_TIMEOUT',
    })
  })

  it('fixes the destination, credentials, page size, cache and redirect policy', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(success())
    const data = await readFeed({ apiKey: key, assetId: 1, fetcher })
    expect(data.results[0].id).toBe('sample:alex:001')
    const [url, options] = fetcher.mock.calls[0]
    expect(String(url)).toBe('https://api.centaur.io/v2/feed?limit=20&assetIds=1')
    expect(options).toMatchObject({
      method: 'GET',
      headers: { 'x-api-key': key, Accept: 'application/json' },
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'manual',
    })
    expect(options?.signal).toBeInstanceOf(AbortSignal)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it.each([0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid asset %s without broadening',
    async (assetId) => {
      const fetcher = vi.fn<typeof fetch>()
      await expect(readFeed({ apiKey: key, assetId, fetcher })).rejects.toMatchObject({
        status: 400,
        code: 'INVALID_SELECTION',
      })
      expect(fetcher).not.toHaveBeenCalled()
    },
  )

  it.each([401, 403, 422, 429, 503])(
    'preserves HTTP %s with safe diagnostics and no retry',
    async (status) => {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        Response.json(
          {
            success: false,
            error: {
              code: status === 503 ? 'AUTH_SERVICE_UNAVAILABLE' : 'TEST_ERROR',
              message: `unsafe ${key}`,
            },
            requestId: 'request-123',
          },
          { status, headers: { 'Retry-After': '30' } },
        ),
      )
      const error = await readFeed({ apiKey: key, fetcher }).catch((value) => value)
      expect(error).toMatchObject({ status, requestId: 'request-123', retryAfter: '30' })
      expect(JSON.stringify(publicError(error))).not.toContain(key)
      if (status === 503) expect(error.message).toContain('temporarily unavailable')
      expect(fetcher).toHaveBeenCalledTimes(1)
    },
  )

  it('retains a non-JSON outage as temporary failure', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response('<html>unavailable</html>', { status: 503, headers: { 'Retry-After': '60' } }),
      )
    await expect(readFeed({ apiKey: key, fetcher })).rejects.toMatchObject({
      status: 503,
      retryAfter: '60',
    })
  })

  it('does not follow redirects or return reflected credentials', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(null, { status: 307, headers: { Location: 'https://untrusted.example' } }),
      )
    await expect(readFeed({ apiKey: key, fetcher })).rejects.toMatchObject({
      code: 'UPSTREAM_REDIRECT',
    })
    expect(fetcher).toHaveBeenCalledTimes(1)
    fetcher.mockResolvedValue(
      Response.json({ success: false, error: { code: key }, requestId: key }, { status: 401 }),
    )
    const error = await readFeed({ apiKey: key, fetcher }).catch((value) => value)
    expect(JSON.stringify(publicError(error))).not.toContain(key)
  })

  it('rejects invalid JSON, invalid DTOs and more than20 groups instead of returning empty data', async () => {
    for (const body of [
      'broken-json',
      JSON.stringify({ success: true, data: { results: [] } }),
      JSON.stringify({
        success: true,
        requestId: 'a',
        data: { ...sampleFeed(), results: Array(21).fill(sampleFeed().results[0]) },
      }),
    ]) {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(body, { headers: { 'Content-Type': 'application/json' } }))
      await expect(readFeed({ apiKey: key, fetcher })).rejects.toMatchObject({
        status: 502,
        code: 'INVALID_RESPONSE',
      })
    }
  })

  it('returns a valid empty feed and discards unconsumed fields', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        success: true,
        requestId: 'a',
        extra: key,
        data: { ...sampleFeed(900003), extra: key },
      }),
    )
    const result = await readFeed({ apiKey: key, fetcher })
    expect(result.results).toEqual([])
    expect(JSON.stringify(result)).not.toContain(key)
  })

  it('bounds response bytes even without Content-Length and cancels the stream', async () => {
    const cancel = vi.fn()
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_RESPONSE_BYTES + 1))
      },
      cancel,
    })
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(body, { headers: { 'Content-Type': 'application/json' } }))
    await expect(readFeed({ apiKey: key, fetcher })).rejects.toMatchObject({
      code: 'RESPONSE_TOO_LARGE',
    })
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('distinguishes deadline, cancellation and network errors without leaking diagnostics', async () => {
    const deadline = new AbortController()
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal)
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async (_input, init) =>
          new Promise((_resolve, reject) =>
            init?.signal?.addEventListener('abort', () => reject(new Error(key)), { once: true }),
          ),
      )
    const pending = readFeed({ apiKey: key, fetcher })
    deadline.abort()
    await expect(pending).rejects.toMatchObject({ status: 504, code: 'UPSTREAM_TIMEOUT' })
    expect(timeout).toHaveBeenCalledWith(REQUEST_TIMEOUT_MS)
    timeout.mockRestore()
    const abort = new AbortController()
    const cancelled = readFeed({ apiKey: key, signal: abort.signal, fetcher })
    abort.abort()
    await expect(cancelled).rejects.toMatchObject({ code: 'CANCELLED' })
    fetcher.mockRejectedValue(new Error(`network failure with ${key}`))
    const error = await readFeed({ apiKey: key, fetcher }).catch((value) => value)
    expect(error.code).toBe('NETWORK_ERROR')
    expect(JSON.stringify(publicError(error))).not.toContain(key)
  })
})

describe('starter route boundary', () => {
  it.each([
    'asset=',
    'asset=unknown',
    'asset=btc&asset=eth',
    'asset=1',
    'url=https://untrusted.example',
    'key=visitor',
    'cursor=any',
  ])('rejects %s before upstream configuration or calls', async (query) => {
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

  it('serves deterministic samples without live calls even if a key exists', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const request = new Request('https://starter.example/api/feed?asset=btc')
    const config = () => ({ mode: 'sample' as const, apiKey: key })
    const a = await handleFeed(request, config, fetcher)
    const b = await handleFeed(request, config, fetcher)
    const body = await a.json()
    expect(body).toEqual(await b.json())
    expect(body.mode).toBe('sample')
    expect(
      body.data.results.every((item: { events: { assetId: number }[] }) =>
        item.events.every((event) => event.assetId === 900001),
      ),
    ).toBe(true)
    expect(a.headers.get('Cache-Control')).toBe('no-store')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('uses only configured live IDs and never visitor credentials', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(success())
    const request = new Request('https://starter.example/api/feed?asset=eth', {
      headers: { 'x-api-key': 'visitor-key', Authorization: 'Bearer visitor' },
    })
    const response = await handleFeed(request, () => ({ mode: 'live', apiKey: key }), fetcher)
    expect((await response.json()).mode).toBe('live')
    expect(String(fetcher.mock.calls[0][0])).toContain('assetIds=10')
    expect(fetcher.mock.calls[0][1]?.headers).toEqual({
      'x-api-key': key,
      Accept: 'application/json',
    })
  })

  it('never substitutes samples for missing live credentials', async () => {
    const response = await handleFeed(new Request('https://starter.example/api/feed'), () => ({
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
