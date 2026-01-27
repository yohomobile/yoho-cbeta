/**
 * 将 texts 表的 body 数据按卷拆分到 text_juans 表
 */

import { db } from '../src/db/index.js'
import { sql } from 'drizzle-orm'

async function migrateJuans() {
  console.log('开始迁移分卷数据...')

  // 获取所有有 body 数据的经文
  const textsResult = await db.execute(sql`
    SELECT id, juan_count
    FROM texts
    WHERE body_simplified IS NOT NULL
    ORDER BY id
  `)
  const texts = textsResult as unknown as { id: string; juan_count: number }[]

  console.log(`找到 ${texts.length} 部经文需要迁移`)

  let processed = 0
  let errors = 0

  for (const text of texts) {
    try {
      const { id, juan_count } = text
      const juanCount = juan_count || 1

      // 检查是否已经迁移过
      const existingResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM text_juans WHERE text_id = ${id}
      `)
      const existing = (existingResult as unknown as { count: string }[])[0]
      if (parseInt(existing.count, 10) > 0) {
        processed++
        if (processed % 100 === 0) {
          console.log(`已跳过 ${processed}/${texts.length} (已存在)`)
        }
        continue
      }

      // 获取所有 milestone 边界
      const milestoneResult = await db.execute(sql.raw(`
        WITH body_elements AS (
          SELECT ordinality, elem
          FROM texts, jsonb_array_elements(body_simplified) WITH ORDINALITY AS arr(elem, ordinality)
          WHERE id = '${id}'
        )
        SELECT
          ordinality,
          ROW_NUMBER() OVER (ORDER BY ordinality) as seq,
          (elem->'attrs'->>'n')::int as original_juan
        FROM body_elements
        WHERE elem->>'tag' = 'milestone'
          AND (elem->'attrs'->>'unit') = 'juan'
        ORDER BY ordinality
      `))
      const milestones = milestoneResult as unknown as { ordinality: string; seq: string; original_juan: number }[]

      if (milestones.length === 0) {
        // 没有 milestone，整个 body 作为第1卷
        await db.execute(sql.raw(`
          INSERT INTO text_juans (text_id, juan, content_simplified, content_traditional)
          SELECT
            '${id}',
            1,
            body_simplified,
            body_traditional
          FROM texts
          WHERE id = '${id}'
        `))
      } else {
        // 有 milestone，按 milestone 拆分
        for (let i = 0; i < milestones.length; i++) {
          const startPos = parseInt(milestones[i].ordinality, 10)
          const endPos = i + 1 < milestones.length ? parseInt(milestones[i + 1].ordinality, 10) : null
          const juan = i + 1 // 1-based

          const endCondition = endPos !== null
            ? `AND be.ordinality < ${endPos}`
            : ''

          await db.execute(sql.raw(`
            INSERT INTO text_juans (text_id, juan, content_simplified, content_traditional)
            SELECT
              '${id}',
              ${juan},
              (
                SELECT jsonb_agg(elem ORDER BY ordinality)
                FROM (
                  SELECT ordinality, elem
                  FROM texts, jsonb_array_elements(body_simplified) WITH ORDINALITY AS arr(elem, ordinality)
                  WHERE id = '${id}'
                ) be
                WHERE be.ordinality >= ${startPos} ${endCondition}
              ),
              (
                SELECT jsonb_agg(elem ORDER BY ordinality)
                FROM (
                  SELECT ordinality, elem
                  FROM texts, jsonb_array_elements(body_traditional) WITH ORDINALITY AS arr(elem, ordinality)
                  WHERE id = '${id}'
                ) be
                WHERE be.ordinality >= ${startPos} ${endCondition}
              )
          `))
        }
      }

      processed++
      if (processed % 100 === 0) {
        console.log(`已处理 ${processed}/${texts.length}`)
      }
    } catch (error) {
      errors++
      console.error(`迁移 ${text.id} 失败:`, error)
    }
  }

  console.log(`迁移完成: 成功 ${processed - errors}, 失败 ${errors}`)
}

// 运行迁移
migrateJuans()
  .then(() => {
    console.log('迁移脚本执行完毕')
    process.exit(0)
  })
  .catch((error) => {
    console.error('迁移脚本执行失败:', error)
    process.exit(1)
  })
