import type { Asset, FeedData, FeedItem, Page } from '../lib/centaur'

// Original fictional material. These IDs never become live API filters.
export const sampleAssets: Asset[] = [
  {
    id: 900001,
    name: 'Bitcoin',
    symbol: 'BTC',
    slug: null,
    assetClass: 'crypto',
    resolvedAssetClass: 'crypto',
  },
  {
    id: 900002,
    name: 'Ethereum',
    symbol: 'ETH',
    slug: null,
    assetClass: 'crypto',
    resolvedAssetClass: 'crypto',
  },
  {
    id: 900003,
    name: 'Solana',
    symbol: 'SOL',
    slug: null,
    assetClass: 'crypto',
    resolvedAssetClass: 'crypto',
  },
]
const [btc, eth, sol] = sampleAssets.map(({ id, name, symbol }) => ({ id, name, symbol }))

// Each card shows one case a live feed can return.
const items: FeedItem[] = [
  {
    // Media beside a trading action.
    id: 'sample:alex:001',
    writtenAt: '2026-01-15T12:00:00.000Z',
    trader: { id: 900101, name: 'Sample trader Alex' },
    source: {
      platform: 'X',
      url: null,
      text: 'Sample post: opening a small BTC long after a retest. These illustrations show how media appears beside a trading action. They are not market data.',
      attachments: [
        { type: 'photo', url: '/samples/btc-levels.svg' },
        { type: 'photo', url: '/samples/btc-plan.svg' },
      ],
    },
    events: [
      {
        id: 910001,
        type: 'open',
        price: 95000,
        quoteSymbol: 'USD',
        direction: 'long',
        assumed: false,
        retrospective: false,
        assetId: btc.id,
        asset: btc,
      },
    ],
  },
  {
    // Telegram text arrives as a small HTML subset with escaped characters.
    id: 'sample:maya:002',
    writtenAt: '2026-01-15T11:30:00.000Z',
    trader: { id: 900102, name: 'Sample trader Maya' },
    source: {
      platform: 'TELEGRAM',
      url: null,
      text: 'Sample post: <b>ETH</b> short, taking half off &amp; keeping a stop &lt; 3,400.',
      attachments: [],
    },
    events: [
      {
        id: 910002,
        type: 'decrease',
        price: 3250,
        quoteSymbol: 'USD',
        direction: 'short',
        assumed: false,
        retrospective: false,
        assetId: eth.id,
        asset: eth,
      },
    ],
  },
  {
    // No price was extracted from the post.
    id: 'sample:sam:003',
    writtenAt: '2026-01-15T11:00:00.000Z',
    trader: { id: 900103, name: 'Sample trader Sam' },
    source: {
      platform: 'X',
      url: null,
      text: 'Sample post: shorting SOL here. No price was extracted from this post.',
      attachments: [],
    },
    events: [
      {
        id: 910003,
        type: 'open',
        price: null,
        quoteSymbol: null,
        direction: 'short',
        assumed: false,
        retrospective: false,
        assetId: sol.id,
        asset: sol,
      },
    ],
  },
  {
    // The post reports a trade that happened earlier.
    id: 'sample:maya:004',
    writtenAt: '2026-01-15T10:30:00.000Z',
    trader: { id: 900102, name: 'Sample trader Maya' },
    source: {
      platform: 'TELEGRAM',
      url: null,
      text: 'Sample post: closed my BTC long yesterday at 94,000.',
      attachments: [],
    },
    events: [
      {
        id: 910004,
        type: 'close',
        price: 94000,
        quoteSymbol: 'USD',
        direction: 'long',
        assumed: false,
        retrospective: true,
        assetId: btc.id,
        asset: btc,
      },
    ],
  },
  {
    // The source text is unavailable.
    id: 'sample:alex:005',
    writtenAt: '2026-01-15T10:00:00.000Z',
    trader: { id: 900101, name: 'Sample trader Alex' },
    source: { platform: 'X', url: null, text: null, attachments: [] },
    events: [
      {
        id: 910005,
        type: 'open',
        price: 3180,
        quoteSymbol: 'USD',
        direction: 'long',
        assumed: false,
        retrospective: false,
        assetId: eth.id,
        asset: eth,
      },
    ],
  },
]

export function sampleFeed(assetId?: number): FeedData {
  return structuredClone({
    results:
      assetId === undefined
        ? items
        : items.filter((item) => item.events.some((event) => event.assetId === assetId)),
    meta: {
      hasMore: false,
      nextCursor: null,
      serverTime: '2026-01-15T12:05:00.000Z',
      dataComputedAt: '2026-01-15T12:05:00.000Z',
    },
  })
}

function matchRank(asset: Asset, term: string) {
  const fields = [asset.name, asset.symbol].map((field) => field.toLowerCase())
  if (fields.includes(term)) return 0
  if (fields.some((field) => field.startsWith(term))) return 1
  if (fields.some((field) => field.includes(term))) return 2
  return undefined
}

/** Sample asset discovery. Like GET /v2/assets, exact matches rank first, then prefix matches. */
export function sampleAssetSearch(search: string): Page<Asset> {
  const term = search.toLowerCase()
  const results = sampleAssets
    .map((asset) => ({ asset, rank: matchRank(asset, term) }))
    .filter((match) => match.rank !== undefined)
    .sort((a, b) => a.rank! - b.rank! || a.asset.symbol.localeCompare(b.asset.symbol))
    .map((match) => match.asset)
  return structuredClone({
    results,
    meta: { hasMore: false, nextCursor: null, serverTime: '2026-01-15T12:05:00.000Z' },
  })
}
