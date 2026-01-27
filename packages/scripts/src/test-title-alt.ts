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
let withAlt = 0
let samples = []

for (const f of files) {
  const content = JSON.parse(readFileSync(f, "utf-8"))
  if (content.titleAlt) {
    withAlt++
    if (samples.length < 10) {
      samples.push({id: content.id, title: content.title, titleAlt: content.titleAlt})
    }
  }
}

console.log("Total files:", files.length)
console.log("Files with titleAlt:", withAlt, `(${(withAlt/files.length*100).toFixed(2)}%)`)
console.log("Samples:", JSON.stringify(samples, null, 2))
