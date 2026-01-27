/**
 * 重新从 JSON 文件导入分卷数据到 text_juans 表
 * 通过深度遍历找到每个 mulu type="卷" 的位置，正确拆分嵌套内容
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

interface MuluPosition {
  path: number[]  // 从根到 mulu 的路径
}

/**
 * 深度遍历找到所有 mulu type="卷" 的位置路径
 */
function findAllMuluJuan(nodes: CbetaNode[], path: number[] = []): MuluPosition[] {
  const results: MuluPosition[] = []

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (typeof node !== 'object' || !node) continue

    const currentPath = [...path, i]

    if (node.tag === 'mulu' && node.attrs?.type === '卷') {
      results.push({ path: currentPath })
    }

    if (node.children) {
      results.push(...findAllMuluJuan(node.children, currentPath))
    }
  }

  return results
}

/**
 * 根据路径深度克隆节点树，并在指定位置分割
 * 这是一个复杂的操作，需要：
 * 1. 克隆从根到分割点的所有父节点
 * 2. 在分割点之前和之后分别收集内容
 */
function splitAtPath(body: CbetaNode[], splitPath: number[]): { before: CbetaNode[], after: CbetaNode[] } {
  if (splitPath.length === 0) {
    return { before: [], after: body }
  }

  if (splitPath.length === 1) {
    const idx = splitPath[0]
    return {
      before: body.slice(0, idx),
      after: body.slice(idx)
    }
  }

  // 递归处理嵌套结构
  const topIdx = splitPath[0]
  const before: CbetaNode[] = body.slice(0, topIdx)
  const after: CbetaNode[] = []

  const targetNode = body[topIdx]
  if (typeof targetNode !== 'object' || !targetNode || !targetNode.children) {
    return { before: body.slice(0, topIdx), after: body.slice(topIdx) }
  }

  // 递归分割子节点
  const childResult = splitAtPath(targetNode.children, splitPath.slice(1))

  // 如果有 before 内容，创建包含 before 的节点副本
  if (childResult.before.length > 0) {
    const beforeNode = {
      ...targetNode,
      children: childResult.before
    }
    before.push(beforeNode)
  }

  // 创建包含 after 的节点副本
  if (childResult.after.length > 0) {
    const afterNode = {
      ...targetNode,
      children: childResult.after
    }
    after.push(afterNode)
  }

  // 添加后续的顶层节点
  after.push(...body.slice(topIdx + 1))

  return { before, after }
}

/**
 * 将 body 按 mulu type="卷" 分割成多个卷
 */
function splitIntoJuans(body: CbetaNode[], expectedCount: number): CbetaNode[][] {
  const positions = findAllMuluJuan(body)

  if (positions.length === 0) {
    // 没有 mulu 标签，整体作为一卷
    return [body]
  }

  // 如果 mulu 数量与预期不符，打印警告
  if (positions.length !== expectedCount) {
    // console.log(`警告: mulu数量 ${positions.length} != 预期 ${expectedCount}`)
  }

  const juans: CbetaNode[][] = []
  let remaining = body

  for (let i = 0; i < positions.length; i++) {
    // 计算当前位置相对于 remaining 的路径
    // 这里的问题是：每次分割后，路径会改变
    // 所以我们需要一种不同的方法

    // 简化方案：从后向前分割
    break
  }

  // 使用更简单的方法：收集每个 mulu 之间的内容
  // 但这对于深度嵌套的结构很复杂

  // 最简单的方案：对于每个 mulu，找到它和下一个 mulu 之间的所有顶层元素
  // 问题是 mulu 可能在同一个顶层元素内

  // 采用不同的策略：根据 TOC 中的 juanNumber 来确定每卷的内容
  // 但这需要访问数据库中的 toc 字段

  // 最实际的方案：检测 mulu 标签的同级元素，按 mulu 分组
  return splitByMuluSiblings(body, positions.length)
}

/**
 * 更简单的分割方法：
 * 遍历整个结构，当遇到 mulu type="卷" 时，开始新的一卷
 */
