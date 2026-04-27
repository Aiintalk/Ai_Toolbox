import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'KOL Portal',
  description: '红人专属工作台',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
