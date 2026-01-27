/**
 * 重新从 JSON 文件导入分卷数据到 text_juans 表
 * 最终版本：使用 v5 扁平遍历算法正确处理嵌套结构
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

/**
 * 深拷贝节点
 */
function deepClone(node: CbetaNode): CbetaNode {
  if (typeof node === 'string') return node
  if (!node || typeof node !== 'object') return node

  const cloned: CbetaElement = { ...node }
  if (node.children) {
    cloned.children = node.children.map(child => deepClone(child))
  }
  return cloned
}

/**
 * 统计 mulu type="卷" 的数量
 */
function countMuluJuan(nodes: CbetaNode[]): number {
  let count = 0

  function traverse(node: CbetaNode) {
    if (typeof node !== 'object' || !node) return

    if (node.tag === 'mulu' && node.attrs?.type === '卷') {
      count++
    }

    if (node.children) {
      for (const child of node.children) {
        traverse(child)
      }
    }
  }

  for (const node of nodes) {
    traverse(node)
  }

  return count
}

/**
 * 使用扁平遍历方法分割内容
 * 遍历整个树，按 mulu type="卷" 分组收集内容
 */
function splitByMuluFlat(body: CbetaNode[]): CbetaNode[][] {
  const juans: CbetaNode[][] = []
  juans[0] = []

  interface VisitorState {
    currentJuan: number
    juanStacks: Map<number, { node: CbetaElement, childrenCollected: CbetaNode[] }[]>
  }

  const state: VisitorState = {
    currentJuan: 0,
    juanStacks: new Map()
  }

  state.juanStacks.set(0, [])

  function addToCurrentJuan(node: CbetaNode) {
    const stack = state.juanStacks.get(state.currentJuan)!
    if (stack.length === 0) {
      juans[state.currentJuan].push(node)
    } else {
      stack[stack.length - 1].childrenCollected.push(node)
    }
  }

  function pushToStack(node: CbetaElement) {
    const stack = state.juanStacks.get(state.currentJuan)!
    stack.push({ node, childrenCollected: [] })
  }

  function popFromStack() {
    const stack = state.juanStacks.get(state.currentJuan)
    if (!stack || stack.length === 0) return

    const top = stack.pop()!
    top.node.children = top.childrenCollected

    if (stack.length === 0) {
      juans[state.currentJuan].push(top.node)
    } else {
      stack[stack.length - 1].childrenCollected.push(top.node)
    }
  }

  function finishCurrentJuan() {
    const stack = state.juanStacks.get(state.currentJuan)
    if (!stack) return

    while (stack.length > 0) {
      popFromStack()
    }
  }

  function visit(
    node: CbetaNode,
    ancestors: { node: CbetaElement, index: number }[]
  ): void {
    if (typeof node === 'string') {
      addToCurrentJuan(node)
      return
    }

    if (!node || typeof node !== 'object') {
      return
    }

    if (node.tag === 'mulu' && node.attrs?.type === '卷') {
      finishCurrentJuan()

      state.currentJuan++
      if (!juans[state.currentJuan]) {
        juans[state.currentJuan] = []
      }
      state.juanStacks.set(state.currentJuan, [])

      for (const ancestor of ancestors) {
        const clonedAncestor: CbetaElement = {
          ...ancestor.node,
          children: []
        }
        pushToStack(clonedAncestor)
      }

      addToCurrentJuan({
        ...node,
        children: node.children ? node.children.map(c => deepClone(c)) : undefined
      })

      return
    }

    if (!node.children || node.children.length === 0) {
      addToCurrentJuan({
        ...node,
        children: node.children ? [] : undefined
      })
      return
    }

    const shell: CbetaElement = {
      ...node,
      children: []
    }
    pushToStack(shell)

    const childAncestors = [...ancestors, { node: node, index: ancestors.length }]
    for (const child of node.children) {
      visit(child, childAncestors)
    }

    popFromStack()
  }

  for (const node of body) {
    visit(node, [])
  }

  finishCurrentJuan()

  return juans.filter(j => j && j.length > 0)
}

/**
 * 处理单个文本文件
 */
