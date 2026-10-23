'use client'

import { useActionState, useEffect, useState } from 'react'
import type { Asset, FeedData, FeedItem } from '../lib/centaur'
import { safeUrl, type DataMode } from '../lib/presentation'
import { sourceText } from '../lib/source-text'

type Failure = { message: string; requestId?: string; retryAfter?: string }
type State = { status: 'loading' | 'ready' | 'error'; data?: FeedData; error?: Failure }
type Search = { query: string; results?: Asset[]; error?: Failure }

function failure(body: { error?: Partial<Failure> } | null, fallback: string): Failure {
  return {
    message: typeof body?.error?.message === 'string' ? body.error.message : fallback,
    requestId: body?.error?.requestId,
    retryAfter: body?.error?.retryAfter,
  }
}

function FailureDetails({ error }: { error: Failure }) {
  return (
    <>
      <p>{error.message}</p>
      {error.retryAfter && <p>Retry after: {error.retryAfter}</p>}
      {error.requestId && <p>Request ID: {error.requestId}</p>}
    </>
  )
}

function Photo({ url, index, sample }: { url: string; index: number; sample: boolean }) {
  const [failed, setFailed] = useState(false)
  const safe = safeUrl(url, sample)
  if (!safe || failed) return <p className="media-fallback">Image {index + 1} unavailable.</p>
  return (
    <img
      src={safe}
      alt={sample ? `Fictional illustration ${index + 1}` : `Source photo ${index + 1}`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  )
}

function Card({ item, sample }: { item: FeedItem; sample: boolean }) {
  const sourceUrl = safeUrl(item.source.url)
  const photos = item.source.attachments.filter((attachment) =>
    ['photo', 'image'].includes(attachment.type.toLowerCase()),
  )
  return (
    <article className="feed-card">
      <header>
        <h2>{item.trader.name}</h2>
        <span>{item.source.platform === 'X' ? 'X' : 'Telegram'}</span>
        <time dateTime={item.writtenAt}>
          {new Intl.DateTimeFormat('en', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'UTC',
          }).format(new Date(item.writtenAt))}{' '}
          UTC
        </time>
      </header>
      <p className="source-text">
        {(item.source.text && sourceText(item.source.text)) || 'Source text is unavailable.'}
      </p>
      <ul className="actions">
        {item.events.map((event) => (
          <li key={event.id}>
            <strong>{event.asset.symbol}</strong>
            <span>
              {
                { open: 'Opened', close: 'Closed', increase: 'Increased', decrease: 'Reduced' }[
                  event.type
                ]
              }{' '}
              {event.direction}
            </span>
            <span>
              {event.price === null
                ? 'Price unavailable'
                : `${new Intl.NumberFormat('en', { maximumFractionDigits: 8 }).format(event.price)}${event.quoteSymbol ? ` ${event.quoteSymbol}` : ''}`}
            </span>
            {event.retrospective && <span className="annotation">Retrospective</span>}
          </li>
        ))}
      </ul>
      {photos.length > 0 && (
        <div className="media">
          {photos.map((photo, index) => (
            <Photo key={`${photo.url}:${index}`} url={photo.url} index={index} sample={sample} />
          ))}
        </div>
      )}
      {sourceUrl && (
        <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
          Read original post
        </a>
      )}
    </article>
  )
}

async function searchAssets(_previous: Search, form: FormData): Promise<Search> {
  const query = String(form.get('search') ?? '').trim()
  try {
    const response = await fetch(`/api/assets?search=${encodeURIComponent(query)}`, {
      cache: 'no-store',
    })
    const body = await response.json()
    if (!response.ok) return { query, error: failure(body, 'The starter could not search assets.') }
    if (!Array.isArray(body.data?.results)) throw new Error('Invalid assets')
    return { query, results: body.data.results as Asset[] }
  } catch {
    return { query, error: { message: 'The starter could not search assets. Try again.' } }
  }
}

