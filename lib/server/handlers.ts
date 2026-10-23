import { createCentaurClient } from '../centaur'
import { CentaurError, publicError } from './errors'
import { sampleAssetSearch, sampleFeed } from '../../fixtures/feed'
import type { DataMode } from '../presentation'

// Web-standard adapters. Inject configuration here so this boundary is testable without Next.
type Configure = () => { mode: DataMode; apiKey?: string }

async function respond(read: () => Promise<{ mode: DataMode; data: unknown }>) {
  try {
    return Response.json(await read(), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error(error)
    const safe = publicError(error)
    return Response.json(safe.body, { status: safe.status, headers: safe.headers })
  }
}

/** Accepts only the named query parameter, at most once. */
function readParam(request: Request, name: string) {
  const params = new URL(request.url).searchParams
  if ([...params.keys()].some((key) => key !== name) || params.getAll(name).length > 1)
    throw new CentaurError(400, 'INVALID_SELECTION', `Supply only one ${name} value.`)
  return params.get(name)
}

function readConfig(configure: Configure, fetcher?: typeof fetch) {
  const { mode, apiKey } = configure()
  if (mode === 'sample') return { mode, client: undefined }
  if (!apiKey)
    throw new CentaurError(
      500,
      'CONFIGURATION_ERROR',
      'Set CENTAUR_API_KEY in .env.local to use live mode.',
    )
  return { mode, client: createCentaurClient({ apiKey, fetcher }) }
}

/** GET /api/feed, optionally filtered by one asset ID chosen through asset search. */
export function handleFeed(request: Request, configure: Configure, fetcher?: typeof fetch) {
  return respond(async () => {
    const value = readParam(request, 'assetId')
    if (value !== null && !/^[1-9]\d{0,9}$/.test(value))
      throw new CentaurError(
        400,
        'INVALID_SELECTION',
        'Choose an asset from search or the general feed.',
      )
    const assetId = value === null ? undefined : Number(value)
    const { mode, client } = readConfig(configure, fetcher)
    const data = client
      ? await client.feed({ assetIds: assetId ? [assetId] : undefined, limit: 20 }, request.signal)
      : sampleFeed(assetId)
    return { mode, data }
  })
}

/** GET /api/assets?search=, the asset picker's lookup through GET /v2/assets. */
export function handleAssets(request: Request, configure: Configure, fetcher?: typeof fetch) {
  return respond(async () => {
    const search = readParam(request, 'search')?.trim() ?? ''
    if (!search || search.length > 100)
      throw new CentaurError(400, 'INVALID_SEARCH', 'Search with 1 to 100 characters.')
    const { mode, client } = readConfig(configure, fetcher)
    const data = client
      ? await client.findAssets(search, request.signal)
      : sampleAssetSearch(search)
    return { mode, data }
  })
}
