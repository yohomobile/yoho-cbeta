import { readdirSync, statSync, readFileSync } from 'fs'
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

const parsedDir = '/home/guang/happy/yoho-cbeta/parsed'
const dataDir = '/home/guang/happy/yoho-cbeta/data-simplified'
const files = getAllJsonFiles(parsedDir)

const divTypes: Record<string, number> = {}
const missingContentTypeWithDiv: { id: string; divTypes: string[] }[] = []
const noDivAtAll: string[] = []

for (const file of files) {
  try {
    const parsedContent = readFileSync(file, 'utf-8')
    const parsed = JSON.parse(parsedContent)
    
    if (!parsed.contentType) {
      const relPath = file.replace(parsedDir + '/', '')
      const sourceFile = join(dataDir, relPath)
      
      try {
        const sourceContent = readFileSync(sourceFile, 'utf-8')
        const source = JSON.parse(sourceContent)
        
        const divs = source.body?.filter((el: any) => typeof el === 'object' && el.tag === 'div' && el.attrs?.type) || []
        const types = [...new Set(divs.map((d: any) => d.attrs.type))]
        
        if (types.length > 0) {
          for (const t of types) {
            divTypes[t] = (divTypes[t] || 0) + 1
          }
          if (missingContentTypeWithDiv.length < 15) {
            missingContentTypeWithDiv.push({ id: parsed.id, divTypes: types })
          }
        } else {
          noDivAtAll.push(parsed.id)
        }
      } catch (e) {}
    }
  } catch (e) {}
}

console.log('=== contentType 缺失原因分析 ===\n')
console.log('缺失总数: 1141\n')

console.log('【div.type 分布（所有文件）】')
const sorted = Object.entries(divTypes).sort((a, b) => (b[1] as number) - (a[1] as number))
for (const [type, count] of sorted.slice(0, 20)) {
  console.log('  ' + type + ': ' + count)
}

console.log('\n【缺失 contentType 但有 div.type 的样本】')
for (const item of missingContentTypeWithDiv) {
  console.log('  ' + item.id + ': ' + item.divTypes.join(', '))
}

console.log('\n【完全没有 div 的文件数】: ' + noDivAtAll.length)
console.log('样本: ' + noDivAtAll.slice(0, 10).join(', '))
