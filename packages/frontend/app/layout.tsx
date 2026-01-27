import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '佛典数据库',
  description: '佛典经典目录与阅读入口',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased bg-[#efe4d2]">
        {children}
      </body>
    </html>
  )
}
