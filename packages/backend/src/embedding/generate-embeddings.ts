/**
 * 生成经文嵌入向量的迁移脚本
 *
 * 使用方法:
 *   OPENAI_API_KEY=sk-xxx tsx src/embedding/generate-embeddings.ts
 *
 * 可选参数:
 *   --dry-run      只计算不写入
 *   --limit=N      只处理前 N 卷
 *   --text-id=XXX  只处理指定经书
 */

import { db } from '../db/index.js'
import { sql } from 'drizzle-orm'
import { extractJuanText, chunkText, buildEmbeddingText, type SutraChunkMeta } from './extract-text.js'
import { createEmbeddings, vectorToString } from './openai-service.js'

// 解析命令行参数
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const limitArg = args.find(a => a.startsWith('--limit='))
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 0
const textIdArg = args.find(a => a.startsWith('--text-id='))
const specificTextId = textIdArg ? textIdArg.split('=')[1] : null

// 统计
let totalChunks = 0
let totalTokens = 0
let processedJuans = 0

interface JuanRow {
  text_id: string
  juan: number
  content_simplified: unknown[]
  title: string
  author_raw: string | null
  translation_dynasty: string | null
  juan_count: number
}

async function processJuan(juan: JuanRow): Promise<number> {
  // 提取纯净文本
  const pureText = extractJuanText(juan.content_simplified)
  if (!pureText || pureText.length < 50) {
    console.log(`  跳过 ${juan.text_id} 第${juan.juan}卷 (文本过短: ${pureText?.length || 0}字)`)
    return 0
  }

  // 分块
  const chunks = chunkText(pureText, { maxChars: 500, overlap: 50, minChars: 100 })
  if (chunks.length === 0) {
    console.log(`  跳过 ${juan.text_id} 第${juan.juan}卷 (无有效分块)`)
    return 0
  }

  const meta: SutraChunkMeta = {
    title: juan.title,
    authorRaw: juan.author_raw,
    translationDynasty: juan.translation_dynasty,
    juan: juan.juan,
    juanCount: juan.juan_count,
  }

  // 构建嵌入文本
  const embeddingTexts = chunks.map(chunk => buildEmbeddingText(chunk.content, meta))

  if (isDryRun) {
    console.log(`  ${juan.text_id} 第${juan.juan}卷: ${chunks.length}块, 约${pureText.length}字`)
    return chunks.length
  }

  // 生成嵌入
  const embeddings = await createEmbeddings(embeddingTexts)

  // 写入数据库
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const embedding = embeddings[i]

    await db.execute(sql`
      INSERT INTO text_chunks
      (text_id, juan, chunk_index, content, content_for_embedding, embedding, char_start, char_end)
      VALUES (
        ${juan.text_id}, ${juan.juan}, ${i},
        ${chunk.content}, ${embeddingTexts[i]},
        ${sql.raw(`'${vectorToString(embedding.embedding)}'::vector`)},
        ${chunk.charStart}, ${chunk.charEnd}
      )
      ON CONFLICT (text_id, juan, chunk_index) DO UPDATE SET
        content = EXCLUDED.content,
        content_for_embedding = EXCLUDED.content_for_embedding,
        embedding = EXCLUDED.embedding,
        char_start = EXCLUDED.char_start,
        char_end = EXCLUDED.char_end
    `)

    totalTokens += embedding.tokenCount
  }

  console.log(`  ${juan.text_id} 第${juan.juan}卷: ${chunks.length}块, ${embeddings.reduce((sum, e) => sum + e.tokenCount, 0)} tokens`)
  return chunks.length
}

async function main() {
  console.log('========================================')
  console.log('经文嵌入生成脚本')
  console.log('========================================')
  console.log(`模式: ${isDryRun ? '预览 (dry-run)' : '实际执行'}`)
  if (limit > 0) console.log(`限制: 前 ${limit} 卷`)
  if (specificTextId) console.log(`指定经书: ${specificTextId}`)
  console.log('')

  // 查询要处理的卷
  let query = `
    SELECT
      tj.text_id, tj.juan, tj.content_simplified,
      t.title, t.author_raw, t.translation_dynasty, t.juan_count
    FROM text_juans tj
    JOIN texts t ON t.id = tj.text_id
    WHERE tj.content_simplified IS NOT NULL
  `
  if (specificTextId) {
    query += ` AND tj.text_id = '${specificTextId}'`
  }
  query += ` ORDER BY tj.text_id, tj.juan`
  if (limit > 0) {
    query += ` LIMIT ${limit}`
  }

  const juans = await db.execute(sql.raw(query)) as unknown as JuanRow[]

  console.log(`找到 ${juans.length} 卷待处理`)
  console.log('')

  const startTime = Date.now()

  for (const juan of juans) {
    try {
      const chunkCount = await processJuan(juan)
      totalChunks += chunkCount
      processedJuans++

      // 每处理 100 卷输出进度
      if (processedJuans % 100 === 0) {
        const elapsed = (Date.now() - startTime) / 1000
        const rate = processedJuans / elapsed
        const remaining = (juans.length - processedJuans) / rate
        console.log(`\n进度: ${processedJuans}/${juans.length} (${(processedJuans/juans.length*100).toFixed(1)}%)`)
        console.log(`已用时: ${elapsed.toFixed(0)}s, 预计剩余: ${remaining.toFixed(0)}s`)
        console.log(`总块数: ${totalChunks}, 总tokens: ${totalTokens}\n`)
      }
    } catch (error) {
      console.error(`处理 ${juan.text_id} 第${juan.juan}卷 失败:`, error)
    }
  }

  const totalTime = (Date.now() - startTime) / 1000
  const estimatedCost = (totalTokens / 1000000) * 0.02  // text-embedding-3-small: $0.02/1M tokens

  console.log('')
  console.log('========================================')
  console.log('完成统计')
  console.log('========================================')
  console.log(`处理卷数: ${processedJuans}`)
  console.log(`总块数: ${totalChunks}`)
  console.log(`总tokens: ${totalTokens.toLocaleString()}`)
  console.log(`预估成本: $${estimatedCost.toFixed(4)}`)
  console.log(`总用时: ${totalTime.toFixed(1)}s`)
}

main().catch(console.error)
