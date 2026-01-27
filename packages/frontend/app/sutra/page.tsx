import type { Metadata } from 'next'
import Link from 'next/link'

const API_BASE = process.env.API_BASE || 'http://localhost:3001'
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cbeta.yohomobile.dev'

export const revalidate = 3600

const PAGE_SIZE = 24

type TextItem = {
  id: string
  title: string
  title_alt?: string | null
  author_raw?: string | null
  translation_dynasty?: string | null
  juan_count?: number | null
  canon_id?: string | null
}

type Pagination = {
  total: number
  limit: number
  offset: number
}

type TextListResponse = {
  data: TextItem[]
  pagination: Pagination
}

type PageProps = {
  searchParams?: {
    page?: string
  }
}

export const metadata: Metadata = {
  title: '经书目录 - 佛典数据库',
  description: '浏览佛典数据库收录的经书目录，支持分页查看与阅读。',
  alternates: {
    canonical: `${BASE_URL}/sutra`,
  },
}

const buildPageItems = (current: number, total: number) => {
  const pages = new Set<number>()
  pages.add(1)
  pages.add(total)
  for (let p = current - 2; p <= current + 2; p += 1) {
    if (p >= 1 && p <= total) {
      pages.add(p)
    }
  }

  const sorted = Array.from(pages).sort((a, b) => a - b)
  const items: Array<number | 'ellipsis'> = []
  for (let i = 0; i < sorted.length; i += 1) {
    const page = sorted[i]
    const prev = sorted[i - 1]
    if (prev && page - prev > 1) {
      items.push('ellipsis')
    }
    items.push(page)
  }
  return items
}

async function getTexts(page: number): Promise<TextListResponse> {
  const offset = (page - 1) * PAGE_SIZE
  const res = await fetch(`${API_BASE}/texts?limit=${PAGE_SIZE}&offset=${offset}`, {
    next: { revalidate: 3600 },
  })
  if (!res.ok) {
    return {
      data: [],
      pagination: { total: 0, limit: PAGE_SIZE, offset },
    }
  }
  return res.json()
}

