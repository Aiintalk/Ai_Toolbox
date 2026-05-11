import './globals.css'

export const metadata = {
  title: '产品卖点提取器',
  description: '上传产品Brief和达人文案，AI提炼最炸裂的卖点',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
