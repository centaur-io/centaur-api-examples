import { readConfig } from '../../../lib/server/config'
import { handleFeed } from '../../../lib/server/handlers'

export const GET = (request: Request) => handleFeed(request, readConfig)
