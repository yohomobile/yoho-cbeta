'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api'

const popularDictionary = [
  { term: '般若', tag: '智慧' },
  { term: '空', tag: '核心概念' },
  { term: '涅槃', tag: '解脱' },
  { term: '菩提', tag: '觉悟' },
  { term: '因果', tag: '业报' },
  { term: '三昧', tag: '禅定' },
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
  const showMatch = Boolean(results && q.trim())
  const matchedTotal = results?.results.texts.total ?? 0

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f8f5f0] text-[#3d3229]">
      {/* 背景纹理 */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.03] [background-image:url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%233d3229%22%20fill-opacity%3D%221%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')]" />
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#f8f5f0] via-transparent to-[#f8f5f0]" />

      <div className="relative">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-[#e8e0d5] bg-[#f8f5f0]/95 backdrop-blur-sm">
          <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2 text-[#5a4a3a] transition hover:opacity-70">
              <span className="shrink-0 text-xl" role="img" aria-hidden="true">📿</span>
              <span className="text-sm font-medium tracking-wide">佛典数据库</span>
            </Link>
            <div className="hidden md:flex items-center gap-3 text-xs text-[#8a7a6a]">
              <span className="px-2.5 py-1">收录 {initialTotal.toLocaleString()} 部</span>
              {showMatch && (
                <span className="px-2.5 py-1 text-[#a08060]">匹配 {matchedTotal.toLocaleString()} 部</span>
              )}
              <Link
                href="/dictionary"
                className="rounded-md border border-[#d8d0c5] bg-white/50 px-3 py-1.5 text-[#5a4a3a] transition hover:bg-white hover:border-[#c8c0b5]"
              >
                词典
              </Link>
            </div>
            <div className="flex items-center md:hidden">
              <Link
                href="/dictionary"
                className="rounded-md border border-[#d8d0c5] bg-white/50 px-3 py-1.5 text-xs text-[#5a4a3a] transition hover:bg-white"
              >
                词典
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[680px] px-4 py-12 sm:py-16">
          {/* Search Section */}
          <section className="relative">
            <form onSubmit={handleSubmit} className="relative">
              {/* Desktop: 横排布局 */}
              <div className="hidden sm:flex items-center gap-2 rounded-xl border border-[#e0d8cd] bg-white p-1.5 shadow-sm transition-shadow duration-300 focus-within:border-[#d0c8bd] focus-within:shadow-md">
                <span className="pointer-events-none pl-3 text-[#b0a090]">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索经文、译者、朝代、词条..."
                  className="flex-1 bg-transparent py-2.5 text-[15px] text-[#3d3229] placeholder:text-[#a09080] outline-none"
                  aria-label="搜索经文与词条"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="p-1.5 text-[#b0a090] transition hover:text-[#8a7a6a]"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                <button
                  type="submit"
                  className="rounded-lg bg-[#6b5b4b] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#5a4a3a] active:scale-[0.98]"
                >
                  搜索
                </button>
              </div>

              {/* Mobile: 竖排布局 */}
              <div className="flex flex-col gap-2 sm:hidden">
                <div className="flex items-center gap-2 rounded-xl border border-[#e0d8cd] bg-white p-1.5 shadow-sm transition-shadow duration-300 focus-within:border-[#d0c8bd] focus-within:shadow-md">
                  <span className="pointer-events-none pl-3 text-[#b0a090]">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜索经文、译者、朝代..."
                    className="flex-1 bg-transparent py-3 text-[16px] text-[#3d3229] placeholder:text-[#a09080] outline-none"
                    aria-label="搜索经文与词条"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="p-1.5 text-[#b0a090] transition hover:text-[#8a7a6a]"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-[#6b5b4b] py-3 text-[15px] font-medium text-white transition hover:bg-[#5a4a3a] active:scale-[0.98]"
                >
                  搜索
                </button>
              </div>
            </form>
          </section>

          {/* Popular Content */}
          {!q && (
            <div className="mt-10 space-y-8">
              {/* 热门经书 */}
              <section>
                <div className="mb-4 flex items-center gap-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#e0d8cd]" />
                  <span className="text-xs tracking-wider text-[#9a8a7a]">热门经书</span>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#e0d8cd]" />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {popularTexts.map((item) => (
                    <Link
                      key={item.id}
                      href={`/sutra/${encodeURIComponent(item.title)}/1`}
                      className="group flex items-center justify-between rounded-lg border border-[#e8e0d5] bg-white/60 p-3.5 transition hover:border-[#d0c8bd] hover:bg-white"
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-sm text-[#3d3229] group-hover:text-[#5a4a3a]">
                          {item.title}
                        </h4>
                        <p className="mt-0.5 truncate text-xs text-[#9a8a7a]">
                          {item.dynasty} · {item.author}
                        </p>
                      </div>
                      <svg className="ml-2 h-4 w-4 shrink-0 text-[#c8c0b5] transition group-hover:text-[#a09080]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  ))}
                </div>
                <div className="mt-3 text-center">
                  <Link
                    href="/sutra"
                    className="inline-flex items-center gap-1 text-xs text-[#8a7a6a] transition hover:text-[#5a4a3a]"
                  >
                    查看全部
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Link>
                </div>
              </section>

              {/* 热门词典 */}
              <section>
                <div className="mb-4 flex items-center gap-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#e0d8cd]" />
                  <span className="text-xs tracking-wider text-[#9a8a7a]">热门词典</span>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#e0d8cd]" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {popularDictionary.map((item) => (
                    <Link
                      key={item.term}
                      href={`/dictionary/${encodeURIComponent(item.term)}`}
                      className="rounded-full border border-[#e0d8cd] bg-white/60 px-4 py-1.5 text-sm text-[#5a4a3a] transition hover:border-[#d0c8bd] hover:bg-white"
                    >
                      {item.term}
                    </Link>
                  ))}
                </div>
                <div className="mt-3 text-center">
                  <Link
                    href="/dictionary/popular"
                    className="inline-flex items-center gap-1 text-xs text-[#8a7a6a] transition hover:text-[#5a4a3a]"
                  >
                    查看全部
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Link>
                </div>
              </section>
            </div>
          )}

          {/* Search Results */}
          {q && (
            <div className="mt-8 space-y-6">
              {loading && (
                <div className="flex flex-col items-center justify-center py-12 text-[#8a7a6a]">
                  <div className="mb-3 h-6 w-6 animate-spin rounded-full border-2 border-[#d0c8bd] border-t-[#8a7a6a]" />
                  <span className="text-sm">搜索中...</span>
                </div>
              )}

              {!loading && results && (
                <>
                  {/* 经文结果 */}
                  {results.results.texts.items.length > 0 && (
                    <section className="rounded-xl border border-[#e8e0d5] bg-white/70 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-medium text-[#3d3229]">经文</h3>
                        <span className="text-xs text-[#9a8a7a]">{results.results.texts.total} 部</span>
                      </div>
                      <div className="space-y-2">
                        {results.results.texts.items.map((text) => (
                          <Link
                            key={text.id}
                            href={`/sutra/${encodeURIComponent(text.title)}`}
                            className="block rounded-lg border border-transparent p-2.5 transition hover:border-[#e0d8cd] hover:bg-white"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm text-[#3d3229]">{text.title}</span>
                              {text.juan_count > 1 && (
                                <span className="shrink-0 text-xs text-[#9a8a7a]">{text.juan_count} 卷</span>
                              )}
                            </div>
                            {(text.translation_dynasty || text.author_raw) && (
                              <p className="mt-0.5 text-xs text-[#9a8a7a]">
                                {text.translation_dynasty && `${text.translation_dynasty} · `}
                                {text.author_raw}
                              </p>
                            )}
                          </Link>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* 词典结果 */}
                  {results.results.dictionary.items.length > 0 && (
                    <section className="rounded-xl border border-[#e8e0d5] bg-white/70 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-medium text-[#3d3229]">词典</h3>
                        <span className="text-xs text-[#9a8a7a]">{results.results.dictionary.total} 条</span>
                      </div>
                      <div className="space-y-2">
                        {results.results.dictionary.items.map((entry) => (
                          <Link
                            key={entry.id}
                            href={`/dictionary/${encodeURIComponent(entry.term)}`}
                            className="block rounded-lg border border-transparent p-2.5 transition hover:border-[#e0d8cd] hover:bg-white"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm text-[#3d3229]">{entry.term}</span>
                              <span className="shrink-0 rounded bg-[#f5f2ee] px-1.5 py-0.5 text-[10px] text-[#8a7a6a]">{entry.source}</span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-[#8a7a6a]">{entry.definition_preview}</p>
                          </Link>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* 人物结果 */}
                  {results.results.persons.items.length > 0 && (
                    <section className="rounded-xl border border-[#e8e0d5] bg-white/70 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-medium text-[#3d3229]">人物</h3>
                        <span className="text-xs text-[#9a8a7a]">{results.results.persons.total} 位</span>
                      </div>
                      <div className="space-y-2">
                        {results.results.persons.items.map((person) => (
                          <Link
                            key={person.id}
                            href={`/person/${encodeURIComponent(person.name)}`}
                            className="block rounded-lg border border-transparent p-2.5 transition hover:border-[#e0d8cd] hover:bg-white"
                          >
                            <span className="text-sm text-[#3d3229]">{person.name}</span>
                            {(person.dynasty_name || person.identity) && (
                              <p className="mt-0.5 text-xs text-[#9a8a7a]">
                                {person.dynasty_name} {person.identity}
                              </p>
                            )}
                          </Link>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* 内容片段结果 */}
                  {results.searchedContent && results.results.content && results.results.content.items.length > 0 && (
                    <section className="rounded-xl border border-[#e8e0d5] bg-white/70 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-medium text-[#3d3229]">经文内容</h3>
                        <span className="text-xs text-[#9a8a7a]">{results.results.content.total} 条</span>
                      </div>
                      <div className="space-y-2">
                        {results.results.content.items.map((item, idx) => (
                          <Link
                            key={`${item.text_id}-${item.juan}-${idx}`}
                            href={`/sutra/${encodeURIComponent(item.title)}/${item.juan}`}
                            className="block rounded-lg border border-transparent p-2.5 transition hover:border-[#e0d8cd] hover:bg-white"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-[#3d3229]">{item.title}</span>
                              <span className="text-xs text-[#9a8a7a]">第{item.juan}卷</span>
                            </div>
                            <p
                              className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#6a5a4a] [&_mark]:bg-[#f0e8d8] [&_mark]:px-0.5"
                              dangerouslySetInnerHTML={{ __html: item.snippet }}
                            />
                          </Link>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* 全文搜索按钮 */}
                  {hasResults && !showContentSearch && (
                    <div className="text-center">
                      <button
                        onClick={searchContent}
                        className="rounded-lg border border-[#d0c8bd] bg-white/60 px-4 py-2 text-xs text-[#6a5a4a] transition hover:bg-white hover:border-[#c0b8ad]"
                      >
                        在经文内容中搜索
                      </button>
                    </div>
                  )}

                  {/* 全文搜索结果 */}
                  {showContentSearch && (
                    <section className="rounded-xl border border-[#e8e0d5] bg-white/70 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-medium text-[#3d3229]">全文检索</h3>
                        {contentResults && (
                          <span className="text-xs text-[#9a8a7a]">{contentResults.pagination.total} 条</span>
                        )}
                      </div>

                      {contentLoading && !contentResults && (
                        <div className="flex items-center justify-center py-8 text-[#8a7a6a]">
                          <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-[#d0c8bd] border-t-[#8a7a6a]" />
                          <span className="text-sm">搜索中...</span>
                        </div>
                      )}

                      {contentResults && (
                        <>
                          <div className="space-y-2">
                            {contentResults.data.map((item, idx) => (
                              <Link
                                key={`${item.text_id}-${item.juan}-${idx}`}
                                href={`/sutra/${encodeURIComponent(item.title)}/${item.juan}`}
                                className="block rounded-lg border border-transparent p-2.5 transition hover:border-[#e0d8cd] hover:bg-white"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-[#3d3229]">{item.title}</span>
                                  <span className="text-xs text-[#9a8a7a]">第{item.juan}卷</span>
                                  {item.author_raw && <span className="text-xs text-[#a09080]">{item.author_raw}</span>}
                                </div>
                                <p
                                  className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#6a5a4a] [&_mark]:bg-[#f0e8d8] [&_mark]:px-0.5"
                                  dangerouslySetInnerHTML={{ __html: item.snippet }}
                                />
                              </Link>
                            ))}
                          </div>

                          {contentResults.data.length < contentResults.pagination.total && (
                            <div className="mt-4 text-center">
                              <button
                                onClick={loadMoreContent}
                                disabled={contentLoading}
                                className="rounded-lg border border-[#d0c8bd] bg-white/60 px-4 py-2 text-xs text-[#6a5a4a] transition hover:bg-white disabled:opacity-50"
                              >
                                {contentLoading ? '加载中...' : '加载更多'}
                              </button>
                            </div>
                          )}
                        </>
                      )}

                      {contentResults?.data.length === 0 && (
                        <div className="py-8 text-center text-sm text-[#9a8a7a]">未找到相关结果</div>
                      )}
                    </section>
                  )}

                  {/* 无结果 */}
                  {!hasResults && !results.searchedContent && (
                    <div className="py-12 text-center text-sm text-[#9a8a7a]">未找到相关结果</div>
                  )}
                </>
              )}

              {!loading && !results && (
                <div className="py-12 text-center text-sm text-[#9a8a7a]">搜索出错，请稍后重试</div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
