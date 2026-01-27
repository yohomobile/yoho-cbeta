import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { PersonDetail } from '../../data/types'
import PersonClient from './PersonClient'

type PageProps = {
  params: { name: string }
}

const API_BASE = process.env.API_BASE || 'http://localhost:3001'
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cbeta.yohomobile.dev'

// ISR: 每小时重新验证
export const revalidate = 3600

// 解析 aliases 字段，可能是 JSON 数组字符串或普通字符串
function parseAliases(aliases: string | undefined): string[] {
  if (!aliases) return []
  // 尝试解析 JSON 数组
  if (aliases.startsWith('[')) {
    try {
      const parsed = JSON.parse(aliases)
      if (Array.isArray(parsed)) {
        return parsed.filter((s): s is string => typeof s === 'string' && s.length > 0)
      }
    } catch {
      // 解析失败，按普通字符串处理
    }
  }
  // 按逗号分隔
  return aliases.split(/[,，]/).map(s => s.trim()).filter(Boolean)
}

async function getPersonDetail(name: string): Promise<PersonDetail | null> {
  const url = `${API_BASE}/person/${encodeURIComponent(name)}`
  const res = await fetch(url, {
    next: { revalidate: 3600 },
  })
  if (!res.ok) return null
  return res.json()
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const name = decodeURIComponent(params.name)
  const person = await getPersonDetail(name)

  if (!person) {
    return {
      title: '人物未找到 - 佛典数据库',
      description: '未找到对应的人物',
    }
  }

  const workCount = person.works.length
  const dynastyInfo = person.dynasty_name ? `${person.dynasty_name}` : ''
  const identityInfo = person.identity || ''
  const aliasesList = parseAliases(person.aliases)
  const aliasesText = aliasesList.length > 0 ? `（${aliasesList.join('、')}）` : ''

  const pageDescription = [
    dynastyInfo,
    identityInfo,
    person.name,
    aliasesText,
    `共${workCount}部作品`,
  ].filter(Boolean).join('')

  const canonicalUrl = `${BASE_URL}/person/${encodeURIComponent(person.name)}`

  return {
    title: `${person.name} - 佛典数据库`,
    description: pageDescription,
    keywords: [
      person.name,
      ...aliasesList,
      person.dynasty_name,
      person.identity,
      '佛经',
      '译者',
      '高僧',
    ].filter((k): k is string => Boolean(k)),
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: person.name,
      description: pageDescription,
      type: 'profile',
      url: canonicalUrl,
      locale: 'zh_CN',
      siteName: '佛典数据库',
    },
    twitter: {
      card: 'summary',
      title: person.name,
      description: pageDescription,
    },
  }
}

export default async function PersonPage({ params }: PageProps) {
  const name = decodeURIComponent(params.name)
  const person = await getPersonDetail(name)

  if (!person) {
    notFound()
  }

  // JSON-LD 结构化数据
  const jsonLdAliases = parseAliases(person.aliases)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: person.name,
    alternateName: jsonLdAliases.length > 0 ? jsonLdAliases : undefined,
    description: person.bio || undefined,
    nationality: person.nationality || undefined,
    jobTitle: person.identity || undefined,
    url: `${BASE_URL}/person/${encodeURIComponent(person.name)}`,
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
        name: person.name,
        item: `${BASE_URL}/person/${encodeURIComponent(person.name)}`,
      },
    ],
  }

  // 生成 SSR 预渲染内容
  const aliasesList = parseAliases(person.aliases)
  const workCount = person.works.length
  const topWorks = person.works.slice(0, 10) // 取前10部代表作品

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
      {/* SSR 预渲染的人物信息，供搜索引擎抓取 */}
      <article
        className="sr-only"
        aria-hidden="true"
        itemScope
        itemType="https://schema.org/Person"
      >
        <h1 itemProp="name">{person.name}</h1>
        {aliasesList.length > 0 && (
          <p>别名：{aliasesList.join('、')}</p>
        )}
        {person.dynasty_name && (
          <p itemProp="nationality">朝代：{person.dynasty_name}</p>
        )}
        {person.identity && (
          <p itemProp="jobTitle">身份：{person.identity}</p>
        )}
        {person.bio && (
          <div itemProp="description">
            <h2>简介</h2>
            <p>{person.bio}</p>
          </div>
        )}
        <div>
          <h2>作品列表（共{workCount}部）</h2>
          <ul>
            {topWorks.map(work => (
              <li key={work.id}>
                《{work.title}》
                {work.juan_count && work.juan_count > 1 && `（${work.juan_count}卷）`}
              </li>
            ))}
            {workCount > 10 && <li>...等共{workCount}部作品</li>}
          </ul>
        </div>
      </article>
      <PersonClient person={person} />
    </>
  )
}
