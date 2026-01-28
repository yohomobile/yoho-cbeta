/**
 * CBETA 后端服务
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { db } from './db/index.js'
import { sql, eq, like, or, and, count, asc, desc } from 'drizzle-orm'
import { dictionaryEntries } from './db/schema.js'
import { toSimplified } from './zhconv.js'
import { createSingleEmbedding, vectorToString, askWithContext } from './embedding/openai-service.js'

const app = new Hono()

// 启用 CORS
app.use('*', cors())

// ============ 公共查询函数 ============

/** 经文元数据字段（不含正文） */
const TEXT_META_FIELDS = `
  id, canon_id, volume, number,
  title, title_source, title_raw, title_traditional,
  title_sanskrit, title_pali, title_alt,
  source_text, category_id,
  byline_raw, author_raw, persons,
  translation_dynasty, translation_dynasty_id,
  juan_count, page_start, page_end,
  doc_number, doc_number_parsed,
  has_verse, has_dharani, content_type,
  toc, source_hash, parsed_at
`

/** 按标题查找经文（优先大正藏） */
async function findTextByTitle(title: string, canon?: string) {
  const result = canon
    ? await db.execute(sql`
        SELECT ${sql.raw(TEXT_META_FIELDS)} FROM texts
        WHERE title = ${title} AND canon_id = ${canon}
        ORDER BY id LIMIT 1
      `)
    : await db.execute(sql`
        SELECT ${sql.raw(TEXT_META_FIELDS)} FROM texts
        WHERE title = ${title}
        ORDER BY CASE WHEN canon_id = 'T' THEN 0 ELSE 1 END, canon_id, id
        LIMIT 1
      `)
  return (result as unknown as Record<string, unknown>[])[0] || null
}

/** 按 ID 查找经文 */
async function findTextById(id: string) {
  const result = await db.execute(sql`
    SELECT ${sql.raw(TEXT_META_FIELDS)} FROM texts WHERE id = ${id}
  `)
  return (result as unknown as Record<string, unknown>[])[0] || null
}

/** 获取经文关联数据（人物、关系、异译组） */
async function getTextRelations(id: string) {
  const [personsRows, relationsRows, translationGroupRows] = await Promise.all([
    // 人物关联 - 关联朝代表获取中文名称
    db.execute(sql`
      SELECT p.id, p.name, p.aliases, p.dynasty_id, p.nationality, p.identity, p.bio,
             tp.role_type, tp.role_raw, tp.sort_order,
             d.name as dynasty_name
      FROM text_persons tp
      JOIN persons p ON tp.person_id = p.id
      LEFT JOIN dynasties d ON p.dynasty_id = d.id
      WHERE tp.text_id = ${id}
      ORDER BY tp.sort_order
    `),
    // 经文关系
    db.execute(sql`
      SELECT tr.relation_type, tr.relation_subtype, tr.confidence, tr.source,
             CASE WHEN tr.source_text_id = ${id} THEN tr.target_text_id ELSE tr.source_text_id END as related_text_id,
             t.title as related_title, t.juan_count as related_juan_count,
             t.author_raw as related_author_raw
      FROM text_relations tr
      JOIN texts t ON t.id = CASE WHEN tr.source_text_id = ${id} THEN tr.target_text_id ELSE tr.source_text_id END
      WHERE tr.source_text_id = ${id} OR tr.target_text_id = ${id}
    `),
    // 异译组
    db.execute(sql`
      SELECT tg.id, tg.base_title,
             array_agg(json_build_object(
               'id', t.id, 'title', t.title, 'juan_count', t.juan_count,
               'translation_dynasty', t.translation_dynasty, 'author_raw', t.author_raw
             ) ORDER BY tgt.sort_order) as texts
      FROM translation_group_texts tgt
      JOIN translation_groups tg ON tgt.group_id = tg.id
      JOIN texts t ON tgt.text_id = t.id
      WHERE tg.id IN (SELECT group_id FROM translation_group_texts WHERE text_id = ${id})
      GROUP BY tg.id, tg.base_title
    `),
  ])

  return {
    relatedPersons: personsRows as unknown as Record<string, unknown>[],
    relations: relationsRows as unknown as Record<string, unknown>[],
    translationGroup: (translationGroupRows as unknown as Record<string, unknown>[])[0] || null,
  }
}

/** 获取分卷内容 */
async function getJuanContent(textId: string, juan: number, variant: string = 'simplified') {
  const contentColumn = variant === 'traditional' ? 'content_traditional' : 'content_simplified'
  const result = await db.execute(sql.raw(`
    SELECT ${contentColumn} as content
    FROM text_juans
    WHERE text_id = '${textId}' AND juan = ${juan}
  `))
  return (result as unknown as { content: unknown }[])[0]?.content || []
}

/** 获取经文分卷数 */
async function getJuanCount(textId: string) {
  const result = await db.execute(sql`
    SELECT COUNT(*) as count FROM text_juans WHERE text_id = ${textId}
  `)
  return parseInt((result as unknown as { count: string }[])[0].count, 10) || 1
}

// ============ API 路由 ============

app.get('/', (c) => {
  return c.json({
    name: 'CBETA API',
    version: '1.0.0',
    endpoints: [
      'GET /health - 健康检查',
      'GET /texts - 获取经文列表',
      'GET /texts/filters - 获取过滤选项',
      'GET /texts/:id - 获取经文详情',
      'GET /texts/:id/juan/:juan - 获取某一卷内容',
      'GET /sutra/:title - 按标题获取经文',
      'GET /sutra/:title/juan/:juan - 按标题获取某一卷',
      'GET /dictionary - 搜索词典',
      'GET /dictionary/:term - 获取词条详情',
    ]
  })
})

app.get('/health', (c) => c.json({ status: 'ok' }))

/**
 * 按标题获取经文元数据和关联信息
 */
app.get('/sutra/:title', async (c) => {
  const title = decodeURIComponent(c.req.param('title'))
  const canon = c.req.query('canon')

  try {
    const text = await findTextByTitle(title, canon)
    if (!text) {
      return c.json({ error: '经文不存在' }, 404)
    }

    const relations = await getTextRelations(text.id as string)
    return c.json({ ...text, ...relations })
  } catch (error) {
    console.error('获取经文失败:', error)
    return c.json({ error: '服务器错误' }, 500)
  }
})

/**
 * 按标题获取某一卷的内容
 */
