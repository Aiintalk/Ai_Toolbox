import './globals.css'

export const metadata = {
  title: '直播间脚本复盘助手',
  description: '直播间讲解脚本的数据复盘与话术优化',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
