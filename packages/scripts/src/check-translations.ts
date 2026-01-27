import * as fs from 'fs'
import * as path from 'path'

const relationships = JSON.parse(fs.readFileSync('/home/guang/happy/yoho-cbeta/relationships.json', 'utf-8'))

console.log('========================================')
console.log('同经异译疏漏检查')
console.log('========================================')

console.log('\n同经异译统计:')
console.log('  翻译组数:', relationships.translations.length)

let totalSutras = 0
const inGroupIds = new Set<string>()
for (const group of relationships.translations) {
  totalSutras += group.sutras.length
  for (const sutra of group.sutras) {
    inGroupIds.add(sutra.id)
  }
}
console.log('  涉及经典总数:', totalSutras)
console.log('  不重复经典ID数:', inGroupIds.size)

// 检查是否有遗漏的 Nos. 引用
const dataDir = '/home/guang/happy/yoho-cbeta/data-simplified'

interface CbetaElement {
  tag: string
  attrs?: Record<string, string>
  children?: (CbetaElement | string)[]
}

function extractText(el: CbetaElement | string): string {
  if (typeof el === 'string') return el
  if (el.children) return el.children.map(extractText).join('')
  return ''
}

function findElements(elements: (CbetaElement | string)[], predicate: (el: CbetaElement) => boolean): CbetaElement[] {
  const results: CbetaElement[] = []
  function search(arr: (CbetaElement | string)[]) {
    for (const el of arr) {
      if (typeof el === 'object' && el !== null) {
        if (predicate(el)) results.push(el)
        if (el.children) search(el.children)
      }
    }
  }
  search(elements)
  return results
}

const canonDir = path.join(dataDir, 'T')
const vols = fs.readdirSync(canonDir).filter(v => fs.statSync(path.join(canonDir, v)).isDirectory())

let filesWithNos = 0
let processedNos = 0
let unprocessedNos = 0
const sampleUnprocessed: { id: string; docNumber: string }[] = []
const sampleWithParens: { id: string; docNumber: string }[] = []

for (const vol of vols) {
  const volDir = path.join(canonDir, vol)
  const files = fs.readdirSync(volDir).filter(f => f.endsWith('.json'))

  for (const file of files) {
    const filePath = path.join(volDir, file)
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

    const docNumbers = findElements(data.body, el => el.tag === 'docNumber')
    if (docNumbers.length === 0) continue

    const docNumberText = extractText(docNumbers[0]).trim()
    
    // 检查 Nos. 格式（同经异译标记）
    if (docNumberText.match(/\[Nos\.\s/)) {
      filesWithNos++

      if (inGroupIds.has(data.id)) {
        processedNos++
      } else {
        unprocessedNos++
        
        // 检查是否是带括号的引用（表示品级引用）
        if (docNumberText.match(/\[Nos\.\s*\d+\(/)) {
          if (sampleWithParens.length < 5) {
            sampleWithParens.push({ id: data.id, docNumber: docNumberText.substring(0, 80) })
          }
        } else if (sampleUnprocessed.length < 10) {
          sampleUnprocessed.push({ id: data.id, docNumber: docNumberText.substring(0, 80) })
        }
      }
    }
  }
}

console.log('\n=== T 藏 Nos. 引用检查 ===')
console.log('有 Nos. 引用的文件数:', filesWithNos)
console.log('已在翻译组中:', processedNos)
console.log('未在翻译组中:', unprocessedNos)

if (sampleUnprocessed.length > 0) {
  console.log('\n未处理的样本（普通格式）:')
  for (const s of sampleUnprocessed) {
    console.log('  ' + s.id + ': ' + s.docNumber)
  }
}

if (sampleWithParens.length > 0) {
  console.log('\n带括号的引用（品级引用）:')
  for (const s of sampleWithParens) {
    console.log('  ' + s.id + ': ' + s.docNumber)
  }
}

// 按组大小分类
const sizeCounts: Record<number, number> = {}
for (const group of relationships.translations) {
  const size = group.sutras.length
  sizeCounts[size] = (sizeCounts[size] || 0) + 1
}
console.log('\n组大小分布:')
for (const [size, count] of Object.entries(sizeCounts).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
  console.log('  ' + size + ' 部: ' + count + ' 组')
}
