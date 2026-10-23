import { expect, it } from 'vitest'
import { sourceText } from '../lib/source-text'

it.each([
  [
    '<a href="https://x.com/example/status/1?s=20">https://x.com/example/status/1?s=20</a>',
    'https://x.com/example/status/1?s=20',
  ],
  ['I&#x27;ll buy the dip', "I'll buy the dip"],
  ['PPI &gt; 5.3%', 'PPI > 5.3%'],
  ['<strong>/USDT</strong>', '/USDT'],
  ['&amp;lt;', '&lt;'],
  ['&quot;a&quot; &apos;b&apos; &#38; &#x1F680;', `"a" 'b' & \u{1F680}`],
  ['&#0; &#xD800; &#x110000; &nbsp;', '&#0; &#xD800; &#x110000; &nbsp;'],
  ['a < b > c\n<em>line</em>', 'a < b > c\nline'],
  ['<script>alert("unsafe")</script>', 'alert("unsafe")'],
])('converts %j to display text', (html, text) => {
  expect(sourceText(html)).toBe(text)
})

it('stays linear on adversarial input', () => {
  const html = '<a"'.repeat(Math.ceil(50_000 / 3))
  expect(sourceText(html)).toBe(html)
})