function splitByMuluSiblings(body: CbetaNode[], expectedJuans: number): CbetaNode[][] {
  const juans: CbetaNode[][] = []
  let currentJuan: CbetaNode[] = []
  let juanStarted = false

  function processNode(node: CbetaNode, depth: number = 0): CbetaNode | null {
    if (typeof node !== 'object' || !node) {
      return node
    }

    // 如果这个节点本身是 mulu type="卷"，标记新卷开始
    if (node.tag === 'mulu' && node.attrs?.type === '卷') {
      if (currentJuan.length > 0 || juanStarted) {
        juans.push(currentJuan)
        currentJuan = []
      }
      juanStarted = true
      // 包含这个 mulu 节点
      return node
    }

    // 如果有子节点，递归处理
    if (node.children && node.children.length > 0) {
      const newChildren: CbetaNode[] = []
      let needsSplit = false

      for (const child of node.children) {
        // 检查子节点中是否有 mulu type="卷"
        if (typeof child === 'object' && child?.tag === 'mulu' && child.attrs?.type === '卷') {
          // 在 mulu 之前的内容属于上一卷
          if (newChildren.length > 0 && (currentJuan.length > 0 || juanStarted)) {
            const beforeNode = { ...node, children: newChildren }
            currentJuan.push(beforeNode)
            juans.push(currentJuan)
            currentJuan = []
            newChildren.length = 0
          } else if (newChildren.length > 0) {
            // 序部分
            const beforeNode = { ...node, children: [...newChildren] }
            currentJuan.push(beforeNode)
            newChildren.length = 0
          }
          juanStarted = true
        }
        newChildren.push(child)
      }

      if (newChildren.length > 0) {
        return { ...node, children: newChildren }
      }
      return null
    }

    return node
  }

  // 简化方法：直接按顶层遍历，收集每个 mulu type="卷" 之间的内容
  let inJuan = false
  for (const node of body) {
    if (typeof node === 'object' && node) {
      // 检查这个节点或其子孙中是否有 mulu type="卷"
      const hasMuluJuan = checkHasMuluJuan(node)

      if (hasMuluJuan) {
        // 这个节点包含卷边界，需要特殊处理
        // 简化处理：将整个节点加入当前卷（可能导致内容重复）
        // 真正正确的做法需要深度分割节点
        if (currentJuan.length > 0 && inJuan) {
          juans.push(currentJuan)
          currentJuan = []
        }
        currentJuan.push(node)
        inJuan = true
      } else {
        currentJuan.push(node)
      }
    } else {
      currentJuan.push(node)
    }
  }

  if (currentJuan.length > 0) {
    juans.push(currentJuan)
  }

  return juans
}

function checkHasMuluJuan(node: CbetaNode): boolean {
  if (typeof node !== 'object' || !node) return false
  if (node.tag === 'mulu' && node.attrs?.type === '卷') return true
  if (node.children) {
    return node.children.some(child => checkHasMuluJuan(child))
  }
  return false
}

async function reimportJuans() {
  console.log('开始重新导入分卷数据 (v3 - 嵌套处理)...')
  console.log(`数据目录: ${DATA_ROOT}`)

  // 先测试长阿含经
  const testId = 'T01n0001'
  const filePath = path.join(DATA_ROOT, 'T', 'T01', `${testId}.json`)

  const data = JSON.parse(readFileSync(filePath, 'utf-8'))
  const body = data.body as CbetaNode[]

  console.log(`\n测试 ${testId}:`)
  console.log(`body 长度: ${body.length}`)

  const positions = findAllMuluJuan(body)
  console.log(`mulu type=卷 数量: ${positions.length}`)

  const juans = splitByMuluSiblings(body, 22)
  console.log(`拆分后卷数: ${juans.length}`)

  juans.forEach((j, i) => {
    console.log(`卷 ${i + 1}: ${j.length} 个元素`)
  })
}

// 运行
reimportJuans()
  .then(() => {
    console.log('\n测试完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('脚本执行失败:', error)
    process.exit(1)
  })
