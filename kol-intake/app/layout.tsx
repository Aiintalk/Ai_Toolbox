import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '红人信息采集',
  description: '红人入职信息采集 - AI 对话版',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
