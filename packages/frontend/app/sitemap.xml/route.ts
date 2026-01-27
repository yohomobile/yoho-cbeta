import { NextResponse } from 'next/server'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cbeta.yohomobile.dev'

// sitemap 文件数量（与 sitemap.ts 中 generateSitemaps 保持一致）
const SITEMAP_COUNT = 5
// 内容最后修改日期（与 sitemap.ts 保持一致）
const CONTENT_LAST_MODIFIED = '2025-01-01'

export async function GET() {
  const sitemaps = Array.from({ length: SITEMAP_COUNT }, (_, i) => ({
    loc: `${BASE_URL}/sitemap/${i}.xml`,
    lastmod: CONTENT_LAST_MODIFIED,
  }))

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.map(s => `  <sitemap>
    <loc>${s.loc}</loc>
    <lastmod>${s.lastmod}</lastmod>
  </sitemap>`).join('\n')}
</sitemapindex>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
