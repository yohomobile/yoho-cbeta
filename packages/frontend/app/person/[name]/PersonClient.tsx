'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { PersonDetail } from '../../data/types'

// 角色类型显示名称
const roleTypeLabels: Record<string, string> = {
  translator: '翻译',
  author: '撰述',
  commentator: '注疏',
  compiler: '编纂',
  editor: '校订',
  speaker: '口述',
  other: '其他',
}

type WikiInfo = {
  found: boolean
  extract?: string
  url?: string
  thumbnail?: string
}

type Props = {
  person: PersonDetail
}

// 解析并渲染 wiki 内容，美化章节标题
function renderWikiContent(text: string) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let currentParagraph: string[] = []
  let key = 0

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const content = currentParagraph.join('\n').trim()
      if (content) {
        elements.push(
          <p key={key++} className="text-sm text-[#6b4a2b] leading-relaxed">
            {content}
          </p>
        )
      }
      currentParagraph = []
    }
  }

  for (const line of lines) {
    // 二级标题 == xxx ==
    const h2Match = line.match(/^==\s*([^=]+?)\s*==$/)
    if (h2Match) {
      flushParagraph()
      // 过滤掉不需要的章节
      const title = h2Match[1].trim()
      if (['参见', '注释', '注釋', '参考文献', '參考文獻', '外部链接', '外部連結', '研究書目', '圖片', '图片'].includes(title)) {
        break // 跳过后面的内容
      }
      elements.push(
        <h3 key={key++} className="mt-5 mb-2 text-base font-semibold text-[#5d5348] border-b border-[#e6d6bf] pb-1">
          {title}
        </h3>
      )
      continue
    }

    // 三级标题 === xxx ===
    const h3Match = line.match(/^===\s*([^=]+?)\s*===$/)
    if (h3Match) {
      flushParagraph()
      elements.push(
        <h4 key={key++} className="mt-4 mb-1.5 text-sm font-semibold text-[#6b5a4a]">
          {h3Match[1].trim()}
        </h4>
      )
      continue
    }

    // 四级标题 ==== xxx ====
    const h4Match = line.match(/^====\s*([^=]+?)\s*====$/)
    if (h4Match) {
      flushParagraph()
      elements.push(
        <h5 key={key++} className="mt-3 mb-1 text-sm font-medium text-[#7a6b5a]">
          {h4Match[1].trim()}
        </h5>
      )
      continue
    }

    // 空行分段
    if (line.trim() === '') {
      flushParagraph()
      continue
    }

    // 普通文本
    currentParagraph.push(line)
  }

  flushParagraph()
  return elements
}

