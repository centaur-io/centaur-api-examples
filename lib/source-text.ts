// The API serves `source.text` as stored: Telegram posts use a small HTML tag subset with escaped
// characters, and X posts are plain text with `&amp; &lt; &gt;` escaped. Render the result as a
// text node, never as HTML. Each pattern has a single unbounded quantifier that cannot overlap, so
// both scans are linear. Same behaviour as the hosted Centaur widget.
const TAG = /<\/?[a-z][^<>]*>/gi
const ENTITY = /&(?:#(\d{1,7})|#[xX]([\da-fA-F]{1,6})|(amp|lt|gt|quot|apos));/g
const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

/** Strips tags, then decodes entities exactly once, so `&amp;lt;` becomes `&lt;`. */
export function sourceText(html: string): string {
  return html
    .replace(TAG, '')
    .replace(ENTITY, (entity, decimal?: string, hex?: string, name?: string) => {
      if (name) return NAMED[name]
      const code = decimal ? Number(decimal) : Number.parseInt(hex!, 16)
      const valid = code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff)
      return valid ? String.fromCodePoint(code) : entity
    })
}
