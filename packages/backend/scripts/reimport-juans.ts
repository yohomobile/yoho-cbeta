/**
 * 重新从 JSON 文件导入分卷数据到 text_juans 表
 * 基于 juan 标签（fun="open"/"close"）拆分，而不是 milestone
 */

import { db } from '../src/db/index.js'
import { sql } from 'drizzle-orm'
import { existsSync, readFileSync, readdirSync } from 'fs'
import path from 'path'

type CbetaNode = string | CbetaElement
type CbetaElement = {
  tag?: string
  ns?: string
  attrs?: Record<string, string>
  children?: CbetaNode[]
}

const DATA_ROOT = path.resolve(process.cwd(), '..', '..', 'data-simplified')
const DATA_TRAD_ROOT = path.resolve(process.cwd(), '..', '..', 'data-traditional')

interface JuanInfo {
  number: number
  startIndex: number
  endIndex: number
}

/**
 * 深度遍历查找所有 juan 标签及其位置
 */
function findJuanMarkers(body: CbetaNode[]): { opens: Map<number, number>, closes: Map<number, number> } {
  const opens = new Map<number, number>()
  const closes = new Map<number, number>()

  for (let i = 0; i < body.length; i++) {
    const node = body[i]
    if (typeof node === 'object' && node?.tag === 'juan' && node.attrs?.n) {
      const n = parseInt(node.attrs.n, 10)
      if (node.attrs.fun === 'open') {
        opens.set(n, i)
      } else if (node.attrs.fun === 'close') {
        closes.set(n, i)
      }
    }
  }

  return { opens, closes }
}

/**
 * 查找 milestone 位置
 */
function findMilestones(body: CbetaNode[]): Map<number, number> {
  const milestones = new Map<number, number>()

  for (let i = 0; i < body.length; i++) {
    const node = body[i]
    if (typeof node === 'object' && node?.tag === 'milestone' && node.attrs?.unit === 'juan') {
      const n = parseInt(node.attrs.n, 10)
      milestones.set(n, i)
    }
  }

  return milestones
}

/**
 * 根据 juan 标签或 milestone 拆分内容
 */
function splitIntoJuans(body: CbetaNode[], totalJuans: number): Map<number, CbetaNode[]> {
  const result = new Map<number, CbetaNode[]>()

  const { opens, closes } = findJuanMarkers(body)
  const milestones = findMilestones(body)

  // 如果有 juan 标签，使用 juan 标签拆分
  if (opens.size > 0) {
    // 按 juan open 标签的位置排序
    const sortedJuans = Array.from(opens.entries()).sort((a, b) => a[0] - b[0])

    for (let i = 0; i < sortedJuans.length; i++) {
      const [juanNum, startPos] = sortedJuans[i]

      // 找结束位置：下一个 juan open 或文件结束
      let endPos = body.length
      if (i + 1 < sortedJuans.length) {
        endPos = sortedJuans[i + 1][1]
      }

      // 包含 juan close 标签之后的内容也要包括
      const closePos = closes.get(juanNum)
      if (closePos && closePos < endPos) {
        // close 标签后可能还有 whitespace，但不要越过下一个 juan
      }

      result.set(juanNum, body.slice(startPos, endPos))
    }
  }
  // 否则使用 milestone 拆分
  else if (milestones.size > 0) {
    const sortedMilestones = Array.from(milestones.entries()).sort((a, b) => a[0] - b[0])

    for (let i = 0; i < sortedMilestones.length; i++) {
      const [msNum, startPos] = sortedMilestones[i]

      let endPos = body.length
      if (i + 1 < sortedMilestones.length) {
        endPos = sortedMilestones[i + 1][1]
      }

      // milestone 模式：每个 milestone 可能对应多卷
      // 我们只能按 milestone 段存储，用 milestone 的 n 作为起始卷号
      result.set(msNum, body.slice(startPos, endPos))
    }
  }
  // 没有任何标记，整体作为第1卷
  else {
    result.set(1, body)
  }

  return result
}

