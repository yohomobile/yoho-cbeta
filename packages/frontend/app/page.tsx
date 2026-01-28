import type { Metadata } from 'next'
import { Suspense } from 'react'
import HomeClient from './HomeClient'

const API_BASE = process.env.API_BASE || 'http://localhost:3001'
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cbeta.yohomobile.dev'

// ISR: 每小时重新验证
export const revalidate = 3600

type PopularText = {
  id: string
  title: string
  alias?: string
  tag: string
  dynasty?: string
  author?: string
}

const POPULAR_TEXT_SEEDS = [
  // 经
  { id: 'T08n0235', tag: '般若', fallbackTitle: '金刚般若波罗蜜经', displayTitle: '金刚经' },
  { id: 'T08n0251', tag: '般若', fallbackTitle: '般若波罗蜜多心经', displayTitle: '心经' },
  { id: 'T12n0366', tag: '净土', fallbackTitle: '佛说阿弥陀经', displayTitle: '阿弥陀经' },
  { id: 'T09n0262', tag: '法华', fallbackTitle: '妙法莲华经', displayTitle: '法华经' },
  { id: 'T19n0945', tag: '首楞严', fallbackTitle: '大佛顶首楞严经', displayTitle: '楞严经' },
  { id: 'T13n0412', tag: '本愿', fallbackTitle: '地藏菩萨本愿经', displayTitle: '地藏经' },
  { id: 'T10n0279', tag: '华严', fallbackTitle: '大方广佛华严经', displayTitle: '华严经' },
  { id: 'T12n0374', tag: '涅槃', fallbackTitle: '大般涅槃经', displayTitle: '涅槃经' },
  { id: 'T14n0475', tag: '净名', fallbackTitle: '维摩诘所说经', displayTitle: '维摩诘经' },
  { id: 'T16n0670', tag: '唯识', fallbackTitle: '解深密经' },
  // 论
  { id: 'T25n1509', tag: '论', fallbackTitle: '大智度论' },
  { id: 'T30n1579', tag: '论', fallbackTitle: '瑜伽师地论' },
  { id: 'T31n1585', tag: '论', fallbackTitle: '成唯识论' },
  { id: 'T30n1564', tag: '论', fallbackTitle: '中论' },
  { id: 'T32n1666', tag: '论', fallbackTitle: '大乘起信论' },
  { id: 'T29n1558', tag: '论', fallbackTitle: '阿毘达磨俱舍论', displayTitle: '俱舍论' },
] as const

export const metadata: Metadata = {
  title: '佛典数据库 - 中文佛教经典全文搜索与阅读',
  description: '收录大正藏、卍续藏等多部佛教藏经，共计数万部经典。提供全文搜索、分类浏览、原文阅读功能，是研究佛学的重要工具。',
  keywords: ['佛经', '佛典', '经文', '佛教', '大正藏', '卍续藏', 'CBETA', '佛学', '经典', '搜索'],
  alternates: {
    canonical: BASE_URL,
  },
  openGraph: {
    title: '佛典数据库',
    description: '中文佛教经典全文搜索与阅读平台，收录大正藏、卍续藏等数万部经典',
    type: 'website',
    url: BASE_URL,
    locale: 'zh_CN',
    siteName: '佛典数据库',
  },
  twitter: {
    card: 'summary',
    title: '佛典数据库',
    description: '中文佛教经典全文搜索与阅读平台',
  },
}

async function getInitialData() {
  try {
    const res = await fetch(`${API_BASE}/texts?limit=1&offset=0`, {
      next: { revalidate: 3600 },
    })

    const data = res.ok ? await res.json() : { pagination: { total: 0 } }

    return {
      total: data.pagination?.total || 0,
    }
  } catch (error) {
    console.error('Failed to fetch initial data:', error)
    return {
      total: 0,
    }
  }
}

async function getPopularTexts(): Promise<PopularText[]> {
  const items = await Promise.all(
    POPULAR_TEXT_SEEDS.map(async (seed) => {
      try {
        const res = await fetch(`${API_BASE}/texts/${seed.id}`, {
          next: { revalidate: 3600 },
        })
        if (!res.ok) {
          throw new Error(`Failed to fetch ${seed.id}`)
        }
        const data = await res.json()
        return {
          id: seed.id,
          title: data.title || seed.fallbackTitle,
          alias: 'displayTitle' in seed ? seed.displayTitle : undefined,
          tag: seed.tag,
          dynasty: data.translation_dynasty || undefined,
          author: data.author_raw || undefined,
        }
      } catch (error) {
        console.error('Failed to fetch popular text:', seed.id, error)
        return {
          id: seed.id,
          title: seed.fallbackTitle,
          tag: seed.tag,
        }
      }
    })
  )

  return items
}

export default async function Home() {
  const [initialData, popularTexts] = await Promise.all([
    getInitialData(),
    getPopularTexts(),
  ])
  const { total } = initialData

  // JSON-LD 结构化数据
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: '佛典数据库',
    url: BASE_URL,
    description: '中文佛教经典全文搜索与阅读平台',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
    publisher: {
      '@type': 'Organization',
      name: '佛典数据库',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Suspense fallback={<div className="min-h-screen bg-[#f8f5f0]" />}>
        <HomeClient initialTotal={total} popularTexts={popularTexts} />
      </Suspense>
    </>
  )
}
