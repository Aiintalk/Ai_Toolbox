import './globals.css'

export const metadata = {
  title: '种草内容仿写助手',
  description: '四步完成种草带货内容仿写',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
