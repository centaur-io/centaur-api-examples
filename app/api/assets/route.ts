import { readConfig } from '../../../lib/server/config'
import { handleAssets } from '../../../lib/server/handlers'

export const GET = (request: Request) => handleAssets(request, readConfig)
