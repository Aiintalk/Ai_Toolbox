import './globals.css'

export const metadata = {
  title: 'TikTok Content Writer',
  description: 'TikTok content rewriting tool',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
