import './globals.css'

export const metadata = {
  title: '千川爆文合集',
  description: '全网高跑量千川脚本收集与管理',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
