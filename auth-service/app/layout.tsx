import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI 工具箱 · 登录',
  description: 'Ai_Toolbox 统一登录服务',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  )
}
