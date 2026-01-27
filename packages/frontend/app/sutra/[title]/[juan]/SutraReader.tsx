'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { SutraMeta, Chapter, Block, InlineNode } from '../../../data/types'
import { parseJuanContent } from '../../../data/cbetaParser'

type SutraReaderProps = {
  sutra: SutraMeta
  initialJuan: number
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api'

// 辅助函数：从标题中提取中文部分（去除梵文、数字、标点等）
const extractChinesePart = (title: string): string => {
  // 匹配中文字符、中文数字、中文标点
  const chineseMatches = title.match(/[\u4e00-\u9fa5][\u4e00-\u9fa5\d零一二三四五六七八九十百千第品]+/g)
  return chineseMatches ? chineseMatches.join('') : title
}

// 辅助函数：检查两个标题是否匹配（支持部分匹配）
const isTitleMatch = (headingText: string, tocTitle: string): boolean => {
  const headingChinese = extractChinesePart(headingText)
  const tocChinese = extractChinesePart(tocTitle)

  // 直接相等
  if (headingChinese === tocChinese) return true

  // 互相包含（处理 "品第一" 匹配 "序品第一" 的情况）
  if (tocChinese.includes(headingChinese)) return true
  if (headingChinese.includes(tocChinese)) return true

  // 处理特殊情况：去掉"第"和数字后的匹配
  // 例如 "品第一" -> "品", "序品第一" -> "序品"
  const headingBase = headingChinese.replace(/第[\d零一二三四五六七八九十百千]+/g, '').trim()
  const tocBase = tocChinese.replace(/第[\d零一二三四五六七八九十百千]+/g, '').trim()

  if (headingBase && tocBase) {
    if (tocBase.includes(headingBase)) return true
    if (headingBase.includes(tocBase)) return true
  }

  return false
}

// 渲染行内节点
function renderInline(node: InlineNode, index: number): React.ReactNode {
  switch (node.type) {
    case 'text':
      return node.text
    case 'emph':
      return <em key={index}>{node.inlines.map((n, i) => renderInline(n, i))}</em>
    case 'foreign':
      return <span key={index} className="font-serif">{node.inlines.map((n, i) => renderInline(n, i))}</span>
    case 'term':
      return <span key={index} className="text-[#5a4a3a] font-medium">{node.inlines.map((n, i) => renderInline(n, i))}</span>
    case 'ref':
      return null
    case 'sanskritMarker':
      return <span key={index} title={node.text}>{node.chinese}</span>
    case 'gaiji':
      return <span key={index} className="text-[#c0b0a0]">□</span>
    case 'inlineGroup':
      const first = node.items[0]
      return first ? first.inlines.map((n, i) => renderInline(n, i)) : null
    case 'noteRef':
      return <sup key={index} className="text-[10px] text-[#a09080] ml-0.5">[{node.index + 1}]</sup>
    case 'variantRef':
      return <sup key={index} className="text-[10px] text-[#a09080] ml-0.5">({node.index + 1})</sup>
    default:
      return null
  }
}

export default function SutraReader({ sutra, initialJuan }: SutraReaderProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [currentJuan, setCurrentJuan] = useState(initialJuan)
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showToc, setShowToc] = useState(false)
  const [tocTab, setTocTab] = useState<'juan' | 'pin' | 'related' | 'persons'>(() => {
    // 从 URL 参数读取初始 tab
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tab = params.get('tab')
      if (tab === 'pin') return 'pin'
      if (tab === 'related') return 'related'
      if (tab === 'persons') return 'persons'
    }
    return 'juan'
  })
  const [fullToc, setFullToc] = useState<Array<{ title: string; juanNumber?: number; type?: string }>>([])
  const [relatedSutras, setRelatedSutras] = useState<{
    translations: Array<{ title: string; author?: string; dynasty?: string }>
    commentaries: Array<{ title: string; author?: string; dynasty?: string }>
    related: Array<{ title: string; author?: string; dynasty?: string }>
  }>({ translations: [], commentaries: [], related: [] })
  const [loadingRelated, setLoadingRelated] = useState(false)
  const [relatedPersons, setRelatedPersons] = useState<Array<{ name: string; role?: string; dynasty?: string }>>([])

  const loadJuan = useCallback(async (juan: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/sutra/${encodeURIComponent(sutra.title)}/juan/${juan}`)
      if (!res.ok) throw new Error('加载失败')
      const data = await res.json()
      const parsed = parseJuanContent(data.content, `第${juan}卷`)
      setChapter(parsed)
      // 保存完整目录数据
      if (data.fullToc) {
        setFullToc(data.fullToc)
      }
    } catch (err) {
      setError('加载经文内容失败')
    } finally {
      setLoading(false)
    }
  }, [sutra.title])

  useEffect(() => {
    loadJuan(currentJuan)
  }, [currentJuan, loadJuan])

  // 加载相关经书
  useEffect(() => {
    const loadRelated = async () => {
      setLoadingRelated(true)
      try {
        const res = await fetch(`${API_BASE}/texts/${sutra.id}`)
        if (res.ok) {
          const data = await res.json()
          // 分类存储相关经书
          const translations: Array<{ title: string; author?: string; dynasty?: string }> = []
          const commentaries: Array<{ title: string; author?: string; dynasty?: string }> = []
          const related: Array<{ title: string; author?: string; dynasty?: string }> = []

          // 从异译组添加 - 同本异译
          if (data.translationGroup && data.translationGroup.texts) {
            for (const t of data.translationGroup.texts) {
              if (t.title !== sutra.title && !translations.find(r => r.title === t.title)) {
                translations.push({
                  title: t.title,
                  author: t.author_raw,
                  dynasty: t.translation_dynasty,
                })
              }
            }
          }

          // 从经文关系添加 - 根据关系类型分类
          if (data.relations && data.relations.length > 0) {
            for (const rel of data.relations) {
              if (!rel.related_title) continue
              const item = {
                title: rel.related_title as string,
                author: (rel.related_author_raw as string) || undefined,
              }
              const relationType = (rel.relation_type as string) || ''

              // 注疏类
              if (relationType.includes('注') || relationType.includes('疏') || relationType.includes('释')) {
                if (!commentaries.find(r => r.title === item.title)) {
                  commentaries.push(item)
                }
              } else {
                // 其他相关
                if (!related.find(r => r.title === item.title) &&
                    !translations.find(r => r.title === item.title) &&
                    !commentaries.find(r => r.title === item.title)) {
                  related.push(item)
                }
              }
            }
          }

          setRelatedSutras({ translations, commentaries, related })

          // 加载相关人物
          if (data.relatedPersons && data.relatedPersons.length > 0) {
            // 角色类型映射
            const roleMap: Record<string, string> = {
              'speaker': '说者',
              'translator': '译者',
              'author': '作者',
              'compiler': '编者',
              'commentator': '注释者',
              'scribe': '笔录者',
              'patron': '施主',
              'requester': '请译者',
              'proofreader': '校订者',
            }
            const persons = data.relatedPersons.map((p: Record<string, unknown>) => {
              const roleType = (p.role_type as string) || ''
              const roleRaw = (p.role_raw as string) || ''
              // 优先使用 role_type 映射，如果没有映射则使用原始值
              const role = roleMap[roleType] || roleMap[roleRaw] || roleType || roleRaw || undefined
              // 优先使用后端返回的 dynasty_name（中文），如果没有则使用 dynasty_id
              const dynasty = (p.dynasty_name as string) || (p.dynasty_id as string) || undefined
              return {
                name: p.name as string,
                role,
                dynasty,
              }
            })
            setRelatedPersons(persons)
          }
        }
      } catch (err) {
        console.error('加载相关经书失败:', err)
      } finally {
        setLoadingRelated(false)
      }
    }
    loadRelated()
  }, [sutra.id, sutra.title])

  // 使用 ref 跟踪当前处理的 pin 值
  const processedPinRef = useRef<string | null>(null)

  // 处理待滚动的标题（当 chapter 加载完成后）
  useEffect(() => {
    if (!chapter) return

    // 从 URL 获取锚点
    const hash = searchParams.get('pin')
    if (!hash) {
      processedPinRef.current = null
      return
    }

    // 如果已经处理过这个 pin，则跳过
    if (processedPinRef.current === hash) return

    // 标记为已处理
    processedPinRef.current = hash

    // 使用 requestAnimationFrame 确保 DOM 已渲染
    const scrollToHeading = () => {
      const headingElements = document.querySelectorAll('h3')
      const hashChinese = extractChinesePart(decodeURIComponent(hash))

      for (let i = 0; i < headingElements.length; i++) {
        const headingText = headingElements[i].textContent?.trim() || ''
        const headingChinese = extractChinesePart(headingText)

        // 优先使用中文部分匹配
        if (hashChinese && headingChinese &&
            (headingChinese === hashChinese ||
             headingChinese.includes(hashChinese) ||
             hashChinese.includes(headingChinese))) {
          headingElements[i].scrollIntoView({ behavior: 'smooth', block: 'start' })
          break
        }
      }
      // 清除 URL 中的 pin 参数，但保留 tab 参数
      const tab = searchParams.get('tab')
      const newUrl = tab
        ? `/sutra/${encodeURIComponent(sutra.title)}/${currentJuan}?tab=${tab}`
        : `/sutra/${encodeURIComponent(sutra.title)}/${currentJuan}`
      router.replace(newUrl, { scroll: false })
    }

    // 多次尝试确保 DOM 已渲染
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToHeading)
    })
  }, [chapter, searchParams, currentJuan, router, sutra.title])

  // 更新页面标题
  useEffect(() => {
    if ((sutra.juan_count || 1) > 1) {
      document.title = `${sutra.title} 第${currentJuan}卷 - 佛典数据库`
    } else {
      document.title = `${sutra.title} - 佛典数据库`
    }
  }, [sutra.title, sutra.juan_count, currentJuan])

  const juanCount = sutra.juan_count || 1

  // 切换卷并更新 URL
  const handleJuanChange = useCallback((newJuan: number) => {
    setCurrentJuan(newJuan)
    router.push(`/sutra/${encodeURIComponent(sutra.title)}/${newJuan}`, { scroll: false })
  }, [router, sutra.title])

  // 渲染段落 - 在组件内部定义，可以访问 fullToc
  const renderParagraph = useCallback((block: Block, index: number): React.ReactNode => {
    if (block.type === 'paragraph') {
      return (
        <p key={index} className="my-4 leading-loose text-[#3d3229]">
          {block.inlines.map((node, i) => renderInline(node, i))}
        </p>
      )
    }
    if (block.type === 'verse') {
      // 检查第一行是否以「开头
      const firstLine = block.lines[0]
      const firstNode = firstLine?.[0]
      const hasQuote = firstNode?.type === 'text' && firstNode.text.startsWith('「')

      // 处理第一行：分离「符号和剩余文本
      let processedFirstLine = firstLine
      if (hasQuote && firstNode?.type === 'text') {
        const quoteText = firstNode.text
        const remainingText = quoteText.substring(1)
        processedFirstLine = [
          { ...firstNode, text: remainingText },
          ...firstLine.slice(1)
        ]
      }

      return (
        <div key={index} className="my-4 relative">
          {/* 「符号绝对定位 */}
          {hasQuote && (
            <span className="absolute left-0 top-0 text-[#3d3229] font-bold select-none">
              「
            </span>
          )}
          {block.lines.map((line, lineIdx) => (
            <p
              key={lineIdx}
              className={`my-1 leading-loose text-[#3d3229] font-bold ${
                hasQuote ? 'pl-[1em]' : ''
              }`}
            >
              {(hasQuote && lineIdx === 0 ? processedFirstLine : line).map((node, i) => renderInline(node, i))}
            </p>
          ))}
        </div>
      )
    }
    if (block.type === 'heading') {
      // 从 fullToc 中查找匹配的完整标题
      console.log('Heading block.text:', JSON.stringify(block.text))
      console.log('fullToc:', JSON.stringify(fullToc.map(i => i.title)))
      const matchedItem = fullToc.find(item => isTitleMatch(block.text, item.title))
      console.log('Matched item:', JSON.stringify(matchedItem))
      const fullTitle = matchedItem?.title || block.text

      return (
        <h3 key={index} id={`heading-${index}`} className="my-6 text-lg font-medium text-[#3d3229] text-center scroll-mt-16">
          {fullTitle}
        </h3>
      )
    }
    if (block.type === 'byline') {
      return (
        <p key={index} className="my-2 text-right text-sm text-[#8a7a6a]">
          {block.text}
        </p>
      )
    }
    if (block.type === 'juan') {
      return (
        <div key={index} className="my-8 text-center">
          <span className="text-sm text-[#8a7a6a]">{block.label}</span>
        </div>
      )
    }
    return null
  }, [fullToc])

  return (
    <div className="min-h-screen bg-[#f8f5f0]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/40 bg-[#2a1f16]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-3 py-3 sm:px-4">
          {/* Logo 和 佛典数据库 */}
          <Link href="/" className="flex items-center gap-2 text-[#fff4e0] shrink-0">
            <span className="shrink-0 text-2xl" role="img" aria-hidden="true">📿</span>
            <span className="text-sm font-display tracking-wide">佛典数据库</span>
          </Link>
          {/* 经文标题和译者 - 居中 */}
          <div
            className="flex flex-col justify-center items-center text-[#fff4e0] min-w-0 absolute left-1/2 -translate-x-1/2 cursor-pointer select-none"
            onDoubleClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            title="双击滚动到顶部"
          >
            <span className="text-sm sm:text-base font-display tracking-wide truncate leading-tight">{sutra.title}</span>
            {sutra.author_raw && (
              <span className="text-[10px] text-[#d4c4a8] truncate leading-tight">
                {sutra.author_raw}{sutra.author_raw.endsWith('译') ? '' : '译'}
              </span>
            )}
          </div>
          {/* 目录按钮 */}
          <div className="flex items-center gap-2 text-xs text-[#f6dfbe] shrink-0">
            {/* 卷号显示 - 点击打开目录 */}
            {juanCount > 1 && (
              <button
                onClick={() => setShowToc(!showToc)}
                className="text-xs text-[#d4c4a8] hover:text-[#f6dfbe] transition-colors"
                title="打开目录"
              >
                第 {currentJuan} / {juanCount} 卷
              </button>
            )}
            {/* 目录按钮 */}
            <button
              onClick={() => setShowToc(!showToc)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              title="目录"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* 目录面板 */}
      {showToc && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setShowToc(false)}>
          <div className="w-72 h-full bg-white shadow-lg flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Tab 切换 - 固定顶部 */}
            <div className="flex border-b border-[#e8e0d5] px-4 pt-4 pb-0 shrink-0">
              {juanCount > 1 && (
                <button
                  onClick={() => {
                    setTocTab('juan')
                    // 更新 URL 参数
                    const url = new URL(window.location.href)
                    url.searchParams.set('tab', 'juan')
                    router.replace(url.pathname + url.search, { scroll: false })
                  }}
                  className={`flex-1 py-2 text-xs font-medium transition ${
                    tocTab === 'juan'
                      ? 'text-[#3d3229] border-b-2 border-[#6b5b4b]'
                      : 'text-[#8a7a6a] hover:text-[#5a4a3a]'
                  }`}
                >
                  分卷
                </button>
              )}
              {fullToc.some(item => item.type === '品' || item.type === 'pin') && (
                <button
                  onClick={() => {
                    setTocTab('pin')
                    // 更新 URL 参数
                    const url = new URL(window.location.href)
                    url.searchParams.set('tab', 'pin')
                    router.replace(url.pathname + url.search, { scroll: false })
                  }}
                  className={`flex-1 py-2 text-xs font-medium transition ${
                    tocTab === 'pin'
                      ? 'text-[#3d3229] border-b-2 border-[#6b5b4b]'
                      : 'text-[#8a7a6a] hover:text-[#5a4a3a]'
                  }`}
                >
                  分品
                </button>
              )}
              <button
                onClick={() => {
                  setTocTab('related')
                  // 更新 URL 参数
                  const url = new URL(window.location.href)
                  url.searchParams.set('tab', 'related')
                  router.replace(url.pathname + url.search, { scroll: false })
                }}
                className={`flex-1 py-2 text-xs font-medium transition ${
                  tocTab === 'related'
                    ? 'text-[#3d3229] border-b-2 border-[#6b5b4b]'
                    : 'text-[#8a7a6a] hover:text-[#5a4a3a]'
                }`}
              >
                相关
              </button>
              <button
                onClick={() => {
                  setTocTab('persons')
                  // 更新 URL 参数
                  const url = new URL(window.location.href)
                  url.searchParams.set('tab', 'persons')
                  router.replace(url.pathname + url.search, { scroll: false })
                }}
                className={`flex-1 py-2 text-xs font-medium transition ${
                  tocTab === 'persons'
                    ? 'text-[#3d3229] border-b-2 border-[#6b5b4b]'
                    : 'text-[#8a7a6a] hover:text-[#5a4a3a]'
                }`}
              >
                人物
              </button>
            </div>
            {/* 内容区域 - 独立滚动 */}
            <div className="flex-1 overflow-auto p-4">

            {/* 分卷内容 */}
            {tocTab === 'juan' && (
              <div className="space-y-1">
                {Array.from({ length: juanCount }, (_, i) => i + 1).map((juan) => (
                  <button
                    key={juan}
                    onClick={() => {
                      handleJuanChange(juan)
                      setShowToc(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-sm rounded transition ${
                      currentJuan === juan
                        ? 'bg-[#f0ebe5] text-[#3d3229] font-medium'
                        : 'text-[#5a4a3a] hover:bg-[#f8f5f0]'
                    }`}
                  >
                    第{juan}卷
                  </button>
                ))}
              </div>
            )}

            {/* 分品内容 */}
            {tocTab === 'pin' && (
              <div className="space-y-1">
                {fullToc.length > 0 ? (
                  fullToc
                    .filter((item) => item.type === '品' || item.type === 'pin')
                    .map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          const targetJuan = item.juanNumber || 1
                          const encodedTitle = encodeURIComponent(item.title)
                          if (targetJuan !== currentJuan) {
                            // 切换到目标卷，并带上锚点参数和 tab 参数
                            router.push(`/sutra/${encodeURIComponent(sutra.title)}/${targetJuan}?tab=pin&pin=${encodedTitle}`, { scroll: false })
                          } else {
                            // 当前卷，直接滚动到对应位置
                            const headingElements = document.querySelectorAll('h3')
                            const itemChinese = extractChinesePart(item.title)
                            for (let i = 0; i < headingElements.length; i++) {
                              const headingText = headingElements[i].textContent?.trim() || ''
                              const headingChinese = extractChinesePart(headingText)
                              if (itemChinese && headingChinese &&
                                  (headingChinese === itemChinese ||
                                   headingChinese.includes(itemChinese) ||
                                   itemChinese.includes(headingChinese))) {
                                headingElements[i].scrollIntoView({ behavior: 'smooth', block: 'start' })
                                break
                              }
                            }
                          }
                          setShowToc(false)
                        }}
                        className={`w-full text-left px-3 py-2 text-sm rounded transition text-[#5a4a3a] hover:bg-[#f8f5f0]`}
                      >
                        <span className="truncate block">{item.title}</span>
                      </button>
                    ))
                ) : (
                  <div className="text-sm text-[#8a7a6a] px-3 py-2">暂无品目数据</div>
                )}
              </div>
            )}

            {/* 相关内容 */}
            {tocTab === 'related' && (
              <div className="space-y-4">
                {loadingRelated ? (
                  <div className="text-sm text-[#8a7a6a] px-3 py-2">加载中...</div>
                ) : (
                  <>
                    {/* 同本异译 */}
                    {relatedSutras.translations.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-[#8a7a6a] px-3 py-1">同本异译</div>
                        {relatedSutras.translations.map((item, idx) => (
                          <Link
                            key={`trans-${idx}`}
                            href={`/sutra/${encodeURIComponent(item.title)}/1`}
                            onClick={() => setShowToc(false)}
                            className="w-full text-left px-3 py-2 text-sm rounded transition text-[#5a4a3a] hover:bg-[#f8f5f0] block"
                          >
                            <div className="flex items-center gap-2">
                              <span className="truncate">{item.title}</span>
                              <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-[#e8e0d5] text-[#6b5b4b] rounded">异译</span>
                            </div>
                            {(item.author || item.dynasty) && (
                              <span className="text-xs text-[#8a7a6a]">
                                {item.dynasty} {item.author}
                              </span>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}

                    {/* 注疏 */}
                    {relatedSutras.commentaries.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-[#8a7a6a] px-3 py-1">注疏</div>
                        {relatedSutras.commentaries.map((item, idx) => (
                          <Link
                            key={`comm-${idx}`}
                            href={`/sutra/${encodeURIComponent(item.title)}/1`}
                            onClick={() => setShowToc(false)}
                            className="w-full text-left px-3 py-2 text-sm rounded transition text-[#5a4a3a] hover:bg-[#f8f5f0] block"
                          >
                            <div className="flex items-center gap-2">
                              <span className="truncate">{item.title}</span>
                              <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-[#d4e8d4] text-[#4a6b4a] rounded">注疏</span>
                            </div>
                            {item.author && (
                              <span className="text-xs text-[#8a7a6a]">{item.author}</span>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}

                    {/* 其他相关 */}
                    {relatedSutras.related.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-[#8a7a6a] px-3 py-1">相关</div>
                        {relatedSutras.related.map((item, idx) => (
                          <Link
                            key={`rel-${idx}`}
                            href={`/sutra/${encodeURIComponent(item.title)}/1`}
                            onClick={() => setShowToc(false)}
                            className="w-full text-left px-3 py-2 text-sm rounded transition text-[#5a4a3a] hover:bg-[#f8f5f0] block"
                          >
                            <div className="flex items-center gap-2">
                              <span className="truncate">{item.title}</span>
                              <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-[#e5e0f0] text-[#5a4a7a] rounded">相关</span>
                            </div>
                            {item.author && (
                              <span className="text-xs text-[#8a7a6a]">{item.author}</span>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}

                    {/* 无数据提示 */}
                    {relatedSutras.translations.length === 0 &&
                      relatedSutras.commentaries.length === 0 &&
                      relatedSutras.related.length === 0 && (
                        <div className="text-sm text-[#8a7a6a] px-3 py-2">暂无相关经书</div>
                      )}
                  </>
                )}
              </div>
            )}

            {/* 人物内容 */}
            {tocTab === 'persons' && (
              <div className="space-y-1">
                {loadingRelated ? (
                  <div className="text-sm text-[#8a7a6a] px-3 py-2">加载中...</div>
                ) : relatedPersons.length > 0 ? (
                  relatedPersons.map((person, idx) => (
                    <Link
                      key={idx}
                      href={`/person/${encodeURIComponent(person.name)}`}
                      onClick={() => setShowToc(false)}
                      className="w-full text-left px-3 py-2 text-sm rounded transition text-[#5a4a3a] hover:bg-[#f8f5f0] block"
                    >
                      <div className="flex items-center gap-2">
                        <span className="truncate">{person.name}</span>
                        {person.role && (
                          <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-[#f0e5d4] text-[#7a6b4a] rounded">
                            {person.role}
                          </span>
                        )}
                      </div>
                      {person.dynasty && (
                        <span className="text-xs text-[#8a7a6a]">{person.dynasty}</span>
                      )}
                    </Link>
                  ))
                ) : (
                  <div className="text-sm text-[#8a7a6a] px-3 py-2">暂无相关人物</div>
                )}
              </div>
            )}
            </div>
          </div>
          <div className="flex-1" />
        </div>
      )}

      {/* Main Content - 左右结构 */}
      <div className="max-w-[1400px] mx-auto flex">
        {/* 左侧：经文内容 */}
        <main className="flex-1 min-w-0 px-6 py-8">
          {/* Content */}

          {/* Content */}
          {loading ? (
            <div className="space-y-6 py-4">
              {/* 标题骨架 */}
              <div className="mx-auto h-7 w-48 animate-pulse rounded bg-[#e8e0d5]" />
              {/* 作者信息骨架 */}
              <div className="mx-auto h-4 w-32 animate-pulse rounded bg-[#e8e0d5]" />
              {/* 段落骨架 */}
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-5 w-full animate-pulse rounded bg-[#e8e0d5]" />
                  <div className="h-5 w-[95%] animate-pulse rounded bg-[#e8e0d5]" />
                  <div className="h-5 w-[90%] animate-pulse rounded bg-[#e8e0d5]" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="py-12 text-center text-sm text-[#9a8a7a]">{error}</div>
          ) : chapter ? (
            <article className="text-[17px] leading-loose">
              {chapter.blocks.map((block, index) => renderParagraph(block, index))}

            </article>
          ) : null}

        </main>

        {/* 右侧：分卷/分品导航和相关经文 */}
        <aside className="hidden lg:block w-[320px] border-l border-[#e8e0d5] bg-white/50 p-4 overflow-auto sticky top-[60px] h-[calc(100vh-60px)]">
          {/* 分卷导航 */}
          {juanCount > 1 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-[#3d3229] mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                分卷导航
              </h3>
              <div className="grid grid-cols-4 gap-1">
                {Array.from({ length: juanCount }, (_, i) => i + 1).map((juan) => (
                  <button
                    key={juan}
                    onClick={() => handleJuanChange(juan)}
                    className={`py-2 text-xs rounded transition ${
                      currentJuan === juan
                        ? 'bg-[#6b5b4b] text-white font-medium'
                        : 'bg-[#f5f2ee] text-[#5a4a3a] hover:bg-[#e8e0d5]'
                    }`}
                  >
                    {juan}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 分品导航 - 基于章节标题 */}
          {chapter && chapter.blocks.filter(b => b.type === 'heading').length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-[#3d3229] mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                品目
              </h3>
              <div className="space-y-1 max-h-[300px] overflow-auto">
                {chapter.blocks
                  .filter((b): b is { type: 'heading'; text: string; level?: string; kind?: string } => b.type === 'heading')
                  .map((heading, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-2 text-xs text-[#5a4a3a] bg-[#f8f5f0] rounded truncate"
                      title={heading.text}
                    >
                      {heading.text}
                    </div>
                  ))}
              </div>
            </div>
          )}


          {/* 译者其他作品 */}
          {sutra.author_raw && (
            <div>
              <h3 className="text-sm font-medium text-[#3d3229] mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {sutra.author_raw}
              </h3>
              <Link
                href={`/person/${encodeURIComponent(sutra.author_raw)}`}
                className="block px-3 py-2 text-xs text-[#6b5b4b] bg-[#f0ebe5] rounded hover:bg-[#e8e0d5] transition text-center"
              >
                查看译者详情 →
              </Link>
            </div>
          )}
        </aside>
      </div>

      {/* 浮动导航按钮 - 固定在屏幕左右两侧，垂直居中 */}
      {juanCount > 1 && !loading && (
        <>
          {/* 上一卷 - 左侧 */}
          <button
            onClick={() => handleJuanChange(Math.max(1, currentJuan - 1))}
            disabled={currentJuan <= 1}
            className="fixed left-0 top-1/2 -translate-y-1/2 z-40 flex items-center justify-center w-4 h-16 text-[#8a7a6a] bg-white/80 hover:bg-white border border-[#e0d8cd] border-l-0 rounded-r-lg shadow-sm hover:shadow-md disabled:opacity-0 disabled:pointer-events-none transition-all"
            title="上一卷"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {/* 下一卷 - 右侧 */}
          <button
            onClick={() => handleJuanChange(Math.min(juanCount, currentJuan + 1))}
            disabled={currentJuan >= juanCount}
            className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-center justify-center w-4 h-16 text-[#8a7a6a] bg-white/80 hover:bg-white border border-[#e0d8cd] border-r-0 rounded-l-lg shadow-sm hover:shadow-md disabled:opacity-0 disabled:pointer-events-none transition-all"
            title="下一卷"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
    </div>
  )
}
