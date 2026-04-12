import './globals.css'

export const metadata = {
  title: '对标分析助手',
  description: '对标账号系统化拆解与分析，输出人格档案与内容规划',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
