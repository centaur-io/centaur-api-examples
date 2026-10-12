import { z } from 'zod'

// Narrow, checked-in subset of the public /v2/feed contract. Extra fields are discarded.
const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const label = z.string().max(500)
const date = z.iso.datetime()
const link = z.string().max(4096).nullable()
const eventSchema = z.object({
  id,
  type: z.enum(['open', 'close', 'increase', 'decrease']),
  price: z.number().nullable(),
  quoteSymbol: label.nullable(),
  direction: z.enum(['long', 'short']),
  assumed: z.boolean(),
  retrospective: z.boolean(),
  assetId: id,
  asset: z.object({ id, name: label, symbol: label }),
})
export const feedItemSchema = z.object({
  id: z.string().min(1).max(500),
  writtenAt: date,
  trader: z.object({ id, name: label }),
  source: z.object({
    platform: z.enum(['TELEGRAM', 'X']),
    url: link,
    text: z.string().max(100_000).nullable(),
    attachments: z.array(z.object({ type: label, url: z.string().max(4096) })).max(100),
  }),
  events: z.array(eventSchema).min(1).max(1000),
})
export const feedDataSchema = z.object({
  results: z.array(feedItemSchema).max(20),
  meta: z.object({ serverTime: date, dataComputedAt: date }),
})
export const feedEnvelopeSchema = z.object({
  success: z.literal(true),
  data: feedDataSchema,
  requestId: z.string().max(128),
})
export type FeedItem = z.infer<typeof feedItemSchema>
export type FeedData = z.infer<typeof feedDataSchema>
export type DataMode = 'sample' | 'live'

export function safeUrl(value: string | null, allowSample = false): string | undefined {
  if (allowSample && /^\/samples\/[a-z0-9-]+\.svg$/.test(value ?? '')) return value!
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined
  } catch {
    return undefined
  }
}
