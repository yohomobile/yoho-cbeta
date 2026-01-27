import type { MetadataRoute } from 'next'

const API_BASE = process.env.API_BASE || 'http://localhost:3001'
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cbeta.yohomobile.dev'

type TextItem = {
  id: string
  title: string
  juan_count?: number
}

type PersonItem = {
  id: number
  name: string
}

// 每个 sitemap 最多包含的 URL 数量（Google 建议不超过 50000）
const URLS_PER_SITEMAP = 5000
// API 每次请求的数量
const API_PAGE_SIZE = 500
// 内容最后修改日期（佛经内容是静态的，使用固定日期）
const CONTENT_LAST_MODIFIED = new Date('2025-01-01')

// 获取所有经文（分页获取）
async function getAllTexts(): Promise<TextItem[]> {
  const allTexts: TextItem[] = []
  let offset = 0
  let hasMore = true

  while (hasMore) {
    try {
      const res = await fetch(`${API_BASE}/texts?limit=${API_PAGE_SIZE}&offset=${offset}`, {
        next: { revalidate: 86400 },
      })
      if (!res.ok) break

      const data = await res.json()
      const texts: TextItem[] = data.data || []
      allTexts.push(...texts)

      hasMore = texts.length === API_PAGE_SIZE
      offset += API_PAGE_SIZE
    } catch {
      break
    }
  }

  return allTexts
}

// 获取所有人物（分页获取）
async function getAllPersons(): Promise<PersonItem[]> {
  const allPersons: PersonItem[] = []
  let offset = 0
  let hasMore = true

  while (hasMore) {
    try {
      const res = await fetch(`${API_BASE}/persons?limit=${API_PAGE_SIZE}&offset=${offset}`, {
        next: { revalidate: 86400 },
      })
      if (!res.ok) break

      const data = await res.json()
      const persons: PersonItem[] = data.data || []
      allPersons.push(...persons)

      hasMore = persons.length === API_PAGE_SIZE
      offset += API_PAGE_SIZE
    } catch {
      break
    }
  }

  return allPersons
}

// 生成 sitemap 索引，每个 sitemap 文件最多 URLS_PER_SITEMAP 条 URL
export async function generateSitemaps() {
  const texts = await getAllTexts()
  const persons = await getAllPersons()

  // 计算所有 URL 数量（每部经文的每一卷 + 人物页 + 首页）
  let totalUrls = 1 // 首页
  for (const text of texts) {
    totalUrls += text.juan_count || 1
  }
  totalUrls += persons.length

  // 计算需要多少个 sitemap 文件
  const sitemapCount = Math.ceil(totalUrls / URLS_PER_SITEMAP)

  return Array.from({ length: sitemapCount }, (_, i) => ({ id: i }))
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const sitemapEntries: MetadataRoute.Sitemap = []

  // 获取所有数据
  const texts = await getAllTexts()
  const persons = await getAllPersons()

  // 构建所有 URL 列表
  type UrlEntry = MetadataRoute.Sitemap[number]
  const allUrls: UrlEntry[] = []

  // 首页（首页内容会更新，使用当前日期）
  allUrls.push({
    url: BASE_URL,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 1,
  })

  // 经文页面（每部经文的每一卷）- 内容是静态的，使用固定日期
  for (const text of texts) {
    const juanCount = text.juan_count || 1
    for (let juan = 1; juan <= juanCount; juan++) {
      allUrls.push({
        url: `${BASE_URL}/sutra/${encodeURIComponent(text.title)}/${juan}`,
        lastModified: CONTENT_LAST_MODIFIED,
        changeFrequency: 'yearly',
        priority: 0.8,
      })
    }
  }

  // 人物页面 - 内容是静态的，使用固定日期
  for (const person of persons) {
    allUrls.push({
      url: `${BASE_URL}/person/${encodeURIComponent(person.name)}`,
      lastModified: CONTENT_LAST_MODIFIED,
      changeFrequency: 'yearly',
      priority: 0.6,
    })
  }

  // 根据 id 获取当前 sitemap 的 URL 范围
  const start = id * URLS_PER_SITEMAP
  const end = start + URLS_PER_SITEMAP
  sitemapEntries.push(...allUrls.slice(start, end))

  return sitemapEntries
}
