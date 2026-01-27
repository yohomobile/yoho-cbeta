/**
 * CBETA 经文关系提取脚本
 * 从 data-simplified/ 目录读取数据，提取：
 * 1. 注疏关系：注疏 → 原经/论
 * 2. 同经异译：同一经典的不同翻译版本
 * 3. 相关经典：通过 [cf. No. xxx] 引用的相关文本
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join } from 'path'

// ==================== 类型定义 ====================

interface CbetaElement {
  tag: string
  ns?: 'tei' | 'cb'
  attrs: Record<string, string>
  children: (CbetaElement | string)[]
}

interface CbetaJson {
  id: string
  header: { title: string; author?: string; source?: string }
  body: CbetaElement[]
}

interface ParsedMetadata {
  id: string
  canonId: string
  volume: string
  number: string
  title: string
  docNumber: string | null
  docNumberParsed: string[]
}

interface SutraInfo {
  id: string
  title: string
  author?: string
}

interface CommentaryInfo {
  id: string
  title: string
  type: string        // 注疏类型：疏、注、记、钞、解、义、玄义、文句等
  confidence: number  // 置信度 0-1
  source: string      // 来源：rule:docNumber, rule:title_suffix 等
}

interface RelatedSutraInfo {
  id: string
  title: string
  relation: string    // 关系类型：别译、单经、相关等
}

interface CommentaryRelation {
  title: string
  commentaries: Record<string, CommentaryInfo>
  relatedSutras: RelatedSutraInfo[]  // 相关经典（非注疏）
}

interface TranslationGroup {
  baseTitle: string
  sutras: SutraInfo[]
  source: string      // 来源：rule:docNumber_nos, rule:title_match 等
}

interface RelationshipData {
  description: string
  generatedAt: string
  sourceDir: string
  statistics: {
    totalFiles: number
    filesWithReferences: number
    totalCommentaryRelations: number
    totalCommentaries: number
    totalRelatedSutras: number
    totalTranslationGroups: number
    totalTranslatedSutras: number
  }
  commentaries: Record<string, CommentaryRelation>  // key: 原经ID
  translations: TranslationGroup[]
}

// ==================== 辅助函数 ====================

/** 递归遍历目录获取所有 JSON 文件 */
function getAllJsonFiles(dir: string): string[] {
  const files: string[] = []

  function traverse(currentDir: string) {
    const entries = readdirSync(currentDir)
    for (const entry of entries) {
      const fullPath = join(currentDir, entry)
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        traverse(fullPath)
      } else if (entry.endsWith('.json') && !entry.startsWith('.')) {
        files.push(fullPath)
      }
    }
  }

  traverse(dir)
  return files
}

/** 从文件名解析 ID 信息 */
function parseId(id: string): { canonId: string; volume: string; number: string } {
  const match = id.match(/^([A-Z]+)(\d+)n(.+)$/)
  if (match) {
    return { canonId: match[1], volume: match[2], number: match[3] }
  }
  return { canonId: '', volume: '', number: id }
}

/** 递归查找元素 */
function findElements(
  elements: (CbetaElement | string)[],
  predicate: (el: CbetaElement) => boolean
): CbetaElement[] {
  const results: CbetaElement[] = []
  for (const el of elements) {
    if (typeof el === 'string') continue
    if (predicate(el)) results.push(el)
    if (el.children?.length > 0) {
      results.push(...findElements(el.children, predicate))
    }
  }
  return results
}

/** 查找第一个匹配的元素 */
function findFirst(
  elements: (CbetaElement | string)[],
  predicate: (el: CbetaElement) => boolean
): CbetaElement | null {
  const found = findElements(elements, predicate)
  return found.length > 0 ? found[0] : null
}

/** 提取元素的纯文本内容 */
function extractText(element: CbetaElement | string): string {
  if (typeof element === 'string') return element
  if (element.tag === 'note') return ''
  if (element.tag === 'rdg') return ''
  if (element.tag === 'foreign') return ''
  return (element.children || []).map(child => extractText(child)).join('')
}

/** 从 body 提取 docNumber */
function extractDocNumber(body: CbetaElement[]): { raw: string | null; parsed: string[] } {
  const docNumbers = findElements(body, el => el.tag === 'docNumber')
  if (docNumbers.length === 0) return { raw: null, parsed: [] }

  const first = docNumbers[0]
  const raw = extractText(first).trim()

  const parsed: string[] = []

  // 匹配 [No. xxx], [Nos. xxx], [cf. No. xxx] 等格式
  const bracketPattern = /\[(?:Nos?\.?|cf\.?)\s*([^\]]+)\]/g
  let match
  while ((match = bracketPattern.exec(raw)) !== null) {
    const content = match[1]
    const parts = content.split(/[,;]/)
    for (const part of parts) {
      const trimmed = part.trim()
      if (trimmed) {
        const numMatch = trimmed.match(/(\d+)/)
        if (numMatch) {
          parsed.push(`No. ${numMatch[1]}`)
        }
      }
    }
  }

  return { raw, parsed }
}

