/**
 * 更新经文类型字段
 * 根据标题后缀判断经文类型：经/律/论/注疏/仪轨/其他
 */

import { db } from "./index.js"
import { sql } from "drizzle-orm"

/**
 * 根据经文标题判断类型
 */
function getTextType(title: string): string {
  const clean = title.replace(/[.　]/g, "").trim()
  if (!clean) return "其他"

  const lastChar = clean[clean.length - 1]

  // 论（优先判断，因为"经论"应该算论）
  if (lastChar === "论" || lastChar === "論") return "论"

  // 经
  if (lastChar === "经" || lastChar === "經") return "经"

  // 律
  if (lastChar === "律") return "律"

  // 注疏类
  if (["疏", "记", "記", "释", "釋", "注", "解"].includes(lastChar)) return "注疏"

  // 仪轨类
  if (["轨", "軌", "法", "仪", "儀"].includes(lastChar)) return "仪轨"

  return "其他"
}

async function main() {
  console.log("开始更新经文类型...")

  // 1. 先添加字段（如果不存在）
  try {
    await db.execute(sql`
      ALTER TABLE texts
      ADD COLUMN IF NOT EXISTS text_type VARCHAR(16)
    `)
    console.log("✓ 字段 text_type 已添加/确认存在")
  } catch (e) {
    console.log("字段可能已存在，继续...")
  }

  // 2. 获取所有经文
  const texts = await db.execute(sql`
    SELECT id, title FROM texts
  `) as unknown as Array<{ id: string; title: string }>

  console.log(`共 ${texts.length} 部经文需要更新`)

  // 3. 统计各类型数量
  const typeCount: Record<string, number> = {}
  const updates: Array<{ id: string; textType: string }> = []

  for (const text of texts) {
    const textType = getTextType(text.title)
    typeCount[textType] = (typeCount[textType] || 0) + 1
    updates.push({ id: text.id, textType })
  }

  console.log("\n类型分布:")
  for (const [type, count] of Object.entries(typeCount).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`)
  }

  // 4. 批量更新
  console.log("\n开始批量更新...")

  // 按类型分组更新，效率更高
  for (const [textType, count] of Object.entries(typeCount)) {
    const ids = updates.filter(u => u.textType === textType).map(u => u.id)

    // 分批更新，每批 500 个
    const batchSize = 500
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize)
      const idList = batch.map(id => `'${id}'`).join(",")

      await db.execute(sql.raw(`
        UPDATE texts
        SET text_type = '${textType}'
        WHERE id IN (${idList})
      `))
    }

    console.log(`  ✓ ${textType}: ${count} 条已更新`)
  }

  // 5. 验证更新结果
  const result = await db.execute(sql`
    SELECT text_type, COUNT(*) as count
    FROM texts
    GROUP BY text_type
    ORDER BY count DESC
  `) as unknown as Array<{ text_type: string; count: string }>

  console.log("\n更新后数据库中的分布:")
  for (const row of result) {
    console.log(`  ${row.text_type || "(空)"}: ${row.count}`)
  }

  console.log("\n✓ 更新完成!")
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("更新失败:", e)
    process.exit(1)
  })
