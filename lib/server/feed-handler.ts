import { createCentaurClient } from '../centaur'
import { CentaurError, publicError } from './errors'
import { selections } from '../selections'
import { sampleFeed } from '../../fixtures/feed'
import type { DataMode } from '../presentation'

// Web-standard adapter. Inject configuration here so this boundary is testable without Next.
export async function handleFeed(
  request: Request,
  configure: () => { mode: DataMode; apiKey?: string },
  fetcher?: typeof fetch,
) {
  try {
    const params = new URL(request.url).searchParams
    if ([...params.keys()].some((key) => key !== 'asset') || params.getAll('asset').length > 1)
      throw new CentaurError(
        400,
        'INVALID_SELECTION',
        'Supply only one configured asset selection.',
      )
    const key = params.get('asset')
    const selection = key === null ? undefined : selections.find((entry) => entry.key === key)
    if (key !== null && !selection)
      throw new CentaurError(
        400,
        'INVALID_SELECTION',
        'Choose a configured asset or the general feed.',
      )
    const config = configure()
    if (config.mode === 'live' && !config.apiKey)
      throw new CentaurError(
        500,
        'CONFIGURATION_ERROR',
        'Set CENTAUR_API_KEY in .env.local to use live mode.',
      )
    const data =
      config.mode === 'sample'
        ? sampleFeed(selection?.sampleId)
        : await createCentaurClient({ apiKey: config.apiKey!, fetcher }).feed(
            { assetIds: selection ? [selection.liveId] : undefined, limit: 20 },
            request.signal,
          )
    return Response.json({ mode: config.mode, data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error(error)
    const safe = publicError(error)
    return Response.json(safe.body, { status: safe.status, headers: safe.headers })
  }
}
