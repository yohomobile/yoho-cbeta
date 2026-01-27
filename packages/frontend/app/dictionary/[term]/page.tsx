/**
 * 词条详情页 - 使用搜索页面布局显示词条
 */

import type { Metadata } from 'next'
import DictionaryClient from '../DictionaryClient'

const API_BASE = process.env.API_BASE || 'http://localhost:3001'
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cbeta.yohomobile.dev'

export const revalidate = 3600

interface DictionaryEntry {
  id?: number
  term: string
  definition: string
  definition_text: string
  definition_preview?: string
  source: string
}

interface DictionaryResponse {
  term: string
  entries: DictionaryEntry[]
  related: string[]
}

interface DictionarySource {
  source: string
  count: string
}

async function getDictionaryEntry(term: string): Promise<DictionaryResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/dictionary/${encodeURIComponent(term)}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

async function getFeaturedTerms(): Promise<DictionaryEntry[]> {
  try {
    const res = await fetch(`${API_BASE}/dictionary/featured?limit=12`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.data || []
  } catch {
    return []
  }
}

async function getDictionarySources(): Promise<DictionarySource[]> {
  try {
    const res = await fetch(`${API_BASE}/dictionary?limit=1`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.sources || []
  } catch {
    return []
  }
}

type Params = Promise<{ term: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { term: encodedTerm } = await params
  const term = decodeURIComponent(encodedTerm)
  const data = await getDictionaryEntry(term)

  if (!data || data.entries.length === 0) {
    return {
      title: '词条不存在 - 佛学词典',
    }
  }

  const firstEntry = data.entries[0]
  const description = firstEntry.definition_text.slice(0, 160)

  return {
    title: `${term} - 佛学词典`,
    description,
    keywords: [term, '佛学', '佛教', firstEntry.source, ...data.related.slice(0, 5)],
    alternates: {
      canonical: `${BASE_URL}/dictionary/${encodeURIComponent(term)}`,
    },
    openGraph: {
      title: `${term} - 佛学词典`,
      description,
      url: `${BASE_URL}/dictionary/${encodeURIComponent(term)}`,
      type: 'article',
    },
  }
}

export default async function DictionaryTermPage({ params }: { params: Params }) {
  const { term: encodedTerm } = await params
  const term = decodeURIComponent(encodedTerm)

  // 并行获取数据
  const [termData, featuredTerms, sources] = await Promise.all([
    getDictionaryEntry(term),
    getFeaturedTerms(),
    getDictionarySources(),
  ])

  const totalCount = sources.reduce((sum, s) => sum + parseInt(s.count, 10), 0)

  // JSON-LD 结构化数据
  const jsonLd = termData && termData.entries.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: term,
    description: termData.entries[0].definition_text.slice(0, 300),
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      name: termData.entries[0].source,
    },
  } : null

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: '佛典数据库',
        item: BASE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: '佛学词典',
        item: `${BASE_URL}/dictionary`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: term,
        item: `${BASE_URL}/dictionary/${encodeURIComponent(term)}`,
      },
    ],
  }

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* SSR 预渲染内容 */}
      <article className="sr-only" aria-hidden="true" itemScope itemType="https://schema.org/DefinedTerm">
        <h1 itemProp="name">{term}</h1>
        {termData && termData.entries.map((entry, i) => (
          <section key={i}>
            <p>来源：{entry.source}</p>
            <div itemProp="description">{entry.definition_text}</div>
          </section>
        ))}
        {termData && termData.related.length > 0 && (
          <nav>
            <h2>相关词条</h2>
            <ul>
              {termData.related.map(r => (
                <li key={r}><a href={`/dictionary/${encodeURIComponent(r)}`}>{r}</a></li>
              ))}
            </ul>
          </nav>
        )}
      </article>

      <DictionaryClient
        initialFeatured={featuredTerms}
        sources={sources}
        totalCount={totalCount}
        initialTerm={term}
        initialTermDetail={termData}
      />
    </>
  )
}
