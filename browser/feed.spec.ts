import { expect, test } from '@playwright/test'
import { sampleFeed } from '../fixtures/feed'

test('actual sample route filters and refreshes once without browser credentials or live requests', async ({
  page,
}) => {
  const calls: string[] = []
  const external: string[] = []
  const errors: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/feed')) {
      calls.push(request.url())
      expect(request.headers()['x-api-key']).toBeUndefined()
    }
    if (request.url().startsWith('https://api.centaur.io')) external.push(request.url())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByText('Sample data', { exact: true })).toBeVisible()
  await expect(page.locator('article')).toHaveCount(3)
  expect(calls).toHaveLength(1)
  await expect(page.getByAltText('Fictional illustration 1')).toBeVisible()
  await expect(page.getByAltText('Fictional illustration 2')).toBeVisible()
  await page.getByRole('combobox', { name: 'Asset', exact: true }).selectOption('eth')
  await expect(page.locator('article')).toHaveCount(1)
  await expect(page.getByText('Price unavailable', { exact: true })).toBeVisible()
  expect(calls).toHaveLength(2)
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled()
  expect(calls).toHaveLength(3)
  expect(external).toEqual([])
  expect(errors).toEqual([])
  expect(await page.content()).not.toContain('sample-mode-key-sentinel')
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
  await page.route('**/api/feed?asset=btc', async (route) => {
    requested?.()
    await delayed
    await route.fulfill({ json: { mode: 'sample', data: sampleFeed(900001) } }).catch(() => {})
  })
  await page.goto('/')
  await expect(page.locator('article')).toHaveCount(3)
  await page.getByRole('combobox', { name: 'Asset', exact: true }).selectOption('btc')
  await requestSeen
  await expect(page.locator('article')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeDisabled()
  await page.getByRole('combobox', { name: 'Asset', exact: true }).selectOption('eth')
  await expect(page.getByRole('heading', { name: 'Sample trader Maya' })).toBeVisible()
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
      await route.fulfill({ json: { mode: 'sample', data: sampleFeed(900003) } })
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
  await expect(page.locator('article')).toHaveCount(3)
})

test('live mode without a key stays live and shows configuration guidance', async ({ page }) => {
  await page.goto('http://localhost:3043')
  await expect(page.getByText('Live API mode', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert', { name: 'Feed unavailable', exact: true })).toContainText(
    'CENTAUR_API_KEY in .env.local',
  )
  await expect(page.locator('article')).toHaveCount(0)
  await expect(page.getByText('Sample data', { exact: true })).toHaveCount(0)
})

test('mobile layout, escaped text and failed media remain usable', async ({ page }) => {
  const data = sampleFeed()
  data.results[0].source.text = '<script>alert("unsafe")</script>'
  data.results[0].source.url = 'javascript:alert(1)'
  await page.route('**/api/feed', (route) => route.fulfill({ json: { mode: 'sample', data } }))
  await page.route('**/samples/btc-levels.svg', (route) => route.abort())
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByText('<script>alert("unsafe")</script>', { exact: true })).toBeVisible()
  await expect(page.getByText('Image 1 unavailable.', { exact: true })).toBeVisible()
  await expect(page.getByAltText('Fictional illustration 2')).toBeVisible()
  expect(await page.locator('a[href^="javascript:"]').count()).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
})
