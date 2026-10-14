import 'server-only'
import { CentaurError } from './errors'
import type { DataMode } from '../presentation'

export function readMode() {
  const mode = process.env.CENTAUR_DATA_MODE ?? 'sample'
  if (mode !== 'sample' && mode !== 'live')
    throw new CentaurError(500, 'CONFIGURATION_ERROR', 'Set CENTAUR_DATA_MODE to sample or live.')
  return mode
}

export function readConfig(): { mode: DataMode; apiKey?: string } {
  const mode = readMode()
  const apiKey = mode === 'live' ? process.env.CENTAUR_API_KEY?.trim() : undefined
  if (mode === 'live' && !apiKey)
    throw new CentaurError(
      500,
      'CONFIGURATION_ERROR',
      'Set CENTAUR_API_KEY in .env.local to use live mode.',
    )
  return { mode, apiKey }
}
