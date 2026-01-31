/**
 * 同义词提取脚本
 * 从 dictionary_entries 表中提取同义词信息
 *
 * 使用方法：
 * pnpm tsx src/extract-synonyms.ts
 */

import pg from 'pg'

const pool = new pg.Pool({
  database: 'cbeta',
  host: '/var/run/postgresql',
})

/**
 * 清理字符串：移除多余空格、标点等
 */
function cleanString(str: string): string {
  return str
    .trim()
    .replace(/\s+/g, '')
    .replace(/[（）「」『』]/g, '')
}

/**
 * 分割同义词列表
 */
function splitSynonyms(text: string): string[] {
  const result: string[] = []
  const parts = text.split(/[,，、；;]|\s+和\s+/)

  for (const part of parts) {
    const cleaned = cleanString(part)
    if (cleaned.length > 0 && cleaned.length < 50) {
      result.push(cleaned)
    }
  }

  return result
}

/**
 * 从词典释义中提取同义词
 *
 * 匹配模式：
 * - "又作XXX"
 * - "又称XXX"
 * - "别称XXX"
 * - "略称XXX"
 * - "亦称XXX"
 * - "亦名XXX"
 * - "又名XXX"
 */
function extractSynonymsFromDefinition(
  term: string,
  definitionText: string
): { synonym: string; relationType: string }[] {
  const result: { synonym: string; relationType: string }[] = []

  // 匹配模式列表
  const patterns = [
    { regex: /又作(?:[:：])?([^。；；\n]{1,200})(?:[。；；]|$)/, relationType: 'exact' },
    { regex: /又称(?:[:：])?([^。；；\n]{1,200})(?:[。；；]|$)/, relationType: 'exact' },
    { regex: /亦称(?:[:：])?([^。；；\n]{1,200})(?:[。；；]|$)/, relationType: 'exact' },
    { regex: /亦名(?:[:：])?([^。；；\n]{1,200})(?:[。；；]|$)/, relationType: 'exact' },
    { regex: /又名(?:[:：])?([^。；；\n]{1,200})(?:[。；；]|$)/, relationType: 'exact' },
    { regex: /别称(?:[:：])?([^。；；\n]{1,200})(?:[。；；]|$)/, relationType: 'exact' },
    { regex: /略称(?:[:：])?([^。；；\n]{1,200})(?:[。；；]|$)/, relationType: 'abbreviation' },
    { regex: /意译(?:[:：])?为([^。；；\n]{1,200})(?:[。；；]|$)/, relationType: 'exact' },
  ]

  for (const pattern of patterns) {
    const match = definitionText.match(pattern.regex)
    if (match) {
      const synonyms = splitSynonyms(match[1])
      for (const synonym of synonyms) {
        // 排除与原词相同的情况
        if (synonym !== term && synonym.length > 0) {
          result.push({ synonym, relationType: pattern.relationType })
        }
      }
    }
  }

  return result
}

/**
 * 创建同义词表
 */
