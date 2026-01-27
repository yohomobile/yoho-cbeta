/**
 * 重新从 JSON 文件导入分卷数据到 text_juans 表
 * 基于 mulu type="卷" 标签拆分
 */

import { db } from '../src/db/index.js'
import { sql } from 'drizzle-orm'
import { existsSync, readFileSync } from 'fs'
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

/**
 * 深度遍历查找所有 mulu type="卷" 的位置
 * 返回每个卷边界在顶层 body 数组中的位置
 */
function findJuanBoundaries(body: CbetaNode[]): number[] {
  const boundaries: number[] = []

  // 递归查找 mulu 标签
  function searchInNode(node: CbetaNode, topIndex: number): boolean {
    if (typeof node !== 'object' || !node) return false

    if (node.tag === 'mulu' && node.attrs?.type === '卷') {
      return true
    }

    if (node.children) {
      for (const child of node.children) {
        if (searchInNode(child, topIndex)) {
          return true
        }
      }
    }

    return false
  }

  for (let i = 0; i < body.length; i++) {
    const node = body[i]
    if (searchInNode(node, i)) {
      boundaries.push(i)
    }
  }

  return boundaries
}

/**
 * 查找 milestone 位置作为备用
 */
function findMilestones(body: CbetaNode[]): number[] {
  const positions: number[] = []

  for (let i = 0; i < body.length; i++) {
    const node = body[i]
    if (typeof node === 'object' && node?.tag === 'milestone' && node.attrs?.unit === 'juan') {
      positions.push(i)
    }
  }

  return positions
}

/**
 * 根据边界拆分内容
 */
function splitByBoundaries(body: CbetaNode[], boundaries: number[]): CbetaNode[][] {
  if (boundaries.length === 0) {
    return [body]
  }

  const juans: CbetaNode[][] = []

  // 第一卷从开始到第一个边界（不包括边界本身的 mulu）
  // 但要注意：第一个 mulu type="卷" 可能是序之后的
  // 我们需要包含序部分

  for (let i = 0; i < boundaries.length; i++) {
    const start = i === 0 ? 0 : boundaries[i]
    const end = i + 1 < boundaries.length ? boundaries[i + 1] : body.length
    juans.push(body.slice(start, end))
  }

  return juans
}

async function reimportJuans() {
  console.log('开始重新导入分卷数据 (v2 - 基于 mulu)...')
  console.log(`数据目录: ${DATA_ROOT}`)

  // 获取需要处理的经文（有多卷的）
  const textsResult = await db.execute(sql`
    SELECT id, juan_count
    FROM texts
    WHERE juan_count > 1
    ORDER BY id
  `)
  const texts = textsResult as unknown as { id: string; juan_count: number }[]

  console.log(`找到 ${texts.length} 部多卷经文`)

  let processed = 0
  let updated = 0
  let errors = 0
  let skipped = 0

  for (const text of texts) {
    try {
      const { id, juan_count } = text
      const canon = id.match(/^[A-Z]+/)?.[0] || ''
      const volume = id.match(/^[A-Z]+\d+/)?.[0] || ''
      const filePath = path.join(DATA_ROOT, canon, volume, `${id}.json`)
      const tradFilePath = path.join(DATA_TRAD_ROOT, canon, volume, `${id}.json`)

      if (!existsSync(filePath)) {
        processed++
        skipped++
        continue
      }

      const data = JSON.parse(readFileSync(filePath, 'utf-8'))
      const body = data.body as CbetaNode[] | undefined

      if (!body || body.length === 0) {
        processed++
        skipped++
        continue
      }

      // 查找卷边界
      let boundaries = findJuanBoundaries(body)

      // 如果没有 mulu type="卷"，尝试用 milestone
      if (boundaries.length === 0) {
        boundaries = findMilestones(body)
      }

      // 检查边界数量是否匹配
      if (boundaries.length !== juan_count) {
        // 边界数量不匹配，可能是数据结构不同
        if (boundaries.length === 0) {
          // 没有边界，整体作为一卷
          processed++
          skipped++
          continue
        }
        // console.log(`${id}: 边界数 ${boundaries.length} != 预期卷数 ${juan_count}`)
      }

      // 读取繁体文件
      let tradBody: CbetaNode[] | null = null
      if (existsSync(tradFilePath)) {
        const tradData = JSON.parse(readFileSync(tradFilePath, 'utf-8'))
        tradBody = tradData.body as CbetaNode[] | undefined || null
      }

      // 拆分内容
      const simpJuans = splitByBoundaries(body, boundaries)
      const tradJuans = tradBody ? splitByBoundaries(tradBody, findJuanBoundaries(tradBody).length > 0 ? findJuanBoundaries(tradBody) : findMilestones(tradBody)) : null

      // 删除旧数据
      await db.execute(sql`DELETE FROM text_juans WHERE text_id = ${id}`)

      // 插入新数据
      for (let i = 0; i < simpJuans.length; i++) {
        const juanNum = i + 1
        const content = simpJuans[i]
        const tradContent = tradJuans?.[i] || null

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
      if (updated % 100 === 0) {
        console.log(`已更新 ${updated} 部经文`)
      }

      processed++
    } catch (error) {
      errors++
      console.error(`处理 ${text.id} 失败:`, error)
    }
  }

  console.log(`\n完成: 处理 ${processed} 部, 更新 ${updated} 部, 跳过 ${skipped} 部, 错误 ${errors} 个`)
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
