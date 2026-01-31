'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBookOpen } from '@fortawesome/free-solid-svg-icons'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api'

const popularTerms = [
  '般若', '空', '涅槃', '菩提', '因果', '三昧', '佛陀', '菩萨',
  '阿罗汉', '缘起', '轮回', '解脱', '四谛', '八正道', '五蕴', '十二因缘',
  '如来', '法身', '慈悲', '无常', '无我', '六度', '戒定慧', '三宝',
  '阿弥陀佛', '观世音', '文殊', '普贤', '地藏', '弥勒', '药师',
  '净土', '禅宗', '密宗', '华严', '天台', '唯识', '中观',
  '业力', '福报', '功德', '回向', '发愿', '忏悔', '供养', '礼拜',
  '布施', '持戒', '忍辱', '精进', '禅定', '智慧',
  '贪嗔痴', '烦恼', '无明', '执著', '我执', '法执',
  '真如', '实相', '佛性', '自性', '本心', '觉性',
  '三界', '六道', '天道', '人道', '畜生', '饿鬼', '地狱',
  '声闻', '缘觉', '菩萨道', '佛道', '一乘', '三乘',
  '四圣谛', '十善', '五戒', '菩萨戒', '比丘戒',
  '念佛', '持咒', '诵经', '打坐', '参禅', '观想',
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
  const [aiMode, setAiMode] = useState(false)
  const [aiAnswer, setAiAnswer] = useState<{
    question: string
    summary: string
    // 术语解释
    terminology?: Array<{
      term: string
      definition: string
      source: string
    }>
    // 详细要点
    points: Array<{
      title: string
      explanation: string
      citations: Array<{
        quote: string
        sutraTitle: string
        juan: number
        textId: string
        matchType: string[]
      }>
    }>
    // 多经对比（可选）
    comparison?: Array<{
      aspect: string
      views: Array<{
        sutra: string
        position: string
        quote: string
      }>
    }>
    // 层次解读（可选）
    levels?: {
      literal: string
      profound: string
      practice?: string
    }
    // 推荐追问
    followUpQuestions: string[]
    // 来源
    sources: Array<{
      textId: string
      title: string
      juan: number
      retrievalMethods: string[]
      similarity?: number
    }>
    // 性能指标
    meta?: {
      totalChunksSearched: number
      retrievalTimeMs: number
      generationTimeMs: number
    }
  } | null>(null)

  const doSearch = useCallback(async (searchQuery: string, useAi: boolean) => {
    if (!searchQuery.trim()) return

    setLoading(true)
    setResults(null)
    setContentResults(null)
    setShowContentSearch(false)
    setAiAnswer(null)

    if (useAi) {
      // AI 深度问答模式 (使用 LangChain 多路检索)
      // 使用 BM25 版本的 API 端点
      const apiEndpoint = 'deep-ask-bm25'
      try {
        const res = await fetch(`${API_BASE}/${apiEndpoint}?q=${encodeURIComponent(searchQuery)}`)
        const data = await res.json()
        if (data.error) {
          console.error('AI 问答失败:', data.error)
        } else {
          setAiAnswer(data)
        }
      } catch (err) {
        console.error('AI 问答失败:', err)
      } finally {
        setLoading(false)
      }
    } else {
      // 普通搜索模式
      try {
        const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(searchQuery)}&limit=5`)
        const data: SearchResults = await res.json()
        setResults(data)
      } catch (err) {
        console.error('搜索失败:', err)
      } finally {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (q) {
      setQuery(q)
      doSearch(q, aiMode)
    } else {
      setQuery('')
      setResults(null)
      setContentResults(null)
      setShowContentSearch(false)
      setAiAnswer(null)
    }
  }, [q, doSearch, aiMode])

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
              {/* AI 问答选项 */}
              <div className="mt-3 flex items-center justify-center gap-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={aiMode}
                    onChange={(e) => setAiMode(e.target.checked)}
                    className="h-4 w-4 rounded border-white/30 bg-white/10 text-[#c4a46a] focus:ring-[#c4a46a] focus:ring-offset-0"
                  />
                  <span className="text-sm text-[#d4c4a8]">AI 问答</span>
                  <span className="text-xs text-[#8a7a6a]">(基于 BM25 + 语义搜索)</span>
                </label>
              </div>
              {/* 搜索提示 */}
              <p className="mt-2 text-center text-xs text-[#8a7a6a]">
                {aiMode ? '试试问：什么是五蕴、菩萨如何修行、什么是涅槃' : '试试搜索：金刚经、玄奘、般若、唐代'}
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
                        prefetch={false}
                        className="group flex items-center gap-2.5 rounded-lg border border-[#e8e0d5] bg-white px-3 py-2.5 transition hover:border-[#d0c8bd] hover:bg-[#fdfcfa] hover:shadow-sm"
                      >
                        <FontAwesomeIcon icon={faBookOpen} className="h-3.5 w-3.5 shrink-0 text-[#a09080] group-hover:text-[#8a7a6a]" />
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-[14px] font-medium text-[#3d3229] group-hover:text-[#2a1f16]">
                            {item.alias || item.title}
                          </h3>
                        </div>
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
                  <div className="flex flex-wrap gap-1.5">
                    {popularTerms.map((term) => (
                      <Link
                        key={term}
                        href={`/dictionary/${encodeURIComponent(term)}`}
                        prefetch={false}
                        className="rounded-md border border-[#e8e0d5] bg-white px-2.5 py-1 text-[13px] text-[#3d3229] transition hover:border-[#d0c8bd] hover:bg-[#fdfcfa] hover:text-[#5a4a3a]"
                      >
                        {term}
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
                  <span className="text-sm text-[#8a7a6a]">{aiMode ? 'AI 正在思考...' : '搜索中...'}</span>
                </div>
              )}

              {/* AI 问答结果 */}
              {!loading && aiAnswer && (
                <div className="space-y-4">
                  <section className="overflow-hidden rounded-xl border border-[#d4c4a8] bg-gradient-to-b from-[#fdfcfa] to-white shadow-sm" aria-labelledby="ai-answer">
                    <header className="flex items-center gap-2 bg-gradient-to-r from-[#f5f0e8] to-[#fdfcfa] px-5 py-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#c4a46a] text-sm text-white">AI</span>
                      <h2 id="ai-answer" className="text-sm font-medium text-[#3d3229]">智能问答</h2>
                    </header>

                    <div className="px-5 py-5 space-y-5">
                      {/* 简要回答 */}
                      <div className="rounded-lg bg-[#f8f5f0] px-4 py-3">
                        <p className="text-[15px] leading-relaxed text-[#3d3229]">{aiAnswer.summary}</p>
                      </div>

                      {/* 术语解释 */}
                      {aiAnswer.terminology && aiAnswer.terminology.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium text-[#5a4a3a]">相关术语</h3>
                          <div className="flex flex-wrap gap-2">
                            {aiAnswer.terminology.map((term, idx) => (
                              <div key={idx} className="group relative">
                                <span className="inline-flex cursor-help items-center gap-1 rounded-md border border-[#d4c4a8] bg-[#faf8f5] px-2 py-1 text-sm text-[#3d3229]">
                                  <svg className="h-3 w-3 text-[#c4a46a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  {term.term}
                                </span>
                                <div className="absolute left-0 top-full z-10 mt-1 hidden w-64 rounded-lg border border-[#e8e0d5] bg-white p-3 shadow-lg group-hover:block">
                                  <p className="text-xs leading-relaxed text-[#3d3229]">{term.definition}</p>
                                  <p className="mt-1 text-[10px] text-[#9a8a7a]">来源：{term.source}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 详细要点 */}
                      {aiAnswer.points && aiAnswer.points.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="text-sm font-medium text-[#5a4a3a]">详细解释</h3>
                          {aiAnswer.points.map((point, idx) => (
                            <div key={idx} className="rounded-lg border border-[#e8e0d5] bg-white p-4">
                              <h4 className="mb-2 font-semibold text-[#2a1f16]">{point.title}</h4>
                              <p className="mb-3 text-sm leading-relaxed text-[#3d3229]">{point.explanation}</p>
                              {/* 经文引用列表 */}
                              {point.citations && point.citations.length > 0 && (
                                <div className="space-y-2">
                                  {point.citations.map((citation, citIdx) => (
                                    <div key={citIdx} className="rounded-md bg-[#faf8f5] p-3">
                                      <p className="mb-2 text-sm italic text-[#6a5a4a]">"{citation.quote}"</p>
                                      <div className="flex items-center justify-between">
                                        <Link
                                          href={`/sutra/${encodeURIComponent(citation.sutraTitle)}/${citation.juan}`}
                                          prefetch={false}
                                          className="inline-flex items-center gap-1 text-xs text-[#8a7a6a] hover:text-[#5a4a3a] hover:underline"
                                        >
                                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                          </svg>
                                          《{citation.sutraTitle}》第{citation.juan}卷
                                        </Link>
                                        {/* 检索方式标记 */}
                                        {citation.matchType && citation.matchType.length > 0 && (
                                          <div className="flex gap-1">
                                            {citation.matchType.includes('semantic') && citation.matchType.includes('fulltext') ? (
                                              <span className="rounded bg-[#c4a46a] px-1.5 py-0.5 text-[10px] text-white">多路命中</span>
                                            ) : citation.matchType.includes('semantic') ? (
                                              <span className="rounded bg-[#8a9a7a] px-1.5 py-0.5 text-[10px] text-white">语义</span>
                                            ) : citation.matchType.includes('fulltext') ? (
                                              <span className="rounded bg-[#7a8a9a] px-1.5 py-0.5 text-[10px] text-white">关键词</span>
                                            ) : null}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 多经对比 */}
                      {aiAnswer.comparison && aiAnswer.comparison.length > 0 && (
                        <div className="border-t border-[#e8e0d5] pt-4">
                          <h3 className="mb-3 text-sm font-medium text-[#5a4a3a]">📊 多经对比</h3>
                          {aiAnswer.comparison.map((comp, idx) => (
                            <div key={idx} className="mb-4 rounded-lg border border-[#d4c4a8] bg-[#fdfcfa] p-4">
                              <h4 className="mb-3 text-sm font-medium text-[#2a1f16]">{comp.aspect}</h4>
                              <div className="grid gap-3 sm:grid-cols-2">
                                {comp.views.map((view, vIdx) => (
                                  <div key={vIdx} className="rounded-md bg-white p-3 border border-[#e8e0d5]">
                                    <p className="mb-1 text-xs font-medium text-[#c4a46a]">《{view.sutra}》</p>
                                    <p className="mb-2 text-sm text-[#3d3229]">{view.position}</p>
                                    <p className="text-xs italic text-[#6a5a4a]">"{view.quote}"</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 层次解读 */}
                      {aiAnswer.levels && (
                        <div className="border-t border-[#e8e0d5] pt-4">
                          <h3 className="mb-3 text-sm font-medium text-[#5a4a3a]">📚 层次解读</h3>
                          <div className="space-y-3">
                            <div className="rounded-lg bg-[#f8f5f0] p-3">
                              <p className="mb-1 text-xs font-medium text-[#8a7a6a]">字面含义</p>
                              <p className="text-sm text-[#3d3229]">{aiAnswer.levels.literal}</p>
                            </div>
                            <div className="rounded-lg bg-[#f5f0e8] p-3">
                              <p className="mb-1 text-xs font-medium text-[#8a7a6a]">深层义理</p>
                              <p className="text-sm text-[#3d3229]">{aiAnswer.levels.profound}</p>
                            </div>
                            {aiAnswer.levels.practice && (
                              <div className="rounded-lg bg-[#f0ebe5] p-3">
                                <p className="mb-1 text-xs font-medium text-[#8a7a6a]">修行指导</p>
                                <p className="text-sm text-[#3d3229]">{aiAnswer.levels.practice}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 推荐追问 */}
                      {aiAnswer.followUpQuestions && aiAnswer.followUpQuestions.length > 0 && (
                        <div className="border-t border-[#e8e0d5] pt-4">
                          <h3 className="mb-3 text-sm font-medium text-[#5a4a3a]">相关问题</h3>
                          <div className="flex flex-wrap gap-2">
                            {aiAnswer.followUpQuestions.map((question, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  setQuery(question)
                                  router.push(`/?q=${encodeURIComponent(question)}`)
                                }}
                                className="rounded-full border border-[#d4c4a8] bg-white px-3 py-1.5 text-sm text-[#5a4a3a] transition hover:bg-[#f8f5f0] hover:border-[#c4a46a]"
                              >
                                {question}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 参考来源 - 折叠在回答下方 */}
                    {aiAnswer.sources.length > 0 && (
                      <div className="border-t border-[#e8e0d5] bg-[#faf8f5] px-5 py-3">
                        <details className="group">
                          <summary className="flex cursor-pointer list-none items-center gap-2 text-xs text-[#8a7a6a] hover:text-[#5a4a3a]">
                            <svg className="h-4 w-4 transition group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            查看检索来源（{aiAnswer.sources.length} 条）
                            {aiAnswer.meta && (
                              <span className="ml-2 text-[10px] text-[#a09080]">
                                检索 {aiAnswer.meta.retrievalTimeMs}ms · 生成 {(aiAnswer.meta.generationTimeMs / 1000).toFixed(1)}s
                              </span>
                            )}
                          </summary>
                          <ul className="mt-3 space-y-2">
                            {aiAnswer.sources.map((source, idx) => (
                              <li key={`${source.textId}-${source.juan}-${idx}`}>
                                <Link
                                  href={`/sutra/${encodeURIComponent(source.title)}/${source.juan}`}
                                  prefetch={false}
                                  className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm transition hover:bg-[#f5f2ed]"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-[#3d3229]">《{source.title}》</span>
                                    <span className="text-xs text-[#9a8a7a]">第{source.juan}卷</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {/* 检索方式标签 */}
                                    {source.retrievalMethods && source.retrievalMethods.length > 0 && (
                                      <div className="flex gap-1">
                                        {source.retrievalMethods.map((method, mIdx) => (
                                          <span
                                            key={mIdx}
                                            className={`rounded px-1.5 py-0.5 text-[10px] ${
                                              method === 'semantic' ? 'bg-[#8a9a7a] text-white' :
                                              method === 'fulltext' ? 'bg-[#7a8a9a] text-white' :
                                              'bg-[#9a8a7a] text-white'
                                            }`}
                                          >
                                            {method === 'semantic' ? '语义' : method === 'fulltext' ? '关键词' : '词典'}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    {source.similarity !== undefined && source.similarity < 1 && (
                                      <span className="rounded bg-[#e8e0d5] px-1.5 py-0.5 text-[10px] text-[#6a5a4a]">
                                        {(source.similarity * 100).toFixed(0)}%
                                      </span>
                                    )}
                                  </div>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </details>
                      </div>
                    )}
                  </section>
                </div>
              )}

              {/* 搜索结果列表 */}
              {!loading && !aiMode && results && (
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
                              prefetch={false}
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
                              prefetch={false}
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
                              prefetch={false}
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
                                  prefetch={false}
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

              {!loading && !aiMode && !results && (
                <div className="py-16 text-center text-sm text-[#9a8a7a]">搜索出错，请稍后重试</div>
              )}

              {!loading && aiMode && !aiAnswer && (
                <div className="py-16 text-center text-sm text-[#9a8a7a]">AI 问答暂时不可用，请稍后重试</div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#e8e0d5] bg-[#faf8f5] px-4 py-8">
        <div className="mx-auto max-w-[1000px]">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row sm:items-start">
            <div className="text-center sm:text-left">
              <p className="text-sm font-medium text-[#3d3229]">佛典数据库</p>
              <p className="mt-1 text-xs text-[#9a8a7a]">
                数据来源：<a href="https://cbeta.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#6a5a4a]">CBETA 中华电子佛典协会</a>
              </p>
            </div>
            <nav className="flex items-center gap-6 text-xs text-[#9a8a7a]">
              <Link href="/about" className="hover:text-[#6a5a4a]">关于本站</Link>
              <Link href="/sutra" className="hover:text-[#6a5a4a]">全部佛典</Link>
              <Link href="/dictionary" className="hover:text-[#6a5a4a]">全部词条</Link>
              <Link href="/person" className="hover:text-[#6a5a4a]">全部人物</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  )
}