app.get('/sutra/:title/juan/:juan', async (c) => {
  const title = decodeURIComponent(c.req.param('title'))
  const juan = parseInt(c.req.param('juan'), 10)
  const canon = c.req.query('canon')
  const variant = c.req.query('variant') || 'simplified'

  if (isNaN(juan) || juan < 1) {
    return c.json({ error: '无效的卷号' }, 400)
  }

  try {
    const text = await findTextByTitle(title, canon)
    if (!text) {
      return c.json({ error: '经文不存在' }, 404)
    }

    const id = text.id as string
    const juanCount = text.juan_count as number
    const fullToc = text.toc as Array<{ title: string; juanNumber?: number }> | null

    if (juan > juanCount) {
      return c.json({ error: `卷号超出范围，共${juanCount}卷` }, 400)
    }

    const [content, milestoneCount] = await Promise.all([
      getJuanContent(id, juan, variant),
      getJuanCount(id),
    ])

    return c.json({
      id,
      juan,
      juanCount,
      milestoneCount,
      content,
      toc: fullToc?.filter(item => item.juanNumber === juan) || [],
      fullToc,
    })
  } catch (error) {
    console.error('获取经文卷内容失败:', error)
    return c.json({ error: '服务器错误' }, 500)
  }
})

/**
 * 按 ID 获取某一卷的内容
 */
app.get('/texts/:id/juan/:juan', async (c) => {
  const textId = c.req.param('id')
  const juan = parseInt(c.req.param('juan'), 10)
  const variant = c.req.query('variant') || 'simplified'

  if (isNaN(juan) || juan < 1) {
    return c.json({ error: '无效的卷号' }, 400)
  }

  try {
    const text = await findTextById(textId)
    if (!text) {
      return c.json({ error: '经文不存在' }, 404)
    }

    const juanCount = text.juan_count as number
    const fullToc = text.toc as Array<{ title: string; juanNumber?: number }> | null

    if (juan > juanCount) {
      return c.json({ error: `卷号超出范围，共${juanCount}卷` }, 400)
    }

    const [content, milestoneCount] = await Promise.all([
      getJuanContent(textId, juan, variant),
      getJuanCount(textId),
    ])

    return c.json({
      id: textId,
      juan,
      juanCount,
      milestoneCount,
      content,
      toc: fullToc?.filter(item => item.juanNumber === juan) || [],
      fullToc,
    })
  } catch (error) {
    console.error('获取经文卷内容失败:', error)
    return c.json({ error: '服务器错误' }, 500)
  }
})

/**
 * 获取过滤选项
 */
app.get('/texts/filters', async (c) => {
  try {
    const hasContentCondition = `EXISTS (SELECT 1 FROM text_juans tj WHERE tj.text_id = t.id)`

    const [canonsResult, contentTypesResult, categoriesResult] = await Promise.all([
      db.execute(sql.raw(`
        SELECT t.canon_id, COUNT(DISTINCT t.id) as count
        FROM texts t WHERE ${hasContentCondition} AND t.canon_id IS NOT NULL
        GROUP BY t.canon_id ORDER BY count DESC
      `)),
      db.execute(sql.raw(`
        SELECT t.content_type, COUNT(DISTINCT t.id) as count
        FROM texts t WHERE ${hasContentCondition} AND t.content_type IS NOT NULL
        GROUP BY t.content_type ORDER BY count DESC
      `)),
      db.execute(sql.raw(`
        SELECT t.category_id, COUNT(DISTINCT t.id) as count
        FROM texts t WHERE ${hasContentCondition} AND t.category_id IS NOT NULL
        GROUP BY t.category_id ORDER BY count DESC
      `)),
    ])

    return c.json({
      canons: canonsResult as unknown as { canon_id: string; count: string }[],
      contentTypes: contentTypesResult as unknown as { content_type: string; count: string }[],
      categories: categoriesResult as unknown as { category_id: string; count: string }[],
    })
  } catch (error) {
    console.error('获取过滤选项失败:', error)
    return c.json({ error: '服务器错误' }, 500)
  }
})

/**
 * 获取经文详情（元数据 + 关联信息）
 */
app.get('/texts/:id', async (c) => {
  const id = c.req.param('id')

  try {
    const text = await findTextById(id)
    if (!text) {
      return c.json({ error: '经文不存在' }, 404)
    }

    const relations = await getTextRelations(id)
    return c.json({ ...text, ...relations })
  } catch (error) {
    console.error('获取经文失败:', error)
    return c.json({ error: '服务器错误' }, 500)
  }
})

/**
 * 获取经文列表
 * 支持模糊搜索和相关性排序 (pg_trgm)
 */
