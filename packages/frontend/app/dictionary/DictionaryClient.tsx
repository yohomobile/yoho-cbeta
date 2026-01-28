'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Header from '../components/Header'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api'

interface DictionaryEntry {
  id?: number
  term: string
  definition_preview?: string
  definition?: string
  definition_text?: string
  source: string
}

interface DictionarySource {
  source: string
  count: string
}

interface DictionaryClientProps {
  initialFeatured: DictionaryEntry[]
  sources: DictionarySource[]
  totalCount: number
  initialTerm?: string
  initialTermDetail?: TermDetail | null
}

interface TermDetail {
  term: string
  entries: DictionaryEntry[]
  related: string[]
}

/**
 * 清理和标准化词典 HTML
 * 适配多种词典格式
 */
function sanitizeDefinitionHtml(html: string, source: string): string {
  let cleaned = html
    // 移除 html/body 标签
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<\/?body[^>]*>/gi, '')
    // 移除 BOM
    .replace(/\ufeff/g, '')
    // 移除 link 标签（css引用）
    .replace(/<link[^>]*>/gi, '')
    // 移除所有图片
    .replace(/<img[^>]*>/gi, '')
    // 移除首行标题（词条名已在页面顶部显示）
    .replace(/^<font[^>]*size=5[^>]*color=red[^>]*>[^<]*<\/font>\s*/i, '')
    .replace(/^<span[^>]*color:\s*#000080[^>]*>[^<]*<\/span>\s*<hr[^>]*>/i, '')

  // 通用：移除词典来源标签 【xxx】
  cleaned = cleaned.replace(/<span class="cdbt">[^<]*<\/span>\s*<br\s*\/?>/gi, '')

  // 丁福保词典
  if (source.includes('丁福保')) {
    cleaned = cleaned
      // 移除所有 font 标签
      .replace(/<font[^>]*>/gi, '')
      .replace(/<\/font>/gi, '')
      // 将 \r\n 转换，但保持段落
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // 处理全角空格开头的段落（保留缩进）
      .replace(/\n　/g, '</p><p class="dict-para">　')
      // 其他换行变成空格
      .replace(/\n/g, '')
      // 包裹在段落中
      .replace(/^/, '<p class="dict-para">')
      .replace(/$/, '</p>')
  }

  // 佛光词典
  else if (source.includes('佛光')) {
    cleaned = cleaned
      // 移除 hr
      .replace(/<hr[^>]*>/gi, '')
      // 处理换行
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // 用段落替换换行
      .replace(/\n\n+/g, '</p><p class="dict-para">')
      .replace(/\n/g, '')
      // 清理 span 的 inline style
      .replace(/<span[^>]*style="[^"]*font-size:\s*24px[^"]*"[^>]*>[^<]*<\/span>/gi, '')
      .replace(/<span[^>]*style="[^"]*font-size:\s*;[^"]*"[^>]*>/gi, '<span>')
      // 梵文/巴利文用斜体
      .replace(/<span[^>]*style="[^"]*font-family:\s*times[^"]*"[^>]*>([^<]*)<\/span>/gi, '<i class="dict-pali">$1</i>')
  }

  // 其他词典通用处理
  else {
    cleaned = cleaned
      // 移除外层 div.vbox
      .replace(/<div class="vbox">/gi, '')
      .replace(/<\/div>\s*$/gi, '')
      // 移除词条标题（已在页面显示）
      .replace(/<b>[^<]*<\/b>\s*<br\s*\/?>/gi, '')
      // 处理目录链接
      .replace(/<span style="float:right;">[^<]*<\/span>/gi, '')
      .replace(/<!-- 原分隔线 -->/gi, '')
      // 处理 entry:// 链接转为站内链接
      .replace(/href="entry:\/\/([^"]+)"/gi, (_, term) => {
        const decoded = decodeURIComponent(term)
        return `href="/dictionary/${encodeURIComponent(decoded)}" class="dict-link"`
      })
      // 处理换行
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // 处理全角空格缩进
      .replace(/<br\s*\/?>\n?　　/gi, '</p><p class="dict-para">　　')
      .replace(/<br\s*\/?>\n?　/gi, '</p><p class="dict-para">　')
      // p标签保留
      .replace(/<p>/gi, '</p><p class="dict-para">')
      .replace(/<\/p>/gi, '</p>')
      // 其他 br 转段落
      .replace(/<br\s*\/?>/gi, '</p><p class="dict-para">')
      // 移除空段落
      .replace(/<p class="dict-para">\s*<\/p>/gi, '')
      // 包裹
      .replace(/^(?!<p)/, '<p class="dict-para">')
      .replace(/(?<!<\/p>)$/, '</p>')
  }

  // 清理多余的空段落
  cleaned = cleaned
    .replace(/<p[^>]*>\s*<\/p>/gi, '')
    .replace(/(<br\s*\/?>\s*){2,}/gi, '<br>')
    .replace(/<p class="dict-para"><br\s*\/?>/gi, '<p class="dict-para">')
    .replace(/^\s*<\/p>/gi, '')
    .replace(/<p class="dict-para">\s*$/gi, '')
    // 移除词典底部导航（上一条/总目录/下一条，包括带链接的形式）
    .replace(/<p[^>]*align[^>]*>[^<]*<a[^>]*>[^<]*上一[条條][^<]*<\/a>[^<]*<[aA][^>]*>[^<]*[总總]目[录錄][^<]*<\/[aA]>[^<]*<a[^>]*>[^<]*下一[条條][^<]*<\/a>[^<]*<\/p>/gi, '')

  return cleaned.trim()
}

