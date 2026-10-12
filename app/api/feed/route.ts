import { readConfig } from '../../../lib/server/config'
import { handleFeed } from '../../../lib/server/feed-handler'

export const runtime = 'nodejs'
export const GET = (request: Request) => handleFeed(request, readConfig)