export default async function SutraPage({ searchParams }: PageProps) {
  const pageValue = Number(searchParams?.page || '1')
  const currentPage = Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1
  const { data, pagination } = await getTexts(currentPage)
  const totalPages = Math.max(1, Math.ceil(pagination.total / PAGE_SIZE))
  const pageItems = buildPageItems(currentPage, totalPages)

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f6f1e8] text-[#2c2621]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(205,186,156,0.45),transparent_55%),radial-gradient(circle_at_85%_18%,_rgba(156,130,98,0.22),transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(90deg,_rgba(120,102,77,0.08)_1px,_transparent_1px),linear-gradient(180deg,_rgba(120,102,77,0.08)_1px,_transparent_1px)] bg-[length:48px_48px]" />

      <header className="sticky top-0 z-50 border-b border-white/40 bg-[#2a1f16]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-3 py-3 sm:px-4">
          <Link href="/" className="flex items-center gap-2 text-[#fff4e0] hover:opacity-80 transition">
            <span className="shrink-0 text-2xl" role="img" aria-hidden="true">📿</span>
            <span className="text-sm sm:text-base font-display tracking-wide">佛典数据库</span>
          </Link>
          <div className="hidden md:flex items-center gap-4 text-xs text-[#f6dfbe]">
            <span className="rounded-full border border-amber-400/40 bg-amber-400/20 px-3 py-1">
              经文
            </span>
            <Link
              href="/dictionary"
              className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[#fff4e0] transition hover:bg-white/20"
            >
              词典
            </Link>
          </div>
          <div className="flex items-center md:hidden">
            <Link
              href="/dictionary"
              className="rounded-full border border-white/30 bg-white/10 px-3 py-2 text-xs text-[#fff4e0] transition hover:bg-white/20"
            >
              词典
            </Link>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1200px] px-4 pb-16 pt-12">
        <section className="rounded-[28px] border border-[#e6d7c1] bg-white/85 px-6 py-8 shadow-[0_25px_70px_-50px_rgba(118,92,61,0.6)] backdrop-blur-md sm:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.45em] text-[#a88957]">经书目录</p>
              <h1 className="mt-2 text-2xl font-display text-[#3d2f22]">经典经书 · 全部</h1>
              <p className="mt-3 text-sm text-[#6f5a41]">
                素雅呈现经书目录，支持分页浏览与直接阅读。
              </p>
            </div>
            <div className="flex flex-col items-end gap-3 text-xs text-[#8c7552]">
              <div className="rounded-full border border-[#d7c4a6] bg-white/70 px-4 py-2">
                收录 {pagination.total.toLocaleString()} 部
              </div>
              <Link
                href="/"
                className="rounded-full border border-[#d7c4a6] bg-white/70 px-4 py-2 text-[#5d4b35] transition hover:border-[#c7b08c] hover:bg-white"
              >
                返回首页 →
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((item) => {
            const alias = item.title_alt && item.title_alt !== item.title ? item.title_alt : null
            return (
              <Link
                key={item.id}
                href={`/sutra/${encodeURIComponent(item.title)}/1`}
                className="group flex h-full flex-col justify-between rounded-2xl border border-[#eadcc4] bg-white/85 px-5 py-4 shadow-[0_12px_30px_-24px_rgba(111,78,46,0.5)] transition hover:-translate-y-0.5 hover:border-[#d7c2a1] hover:bg-[#fffaf2] hover:shadow-[0_16px_36px_-24px_rgba(111,78,46,0.6)]"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-semibold text-[#4b3520]">
                      {item.title}
                    </h2>
                    {item.canon_id && (
                      <span className="rounded-full border border-[#e2cfae] bg-[#fffdf9] px-2 py-1 text-[10px] text-[#9b784b]">
                        {item.canon_id}
                      </span>
                    )}
                  </div>
                  {alias && (
                    <p className="mt-1 text-[11px] text-[#9a7c55]">
                      别名：{alias}
                    </p>
                  )}
                  {(item.translation_dynasty || item.author_raw) && (
                    <p className="mt-2 text-[11px] text-[#8c7653]">
                      {item.translation_dynasty && <span>{item.translation_dynasty} · </span>}
                      {item.author_raw}
                    </p>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between text-[11px] text-[#a0845d]">
                  <span>{item.juan_count ? `${item.juan_count} 卷` : '—'}</span>
                  <span>进入阅读 →</span>
                </div>
              </Link>
            )
          })}
        </section>

        {data.length === 0 && (
          <div className="mt-10 rounded-2xl border border-[#eadcc4] bg-white/80 py-12 text-center text-sm text-[#8b7250]">
            暂无经书可展示
          </div>
        )}

        <nav className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#eadcc4] bg-white/80 px-6 py-4 text-sm text-[#8b7250] shadow-sm">
          <div className="text-xs">
            第 {currentPage} / {totalPages} 页
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={currentPage > 1 ? `/sutra?page=${currentPage - 1}` : '/sutra'}
              className={`rounded-full border px-3 py-1 text-[11px] transition ${
                currentPage > 1
                  ? 'border-[#d7c4a6] bg-white/70 text-[#5d4b35] hover:border-[#c7b08c] hover:bg-white'
                  : 'border-[#eadcc4] bg-[#f5efe6] text-[#b9a183] cursor-not-allowed'
              }`}
              aria-disabled={currentPage <= 1}
            >
              上一页
            </Link>
            {pageItems.map((item, index) => (
              item === 'ellipsis' ? (
                <span key={`ellipsis-${index}`} className="px-1 text-[#b79c79]">
                  …
                </span>
              ) : (
                <Link
                  key={item}
                  href={item === 1 ? '/sutra' : `/sutra?page=${item}`}
                  className={`rounded-full border px-3 py-1 text-[11px] transition ${
                    item === currentPage
                      ? 'border-[#c7b08c] bg-[#f1e3ca] text-[#5a3a1d]'
                      : 'border-[#d7c4a6] bg-white/70 text-[#5d4b35] hover:border-[#c7b08c] hover:bg-white'
                  }`}
                >
                  {item}
                </Link>
              )
            ))}
            <Link
              href={`/sutra?page=${Math.min(currentPage + 1, totalPages)}`}
              className={`rounded-full border px-3 py-1 text-[11px] transition ${
                currentPage < totalPages
                  ? 'border-[#d7c4a6] bg-white/70 text-[#5d4b35] hover:border-[#c7b08c] hover:bg-white'
                  : 'border-[#eadcc4] bg-[#f5efe6] text-[#b9a183] cursor-not-allowed'
              }`}
              aria-disabled={currentPage >= totalPages}
            >
              下一页
            </Link>
          </div>
        </nav>
      </main>
    </div>
  )
}
