import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://cbeta.yohomobile.dev'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/reader/settings', '/api/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
