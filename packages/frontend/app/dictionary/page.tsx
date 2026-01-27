/**
 * 佛学词典首页
 */

import type { Metadata } from 'next'
import DictionaryClient from './DictionaryClient'

const API_BASE = process.env.API_BASE || 'http://localhost:3001'
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cbeta.yohomobile.dev'

export const revalidate = 3600

export const metadata: Metadata = {
  title: '佛学词典 - 佛典数据库',
  description: '在线佛学词典，收录丁福保佛学大辞典等权威佛学词典，提供佛学名词、术语、人物、经典的详细解释。',
  keywords: ['佛学词典', '佛教辞典', '丁福保', '佛学名词', '佛教术语'],
  alternates: {
    canonical: `${BASE_URL}/dictionary`,
  },
  openGraph: {
    title: '佛学词典 - 佛典数据库',
    description: '在线佛学词典，收录丁福保佛学大辞典等权威佛学词典，提供佛学名词、术语、人物、经典的详细解释。',
    url: `${BASE_URL}/dictionary`,
    type: 'website',
  },
}

interface DictionaryEntry {
  term: string
  definition_preview: string
  source: string
}

interface DictionarySource {
  source: string
  count: string
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

export default async function DictionaryPage() {
  const [featuredTerms, sources] = await Promise.all([
    getFeaturedTerms(),
    getDictionarySources(),
  ])

  const totalCount = sources.reduce((sum, s) => sum + parseInt(s.count, 10), 0)

  // JSON-LD 结构化数据
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: '佛学词典',
    description: '在线佛学词典，收录丁福保佛学大辞典等权威佛学词典',
    url: `${BASE_URL}/dictionary`,
    isPartOf: {
      '@type': 'WebSite',
      name: '佛典数据库',
      url: BASE_URL,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${BASE_URL}/dictionary?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* SSR 预渲染内容 */}
      <article className="sr-only" aria-hidden="true">
        <h1>佛学词典</h1>
        <p>收录 {totalCount.toLocaleString()} 条佛学词条</p>
        <h2>词典来源</h2>
        <ul>
          {sources.map(s => (
            <li key={s.source}>{s.source}：{parseInt(s.count, 10).toLocaleString()} 条</li>
          ))}
        </ul>
        <h2>推荐词条</h2>
        <ul>
          {featuredTerms.map(t => (
            <li key={t.term}>{t.term}：{t.definition_preview}</li>
          ))}
        </ul>
      </article>

      <DictionaryClient
        initialFeatured={featuredTerms}
        sources={sources}
        totalCount={totalCount}
      />
    </>
  )
}
