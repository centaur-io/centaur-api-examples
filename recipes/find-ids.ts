import { centaur } from './client.ts'

const [kind, search] = process.argv.slice(2)
if (!search || !['assets', 'traders'].includes(kind))
  throw new Error('Use: node recipes/find-ids.ts assets bitcoin (or traders NAME)')
const page =
  kind === 'assets' ? await centaur.findAssets(search) : await centaur.findTraders(search)
console.log(JSON.stringify(page, null, 2))
// Choose the intended ID. Discovery can return several candidates or another page.
