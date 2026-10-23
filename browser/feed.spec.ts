import { expect, test, type Page } from '@playwright/test'
import { sampleFeed } from '../fixtures/feed'

async function searchAssets(page: Page, term: string) {
  await page.getByRole('searchbox', { name: 'Asset', exact: true }).fill(term)
  await page.getByRole('button', { name: 'Search', exact: true }).click()
}

test('actual sample routes search, filter and refresh without browser credentials or live requests', async ({
  page,
}) => {
  const calls: string[] = []
  const external: string[] = []
  const errors: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/')) {
      calls.push(new URL(request.url()).pathname)
      expect(request.headers()['x-api-key']).toBeUndefined()
    }
    if (request.url().startsWith('https://api.centaur.io')) external.push(request.url())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByText('Sample data', { exact: true })).toBeVisible()
  await expect(page.locator('article')).toHaveCount(5)
  expect(calls).toEqual(['/api/feed'])
  await expect(page.getByAltText('Fictional illustration 1')).toBeVisible()
  await expect(page.getByAltText('Fictional illustration 2')).toBeVisible()
  await expect(
    page.getByText('Sample post: ETH short, taking half off & keeping a stop < 3,400.', {
      exact: true,
    }),
  ).toBeVisible()
  await expect(page.getByText('Inferred', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Retrospective', { exact: true })).toHaveCount(1)
  await expect(page.getByText('Source text is unavailable.', { exact: true })).toHaveCount(1)

  await searchAssets(page, 'sol')
  await page.getByRole('button', { name: 'Solana (SOL)', exact: true }).click()
  await expect(page.locator('article')).toHaveCount(1)
  await expect(page.getByText('Price unavailable', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Solana (SOL)', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Show all assets', exact: true }).click()
  await expect(page.locator('article')).toHaveCount(5)
  expect(calls).toEqual(['/api/feed', '/api/assets', '/api/feed', '/api/feed', '/api/feed'])
  expect(external).toEqual([])
  expect(errors).toEqual([])
  expect(await page.content()).not.toContain('sample-mode-key-sentinel')
})

test('asset search keeps the API order and filters the feed by the chosen ID', async ({ page }) => {
  const results = [
    { id: 1, name: 'Bitcoin', symbol: 'BTC', slug: 'crypto-btc' },
    { id: 7, name: 'Bitcoin Cash', symbol: 'BCH', slug: 'crypto-bch' },
    { id: 9, name: 'Wrapped Bitcoin', symbol: 'WBTC', slug: 'crypto-wbtc' },
  ].map((asset) => ({ ...asset, assetClass: 'crypto', resolvedAssetClass: 'crypto' }))
  const feeds: string[] = []
  await page.route('**/api/assets?*', async (route) => {
    const search = new URL(route.request().url()).searchParams.get('search')
    if (search === 'unavailable')
      await route.fulfill({
        status: 429,
        json: { error: { message: 'The API allowance is exhausted.', retryAfter: '30' } },
      })
    else
      await route.fulfill({
        json: { mode: 'live', data: { results: search === 'bitcoin' ? results : [] } },
      })
  })
  await page.route('**/api/feed*', async (route) => {
    feeds.push(new URL(route.request().url()).search)
    await route.fulfill({ json: { mode: 'live', data: sampleFeed(900009) } })
  })
  await page.goto('/')
  await searchAssets(page, 'bitcoin')
  await expect(page.getByRole('list', { name: 'Matching assets' }).getByRole('button')).toHaveText([
    'Bitcoin (BTC)',
    'Bitcoin Cash (BCH)',
    'Wrapped Bitcoin (WBTC)',
  ])
  await expect(page.getByRole('searchbox', { name: 'Asset', exact: true })).toHaveValue('bitcoin')
  await page.getByRole('button', { name: 'Bitcoin (BTC)', exact: true }).click()
  await expect(page.getByText('Showing Bitcoin (BTC)', { exact: true })).toBeVisible()
  await expect(page.getByText('No activity for this selection.', { exact: false })).toBeVisible()
  expect(feeds).toEqual(['', '?assetId=1'])
  await searchAssets(page, 'nothing')
  await expect(page.getByText('No assets match “nothing”.', { exact: true })).toBeVisible()
  await searchAssets(page, 'unavailable')
  await expect(page.getByRole('alert', { name: 'Search unavailable', exact: true })).toContainText(
    'Retry after: 30',
  )
})

