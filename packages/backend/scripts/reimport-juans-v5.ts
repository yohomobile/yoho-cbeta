/**
 * 重新从 JSON 文件导入分卷数据到 text_juans 表
 * v5: 使用遍历收集的方法，先标记每个节点的卷归属，然后重建树
 *
 * 核心思路：
 * 1. 先完整遍历一次，记录每个 mulu type="卷" 的位置
 * 2. 对每一卷，从对应的 mulu 位置开始，收集直到下一个 mulu 之前的所有内容
 * 3. 需要正确处理祖先节点的克隆和部分子节点的包含
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

interface NodePosition {
  path: number[]  // 路径数组，如 [22, 23, 177, 0]
}

/**
 * 找到所有 mulu type="卷" 的位置
 */
function findAllMuluPositions(nodes: CbetaNode[]): NodePosition[] {
  const results: NodePosition[] = []

  function traverse(nodes: CbetaNode[], path: number[]) {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      if (typeof node !== 'object' || !node) continue

      const currentPath = [...path, i]

      if (node.tag === 'mulu' && node.attrs?.type === '卷') {
        results.push({ path: currentPath })
      }

      if (node.children) {
        traverse(node.children, currentPath)
      }
    }
  }

  traverse(nodes, [])
  return results
}

/**
 * 根据路径获取节点
 */
function getNodeAtPath(nodes: CbetaNode[], path: number[]): CbetaNode | null {
  let current: CbetaNode[] = nodes
  for (let i = 0; i < path.length - 1; i++) {
    const idx = path[i]
    const node = current[idx]
    if (typeof node !== 'object' || !node || !node.children) {
      return null
    }
    current = node.children
  }
  return current[path[path.length - 1]] ?? null
}

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
 * 提取指定范围的内容
 * startPath: 起始 mulu 的位置（包含）
 * endPath: 结束 mulu 的位置（不包含），如果是 null 则到结尾
 */
function extractRange(
  body: CbetaNode[],
  startPath: number[] | null,
  endPath: number[] | null
): CbetaNode[] {
  // 如果没有起始路径，收集从开头到 endPath 之前的内容
  // 如果没有结束路径，收集从 startPath 到结尾的内容

  const result: CbetaNode[] = []

  /**
   * 递归收集指定范围内的节点
   * 返回: 该层级是否应该继续收集
   */
  function collectRange(
    nodes: CbetaNode[],
    depth: number,
    isCollecting: boolean
  ): { nodes: CbetaNode[], shouldContinue: boolean } {
    const collected: CbetaNode[] = []
    let collecting = isCollecting

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]

      // 检查是否到达起始位置
      if (startPath && !collecting) {
        if (depth < startPath.length && i === startPath[depth]) {
          if (depth === startPath.length - 1) {
            // 到达起始 mulu 节点
            collecting = true
            // 包含这个 mulu 节点
            collected.push(deepClone(node))
            continue
          } else {
            // 需要递归进入
            if (typeof node === 'object' && node?.children) {
              const childResult = collectRange(node.children, depth + 1, false)
              if (childResult.nodes.length > 0) {
                collected.push({
                  ...node,
                  children: childResult.nodes
                })
              }
              collecting = childResult.shouldContinue
              continue
            }
          }
        }
        // 还没到起始位置，跳过
        continue
      }

      // 检查是否到达结束位置
      if (endPath && collecting) {
        if (depth < endPath.length && i === endPath[depth]) {
          if (depth === endPath.length - 1) {
            // 到达结束 mulu 节点，停止收集（不包含这个节点）
            return { nodes: collected, shouldContinue: false }
          } else {
            // 需要递归进入查看
            if (typeof node === 'object' && node?.children) {
              const childResult = collectRange(node.children, depth + 1, true)
              if (childResult.nodes.length > 0) {
                collected.push({
                  ...node,
                  children: childResult.nodes
                })
              }
              if (!childResult.shouldContinue) {
                return { nodes: collected, shouldContinue: false }
              }
              continue
            }
          }
        }
        // 在结束位置之后，但在同一父节点下
        if (depth < endPath.length && i > endPath[depth]) {
          return { nodes: collected, shouldContinue: false }
        }
      }

      // 正在收集中
      if (collecting) {
        collected.push(deepClone(node))
      }
    }

    return { nodes: collected, shouldContinue: collecting }
  }

  // 特殊处理：startPath 为 null 时，从头开始收集
  if (!startPath) {
    const { nodes } = collectRange(body, 0, true)
    return nodes
  }

  const { nodes } = collectRange(body, 0, false)
  return nodes
}

/**
 * 更简单直接的方法：扁平化遍历
 * 遍历整个树，按 mulu type="卷" 分组收集内容
 */
