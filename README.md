# Centaur API examples

A small feed application you can run and adapt. The default uses labelled fictional data and needs no account. API calls live in one portable TypeScript file: [`lib/centaur.ts`](lib/centaur.ts).

## Run the starter

Use Node.js 24 and npm:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Search for an asset by name or symbol, pick one of the matches to filter the feed, and use **Refresh** to fetch again. Sample mode searches three fictional assets and never calls Centaur.

To use live data, copy `.env.example` to `.env.local`, set `CENTAUR_DATA_MODE=live` and `CENTAUR_API_KEY`, then restart. Your key needs `feed.read` for the feed and `directory.read` for asset search. Missing credentials and live errors stay visible; they never fall back to samples.

> **Shell variables win over `.env.local`.** Next.js reads `process.env` before any `.env` file, so a `CENTAUR_API_KEY` or `CENTAUR_DATA_MODE` already exported in your terminal silently replaces the value in `.env.local`. If the starter uses the wrong key or mode, run `unset CENTAUR_API_KEY CENTAUR_DATA_MODE` (or open a new terminal) and restart `npm run dev`.

Keep the key on the server, outside `NEXT_PUBLIC_` variables. Add your own access and traffic controls before making this demonstration publicly available.

## Adapt it

| File                     | Purpose                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| `app/feed.tsx`           | Feed UI, asset search, manual refresh and states.                                              |
| `app/api/*/route.ts`     | Next.js entry points for the small backend: `/api/feed` and `/api/assets`.                     |
| `lib/server/handlers.ts` | Server configuration, query validation and safe browser errors.                                |
| `lib/centaur.ts`         | Typed fetch helpers with a standard timeout and HTTP errors. Copy into any TypeScript backend. |
| `lib/source-text.ts`     | Turns `source.text` into plain display text.                                                   |
| `fixtures/feed.ts`       | Fictional posts, assets and sample-only media.                                                 |

### Source text

The API serves `source.text` as stored. Telegram posts use a small HTML subset with escaped characters, such as `<b>ETH</b> &amp; BTC`, and X posts are plain text with `&amp;`, `&lt;` and `&gt;` escaped. [`lib/source-text.ts`](lib/source-text.ts) strips the tags and decodes the entities once, and the feed renders the result as text, never as HTML. The hosted Centaur widget renders Telegram formatting; this starter shows plain text on purpose, so it never inserts API HTML into the page. `source.text` can be `null`; the feed then shows "Source text is unavailable."

Events with `assumed: true` display like any other trade. `retrospective: true` means the post reports a trade that happened earlier.

### Asset classes

Asset discovery returns two class fields, and the `assetClass` filter has its own values:

| Name                       | Where                              | Values                                             | Use it for                                                                                                         |
| -------------------------- | ---------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `assetClass` filter        | `/v2/assets`, feed (release-gated) | `crypto`, `stocks`, `indices`, `commodities`, `fx` | Narrowing a request. Omit it for every class.                                                                      |
| `resolvedAssetClass` field | `/v2/assets`                       | The filter values, plus `other`                    | Grouping or labelling assets in your UI, and building filter choices. Each value except `other` is a filter value. |
| `assetClass` field         | `/v2/assets`                       | `crypto`, `equities`, `commodities`, `fx`, `other` | The raw stored class. `equities` covers both stocks and indices, so it is not a filter value.                      |

For example, an S&P 500 index returns `assetClass: "equities"` and `resolvedAssetClass: "indices"`, and you filter it with `assetClass=indices`. Apple returns `resolvedAssetClass: "stocks"`, filtered with `assetClass=stocks`. See [asset discovery](https://docs.centaur.io/guides/rest/data-reads#assets).

The teaching client trusts the documented response types. It does not include runtime schema validation or retry logic. It preserves pagination metadata; your application decides when to request another page or retry.

## Focused recipes

[Five API tasks](recipes/README.md) run directly with Node 24, without installing Next.js or any package. To see the error fields, run `CENTAUR_API_KEY=invalid node recipes/errors.ts`; with a valid key the recipe prints the feed instead. cURL examples live in the [public API quickstart](https://docs.centaur.io/integrations/api-quickstart).

The positioning endpoint and `assetClass` feed filter are release-gated. Keep those examples pending until they are available in the target environment. Existing feed and directory recipes can release independently.

## Checks

```sh
npm run check-types
npm run lint
npm test
npm run build
npm run test:browser
```

Browser checks use Chrome locally and fixture API failures. They do not prove live account access or released endpoint availability.

`package.json` overrides `fast-glob` inside `@next/eslint-plugin-next` with `tinyglobby`. The `braces` advisory [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) has no patched release, and that `fast-glob` was its only path into this project. The plugin uses it only to expand `settings.next.rootDir`, which this starter does not set. Remove the override once `eslint-config-next` no longer depends on `braces`.

Maintainer: Panagiotis Plytas. Code and recipes use the [MIT license](LICENSE).
