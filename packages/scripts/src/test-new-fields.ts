import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

function getAllJsonFiles(dir: string): string[] {
  const files: string[] = []
  const items = readdirSync(dir)
  for (const item of items) {
    const fullPath = join(dir, item)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      files.push(...getAllJsonFiles(fullPath))
    } else if (item.endsWith('.json') && !item.startsWith('.') && item !== '.cache.json') {
      files.push(fullPath)
    }
  }
  return files
}

const files = getAllJsonFiles("/home/guang/happy/yoho-cbeta/parsed")

let stats = {
  titleTraditional: { filled: 0, empty: 0 },
  sourceText: { filled: 0, empty: 0 },
  categoryId: { filled: 0, empty: 0 },
}

for (const f of files) {
  const content = JSON.parse(readFileSync(f, "utf-8"))

  if (content.titleTraditional && content.titleTraditional.trim() !== '') {
    stats.titleTraditional.filled++
  } else {
    stats.titleTraditional.empty++
  }

  if (content.sourceText) {
    stats.sourceText.filled++
  } else {
    stats.sourceText.empty++
  }

  if (content.categoryId) {
    stats.categoryId.filled++
  } else {
    stats.categoryId.empty++
  }
}

const total = files.length
console.log("Total files:", total)
console.log("\n【新增字段覆盖率】")
console.log("titleTraditional:", stats.titleTraditional.filled, `(${(stats.titleTraditional.filled/total*100).toFixed(1)}%)`)
console.log("sourceText:", stats.sourceText.filled, `(${(stats.sourceText.filled/total*100).toFixed(1)}%)`)
console.log("categoryId:", stats.categoryId.filled, `(${(stats.categoryId.filled/total*100).toFixed(1)}%)`)

// Show sample
console.log("\n【Sample】")
const sample = JSON.parse(readFileSync(files[0], "utf-8"))
console.log("title:", sample.title)
console.log("titleTraditional:", sample.titleTraditional)
console.log("sourceText:", sample.sourceText)
console.log("categoryId:", sample.categoryId)
