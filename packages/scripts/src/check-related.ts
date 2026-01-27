import * as fs from 'fs'
import * as path from 'path'

const relationships = JSON.parse(fs.readFileSync('/home/guang/happy/yoho-cbeta/relationships.json', 'utf-8'))

// 统计相关经典
let totalRelated = 0
let sutrasWithRelated = 0
const relatedIds = new Set<string>()

for (const [sutraId, data] of Object.entries(relationships.commentaries as Record<string, any>)) {
  if (data.relatedSutras && data.relatedSutras.length > 0) {
    sutrasWithRelated++
    totalRelated += data.relatedSutras.length
    for (const rel of data.relatedSutras) {
      relatedIds.add(rel.id)
    }
  }
}

console.log('========================================')
console.log('相关经典疏漏检查')
console.log('========================================')
console.log('\n相关经典统计:')
console.log('  有相关经典的原经数:', sutrasWithRelated)
console.log('  相关经典总数:', totalRelated)
console.log('  不重复的相关经典ID数:', relatedIds.size)

// 检查是否有遗漏的 cf. 引用
const dataDir = '/home/guang/happy/yoho-cbeta/data-simplified'
const canons = fs.readdirSync(dataDir).filter(d => fs.statSync(path.join(dataDir, d)).isDirectory())

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

let filesWithCf = 0
let processedCf = 0
let unprocessedCf = 0
const sampleUnprocessed: { id: string; docNumber: string }[] = []

for (const canon of ['T'].slice(0, 1)) {  // 只检查 T 藏
  const canonDir = path.join(dataDir, canon)
  const vols = fs.readdirSync(canonDir).filter(v => fs.statSync(path.join(canonDir, v)).isDirectory())

  for (const vol of vols) {
    const volDir = path.join(canonDir, vol)
    const files = fs.readdirSync(volDir).filter(f => f.endsWith('.json'))

    for (const file of files) {
      const filePath = path.join(volDir, file)
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

      const docNumbers = findElements(data.body, el => el.tag === 'docNumber')
      if (docNumbers.length === 0) continue

      const docNumberText = extractText(docNumbers[0]).trim()
      if (!docNumberText.includes('cf.')) continue

      filesWithCf++

      // 检查此文件是否在相关经典中
      let isProcessed = relatedIds.has(data.id)
      
      // 也检查作为原经
      if (relationships.commentaries[data.id]?.relatedSutras?.length > 0) {
        isProcessed = true
      }

      if (isProcessed) {
        processedCf++
      } else {
        unprocessedCf++
        if (sampleUnprocessed.length < 10) {
          sampleUnprocessed.push({ id: data.id, docNumber: docNumberText.substring(0, 80) })
        }
      }
    }
  }
}

console.log('\n=== T 藏 cf. 引用检查 ===')
console.log('有 cf. 引用的文件数:', filesWithCf)
console.log('已处理的:', processedCf)
console.log('未处理的:', unprocessedCf)

if (sampleUnprocessed.length > 0) {
  console.log('\n未处理的样本:')
  for (const s of sampleUnprocessed) {
    console.log('  ' + s.id + ': ' + s.docNumber)
  }
}
