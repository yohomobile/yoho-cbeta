/**
 * 从 JSON 文件补充缺失的分卷数据到 text_juans 表
 */

import { db } from '../src/db/index.js'
import { sql } from 'drizzle-orm'
import { existsSync, readFileSync, readdirSync } from 'fs'
import path from 'path'

type CbetaNode = string | CbetaElement
type CbetaElement = {
  tag?: string
  attrs?: Record<string, string>
  children?: CbetaNode[]
}

const DATA_ROOT = path.resolve(process.cwd(), '..', '..', 'data-simplified')
const DATA_TRAD_ROOT = path.resolve(process.cwd(), '..', '..', 'data-traditional')

function findMilestones(body: CbetaNode[]): number[] {
  const positions: number[] = []

  for (let i = 0; i < body.length; i++) {
    const node = body[i]
    if (typeof node === 'object' && node !== null) {
      if (node.tag === 'milestone' && node.attrs?.unit === 'juan') {
        positions.push(i)
      }
    }
  }

  return positions
}

function splitByMilestones(body: CbetaNode[], positions: number[]): CbetaNode[][] {
  if (positions.length === 0) {
    return [body]
  }

  const juans: CbetaNode[][] = []
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i]
    const end = i + 1 < positions.length ? positions[i + 1] : body.length
    juans.push(body.slice(start, end))
  }

  return juans
}

async function fixMissingJuans() {
  console.log('开始补充缺失的分卷数据...')
  console.log(`数据目录: ${DATA_ROOT}`)

  // 获取所有不完整的经文
  const incompleteResult = await db.execute(sql`
    SELECT t.id, t.juan_count, COALESCE(tj.actual_juans, 0) as actual_juans
    FROM texts t
    LEFT JOIN (
      SELECT text_id, COUNT(*) as actual_juans
      FROM text_juans
      GROUP BY text_id
    ) tj ON t.id = tj.text_id
    WHERE t.juan_count > COALESCE(tj.actual_juans, 0)
    ORDER BY t.id
  `)
  const incompleteTexts = incompleteResult as unknown as { id: string; juan_count: number; actual_juans: string }[]

  console.log(`找到 ${incompleteTexts.length} 部经文需要补充`)

  let processed = 0
  let fixed = 0
  let errors = 0

  for (const text of incompleteTexts) {
    try {
      const { id, juan_count } = text
      const actualJuans = parseInt(text.actual_juans, 10)

      // 解析 id 获取文件路径: T01n0001 -> T/T01/T01n0001.json
      const canon = id.match(/^[A-Z]+/)?.[0] || ''
      const volume = id.match(/^[A-Z]+\d+/)?.[0] || ''
      const filePath = path.join(DATA_ROOT, canon, volume, `${id}.json`)
      const tradFilePath = path.join(DATA_TRAD_ROOT, canon, volume, `${id}.json`)

      if (!existsSync(filePath)) {
        // console.log(`文件不存在: ${filePath}`)
        processed++
        continue
      }

      // 读取 JSON 文件
      const data = JSON.parse(readFileSync(filePath, 'utf-8'))
      const body = data.body as CbetaNode[] | undefined

      if (!body || body.length === 0) {
        processed++
        continue
      }

      // 读取繁体文件（如果存在）
      let tradBody: CbetaNode[] | null = null
      if (existsSync(tradFilePath)) {
        const tradData = JSON.parse(readFileSync(tradFilePath, 'utf-8'))
        tradBody = tradData.body as CbetaNode[] | undefined || null
      }

      // 找出 milestone 位置并拆分
      const milestones = findMilestones(body)
      const juanContents = splitByMilestones(body, milestones)
      const tradJuanContents = tradBody ? splitByMilestones(tradBody, findMilestones(tradBody)) : null

      // 获取已存在的卷号
      const existingResult = await db.execute(sql`
        SELECT juan FROM text_juans WHERE text_id = ${id}
      `)
      const existingJuans = new Set((existingResult as unknown as { juan: number }[]).map(r => r.juan))

      // 插入缺失的卷
      let insertedCount = 0
      for (let i = 0; i < juanContents.length; i++) {
        const juan = i + 1
        if (existingJuans.has(juan)) {
          continue
        }

        const content = juanContents[i]
        const tradContent = tradJuanContents?.[i] || null

        await db.execute(sql`
          INSERT INTO text_juans (text_id, juan, content_simplified, content_traditional)
          VALUES (
            ${id},
            ${juan},
            ${JSON.stringify(content)}::jsonb,
            ${tradContent ? JSON.stringify(tradContent) : null}::jsonb
          )
        `)
        insertedCount++
      }

      if (insertedCount > 0) {
        fixed++
        console.log(`${id}: 补充了 ${insertedCount} 卷 (原有 ${actualJuans}/${juan_count})`)
      }

      processed++
      if (processed % 100 === 0) {
        console.log(`进度: ${processed}/${incompleteTexts.length}`)
      }
    } catch (error) {
      errors++
      console.error(`处理 ${text.id} 失败:`, error)
    }
  }

  console.log(`\n完成: 处理 ${processed} 部, 修复 ${fixed} 部, 错误 ${errors} 个`)
}

// 运行
fixMissingJuans()
  .then(() => {
    console.log('脚本执行完毕')
    process.exit(0)
  })
  .catch((error) => {
    console.error('脚本执行失败:', error)
    process.exit(1)
  })
