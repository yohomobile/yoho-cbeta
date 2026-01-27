import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import SutraReader from './SutraReader'
import type { SutraMeta, Block, InlineNode } from '../../../data/types'
import { parseJuanContent } from '../../../data/cbetaParser'

type PageProps = {
  params: { title: string; juan: string }
}

type JuanContentResponse = {
  content?: unknown[]
  milestoneCount?: number
  fullToc?: unknown[]
}

const API_BASE = process.env.API_BASE || 'http://localhost:3001'
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cbeta.yohomobile.dev'

// ISR: 每小时重新验证
export const revalidate = 3600

async function getSutraMeta(title: string): Promise<SutraMeta | null> {
  const url = `${API_BASE}/sutra/${encodeURIComponent(title)}`
  const res = await fetch(url, {
    next: { revalidate: 3600 },
  })
  if (!res.ok) return null
  return res.json()
}

async function getJuanContent(title: string, juan: number): Promise<JuanContentResponse | null> {
  const url = `${API_BASE}/sutra/${encodeURIComponent(title)}/juan/${juan}`
  const res = await fetch(url, {
    next: { revalidate: 3600 },
  })
  if (!res.ok) return null
  return res.json()
}

// 从 InlineNode 数组提取纯文本
function extractTextFromInlines(inlines: InlineNode[]): string {
  return inlines.map(node => {
    if (node.type === 'text') return node.text
    if (node.type === 'foreign' || node.type === 'emph' || node.type === 'term' || node.type === 'ref') {
      return extractTextFromInlines(node.inlines)
    }
    if (node.type === 'inlineGroup') {
      // 只取第一个（通常是中文）
      const first = node.items[0]
      return first ? extractTextFromInlines(first.inlines) : ''
    }
    if (node.type === 'sanskritMarker') return node.chinese
    return ''
  }).join('')
}

// 从 blocks 中提取前几段文本用于 SEO
function extractExcerpt(blocks: Block[], maxLength = 200): string {
  const texts: string[] = []
  let totalLength = 0

  for (const block of blocks) {
    if (totalLength >= maxLength) break

    if (block.type === 'paragraph') {
      const text = extractTextFromInlines(block.inlines).trim()
      if (text) {
        texts.push(text)
        totalLength += text.length
      }
    } else if (block.type === 'verse') {
      for (const line of block.lines) {
        const text = extractTextFromInlines(line).trim()
        if (text) {
          texts.push(text)
          totalLength += text.length
          if (totalLength >= maxLength) break
        }
      }
    }
  }

  const result = texts.join(' ')
  if (result.length > maxLength) {
    return result.slice(0, maxLength) + '…'
  }
  return result
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const title = decodeURIComponent(params.title)
  const juan = parseInt(params.juan, 10)
  const [sutra, juanData] = await Promise.all([
    getSutraMeta(title),
    getJuanContent(title, juan),
  ])

  if (!sutra) {
    return {
      title: '经文未找到 - 佛典数据库',
      description: '未找到对应的经文',
    }
  }

  const pageTitle = sutra.juan_count === 1
    ? `${sutra.title} - 佛典数据库`
    : `${sutra.title} 第${juan}卷 - 佛典数据库`

  // 获取经文摘要作为 description
  let excerpt = ''
  if (juanData?.content) {
    const chapter = parseJuanContent(juanData.content, `第${juan}卷`)
    excerpt = extractExcerpt(chapter.blocks, 150)
  }

  const metaInfo = [
    sutra.title,
    sutra.author_raw ? `${sutra.author_raw}${sutra.author_raw.endsWith('译') ? '' : '译'}` : '',
    sutra.juan_count === 1 ? '' : `第${juan}卷`,
    sutra.juan_count ? `共${sutra.juan_count}卷` : '',
  ].filter(Boolean).join('，')

  // 优先使用经文内容，fallback 到元信息
  const pageDescription = excerpt ? `${metaInfo}。${excerpt}` : metaInfo

  const canonicalUrl = `${BASE_URL}/sutra/${encodeURIComponent(sutra.title)}/${juan}`

  return {
    title: pageTitle,
    description: pageDescription,
    keywords: [
      sutra.title,
      sutra.title_traditional,
      sutra.title_sanskrit,
      sutra.author_raw,
      sutra.translation_dynasty,
      '佛经',
      '佛典',
    ].filter((k): k is string => Boolean(k)),
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: sutra.juan_count === 1 ? sutra.title : `${sutra.title} 第${juan}卷`,
      description: pageDescription,
      type: 'article',
      url: canonicalUrl,
      locale: 'zh_CN',
      siteName: '佛典数据库',
    },
    twitter: {
      card: 'summary',
      title: sutra.juan_count === 1 ? sutra.title : `${sutra.title} 第${juan}卷`,
      description: pageDescription,
    },
  }
}

export default async function SutraJuanPage({ params }: PageProps) {
  const title = decodeURIComponent(params.title)
  const juan = parseInt(params.juan, 10)
  const [sutra, juanData] = await Promise.all([
    getSutraMeta(title),
    getJuanContent(title, juan),
  ])

  if (!sutra) {
    notFound()
  }

  // 验证卷号有效性
  if (isNaN(juan) || juan < 1) {
    redirect(`/sutra/${encodeURIComponent(title)}/1`)
  }

  // 验证卷号不超过总卷数
  const juanCount = sutra.juan_count || 1
  if (juan > juanCount) {
    redirect(`/sutra/${encodeURIComponent(title)}/${juanCount}`)
  }

  // 解析经文内容，提取摘要用于 SSR
  let excerpt = ''
  if (juanData?.content) {
    const chapter = parseJuanContent(juanData.content, `第${juan}卷`)
    excerpt = extractExcerpt(chapter.blocks, 500)
  }

  // JSON-LD 结构化数据
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: sutra.title,
    alternateName: [sutra.title_traditional, sutra.title_sanskrit, sutra.title_alt].filter(Boolean),
    author: sutra.author_raw ? {
      '@type': 'Person',
      name: sutra.author_raw,
    } : undefined,
    inLanguage: 'zh-CN',
    numberOfPages: sutra.juan_count,
    url: `${BASE_URL}/sutra/${encodeURIComponent(sutra.title)}/${juan}`,
    isPartOf: {
      '@type': 'BookSeries',
      name: '佛典数据库',
      url: BASE_URL,
    },
  }

  // 面包屑结构化数据
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: '首页',
        item: BASE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: sutra.title,
        item: `${BASE_URL}/sutra/${encodeURIComponent(sutra.title)}/1`,
      },
      ...(sutra.juan_count && sutra.juan_count > 1 ? [{
        '@type': 'ListItem',
        position: 3,
        name: `第${juan}卷`,
        item: `${BASE_URL}/sutra/${encodeURIComponent(sutra.title)}/${juan}`,
      }] : []),
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* SSR 预渲染的经文摘要，供搜索引擎抓取 */}
      {excerpt && (
        <article
          className="sr-only"
          aria-hidden="true"
          itemScope
          itemType="https://schema.org/Article"
        >
          <h1 itemProp="headline">
            {sutra.title}
            {juanCount > 1 && ` 第${juan}卷`}
          </h1>
          {sutra.author_raw && (
            <p itemProp="author">{sutra.author_raw}</p>
          )}
          <div itemProp="articleBody">
            <p>{excerpt}</p>
          </div>
        </article>
      )}
      <SutraReader sutra={sutra} initialJuan={juan} />
    </>
  )
}
