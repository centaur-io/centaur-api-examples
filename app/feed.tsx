'use client'

import { useEffect, useState } from 'react'
import {
  feedDataSchema,
  safeUrl,
  type DataMode,
  type FeedData,
  type FeedItem,
} from '../lib/centaur/contracts'
import { selections } from '../lib/selections'

type Failure = { message: string; requestId?: string; retryAfter?: string }
type State = { status: 'loading' | 'ready' | 'error'; data?: FeedData; error?: Failure }

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
      <p className="source-text">{item.source.text ?? 'Source text is unavailable.'}</p>
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
            {event.assumed && <span className="annotation">Inferred</span>}
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

export function Feed({ initialMode }: { initialMode: DataMode | 'unavailable' }) {
  const [mode, setMode] = useState(initialMode)
  const [asset, setAsset] = useState('')
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<State>({ status: 'loading' })
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch(
          `/api/feed${asset ? `?asset=${encodeURIComponent(asset)}` : ''}`,
          { signal: controller.signal, cache: 'no-store' },
        )
        const body = await response.json()
        if (controller.signal.aborted) return
        if (!response.ok) {
          setState({
            status: 'error',
            error: {
              message:
                typeof body.error?.message === 'string'
                  ? body.error.message
                  : 'The starter could not load the feed.',
              requestId: body.error?.requestId,
              retryAfter: body.error?.retryAfter,
            },
          })
          return
        }
        const data = feedDataSchema.safeParse(body.data)
        if (!data.success || !['sample', 'live'].includes(body.mode))
          throw new Error('Invalid feed')
        setMode(body.mode)
        setState({ status: 'ready', data: data.data })
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
              ? 'Refresh makes an API request. The API may return cached data.'
              : 'Check the server configuration.'}
        </span>
      </div>
      <div className="toolbar">
        <label htmlFor="asset">Asset</label>
        <select
          id="asset"
          value={asset}
          onChange={(event) => {
            setState({ status: 'loading' })
            setAsset(event.target.value)
          }}
        >
          <option value="">All assets</option>
          {selections.map((entry) => (
            <option key={entry.key} value={entry.key}>
              {entry.label}
            </option>
          ))}
        </select>
        <button
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
        {state.status === 'error' && (
          <div className="feed-state error" role="alert" aria-labelledby="feed-error-title">
            <h2 id="feed-error-title">Feed unavailable</h2>
            <p>{state.error?.message}</p>
            {state.error?.retryAfter && <p>Retry after: {state.error.retryAfter}</p>}
            {state.error?.requestId && <p>Request ID: {state.error.requestId}</p>}
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
