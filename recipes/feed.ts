import { centaur } from './client.ts'
import type { FeedQuery } from '../lib/centaur.ts'

const query: FeedQuery = { limit: 5 }
// Optional assetIds command-line value; omit it for a general feed.
if (process.argv[2] !== undefined) {
  query.assetIds = process.argv[2].split(',').map(Number)
  if (!query.assetIds.every((id) => Number.isSafeInteger(id) && id > 0))
    throw new Error('Supply positive assetIds, such as 1,10.')
}
// Other variations: query.traderIds = [42];
console.log(JSON.stringify(await centaur.feed(query), null, 2))
