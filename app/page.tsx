import { connection } from 'next/server'
import { readMode } from '../lib/server/config'
import { Feed } from './feed'
import type { DataMode } from '../lib/centaur/contracts'

export default async function Page() {
  await connection()
  let mode: DataMode | 'unavailable' = 'unavailable'
  try {
    mode = readMode()
  } catch {
    /* The feed route returns safe configuration guidance. */
  }
  return (
    <main>
      <header className="page-header">
        <a href="https://centaur.io" className="brand">
          Centaur
        </a>
        <a href="https://docs.centaur.io/guides/rest/feed">API documentation</a>
      </header>
      <div className="page-grid">
        <section aria-labelledby="feed-title">
          <h1 id="feed-title">Trader activity</h1>
          <p className="intro">A feed you can make your own.</p>
          <Feed initialMode={mode} />
        </section>
        <aside aria-labelledby="about-title">
          <h2 id="about-title">Your UI, Centaur data</h2>
          <p>This example shows source posts, trading actions, and available media in one feed.</p>
          <p>Choose an asset or click Refresh when you want another read.</p>
          <a href="https://docs.centaur.io/guides/quickstart">Get started with the API</a>
        </aside>
      </div>
      <footer>
        Built with <a href="https://centaur.io">Centaur</a>. Sample content is fictional.
      </footer>
    </main>
  )
}
