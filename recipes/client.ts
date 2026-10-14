import { createCentaurClient } from '../lib/centaur.ts'

export const centaur = createCentaurClient({ apiKey: process.env.CENTAUR_API_KEY ?? '' })