function DictionaryClientInner({
  initialFeatured,
  totalCount,
  initialTerm,
  initialTermDetail,
}: DictionaryClientProps) {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') || initialTerm || ''

  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<DictionaryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(!!initialQuery)
  const [pagination, setPagination] = useState({ total: 0, limit: 30, offset: 0 })
  const [selectedTerm, setSelectedTerm] = useState<string | null>(initialTerm || null)
  const [termDetail, setTermDetail] = useState<TermDetail | null>(initialTermDetail || null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [activeSourceIndex, setActiveSourceIndex] = useState(0) // 当前选中的词典 tab
  const [showSourceDropdown, setShowSourceDropdown] = useState(false) // 词典下拉菜单
  const searchInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const search = useCallback(async (q: string, offset = 0, autoSelectFirst = true) => {
    if (!q.trim()) {
      setResults([])
      setSearched(false)
      return
    }

    setLoading(true)
    setSearched(true)

    try {
      const res = await fetch(`${API_BASE}/dictionary?q=${encodeURIComponent(q)}&limit=30&offset=${offset}`)
      if (res.ok) {
        const data = await res.json()
        const results = data.data || []
        setResults(results)
        setPagination(data.pagination || { total: 0, limit: 30, offset: 0 })

        // 自动选中第一条并获取详情
        if (autoSelectFirst && results.length > 0) {
          const firstTerm = results[0].term
          setSelectedTerm(firstTerm)
          setDetailLoading(true)
          setActiveSourceIndex(0)

          // 获取第一条的详情
          fetch(`${API_BASE}/dictionary/${encodeURIComponent(firstTerm)}`)
            .then(res => res.ok ? res.json() : null)
            .then(detail => setTermDetail(detail))
            .catch(() => setTermDetail(null))
            .finally(() => setDetailLoading(false))
        }
      }
    } catch (error) {
      console.error('搜索失败:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchTermDetail = useCallback(async (term: string) => {
    setDetailLoading(true)
    setActiveSourceIndex(0) // 切换词条时重置 tab
    try {
      const res = await fetch(`${API_BASE}/dictionary/${encodeURIComponent(term)}`)
      if (res.ok) {
        const data = await res.json()
        setTermDetail(data)
      }
    } catch (error) {
      console.error('获取详情失败:', error)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialQuery) {
      // 如果已有初始详情数据，搜索时不自动选中第一条
      search(initialQuery, 0, !initialTermDetail)
    }
  }, [initialQuery, search, initialTermDetail])

  // 点击词条时获取详情并更新 URL
  const handleSelectTerm = useCallback((term: string) => {
    setSelectedTerm(term)
    setDetailLoading(true)
    setActiveSourceIndex(0)

    // 更新 URL
    const newUrl = `/dictionary/${encodeURIComponent(term)}`
    window.history.pushState({}, '', newUrl)

    // 获取详情
    fetch(`${API_BASE}/dictionary/${encodeURIComponent(term)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => setTermDetail(data))
      .catch(() => setTermDetail(null))
      .finally(() => setDetailLoading(false))
  }, [])

  // 初始加载时不需要额外获取（已有 initialTermDetail）
  useEffect(() => {
    if (selectedTerm && selectedTerm !== initialTerm && !termDetail) {
      fetchTermDetail(selectedTerm)
    }
  }, [selectedTerm, initialTerm, termDetail, fetchTermDetail])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      search(query)
      // 更新 URL 为 /dictionary/搜索词
      window.history.pushState({}, '', `/dictionary/${encodeURIComponent(query.trim())}`)
    }
  }

  const debounceRef = useRef<NodeJS.Timeout>()
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      if (value.trim()) {
        search(value)
        // 更新 URL 为 /dictionary/搜索词
        window.history.replaceState({}, '', `/dictionary/${encodeURIComponent(value.trim())}`)
      } else {
        setResults([])
        setSearched(false)
        // 清空时回到词典首页
        window.history.replaceState({}, '', '/dictionary')
      }
    }, 300)
  }

  const handlePageChange = (newOffset: number) => {
    search(query, newOffset)
  }

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSourceDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 去重词条
  const uniqueTerms = results.reduce((acc, entry) => {
    if (!acc.find(e => e.term === entry.term)) {
      acc.push(entry)
    }
    return acc
  }, [] as DictionaryEntry[])

  return (
    <div className="relative min-h-screen text-[color:var(--ink)] bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.18),transparent_45%),radial-gradient(circle_at_85%_15%,_rgba(190,18,60,0.12),transparent_50%),linear-gradient(180deg,_#fbf7f0_0%,_#efe4d2_100%)]">
      <Header
        activeNav="dictionary"
        stats={{ label: '收录', count: totalCount }}
      />

      <div className="max-w-[1200px] mx-auto flex min-h-[calc(100vh-48px)]">
        {/* 左侧面板 */}
        <aside className="w-[300px] border-r border-[#d4c4a8]/50 flex flex-col bg-white/50">
          {/* 搜索区 */}
          <div className="p-4 border-b border-[#d4c4a8]/50">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={handleInputChange}
                  placeholder="输入佛学名词..."
                  className="w-full pl-4 pr-10 py-2.5 text-sm rounded-lg border border-[#d4c4a8] bg-white/80
                    focus:outline-none focus:ring-2 focus:ring-[#0f766e]/30 focus:border-[#0f766e]
                    placeholder:text-[#9a7b4f] text-[#5d5348]"
                />
                <button
                  type="submit"
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-[#9a7b4f] hover:text-[#0f766e] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
            </form>
          </div>

          {/* 词条列表 */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-[#0f766e] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : searched ? (
              uniqueTerms.length > 0 ? (
                <div>
                  <div className="px-4 py-2 text-xs text-[#9a7b4f] bg-[#efe2cf]/30 sticky top-0 border-b border-[#d4c4a8]/30">
                    {pagination.total} 条结果
                  </div>
                  <div>
                    {uniqueTerms.map((entry, index) => (
                      <button
                        key={`${entry.term}-${index}`}
                        onClick={() => handleSelectTerm(entry.term)}
                        className={`w-full text-left px-4 py-3 border-b border-[#d4c4a8]/30 hover:bg-[#efe2cf]/30 transition-all
                          ${selectedTerm === entry.term
                            ? 'bg-[#efe2cf]/50 border-l-3 border-l-[#0f766e]'
                            : 'border-l-3 border-l-transparent'}`}
                      >
                        <h3 className="font-medium text-[#5d5348]">{entry.term}</h3>
                        <p className="text-xs text-[#9a7b4f] mt-0.5 line-clamp-1">
                          {entry.definition_preview}
                        </p>
                      </button>
                    ))}
                  </div>

                  {pagination.total > pagination.limit && (
                    <div className="flex items-center justify-center gap-2 p-3 border-t border-[#d4c4a8]/50 bg-[#efe2cf]/20">
                      <button
                        onClick={() => handlePageChange(Math.max(0, pagination.offset - pagination.limit))}
                        disabled={pagination.offset === 0}
                        className="px-2.5 py-1 text-xs rounded bg-white/70 border border-[#d4c4a8]
                          disabled:opacity-40 hover:bg-white text-[#6b4a2b] transition-colors"
                      >
                        上一页
                      </button>
                      <span className="text-xs text-[#9a7b4f]">
                        {Math.floor(pagination.offset / pagination.limit) + 1} / {Math.ceil(pagination.total / pagination.limit)}
                      </span>
                      <button
                        onClick={() => handlePageChange(pagination.offset + pagination.limit)}
                        disabled={pagination.offset + pagination.limit >= pagination.total}
                        className="px-2.5 py-1 text-xs rounded bg-white/70 border border-[#d4c4a8]
                          disabled:opacity-40 hover:bg-white text-[#6b4a2b] transition-colors"
                      >
                        下一页
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-[#9a7b4f] text-sm">
                  未找到相关词条
                </div>
              )
            ) : (
              <div>
                <div className="px-4 py-2 text-xs text-[#9a7b4f] bg-[#efe2cf]/30 sticky top-0 border-b border-[#d4c4a8]/30">
                  推荐词条
                </div>
                <div>
                  {initialFeatured.map((entry, index) => (
                    <button
                      key={`${entry.term}-${index}`}
                      onClick={() => handleSelectTerm(entry.term)}
                      className={`w-full text-left px-4 py-3 border-b border-[#d4c4a8]/30 hover:bg-[#efe2cf]/30 transition-all
                        ${selectedTerm === entry.term
                          ? 'bg-[#efe2cf]/50 border-l-3 border-l-[#0f766e]'
                          : 'border-l-3 border-l-transparent'}`}
                    >
                      <h3 className="font-medium text-[#5d5348]">{entry.term}</h3>
                      <p className="text-xs text-[#9a7b4f] mt-0.5 line-clamp-1">
                        {entry.definition_preview}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* 右侧内容区 */}
        <main className="flex-1 overflow-y-auto">
          {detailLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-3 border-[#0f766e] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : termDetail ? (
            <div className="p-8">
              {/* 词条标题行 */}
              <header className="mb-6 flex items-start justify-between gap-4">
                <h1 className="text-3xl text-[#5d5348]" style={{ fontFamily: 'var(--font-serif)' }}>
                  {termDetail.term}
                </h1>

                {/* 词典切换器 - 下拉选择 */}
                {termDetail.entries.length > 1 && (
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setShowSourceDropdown(!showSourceDropdown)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#0f766e] bg-[#0f766e]/10
                        text-[#0f766e] hover:bg-[#0f766e]/20 transition-colors text-sm font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      <span className="max-w-[140px] truncate">{termDetail.entries[activeSourceIndex]?.source}</span>
                      <span className="text-xs opacity-70">({termDetail.entries.length})</span>
                      <svg className={`w-4 h-4 transition-transform ${showSourceDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* 下拉菜单 */}
                    {showSourceDropdown && (
                      <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-lg shadow-lg border border-[#d4c4a8] z-50 py-1 max-h-80 overflow-y-auto">
                        <div className="px-3 py-2 text-xs text-[#9a7b4f] border-b border-[#d4c4a8]/50">
                          共 {termDetail.entries.length} 部词典收录
                        </div>
                        {termDetail.entries.map((entry, index) => (
                          <button
                            key={`${entry.source}-${index}`}
                            onClick={() => {
                              setActiveSourceIndex(index)
                              setShowSourceDropdown(false)
                            }}
                            className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 hover:bg-[#efe2cf]/50 transition-colors
                              ${activeSourceIndex === index ? 'bg-[#efe2cf]/30 text-[#0f766e]' : 'text-[#5d5348]'}`}
                          >
                            {activeSourceIndex === index ? (
                              <svg className="w-4 h-4 text-[#0f766e] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <span className="w-4 h-4 shrink-0" />
                            )}
                            <span className="truncate">{entry.source}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </header>

              {/* 词典内容 */}
              <article className="rounded-xl border border-[#d4c4a8]/60 bg-white/70 overflow-hidden">
                {/* 词典来源头部（单个词典时显示） */}
                {termDetail.entries.length === 1 && (
                  <div className="px-4 py-2.5 bg-[#efe2cf]/40 border-b border-[#d4c4a8]/40">
                    <span className="text-sm font-medium text-[#6b4a2b]">
                      {termDetail.entries[0]?.source}
                    </span>
                  </div>
                )}
                {/* 释义内容 */}
                <div
                  className="p-6 text-[#5d5348] leading-[1.9] dict-content"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeDefinitionHtml(
                      termDetail.entries[activeSourceIndex]?.definition || '',
                      termDetail.entries[activeSourceIndex]?.source || ''
                    )
                  }}
                />
              </article>

            </div>
          ) : selectedTerm ? (
            /* 有选中词条但没有结果 */
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-[#9a7b4f]">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg font-medium mb-1">未找到「{selectedTerm}」</p>
                <p className="text-sm">该词条暂未收录</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-[#9a7b4f]">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <p className="text-sm">选择词条查看释义</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* 词典内容样式 */}
      <style jsx global>{`
        .scrollbar-thin {
          scrollbar-width: thin;
          scrollbar-color: #d4c4a8 transparent;
        }
        .scrollbar-thin::-webkit-scrollbar {
          height: 4px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background-color: #d4c4a8;
          border-radius: 2px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background-color: #c4b498;
        }
        .dict-content {
          font-family: var(--font-serif);
          font-size: 16px;
        }
        .dict-content .dict-para {
          text-indent: 2em;
          margin: 0;
        }
        .dict-content .dict-para + .dict-para {
          margin-top: 0.5em;
        }
        .dict-content .dict-pali {
          font-family: "Times New Roman", serif;
          font-style: italic;
          color: #7a5230;
        }
        .dict-content .dict-link {
          color: #0f766e;
          text-decoration: none;
        }
        .dict-content .dict-link:hover {
          text-decoration: underline;
        }
        .dict-content span {
          color: inherit !important;
          font-size: inherit !important;
        }
        .dict-content br {
          display: none;
        }
        .dict-content a {
          color: #0f766e;
        }
        .dict-content a:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  )
}

export default function DictionaryClient(props: DictionaryClientProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[linear-gradient(180deg,_#fbf7f0_0%,_#efe4d2_100%)]">
        <Header activeNav="dictionary" showNav={false} />
        <div className="flex items-center justify-center h-[calc(100vh-48px)]">
          <div className="w-8 h-8 border-3 border-[#0f766e] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    }>
      <DictionaryClientInner {...props} />
    </Suspense>
  )
}
