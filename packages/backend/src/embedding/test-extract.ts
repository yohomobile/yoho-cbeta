/**
 * 测试文本提取
 */

import { db } from '../db/index.js'
import { sql } from 'drizzle-orm'
import { extractJuanText, chunkText, buildEmbeddingText } from './extract-text.js'

async function main() {
  // 测试金刚经
  const result = await db.execute(sql`
    SELECT
      tj.text_id, tj.juan, tj.content_simplified,
      t.title, t.author_raw, t.translation_dynasty, t.juan_count
    FROM text_juans tj
    JOIN texts t ON t.id = tj.text_id
    WHERE tj.text_id = 'T08n0235' AND tj.juan = 1
  `) as unknown as Array<{
    text_id: string
    juan: number
    content_simplified: unknown[]
    title: string
    author_raw: string | null
    translation_dynasty: string | null
    juan_count: number
  }>

  const juan = result[0]
  console.log('=== 经书信息 ===')
  console.log(`ID: ${juan.text_id}`)
  console.log(`标题: ${juan.title}`)
  console.log(`译者: ${juan.author_raw}`)
  console.log(`朝代: ${juan.translation_dynasty}`)
  console.log('')

  // 提取纯净文本
  const pureText = extractJuanText(juan.content_simplified)
  console.log('=== 提取的纯净文本 (前1000字) ===')
  console.log(pureText.slice(0, 1000))
  console.log(`\n... (总共 ${pureText.length} 字)`)
  console.log('')

  // 分块
  const chunks = chunkText(pureText)
  console.log(`=== 分块结果 (共 ${chunks.length} 块) ===`)
  for (let i = 0; i < Math.min(3, chunks.length); i++) {
    console.log(`\n--- 第 ${i + 1} 块 (${chunks[i].content.length}字) ---`)
    console.log(chunks[i].content.slice(0, 200) + '...')
  }
  console.log('')

  // 构建嵌入文本示例
  const embeddingText = buildEmbeddingText(chunks[0].content, {
    title: juan.title,
    authorRaw: juan.author_raw,
    translationDynasty: juan.translation_dynasty,
    juan: juan.juan,
    juanCount: juan.juan_count,
  })
  console.log('=== 嵌入文本示例 ===')
  console.log(embeddingText.slice(0, 500))
}

main().catch(console.error)
