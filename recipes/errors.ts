import { centaur } from './client.ts'
import { CentaurApiError } from '../lib/centaur.ts'

try {
  console.log(JSON.stringify(await centaur.feed({ limit: 5 }), null, 2))
} catch (error) {
  if (error instanceof CentaurApiError) {
    console.error({
      status: error.status,
      code: error.code,
      message: error.message,
      requestId: error.requestId,
      retryAfter: error.retryAfter,
    })
  } else {
    console.error(error) // Network errors and timeouts retain their native types.
  }
  process.exitCode = 1
}