app.get('/texts', async (c) => {
  const canonId = c.req.query('canon_id')
  const categoryId = c.req.query('category_id')
  const contentType = c.req.query('content_type')
  const search = c.req.query('q')
  const limit = Math.min(Number(c.req.query('limit')) || 50, 500)
  const offset = Number(c.req.query('offset')) || 0

  try {
    // 构建过滤条件
    const conditions: string[] = ['EXISTS (SELECT 1 FROM text_juans tj WHERE tj.text_id = t.id)']
    if (canonId) conditions.push(`t.canon_id = '${canonId}'`)
    if (categoryId) conditions.push(`t.category_id = '${categoryId}'`)
    if (contentType) conditions.push(`t.content_type = '${contentType}'`)

    // 搜索条件：使用 pg_trgm 模糊匹配
    const escaped = search ? search.replace(/'/g, "''") : ''
    if (search) {
      if (search.length <= 2) {
        // 短查询：使用 ILIKE
        conditions.push(`(t.title ILIKE '%${escaped}%' OR t.author_raw ILIKE '%${escaped}%' OR t.title_alt ILIKE '%${escaped}%')`)
      } else {
        // 长查询：pg_trgm 相似度匹配
        conditions.push(`(
          t.title % '${escaped}' OR t.title ILIKE '%${escaped}%' OR
          t.author_raw % '${escaped}' OR t.author_raw ILIKE '%${escaped}%' OR
          t.title_alt % '${escaped}' OR t.title_alt ILIKE '%${escaped}%'
        )`)
      }
    }
    const whereClause = conditions.join(' AND ')

    // 相关性排序：使用 pg_trgm 相似度
    const relevanceExpr = search
      ? `GREATEST(
          COALESCE(SIMILARITY(t.title, '${escaped}'), 0),
          COALESCE(SIMILARITY(t.author_raw, '${escaped}'), 0),
          COALESCE(SIMILARITY(t.title_alt, '${escaped}'), 0)
        )`
      : '0'

    const result = await db.execute(sql.raw(`
      SELECT * FROM (
        SELECT DISTINCT ON (t.title, t.author_raw)
          t.id, t.canon_id, t.volume, t.number,
          t.title, t.title_traditional, t.title_alt,
          t.author_raw, t.translation_dynasty,
          t.juan_count, t.category_id, t.content_type
          ${search ? `, ${relevanceExpr} as relevance` : ''}
        FROM texts t
        WHERE ${whereClause}
        ORDER BY t.title, t.author_raw,
          CASE WHEN t.canon_id = 'T' THEN 0 ELSE 1 END,
          t.canon_id, CAST(SUBSTRING(t.id FROM '[0-9]+') AS INTEGER), t.id
      ) sub
      ORDER BY ${search ? 'relevance DESC, ' : ''}CASE WHEN canon_id = 'T' THEN 0 ELSE 1 END,
        canon_id, CAST(SUBSTRING(id FROM '[0-9]+') AS INTEGER), id
      LIMIT ${limit} OFFSET ${offset}
    `))

    const countResult = await db.execute(sql.raw(`
      SELECT COUNT(*) as total FROM (
        SELECT DISTINCT ON (t.title, t.author_raw) t.id
        FROM texts t WHERE ${whereClause}
        ORDER BY t.title, t.author_raw, t.id
      ) sub
    `))

    return c.json({
      data: result as unknown as Record<string, unknown>[],
      pagination: {
        total: Number((countResult as unknown as { total: string }[])[0].total),
        limit,
        offset,
      }
    })
  } catch (error) {
    console.error('获取经文列表失败:', error)
    return c.json({ error: '服务器错误' }, 500)
  }
})


// ============ 人物 API ============

/**
 * 获取人物列表（用于 sitemap 等）
 */
app.get('/persons', async (c) => {
  const limit = Math.min(Number(c.req.query('limit')) || 100, 500)
  const offset = Number(c.req.query('offset')) || 0

  try {
    const result = await db.execute(sql.raw(`
      SELECT DISTINCT p.id, p.name
      FROM persons p
      JOIN text_persons tp ON tp.person_id = p.id
      ORDER BY p.id
      LIMIT ${limit} OFFSET ${offset}
    `))

    const countResult = await db.execute(sql`
      SELECT COUNT(DISTINCT p.id) as total
      FROM persons p
      JOIN text_persons tp ON tp.person_id = p.id
    `)

    return c.json({
      data: result as unknown as { id: number; name: string }[],
      pagination: {
        total: Number((countResult as unknown as { total: string }[])[0].total),
        limit,
        offset,
      }
    })
  } catch (error) {
    console.error('获取人物列表失败:', error)
    return c.json({ error: '服务器错误' }, 500)
  }
})

/**
 * 按名字获取人物详情及其作品
 */
app.get('/person/:name', async (c) => {
  const name = decodeURIComponent(c.req.param('name'))

  try {
    // 查找人物（支持按名字或别名查找）
    const personResult = await db.execute(sql`
      SELECT id, name, aliases, dynasty_id, nationality, identity, bio
      FROM persons
      WHERE name = ${name} OR aliases LIKE ${'%' + name + '%'}
      LIMIT 1
    `)
    const person = (personResult as unknown as Record<string, unknown>[])[0]

    if (!person) {
      return c.json({ error: '人物不存在' }, 404)
    }

    // 获取该人物的所有作品，按角色分组
    const worksResult = await db.execute(sql`
      SELECT t.id, t.title, t.title_traditional, t.author_raw,
             t.translation_dynasty, t.juan_count, t.content_type, t.category_id,
             tp.role_type, tp.role_raw
      FROM text_persons tp
      JOIN texts t ON tp.text_id = t.id
      WHERE tp.person_id = ${person.id}
      ORDER BY tp.role_type, t.id
    `)

    // 获取朝代信息
    let dynastyName = null
    if (person.dynasty_id) {
      const dynastyResult = await db.execute(sql`
        SELECT name FROM dynasties WHERE id = ${person.dynasty_id}
      `)
      dynastyName = (dynastyResult as unknown as { name: string }[])[0]?.name
    }

    return c.json({
      ...person,
      dynasty_name: dynastyName,
      works: worksResult as unknown as Record<string, unknown>[],
    })
  } catch (error) {
    console.error('获取人物失败:', error)
    return c.json({ error: '服务器错误' }, 500)
  }
})

// Wikipedia 摘要缓存（简单内存缓存）
const wikiCache = new Map<string, { data: unknown; timestamp: number }>()
const WIKI_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 小时

// 获取人物的 Wikipedia 完整内容
app.get('/person/:name/wiki', async (c) => {
  const name = decodeURIComponent(c.req.param('name'))

  // 检查缓存
  const cached = wikiCache.get(name)
  if (cached && Date.now() - cached.timestamp < WIKI_CACHE_TTL) {
    return c.json(cached.data)
  }

  try {
    // 使用 MediaWiki API 获取完整内容
    const wikiUrl = `https://zh.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(name)}&prop=extracts&explaintext=1&format=json`
    const response = await fetch(wikiUrl, {
      headers: { 'User-Agent': 'CbetaApp/1.0 (Buddhist scripture reader)' },
    })

    if (!response.ok) {
      const notFound = { found: false, extract: null }
      wikiCache.set(name, { data: notFound, timestamp: Date.now() })
      return c.json(notFound)
    }

    const data = await response.json() as { query?: { pages?: Record<string, { extract?: string; missing?: boolean }> } }
    const pages = data.query?.pages
    if (!pages) {
      const notFound = { found: false, extract: null }
      wikiCache.set(name, { data: notFound, timestamp: Date.now() })
      return c.json(notFound)
    }

    const pageId = Object.keys(pages)[0]
    const page = pages[pageId]

    if (!page || page.missing || !page.extract) {
      // 尝试搜索
      const searchUrl = `https://zh.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name)}&format=json&utf8=1`
      const searchResponse = await fetch(searchUrl, {
        headers: { 'User-Agent': 'CbetaApp/1.0 (Buddhist scripture reader)' },
      })

      if (searchResponse.ok) {
        const searchData = await searchResponse.json() as { query?: { search?: Array<{ title: string }> } }
        const firstResult = searchData.query?.search?.[0]
        if (firstResult) {
          const retryUrl = `https://zh.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(firstResult.title)}&prop=extracts&explaintext=1&format=json`
          const retryResponse = await fetch(retryUrl, {
            headers: { 'User-Agent': 'CbetaApp/1.0 (Buddhist scripture reader)' },
          })
          if (retryResponse.ok) {
            const retryData = await retryResponse.json() as { query?: { pages?: Record<string, { extract?: string }> } }
            const retryPages = retryData.query?.pages
            if (retryPages) {
              const retryPageId = Object.keys(retryPages)[0]
              const retryPage = retryPages[retryPageId]
              if (retryPage?.extract) {
                const result = { found: true, extract: toSimplified(retryPage.extract) }
                wikiCache.set(name, { data: result, timestamp: Date.now() })
                return c.json(result)
              }
            }
          }
        }
      }

      const notFound = { found: false, extract: null }
      wikiCache.set(name, { data: notFound, timestamp: Date.now() })
      return c.json(notFound)
    }

    const result = { found: true, extract: toSimplified(page.extract) }
    wikiCache.set(name, { data: result, timestamp: Date.now() })
    return c.json(result)
  } catch (error) {
    console.error('获取 Wikipedia 信息失败:', error)
    return c.json({ found: false, error: '获取失败' })
  }
})

// ============ 词典 API ============

/**
 * 搜索词典
 * GET /dictionary?q=关键词&source=来源&limit=20&offset=0&mode=term|definition|all
 * 支持模糊搜索和相关性排序 (pg_trgm + zhparser 全文搜索)
 */
app.get('/dictionary', async (c) => {
  const query = c.req.query('q') || ''
  const sourceFilter = c.req.query('source')
  const searchMode = c.req.query('mode') || 'term' // term=词条搜索, definition=释义搜索, all=全部
  const limit = Math.min(Number(c.req.query('limit')) || 20, 100)
  const offset = Number(c.req.query('offset')) || 0

  try {
    const escaped = query.replace(/'/g, "''")

    // 构建 WHERE 条件
    const conditions: string[] = []
    if (query) {
      if (searchMode === 'definition') {
        // 释义全文搜索
        conditions.push(`(
          definition_tsv @@ plainto_tsquery('simple', '${escaped}') OR
          definition_text ILIKE '%${escaped}%'
        )`)
      } else if (searchMode === 'all') {
        // 词条 + 释义搜索
        if (query.length <= 2) {
          conditions.push(`(
            term = '${escaped}' OR term LIKE '${escaped}%' OR
            term_simplified = '${escaped}' OR term_simplified LIKE '${escaped}%' OR
            definition_text ILIKE '%${escaped}%'
          )`)
        } else {
          conditions.push(`(
            term % '${escaped}' OR term LIKE '%${escaped}%' OR
            term_simplified % '${escaped}' OR term_simplified LIKE '%${escaped}%' OR
            definition_tsv @@ plainto_tsquery('simple', '${escaped}') OR
            definition_text ILIKE '%${escaped}%'
          )`)
        }
      } else {
        // 默认：词条搜索
        if (query.length <= 2) {
          conditions.push(`(
            term = '${escaped}' OR term LIKE '${escaped}%' OR
            term_simplified = '${escaped}' OR term_simplified LIKE '${escaped}%'
          )`)
        } else {
          conditions.push(`(
            term % '${escaped}' OR term LIKE '%${escaped}%' OR
            term_simplified % '${escaped}' OR term_simplified LIKE '%${escaped}%'
          )`)
        }
      }
    }
    if (sourceFilter) {
      conditions.push(`source = '${sourceFilter.replace(/'/g, "''")}'`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // 排序：精确匹配优先，然后按相似度/全文搜索排名排序
    let orderByClause = 'ORDER BY term'
    if (query) {
      if (searchMode === 'definition') {
        orderByClause = `ORDER BY
          CASE WHEN definition_tsv @@ plainto_tsquery('simple', '${escaped}')
               THEN ts_rank(definition_tsv, plainto_tsquery('simple', '${escaped}')) ELSE 0 END DESC,
          term`
      } else {
        orderByClause = `ORDER BY
          CASE WHEN term = '${escaped}' OR term_simplified = '${escaped}' THEN 0 ELSE 1 END,
          GREATEST(
            COALESCE(SIMILARITY(term, '${escaped}'), 0),
            COALESCE(SIMILARITY(term_simplified, '${escaped}'), 0)
          ) DESC,
          LENGTH(term),
          term`
      }
    }

    // 查询结果
    const result = await db.execute(sql.raw(`
      SELECT id, term, LEFT(definition_text, 200) as definition_preview, source
      FROM dictionary_entries
      ${whereClause}
      ${orderByClause}
      LIMIT ${limit} OFFSET ${offset}
    `))

    // 统计总数
    const countResult = await db.execute(sql.raw(`
      SELECT COUNT(*) as total FROM dictionary_entries ${whereClause}
    `))

    // 获取来源统计
    const sourcesResult = await db
      .select({
        source: dictionaryEntries.source,
        count: count(),
      })
      .from(dictionaryEntries)
      .groupBy(dictionaryEntries.source)
      .orderBy(desc(count()))

    return c.json({
      data: (result as unknown as Array<{ id: number; term: string; definition_preview: string; source: string }>).map(r => ({
        id: r.id,
        term: r.term,
        definition_preview: r.definition_preview,
        source: r.source,
      })),
      sources: sourcesResult.map(s => ({
        source: s.source,
        count: String(s.count),
      })),
      pagination: {
        total: Number((countResult as unknown as { total: string }[])[0]?.total) || 0,
        limit,
        offset,
      }
    })
  } catch (error) {
    console.error('搜索词典失败:', error)
    return c.json({ error: '服务器错误' }, 500)
  }
})

/**
 * 获取热门/随机词条
 * GET /dictionary/featured
 * 注意：必须放在 /dictionary/:term 之前，否则 featured 会被当成 term
 */
app.get('/dictionary/featured', async (c) => {
  const limit = Math.min(Number(c.req.query('limit')) || 10, 50)

  try {
    const result = await db
      .select({
        term: dictionaryEntries.term,
        definitionPreview: sql<string>`LEFT(${dictionaryEntries.definitionText}, 100)`,
        source: dictionaryEntries.source,
      })
      .from(dictionaryEntries)
      .orderBy(sql`RANDOM()`)
      .limit(limit)

    return c.json({
      data: result.map(r => ({
        term: r.term,
        definition_preview: r.definitionPreview,
        source: r.source,
      })),
    })
  } catch (error) {
    console.error('获取推荐词条失败:', error)
    return c.json({ error: '服务器错误' }, 500)
  }
})

/**
 * 获取词条详情
 * GET /dictionary/:term
 */
app.get('/dictionary/:term', async (c) => {
  const term = decodeURIComponent(c.req.param('term'))
  const sourceFilter = c.req.query('source')

  try {
    // 查找词条（同时匹配繁体和简体）
    const termCondition = or(
      eq(dictionaryEntries.term, term),
      eq(dictionaryEntries.termSimplified, term)
    )
    const whereCondition = sourceFilter
      ? and(termCondition, eq(dictionaryEntries.source, sourceFilter))
      : termCondition

    const entries = await db
      .select({
        id: dictionaryEntries.id,
        term: dictionaryEntries.term,
        definition: dictionaryEntries.definition,
        definitionText: dictionaryEntries.definitionText,
        source: dictionaryEntries.source,
      })
      .from(dictionaryEntries)
      .where(whereCondition)
      .orderBy(asc(dictionaryEntries.source))

    if (entries.length === 0) {
      return c.json({ error: '词条不存在' }, 404)
    }

    // 查找相关词条（前缀匹配或包含）
    const relatedResult = await db
      .selectDistinct({
        term: dictionaryEntries.term,
      })
      .from(dictionaryEntries)
      .where(and(
        sql`${dictionaryEntries.term} != ${term}`,
        or(
          like(dictionaryEntries.term, `${term}%`),
          like(dictionaryEntries.term, `%${term}`)
        )
      ))
      .orderBy(asc(dictionaryEntries.term))
      .limit(10)

    return c.json({
      term,
      entries: entries.map(e => ({
        id: e.id,
        term: e.term,
        definition: e.definition,
        definition_text: e.definitionText,
        source: e.source,
      })),
      related: relatedResult.map(r => r.term),
    })
  } catch (error) {
    console.error('获取词条失败:', error)
    return c.json({ error: '服务器错误' }, 500)
  }
})

// ============ 聚合搜索 API ============

/**
 * 聚合搜索
 * GET /search?q=关键词&limit=5
 * 按优先级搜索：别名匹配 → 经文标题 → 词典 → 人物 → 经文正文（仅在前三者无结果时）
 */
app.get('/search', async (c) => {
  const query = c.req.query('q') || ''
  const limit = Math.min(Number(c.req.query('limit')) || 5, 20)

  if (!query.trim()) {
    return c.json({ error: '请输入搜索关键词' }, 400)
  }

  const escaped = query.replace(/'/g, "''")

  try {
    // 0. 先查别名表，看是否有精确匹配的别名
    const aliasResult = await db.execute(sql.raw(`
      SELECT alias, canonical_title, text_id, priority
      FROM text_aliases
      WHERE alias = '${escaped}'
      ORDER BY priority DESC
      LIMIT 1
    `))
    const aliasMatch = (aliasResult as unknown as Array<{
      alias: string; canonical_title: string; text_id: string; priority: number
    }>)[0]

    // 如果有别名匹配，用正式名称搜索经文
    const searchTitle = aliasMatch?.canonical_title || escaped
    const searchTitleEscaped = searchTitle.replace(/'/g, "''")

    // 并行搜索经文、词典、人物
    const [textsResult, dictResult, personsResult] = await Promise.all([
      // 1. 搜索经文标题（如果有别名匹配，优先显示匹配的经文）
      aliasMatch?.text_id
        ? db.execute(sql.raw(`
            (SELECT id, title, author_raw, translation_dynasty, juan_count, 1.0 as relevance
             FROM texts t
             WHERE id = '${aliasMatch.text_id}'
               AND EXISTS (SELECT 1 FROM text_juans tj WHERE tj.text_id = t.id))
            UNION ALL
            (SELECT id, title, author_raw, translation_dynasty, juan_count,
                    GREATEST(
                      COALESCE(SIMILARITY(title, '${searchTitleEscaped}'), 0),
                      COALESCE(SIMILARITY(author_raw, '${escaped}'), 0)
                    ) as relevance
             FROM texts t
             WHERE EXISTS (SELECT 1 FROM text_juans tj WHERE tj.text_id = t.id)
               AND id != '${aliasMatch.text_id}'
               AND (title ILIKE '%${searchTitleEscaped}%' OR title ILIKE '%${escaped}%'
                    OR author_raw ILIKE '%${escaped}%' OR title_alt ILIKE '%${escaped}%'
                    ${query.length > 2 ? `OR title % '${escaped}' OR author_raw % '${escaped}'` : ''})
             ORDER BY relevance DESC, CASE WHEN canon_id = 'T' THEN 0 ELSE 1 END, id
             LIMIT ${limit - 1})
          `))
        : db.execute(sql.raw(`
            SELECT id, title, author_raw, translation_dynasty, juan_count,
                   GREATEST(
                     COALESCE(SIMILARITY(title, '${escaped}'), 0),
                     COALESCE(SIMILARITY(author_raw, '${escaped}'), 0)
                   ) as relevance
            FROM texts t
            WHERE EXISTS (SELECT 1 FROM text_juans tj WHERE tj.text_id = t.id)
              AND (title ILIKE '%${escaped}%' OR author_raw ILIKE '%${escaped}%' OR title_alt ILIKE '%${escaped}%'
                   ${query.length > 2 ? `OR title % '${escaped}' OR author_raw % '${escaped}'` : ''})
            ORDER BY relevance DESC, CASE WHEN canon_id = 'T' THEN 0 ELSE 1 END, id
            LIMIT ${limit}
          `)),

      // 2. 搜索词典词条
      db.execute(sql.raw(`
        SELECT id, term, LEFT(definition_text, 150) as definition_preview, source,
               GREATEST(
                 COALESCE(SIMILARITY(term, '${escaped}'), 0),
                 COALESCE(SIMILARITY(term_simplified, '${escaped}'), 0)
               ) as relevance
        FROM dictionary_entries
        WHERE term = '${escaped}' OR term_simplified = '${escaped}'
           OR term LIKE '${escaped}%' OR term_simplified LIKE '${escaped}%'
           ${query.length > 2 ? `OR term % '${escaped}' OR term_simplified % '${escaped}'` : ''}
        ORDER BY
          CASE WHEN term = '${escaped}' OR term_simplified = '${escaped}' THEN 0 ELSE 1 END,
          relevance DESC, LENGTH(term), term
        LIMIT ${limit}
      `)),

      // 3. 搜索人物
      db.execute(sql.raw(`
        SELECT p.id, p.name, p.dynasty_id, d.name as dynasty_name, p.identity, p.bio,
               SIMILARITY(p.name, '${escaped}') as relevance
        FROM persons p
        LEFT JOIN dynasties d ON p.dynasty_id = d.id
        WHERE p.name ILIKE '%${escaped}%' OR p.aliases ILIKE '%${escaped}%'
              ${query.length > 2 ? `OR p.name % '${escaped}'` : ''}
        ORDER BY relevance DESC, p.id
        LIMIT ${limit}
      `)),
    ])

    const texts = textsResult as unknown as Array<{
      id: string; title: string; author_raw: string; translation_dynasty: string; juan_count: number
    }>
    const dictionary = dictResult as unknown as Array<{
      id: number; term: string; definition_preview: string; source: string
    }>
    const persons = personsResult as unknown as Array<{
      id: number; name: string; dynasty_id: string; dynasty_name: string; identity: string; bio: string
    }>

    // 获取各类总数（经文搜索也要考虑别名匹配的正式名称）
    const [textsCount, dictCount, personsCount, titleCount, authorCount, dynastyCount] = await Promise.all([
      db.execute(sql.raw(`
        SELECT COUNT(*) as total FROM texts t
        WHERE EXISTS (SELECT 1 FROM text_juans tj WHERE tj.text_id = t.id)
          AND (title ILIKE '%${escaped}%' OR title ILIKE '%${searchTitleEscaped}%'
               OR author_raw ILIKE '%${escaped}%' OR title_alt ILIKE '%${escaped}%'
               ${query.length > 2 ? `OR title % '${escaped}' OR author_raw % '${escaped}'` : ''})
      `)),
      db.execute(sql.raw(`
        SELECT COUNT(*) as total FROM dictionary_entries
        WHERE term = '${escaped}' OR term_simplified = '${escaped}'
           OR term LIKE '${escaped}%' OR term_simplified LIKE '${escaped}%'
           ${query.length > 2 ? `OR term % '${escaped}' OR term_simplified % '${escaped}'` : ''}
      `)),
      db.execute(sql.raw(`
        SELECT COUNT(*) as total FROM persons
        WHERE name ILIKE '%${escaped}%' OR aliases ILIKE '%${escaped}%'
              ${query.length > 2 ? `OR name % '${escaped}'` : ''}
      `)),
      db.execute(sql.raw(`
        SELECT COUNT(*) as total FROM texts t
        WHERE EXISTS (SELECT 1 FROM text_juans tj WHERE tj.text_id = t.id)
          AND (
            title ILIKE '%${escaped}%' OR title ILIKE '%${searchTitleEscaped}%'
            OR title_alt ILIKE '%${escaped}%' OR title_alt ILIKE '%${searchTitleEscaped}%'
            ${query.length > 2 ? `OR title % '${escaped}' OR title % '${searchTitleEscaped}'` : ''}
          )
      `)),
      db.execute(sql.raw(`
        SELECT COUNT(*) as total FROM texts t
        WHERE EXISTS (SELECT 1 FROM text_juans tj WHERE tj.text_id = t.id)
          AND (
            author_raw ILIKE '%${escaped}%'
            ${query.length > 2 ? `OR author_raw % '${escaped}'` : ''}
          )
      `)),
      db.execute(sql.raw(`
        SELECT COUNT(*) as total FROM texts t
        WHERE EXISTS (SELECT 1 FROM text_juans tj WHERE tj.text_id = t.id)
          AND translation_dynasty ILIKE '%${escaped}%'
      `)),
    ])

    const hasResults = texts.length > 0 || dictionary.length > 0 || persons.length > 0

    // 如果前三者都没有结果，搜索经文正文
    let content: Array<{
      text_id: string; juan: number; title: string; snippet: string
    }> | null = null
    let contentTotal = 0
    let searchedContent = false

    if (!hasResults) {
      searchedContent = true

      // 检查分词结果，决定使用 tsvector 还是 LIKE
      let useLike = false
      if (query.length > 1) {
        const tsqueryResult = await db.execute(sql.raw(
          `SELECT plainto_tsquery('chinese', '${escaped}')::text as tsq`
        ))
        const tsq = (tsqueryResult as unknown as { tsq: string }[])[0]?.tsq || ''
        const words = tsq.match(/'([^']+)'/g)?.map(w => w.replace(/'/g, '')) || []
        const maxWordLen = Math.max(...words.map(w => w.length), 0)
        useLike = maxWordLen === 1 && query.length >= 2
      }

      let contentResult
      if (useLike) {
        // 分词失败，使用 LIKE 精确匹配
        contentResult = await db.execute(sql.raw(`
          SELECT tj.text_id, tj.juan, t.title,
                 regexp_replace(
                   SUBSTRING(tj.content_text
                     FROM GREATEST(1, POSITION('${escaped}' IN tj.content_text) - 30)
                     FOR 100),
                   '(${escaped})',
                   '<mark>\\1</mark>',
                   'g'
                 ) as snippet
          FROM text_juans tj
          JOIN texts t ON t.id = tj.text_id
          WHERE tj.content_text LIKE '%${escaped}%'
          ORDER BY CASE WHEN t.canon_id = 'T' THEN 0 ELSE 1 END, tj.text_id
          LIMIT ${limit}
        `))
        const contentCountResult = await db.execute(sql.raw(`
          SELECT COUNT(*) as total FROM text_juans
          WHERE content_text LIKE '%${escaped}%'
        `))
        contentTotal = Number((contentCountResult as unknown as { total: string }[])[0]?.total) || 0
      } else {
        // 分词正常，使用 tsvector 全文搜索
        contentResult = await db.execute(sql.raw(`
          SELECT sub.text_id, sub.juan, sub.title,
                 ts_headline('chinese', sub.content_text, plainto_tsquery('chinese', '${escaped}'),
                   'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20') as snippet
          FROM (
            SELECT tj.text_id, tj.juan, tj.content_text, t.title,
                   ts_rank(tj.content_tsv, plainto_tsquery('chinese', '${escaped}')) as rank
            FROM text_juans tj
            JOIN texts t ON t.id = tj.text_id
            WHERE tj.content_tsv @@ plainto_tsquery('chinese', '${escaped}')
            ORDER BY rank DESC
            LIMIT ${limit}
          ) sub
          ORDER BY sub.rank DESC
        `))
        const contentCountResult = await db.execute(sql.raw(`
          SELECT COUNT(*) as total FROM text_juans
          WHERE content_tsv @@ plainto_tsquery('chinese', '${escaped}')
        `))
        contentTotal = Number((contentCountResult as unknown as { total: string }[])[0]?.total) || 0
      }

      content = contentResult as unknown as typeof content
    }

    const textsTotal = Number((textsCount as unknown as { total: string }[])[0]?.total) || 0
    const dictionaryTotal = Number((dictCount as unknown as { total: string }[])[0]?.total) || 0
    const personsTotal = Number((personsCount as unknown as { total: string }[])[0]?.total) || 0
    const titleTotal = Number((titleCount as unknown as { total: string }[])[0]?.total) || 0
    const authorTotal = Number((authorCount as unknown as { total: string }[])[0]?.total) || 0
    const dynastyTotal = Number((dynastyCount as unknown as { total: string }[])[0]?.total) || 0

    return c.json({
      query,
      results: {
        texts: {
          total: textsTotal,
          items: texts,
        },
        dictionary: {
          total: dictionaryTotal,
          items: dictionary,
        },
        persons: {
          total: personsTotal,
          items: persons,
        },
        stats: {
          titles: titleTotal,
          authors: authorTotal,
          dynasties: dynastyTotal,
          persons: personsTotal,
          dictionary: dictionaryTotal,
        },
        content: searchedContent ? {
          total: contentTotal,
          items: content,
        } : null,
      },
      searchedContent,
    })
  } catch (error) {
    console.error('聚合搜索失败:', error)
    return c.json({ error: '服务器错误' }, 500)
  }
})

/**
 * 经文正文搜索
 * GET /search/content?q=关键词&limit=20&offset=0
 *
 * 优化策略：
 * 1. 检查分词结果：如果查询词被分成单字（分词失败），使用 ILIKE
 * 2. 分词正常时使用 tsvector 全文搜索（利用 GIN 索引，速度快）
 * 3. 使用子查询先筛选 TOP N，再计算 ts_headline（减少高亮计算量）
 */
app.get('/search/content', async (c) => {
  const query = c.req.query('q') || ''
  const limit = Math.min(Number(c.req.query('limit')) || 20, 100)
  const offset = Number(c.req.query('offset')) || 0

  if (!query.trim()) {
    return c.json({ error: '请输入搜索关键词' }, 400)
  }

  const escaped = query.replace(/'/g, "''")

  try {
    // 检查分词结果：如果查询词被分成单字（如"如是我闻"→"闻"），使用 LIKE
    // 判断标准：分词结果中词的长度 < 原查询长度的一半，说明分词可能不理想
    let useLike = false
    if (query.length > 1) {
      const tsqueryResult = await db.execute(sql.raw(
        `SELECT plainto_tsquery('chinese', '${escaped}')::text as tsq`
      ))
      const tsq = (tsqueryResult as unknown as { tsq: string }[])[0]?.tsq || ''
      // 提取所有词（格式如 '词1' & '词2' 或 '词'）
      const words = tsq.match(/'([^']+)'/g)?.map(w => w.replace(/'/g, '')) || []
      const maxWordLen = Math.max(...words.map(w => w.length), 0)
      // 如果最长的分词结果是单字，且原查询 >= 2字，认为分词失败
      useLike = maxWordLen === 1 && query.length >= 2
    }

    let result, total: number

    if (useLike) {
      // 分词失败，使用 ILIKE 精确匹配 + POSITION/SUBSTRING 生成片段
      const [dataResult, countResult] = await Promise.all([
        db.execute(sql.raw(`
          SELECT tj.text_id, tj.juan, t.title, t.author_raw,
                 regexp_replace(
                   SUBSTRING(tj.content_text
                     FROM GREATEST(1, POSITION('${escaped}' IN tj.content_text) - 40)
                     FOR 120),
                   '(${escaped})',
                   '<mark>\\1</mark>',
                   'g'
                 ) as snippet
          FROM text_juans tj
          JOIN texts t ON t.id = tj.text_id
          WHERE tj.content_text LIKE '%${escaped}%'
          ORDER BY
            CASE WHEN t.canon_id = 'T' THEN 0 ELSE 1 END,
            tj.text_id, tj.juan
          LIMIT ${limit} OFFSET ${offset}
        `)),
        db.execute(sql.raw(`
          SELECT COUNT(*) as total FROM text_juans
          WHERE content_text LIKE '%${escaped}%'
        `)),
      ])
      result = dataResult
      total = Number((countResult as unknown as { total: string }[])[0]?.total) || 0
    } else {
      // 分词正常，使用 tsvector 全文搜索
      const [dataResult, countResult] = await Promise.all([
        db.execute(sql.raw(`
          SELECT sub.text_id, sub.juan, sub.title, sub.author_raw,
                 ts_headline('chinese', sub.content_text, plainto_tsquery('chinese', '${escaped}'),
                   'StartSel=<mark>, StopSel=</mark>, MaxWords=60, MinWords=25') as snippet
          FROM (
            SELECT tj.text_id, tj.juan, tj.content_text, t.title, t.author_raw,
                   ts_rank(tj.content_tsv, plainto_tsquery('chinese', '${escaped}')) as rank
            FROM text_juans tj
            JOIN texts t ON t.id = tj.text_id
            WHERE tj.content_tsv @@ plainto_tsquery('chinese', '${escaped}')
            ORDER BY rank DESC
            LIMIT ${limit} OFFSET ${offset}
          ) sub
          ORDER BY sub.rank DESC
        `)),
        db.execute(sql.raw(`
          SELECT COUNT(*) as total FROM text_juans
          WHERE content_tsv @@ plainto_tsquery('chinese', '${escaped}')
        `)),
      ])
      result = dataResult
      total = Number((countResult as unknown as { total: string }[])[0]?.total) || 0
    }

    return c.json({
      query,
      data: result as unknown as Array<{
        text_id: string; juan: number; title: string; author_raw: string; snippet: string
      }>,
      pagination: {
        total,
        limit,
        offset,
      },
    })
  } catch (error) {
    console.error('经文正文搜索失败:', error)
    return c.json({ error: '服务器错误' }, 500)
  }
})

// ============ 语义搜索 API ============

/**
 * 语义搜索
 * GET /semantic-search?q=问题&limit=10
 * 使用 OpenAI embedding + pgvector 进行语义相似度搜索
 */
app.get('/semantic-search', async (c) => {
  const query = c.req.query('q') || ''
  const limit = Math.min(Number(c.req.query('limit')) || 10, 50)

  if (!query.trim()) {
    return c.json({ error: '请输入搜索内容' }, 400)
  }

  try {
    // 检查是否有嵌入数据
    const countResult = await db.execute(sql`SELECT COUNT(*) as cnt FROM text_chunks`)
    const chunkCount = Number((countResult as unknown as { cnt: string }[])[0]?.cnt) || 0

    if (chunkCount === 0) {
      return c.json({ error: '暂无语义搜索数据' }, 503)
    }

    // 生成查询向量
    const { embedding } = await createSingleEmbedding(query)
    const vectorStr = vectorToString(embedding)

    // 向量相似度搜索
    const results = await db.execute(sql.raw(`
      SELECT
        tc.text_id,
        tc.juan,
        tc.chunk_index,
        tc.content,
        t.title,
        t.author_raw,
        t.translation_dynasty,
        t.juan_count,
        1 - (tc.embedding <=> '${vectorStr}'::vector) as similarity
      FROM text_chunks tc
      JOIN texts t ON t.id = tc.text_id
      ORDER BY tc.embedding <=> '${vectorStr}'::vector
      LIMIT ${limit}
    `))

    return c.json({
      query,
      results: (results as unknown as Array<{
        text_id: string
        juan: number
        chunk_index: number
        content: string
        title: string
        author_raw: string
        translation_dynasty: string
        juan_count: number
        similarity: number
      }>).map(r => ({
        textId: r.text_id,
        juan: r.juan,
        title: r.title,
        authorRaw: r.author_raw,
        translationDynasty: r.translation_dynasty,
        juanCount: r.juan_count,
        content: r.content,
        similarity: r.similarity,
      })),
    })
  } catch (error) {
    console.error('语义搜索失败:', error)
    return c.json({ error: '服务器错误' }, 500)
  }
})

/**
 * 相似经文推荐
 * GET /texts/:id/similar?limit=5
 */
app.get('/texts/:id/similar', async (c) => {
  const textId = c.req.param('id')
  const limit = Math.min(Number(c.req.query('limit')) || 5, 20)

  try {
    // 检查该经文是否有嵌入数据
    const checkResult = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM text_chunks WHERE text_id = ${textId}
    `)
    const hasEmbedding = Number((checkResult as unknown as { cnt: string }[])[0]?.cnt) > 0

    if (!hasEmbedding) {
      return c.json({ error: '该经文暂无向量数据' }, 404)
    }

    // 计算该经文所有块的平均向量，然后找相似经文
    const results = await db.execute(sql.raw(`
      WITH avg_vec AS (
        SELECT AVG(embedding) as embedding
        FROM text_chunks
        WHERE text_id = '${textId}'
      )
      SELECT DISTINCT ON (tc.text_id)
        tc.text_id,
        t.title,
        t.author_raw,
        t.translation_dynasty,
        t.juan_count,
        1 - (tc.embedding <=> (SELECT embedding FROM avg_vec)) as similarity
      FROM text_chunks tc
      JOIN texts t ON t.id = tc.text_id
      WHERE tc.text_id != '${textId}'
      ORDER BY tc.text_id, tc.embedding <=> (SELECT embedding FROM avg_vec)
    `))

    // 按相似度排序取 top N
    const sorted = (results as unknown as Array<{
      text_id: string
      title: string
      author_raw: string
      translation_dynasty: string
      juan_count: number
      similarity: number
    }>)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)

    return c.json({
      textId,
      similar: sorted.map(r => ({
        textId: r.text_id,
        title: r.title,
        authorRaw: r.author_raw,
        translationDynasty: r.translation_dynasty,
        juanCount: r.juan_count,
        similarity: r.similarity,
      })),
    })
  } catch (error) {
    console.error('获取相似经文失败:', error)
    return c.json({ error: '服务器错误' }, 500)
  }
})

/**
 * RAG 问答 API
 * GET /ask?q=问题
 * 语义搜索 + LLM 生成答案
 */
app.get('/ask', async (c) => {
  const question = c.req.query('q') || ''

  if (!question.trim()) {
    return c.json({ error: '请输入问题' }, 400)
  }

  try {
    // 1. 检查是否有嵌入数据
    const countResult = await db.execute(sql`SELECT COUNT(*) as cnt FROM text_chunks`)
    const chunkCount = Number((countResult as unknown as { cnt: string }[])[0]?.cnt) || 0

    if (chunkCount === 0) {
      return c.json({ error: '暂无语义搜索数据' }, 503)
    }

    // 2. 语义搜索获取相关经文
    const { embedding } = await createSingleEmbedding(question)
    const vectorStr = vectorToString(embedding)

    const results = await db.execute(sql.raw(`
      SELECT
        tc.text_id,
        tc.juan,
        tc.content,
        t.title,
        1 - (tc.embedding <=> '${vectorStr}'::vector) as similarity
      FROM text_chunks tc
      JOIN texts t ON t.id = tc.text_id
      ORDER BY tc.embedding <=> '${vectorStr}'::vector
      LIMIT 5
    `))

    const contexts = (results as unknown as Array<{
      text_id: string
      juan: number
      content: string
      title: string
      similarity: number
    }>).map(r => ({
      textId: r.text_id,
      title: r.title,
      juan: r.juan,
      content: r.content,
      similarity: r.similarity,
    }))

    // 3. 调用 LLM 生成答案
    const answer = await askWithContext(question, contexts)

    return c.json({
      question,
      answer,
      sources: contexts.map(c => ({
        textId: c.textId,
        title: c.title,
        juan: c.juan,
        similarity: c.similarity,
      })),
    })
  } catch (error) {
    console.error('RAG 问答失败:', error)
    return c.json({ error: '服务器错误' }, 500)
  }
})

export default app

// 开发模式直接启动
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT) || 3001
  console.log(`🚀 CBETA API 服务启动于 http://localhost:${port}`)

  const { serve } = await import('@hono/node-server')
  serve({ fetch: app.fetch, port })
}
