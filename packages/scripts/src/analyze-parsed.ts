/**
 * 分析解析结果统计
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

function getAllJsonFiles(dir: string): string[] {
  const files: string[] = []
  const items = readdirSync(dir)
  for (const item of items) {
    const fullPath = join(dir, item)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      files.push(...getAllJsonFiles(fullPath))
    } else if (item.endsWith('.json') && !item.startsWith('.')) {
      files.push(fullPath)
    }
  }
  return files
}

interface ParsedData {
  id: string
  title: string
  titleSource: 'jhead' | 'head' | 'filename'
  bylineRaw: string | null
  toc: any[]
  hasDharani: boolean
  hasVerse: boolean
  juanCount: number
  pageStart: string | null
}

async function main() {
  const projectRoot = join(import.meta.dirname, '../../..')
  const parsedDir = join(projectRoot, 'parsed')
  const files = getAllJsonFiles(parsedDir)

  const stats = {
    total: 0,
    titleFromJhead: 0,
    titleFromHead: 0,
    titleFromFilename: 0,
    hasTitle: 0,
    hasByline: 0,
    hasToc: 0,
    hasDharani: 0,
    hasVerse: 0,
    multiJuan: 0,
    hasPageRange: 0,
  }

  const emptyTitles: string[] = []
  const noBylines: string[] = []

  for (const file of files) {
    const data: ParsedData = JSON.parse(readFileSync(file, 'utf-8'))
    stats.total++

    if (data.titleSource === 'jhead') stats.titleFromJhead++
    else if (data.titleSource === 'head') stats.titleFromHead++
    else stats.titleFromFilename++

    if (data.title && data.title !== data.id) {
      stats.hasTitle++
    } else {
      emptyTitles.push(data.id)
    }

    if (data.bylineRaw) stats.hasByline++
    else noBylines.push(data.id)

    if (data.toc && data.toc.length > 0) stats.hasToc++
    if (data.hasDharani) stats.hasDharani++
    if (data.hasVerse) stats.hasVerse++
    if (data.juanCount > 1) stats.multiJuan++
    if (data.pageStart) stats.hasPageRange++
  }

  const pct = (n: number) => (n / stats.total * 100).toFixed(1)

  console.log('=== 解析结果统计 ===\n')
  console.log(`总文件数: ${stats.total}`)
  console.log('')
  console.log('【标题提取】')
  console.log(`  从 jhead 提取: ${stats.titleFromJhead} (${pct(stats.titleFromJhead)}%)`)
  console.log(`  从 head 提取:  ${stats.titleFromHead} (${pct(stats.titleFromHead)}%)`)
  console.log(`  使用文件名:    ${stats.titleFromFilename} (${pct(stats.titleFromFilename)}%)`)
  console.log(`  有效标题:      ${stats.hasTitle} (${pct(stats.hasTitle)}%)`)
  console.log('')
  console.log('【其他字段】')
  console.log(`  有 byline:     ${stats.hasByline} (${pct(stats.hasByline)}%)`)
  console.log(`  有 toc:        ${stats.hasToc} (${pct(stats.hasToc)}%)`)
  console.log(`  有页码范围:    ${stats.hasPageRange} (${pct(stats.hasPageRange)}%)`)
  console.log(`  多卷经典:      ${stats.multiJuan} (${pct(stats.multiJuan)}%)`)
  console.log('')
  console.log('【内容特征】')
  console.log(`  含陀罗尼:      ${stats.hasDharani} (${pct(stats.hasDharani)}%)`)
  console.log(`  含偈颂:        ${stats.hasVerse} (${pct(stats.hasVerse)}%)`)
  console.log('')

  if (emptyTitles.length > 0 && emptyTitles.length <= 30) {
    console.log(`【无标题文件】共 ${emptyTitles.length} 个`)
    emptyTitles.forEach(id => console.log(`  - ${id}`))
    console.log('')
  } else if (emptyTitles.length > 30) {
    console.log(`【无标题文件】共 ${emptyTitles.length} 个 (前30个)`)
    emptyTitles.slice(0, 30).forEach(id => console.log(`  - ${id}`))
    console.log('')
  }

  console.log(`【无 byline 文件】共 ${noBylines.length} 个`)
  if (noBylines.length <= 30) {
    noBylines.forEach(id => console.log(`  - ${id}`))
  } else {
    console.log('前30个:')
    noBylines.slice(0, 30).forEach(id => console.log(`  - ${id}`))
  }
}

main().catch(console.error)
