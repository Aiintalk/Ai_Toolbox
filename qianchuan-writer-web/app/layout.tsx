import './globals.css'

export const metadata = {
  title: '千川脚本仿写助手',
  description: '四步完成千川投流素材仿写',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
