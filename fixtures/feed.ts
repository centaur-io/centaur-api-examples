import type { FeedData, FeedItem } from '../lib/centaur'

// Original fictional material. These IDs never become live API filters.
const btc = { id: 900001, name: 'Bitcoin', symbol: 'BTC' }
const eth = { id: 900002, name: 'Ethereum', symbol: 'ETH' }
const items: FeedItem[] = [
  {
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
    id: 'sample:maya:002',
    writtenAt: '2026-01-15T11:30:00.000Z',
    trader: { id: 900102, name: 'Sample trader Maya' },
    source: {
      platform: 'TELEGRAM',
      url: null,
      text: 'Sample post: reducing the ETH short. No price was extracted from this post.',
      attachments: [],
    },
    events: [
      {
        id: 910002,
        type: 'decrease',
        price: null,
        quoteSymbol: null,
        direction: 'short',
        assumed: false,
        retrospective: false,
        assetId: eth.id,
        asset: eth,
      },
    ],
  },
  {
    id: 'sample:alex:003',
    writtenAt: '2026-01-15T11:00:00.000Z',
    trader: { id: 900101, name: 'Sample trader Alex' },
    source: { platform: 'X', url: null, text: null, attachments: [] },
    events: [
      {
        id: 910003,
        type: 'close',
        price: 94000,
        quoteSymbol: 'USD',
        direction: 'long',
        assumed: true,
        retrospective: true,
        assetId: btc.id,
        asset: btc,
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