/** 清理标题：移除卷号等 */
function cleanTitle(title: string): string {
  let cleaned = title
  cleaned = cleaned.replace(/[\r\n]+/g, '').replace(/\s+/g, '')
  // 移除梵文/巴利文
  cleaned = cleaned.replace(/\[[A-Za-zĀāĪīŪūṀṁṂṃṄṅṆṇṚṛṜṝḌḍḤḥḶḷṢṣṬṭŚśÑñḀẀẂẄỲỳ\s\-]+\]/g, '')
  cleaned = cleaned.replace(/[（(][A-Za-zĀāĪīŪūṀṁṂṃṄṅṆṇṚṛṜṝḌḍḤḥḶḷṢṣṬṭŚśÑñḀẀẂẄỲỳ\s\-]+[）)]/g, '')
  cleaned = cleaned.replace(/[A-Za-zĀāĪīŪūṀṁṂṃṄṅṆṇṚṛṜṝḌḍḤḥḶḷṢṣṬṭŚśÑñḀẀẂẄỲỳ-]+/g, '')
  // 移除卷号
  cleaned = cleaned.replace(/卷第?[一二三四五六七八九十百千零\d]+/g, '')
  cleaned = cleaned.replace(/卷之?[一二三四五六七八九十百千零\d]+/g, '')
  cleaned = cleaned.replace(/卷[上中下]/g, '')
  cleaned = cleaned.replace(/[一二三四五六七八九十]+卷$/g, '')
  cleaned = cleaned.replace(/第[一二三四五六七八九十百千零\d]+卷/g, '')
  cleaned = cleaned.replace(/第$/g, '')
  // 移除空括号
  cleaned = cleaned.replace(/\[\s*\]/g, '')
  cleaned = cleaned.replace(/[（(]\s*[）)]/g, '')
  return cleaned.trim()
}

/** 从 body 提取标题 */
function extractTitle(body: CbetaElement[], headerTitle: string): string {
  // 优先查找 jhead
  const jhead = findFirst(body, el => el.tag === 'jhead')
  if (jhead) {
    const text = extractText(jhead).trim()
    if (text) {
      const cleaned = cleanTitle(text)
      if (cleaned.length >= 2) return cleaned
    }
  }

  // 其次查找 head
  const head = findFirst(body, el => el.tag === 'head')
  if (head) {
    const text = extractText(head).trim()
    if (text) {
      const cleaned = cleanTitle(text)
      if (cleaned.length >= 2) return cleaned
    }
  }

  // 回退到 header.title
  return cleanTitle(headerTitle) || headerTitle
}

// ==================== 注疏识别 ====================

/** 识别注疏类型 */
function detectCommentaryType(title: string): string | null {
  // 排除列表：这些词虽然含有「记」「解」等字但不是注疏
  const excludePatterns = [
    /授记经/, /记果经/, /解夏经/, /解脱经/, /解脱戒/, /解脱道论/,
    /解深密/, /解节经/, /解形/, /解忧经/, /信解/, /解卷论/, /解迷/,
    /钞经/, /经偈颂/, /法宝记/, /西域记/, /游方记/, /伽蓝记/,
    /寺塔记/, /京寺记/, /上表记/, /功德记/, /法住记/, /付法记/,
    /心印记/, /传佛/, /目录/, /章疏$/, /字记/, /出三藏记/,
    /像法灭尽/, /开解梵志/,
  ]

  for (const pattern of excludePatterns) {
    if (pattern.test(title)) return null
  }

  const patterns: { pattern: RegExp; type: string }[] = [
    { pattern: /玄义/, type: '玄义' },
    { pattern: /文句/, type: '文句' },
    { pattern: /义疏/, type: '义疏' },
    { pattern: /讲记/, type: '讲记' },
    { pattern: /讲录/, type: '讲录' },
    { pattern: /讲义/, type: '讲义' },
    { pattern: /述记/, type: '述记' },
    { pattern: /义记/, type: '义记' },
    { pattern: /玄赞/, type: '玄赞' },
    { pattern: /要解/, type: '要解' },
    { pattern: /纲要/, type: '纲要' },
    { pattern: /合论/, type: '合论' },
    { pattern: /指归/, type: '指归' },
    { pattern: /释论/, type: '释论' },
    { pattern: /论疏/, type: '论疏' },
    { pattern: /经疏/, type: '经疏' },
    { pattern: /会要/, type: '会要' },
    { pattern: /纲宗/, type: '纲宗' },
    { pattern: /大意/, type: '大意' },
    { pattern: /撮要/, type: '撮要' },
    { pattern: /补注/, type: '补注' },
    { pattern: /释义/, type: '释义' },
    { pattern: /释要/, type: '释要' },
    { pattern: /句解/, type: '句解' },
    { pattern: /通释/, type: '通释' },
    { pattern: /直解/, type: '直解' },
    { pattern: /略解/, type: '略解' },
    { pattern: /音义/, type: '音义' },
    { pattern: /音训/, type: '音训' },
    { pattern: /音释/, type: '音释' },
    { pattern: /颂释/, type: '颂释' },
    { pattern: /颂解/, type: '颂解' },
    { pattern: /科文/, type: '科文' },
    { pattern: /科注/, type: '科注' },
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
    { pattern: /悬谈/, type: '悬谈' },
    { pattern: /疏钞/, type: '疏钞' },
    { pattern: /疏记/, type: '疏记' },
    { pattern: /集注/, type: '集注' },
    { pattern: /演义/, type: '演义' },
    { pattern: /节要/, type: '节要' },
    { pattern: /纂要/, type: '纂要' },
    { pattern: /释签/, type: '释签' },
    { pattern: /指掌/, type: '指掌' },
    { pattern: /私记/, type: '私记' },
    { pattern: /别记/, type: '别记' },
    { pattern: /^注/, type: '注' },  // 以「注」开头
    { pattern: /疏$/, type: '疏' },
    { pattern: /注$/, type: '注' },
    { pattern: /记$/, type: '记' },
    { pattern: /钞$/, type: '钞' },
    { pattern: /解$/, type: '解' },
    { pattern: /科$/, type: '科' },
    { pattern: /科判/, type: '科判' },
  ]

  for (const { pattern, type } of patterns) {
    if (pattern.test(title)) return type
  }
  return null
}