async function processText(textId: string): Promise<{ updated: boolean, juanCount: number, error?: string }> {
  // 确定文件路径
  const parts = textId.match(/^([A-Z]+)(\d+)n/)
  if (!parts) {
    return { updated: false, juanCount: 0, error: '无效的文本ID格式' }
  }

  const canon = parts[1]
  const volNum = parts[2]
  const volId = `${canon}${volNum}`

  const simplifiedPath = path.join(DATA_ROOT, canon, volId, `${textId}.json`)
  const traditionalPath = path.join(DATA_TRAD_ROOT, canon, volId, `${textId}.json`)

  if (!existsSync(simplifiedPath)) {
    return { updated: false, juanCount: 0, error: '简体文件不存在' }
  }

  try {
    // 读取简体版
    const simplifiedData = JSON.parse(readFileSync(simplifiedPath, 'utf-8'))
    const simplifiedBody = simplifiedData.body as CbetaNode[]

    // 读取繁体版（如果存在）
    let traditionalBody: CbetaNode[] | null = null
    if (existsSync(traditionalPath)) {
      const traditionalData = JSON.parse(readFileSync(traditionalPath, 'utf-8'))
      traditionalBody = traditionalData.body as CbetaNode[]
    }

    // 分割简体版
    const simplifiedJuans = splitByMuluFlat(simplifiedBody)

    // 分割繁体版（如果有）
    let traditionalJuans: CbetaNode[][] | null = null
    if (traditionalBody) {
      traditionalJuans = splitByMuluFlat(traditionalBody)
    }

    // 删除旧数据
    await db.execute(sql`DELETE FROM text_juans WHERE text_id = ${textId}`)

    // 插入新数据
    // 注意：如果有序言（第一个 mulu 之前的内容），它会成为 juans[0]
    // mulu 标记的第一卷会成为 juans[1]
    // 所以我们需要根据 mulu 数量来决定卷号

    const muluCount = countMuluJuan(simplifiedBody)

    if (muluCount === 0) {
      // 没有卷标记，整体作为第 1 卷
      await db.execute(sql`
        INSERT INTO text_juans (text_id, juan, content_simplified, content_traditional)
        VALUES (
          ${textId},
          1,
          ${JSON.stringify(simplifiedBody)},
          ${traditionalBody ? JSON.stringify(traditionalBody) : null}
        )
      `)
      return { updated: true, juanCount: 1 }
    }

    // 有卷标记
    // 检查是否有序言内容（第一个卷之前的内容）
    const hasPreface = simplifiedJuans.length > muluCount

    for (let i = 0; i < simplifiedJuans.length; i++) {
      // 计算卷号
      // 如果有序言，juans[0] 是序言，juans[1] 是第 1 卷
      // 如果没有序言，juans[0] 就是第 1 卷
      let juanNumber: number
      if (hasPreface) {
        if (i === 0) {
          juanNumber = 0  // 序言
        } else {
          juanNumber = i  // 第 1 卷开始
        }
      } else {
        juanNumber = i + 1
      }

      const simplifiedContent = simplifiedJuans[i]
      const traditionalContent = traditionalJuans?.[i] ?? null

      await db.execute(sql`
        INSERT INTO text_juans (text_id, juan, content_simplified, content_traditional)
        VALUES (
          ${textId},
          ${juanNumber},
          ${JSON.stringify(simplifiedContent)},
          ${traditionalContent ? JSON.stringify(traditionalContent) : null}
        )
      `)
    }

    return { updated: true, juanCount: simplifiedJuans.length }
  } catch (error) {
    return { updated: false, juanCount: 0, error: String(error) }
  }
}

/**
 * 获取所有需要处理的文本 ID
 */
async function getAllTextIds(): Promise<string[]> {
  const result = await db.execute(sql`
    SELECT id FROM texts ORDER BY id
  `)
  // postgres-js 返回的是数组，不是 { rows: [] }
  const rows = Array.isArray(result) ? result : (result as any).rows || []
  return rows.map((row: { id: string }) => row.id)
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2)
  const testOnly = args.includes('--test')
  const specificId = args.find(a => !a.startsWith('--'))

  if (specificId) {
    // 处理单个文本
    console.log(`处理单个文本: ${specificId}`)
    const result = await processText(specificId)
    console.log(`结果: ${JSON.stringify(result)}`)

    // 验证
    const dbResult = await db.execute(sql`
      SELECT juan, length(content_simplified::text) as len
      FROM text_juans
      WHERE text_id = ${specificId}
      ORDER BY juan
    `)
    console.log('\n数据库中的记录:')
    for (const row of dbResult.rows as { juan: number, len: number }[]) {
      console.log(`  卷 ${row.juan}: ${row.len} 字符`)
    }

    process.exit(0)
  }

  if (testOnly) {
    // 测试模式：只处理长阿含经
    console.log('测试模式：处理 T01n0001 (长阿含经)')
    const result = await processText('T01n0001')
    console.log(`结果: ${JSON.stringify(result)}`)

    const dbResult = await db.execute(sql`
      SELECT juan, length(content_simplified::text) as len
      FROM text_juans
      WHERE text_id = 'T01n0001'
      ORDER BY juan
    `)
    console.log('\n数据库中的记录:')
    for (const row of dbResult.rows as { juan: number, len: number }[]) {
      console.log(`  卷 ${row.juan}: ${row.len} 字符`)
    }

    process.exit(0)
  }

  // 完整处理
  console.log('开始重新导入所有文本的分卷数据...')

  const textIds = await getAllTextIds()
  console.log(`共 ${textIds.length} 个文本需要处理`)

  let processed = 0
  let updated = 0
  let errors = 0

  for (const textId of textIds) {
    processed++

    if (processed % 100 === 0) {
      console.log(`进度: ${processed}/${textIds.length} (更新: ${updated}, 错误: ${errors})`)
    }

    const result = await processText(textId)

    if (result.updated) {
      updated++
    } else if (result.error) {
      errors++
      if (errors <= 10) {
        console.log(`错误 ${textId}: ${result.error}`)
      }
    }
  }

  console.log(`\n完成! 处理: ${processed}, 更新: ${updated}, 错误: ${errors}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('脚本执行失败:', error)
    process.exit(1)
  })
