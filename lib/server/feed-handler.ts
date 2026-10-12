import { readFeed } from '../centaur/feed'
import { CentaurError, publicError } from '../centaur/errors'
import { selections } from '../selections'
import { sampleFeed } from '../../fixtures/feed'
import type { DataMode } from '../centaur/contracts'

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
    const data =
      config.mode === 'sample'
        ? sampleFeed(selection?.sampleId)
        : await readFeed({
            apiKey: config.apiKey ?? '',
            assetId: selection?.liveId,
            signal: request.signal,
            fetcher,
          })
    return Response.json({ mode: config.mode, data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const safe = publicError(error)
    return Response.json(safe.body, { status: safe.status, headers: safe.headers })
  }
}
