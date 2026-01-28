import type { Metadata } from 'next'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBookOpen } from '@fortawesome/free-solid-svg-icons'
import Header from '../components/Header'

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
    <div className="min-h-screen bg-[#f8f5f0]">
      <Header activeNav="sutra" stats={{ label: '收录', count: pagination.total }} />

      <main className="mx-auto max-w-[1000px] px-4 py-8 sm:py-12">
        {/* 页面标题 */}
        <div className="mb-6">
          <h1 className="text-xl font-medium text-[#3d3229]">全部经书</h1>
          <p className="mt-1 text-sm text-[#8a7a6a]">
            共 {pagination.total.toLocaleString()} 部 · 第 {currentPage}/{totalPages} 页
          </p>
        </div>

        {/* 经书列表 */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((item) => (
              <Link
                key={item.id}
                href={`/sutra/${encodeURIComponent(item.title)}/1`}
                className="group flex items-center gap-2.5 rounded-lg border border-[#e8e0d5] bg-white px-3 py-2.5 transition hover:border-[#d0c8bd] hover:bg-[#fdfcfa] hover:shadow-sm"
              >
                <FontAwesomeIcon icon={faBookOpen} className="h-3.5 w-3.5 shrink-0 text-[#a09080] group-hover:text-[#8a7a6a]" />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[14px] font-medium text-[#3d3229] group-hover:text-[#2a1f16]">
                    {item.title}
                  </h2>
                </div>
                {item.author_raw && (
                  <span className="shrink-0 text-[11px] text-[#a09080]">{item.author_raw}</span>
                )}
              </Link>
          ))}
        </div>

        {data.length === 0 && (
          <div className="rounded-lg border border-[#e8e0d5] bg-white py-12 text-center text-sm text-[#8a7a6a]">
            暂无经书可展示
          </div>
        )}

        {/* 分页导航 */}
        <nav className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
          <Link
            href={currentPage > 1 ? `/sutra?page=${currentPage - 1}` : '/sutra'}
            className={`rounded-md border px-3 py-1.5 text-xs transition ${
              currentPage > 1
                ? 'border-[#e8e0d5] bg-white text-[#3d3229] hover:border-[#d0c8bd] hover:bg-[#fdfcfa]'
                : 'border-[#e8e0d5] bg-[#f5f2ed] text-[#b0a090] cursor-not-allowed'
            }`}
            aria-disabled={currentPage <= 1}
          >
            上一页
          </Link>
          {pageItems.map((item, index) => (
            item === 'ellipsis' ? (
              <span key={`ellipsis-${index}`} className="px-1 text-xs text-[#a09080]">
                …
              </span>
            ) : (
              <Link
                key={item}
                href={item === 1 ? '/sutra' : `/sutra?page=${item}`}
                className={`rounded-md border px-3 py-1.5 text-xs transition ${
                  item === currentPage
                    ? 'border-[#3d3229] bg-[#3d3229] text-white'
                    : 'border-[#e8e0d5] bg-white text-[#3d3229] hover:border-[#d0c8bd] hover:bg-[#fdfcfa]'
                }`}
              >
                {item}
              </Link>
            )
          ))}
          <Link
            href={`/sutra?page=${Math.min(currentPage + 1, totalPages)}`}
            className={`rounded-md border px-3 py-1.5 text-xs transition ${
              currentPage < totalPages
                ? 'border-[#e8e0d5] bg-white text-[#3d3229] hover:border-[#d0c8bd] hover:bg-[#fdfcfa]'
                : 'border-[#e8e0d5] bg-[#f5f2ed] text-[#b0a090] cursor-not-allowed'
            }`}
            aria-disabled={currentPage >= totalPages}
          >
            下一页
          </Link>
        </nav>
      </main>
    </div>
  )
}
