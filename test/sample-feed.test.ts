import { expect, it } from 'vitest'
import { sampleAssetSearch, sampleFeed } from '../fixtures/feed'
import { sourceText } from '../lib/source-text'
import type { FeedItem } from '../lib/centaur'

function cases(item: FeedItem) {
  const text = item.source.text
  return [
    item.source.attachments.length > 0 && 'media',
    text !== null && sourceText(text) !== text && 'Telegram markup',
    item.events.some((event) => event.price === null) && 'no price',
    item.events.some((event) => event.retrospective) && 'retrospective',
    text === null && 'no source text',
  ].filter(Boolean)
}

it('shows one realistic case per sample card, with no assumed events', () => {
  const { results } = sampleFeed()
  expect(results.map(cases)).toEqual([
    ['media'],
    ['Telegram markup'],
    ['no price'],
    ['retrospective'],
    ['no source text'],
  ])
  expect(results.flatMap((item) => item.events).some((event) => event.assumed)).toBe(false)
})

it('filters samples by asset and returns an empty page for other IDs', () => {
  expect(sampleFeed(900002).results.map((item) => item.id)).toEqual([
    'sample:maya:002',
    'sample:alex:005',
  ])
  expect(sampleFeed(900009).results).toEqual([])
})

it('searches sample assets like the API: exact, then prefix, then other matches', () => {
  const symbols = (search: string) => sampleAssetSearch(search).results.map((a) => a.symbol)
  expect(symbols('ETH')).toEqual(['ETH'])
  expect(symbols('bit')).toEqual(['BTC'])
  expect(symbols('o')).toEqual(['BTC', 'SOL'])
  expect(symbols('sol')).toEqual(['SOL'])
  expect(symbols('doge')).toEqual([])
})
