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
