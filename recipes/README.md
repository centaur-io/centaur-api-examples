# API recipes

Use Node.js 24. Clone the repository, set `CENTAUR_API_KEY` in your terminal, and run a script. No package installation or Next.js server is needed. Keep the key out of browser code.

| Task                                | Command                                          | Required scope   |
| ----------------------------------- | ------------------------------------------------ | ---------------- |
| Find asset IDs                      | `node recipes/find-ids.ts assets bitcoin`        | `directory.read` |
| Find trader IDs                     | `node recipes/find-ids.ts traders "NAME"`        | `directory.read` |
| General feed                        | `node recipes/feed.ts`                           | `feed.read`      |
| Filter by asset IDs                 | `node recipes/feed.ts 1,10`                      | `feed.read`      |
| Next page with the original filters | `node recipes/next-page.ts`                      | `feed.read`      |
| HTTP errors and retry guidance      | `CENTAUR_API_KEY=invalid node recipes/errors.ts` | None             |
| Asset positioning, after release    | `node recipes/pending/positioning.ts 1`          | `stats.read`     |

The errors recipe prints a result when the request succeeds, so run it with an invalid key to see the error fields: status, code, message, request ID and Retry-After.

A `CENTAUR_API_KEY` set inline, as above, applies to that one command. One exported in your shell applies to every recipe and also overrides the starter's `.env.local`.

Choose IDs from the directory results. Discovery is a setup step, not a lookup before every feed request. The feed recipe shows where to add `traderIds` and `assetClass`; omit unused filters. Do not send an empty list to mean "no matches".

The client is [`lib/centaur.ts`](../lib/centaur.ts). It uses standard fetch, one timeout, and a typed error with status, code, request ID and Retry-After when provided. It does not retry automatically. Network errors and cancellation keep their native error types.

A zero positioning snapshot means the asset has no tracked positions. A missing snapshot means unavailable. Confirm the positioning endpoint and asset-class filter are released before using them. These pending features do not block the other recipes.
