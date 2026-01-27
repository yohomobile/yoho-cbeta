import * as fs from 'fs'
import * as path from 'path'

// 读取关系数据
const relationships = JSON.parse(fs.readFileSync('/home/guang/happy/yoho-cbeta/relationships.json', 'utf-8'))

// 获取所有已匹配的注疏ID
const matchedCommentaryIds = new Set<string>()
for (const [sutraId, data] of Object.entries(relationships.commentaries as Record<string, any>)) {
  if (data.commentaries) {
    for (const [commentaryId, commentaryData] of Object.entries(data.commentaries)) {
      matchedCommentaryIds.add(commentaryId)
    }
  }
}

console.log('已匹配注疏数量:', matchedCommentaryIds.size)

// 读取所有文件，检测未匹配的注疏
const dataDir = '/home/guang/happy/yoho-cbeta/data-simplified'
const canons = fs.readdirSync(dataDir).filter(d => fs.statSync(path.join(dataDir, d)).isDirectory())

// 排除列表
const excludePatterns = [
  /授记经/, /记果经/, /解夏经/, /解脱经/, /解脱戒/, /解脱道论/,
  /解深密/, /解节经/, /解形/, /解忧经/, /信解/, /解卷论/, /解迷/,
  /钞经/, /经偈颂/, /法宝记/, /西域记/, /游方记/, /伽蓝记/,
  /寺塔记/, /京寺记/, /上表记/, /功德记/, /法住记/, /付法记/,
  /心印记/, /传佛/, /目录/, /章疏$/, /字记/, /出三藏记/,
  /像法灭尽/, /开解梵志/,
]

// 注疏模式
const patterns: { pattern: RegExp; type: string }[] = [
  { pattern: /注$/, type: '注' },
  { pattern: /疏$/, type: '疏' },
  { pattern: /记$/, type: '记' },
  { pattern: /解$/, type: '解' },
  { pattern: /论$/, type: '论' },
  { pattern: /钞$/, type: '钞' },
  { pattern: /抄$/, type: '抄' },
  { pattern: /释$/, type: '释' },
  { pattern: /义$/, type: '义' },
  { pattern: /疏记/, type: '疏记' },
  { pattern: /疏钞/, type: '疏钞' },
  { pattern: /注疏/, type: '注疏' },
  { pattern: /章疏/, type: '章疏' },
  { pattern: /要解/, type: '要解' },
  { pattern: /新释/, type: '新释' },
  { pattern: /会释/, type: '会释' },
  { pattern: /直解/, type: '直解' },
  { pattern: /科判/, type: '科判' },
  { pattern: /科文/, type: '科文' },
  { pattern: /文句/, type: '文句' },
  { pattern: /句解/, type: '句解' },
  { pattern: /述记/, type: '述记' },
  { pattern: /述义/, type: '述义' },
  { pattern: /义记/, type: '义记' },
  { pattern: /义章/, type: '义章' },
  { pattern: /义疏/, type: '义疏' },
  { pattern: /义解/, type: '义解' },
  { pattern: /要义/, type: '要义' },
  { pattern: /集解/, type: '集解' },
  { pattern: /音义/, type: '音义' },
  { pattern: /玄义/, type: '玄义' },
  { pattern: /玄记/, type: '玄记' },
  { pattern: /科注/, type: '科注' },
  { pattern: /讲义/, type: '讲义' },
  { pattern: /讲记/, type: '讲记' },
  { pattern: /讲录/, type: '讲录' },
  { pattern: /讲演/, type: '讲演' },
  { pattern: /讲疏/, type: '讲疏' },
  { pattern: /辑要/, type: '辑要' },
  { pattern: /合释/, type: '合释' },
  { pattern: /通释/, type: '通释' },
  { pattern: /详释/, type: '详释' },
  { pattern: /悬谈/, type: '悬谈' },
  { pattern: /悬论/, type: '悬论' },
  { pattern: /纂要/, type: '纂要' },
  { pattern: /辨讹/, type: '辨讹' },
  { pattern: /折衷/, type: '折衷' },
  { pattern: /音训/, type: '音训' },
  { pattern: /音释/, type: '音释' },
  { pattern: /校释/, type: '校释' },
  { pattern: /宣演/, type: '宣演' },
  { pattern: /挟注/, type: '挟注' },
  { pattern: /略疏/, type: '略疏' },
  { pattern: /注义/, type: '注义' },
  { pattern: /秘诀/, type: '秘诀' },
  { pattern: /抄解/, type: '抄解' },
  { pattern: /口解/, type: '口解' },
  { pattern: /类解/, type: '类解' },
  { pattern: /开决/, type: '开决' },
  { pattern: /疏决/, type: '疏决' },
  { pattern: /资记/, type: '资记' },
  { pattern: /^注/, type: '注' },
]

