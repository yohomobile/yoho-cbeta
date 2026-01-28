'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api'

const popularDictionary = [
  { term: '般若', description: '智慧' },
  { term: '空', description: '核心概念' },
  { term: '涅槃', description: '解脱' },
  { term: '菩提', description: '觉悟' },
  { term: '因果', description: '业报' },
  { term: '三昧', description: '禅定' },
  { term: '佛陀', description: '觉者' },
  { term: '菩萨', description: '觉有情' },
  { term: '阿罗汉', description: '果位' },
  { term: '缘起', description: '核心教义' },
  { term: '轮回', description: '六道' },
  { term: '解脱', description: '出离' },
  { term: '四谛', description: '苦集灭道' },
  { term: '八正道', description: '修行' },
  { term: '五蕴', description: '色受想行识' },
  { term: '十二因缘', description: '缘起法' },
]


type SearchResults = {
  query: string
  results: {
    texts: {
      total: number
      items: Array<{
        id: string
        title: string
        author_raw: string
        translation_dynasty: string
        juan_count: number
      }>
    }
    dictionary: {
      total: number
      items: Array<{
        id: number
        term: string
        definition_preview: string
        source: string
      }>
    }
    persons: {
      total: number
      items: Array<{
        id: number
        name: string
        dynasty_name: string
        identity: string
      }>
    }
    stats?: {
      titles: number
      authors: number
      dynasties: number
      persons: number
      dictionary: number
    }
    content: {
      total: number
      items: Array<{
        text_id: string
        juan: number
        title: string
        snippet: string
      }>
    } | null
  }
  searchedContent: boolean
}

type ContentResults = {
  query: string
  data: Array<{
    text_id: string
    juan: number
    title: string
    author_raw: string
    snippet: string
  }>
  pagination: {
    total: number
    limit: number
    offset: number
  }
}

type PopularText = {
  id: string
  title: string
  alias?: string
  tag: string
  dynasty?: string
  author?: string
}

type HomeClientProps = {
  initialTotal: number
  popularTexts: PopularText[]
}

