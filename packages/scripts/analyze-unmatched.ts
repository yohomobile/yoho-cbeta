import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

function getAllJsonFiles(dir: string): string[] {
  const files: string[] = []
  function traverse(currentDir: string) {
    const entries = readdirSync(currentDir)
    for (const entry of entries) {
      const fullPath = join(currentDir, entry)
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        traverse(fullPath)
      } else if (entry.endsWith('.json') && entry.includes('.parse-cache') === false) {
        files.push(fullPath)
      }
    }
  }
  traverse(dir)
  return files
}

const parsedDir = join(process.cwd(), '..', '..', 'parsed')
const files = getAllJsonFiles(parsedDir)

// 构建标题索引
const titleIndex = new Map<string, string>()
for (const file of files) {
  const meta = JSON.parse(readFileSync(file, 'utf-8'))
  if (meta.title) {
    const normalizedTitle = meta.title.replace(/\s+/g, '').replace(/[（）()]/g, '')
    titleIndex.set(normalizedTitle, meta.id)
  }
}

// 模拟 shortToFullNames
const shortToFullNames: Record<string, string[]> = {
  '大智度论疏': ['大智度初序品中缘起义释论第一'],
  '大智度论': ['大智度初序品中缘起义释论第一'],
  '大智度': ['大智度初序品中缘起义释论第一'],
}

// 模拟 findTargetSutra
function findTargetSutra(shortName: string): string | null {
  console.log('  findTargetSutra(' + shortName + ')')

  // 1. 直接查找
  let targetId = titleIndex.get(shortName)
  console.log('    1. 直接查找:', targetId)
  if (targetId) return targetId

  // 2. 尝试简称映射
  const fullNames = shortToFullNames[shortName]
  console.log('    2. 简称映射:', fullNames)
  if (fullNames) {
    for (const fullName of fullNames) {
      targetId = titleIndex.get(fullName)
      console.log('      尝试 ' + fullName + ':', targetId)
      if (targetId) return targetId
    }
  }

  return null
}

// 测试
const title = '大智度论疏'
console.log('标题:', title)

// 提取经名
const pattern = /^(.+论)疏/
const match = title.match(pattern)
if (match) {
  const possibleTarget = match[1]
  console.log('提取的经名:', possibleTarget)

  const result = findTargetSutra(possibleTarget)
  console.log('结果:', result)
}
