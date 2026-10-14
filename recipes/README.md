# API recipes

Use Node.js 24. Clone the repository, set `CENTAUR_API_KEY` in your terminal, and run a script. No package installation or Next.js server is needed. Keep the key out of browser code.

| Task                                | Command                                   |
| ----------------------------------- | ----------------------------------------- |
| Find asset IDs                      | `node recipes/find-ids.ts assets bitcoin` |
| Find trader IDs                     | `node recipes/find-ids.ts traders "NAME"` |
| General feed                        | `node recipes/feed.ts`                    |
| Filter by asset IDs                 | `node recipes/feed.ts 1,10`               |
| Next page with the original filters | `node recipes/next-page.ts`               |
| HTTP errors and retry guidance      | `node recipes/errors.ts`                  |
| Asset positioning, after release    | `node recipes/pending/positioning.ts 1`   |

Choose IDs from the directory results. Discovery is a setup step, not a lookup before every feed request. The feed recipe shows where to add `traderIds`; omit unused filters. Do not send an empty list to mean "no matches".

The client is [`lib/centaur.ts`](../lib/centaur.ts). It uses standard fetch, one timeout, and a typed error with status, code, request ID and Retry-After when provided. It does not retry automatically. Network errors and cancellation keep their native error types.

A zero positioning snapshot means the asset has no tracked positions. A missing snapshot means unavailable. Confirm the positioning endpoint is released before using them. These pending features do not block the other recipes.
