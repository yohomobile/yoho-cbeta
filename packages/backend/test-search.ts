import { db } from './src/db/index.js'
import { sql } from 'drizzle-orm'
import { createSingleEmbedding, vectorToString } from './src/embedding/openai-service.js'

async function main() {
  const query = "初修业者创修观时地遍处定加行"

  // 生成查询向量
  const { embedding } = await createSingleEmbedding(query)
  const vectorStr = vectorToString(embedding)

  // 向量相似度搜索
  const results = await db.execute(sql.raw(`
    SELECT
      tc.text_id,
      tc.juan,
      tc.chunk_index,
      substring(tc.content, 1, 80) as content_preview,
      t.title,
      1 - (tc.embedding <=> '${vectorStr}'::vector) as similarity
    FROM text_chunks tc
    JOIN texts t ON t.id = tc.text_id
    WHERE tc.embedding IS NOT NULL
    ORDER BY tc.embedding <=> '${vectorStr}'::vector
    LIMIT 15
  `))

  console.log('语义检索结果 (query: "' + query + '"):')
  for (const r of results as any[]) {
    const hasT26 = r.text_id.startsWith('T26') ? ' **' : ''
    console.log('' + r.text_id + ' 卷' + r.juan + ': ' + r.similarity.toFixed(3) + ' - ' + r.title + hasT26)
    if (r.content_preview.includes('遍处')) {
      console.log('    ' + r.content_preview + '...')
    }
  }

  process.exit(0)
}

main().catch(console.error)
