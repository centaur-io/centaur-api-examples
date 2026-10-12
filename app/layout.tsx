import type { Metadata } from 'next'
import './styles.css'

export const metadata: Metadata = {
  title: 'Centaur feed example',
  description: 'A small, editable social-trading feed built with the Centaur API.',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