export default function HomeClient({ initialTotal, popularTexts }: HomeClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const q = searchParams.get('q') || ''

  const [query, setQuery] = useState(q)
  const [results, setResults] = useState<SearchResults | null>(null)
  const [contentResults, setContentResults] = useState<ContentResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [contentLoading, setContentLoading] = useState(false)
  const [showContentSearch, setShowContentSearch] = useState(false)

  const doSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return

    setLoading(true)
    setResults(null)
    setContentResults(null)
    setShowContentSearch(false)

    try {
      const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(searchQuery)}&limit=5`)
      const data: SearchResults = await res.json()
      setResults(data)
    } catch (err) {
      console.error('搜索失败:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (q) {
      setQuery(q)
      doSearch(q)
    } else {
      setQuery('')
      setResults(null)
      setContentResults(null)
      setShowContentSearch(false)
    }
  }, [q, doSearch])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (trimmed) {
      router.push(`/?q=${encodeURIComponent(trimmed)}`)
    }
  }

  const searchContent = async () => {
    if (!q) return

    setShowContentSearch(true)
    setContentLoading(true)

    try {
      const res = await fetch(`${API_BASE}/search/content?q=${encodeURIComponent(q)}&limit=20`)
      const data: ContentResults = await res.json()
      setContentResults(data)
    } catch (err) {
      console.error('经文搜索失败:', err)
    } finally {
      setContentLoading(false)
    }
  }

  const loadMoreContent = async () => {
    if (!q || !contentResults) return

    setContentLoading(true)
    try {
      const offset = contentResults.data.length
      const res = await fetch(`${API_BASE}/search/content?q=${encodeURIComponent(q)}&limit=20&offset=${offset}`)
      const data: ContentResults = await res.json()
      setContentResults({
        ...data,
        data: [...contentResults.data, ...data.data],
      })
    } catch (err) {
      console.error('加载更多失败:', err)
    } finally {
      setContentLoading(false)
    }
  }

  const hasResults = Boolean(
    results && (
      results.results.texts.total > 0 ||
      results.results.dictionary.total > 0 ||
      results.results.persons.total > 0
    )
  )

  return (
    <div className="min-h-screen bg-[#f8f5f0] text-[#3d3229]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/20 bg-[#2a1f16]/95 backdrop-blur-md">
        <nav className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4" aria-label="主导航">
          <Link href="/" className="flex items-center gap-2 text-[#fff4e0] transition hover:opacity-80">
            <span className="text-2xl" role="img" aria-label="佛珠">📿</span>
            <span className="text-sm font-medium tracking-wide">佛典数据库</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-xs text-[#d4c4a8]">
              收录 {initialTotal.toLocaleString()} 部经典
            </span>
            <Link
              href="/dictionary"
              className="rounded-lg border border-[#fff4e0]/20 bg-white/10 px-3 py-1.5 text-xs text-[#fff4e0] transition hover:bg-white/20"
            >
              佛学词典
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-[#2a1f16] to-[#3d3229] px-4 pb-12 pt-10 sm:pb-16 sm:pt-14">
          {/* 背景装饰 */}
          <div className="pointer-events-none absolute inset-0 opacity-10">
            <div className="absolute left-1/4 top-1/4 h-64 w-64 rounded-full bg-[#c4a46a] blur-[100px]" />
            <div className="absolute right-1/4 bottom-1/4 h-48 w-48 rounded-full bg-[#8a7a6a] blur-[80px]" />
          </div>

          <div className="relative mx-auto max-w-[680px]">
            {/* 标题区域 */}
            <div className="mb-8 text-center sm:mb-10">
              <h1 className="mb-3 text-2xl font-bold text-[#fff4e0] sm:text-3xl">
                佛典数据库
              </h1>
              <p className="text-sm text-[#d4c4a8] sm:text-base">
                收录大正藏、卍续藏等 {initialTotal.toLocaleString()} 部佛教经典
              </p>
            </div>

            {/* 搜索框 */}
            <form onSubmit={handleSubmit} className="relative" role="search">
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-2">
                <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-sm transition focus-within:border-white/40 focus-within:bg-white/15 sm:py-2.5">
                  <svg className="h-5 w-5 shrink-0 text-[#d4c4a8]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜索经文、译者、词条..."
                    className="flex-1 bg-transparent text-[15px] text-white placeholder:text-[#a09080] outline-none"
                    aria-label="搜索经文、译者、词条"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="p-1 text-[#a09080] transition hover:text-white"
                      aria-label="清除搜索内容"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="rounded-xl bg-[#c4a46a] px-6 py-3 text-sm font-medium text-[#2a1f16] transition hover:bg-[#d4b47a] active:scale-[0.98] sm:py-2.5"
                >
                  搜索
                </button>
              </div>
              {/* 搜索提示 */}
              <p className="mt-3 text-center text-xs text-[#8a7a6a]">
                试试搜索：金刚经、玄奘、般若、唐代
              </p>
            </form>
          </div>
        </section>

        {/* 主内容区 */}
        <div className="mx-auto max-w-[1000px] px-4 py-8 sm:py-12">
          {/* 无搜索时显示热门内容 */}
          {!q && (
            <div className="grid gap-8 lg:grid-cols-5 lg:gap-10">
              {/* 左侧：热门经书 */}
              <section className="lg:col-span-3" aria-labelledby="popular-sutras">
                <header className="mb-4 flex items-center justify-between">
                  <h2 id="popular-sutras" className="text-base font-medium text-[#3d3229]">
                    热门经书
                  </h2>
                  <Link
                    href="/sutra"
                    className="text-xs text-[#8a7a6a] transition hover:text-[#5a4a3a]"
                  >
                    查看全部 →
                  </Link>
                </header>
                <div className="grid gap-2 sm:grid-cols-2">
                  {popularTexts.map((item) => (
                    <article key={item.id}>
                      <Link
                        href={`/sutra/${encodeURIComponent(item.title)}/1`}
                        className="group flex h-11 items-center justify-between gap-3 rounded-lg border border-[#e8e0d5] bg-white px-4 transition hover:border-[#d0c8bd] hover:bg-[#fdfcfa]"
                      >
                        <h3 className="truncate text-[15px] text-[#3d3229] group-hover:text-[#2a1f16]">
                          {item.alias || item.title}
                        </h3>
                        {item.author && (
                          <span className="shrink-0 text-[11px] text-[#a09080]">{item.author}</span>
                        )}
                      </Link>
                    </article>
                  ))}
                </div>
              </section>

              {/* 右侧：热门词条 */}
              <aside className="lg:col-span-2">
                <section aria-labelledby="popular-terms">
                  <header className="mb-4 flex items-center justify-between">
                    <h2 id="popular-terms" className="text-base font-medium text-[#3d3229]">
                      热门词条
                    </h2>
                    <Link
                      href="/dictionary"
                      className="text-xs text-[#8a7a6a] transition hover:text-[#5a4a3a]"
                    >
                      查看全部 →
                    </Link>
                  </header>
                  <div className="flex flex-wrap gap-2">
                    {popularDictionary.map((item) => (
                      <Link
                        key={item.term}
                        href={`/dictionary/${encodeURIComponent(item.term)}`}
                        className="group rounded-lg border border-[#e8e0d5] bg-white px-3 py-2 transition hover:border-[#d0c8bd] hover:shadow-sm"
                      >
                        <span className="text-sm text-[#3d3229] group-hover:text-[#5a4a3a]">{item.term}</span>
                        <span className="ml-1.5 text-[10px] text-[#a09080]">{item.description}</span>
                      </Link>
                    ))}
                  </div>
                </section>
              </aside>
            </div>
          )}

          {/* 搜索结果 */}
          {q && (
            <div className="mx-auto max-w-[680px]">
              {/* 搜索状态栏 */}
              <div className="mb-6 flex items-center justify-between">
                <p className="text-sm text-[#6a5a4a]">
                  搜索 "<span className="font-medium text-[#3d3229]">{q}</span>" 的结果
                </p>
                <button
                  onClick={() => router.push('/')}
                  className="text-xs text-[#8a7a6a] transition hover:text-[#5a4a3a]"
                >
                  清除搜索
                </button>
              </div>

              {/* 加载状态 */}
              {loading && (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#e0d8cd] border-t-[#8a7a6a]" />
                  <span className="text-sm text-[#8a7a6a]">搜索中...</span>
                </div>
              )}

              {/* 搜索结果列表 */}
              {!loading && results && (
                <div className="space-y-6">
                  {/* 经文结果 */}
                  {results.results.texts.items.length > 0 && (
                    <section className="rounded-xl border border-[#e8e0d5] bg-white" aria-labelledby="search-texts">
                      <header className="flex items-center justify-between border-b border-[#f0ebe5] px-4 py-3">
                        <h2 id="search-texts" className="text-sm font-medium text-[#3d3229]">经典</h2>
                        <span className="text-xs text-[#9a8a7a]">{results.results.texts.total} 部</span>
                      </header>
                      <ul className="divide-y divide-[#f5f2ed]">
                        {results.results.texts.items.map((text) => (
                          <li key={text.id}>
                            <Link
                              href={`/sutra/${encodeURIComponent(text.title)}`}
                              className="flex items-center justify-between px-4 py-3 transition hover:bg-[#faf8f5]"
                            >
                              <div className="min-w-0 flex-1">
                                <h3 className="truncate text-sm text-[#3d3229]">{text.title}</h3>
                                {(text.translation_dynasty || text.author_raw) && (
                                  <p className="mt-0.5 truncate text-xs text-[#9a8a7a]">
                                    {text.translation_dynasty}{text.translation_dynasty && text.author_raw && ' · '}{text.author_raw}
                                  </p>
                                )}
                              </div>
                              {text.juan_count > 1 && (
                                <span className="ml-3 shrink-0 text-xs text-[#a09080]">{text.juan_count} 卷</span>
                              )}
                            </Link>
                          </li>
                        ))}
                      </ul>
                      {results.results.texts.total > 5 && (
                        <div className="border-t border-[#f0ebe5] px-4 py-3 text-center">
                          <Link href={`/sutra?q=${encodeURIComponent(q)}`} className="text-xs text-[#8a7a6a] hover:text-[#5a4a3a]">
                            查看全部 {results.results.texts.total} 部 →
                          </Link>
                        </div>
                      )}
                    </section>
                  )}

                  {/* 词典结果 */}
                  {results.results.dictionary.items.length > 0 && (
                    <section className="rounded-xl border border-[#e8e0d5] bg-white" aria-labelledby="search-dict">
                      <header className="flex items-center justify-between border-b border-[#f0ebe5] px-4 py-3">
                        <h2 id="search-dict" className="text-sm font-medium text-[#3d3229]">词典</h2>
                        <span className="text-xs text-[#9a8a7a]">{results.results.dictionary.total} 条</span>
                      </header>
                      <ul className="divide-y divide-[#f5f2ed]">
                        {results.results.dictionary.items.map((entry) => (
                          <li key={entry.id}>
                            <Link
                              href={`/dictionary/${encodeURIComponent(entry.term)}`}
                              className="block px-4 py-3 transition hover:bg-[#faf8f5]"
                            >
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-medium text-[#3d3229]">{entry.term}</h3>
                                <span className="rounded bg-[#f5f2ed] px-1.5 py-0.5 text-[10px] text-[#8a7a6a]">{entry.source}</span>
                              </div>
                              <p className="mt-1 line-clamp-2 text-xs text-[#8a7a6a]">{entry.definition_preview}</p>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {/* 人物结果 */}
                  {results.results.persons.items.length > 0 && (
                    <section className="rounded-xl border border-[#e8e0d5] bg-white" aria-labelledby="search-persons">
                      <header className="flex items-center justify-between border-b border-[#f0ebe5] px-4 py-3">
                        <h2 id="search-persons" className="text-sm font-medium text-[#3d3229]">人物</h2>
                        <span className="text-xs text-[#9a8a7a]">{results.results.persons.total} 位</span>
                      </header>
                      <ul className="divide-y divide-[#f5f2ed]">
                        {results.results.persons.items.map((person) => (
                          <li key={person.id}>
                            <Link
                              href={`/person/${encodeURIComponent(person.name)}`}
                              className="block px-4 py-3 transition hover:bg-[#faf8f5]"
                            >
                              <h3 className="text-sm text-[#3d3229]">{person.name}</h3>
                              {(person.dynasty_name || person.identity) && (
                                <p className="mt-0.5 text-xs text-[#9a8a7a]">
                                  {person.dynasty_name}{person.dynasty_name && person.identity && ' · '}{person.identity}
                                </p>
                              )}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {/* 全文搜索按钮 */}
                  {hasResults && !showContentSearch && (
                    <div className="text-center">
                      <button
                        onClick={searchContent}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#d0c8bd] bg-white px-5 py-2.5 text-sm text-[#5a4a3a] transition hover:bg-[#faf8f5] hover:border-[#c0b8ad]"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        在经文内容中搜索
                      </button>
                    </div>
                  )}

                  {/* 全文搜索结果 */}
                  {showContentSearch && (
                    <section className="rounded-xl border border-[#e8e0d5] bg-white" aria-labelledby="search-content">
                      <header className="flex items-center justify-between border-b border-[#f0ebe5] px-4 py-3">
                        <h2 id="search-content" className="text-sm font-medium text-[#3d3229]">经文内容</h2>
                        {contentResults && (
                          <span className="text-xs text-[#9a8a7a]">{contentResults.pagination.total} 条</span>
                        )}
                      </header>

                      {contentLoading && !contentResults && (
                        <div className="flex items-center justify-center py-12">
                          <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-[#d0c8bd] border-t-[#8a7a6a]" />
                          <span className="text-sm text-[#8a7a6a]">搜索中...</span>
                        </div>
                      )}

                      {contentResults && (
                        <>
                          <ul className="divide-y divide-[#f5f2ed]">
                            {contentResults.data.map((item, idx) => (
                              <li key={`${item.text_id}-${item.juan}-${idx}`}>
                                <Link
                                  href={`/sutra/${encodeURIComponent(item.title)}/${item.juan}`}
                                  className="block px-4 py-3 transition hover:bg-[#faf8f5]"
                                >
                                  <div className="flex items-center gap-2">
                                    <h3 className="text-sm text-[#3d3229]">{item.title}</h3>
                                    <span className="text-xs text-[#9a8a7a]">第{item.juan}卷</span>
                                  </div>
                                  <p
                                    className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[#6a5a4a] [&_mark]:bg-[#fef3c7] [&_mark]:px-0.5 [&_mark]:rounded"
                                    dangerouslySetInnerHTML={{ __html: item.snippet }}
                                  />
                                </Link>
                              </li>
                            ))}
                          </ul>

                          {contentResults.data.length < contentResults.pagination.total && (
                            <div className="border-t border-[#f0ebe5] px-4 py-3 text-center">
                              <button
                                onClick={loadMoreContent}
                                disabled={contentLoading}
                                className="text-xs text-[#8a7a6a] transition hover:text-[#5a4a3a] disabled:opacity-50"
                              >
                                {contentLoading ? '加载中...' : `加载更多（还有 ${contentResults.pagination.total - contentResults.data.length} 条）`}
                              </button>
                            </div>
                          )}
                        </>
                      )}

                      {contentResults?.data.length === 0 && (
                        <div className="py-12 text-center text-sm text-[#9a8a7a]">未找到相关经文内容</div>
                      )}
                    </section>
                  )}

                  {/* 无结果 */}
                  {!hasResults && !results.searchedContent && (
                    <div className="py-16 text-center">
                      <div className="mb-3 text-4xl">🔍</div>
                      <p className="text-sm text-[#8a7a6a]">未找到与 "{q}" 相关的结果</p>
                      <p className="mt-2 text-xs text-[#a09080]">试试其他关键词，或者在经文内容中搜索</p>
                      {!showContentSearch && (
                        <button
                          onClick={searchContent}
                          className="mt-4 rounded-lg border border-[#d0c8bd] bg-white px-4 py-2 text-xs text-[#6a5a4a] transition hover:bg-[#faf8f5]"
                        >
                          在经文内容中搜索
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!loading && !results && (
                <div className="py-16 text-center text-sm text-[#9a8a7a]">搜索出错，请稍后重试</div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#e8e0d5] bg-[#faf8f5] px-4 py-6">
        <div className="mx-auto max-w-[1000px]">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-xs text-[#9a8a7a]">
              数据来源：<a href="https://cbeta.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#6a5a4a]">CBETA 中华电子佛典协会</a>
            </p>
            <div className="flex items-center gap-4 text-xs text-[#9a8a7a]">
              <Link href="/dictionary" className="hover:text-[#6a5a4a]">佛学词典</Link>
              <span className="text-[#d0c8bd]">·</span>
              <Link href="/sutra" className="hover:text-[#6a5a4a]">经典列表</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
