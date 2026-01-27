/**
 * 数据库种子脚本
 * 运行: npx tsx src/db/seed.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { dynasties } from './schema.js'
import { dynastyData } from './seed-dynasties.js'

const DATABASE_URL = process.env.DATABASE_URL || 'postgres:///cbeta?host=/var/run/postgresql'

async function seed() {
  console.log('🌱 开始填充种子数据...')

  const client = postgres(DATABASE_URL)
  const db = drizzle(client)

  // 清空并重新插入朝代数据
  console.log('📅 填充朝代表...')
  await db.delete(dynasties)
  await db.insert(dynasties).values(dynastyData)
  console.log(`   ✓ 插入 ${dynastyData.length} 条朝代记录`)

  await client.end()
  console.log('✅ 种子数据填充完成')
}

seed().catch((err) => {
  console.error('❌ 种子数据填充失败:', err)
  process.exit(1)
})
