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

// 辅助函数：提取品的序号（支持阿拉伯数字和中文数字）
const extractPinNumber = (title: string): number | null => {
  // 匹配 "1 序品" 格式的阿拉伯数字
  const arabicMatch = title.match(/^(\d+)\s/)
  if (arabicMatch) return parseInt(arabicMatch[1], 10)

  // 匹配 "第一" "第二" 等中文数字
  const chineseNumbers: Record<string, number> = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15,
    '十六': 16, '十七': 17, '十八': 18, '十九': 19, '二十': 20,
    '二十一': 21, '二十二': 22, '二十三': 23, '二十四': 24, '二十五': 25,
    '二十六': 26, '二十七': 27, '二十八': 28,
  }
  const chineseMatch = title.match(/第([一二三四五六七八九十]+)/)
  if (chineseMatch) {
    return chineseNumbers[chineseMatch[1]] || null
  }

  return null
}

// 辅助函数：检查两个标题是否匹配（支持部分匹配）
const isTitleMatch = (headingText: string, tocTitle: string): boolean => {
  // 空字符串不匹配
  if (!headingText || !tocTitle) return false

  const headingChinese = extractChinesePart(headingText)
  const tocChinese = extractChinesePart(tocTitle)

  // 提取后为空也不匹配
  if (!headingChinese || !tocChinese) return false

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

  // 特殊情况：通过序号匹配（"品第一" 匹配 "1 序品"）
  // 如果正文标题是 "品第X" 格式，且 toc 标题是 "X 某品" 格式
  const headingNum = extractPinNumber(headingText)
  const tocNum = extractPinNumber(tocTitle)
  if (headingNum !== null && tocNum !== null && headingNum === tocNum) {
    // 序号相同，检查是否都包含"品"字
    if (headingText.includes('品') && tocTitle.includes('品')) {
      return true
    }
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
  // 分卷/分品 Tab 状态
  const [juanPinTab, setJuanPinTab] = useState<'juan' | 'pin'>('juan')
  // 相关/人物 Tab 状态
  const [relatedTab, setRelatedTab] = useState<'related' | 'persons'>('related')
  // 移动端目录 Tab
  const [mobileTocTab, setMobileTocTab] = useState<'juan' | 'pin' | 'related' | 'persons'>('juan')

  // 从 URL 参数同步 Tab 状态
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'pin') {
      setJuanPinTab('pin')
      setMobileTocTab('pin')
    } else if (tab === 'related') {
      setMobileTocTab('related')
    } else if (tab === 'persons') {
      setMobileTocTab('persons')
    }
  }, [searchParams])
  const [fullToc, setFullToc] = useState<Array<{ title: string; juanNumber?: number; type?: string }>>([])
  const [relatedSutras, setRelatedSutras] = useState<{
    translations: Array<{ title: string; author?: string; dynasty?: string }>
    commentaries: Array<{ title: string; author?: string; dynasty?: string }>
    related: Array<{ title: string; author?: string; dynasty?: string }>
  }>({ translations: [], commentaries: [], related: [] })
  const [loadingRelated, setLoadingRelated] = useState(false)
  const [relatedPersons, setRelatedPersons] = useState<Array<{ name: string; role?: string; dynasty?: string }>>([])
  // 标记相关数据是否已完成首次加载
  const [relatedDataLoaded, setRelatedDataLoaded] = useState(false)

  // 用 ref 跟踪 fullToc 是否已加载，避免切换分卷时重复更新造成闪动
  const fullTocLoadedRef = useRef(false)
  // 用 ref 跟踪相关数据是否已加载，避免重复请求
  const relatedLoadedRef = useRef(false)

  const loadJuan = useCallback(async (juan: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/sutra/${encodeURIComponent(sutra.title)}/juan/${juan}`)
      if (!res.ok) throw new Error('加载失败')
      const data = await res.json()
      const parsed = parseJuanContent(data.content, `第${juan}卷`)
      setChapter(parsed)
      // 只在首次加载时更新 fullToc，避免切换分卷时右侧闪动
      if (data.fullToc && !fullTocLoadedRef.current) {
        setFullToc(data.fullToc)
        fullTocLoadedRef.current = true
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
    // 如果已加载过，不再重复加载
    if (relatedLoadedRef.current) return

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
          relatedLoadedRef.current = true

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
        setRelatedDataLoaded(true)
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
        <p key={index} className="my-5 text-justify indent-[2em]">
          {block.inlines.map((node, i) => renderInline(node, i))}
        </p>
      )
    }
    if (block.type === 'verse') {
      // 检查第一行是否以「开头
      const firstLine = block.lines[0]
      const firstNode = firstLine?.[0]
      const hasQuote = firstNode?.type === 'text' && firstNode.text.startsWith('「')

      // 检查最后一行是否以」结尾
      const lastLine = block.lines[block.lines.length - 1]
      const lastNode = lastLine?.[lastLine.length - 1]
      const hasEndQuote = lastNode?.type === 'text' && lastNode.text.endsWith('」')

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

      // 处理最后一行：分离」符号
      let processedLastLine = lastLine
      if (hasEndQuote && lastNode?.type === 'text') {
        const quoteText = lastNode.text
        const remainingText = quoteText.substring(0, quoteText.length - 1)
        processedLastLine = [
          ...lastLine.slice(0, -1),
          { ...lastNode, text: remainingText }
        ]
      }

      return (
        <div key={index} className="my-8">
          {/* 偈颂内容 */}
          <div className="text-center space-y-1">
            {block.lines.map((line, lineIdx) => {
              // 确定当前行使用哪个处理后的版本
              let currentLine = line
              const isFirstLine = lineIdx === 0
              const isLastLine = lineIdx === block.lines.length - 1

              if (isFirstLine && hasQuote) {
                currentLine = processedFirstLine
              }
              if (isLastLine && hasEndQuote && !isFirstLine) {
                currentLine = processedLastLine
              }
              // 如果只有一行且同时有开头和结尾引号
              if (isFirstLine && isLastLine && hasQuote && hasEndQuote && firstNode?.type === 'text') {
                const text = firstNode.text
                currentLine = [{ ...firstNode, text: text.substring(1, text.length - 1) }]
              }

              return (
                <p
                  key={lineIdx}
                  className="text-[#2d2419] leading-[2.2] tracking-wider font-medium"
                >
                  {currentLine.map((node, i) => renderInline(node, i))}
                </p>
              )
            })}
          </div>
        </div>
      )
    }
    if (block.type === 'heading') {
      // 从 fullToc 中查找匹配的完整标题
      const matchedItem = fullToc.find(item => isTitleMatch(block.text, item.title))
      const fullTitle = matchedItem?.title || block.text

      return (
        <h3 key={index} id={`heading-${index}`} className="mt-12 mb-6 text-center scroll-mt-20">
          <span className="inline-block px-6 py-2 text-lg font-medium text-[#3d3229] border-b-2 border-[#d4c4a8]">
            {fullTitle}
          </span>
        </h3>
      )
    }
    if (block.type === 'byline') {
      return (
        <p key={index} className="my-3 text-right text-sm text-[#8a7a6a] italic">
          —— {block.text}
        </p>
      )
    }
    if (block.type === 'juan') {
      return (
        <div key={index} className="my-10 flex items-center justify-center gap-4">
          <div className="h-px w-8 bg-[#d4c4a8]" />
          <span className="text-sm text-[#9a8a7a] tracking-wider">{block.label}</span>
          <div className="h-px w-8 bg-[#d4c4a8]" />
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
          {/* 移动端：显示标题和卷号 */}
          <div className="lg:hidden flex flex-col justify-center items-center text-[#fff4e0] min-w-0 absolute left-1/2 -translate-x-1/2">
            <span className="text-sm font-display tracking-wide truncate leading-tight">{sutra.title}</span>
            {juanCount > 1 && (
              <span className="text-[10px] text-[#d4c4a8]">第 {currentJuan} / {juanCount} 卷</span>
            )}
          </div>
          {/* 目录按钮 */}
          <div className="flex items-center gap-2 text-xs text-[#f6dfbe] shrink-0">
            {/* 移动端目录按钮 */}
            <button
              onClick={() => setShowToc(!showToc)}
              className="lg:hidden p-2 rounded-full hover:bg-white/10 transition-colors"
              title="目录"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* 移动端目录面板 - 仅在移动端显示 */}
      {showToc && (
        <div className="fixed inset-0 z-50 flex lg:hidden" onClick={() => setShowToc(false)}>
          <div className="w-72 h-full bg-white shadow-lg flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Tab 切换 - 固定顶部 */}
            <div className="flex border-b border-[#e8e0d5] px-4 pt-4 pb-0 shrink-0">
              {juanCount > 1 && (
                <button
                  onClick={() => {
                    setMobileTocTab('juan')
                    const url = new URL(window.location.href)
                    url.searchParams.set('tab', 'juan')
                    router.replace(url.pathname + url.search, { scroll: false })
                  }}
                  className={`flex-1 py-2 text-xs font-medium transition ${
                    mobileTocTab === 'juan'
                      ? 'text-[#3d3229] border-b-2 border-[#6b5b4b]'
                      : 'text-[#8a7a6a] hover:text-[#5a4a3a]'
                  }`}
                >
                  分卷
                </button>
              )}
              {juanCount > 1 && (
                <button
                  onClick={() => {
                    setMobileTocTab('pin')
                    const url = new URL(window.location.href)
                    url.searchParams.set('tab', 'pin')
                    router.replace(url.pathname + url.search, { scroll: false })
                  }}
                  className={`flex-1 py-2 text-xs font-medium transition ${
                    mobileTocTab === 'pin'
                      ? 'text-[#3d3229] border-b-2 border-[#6b5b4b]'
                      : 'text-[#8a7a6a] hover:text-[#5a4a3a]'
                  }`}
                >
                  分品
                </button>
              )}
              <button
                onClick={() => {
                  setMobileTocTab('related')
                  const url = new URL(window.location.href)
                  url.searchParams.set('tab', 'related')
                  router.replace(url.pathname + url.search, { scroll: false })
                }}
                className={`flex-1 py-2 text-xs font-medium transition ${
                  mobileTocTab === 'related'
                    ? 'text-[#3d3229] border-b-2 border-[#6b5b4b]'
                    : 'text-[#8a7a6a] hover:text-[#5a4a3a]'
                }`}
              >
                相关
              </button>
              <button
                onClick={() => {
                  setMobileTocTab('persons')
                  const url = new URL(window.location.href)
                  url.searchParams.set('tab', 'persons')
                  router.replace(url.pathname + url.search, { scroll: false })
                }}
                className={`flex-1 py-2 text-xs font-medium transition ${
                  mobileTocTab === 'persons'
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
            {mobileTocTab === 'juan' && (
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
            {mobileTocTab === 'pin' && (
              <div className="space-y-1">
                {fullToc.length > 0 ? (
                  fullToc
                    .filter((item) => item.type === '品' || item.type === 'pin')
                    .map((item, idx) => {
                      const isInCurrentJuan = item.juanNumber === currentJuan

                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            const targetJuan = item.juanNumber || 1
                            const encodedTitle = encodeURIComponent(item.title)
                            if (targetJuan !== currentJuan) {
                              router.push(`/sutra/${encodeURIComponent(sutra.title)}/${targetJuan}?tab=pin&pin=${encodedTitle}`, { scroll: false })
                            } else {
                              // 使用 isTitleMatch 查找匹配的标题
                              const headingElements = document.querySelectorAll('h3')
                              for (let i = 0; i < headingElements.length; i++) {
                                const headingText = headingElements[i].textContent?.trim() || ''
                                if (isTitleMatch(headingText, item.title)) {
                                  headingElements[i].scrollIntoView({ behavior: 'smooth', block: 'start' })
                                  break
                                }
                              }
                            }
                            setShowToc(false)
                          }}
                          className={`w-full text-left px-3 py-2 text-sm rounded transition ${
                            isInCurrentJuan
                              ? 'text-[#3d3229] hover:bg-[#f8f5f0] font-medium'
                              : 'text-[#8a7a6a] hover:bg-[#f8f5f0]'
                          }`}
                        >
                          <span className="truncate block">{item.title}</span>
                        </button>
                      )
                    })
                ) : (
                  <div className="text-sm text-[#8a7a6a] px-3 py-2">暂无品目数据</div>
                )}
              </div>
            )}

            {/* 相关内容 */}
            {mobileTocTab === 'related' && (
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

                    {/* 无数据提示 - 只在数据加载完成后显示 */}
                    {relatedDataLoaded &&
                      relatedSutras.translations.length === 0 &&
                      relatedSutras.commentaries.length === 0 &&
                      relatedSutras.related.length === 0 && (
                        <div className="text-sm text-[#8a7a6a] px-3 py-2">暂无相关经书</div>
                      )}
                  </>
                )}
              </div>
            )}

            {/* 人物内容 */}
            {mobileTocTab === 'persons' && (
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
                ) : relatedDataLoaded ? (
                  <div className="text-sm text-[#8a7a6a] px-3 py-2">暂无相关人物</div>
                ) : null}
              </div>
            )}
            </div>
          </div>
          <div className="flex-1" />
        </div>
      )}

      {/* Main Content - 左右结构 */}
      <div className="max-w-[1200px] mx-auto flex gap-6 px-4 lg:px-6 py-6">
        {/* 左侧：经文内容 */}
        <main className="flex-1 min-w-0">
          {/* 经文卡片容器 */}
          <div className="bg-white/70 rounded-3xl shadow-sm border border-[#e8e0d5]/50 px-6 sm:px-10 lg:px-14 py-10 lg:py-14">
            {/* PC端：标题区域 - 精致设计 */}
            <div className="hidden lg:block mb-12 text-center">
              {/* 装饰线 */}
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#d4c4a8]" />
                <span className="text-[#c4a46a] text-xs">◈</span>
                <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#d4c4a8]" />
              </div>
              {/* 经题 */}
              <h1 className="text-3xl font-display text-[#2d2419] mb-4 tracking-wider">{sutra.title}</h1>
              {/* 底部装饰 */}
              <div className="mt-4 flex items-center justify-center">
                <div className="h-px w-32 bg-gradient-to-r from-transparent via-[#d4c4a8] to-transparent" />
              </div>
            </div>

            {/* Content */}
            {loading ? (
              <div className="space-y-6 py-4 max-w-[680px] mx-auto">
                {/* 标题骨架 */}
                <div className="mx-auto h-8 w-56 animate-pulse rounded bg-[#e8e0d5]" />
                {/* 作者信息骨架 */}
                <div className="mx-auto h-4 w-40 animate-pulse rounded bg-[#e8e0d5]" />
                <div className="h-6" />
                {/* 段落骨架 */}
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="space-y-3">
                    <div className="h-[18px] w-full animate-pulse rounded bg-[#ebe5db]" />
                    <div className="h-[18px] w-[96%] animate-pulse rounded bg-[#ebe5db]" />
                    <div className="h-[18px] w-[92%] animate-pulse rounded bg-[#ebe5db]" />
                    <div className="h-4" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="py-16 text-center text-sm text-[#9a8a7a]">{error}</div>
            ) : chapter ? (
              <article className="max-w-[680px] mx-auto text-[17px] leading-[2] text-[#2d2419]">
                {chapter.blocks.map((block, index) => renderParagraph(block, index))}
                {/* 文末装饰 */}
                <div className="mt-16 mb-4 flex items-center justify-center gap-3">
                  <div className="h-px w-12 bg-[#d4c4a8]" />
                  <span className="text-[#c4a46a] text-sm">◇</span>
                  <div className="h-px w-12 bg-[#d4c4a8]" />
                </div>
              </article>
            ) : null}
          </div>
        </main>

        {/* 右侧：目录导航 */}
        <aside className="hidden lg:block w-[300px] shrink-0 sticky top-[84px] h-[calc(100vh-108px)] overflow-auto scrollbar-thin">
          <div className="space-y-4">
            {/* 区块一：分卷/分品 - 只要有多卷就显示此区块 */}
            {juanCount > 1 && (
              <div className="rounded-2xl shadow-sm border border-[#e8e0d5]/50 overflow-hidden">
                {/* Tab 切换 - 融合顶部圆角 */}
                <div className="flex bg-[#f5f2ed]">
                  <button
                    onClick={() => setJuanPinTab('juan')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-all relative ${
                      juanPinTab === 'juan'
                        ? 'bg-white/80 text-[#3d3229]'
                        : 'text-[#8a7a6a] hover:text-[#5a4a3a] hover:bg-white/40'
                    }`}
                  >
                    分卷
                    <span className="ml-1 text-xs text-[#a09080]">({currentJuan}/{juanCount})</span>
                    {juanPinTab === 'juan' && (
                      <span className="absolute bottom-0 inset-x-0 h-0.5 bg-[#3d3229]"></span>
                    )}
                  </button>
                  <button
                    onClick={() => setJuanPinTab('pin')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-all relative ${
                      juanPinTab === 'pin'
                        ? 'bg-white/80 text-[#3d3229]'
                        : 'text-[#8a7a6a] hover:text-[#5a4a3a] hover:bg-white/40'
                    }`}
                  >
                    分品
                    <span className="ml-1 text-xs text-[#a09080]">({fullToc.filter(item => item.type === '品' || item.type === 'pin').length})</span>
                    {juanPinTab === 'pin' && (
                      <span className="absolute bottom-0 inset-x-0 h-0.5 bg-[#3d3229]"></span>
                    )}
                  </button>
                </div>

                {/* 内容区域 */}
                <div className="bg-white/60 p-4 min-h-[200px]">

                  {/* 分卷内容 */}
                  {juanPinTab === 'juan' && juanCount > 1 && (
                    <div className="space-y-1 max-h-[300px] overflow-auto pr-1 scrollbar-thin">
                      {Array.from({ length: juanCount }, (_, i) => i + 1).map((juan) => (
                        <button
                          key={juan}
                          onClick={() => handleJuanChange(juan)}
                          className={`w-full text-left px-4 py-2.5 text-sm rounded-xl transition-all ${
                            currentJuan === juan
                              ? 'bg-[#3d3229] text-white shadow-md font-medium'
                              : 'text-[#5a4a3a] hover:bg-[#f5f2ed]'
                          }`}
                        >
                          第{juan}卷
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 分品内容 */}
                  {juanPinTab === 'pin' && (
                    <div className="space-y-1 max-h-[300px] overflow-auto pr-1 scrollbar-thin">
                      {/* 骨架加载 */}
                      {loading && fullToc.length === 0 ? (
                        <div className="space-y-2">
                          {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-10 w-full animate-pulse rounded-xl bg-[#e8e0d5]" />
                          ))}
                        </div>
                      ) : fullToc.length > 0 ? (
                        fullToc
                          .filter((item) => item.type === '品' || item.type === 'pin')
                          .map((item, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  const targetJuan = item.juanNumber || 1
                                  const encodedTitle = encodeURIComponent(item.title)

                                  if (targetJuan !== currentJuan) {
                                    router.push(`/sutra/${encodeURIComponent(sutra.title)}/${targetJuan}?tab=pin&pin=${encodedTitle}`, { scroll: false })
                                  } else {
                                    // 使用 isTitleMatch 查找匹配的标题
                                    const headingElements = document.querySelectorAll('h3')
                                    for (let i = 0; i < headingElements.length; i++) {
                                      const headingText = headingElements[i].textContent?.trim() || ''
                                      if (isTitleMatch(headingText, item.title)) {
                                        headingElements[i].scrollIntoView({ behavior: 'smooth', block: 'start' })
                                        break
                                      }
                                    }
                                  }
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm rounded-xl transition-all truncate text-[#5a4a3a] hover:bg-[#f5f2ed]"
                                title={item.title}
                              >
                                {item.title}
                              </button>
                            ))
                      ) : (
                        <div className="text-sm text-[#a09080] py-6 text-center">暂无品目</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 区块二：相关/人物 */}
            <div className="rounded-2xl shadow-sm border border-[#e8e0d5]/50 overflow-hidden">
              {/* Tab 切换 - 融合顶部圆角 */}
              <div className="flex bg-[#f5f2ed]">
                <button
                  onClick={() => setRelatedTab('related')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-all relative ${
                    relatedTab === 'related'
                      ? 'bg-white/80 text-[#3d3229]'
                      : 'text-[#8a7a6a] hover:text-[#5a4a3a] hover:bg-white/40'
                  }`}
                >
                  相关
                  {relatedTab === 'related' && (
                    <span className="absolute bottom-0 inset-x-0 h-0.5 bg-[#3d3229]"></span>
                  )}
                </button>
                <button
                  onClick={() => setRelatedTab('persons')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-all relative ${
                    relatedTab === 'persons'
                      ? 'bg-white/80 text-[#3d3229]'
                      : 'text-[#8a7a6a] hover:text-[#5a4a3a] hover:bg-white/40'
                  }`}
                >
                  人物
                  {relatedTab === 'persons' && (
                    <span className="absolute bottom-0 inset-x-0 h-0.5 bg-[#3d3229]"></span>
                  )}
                </button>
              </div>

              {/* 内容区域 */}
              <div className="bg-white/60 p-4 min-h-[200px]">

              {/* 相关内容 */}
              {relatedTab === 'related' && (
                <div className="space-y-4 max-h-[400px] overflow-auto pr-1 scrollbar-thin">
                  {/* 骨架加载 */}
                  {!relatedDataLoaded ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="space-y-2">
                          <div className="h-4 w-16 animate-pulse rounded bg-[#e8e0d5]" />
                          <div className="h-12 w-full animate-pulse rounded-xl bg-[#e8e0d5]" />
                        </div>
                      ))}
                    </div>
                  ) : (
                  <>
                      {/* 同本异译 */}
                      {relatedSutras.translations.length > 0 && (
                        <div>
                          <div className="text-xs text-[#9a8a7a] font-medium tracking-wider mb-2 px-1 flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-[#b45309]"></span>
                            同本异译
                          </div>
                          <div className="space-y-1">
                            {relatedSutras.translations.map((item, idx) => (
                              <Link
                                key={`trans-${idx}`}
                                href={`/sutra/${encodeURIComponent(item.title)}/1`}
                                className="block px-3 py-2.5 rounded-xl transition-all hover:bg-[#f5f2ed] group"
                              >
                                <div className="text-sm text-[#3d3229] group-hover:text-[#2d2419] truncate">{item.title}</div>
                                {(item.author || item.dynasty) && (
                                  <div className="text-xs text-[#9a8a7a] mt-1">
                                    {item.dynasty}{item.dynasty && item.author && ' · '}{item.author}
                                  </div>
                                )}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 注疏 */}
                      {relatedSutras.commentaries.length > 0 && (
                        <div>
                          <div className="text-xs text-[#9a8a7a] font-medium tracking-wider mb-2 px-1 flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-[#0f766e]"></span>
                            注疏
                          </div>
                          <div className="space-y-1">
                            {relatedSutras.commentaries.map((item, idx) => (
                              <Link
                                key={`comm-${idx}`}
                                href={`/sutra/${encodeURIComponent(item.title)}/1`}
                                className="block px-3 py-2.5 rounded-xl transition-all hover:bg-[#f5f2ed] group"
                              >
                                <div className="text-sm text-[#3d3229] group-hover:text-[#2d2419] truncate">{item.title}</div>
                                {item.author && (
                                  <div className="text-xs text-[#9a8a7a] mt-1">{item.author}</div>
                                )}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 其他相关 */}
                      {relatedSutras.related.length > 0 && (
                        <div>
                          <div className="text-xs text-[#9a8a7a] font-medium tracking-wider mb-2 px-1 flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-[#6366f1]"></span>
                            相关经典
                          </div>
                          <div className="space-y-1">
                            {relatedSutras.related.map((item, idx) => (
                              <Link
                                key={`rel-${idx}`}
                                href={`/sutra/${encodeURIComponent(item.title)}/1`}
                                className="block px-3 py-2.5 rounded-xl transition-all hover:bg-[#f5f2ed] group"
                              >
                                <div className="text-sm text-[#3d3229] group-hover:text-[#2d2419] truncate">{item.title}</div>
                                {item.author && (
                                  <div className="text-xs text-[#9a8a7a] mt-1">{item.author}</div>
                                )}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 无数据 - 只在数据加载完成后显示 */}
                      {relatedSutras.translations.length === 0 &&
                        relatedSutras.commentaries.length === 0 &&
                        relatedSutras.related.length === 0 && (
                          <div className="text-sm text-[#a09080] py-6 text-center">暂无相关经书</div>
                        )}
                    </>
                  )}
                </div>
              )}

              {/* 人物内容 */}
              {relatedTab === 'persons' && (
                <div className="space-y-1 max-h-[400px] overflow-auto pr-1 scrollbar-thin">
                  {/* 骨架加载 */}
                  {!relatedDataLoaded ? (
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-14 w-full animate-pulse rounded-xl bg-[#e8e0d5]" />
                      ))}
                    </div>
                  ) : relatedPersons.length > 0 ? (
                    relatedPersons.map((person, idx) => (
                      <Link
                        key={idx}
                        href={`/person/${encodeURIComponent(person.name)}`}
                        className="flex items-center justify-between px-3 py-3 rounded-xl transition-all hover:bg-[#f5f2ed] group"
                      >
                        <div>
                          <div className="text-sm text-[#3d3229] group-hover:text-[#2d2419] font-medium">{person.name}</div>
                          {person.dynasty && (
                            <div className="text-xs text-[#9a8a7a] mt-1">{person.dynasty}</div>
                          )}
                        </div>
                        {person.role && (
                          <span className="text-xs px-2.5 py-1 bg-[#f0ebe5] text-[#6a5a4a] rounded-lg font-medium">
                            {person.role}
                          </span>
                        )}
                      </Link>
                    ))
                  ) : (
                    <div className="text-sm text-[#a09080] py-6 text-center">暂无相关人物</div>
                  )}
                </div>
              )}
              </div>
            </div>
          </div>
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