test('rapid selection changes clear old content and ignore a late response', async ({ page }) => {
  let release: (() => void) | undefined
  const delayed = new Promise<void>((resolve) => {
    release = resolve
  })
  let requested: (() => void) | undefined
  const requestSeen = new Promise<void>((resolve) => {
    requested = resolve
  })
  await page.route('**/api/feed?assetId=900001', async (route) => {
    requested?.()
    await delayed
    await route.fulfill({ json: { mode: 'sample', data: sampleFeed(900001) } }).catch(() => {})
  })
  await page.goto('/')
  await expect(page.locator('article')).toHaveCount(5)
  await searchAssets(page, 'o')
  await page.getByRole('button', { name: 'Bitcoin (BTC)', exact: true }).click()
  await requestSeen
  await expect(page.locator('article')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Solana (SOL)', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Sample trader Sam' })).toBeVisible()
  release?.()
  await expect(page.locator('article')).toHaveCount(1)
  await expect(page.getByRole('heading', { name: 'Sample trader Alex' })).toHaveCount(0)
})

test('empty and unavailable responses have different states, with manual recovery', async ({
  page,
}) => {
  let outcome = 'empty'
  await page.route('**/api/feed', async (route) => {
    if (outcome === 'empty')
      await route.fulfill({ json: { mode: 'sample', data: sampleFeed(900009) } })
    else if (outcome === 'error')
      await route.fulfill({
        status: 503,
        json: {
          error: {
            code: 'AUTH_SERVICE_UNAVAILABLE',
            message: 'Centaur is temporarily unavailable. Try Refresh later.',
            requestId: 'safe-request-1',
            retryAfter: '30',
          },
        },
      })
    else await route.continue()
  })
  await page.goto('/')
  await expect(page.getByText('No activity for this selection.', { exact: false })).toBeVisible()
  outcome = 'error'
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('alert', { name: 'Feed unavailable', exact: true })).toContainText(
    'temporarily unavailable',
  )
  await expect(page.getByRole('alert', { name: 'Feed unavailable', exact: true })).toContainText(
    'safe-request-1',
  )
  await expect(page.locator('article')).toHaveCount(0)
  outcome = 'success'
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.locator('article')).toHaveCount(5)
})

test('live mode without a key stays live and shows configuration guidance', async ({ page }) => {
  await page.goto('http://localhost:3043')
  await expect(page.getByText('Live API mode', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert', { name: 'Feed unavailable', exact: true })).toContainText(
    'CENTAUR_API_KEY in .env.local',
  )
  await expect(page.locator('article')).toHaveCount(0)
  await expect(page.getByText('Sample data', { exact: true })).toHaveCount(0)
  await searchAssets(page, 'bitcoin')
  await expect(page.getByRole('alert', { name: 'Search unavailable', exact: true })).toContainText(
    'CENTAUR_API_KEY in .env.local',
  )
  await expect(page.getByRole('list', { name: 'Matching assets' })).toHaveCount(0)
})

test('mobile layout, plain source text and failed media remain usable', async ({ page }) => {
  const data = sampleFeed()
  data.results[0].source.text = '<script>alert("unsafe")</script><img src=x onerror=alert(1)>'
  data.results[0].source.url = 'javascript:alert(1)'
  await page.route('**/api/feed', (route) => route.fulfill({ json: { mode: 'sample', data } }))
  await page.route('**/samples/btc-levels.svg', (route) => route.abort())
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByText('alert("unsafe")', { exact: true })).toBeVisible()
  expect(await page.locator('article script, article img[src="x"]').count()).toBe(0)
  await expect(page.getByText('Image 1 unavailable.', { exact: true })).toBeVisible()
  await expect(page.getByAltText('Fictional illustration 2')).toBeVisible()
  expect(await page.locator('a[href^="javascript:"]').count()).toBe(0)
  await searchAssets(page, 'o')
  await expect(page.getByRole('button', { name: 'Solana (SOL)', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
})