/** 检查注疏方向是否正确（注疏标题应包含原经名或其简称） */
function isValidCommentaryDirection(commentaryTitle: string, targetTitle: string): boolean {
  const cleanComm = commentaryTitle.replace(/^佛说/, '')
  const cleanTarget = targetTitle.replace(/^佛说/, '')

  // 如果原经本身是注疏，需要检查是否是「注疏的注疏」
  const subCommentaryPatterns = ['记', '钞', '科', '指归', '发挥', '补正', '疏']
  const targetIsCommentary = detectCommentaryType(cleanTarget)
  if (targetIsCommentary) {
    const hasSubPattern = subCommentaryPatterns.some(p => cleanComm.includes(p))
    if (!hasSubPattern) return false
  }

  // 直接包含检查
  if (cleanComm.includes(cleanTarget)) return true
  if (cleanTarget.length > 4 && cleanComm.includes(cleanTarget.slice(0, 4))) return true

  // 简称匹配
  const shortNames: Record<string, string[]> = {
    '金刚': ['金刚般若波罗蜜', '金刚般若'],
    '维摩': ['维摩诘所说', '维摩诘'],
    '法华': ['妙法莲华', '法华'],
    '涅槃': ['大般涅槃', '涅槃'],
    '俱舍': ['阿毘达磨俱舍', '俱舍'],
    '起信': ['大乘起信', '起信'],
    '华严': ['大方广佛华严', '华严', '大方广佛'],
    '般若': ['般若波罗蜜多', '般若', '摩诃般若'],
    '心经': ['般若波罗蜜多心', '心经'],
    '仁王': ['仁王护国般若', '仁王', '仁王般若'],
    '中观': ['中观', '中论'],
    '瑜伽': ['瑜伽师地', '瑜伽论'],
    '梵网': ['梵网经', '梵网经卢舍那佛说菩萨心地戒品'],
    '遗教': ['佛垂般涅槃略说教诫', '遗教经', '佛遗教'],
    '盂兰': ['盂兰盆', '佛说盂兰盆'],
    '四分': ['四分律', '四分僧戒'],
    '肇论': ['肇论'],
    '楞伽': ['楞伽阿跋多罗宝', '楞伽'],
    '广百': ['大乘广百论', '广百论'],
    '菩萨戒': ['菩萨心地戒', '菩萨戒'],
    '圆觉': ['大方广圆觉修多罗了义', '圆觉'],
    '楞严': ['大佛顶如来密因修证了义诸菩萨万行首楞严', '首楞严'],
    '阿弥陀': ['佛说阿弥陀', '阿弥陀'],
    '无量寿': ['佛说无量寿', '无量寿'],
    '观无量寿': ['佛说观无量寿佛', '观无量寿'],
    '地藏': ['地藏菩萨本愿', '地藏'],
    '药师': ['药师琉璃光如来本愿功德', '药师'],
    '百法': ['大乘百法明门论', '百法'],
    '唯识': ['成唯识论', '唯识'],
    '因明': ['因明入正理论', '因明'],
    '大日': ['大毘卢遮那成佛神变加持', '大日'],
    '金光明': ['金光明最胜王', '金光明'],
  }

  for (const [shortName, fullNames] of Object.entries(shortNames)) {
    if (cleanComm.includes(shortName)) {
      if (fullNames.some(fn => cleanTarget.includes(fn)) || cleanTarget.includes(shortName)) {
        return true
      }
    }
  }

  return true  // 默认保守策略
}

/** 清理标题用于比较 */
function normalizeTitle(title: string): string {
  return title
    .replace(/^佛说/, '')
    .replace(/^大方广/, '')
    .replace(/^大乘/, '')
    .replace(/经$/, '')
    .replace(/论$/, '')
    .replace(/卷.*$/, '')
    .trim()
}

// ==================== 主逻辑 ====================

