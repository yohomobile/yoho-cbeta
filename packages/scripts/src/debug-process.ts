import * as fs from 'fs'
import * as path from 'path'

interface CbetaElement {
  tag: string
  attrs?: Record<string, string>
  children?: (CbetaElement | string)[]
}

function extractText(element: CbetaElement | string): string {
  if (typeof element === 'string') return element
  if (element.tag === 'note') return ''
  if (element.tag === 'rdg') return ''
  if (element.tag === 'foreign') return ''
  return (element.children || []).map(child => extractText(child)).join('')
}

function findFirst(elements: (CbetaElement | string)[], predicate: (el: CbetaElement) => boolean): CbetaElement | null {
  for (const el of elements) {
    if (typeof el === 'string') continue
    if (predicate(el)) return el
    if (el.children) {
      const found = findFirst(el.children, predicate)
      if (found) return found
    }
  }
  return null
}

function cleanTitle(title: string): string {
  let cleaned = title
  cleaned = cleaned.replace(/[\r\n]+/g, '').replace(/\s+/g, '')
  cleaned = cleaned.replace(/卷第?[一二三四五六七八九十百千零\d]+/g, '')
  cleaned = cleaned.replace(/卷之?[一二三四五六七八九十百千零\d]+/g, '')
  cleaned = cleaned.replace(/卷[上中下]/g, '')
  return cleaned.trim()
}

function extractTitle(body: CbetaElement[], headerTitle: string): string {
  const jhead = findFirst(body, el => el.tag === 'jhead')
  if (jhead) {
    const text = extractText(jhead).trim()
    if (text) {
      const cleaned = cleanTitle(text)
      if (cleaned.length >= 2) return cleaned
    }
  }
  return cleanTitle(headerTitle) || headerTitle
}

// 读取关系数据
const relationships = JSON.parse(fs.readFileSync('/home/guang/happy/yoho-cbeta/relationships.json', 'utf-8'))

// 获取已处理的注疏ID
const processedCommentaryIds = new Set<string>()
for (const [sutraId, data] of Object.entries(relationships.commentaries as Record<string, any>)) {
  if (data.commentaries) {
    for (const commId of Object.keys(data.commentaries)) {
      processedCommentaryIds.add(commId)
    }
  }
}

// 读取 X14n0293
const file = '/home/guang/happy/yoho-cbeta/data-simplified/X/X14/X14n0293.json'
const data = JSON.parse(fs.readFileSync(file, 'utf-8'))
const title = extractTitle(data.body, data.header?.title || '')

console.log('ID:', data.id)
console.log('提取的标题:', title)
console.log('已在 processedCommentaryIds 中:', processedCommentaryIds.has('X14n0293'))

// 检测注疏类型
function detectCommentaryType(t: string): string | null {
  const excludePatterns = [/授记经/, /记果经/]
  for (const p of excludePatterns) { if (p.test(t)) return null }
  const patterns = [
    { pattern: /悬谈/, type: '悬谈' },
    { pattern: /疏$/, type: '疏' },
  ]
  for (const { pattern, type } of patterns) {
    if (pattern.test(t)) return type
  }
  return null
}

const commentaryType = detectCommentaryType(title)
console.log('注疏类型:', commentaryType)

if (!processedCommentaryIds.has('X14n0293') && commentaryType) {
  console.log('\n尝试匹配...')
  
  const suffixes = ['悬谈', '疏', '注', '记']
  for (const suffix of suffixes) {
    const pattern = new RegExp(`(.+)${suffix}$`)
    const match = title.match(pattern)
    if (match) {
      const baseName = match[1]
      console.log('后缀:', suffix)
      console.log('基名:', baseName)
      
      // 检查 wellKnownSutras
      const wellKnownSutras: Record<string, string> = {
        '首楞严经': 'T19n0945',
        '楞严经': 'T19n0945',
      }
      
      if (wellKnownSutras[baseName]) {
        console.log('找到原经 ID:', wellKnownSutras[baseName])
      } else {
        console.log('在 wellKnownSutras 中未找到:', baseName)
      }
      break
    }
  }
}
