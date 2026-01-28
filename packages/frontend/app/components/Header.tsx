'use client'

import Link from 'next/link'
import { useState } from 'react'

type NavItem = {
  label: string
  href: string
  active?: boolean
}

type HeaderProps = {
  /** 当前激活的导航项 */
  activeNav?: 'home' | 'sutra' | 'dictionary' | 'person'
  /** 右侧自定义内容（如经文阅读页的目录按钮） */
  rightContent?: React.ReactNode
  /** 移动端中间标题内容（如经文阅读页的经名） */
  mobileCenterContent?: React.ReactNode
  /** 是否显示导航链接 */
  showNav?: boolean
  /** 统计数字 */
  stats?: {
    label: string
    count: number
  }
}

export default function Header({
  activeNav,
  rightContent,
  mobileCenterContent,
  showNav = true,
  stats,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navItems: NavItem[] = [
    { label: '经文', href: '/', active: activeNav === 'home' || activeNav === 'sutra' },
    { label: '词典', href: '/dictionary', active: activeNav === 'dictionary' },
    { label: '人物', href: '/person', active: activeNav === 'person' },
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-white/40 bg-[#2a1f16]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-3 py-3 sm:px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 text-[#fff4e0] shrink-0">
          <span className="shrink-0 text-2xl" role="img" aria-hidden="true">📿</span>
          <span className="text-sm font-display tracking-wide">佛典数据库</span>
        </Link>

        {/* 移动端中间内容 */}
        {mobileCenterContent && (
          <div className="lg:hidden flex flex-col justify-center items-center text-[#fff4e0] min-w-0 absolute left-1/2 -translate-x-1/2">
            {mobileCenterContent}
          </div>
        )}

        {/* 桌面端导航 */}
        {showNav && (
          <div className="hidden sm:flex items-center gap-4 text-xs text-[#f6dfbe]">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full border px-3 py-1 transition-colors ${
                  item.active
                    ? 'border-amber-400/40 bg-amber-400/20'
                    : 'border-white/20 bg-white/10 hover:bg-white/20'
                }`}
              >
                {item.label}
              </Link>
            ))}
            {stats && (
              <div className="rounded-full border border-white/20 bg-white/10 px-3 py-1">
                {stats.label} {stats.count.toLocaleString()} 条
              </div>
            )}
          </div>
        )}

        {/* 右侧内容 */}
        <div className="flex items-center gap-2 text-xs text-[#f6dfbe] shrink-0">
          {rightContent}

          {/* 移动端菜单按钮 */}
          {showNav && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden p-2 rounded-full hover:bg-white/10 transition-colors"
              aria-label="菜单"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 移动端下拉菜单 */}
      {showNav && mobileMenuOpen && (
        <div className="sm:hidden border-t border-white/10 bg-[#2a1f16]/95 backdrop-blur-md">
          <nav className="flex flex-col p-3 gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  item.active
                    ? 'bg-amber-400/20 text-amber-200'
                    : 'text-[#f6dfbe] hover:bg-white/10'
                }`}
              >
                {item.label}
              </Link>
            ))}
            {stats && (
              <div className="px-4 py-2 text-xs text-[#9a8a7a]">
                {stats.label} {stats.count.toLocaleString()} 条
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