function extractRelationships(dataDir: string): RelationshipData {
  console.log(`从 ${dataDir} 读取数据...`)

  // 1. 读取所有文件并提取元数据
  const files = getAllJsonFiles(dataDir)
  const allMetadata: ParsedMetadata[] = []

  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8')
      const json: CbetaJson = JSON.parse(content)
      const { canonId, volume, number } = parseId(json.id)
      const title = extractTitle(json.body, json.header.title)
      const { raw: docNumber, parsed: docNumberParsed } = extractDocNumber(json.body)

      allMetadata.push({
        id: json.id,
        canonId,
        volume,
        number,
        title,
        docNumber,
        docNumberParsed
      })
    } catch (e) {
      console.error(`读取失败: ${file}`)
    }
  }

  console.log(`共读取 ${allMetadata.length} 个文件`)

  // 2. 构建文号索引
  const docNoIndex = new Map<string, string>()  // canonId:No. xxx -> id
  const docNoFuzzyIndex = new Map<string, string[]>()  // canonId:No. xxx -> [id1, id2, ...]

  for (const meta of allMetadata) {
    if (!meta.docNumber) continue
    const selfMatch = meta.docNumber.match(/^No\.\s*(\d+)([A-Za-z]?)/)
    if (!selfMatch) continue

    const baseNum = selfMatch[1]
    const suffix = selfMatch[2] || ''
    const key = `${meta.canonId}:No. ${baseNum}${suffix}`
    const baseKey = `${meta.canonId}:No. ${baseNum}`

    docNoIndex.set(key, meta.id)

    // 模糊索引
    if (!docNoFuzzyIndex.has(baseKey)) {
      docNoFuzzyIndex.set(baseKey, [])
    }
    docNoFuzzyIndex.get(baseKey)!.push(meta.id)
  }

  console.log(`文号索引: ${docNoIndex.size} 条`)

  // 辅助函数：根据文号查找 ID
  function findIdsByDocNo(canonId: string, docNo: string): string[] {
    const key = `${canonId}:${docNo}`
    const exactId = docNoIndex.get(key)
    if (exactId) return [exactId]
    const fuzzyIds = docNoFuzzyIndex.get(key)
    if (fuzzyIds) return fuzzyIds
    return []
  }

  // 3. 构建辅助映射
  const metaById = new Map<string, ParsedMetadata>()
  const titleIndex = new Map<string, string>()  // title -> id (优先 T 藏)

  for (const meta of allMetadata) {
    metaById.set(meta.id, meta)
  }

  // 按优先级排序：T 藏优先
  const sortedMeta = [...allMetadata].sort((a, b) => {
    if (a.canonId === 'T' && b.canonId !== 'T') return -1
    if (a.canonId !== 'T' && b.canonId === 'T') return 1
    return a.id.localeCompare(b.id)
  })

  for (const meta of sortedMeta) {
    if (!meta.title) continue
    if (!titleIndex.has(meta.title)) {
      titleIndex.set(meta.title, meta.id)
    }
    const normalized = normalizeTitle(meta.title)
    if (normalized && !titleIndex.has(normalized)) {
      titleIndex.set(normalized, meta.id)
    }
  }

  // 硬编码常见经典的 ID 映射
  const wellKnownSutras: Record<string, string> = {
    '大佛顶如来密因修证了义诸菩萨万行首楞严经': 'T19n0945',
    '首楞严经': 'T19n0945',
    '楞严经': 'T19n0945',
    '首楞严': 'T19n0945',
    '大佛顶经': 'T19n0945',
    '大佛顶': 'T19n0945',
    '楞伽阿跋多罗宝经': 'T16n0670',
    '入楞伽经': 'T16n0671',
    '楞伽经': 'T16n0670',
    '楞伽': 'T16n0670',
    '大方广圆觉修多罗了义经': 'T17n0842',
    '圆觉经': 'T17n0842',
    '圆觉': 'T17n0842',
    '妙法莲华经': 'T09n0262',
    '法华经': 'T09n0262',
    '法华': 'T09n0262',
    '莲华经': 'T09n0262',
    '莲花经': 'T09n0262',
    '妙法莲华': 'T09n0262',
    '妙法莲花': 'T09n0262',
    '大方广佛华严经': 'T09n0278',
    '华严经': 'T09n0278',
    '华严': 'T09n0278',
    '金刚般若波罗蜜经': 'T08n0235',
    '金刚经': 'T08n0235',
    '金刚般若': 'T08n0235',
    '金刚': 'T08n0235',
    '维摩诘所说经': 'T14n0475',
    '维摩经': 'T14n0475',
    '维摩': 'T14n0475',
    '净名经': 'T14n0475',
    '净名': 'T14n0475',
    '大般涅槃经': 'T12n0374',
    '涅槃经': 'T12n0374',
    '涅槃': 'T12n0374',
    '佛说阿弥陀经': 'T12n0366',
    '阿弥陀经': 'T12n0366',
    '弥陀经': 'T12n0366',
    '佛说观无量寿佛经': 'T12n0365',
    '观无量寿经': 'T12n0365',
    '观经': 'T12n0365',
    '佛说无量寿经': 'T12n0360',
    '无量寿经': 'T12n0360',
    '药师琉璃光如来本愿功德经': 'T14n0450',
    '药师经': 'T14n0450',
    '药师': 'T14n0450',
    '药师瑠璃光': 'T14n0450',
    '药师琉璃光': 'T14n0450',
    '般若波罗蜜多心经': 'T08n0251',
    '心经': 'T08n0251',
    '地藏菩萨本愿经': 'T13n0412',
    '地藏经': 'T13n0412',
    '佛说盂兰盆经': 'T16n0685',
    '盂兰盆经': 'T16n0685',
    '盂兰': 'T16n0685',
    '兰盆': 'T16n0685',
    '胜鬘师子吼一乘大方便方广经': 'T12n0353',
    '胜鬘经': 'T12n0353',
    '胜鬘': 'T12n0353',
    '仁王护国般若波罗蜜经': 'T08n0245',
    '仁王经': 'T08n0245',
    '仁王': 'T08n0245',
    '梵网经': 'T24n1484',
    '梵网': 'T24n1484',
    '佛垂般涅槃略说教诫经': 'T12n0389',
    '遗教经': 'T12n0389',
    '金光明最胜王经': 'T16n0665',
    '金光明经': 'T16n0663',
    // 论典
    '成唯识论': 'T31n1585',
    '唯识论': 'T31n1585',
    '阿毘达磨俱舍论': 'T29n1558',
    '俱舍论': 'T29n1558',
    '俱舍': 'T29n1558',
    '瑜伽师地论': 'T30n1579',
    '瑜伽论': 'T30n1579',
    '瑜伽': 'T30n1579',
    '大乘起信论': 'T32n1666',
    '起信论': 'T32n1666',
    '起信': 'T32n1666',
    '中论': 'T30n1564',
    '中观论': 'T30n1564',
    '百论': 'T30n1569',
    '十二门论': 'T30n1568',
    '大智度论': 'T25n1509',
    '智度论': 'T25n1509',
    '摄大乘论': 'T31n1593',
    '摄论': 'T31n1593',
    '大乘百法明门论': 'T31n1614',
    '百法': 'T31n1614',
    '因明入正理论': 'T32n1630',
    '因明': 'T32n1630',
    '十地经论': 'T26n1522',
    '十地论': 'T26n1522',
    '成实论': 'T32n1646',
    '肇论': 'T45n1858',
    // 律
    '四分律': 'T22n1428',
    '四分': 'T22n1428',
    '四分律比丘戒本': 'T22n1429',
    '戒本': 'T22n1429',
    // 天台
    '摩诃止观': 'T46n1911',
    '止观': 'T46n1911',
    '妙法莲华经玄义': 'T33n1716',
    '法华玄义': 'T33n1716',
    '妙法莲华经文句': 'T34n1718',
    '法华文句': 'T34n1718',
    '妙经文句': 'T34n1718',
    // 其他重要论典
    '地持论': 'T30n1581',
    '四分律删繁补阙行事钞': 'T40n1804',
    '行事钞': 'T40n1804',
    '释摩诃衍论': 'T32n1668',
    '十地经论': 'T26n1522',
    '十地论': 'T26n1522',
    '阿毗达磨杂集论': 'T31n1606',
    '杂集论': 'T31n1606',
    '观所缘缘论': 'T31n1624',
    '观所缘论': 'T31n1624',
    '永嘉禅宗集': 'T48n2013',
    '永嘉集': 'T48n2013',
    '天台四教仪': 'T46n1931',
    '四教仪': 'T46n1931',
    // 观音相关
    '观音玄义': 'T34n1726',
    '观音义疏': 'T34n1728',
    '观音疏': 'T34n1728',
  }

  // 4. 提取注疏关系和相关经典
  const commentaries: Record<string, CommentaryRelation> = {}
  let filesWithRefs = 0
  let totalCommentaries = 0
  let totalRelatedSutras = 0

  for (const meta of allMetadata) {
    if (meta.docNumberParsed && meta.docNumberParsed.length > 0) {
      filesWithRefs++

      for (const refNo of meta.docNumberParsed) {
        const targetIds = findIdsByDocNo(meta.canonId, refNo)
        if (targetIds.length === 0) continue

        const targetId = targetIds[0]
        const targetMeta = metaById.get(targetId)
        if (!targetMeta) continue

        // 初始化
        if (!commentaries[targetId]) {
          commentaries[targetId] = {
            title: targetMeta.title,
            commentaries: {},
            relatedSutras: []
          }
        }

        const commentaryType = detectCommentaryType(meta.title)
        const isValidDirection = commentaryType && isValidCommentaryDirection(meta.title, targetMeta.title)

        if (commentaryType && isValidDirection) {
          // 是注疏
          if (!commentaries[targetId].commentaries[meta.id]) {
            commentaries[targetId].commentaries[meta.id] = {
              id: meta.id,
              title: meta.title,
              type: commentaryType,
              confidence: 1.0,
              source: 'rule:docNumber'
            }
            totalCommentaries++
          }
        } else {
          // 是相关经典
          let relation = '相关'
          const targetTitleBase = targetMeta.title.replace(/^佛说/, '').replace(/经$/, '')
          const metaTitleBase = meta.title.replace(/^佛说/, '').replace(/经$/, '')
          if (metaTitleBase.includes(targetTitleBase) || targetTitleBase.includes(metaTitleBase)) {
            relation = '别译'
          }

          const exists = commentaries[targetId].relatedSutras.some(r => r.id === meta.id)
          if (!exists) {
            commentaries[targetId].relatedSutras.push({
              id: meta.id,
              title: meta.title,
              relation
            })
            totalRelatedSutras++
          }
        }
      }
    }
  }

  console.log(`注疏关系（基于 docNumber）: ${Object.keys(commentaries).length} 部原经，${totalCommentaries} 个注疏，${totalRelatedSutras} 个相关经典`)

  // 5. 基于标题匹配补充注疏关系
  const shortToFullNames: Record<string, string[]> = {
    // 经典
    '楞严经': ['大佛顶如来密因修证了义诸菩萨万行首楞严经', '首楞严经'],
    '首楞严经': ['大佛顶如来密因修证了义诸菩萨万行首楞严经'],
    '首楞严': ['大佛顶如来密因修证了义诸菩萨万行首楞严经'],
    '大佛顶经': ['大佛顶如来密因修证了义诸菩萨万行首楞严经'],
    '大佛顶': ['大佛顶如来密因修证了义诸菩萨万行首楞严经'],
    '华严经': ['大方广佛华严经'],
    '华严': ['大方广佛华严经'],
    '花严经': ['大方广佛华严经'],
    '圆觉经': ['大方广圆觉修多罗了义经'],
    '圆觉': ['大方广圆觉修多罗了义经'],
    '楞伽经': ['楞伽阿跋多罗宝经', '入楞伽经', '大乘入楞伽经'],
    '楞伽': ['楞伽阿跋多罗宝经', '入楞伽经', '大乘入楞伽经'],
    '金刚经': ['金刚般若波罗蜜经'],
    '金刚般若': ['金刚般若波罗蜜经'],
    '金刚': ['金刚般若波罗蜜经'],
    '心经': ['般若波罗蜜多心经'],
    '法华经': ['妙法莲华经'],
    '法华': ['妙法莲华经'],
    '莲华经': ['妙法莲华经'],
    '莲花经': ['妙法莲华经'],  // 花/华 通用
    '妙法莲华': ['妙法莲华经'],
    '妙法莲花': ['妙法莲华经'],
    '涅槃经': ['大般涅槃经'],
    '涅槃': ['大般涅槃经'],
    '维摩经': ['维摩诘所说经'],
    '维摩': ['维摩诘所说经'],
    '净名经': ['维摩诘所说经'],  // 净名是维摩的别名
    '净名': ['维摩诘所说经'],
    '阿弥陀经': ['佛说阿弥陀经'],
    '弥陀经': ['佛说阿弥陀经'],
    '无量寿经': ['佛说无量寿经'],
    '观无量寿经': ['佛说观无量寿佛经'],
    '观经': ['佛说观无量寿佛经'],
    '地藏经': ['地藏菩萨本愿经'],
    '药师经': ['药师琉璃光如来本愿功德经'],
    '药师': ['药师琉璃光如来本愿功德经'],
    '药师瑠璃光': ['药师琉璃光如来本愿功德经'],
    '药师琉璃光': ['药师琉璃光如来本愿功德经'],
    '遗教经': ['佛垂般涅槃略说教诫经'],
    '四十二章经': ['佛说四十二章经'],
    '八大人觉经': ['佛说八大人觉经'],
    '盂兰盆经': ['佛说盂兰盆经'],
    '盂兰': ['佛说盂兰盆经'],
    '兰盆': ['佛说盂兰盆经'],
    '胜鬘经': ['胜鬘师子吼一乘大方便方广经'],
    '胜鬘': ['胜鬘师子吼一乘大方便方广经'],
    '仁王经': ['仁王护国般若波罗蜜经'],
    '仁王': ['仁王护国般若波罗蜜经'],
    '梵网经': ['梵网经'],
    '梵网': ['梵网经'],
    '大日经': ['大毘卢遮那成佛神变加持经'],
    '金光明经': ['金光明最胜王经', '金光明经'],
    '般若经': ['大般若波罗蜜多经', '摩诃般若波罗蜜经'],
    // 论典
    '百法明门论': ['大乘百法明门论'],
    '百法': ['大乘百法明门论'],
    '唯识论': ['成唯识论'],
    '成唯识': ['成唯识论'],
    '俱舍论': ['阿毘达磨俱舍论'],
    '俱舍': ['阿毘达磨俱舍论'],
    '瑜伽论': ['瑜伽师地论'],
    '瑜伽': ['瑜伽师地论'],
    '起信论': ['大乘起信论'],
    '起信': ['大乘起信论'],
    '中论': ['中论'],
    '中观论': ['中论'],
    '百论': ['百论'],
    '十二门论': ['十二门论'],
    '肇论': ['肇论'],
    '大智度论': ['大智度论'],
    '智度论': ['大智度论'],
    '十地论': ['十地经论'],
    '摄论': ['摄大乘论'],
    '摄大乘': ['摄大乘论'],
    '成实论': ['成实论'],
    '因明论': ['因明入正理论'],
    '因明': ['因明入正理论'],
    // 律
    '四分律': ['四分律'],
    '四分': ['四分律'],
    '五分律': ['弥沙塞部和醯五分律'],
    '菩萨戒': ['梵网经'],
    '戒本': ['四分律比丘戒本', '四分僧戒本'],
    // 天台
    '法华玄义': ['妙法莲华经玄义'],
    '法华文句': ['妙法莲华经文句'],
    '摩诃止观': ['摩诃止观'],
    '止观': ['摩诃止观'],
  }

  const commentarySuffixes = [
    '疏钞', '疏记', '义疏', '略疏', '悬谈', '讲录', '讲记', '讲义',
    '集注', '科注', '子注', '合释', '通释', '详释', '会释',
    '玄义', '文句', '玄赞', '述记', '义记', '要解', '纲要', '直解', '略解', '集解',
    '科文', '音义', '句解', '私记', '别记', '纂要', '演义', '节要', '辑略', '撮要',
    '释签', '指掌', '入疏', '大疏', '略记', '广记', '要义', '指归', '决疑',
    '疏', '注', '记', '钞', '解', '论', '义', '科'
  ]

  const processedCommentaryIds = new Set<string>()
  for (const rel of Object.values(commentaries)) {
    for (const commId of Object.keys(rel.commentaries)) {
      processedCommentaryIds.add(commId)
    }
  }

  let titleMatchedCommentaries = 0

  function findTargetSutra(shortName: string): string | null {
    // 优先使用硬编码映射
    if (wellKnownSutras[shortName]) {
      return wellKnownSutras[shortName]
    }

    let targetId = titleIndex.get(shortName)
    if (targetId) return targetId

    const fullNames = shortToFullNames[shortName]
    if (fullNames) {
      for (const fullName of fullNames) {
        // 先检查硬编码映射
        if (wellKnownSutras[fullName]) {
          return wellKnownSutras[fullName]
        }
        targetId = titleIndex.get(fullName)
        if (targetId) return targetId
        if (fullName.startsWith('佛说')) {
          targetId = titleIndex.get(fullName.slice(2))
          if (targetId) return targetId
        }
      }
    }

    // 模糊匹配
    for (const [title, id] of titleIndex) {
      if (title.includes(shortName) && !detectCommentaryType(title)) {
        const m = metaById.get(id)
        if (m && m.canonId === 'T') return id
      }
    }
    for (const [title, id] of titleIndex) {
      if (title.includes(shortName) && !detectCommentaryType(title)) {
        return id
      }
    }

    return null
  }

  for (const meta of allMetadata) {
    if (processedCommentaryIds.has(meta.id)) continue

    const commentaryType = detectCommentaryType(meta.title)
    if (!commentaryType) continue

    // 跳过特殊文档
    if (/造像记|碑记|石窟记|塔铭|墓志/.test(meta.title)) continue

    // 方法1：直接匹配（标题去掉注疏词后查找）
    for (const suffix of commentarySuffixes) {
      const pattern = new RegExp(`(.+)${suffix}$`)
      const match = meta.title.match(pattern)
      if (match) {
        const baseName = match[1]
        const targetId = findTargetSutra(baseName)
        if (targetId && targetId !== meta.id) {
          const targetMeta = metaById.get(targetId)
          if (!targetMeta) continue
          if (!isValidCommentaryDirection(meta.title, targetMeta.title)) continue

          if (!commentaries[targetId]) {
            commentaries[targetId] = {
              title: targetMeta.title,
              commentaries: {},
              relatedSutras: []
            }
          }

          if (!commentaries[targetId].commentaries[meta.id]) {
            commentaries[targetId].commentaries[meta.id] = {
              id: meta.id,
              title: meta.title,
              type: commentaryType,
              confidence: 0.8,
              source: 'rule:title_suffix'
            }
            titleMatchedCommentaries++
            processedCommentaryIds.add(meta.id)
          }
          break
        }
      }
    }

    // 方法2：简称匹配
    if (!processedCommentaryIds.has(meta.id)) {
      for (const [shortName, fullNames] of Object.entries(shortToFullNames)) {
        for (const suffix of commentarySuffixes) {
          if (meta.title.includes(shortName) && meta.title.includes(suffix)) {
            // 查找原经：优先 T 藏
            let targetId: string | null = null
            for (const fullName of fullNames) {
              for (const m of allMetadata) {
                if (m.title === fullName && !detectCommentaryType(m.title) && m.canonId === 'T') {
                  targetId = m.id
                  break
                }
              }
              if (targetId) break
              for (const m of allMetadata) {
                if (m.title === fullName && !detectCommentaryType(m.title)) {
                  targetId = m.id
                  break
                }
              }
              if (targetId) break
            }

            if (!targetId) {
              targetId = findTargetSutra(shortName)
            }

            if (!targetId || targetId === meta.id) continue

            const targetMeta = metaById.get(targetId)
            if (!targetMeta) continue
            if (!isValidCommentaryDirection(meta.title, targetMeta.title)) continue

            if (!commentaries[targetId]) {
              commentaries[targetId] = {
                title: targetMeta.title,
                commentaries: {},
                relatedSutras: []
              }
            }

            if (!commentaries[targetId].commentaries[meta.id]) {
              commentaries[targetId].commentaries[meta.id] = {
                id: meta.id,
                title: meta.title,
                type: commentaryType,
                confidence: 0.7,
                source: 'rule:short_name'
              }
              titleMatchedCommentaries++
              processedCommentaryIds.add(meta.id)
            }
            break
          }
        }
        if (processedCommentaryIds.has(meta.id)) break
      }
    }
  }

  console.log(`注疏关系（基于标题匹配补充）: +${titleMatchedCommentaries} 个注疏`)

  // 6. 提取同经异译
  const translations: TranslationGroup[] = []
  const processedIds = new Set<string>()

  // 基于 docNumber 中的 Nos. 格式
  const mergedGroups: Set<string>[] = []
  const idToGroup = new Map<string, Set<string>>()

  function extractGroupNumbers(numbersPart: string): string[] {
    const numbers: string[] = []
    const items = numbersPart.split(/,\s*/)
    for (const item of items) {
      const trimmed = item.trim()
      if (trimmed.includes('-') && !trimmed.includes('(')) {
        const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/)
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1])
          const end = parseInt(rangeMatch[2])
          for (let i = start; i <= end; i++) {
            numbers.push(i.toString())
          }
        }
      } else {
        const numMatch = trimmed.match(/^(\d+)$/)
        if (numMatch) {
          numbers.push(numMatch[1])
        }
      }
    }
    return numbers
  }

  for (const meta of allMetadata) {
    if (!meta.docNumber) continue

    const selfNo = meta.docNumber.match(/^No\.\s*(\d+)/)?.[1]
    if (!selfNo) continue

    // 匹配 Nos. 格式
    const nosMatches = meta.docNumber.match(/\[Nos\.\s*([^\]]+?)\]/g)
    if (nosMatches) {
      for (const match of nosMatches) {
        if (/^\[cf\.\s*Nos\./.test(match)) continue

        const numbersMatch = match.match(/Nos\.\s*([^\]]+)/)
        if (!numbersMatch) continue

        const numbersPart = numbersMatch[1].split(';')[0]
        const numbers = extractGroupNumbers(numbersPart)

        if (numbers.length === 0) continue
        if (!numbers.includes(selfNo)) {
          numbers.push(selfNo)
        }

        const idSet = new Set<string>()
        for (const num of numbers) {
          const ids = findIdsByDocNo(meta.canonId, `No. ${num}`)
          ids.forEach(id => idSet.add(id))
        }

        if (idSet.size < 2) continue

        const overlappingGroups = new Set<Set<string>>()
        for (const id of idSet) {
          const existingGroup = idToGroup.get(id)
          if (existingGroup) {
            overlappingGroups.add(existingGroup)
          }
        }

        if (overlappingGroups.size === 0) {
          const newGroup = new Set(idSet)
          mergedGroups.push(newGroup)
          for (const id of idSet) {
            idToGroup.set(id, newGroup)
          }
        } else {
          const targetGroup = [...overlappingGroups][0]
          for (const id of idSet) {
            targetGroup.add(id)
            idToGroup.set(id, targetGroup)
          }
          for (const otherGroup of overlappingGroups) {
            if (otherGroup !== targetGroup) {
              for (const id of otherGroup) {
                targetGroup.add(id)
                idToGroup.set(id, targetGroup)
              }
              const idx = mergedGroups.indexOf(otherGroup)
              if (idx >= 0) {
                mergedGroups.splice(idx, 1)
              }
            }
          }
        }
      }
    }
  }

  for (const idSet of mergedGroups) {
    if (idSet.size < 2) continue

    const sutras: SutraInfo[] = []
    for (const id of idSet) {
      const m = metaById.get(id)
      if (m) {
        sutras.push({ id: m.id, title: m.title })
        processedIds.add(m.id)
      }
    }

    if (sutras.length >= 2) {
      sutras.sort((a, b) => a.id.localeCompare(b.id))
      translations.push({
        baseTitle: normalizeTitle(sutras[0].title),
        sutras,
        source: 'rule:docNumber_nos'
      })
    }
  }

  console.log(`同经异译: ${translations.length} 组`)

  // 7. 统计注疏数量
  let finalCommentaryCount = 0
  for (const rel of Object.values(commentaries)) {
    finalCommentaryCount += Object.keys(rel.commentaries).length
  }

  // 8. 生成结果
  const result: RelationshipData = {
    description: 'CBETA 经文关系数据（基于 data-simplified 目录规则提取）',
    generatedAt: new Date().toISOString(),
    sourceDir: dataDir,
    statistics: {
      totalFiles: allMetadata.length,
      filesWithReferences: filesWithRefs,
      totalCommentaryRelations: Object.keys(commentaries).length,
      totalCommentaries: finalCommentaryCount,
      totalRelatedSutras,
      totalTranslationGroups: translations.length,
      totalTranslatedSutras: translations.reduce((sum, g) => sum + g.sutras.length, 0)
    },
    commentaries,
    translations
  }

  return result
}

// ==================== 入口 ====================

const dataDir = join(import.meta.dirname, '../../..', 'data-simplified')
const outputFile = join(import.meta.dirname, '../../..', 'relationships.json')

if (!existsSync(dataDir)) {
  console.error(`data-simplified 目录不存在: ${dataDir}`)
  process.exit(1)
}

const result = extractRelationships(dataDir)

writeFileSync(outputFile, JSON.stringify(result, null, 2), 'utf-8')
console.log(`\n结果已写入: ${outputFile}`)
console.log(`统计:`)
console.log(`  - 总文件数: ${result.statistics.totalFiles}`)
console.log(`  - 有引用的文件: ${result.statistics.filesWithReferences}`)
console.log(`  - 注疏关系: ${result.statistics.totalCommentaryRelations} 部原经 → ${result.statistics.totalCommentaries} 个注疏`)
console.log(`  - 同经异译: ${result.statistics.totalTranslationGroups} 组，共 ${result.statistics.totalTranslatedSutras} 部经`)
