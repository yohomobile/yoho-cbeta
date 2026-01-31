import { db } from './src/db/index.js'
import { sql } from 'drizzle-orm'

async function main() {
  // 检查 T26n1536 卷19-20 的 chunks 是否有 embedding
  const results = await db.execute(sql`
    SELECT juan, chunk_index,
           substring(content, 1, 60) as preview,
           embedding IS NOT NULL as has_embedding
    FROM text_chunks
    WHERE text_id = 'T26n1536' AND juan IN (19, 20)
    ORDER BY juan, chunk_index
  `)
  console.log('T26n1536 卷19-20 的 chunks:')
  for (const r of results as any[]) {
    const emb = r.has_embedding ? '✓' : '✗'
    console.log('  卷' + r.juan + ' chunk' + r.chunk_index + ' [' + emb + ']:', r.preview + '...')
  }
  process.exit(0)
}

main().catch(console.error)