function detectCommentary(title: string): string | null {
  for (const pattern of excludePatterns) {
    if (pattern.test(title)) return null
  }
  for (const p of patterns) {
    if (p.pattern.test(title)) return p.type
  }
  return null
}

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

function extractTitle(body: CbetaElement[]): string | null {
  const jheads = findElements(body, el => el.tag === 'jhead')
  if (jheads.length > 0) {
    const text = extractText(jheads[0]).trim()
    const cleaned = text.replace(/^(No\.\s*\d+[a-zA-Z]?\s*)/, '').replace(/卷.*$/, '').replace(/[（(].*[）)]$/, '').trim()
    return cleaned || null
  }
  const heads = findElements(body, el => el.tag === 'head' && el.attrs?.type === 'main')
  if (heads.length > 0) {
    const text = extractText(heads[0]).trim()
    const cleaned = text.replace(/^(No\.\s*\d+[a-zA-Z]?\s*)/, '').replace(/卷.*$/, '').replace(/[（(].*[）)]$/, '').trim()
    return cleaned || null
  }
  return null
}

const unmatchedByCanon: Record<string, {id: string, title: string, type: string}[]> = {}
let totalUnmatched = 0

for (const canon of canons) {
  const canonDir = path.join(dataDir, canon)
  const vols = fs.readdirSync(canonDir).filter(v => fs.statSync(path.join(canonDir, v)).isDirectory())

  for (const vol of vols) {
    const volDir = path.join(canonDir, vol)
    const files = fs.readdirSync(volDir).filter(f => f.endsWith('.json'))

    for (const file of files) {
      const filePath = path.join(volDir, file)
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      const id = data.id

      if (matchedCommentaryIds.has(id)) continue

      const title = extractTitle(data.body) || data.header?.title || ''
      const type = detectCommentary(title)

      if (type) {
        if (!unmatchedByCanon[canon]) unmatchedByCanon[canon] = []
        unmatchedByCanon[canon].push({ id, title, type })
        totalUnmatched++
      }
    }
  }
}

console.log('\n未匹配的注疏总数:', totalUnmatched)
console.log('\n按藏分布:')
for (const [canon, items] of Object.entries(unmatchedByCanon)) {
  console.log(`  ${canon}: ${items.length} 个`)
}

// 详细列出 T 藏的未匹配项
console.log('\n=== T 藏未匹配注疏 ===')
const tItems = unmatchedByCanon['T'] || []
for (const item of tItems.slice(0, 60)) {
  console.log(`  ${item.id}: ${item.title} [${item.type}]`)
}
if (tItems.length > 60) {
  console.log(`  ... 还有 ${tItems.length - 60} 个`)
}

// 列出 X 藏
console.log('\n=== X 藏未匹配注疏 (前30个) ===')
const xItems = unmatchedByCanon['X'] || []
for (const item of xItems.slice(0, 30)) {
  console.log(`  ${item.id}: ${item.title} [${item.type}]`)
}
if (xItems.length > 30) {
  console.log(`  ... 还有 ${xItems.length - 30} 个`)
}