async function createTable() {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS term_synonyms (
        id SERIAL PRIMARY KEY,
        canonical_term VARCHAR(500) NOT NULL,
        synonym VARCHAR(500) NOT NULL,
        entity_type VARCHAR(32) NOT NULL DEFAULT 'term',
        entity_id VARCHAR(32),
        relation_type VARCHAR(32) NOT NULL DEFAULT 'exact',
        priority INTEGER NOT NULL DEFAULT 0,
        source VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(canonical_term, synonym)
      );

      CREATE INDEX IF NOT EXISTS idx_term_synonyms_synonym ON term_synonyms(synonym);
      CREATE INDEX IF NOT EXISTS idx_term_synonyms_entity_type ON term_synonyms(entity_type);
      CREATE INDEX IF NOT EXISTS idx_term_synonyms_priority ON term_synonyms(priority);
    `)
    console.log('✅ 数据库表创建成功')
  } finally {
    client.release()
  }
}

/**
 * 清理字符串中的无效字符
 */
function sanitizeString(str: string): string {
  return str.replace(/\x00/g, '').replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, '')
}

/**
 * 提取并导入同义词
 */
async function extractAndImport() {
  const client = await pool.connect()

  try {
    // 获取所有词典条目
    const result = await client.query(`
      SELECT term, definition_text, source
      FROM dictionary_entries
      WHERE definition_text IS NOT NULL
      ORDER BY term
    `)

    console.log(`📖 共 ${result.rows.length} 条词典条目`)

    let totalSynonyms = 0
    let imported = 0
    let skipped = 0
    const batchSize = 100
    const batch: { canonicalTerm: string; synonym: string; entityType: string; relationType: string; source: string }[] = []

    for (const row of result.rows) {
      const term = row.term
      const definitionText = row.definition_text || ''
      const source = row.source

      // 提取同义词
      const synonyms = extractSynonymsFromDefinition(term, definitionText)

      if (synonyms.length > 0) {
        totalSynonyms += synonyms.length

        for (const syn of synonyms) {
          batch.push({
            canonicalTerm: sanitizeString(term),
            synonym: sanitizeString(syn.synonym),
            entityType: 'term',
            relationType: syn.relationType,
            source: `dict:${source}`,
          })
        }

        // 批量插入
        if (batch.length >= batchSize) {
          const insertResult = await insertBatch(client, batch)
          imported += insertResult.imported
          skipped += insertResult.skipped
          batch.length = 0
        }
      }
    }

    // 插入剩余的
    if (batch.length > 0) {
      const insertResult = await insertBatch(client, batch)
      imported += insertResult.imported
      skipped += insertResult.skipped
    }

    console.log(`\n📊 提取完成:`)
    console.log(`  - 发现同义词关系: ${totalSynonyms} 条`)
    console.log(`  - 成功导入: ${imported} 条`)
    console.log(`  - 跳过重复: ${skipped} 条`)

    // 统计
    const stats = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(DISTINCT canonical_term) as unique_terms,
        COUNT(CASE WHEN relation_type = 'abbreviation' THEN 1 END) as abbreviations,
        COUNT(CASE WHEN relation_type = 'exact' THEN 1 END) as exact
      FROM term_synonyms
    `)

    console.log(`\n📈 数据库统计:`)
    console.log(`  - 总同义词对: ${stats.rows[0].total}`)
    console.log(`  - 涉及词条: ${stats.rows[0].unique_terms}`)
    console.log(`  - 完全同义: ${stats.rows[0].exact}`)
    console.log(`  - 缩写关系: ${stats.rows[0].abbreviations}`)

    // 显示一些示例
    const examples = await client.query(`
      SELECT canonical_term, synonym, relation_type
      FROM term_synonyms
      ORDER BY RANDOM()
      LIMIT 20
    `)

    console.log(`\n📝 示例:`)
    for (const ex of examples.rows) {
      console.log(`  ${ex.canonical_term} → ${ex.synonym} (${ex.relation_type})`)
    }

  } finally {
    client.release()
  }
}

async function insertBatch(
  client: pg.PoolClient,
  batch: { canonicalTerm: string; synonym: string; entityType: string; relationType: string; source: string }[]
): Promise<{ imported: number; skipped: number }> {
  let imported = 0
  let skipped = 0

  for (const item of batch) {
    try {
      await client.query(`
        INSERT INTO term_synonyms (canonical_term, synonym, entity_type, relation_type, source)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (canonical_term, synonym) DO NOTHING
      `, [item.canonicalTerm, item.synonym, item.entityType, item.relationType, item.source])
      imported++
    } catch (error) {
      skipped++
    }
  }

  return { imported, skipped }
}

async function main() {
  console.log('🔍 开始提取同义词...\n')

  await createTable()
  await extractAndImport()

  await pool.end()
  console.log('\n✨ 完成!')
}

main().catch(console.error)
