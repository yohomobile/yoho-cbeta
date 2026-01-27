/**
 * 重新从 JSON 文件导入分卷数据到 text_juans 表
 * v4: 使用深拷贝和标记的方法处理嵌套结构
 *
 * 算法思路：
 * 1. 深度遍历整个树，为每个节点标记它属于哪一卷
 * 2. 然后根据标记重建每一卷的树结构
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

// 带卷号标记的节点
type MarkedNode = {
  node: CbetaNode
  juanNumber: number
}

const DATA_ROOT = path.resolve(process.cwd(), '..', '..', 'data-simplified')
const DATA_TRAD_ROOT = path.resolve(process.cwd(), '..', '..', 'data-traditional')

/**
 * 遍历节点树，收集所有 mulu type="卷" 的标题（用于确定卷号）
 */
function collectMuluJuanTitles(nodes: CbetaNode[]): string[] {
  const titles: string[] = []

  function traverse(node: CbetaNode) {
    if (typeof node !== 'object' || !node) return

    if (node.tag === 'mulu' && node.attrs?.type === '卷') {
      const title = node.children?.[0]
      if (typeof title === 'string') {
        titles.push(title)
      } else {
        titles.push('')
      }
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

  return titles
}

/**
 * 将节点数组按卷分割
 * 返回每卷的节点数组
 */
function splitByJuan(nodes: CbetaNode[], expectedCount: number): CbetaNode[][] {
  // 使用一个标记数组来跟踪当前卷号
  let currentJuan = 0
  const juanContents: CbetaNode[][] = []

  // 初始化第一卷（如果有序言内容）
  juanContents[0] = []

  /**
   * 深度克隆节点，同时处理卷边界
   * 返回 [当前卷的节点, 后续卷的节点数组]
   */
  function processNode(node: CbetaNode): CbetaNode | null {
    if (typeof node === 'string') {
      return node
    }

    if (!node || typeof node !== 'object') {
      return node
    }

    // 如果是 mulu type="卷"，标记新卷开始
    if (node.tag === 'mulu' && node.attrs?.type === '卷') {
      currentJuan++
      if (!juanContents[currentJuan]) {
        juanContents[currentJuan] = []
      }
      // mulu 节点本身属于新卷
      return { ...node, children: node.children ? [...node.children] : undefined }
    }

    // 如果没有子节点，直接返回副本
    if (!node.children || node.children.length === 0) {
      return { ...node, children: node.children ? [] : undefined }
    }

    // 检查子节点中是否包含 mulu type="卷"
    const hasMuluInChildren = checkHasMuluJuan(node)

    if (!hasMuluInChildren) {
      // 没有卷边界，深拷贝整个节点
      return deepClone(node)
    }

    // 有卷边界，需要分割处理
    // 记录开始时的卷号
    const startJuan = currentJuan
    const resultForStartJuan: CbetaNode[] = []

    // 用于跟踪每个卷在这个层级产生的子节点
    const juanChildren: Map<number, CbetaNode[]> = new Map()
    juanChildren.set(startJuan, [])

    for (const child of node.children) {
      const juanBeforeChild = currentJuan
      const processedChild = processNode(child)

      if (processedChild !== null) {
        // 如果处理过程中卷号变化了，说明遇到了卷边界
        if (currentJuan !== juanBeforeChild) {
          // 子节点属于新卷
          if (!juanChildren.has(currentJuan)) {
            juanChildren.set(currentJuan, [])
          }
          juanChildren.get(currentJuan)!.push(processedChild)
        } else {
          // 还在同一卷
          if (!juanChildren.has(currentJuan)) {
            juanChildren.set(currentJuan, [])
          }
          juanChildren.get(currentJuan)!.push(processedChild)
        }
      }
    }

    // 为每个卷创建包含该卷子节点的父节点副本
    const sortedJuans = Array.from(juanChildren.keys()).sort((a, b) => a - b)

    for (const juan of sortedJuans) {
      const children = juanChildren.get(juan)!
      if (children.length > 0) {
        const nodeForJuan: CbetaElement = {
          ...node,
          children: children
        }

        if (juan === startJuan) {
          // 返回给调用者，会被添加到 startJuan
          // 但我们需要确保后续卷的节点被正确添加到 juanContents
        } else {
          // 添加到对应卷的内容中
          if (!juanContents[juan]) {
            juanContents[juan] = []
          }
          juanContents[juan].push(nodeForJuan)
        }
      }
    }

    // 返回 startJuan 的节点（如果有的话）
    const startJuanChildren = juanChildren.get(startJuan)
    if (startJuanChildren && startJuanChildren.length > 0) {
      return {
        ...node,
        children: startJuanChildren
      }
    }

    return null
  }

  // 处理所有顶层节点
  for (const node of nodes) {
    const juanBefore = currentJuan
    const processed = processNode(node)

    if (processed !== null) {
      // 确保当前卷的数组存在
      if (!juanContents[juanBefore]) {
        juanContents[juanBefore] = []
      }

      // 如果处理后卷号没变，添加到处理前的卷
      // 如果卷号变了，processed 是新卷的第一个节点（或包含边界的节点的起始部分）
      if (currentJuan === juanBefore) {
        juanContents[juanBefore].push(processed)
      } else {
        // 节点可能跨越了卷边界
        // processed 是原卷的部分（如果有的话）
        juanContents[juanBefore].push(processed)
      }
    }
  }

  // 过滤掉空的卷
  const result = juanContents.filter(content => content && content.length > 0)

  return result
}

function checkHasMuluJuan(node: CbetaNode): boolean {
  if (typeof node !== 'object' || !node) return false
  if (node.tag === 'mulu' && node.attrs?.type === '卷') return true
  if (node.children) {
    return node.children.some(child => checkHasMuluJuan(child))
  }
  return false
}

function deepClone(node: CbetaNode): CbetaNode {
  if (typeof node === 'string') return node
  if (!node || typeof node !== 'object') return node

  const cloned: CbetaElement = { ...node }
  if (node.children) {
    cloned.children = node.children.map(child => deepClone(child))
  }
  return cloned
}

async function testSplit() {
  console.log('测试分割算法...')

  const testId = 'T01n0001'
  const filePath = path.join(DATA_ROOT, 'T', 'T01', `${testId}.json`)

  const data = JSON.parse(readFileSync(filePath, 'utf-8'))
  const body = data.body as CbetaNode[]

  console.log(`\n${testId} (长阿含经):`)
  console.log(`body 顶层元素数: ${body.length}`)

  const titles = collectMuluJuanTitles(body)
  console.log(`mulu type=卷 数量: ${titles.length}`)
  console.log(`卷标题: ${titles.slice(0, 5).join(', ')}...`)

  const juans = splitByJuan(body, 22)
  console.log(`拆分后卷数: ${juans.length}`)

  juans.forEach((j, i) => {
    // 统计每卷的元素数和大致内容
    const elementCount = j.length
    const textLength = JSON.stringify(j).length
    console.log(`卷 ${i + 1}: ${elementCount} 个顶层元素, JSON长度: ${textLength}`)
  })
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
