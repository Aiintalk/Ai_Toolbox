import './globals.css'

export const metadata = {
  title: '人设脚本复盘助手',
  description: '批量解析抖音视频数据，AI生成结构化复盘报告',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
