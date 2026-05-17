import './globals.css'

export const metadata = {
  title: '千川脚本复盘助手',
  description: '千川投流素材的数据复盘与效率优化',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