export default function PersonClient({ person }: Props) {
  const [activeTab, setActiveTab] = useState<'bio' | 'works'>('bio')
  const [wikiInfo, setWikiInfo] = useState<WikiInfo | null>(null)
  const [wikiLoading, setWikiLoading] = useState(false)

  // 当切换到生平 Tab 时加载 Wikipedia 信息
  useEffect(() => {
    if (activeTab === 'bio' && !wikiInfo && !wikiLoading) {
      setWikiLoading(true)
      fetch(`/api/person/${encodeURIComponent(person.name)}/wiki`)
        .then((res) => res.json())
        .then((data) => {
          setWikiInfo(data)
        })
        .catch(() => {
          setWikiInfo({ found: false })
        })
        .finally(() => {
          setWikiLoading(false)
        })
    }
  }, [activeTab, person.name, wikiInfo, wikiLoading])

  // 按角色类型分组作品
  const worksByRole = person.works.reduce((acc, work) => {
    const role = work.role_type || 'other'
    if (!acc[role]) acc[role] = []
    acc[role].push(work)
    return acc
  }, {} as Record<string, typeof person.works>)

  // 角色类型排序
  const roleOrder = ['translator', 'author', 'speaker', 'commentator', 'compiler', 'editor', 'other']
  const sortedRoles = Object.keys(worksByRole).sort((a, b) => {
    const aIndex = roleOrder.indexOf(a)
    const bIndex = roleOrder.indexOf(b)
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex)
  })

  const hasBio = person.bio || person.aliases || person.identity || person.nationality || person.dynasty_name

  // 解析别名（可能是 JSON 数组字符串或普通字符串）
  const parseAliases = (aliases: string | null | undefined): string[] => {
    if (!aliases) return []
    try {
      const parsed = JSON.parse(aliases)
      if (Array.isArray(parsed)) return parsed
      return [aliases]
    } catch {
      return [aliases]
    }
  }
  const aliasesList = parseAliases(person.aliases)

  return (
    <div className="relative min-h-screen text-[color:var(--ink)] bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.18),transparent_45%),radial-gradient(circle_at_80%_20%,_rgba(190,18,60,0.12),transparent_50%),linear-gradient(180deg,_#fbf7f0_0%,_#efe4d2_100%)]">
      <div className="relative">
        <header className="sticky top-0 z-50 border-b border-white/40 bg-[#2a1f16]/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 py-3">
            <Link
              href="/"
              className="rounded-full border border-white/30 bg-white/10 px-3 py-2 text-xs text-[#fff4e0] transition hover:bg-white/20"
            >
              首页
            </Link>
            <h1 className="text-sm sm:text-base font-display tracking-wide text-[#fff4e0]">
              {person.name}
            </h1>
            <div className="w-[52px]" />
          </div>
        </header>

        <main className="relative mx-auto max-w-[1200px] px-4 py-6 sm:py-8">
          {/* 人物头像和名字 */}
          <section className="mb-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0f766e] to-[#134e4a] text-2xl text-white shadow-lg">
                {person.name.charAt(0)}
              </div>
              <div>
                <div className="flex flex-wrap items-baseline gap-2">
                  <h2 className="text-xl font-bold text-[#5d5348]">{person.name}</h2>
                  {aliasesList.length > 0 && (
                    <span className="text-sm text-[#9a7b4f]">
                      {aliasesList.join('、')}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {person.dynasty_name && (
                    <span className="rounded-full bg-[#e6f5f3] px-2 py-0.5 text-xs text-[#0f766e]">
                      {person.dynasty_name}
                    </span>
                  )}
                  {person.identity && (
                    <span className="rounded-full bg-[#fdf1e1] px-2 py-0.5 text-xs text-[#b45309]">
                      {person.identity}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Tab 切换 - 分卷/分品样式 */}
          <div className="mb-6 flex gap-1 rounded-lg bg-[#f5ebe0] p-1">
            <button
              onClick={() => setActiveTab('bio')}
              className={`flex-1 rounded-md px-2 py-1.5 text-sm transition ${
                activeTab === 'bio'
                  ? 'bg-white text-[#5d5348] shadow-sm'
                  : 'text-[#8b7355] hover:text-[#5d5348]'
              }`}
            >
              简介
            </button>
            <button
              onClick={() => setActiveTab('works')}
              className={`flex-1 rounded-md px-2 py-1.5 text-sm transition ${
                activeTab === 'works'
                  ? 'bg-white text-[#5d5348] shadow-sm'
                  : 'text-[#8b7355] hover:text-[#5d5348]'
              }`}
            >
              作品
              <span className="ml-1.5 text-xs opacity-70">
                {person.works.length}
              </span>
            </button>
          </div>

          {/* 生平 Tab */}
          {activeTab === 'bio' && (
            <section className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-lg backdrop-blur-md">
              <div className="space-y-4">
                {/* 基本信息 */}
                {person.nationality && (
                  <div>
                    <h3 className="text-sm font-semibold text-[#5d5348]">国籍</h3>
                    <p className="mt-1 text-sm text-[#6b4a2b]">{person.nationality}</p>
                  </div>
                )}
                {person.bio && (
                  <div>
                    <h3 className="text-sm font-semibold text-[#5d5348]">简介</h3>
                    <p className="mt-1 text-sm text-[#6b4a2b] leading-relaxed whitespace-pre-wrap">
                      {person.bio}
                    </p>
                  </div>
                )}

                {/* 详细简介 */}
                {wikiLoading && (
                  <div className="flex items-center gap-2 text-sm text-[#9a7b4f]">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#0f766e] border-t-transparent" />
                    正在加载...
                  </div>
                )}
                {wikiInfo?.found && wikiInfo.extract && (
                  <div className="space-y-2">
                    {renderWikiContent(wikiInfo.extract)}
                  </div>
                )}
                {wikiInfo && !wikiInfo.found && !hasBio && (
                  <p className="text-sm text-[#9a7b4f]">暂无简介资料</p>
                )}
                {!wikiInfo && !wikiLoading && !hasBio && (
                  <p className="text-sm text-[#9a7b4f]">
                    {person.dynasty_name && `${person.dynasty_name}`}
                    {person.identity && `${person.dynasty_name ? ' · ' : ''}${person.identity}`}
                    {!person.dynasty_name && !person.identity && '暂无简介资料'}
                  </p>
                )}
              </div>
            </section>
          )}

          {/* 作品 Tab */}
          {activeTab === 'works' && (
            <section className="space-y-5">
              {sortedRoles.map((role) => {
                const works = worksByRole[role]
                const roleLabel = roleTypeLabels[role] || role
                return (
                  <div
                    key={role}
                    className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-lg backdrop-blur-md"
                  >
                    <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[#5d5348]">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0f766e] text-xs text-white">
                        {works.length}
                      </span>
                      {roleLabel}作品
                    </h3>
                    <div className="space-y-2">
                      {works.map((work) => (
                        <Link
                          key={work.id}
                          href={`/sutra/${encodeURIComponent(work.title)}/1`}
                          aria-label={`阅读 ${work.title}`}
                          className="group flex items-center justify-between gap-3 rounded-lg border border-[#e6d6bf]/60 bg-gradient-to-r from-white/80 to-[#faf6f0]/80 px-4 py-2.5 transition-all duration-150 hover:border-[#d4c4a8] hover:shadow-sm hover:from-white hover:to-[#f5efe5]"
                        >
                          <div className="min-w-0 flex-1">
                            <h4 className="font-display text-sm text-[#2f241d] truncate group-hover:text-[#1a4d4a]">
                              {work.title}
                            </h4>
                            {work.role_raw && (
                              <p className="mt-0.5 text-[11px] text-[#b49b7d] truncate">
                                {work.role_raw}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5 text-[10px]">
                            {work.juan_count && work.juan_count > 1 && (
                              <span className="rounded bg-[#f3ebe0] px-1.5 py-0.5 text-[#9a7b4f]">{work.juan_count}卷</span>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              })}
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
