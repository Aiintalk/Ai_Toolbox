import './globals.css'

export const metadata = {
  title: '素材库维护',
  description: '管理达人档案与参考素材',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
