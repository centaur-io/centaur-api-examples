import 'server-only'
import { CentaurError } from '../centaur/errors'
import type { DataMode } from '../centaur/contracts'

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
      'Set a server-side Centaur API key to use live mode.',
    )
  return { mode, apiKey }
}
