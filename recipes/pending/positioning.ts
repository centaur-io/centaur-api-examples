// Run after GET /v2/assets/positioning is released for your environment.
import { centaur } from '../client.ts'

const assetId = Number(process.argv[2])
if (!Number.isSafeInteger(assetId) || assetId <= 0) throw new Error('Supply one positive asset ID.')
const data = await centaur.positioning(assetId)
console.log(data.results[0] ?? { assetId, status: 'unavailable' })
// A snapshot with totalOpenPositionsCount: 0 is available, with no tracked positions.