function AssetSearch({
  selected,
  onSelect,
}: {
  selected?: Asset
  onSelect: (asset: Asset) => void
}) {
  const [search, action, pending] = useActionState(searchAssets, { query: '' })
  return (
    <>
      <form action={action} role="search" className="toolbar">
        <label htmlFor="asset-search">Asset</label>
        <input
          id="asset-search"
          name="search"
          type="search"
          defaultValue={search.query}
          placeholder="Search by name or symbol, such as bitcoin"
          maxLength={100}
          required
          autoComplete="off"
        />
        <button disabled={pending}>Search</button>
      </form>
      {search.error && (
        <div className="feed-state error" role="alert" aria-labelledby="search-error-title">
          <h2 id="search-error-title">Search unavailable</h2>
          <FailureDetails error={search.error} />
        </div>
      )}
      {search.results?.length === 0 && (
        <p className="search-state" role="status">
          No assets match “{search.query}”.
        </p>
      )}
      {!!search.results?.length && (
        <ul className="asset-results" aria-label="Matching assets">
          {search.results.map((asset) => (
            <li key={asset.id}>
              <button
                type="button"
                aria-pressed={selected?.id === asset.id}
                onClick={() => onSelect(asset)}
              >
                {asset.name} ({asset.symbol})
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export function Feed({ initialMode }: { initialMode: DataMode | 'unavailable' }) {
  const [mode, setMode] = useState(initialMode)
  const [asset, setAsset] = useState<Asset>()
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<State>({ status: 'loading' })
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch(`/api/feed${asset ? `?assetId=${asset.id}` : ''}`, {
          signal: controller.signal,
          cache: 'no-store',
        })
        const body = await response.json()
        if (controller.signal.aborted) return
        if (!response.ok) {
          setState({
            status: 'error',
            error: failure(body, 'The starter could not load the feed.'),
          })
          return
        }
        if (!Array.isArray(body.data?.results) || !['sample', 'live'].includes(body.mode))
          throw new Error('Invalid feed')
        setMode(body.mode)
        setState({ status: 'ready', data: body.data as FeedData })
      } catch {
        if (!controller.signal.aborted)
          setState({
            status: 'error',
            error: { message: 'The starter could not load the feed. Try Refresh again.' },
          })
      }
    }
    void load()
    return () => controller.abort()
  }, [asset, revision])

  function select(next?: Asset) {
    setState({ status: 'loading' })
    setAsset(next)
  }

  return (
    <>
      <div className={`mode mode-${mode}`}>
        <strong>
          {mode === 'sample'
            ? 'Sample data'
            : mode === 'live'
              ? 'Live API mode'
              : 'Configuration unavailable'}
        </strong>
        <span>
          {mode === 'sample'
            ? 'Fictional posts and illustrations. No Centaur API requests.'
            : mode === 'live'
              ? 'Search and Refresh make API requests. The API may return cached data.'
              : 'Check the server configuration.'}
        </span>
      </div>
      <AssetSearch selected={asset} onSelect={select} />
      <div className="selection">
        <p>
          Showing <strong>{asset ? `${asset.name} (${asset.symbol})` : 'all assets'}</strong>
        </p>
        {asset && (
          <button type="button" className="secondary" onClick={() => select(undefined)}>
            Show all assets
          </button>
        )}
        <button
          type="button"
          disabled={state.status === 'loading'}
          onClick={() => {
            setState({ status: 'loading' })
            setRevision((value) => value + 1)
          }}
        >
          Refresh
        </button>
      </div>
      <div aria-busy={state.status === 'loading'}>
        {state.status === 'loading' && (
          <p className="feed-state" role="status">
            Loading activity…
          </p>
        )}
        {state.status === 'error' && state.error && (
          <div className="feed-state error" role="alert" aria-labelledby="feed-error-title">
            <h2 id="feed-error-title">Feed unavailable</h2>
            <FailureDetails error={state.error} />
          </div>
        )}
        {state.status === 'ready' && state.data?.results.length === 0 && (
          <p className="feed-state" role="status">
            No activity for this selection. Choose another asset or try Refresh later.
          </p>
        )}
        {state.status === 'ready' &&
          state.data?.results.map((item) => (
            <Card key={item.id} item={item} sample={mode === 'sample'} />
          ))}
      </div>
    </>
  )
}
