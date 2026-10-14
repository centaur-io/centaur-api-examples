# Centaur API examples

A small feed application you can run and adapt. The default uses labelled fictional data and needs no account. API calls live in one portable TypeScript file: [`lib/centaur.ts`](lib/centaur.ts).

## Run the starter

Use Node.js 24 and npm:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Choose All assets, Bitcoin (BTC) or Ethereum (ETH) and use **Refresh** to fetch again. Sample mode never calls Centaur.

To use live data, copy `.env.example` to `.env.local`, set `CENTAUR_DATA_MODE=live` and `CENTAUR_API_KEY`, then restart. Your key needs `feed.read`. Missing credentials and live errors stay visible; they never fall back to samples.

Keep the key on the server, outside `NEXT_PUBLIC_` variables. Add your own access and traffic controls before making this demonstration publicly available.

## Adapt it

| File                         | Purpose                                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `app/feed.tsx`               | Feed UI, selection, manual refresh and states.                                                 |
| `app/api/feed/route.ts`      | Next.js entry point for the small backend.                                                     |
| `lib/server/feed-handler.ts` | Server configuration, allowed selections and safe browser errors.                              |
| `lib/centaur.ts`             | Typed fetch helpers with a standard timeout and HTTP errors. Copy into any TypeScript backend. |
| `lib/selections.ts`          | Sample IDs and live preset IDs. Verify live IDs through discovery before release.              |
| `fixtures/feed.ts`           | Fictional posts and sample-only media.                                                         |

The teaching client trusts the documented response types. It does not include runtime schema validation or retry logic. It preserves pagination metadata; your application decides when to request another page or retry.

## Checks

```sh
npm run check-types
npm run lint
npm test
npm run build
npm run test:browser
```

Browser checks use Chrome locally and fixture API failures. They do not prove live account access or released endpoint availability.

Maintainer: Panagiotis Plytas. Code and recipes use the [MIT license](LICENSE).
