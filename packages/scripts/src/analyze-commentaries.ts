import * as fs from 'fs'
import * as path from 'path'

// 读取关系数据
const relationships = JSON.parse(fs.readFileSync('/home/guang/happy/yoho-cbeta/relationships.json', 'utf-8'))

// 获取所有已匹配的注疏ID
const matchedCommentaryIds = new Set<string>()
for (const [sutraId, data] of Object.entries(relationships.commentaries as Record<string, any>)) {
  if (data.commentaries) {
    for (const [commentaryId] of Object.entries(data.commentaries)) {
      matchedCommentaryIds.add(commentaryId)
    }
  }
}

console.log('已匹配注疏数量:', matchedCommentaryIds.size)

// 分析T藏的注疏
const dataDir = '/home/guang/happy/yoho-cbeta/data-simplified/T'
const vols = fs.readdirSync(dataDir).filter(v => fs.statSync(path.join(dataDir, v)).isDirectory())

// 分类注疏
const realCommentaries: { id: string; title: string }[] = []    // 真正的注疏（标题含经名+注疏词）
const independentTreatises: { id: string; title: string }[] = []  // 独立论典（只有「论」字，无经名）
const maybeCommentaries: { id: string; title: string }[] = []   // 可能的注疏

// 排除列表 - 这些不是注疏
const excludePatterns = [
  /授记经/, /记果经/, /解夏经/, /解脱经/, /解脱戒/, /解脱道论/,
  /解深密/, /解节经/, /解形/, /解忧经/, /信解/, /解卷论/, /解迷/,
  /钞经/, /经偈颂/, /法宝记/, /西域记/, /游方记/, /伽蓝记/,
  /寺塔记/, /京寺记/, /上表记/, /功德记/, /法住记/, /付法记/,
  /心印记/, /传佛/, /目录/, /章疏$/, /字记/, /出三藏记/,
  /像法灭尽/, /开解梵志/, /^佛说.*经$/, /佛说解/, /释摩男/,
  /帝释所问经/, /帝释般若/, /诸法本经/, /普法义经/, /释经/,
  /有德女所问/, /差摩婆帝/, /解形中/, /释迦牟尼佛成道/,
  /释迦佛赞/, /记法住/, /瞿昙弥记/, /授受记经/, /观世音菩萨.*记/,
  /菩萨经.*记/, /弥勒下生/, /月光童子经/, /摩登女解/, /须赖经/,
  /大般涅槃经后分/, /修行经/,
]

// 真正的注疏模式 - 这些是注疏类型的标志
const commentaryPatterns = [
  { pattern: /疏$/, type: '疏' },
  { pattern: /疏记/, type: '疏记' },
  { pattern: /疏钞/, type: '疏钞' },
  { pattern: /注疏/, type: '注疏' },
  { pattern: /义疏/, type: '义疏' },
  { pattern: /科文/, type: '科文' },
  { pattern: /文句/, type: '文句' },
  { pattern: /玄义/, type: '玄义' },
  { pattern: /玄记/, type: '玄记' },
  { pattern: /悬谈/, type: '悬谈' },
  { pattern: /讲义/, type: '讲义' },
  { pattern: /讲记/, type: '讲记' },
  { pattern: /讲录/, type: '讲录' },
  { pattern: /述记/, type: '述记' },
  { pattern: /义记/, type: '义记' },
  { pattern: /集注/, type: '集注' },
  { pattern: /科注/, type: '科注' },
  { pattern: /合释/, type: '合释' },
  { pattern: /通释/, type: '通释' },
  { pattern: /详释/, type: '详释' },
  { pattern: /要解/, type: '要解' },
  { pattern: /直解/, type: '直解' },
  { pattern: /会释/, type: '会释' },
  { pattern: /音义/, type: '音义' },
  { pattern: /句解/, type: '句解' },
  { pattern: /略疏/, type: '略疏' },
  { pattern: /别记/, type: '别记' },
  { pattern: /私记/, type: '私记' },
  { pattern: /子注/, type: '子注' },
  { pattern: /挟注/, type: '挟注' },
  { pattern: /秘诀/, type: '秘诀' },
  { pattern: /轨记/, type: '轨记' },
]

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
    return text.replace(/^(No\.\s*\d+[a-zA-Z]?\s*)/, '').replace(/卷.*$/, '').replace(/[（(].*[）)]$/, '').trim()
  }
  const heads = findElements(body, el => el.tag === 'head' && el.attrs?.type === 'main')
  if (heads.length > 0) {
    const text = extractText(heads[0]).trim()
    return text.replace(/^(No\.\s*\d+[a-zA-Z]?\s*)/, '').replace(/卷.*$/, '').replace(/[（(].*[）)]$/, '').trim()
  }
  return null
}

function isCommentary(title: string): { isCommentary: boolean; type: string | null } {
  // 首先检查排除列表
  for (const pattern of excludePatterns) {
    if (pattern.test(title)) return { isCommentary: false, type: null }
  }

  // 检查是否是真正的注疏
  for (const { pattern, type } of commentaryPatterns) {
    if (pattern.test(title)) {
      return { isCommentary: true, type }
    }
  }

  return { isCommentary: false, type: null }
}

for (const vol of vols) {
  const volDir = path.join(dataDir, vol)
  const files = fs.readdirSync(volDir).filter(f => f.endsWith('.json'))

  for (const file of files) {
    const filePath = path.join(volDir, file)
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    const id = data.id

    if (matchedCommentaryIds.has(id)) continue

    const title = extractTitle(data.body) || data.header?.title || ''

    const result = isCommentary(title)
    if (result.isCommentary) {
      realCommentaries.push({ id, title })
    }
  }
}

console.log('\n=== T 藏遗漏的注疏 ===')
console.log('\n遗漏的注疏数量:', realCommentaries.length, '个')
for (const item of realCommentaries) {
  console.log('  ', item.id + ':', item.title)
}
