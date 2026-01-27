import * as fs from 'fs'
import * as path from 'path'

// 遗漏的注疏列表
const missing = [
  { id: 'T18n0855', title: '青龙寺轨记', expected: '仪轨' },
  { id: 'T19n0958', title: '金刚顶经一字顶轮王仪轨音义', expected: '金刚顶经一字顶轮王仪轨' },
  { id: 'T20n1088', title: '如意轮菩萨观门义注秘诀', expected: '如意轮' },
  { id: 'T45n1879b', title: '华严关脉义记', expected: '华严经' },
  { id: 'T54n2128', title: '一切经音义', expected: '多部经' },
  { id: 'T54n2129', title: '续一切经音义', expected: '多部经' },
  { id: 'T85n2788', title: '律戒本疏', expected: '律' },
  { id: 'T85n2789', title: '律戒本疏', expected: '律' },
]

// 读取所有T藏元数据
const dataDir = '/home/guang/happy/yoho-cbeta/data-simplified/T'
const vols = fs.readdirSync(dataDir).filter(v => fs.statSync(path.join(dataDir, v)).isDirectory())

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

// 搜索可能的原经
const sutraPatterns = [
  { pattern: '仪轨', desc: '密教仪轨' },
  { pattern: '金刚顶', desc: '金刚顶经相关' },
  { pattern: '如意轮', desc: '如意轮相关' },
  { pattern: '华严', desc: '华严相关' },
  { pattern: '律', desc: '律藏相关' },
  { pattern: '戒本', desc: '戒本相关' },
]

console.log('=== 搜索可能的原经 ===\n')

for (const { pattern, desc } of sutraPatterns) {
  console.log(`\n### ${desc} (${pattern}) ###`)
  let count = 0
  for (const vol of vols) {
    const volDir = path.join(dataDir, vol)
    const files = fs.readdirSync(volDir).filter(f => f.endsWith('.json'))
    
    for (const file of files) {
      const filePath = path.join(volDir, file)
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      const title = data.header?.title || ''
      
      if (title.includes(pattern) && !title.includes('疏') && !title.includes('记') && 
          !title.includes('注') && !title.includes('解') && !title.includes('钞') &&
          !title.includes('音义') && !title.includes('秘诀')) {
        if (count < 10) {
          console.log(`  ${data.id}: ${title}`)
        }
        count++
      }
    }
  }
  if (count > 10) console.log(`  ... 还有 ${count - 10} 个`)
  console.log(`  总计: ${count} 个`)
}
