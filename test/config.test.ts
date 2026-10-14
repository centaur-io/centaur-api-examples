import { afterEach, expect, it, vi } from 'vitest'
// The production Next compiler enforces this boundary. These tests exercise its environment parser.
vi.mock('server-only', () => ({}))
import { readConfig } from '../lib/server/config'

afterEach(() => vi.unstubAllEnvs())
it('defaults to sample even when a key is present', () => {
  vi.stubEnv('CENTAUR_DATA_MODE', undefined)
  vi.stubEnv('CENTAUR_API_KEY', 'server-secret')
  expect(readConfig()).toEqual({ mode: 'sample', apiKey: undefined })
})
it('requires explicit live configuration and rejects unknown modes', () => {
  vi.stubEnv('CENTAUR_DATA_MODE', 'live')
  vi.stubEnv('CENTAUR_API_KEY', '')
  expect(readConfig).toThrow('Set CENTAUR_API_KEY in .env.local')
  vi.stubEnv('CENTAUR_API_KEY', 'server-secret')
  expect(readConfig()).toEqual({ mode: 'live', apiKey: 'server-secret' })
  vi.stubEnv('CENTAUR_DATA_MODE', 'typo')
  expect(readConfig).toThrow('Set CENTAUR_DATA_MODE to sample or live')
})