function splitByMuluFlat(body: CbetaNode[]): CbetaNode[][] {
  const juans: CbetaNode[][] = []
  let currentJuanIdx = 0
  juans[0] = []

  // 追踪访问过的节点路径，用于构建结果
  interface VisitorState {
    currentJuan: number
    juanStacks: Map<number, { node: CbetaElement, childrenCollected: CbetaNode[] }[]>
  }

  const state: VisitorState = {
    currentJuan: 0,
    juanStacks: new Map()
  }

  // 初始化第一卷的栈
  state.juanStacks.set(0, [])

  /**
   * 访问节点，维护每一卷的树结构栈
   */
  function visit(
    node: CbetaNode,
    ancestors: { node: CbetaElement, index: number }[]
  ): void {
    if (typeof node === 'string') {
      // 文本节点，添加到当前卷的栈顶
      addToCurrentJuan(node)
      return
    }

    if (!node || typeof node !== 'object') {
      return
    }

    // 检查是否是 mulu type="卷"
    if (node.tag === 'mulu' && node.attrs?.type === '卷') {
      // 结束前一卷的所有打开的祖先节点
      finishCurrentJuan()

      // 开始新卷
      state.currentJuan++
      if (!juans[state.currentJuan]) {
        juans[state.currentJuan] = []
      }
      state.juanStacks.set(state.currentJuan, [])

      // 为新卷创建祖先节点副本
      for (const ancestor of ancestors) {
        const clonedAncestor: CbetaElement = {
          ...ancestor.node,
          children: []
        }
        pushToStack(clonedAncestor)
      }

      // 添加 mulu 节点到新卷
      addToCurrentJuan({
        ...node,
        children: node.children ? node.children.map(c => deepClone(c)) : undefined
      })

      return
    }

    // 普通节点
    if (!node.children || node.children.length === 0) {
      // 无子节点，直接添加
      addToCurrentJuan({
        ...node,
        children: node.children ? [] : undefined
      })
      return
    }

    // 有子节点，需要递归处理
    // 先在当前卷创建这个节点的空壳
    const shell: CbetaElement = {
      ...node,
      children: []
    }
    pushToStack(shell)

    // 递归处理子节点
    const childAncestors = [...ancestors, { node: node, index: ancestors.length }]
    for (const child of node.children) {
      visit(child, childAncestors)
    }

    // 子节点处理完毕，弹出栈顶
    popFromStack()
  }

  function addToCurrentJuan(node: CbetaNode) {
    const stack = state.juanStacks.get(state.currentJuan)!
    if (stack.length === 0) {
      // 直接添加到卷的顶层
      juans[state.currentJuan].push(node)
    } else {
      // 添加到栈顶节点的 children
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
    // 将收集的子节点赋给节点
    top.node.children = top.childrenCollected

    // 将完成的节点添加到父级
    if (stack.length === 0) {
      juans[state.currentJuan].push(top.node)
    } else {
      stack[stack.length - 1].childrenCollected.push(top.node)
    }
  }

  function finishCurrentJuan() {
    // 弹出当前卷栈中所有剩余的节点
    const stack = state.juanStacks.get(state.currentJuan)
    if (!stack) return

    while (stack.length > 0) {
      popFromStack()
    }
  }

  // 开始遍历
  for (const node of body) {
    visit(node, [])
  }

  // 完成最后一卷
  finishCurrentJuan()

  // 过滤空卷
  return juans.filter(j => j && j.length > 0)
}

async function testSplit() {
  console.log('测试 v5 分割算法（扁平遍历）...')

  const testId = 'T01n0001'
  const filePath = path.join(DATA_ROOT, 'T', 'T01', `${testId}.json`)

  const data = JSON.parse(readFileSync(filePath, 'utf-8'))
  const body = data.body as CbetaNode[]

  console.log(`\n${testId} (长阿含经):`)
  console.log(`body 顶层元素数: ${body.length}`)

  const positions = findAllMuluPositions(body)
  console.log(`mulu type=卷 数量: ${positions.length}`)

  const juans = splitByMuluFlat(body)
  console.log(`拆分后卷数: ${juans.length}`)

  juans.forEach((j, i) => {
    const textLength = JSON.stringify(j).length
    console.log(`卷 ${i + 1}: ${j.length} 个顶层元素, JSON长度: ${textLength}`)
  })

  // 验证：检查每卷是否包含对应的 mulu
  console.log('\n验证每卷的 mulu:')
  for (let i = 1; i < juans.length && i <= 5; i++) {
    const juan = juans[i]
    const hasMulu = checkForMulu(juan)
    console.log(`卷 ${i + 1}: 包含 mulu = ${hasMulu}`)
  }
}

function checkForMulu(nodes: CbetaNode[]): boolean {
  for (const node of nodes) {
    if (typeof node === 'object' && node) {
      if (node.tag === 'mulu' && node.attrs?.type === '卷') {
        return true
      }
      if (node.children && checkForMulu(node.children)) {
        return true
      }
    }
  }
  return false
}

// 运行测试
testSplit()
  .then(() => {
    console.log('\n测试完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('脚本执行失败:', error)
    process.exit(1)
  })
