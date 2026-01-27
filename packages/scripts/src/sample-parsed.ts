/**
 * 抽样查看解析结果
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
  canonId: string
  title: string
  titleSource: string
  bylineRaw: string | null
  toc: any[]
  hasDharani: boolean
  hasVerse: boolean
  juanCount: number
  pageStart: string | null
  pageEnd: string | null
}

function sample<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

async function main() {
  const projectRoot = join(import.meta.dirname, '../../..')
  const parsedDir = join(projectRoot, 'parsed')
  const files = getAllJsonFiles(parsedDir)

  // 从命令行参数获取数量，默认 20
  const count = parseInt(process.argv[2] || '20', 10)
  const sampled = sample(files, count)

  console.log(`=== 随机抽样 ${count} 个文件 ===\n`)

  for (const file of sampled) {
    const data: ParsedData = JSON.parse(readFileSync(file, 'utf-8'))
    const line = '─'.repeat(60)
    console.log(line)
    console.log(`ID: ${data.id}`)
    console.log(`标题: ${data.title}`)
    console.log(`来源: ${data.titleSource}`)
    console.log(`卷数: ${data.juanCount}`)

    const byline = data.bylineRaw
    if (byline) {
      const short = byline.length > 80 ? byline.slice(0, 80) + '...' : byline
      console.log(`byline: ${short}`)
    } else {
      console.log(`byline: (无)`)
    }

    console.log(`目录条目: ${data.toc.length} 条`)

    let features = ''
    if (data.hasDharani) features += '陀罗尼 '
    if (data.hasVerse) features += '偈颂'
    if (!features) features = '普通'
    console.log(`特征: ${features}`)
    console.log('')
  }
}

main().catch(console.error)
