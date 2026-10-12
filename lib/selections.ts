// Verify live IDs through GET /v2/assets before publication or when adding a preset.
// BTC 1 and ETH 10 were verified in Centaur's production directory on 2026-10-12.
export const selections = [
  { key: 'btc', label: 'Bitcoin (BTC)', liveId: 1, sampleId: 900001 },
  { key: 'eth', label: 'Ethereum (ETH)', liveId: 10, sampleId: 900002 },
] as const