async function reimportJuans() {
  console.log('开始重新导入分卷数据...')
  console.log(`数据目录: ${DATA_ROOT}`)

  // 获取所有需要处理的经文
  const textsResult = await db.execute(sql`
    SELECT id, juan_count
    FROM texts
    WHERE juan_count > 0
    ORDER BY id
  `)
  const texts = textsResult as unknown as { id: string; juan_count: number }[]

  console.log(`找到 ${texts.length} 部经文`)

  // 先统计有多少需要重新导入
  let needsReimport = 0
  let hasFile = 0

  for (const text of texts) {
    const { id } = text
    const canon = id.match(/^[A-Z]+/)?.[0] || ''
    const volume = id.match(/^[A-Z]+\d+/)?.[0] || ''
    const filePath = path.join(DATA_ROOT, canon, volume, `${id}.json`)

    if (existsSync(filePath)) {
      hasFile++
      // 检查是否有 juan 标签
      const data = JSON.parse(readFileSync(filePath, 'utf-8'))
      const { opens } = findJuanMarkers(data.body || [])
      if (opens.size > 0 && opens.size !== text.juan_count) {
        // 当前 DB 数据可能不正确
      }
      if (opens.size > 1) {
        needsReimport++
      }
    }
  }

  console.log(`有文件的经文: ${hasFile}`)
  console.log(`有多卷 juan 标签的经文: ${needsReimport}`)

  // 处理需要重新导入的经文
  let processed = 0
  let updated = 0
  let errors = 0

  for (const text of texts) {
    try {
      const { id, juan_count } = text
      const canon = id.match(/^[A-Z]+/)?.[0] || ''
      const volume = id.match(/^[A-Z]+\d+/)?.[0] || ''
      const filePath = path.join(DATA_ROOT, canon, volume, `${id}.json`)
      const tradFilePath = path.join(DATA_TRAD_ROOT, canon, volume, `${id}.json`)

      if (!existsSync(filePath)) {
        processed++
        continue
      }

      const data = JSON.parse(readFileSync(filePath, 'utf-8'))
      const body = data.body as CbetaNode[] | undefined

      if (!body || body.length === 0) {
        processed++
        continue
      }

      const { opens } = findJuanMarkers(body)

      // 只处理有多个 juan 标签的经文
      if (opens.size <= 1) {
        processed++
        continue
      }

      // 读取繁体文件
      let tradBody: CbetaNode[] | null = null
      if (existsSync(tradFilePath)) {
        const tradData = JSON.parse(readFileSync(tradFilePath, 'utf-8'))
        tradBody = tradData.body as CbetaNode[] | undefined || null
      }

      // 拆分简体和繁体内容
      const simpJuans = splitIntoJuans(body, juan_count)
      const tradJuans = tradBody ? splitIntoJuans(tradBody, juan_count) : null

      // 删除旧数据
      await db.execute(sql`DELETE FROM text_juans WHERE text_id = ${id}`)

      // 插入新数据
      for (const [juanNum, content] of simpJuans) {
        const tradContent = tradJuans?.get(juanNum) || null

        await db.execute(sql`
          INSERT INTO text_juans (text_id, juan, content_simplified, content_traditional)
          VALUES (
            ${id},
            ${juanNum},
            ${JSON.stringify(content)}::jsonb,
            ${tradContent ? JSON.stringify(tradContent) : null}::jsonb
          )
        `)
      }

      updated++
      if (updated % 50 === 0) {
        console.log(`已更新 ${updated} 部经文`)
      }

      processed++
    } catch (error) {
      errors++
      console.error(`处理 ${text.id} 失败:`, error)
    }
  }

  console.log(`\n完成: 处理 ${processed} 部, 更新 ${updated} 部, 错误 ${errors} 个`)
}

// 运行
reimportJuans()
  .then(() => {
    console.log('脚本执行完毕')
    process.exit(0)
  })
  .catch((error) => {
    console.error('脚本执行失败:', error)
    process.exit(1)
  })
