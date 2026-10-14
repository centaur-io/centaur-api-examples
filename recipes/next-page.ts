import { centaur } from './client.ts'

const query = { limit: 5, assetIds: [1] } // Replace with an ID chosen through discovery.
const first = await centaur.feed(query)
console.log(JSON.stringify(first, null, 2))
if (first.meta.hasMore && first.meta.nextCursor) {
  const next = await centaur.feed({ ...query, cursor: first.meta.nextCursor })
  console.log(JSON.stringify(next, null, 2))
}
