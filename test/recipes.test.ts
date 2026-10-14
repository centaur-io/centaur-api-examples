import { expect, it } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

// Run the actual scripts with Node's native TypeScript support, without Next or a TS runner.
function run(script: string, args: string[] = [], failure = false) {
  const directory = mkdtempSync(join(tmpdir(), 'centaur-recipe-'))
  const mock = join(directory, 'fetch.mjs')
  writeFileSync(
    mock,
    `globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    console.log('REQUEST ' + JSON.stringify({path: url.pathname, query: Object.fromEntries(url.searchParams), key: options.headers['x-api-key']}));
    if (${failure}) return Response.json({success:false,error:{code:'RATE_LIMITED',message:'Wait'},requestId:'request-1'},{status:429,headers:{'retry-after':'30'}});
    const results = url.pathname.endsWith('/positioning') ? [{assetId:1,totalOpenPositionsCount:0}] : [];
    return Response.json({success:true,data:{results,meta:{hasMore: !url.searchParams.has('cursor'),nextCursor:'next&opaque',serverTime:'2026-01-15T12:00:00Z'}}});
  };`,
  )
  try {
    const result = spawnSync(
      process.execPath,
      ['--import', mock, `recipes/${script}.ts`, ...args],
      { encoding: 'utf8', env: { ...process.env, CENTAUR_API_KEY: 'test-key' } },
    )
    const requests = result.stdout
      .split('\n')
      .filter((line) => line.startsWith('REQUEST '))
      .map((line) => JSON.parse(line.slice(8)))
    return { ...result, requests }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

it.each(['assets', 'traders'])('runs the %s discovery recipe with an encoded search', (kind) => {
  const result = run('find-ids', [kind, 'A & B'])
  expect(result.status).toBe(0)
  expect(result.requests).toEqual([
    { path: `/v2/${kind}`, query: { search: 'A & B', limit: '20' }, key: 'test-key' },
  ])
})
it('runs general and filtered feeds without repeated discovery', () => {
  expect(run('feed').requests[0].query).toEqual({ limit: '5' })
  expect(run('feed', ['1,10']).requests[0].query).toEqual({ limit: '5', assetIds: '1,10' })
  const invalid = run('feed', [''])
  expect(invalid.status).not.toBe(0)
  expect(invalid.requests).toEqual([])
})
it('retains the original filters on the next page', () => {
  const result = run('next-page')
  expect(result.status).toBe(0)
  expect(result.requests.map((r) => r.query)).toEqual([
    { limit: '5', assetIds: '1' },
    { limit: '5', assetIds: '1', cursor: 'next&opaque' },
  ])
})
it('prints a zero snapshot rather than treating it as unavailable', () => {
  const result = run('pending/positioning', ['1'])
  expect(result.status).toBe(0)
  expect(result.stdout).toContain('totalOpenPositionsCount: 0')
  expect(result.requests[0].query).toEqual({ assetIds: '1' })
})
it('shows status, request ID and retry guidance with no automatic retry', () => {
  const result = run('errors', [], true)
  expect(result.status).toBe(1)
  expect(result.requests).toHaveLength(1)
  expect(result.stderr).toContain('429')
  expect(result.stderr).toContain('request-1')
  expect(result.stderr).toContain('30')
})
