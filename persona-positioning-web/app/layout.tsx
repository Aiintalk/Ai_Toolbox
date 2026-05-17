import './globals.css'

export const metadata = {
  title: '人设定位助手',
  description: '基于对标账号分析，为达人生成专属人格档案与内容规划',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
