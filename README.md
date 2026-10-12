# Centaur API examples

Run a small social-trading feed, then adapt the UI for your product. The application uses Next.js and TypeScript. The API request code also works in other TypeScript backends.

Maintainer: Panagiotis Plytas. Code and executable recipes use the [MIT license](LICENSE).

## Run the sample

Use Node.js 24 and npm. No Centaur account, API key, private registry, or workspace is required.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. You see a **Sample data** label, three fictional posts, and two original illustrations. Choose an asset or click **Refresh** to read the feed again.

Sample mode makes no Centaur API requests. Adding an API key does not activate live mode.

## Switch to live data

1. Create a Centaur API key with `feed.read` access. See [API key setup](https://docs.centaur.io/guides/overview/api-keys-connected-apps).
2. Copy `.env.example` to `.env.local`.
3. Set `CENTAUR_DATA_MODE=live` and `CENTAUR_API_KEY` in `.env.local`.
4. Restart the server.

The page shows **Live API mode**. Missing credentials, insufficient access, quota limits, and temporary failures appear as errors. Live failures never fall back to samples.

Keep the key on the server. Never use a `NEXT_PUBLIC_` variable for it. Visitors to a public live deployment spend this key's shared allowance. Use a dedicated key and your host's access and rate controls before opening a live deployment to the public.

## Adapt the example

| File                              | Responsibility                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| `app/feed.tsx`                    | Feed layout, selection, refresh, and UI states.                                             |
| `app/api/feed/route.ts`           | Next.js adapter for the local feed route.                                                   |
| `lib/server/config.ts`            | Server-only mode and key configuration.                                                     |
| `lib/server/feed-handler.ts`      | Validates browser selections and chooses the provider.                                      |
| `lib/centaur/`                    | Portable requests, response schemas, and errors. No Next.js, React, or environment imports. |
| `lib/selections.ts`               | Explicit live asset IDs and separate fictional sample IDs.                                  |
| `fixtures/` and `public/samples/` | Deterministic fictional posts and original illustrations.                                   |

To add an asset, use [asset discovery](https://docs.centaur.io/guides/rest/data-reads#example-asset-discovery) with a key that has `directory.read`. Choose the intended canonical numeric ID and add a named preset in `lib/selections.ts`. Stop if a lookup is missing or ambiguous. Do not use sample IDs for live filters.

You can copy `lib/centaur/` into another TypeScript backend that provides standard `fetch`, Web Streams, and `AbortSignal`. Install the pinned Zod version from `package.json`. Pass the API key as a function argument. The module does not read environment variables or require a Next.js server.

The local route accepts only one optional `asset` preset key. It fixes the upstream to `GET https://api.centaur.io/v2/feed?limit=20`, with a deadline of 10 seconds and a response limit of 2 MiB. Unknown or repeated parameters fail before a live request. Redirects are rejected. Source text is escaped, and links allow only HTTPS.

## Understand refresh and errors

The application requests data on initial load, an asset change, and **Refresh**. It does not poll or paginate. A refresh can return API-cached data. Default first pages can reuse data for up to 10 minutes; see [feed freshness](https://docs.centaur.io/guides/rest/feed). This example does not promise the hosted widgets' refresh target.

An empty response means no matching activity. It is different from unavailable data. API 401 or 403 require the integration owner to correct credentials or access. API 422 requires a selection change. API 429 and 503 retain a valid `Retry-After` and request ID when available. No automatic retry loop runs. The portable error also retains the HTTP status and API code, while the browser receives a fixed, safe message.

## Verify changes

```sh
npm run check-types
npm run lint
npm test
npm run build
npm exec playwright install chromium
npm run test:browser
```

Local browser tests use Chrome. CI uses Chromium. Tests cover the real sample route and missing live configuration. Injected transports cover authenticated live success and failures without using a real key. Public release also requires a real authenticated API check and a fresh standalone install.

## Content and maintenance

The sample traders, posts, and images are original fictional material. The SVGs are layout illustrations, not market data. Their source files are included under MIT. API data and third-party posts or media have separate publication rights; the code license does not grant those rights.

The public Centaur feed contract remains authoritative. This repository validates a narrow subset of that response and discards unused fields. Review these schemas and examples when the API changes. Partners update copied applications themselves.

This starter is under implementation review and has no reviewed release yet.
