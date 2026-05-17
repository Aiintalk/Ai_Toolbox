import './globals.css'

export const metadata = {
  title: '直播间脚本仿写助手',
  description: '四步完成直播间讲解脚本仿写',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
