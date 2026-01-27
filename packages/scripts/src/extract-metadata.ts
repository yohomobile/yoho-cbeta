/**
 * CBETA JSON 元数据提取脚本
 * 从 data-simplified/ 目录的 JSON 文件提取结构化元数据到 parsed/ 目录
 *
 * 规则能做的全部用规则，规则做不了的交给 AI：
 * ✅ 规则处理：标题、卷数、页码、目录、特征、docNumber、梵文/巴利文
 * ❌ AI 处理：byline（人物、朝代、年号、地点）
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join, dirname, relative } from 'path'
import { createHash } from 'crypto'
import { toTraditional } from './zhconv.js'
import authorOverridesJson from './author-overrides.json' with { type: 'json' }

// 加载作者覆盖配置
const AUTHOR_OVERRIDES: Record<string, Array<{
  name: string
  dynasty: string | null
  role: string
  identity?: string
  aliases?: string[]
}>> = authorOverridesJson as any

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

interface TocEntry {
  level: number
  type: string
  title: string
  juanNumber: number | null
}

// ==================== 作者/译者解析类型 ====================

interface PersonInfo {
  name: string                    // 人名
  dynasty: string | null          // 朝代（如「唐」「宋」）
  dynastyId: string | null        // 朝代ID（如 'tang', 'song'）
  nationality: string | null      // 国籍/地区（如「天竺」「龟兹」）
  role: string                    // 角色（如「译」「撰」「造」）
  roleType: ContributorRole       // 角色类型
  identity: string | null         // 身份（如「菩萨」「三藏」）
  aliases: string[] | null        // 别名（如「天亲」「世亲」「婆薮槃豆」）
}

type ContributorRole =
  | 'translator'    // 译者
  | 'author'        // 原作者/造论者
  | 'compiler'      // 编者/集者
  | 'commentator'   // 注疏者
  | 'recorder'      // 录者/记者
  | 'editor'        // 校订者
  | 'collaborator'  // 协作者
  | 'speaker'       // 说者/讲者
  | 'unknown'       // 未知

interface AuthorInfo {
  raw: string                     // 原始 author 字符串
  persons: PersonInfo[]           // 解析出的人物列表
  translationDynasty: string | null     // 翻译朝代
  translationDynastyId: string | null   // 翻译朝代ID
}

interface ParsedMetadata {
  // 基础信息
  id: string              // 文档ID，如 T01n0001
  canonId: string         // 藏经ID，如 T
  volume: string          // 册号，如 01
  number: string          // 经号，如 0001

  // 标题（规则处理）
  title: string           // 经典标题（已清理卷号、梵文、重复）
  titleSource: 'jhead' | 'head' | 'filename'
  titleRaw: string        // 原始标题（未清理）
  titleTraditional: string | null  // 繁体标题
  titleSanskrit: string | null  // 梵文标题
  titlePali: string | null      // 巴利文标题
  titleAlt: string | null       // 别名

  // 来源（规则处理）
  sourceText: string | null     // 来源，如 "大正新脩大藏经"

  // 分类（规则处理）
  categoryId: string | null     // 分类ID，如 'ahan', 'bore' 等

  // byline（原始文本）
  bylineRaw: string | null

  // 作者/译者信息（规则解析）
  authorRaw: string | null              // 原始 author 字符串
  persons: PersonInfo[]                 // 解析出的人物列表
  translationDynasty: string | null     // 翻译朝代
  translationDynastyId: string | null   // 翻译朝代ID

  // 结构信息（规则处理）
  juanCount: number       // 卷数
  pageStart: string | null  // 起始页码
  pageEnd: string | null    // 结束页码

  // 目录（规则处理）
  toc: TocEntry[]

  // 内容特征（规则处理）
  hasDharani: boolean     // 是否有陀罗尼/咒语
  hasVerse: boolean       // 是否有偈颂
  contentType: string | null  // sutra/vinaya/abhidharma/commentary/preface

  // 文号信息（规则处理）
  docNumber: string | null    // 原始文号，如 "No. 696"
  docNumberParsed: string[]   // 解析后的关联文号，如 ["No. 695"]

  // 元数据
  parsedAt: string
  sourceHash: string      // 源文件 hash
}

// ==================== 辅助函数 ====================

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
  // 跳过 note（脚注内容）
  if (element.tag === 'note') return ''
  // 跳过 rdg（异读/校勘变体），只保留 lem（正本）
  if (element.tag === 'rdg') return ''
  // 跳过 foreign（外文，通常是梵文/巴利文）
  if (element.tag === 'foreign') return ''
  return (element.children || []).map(child => extractText(child)).join('')
}

/** 从文件名解析 ID 信息 */
function parseId(id: string): { canonId: string; volume: string; number: string } {
  const match = id.match(/^([A-Z]+)(\d+)n(.+)$/)
  if (match) {
    return { canonId: match[1], volume: match[2], number: match[3] }
  }
  return { canonId: '', volume: '', number: id }
}

// ==================== 标题处理 ====================

/** 清理标题：移除卷号、梵文/巴利文、重复内容等 */
function cleanTitle(title: string): string {
  let cleaned = title

  // 移除换行符
  cleaned = cleaned.replace(/[\r\n]+/g, '')

  // 移除藏经函号（千字文编号）- 在清理空白之前处理
  // 函号通常出现在末尾，前面有空格，如 "经名　禄四"、"经名　羽"
  // 模式：空格 + 单字函号 + 可选数字
  cleaned = cleaned.replace(/\s+[\u4e00-\u9fa5][一二三四五六七八九十\d]*$/g, '')

  // 移除多余空白
  cleaned = cleaned.replace(/\s+/g, '')

  // 移除梵文/巴利文（拉丁字母+变音符号，包括可能的方括号或圆括号）
  // 先移除方括号中的内容（通常是梵文变体）
  cleaned = cleaned.replace(/\[[A-Za-zĀāĪīŪūṀṁṂṃṄṅṆṇṚṛṜṝḌḍḤḥḶḷṢṣṬṭŚśÑñḀẀẂẄỲỳ\s\-]+\]/g, '')
  // 移除圆括号中的纯梵文/巴利文（如 (Mahā-Vagga)）
  cleaned = cleaned.replace(/[（(][A-Za-zĀāĪīŪūṀṁṂṃṄṅṆṇṚṛṜṝḌḍḤḥḶḷṢṣṬṭŚśÑñḀẀẂẄỲỳ\s\-]+[）)]/g, '')
  // 再移除单独的梵文/巴利文
  cleaned = cleaned.replace(/[A-Za-zĀāĪīŪūṀṁṂṃṄṅṆṇṚṛṜṝḌḍḤḥḶḷṢṣṬṭŚśÑñḀẀẂẄỲỳ-]+/g, '')

  // 移除空方括号和空圆括号
  cleaned = cleaned.replace(/\[\s*\]/g, '')
  cleaned = cleaned.replace(/[（(]\s*[）)]/g, '')
  // 移除括号内只有卷号的情况 如 (第10卷-第13卷)
  cleaned = cleaned.replace(/[（(]第?[\d一二三四五六七八九十百千]+卷?[-－—~～至]第?[\d一二三四五六七八九十百千]+卷?[）)]/g, '')

  // 移除开头的标点符号
  cleaned = cleaned.replace(/^[.。、，,;；：:【】\[\]()（）]+/, '')

  // 移除卷号相关
  // 中文数字可能是组合形式如"一百二十五"
  const chineseNumPattern = '[一二三四五六七八九十百千零\\d]+'
  cleaned = cleaned.replace(new RegExp(`卷第?${chineseNumPattern}`, 'g'), '')
  cleaned = cleaned.replace(new RegExp(`卷之?${chineseNumPattern}`, 'g'), '')
  cleaned = cleaned.replace(/卷之?[上中下]/g, '')  // 如 "卷上"、"卷之上"
  cleaned = cleaned.replace(/卷第[上中下]/g, '')  // 如 "卷第上"
  cleaned = cleaned.replace(new RegExp(`${chineseNumPattern}卷$`, 'g'), '')
  // 移除 "第X卷" 格式
  cleaned = cleaned.replace(new RegExp(`第${chineseNumPattern}卷`, 'g'), '')
  // 移除末尾的 "第" (处理 "大藏一览第一卷" → "大藏一览第" 的残留)
  cleaned = cleaned.replace(/第$/g, '')
  // 移除末尾的 "之上/之下/之中"
  cleaned = cleaned.replace(/之[上中下]$/g, '')
  // 移除 "X卷Y部成" 这样的格式
  cleaned = cleaned.replace(new RegExp(`${chineseNumPattern}卷${chineseNumPattern}?部?成?`, 'g'), '')

  // 移除开头的标点符号（再次清理，因为移除其他内容后可能产生新的开头标点）
  cleaned = cleaned.replace(/^[.。、，,;；：:【】\[\]()（）]+/, '')

  // 再次移除空括号（可能是前面清理产生的）
  cleaned = cleaned.replace(/\[\s*\]/g, '')
  cleaned = cleaned.replace(/[（(]\s*[）)]/g, '')

  // 移除重复的经名（如"妙法莲华经妙法莲华经"）
  for (let attempt = 0; attempt < 3; attempt++) {
    const len = cleaned.length
    let found = false
    // 从较长的可能重复开始检查
    for (let i = Math.floor(len / 2); i >= 2; i--) {
      const prefix = cleaned.slice(0, i)
      if (cleaned.slice(i, i * 2) === prefix) {
        cleaned = prefix  // 保留一个而不是删除第一个
        found = true
        break
      }
    }
    if (!found) break
  }

  // 移除末尾重复字符
  cleaned = cleaned.replace(/(.)\1+$/g, '$1')

  // 移除末尾的空格+单字（通常是校勘者名字，如 "　俊"、"　转"）
  cleaned = cleaned.replace(/\s+[\u4e00-\u9fa5]$/g, '')

  // 移除末尾单独的单字（可能是残留的校勘者名字）
  // 只针对特定模式：如 "别录俊"（录+人名）、"历章振"（章+人名）、"过类䟽黍"（疏+人名）
  // 非常保守：只删除明显是人名的情况
  const suspiciousEndPattern = /[录目章疏䟽钞抄][\u4e00-\u9fa5]$/
  if (suspiciousEndPattern.test(cleaned) && cleaned.length > 4) {
    const lastChar = cleaned.slice(-1)
    // 只有末尾字不是常见的经名结尾字时才删除
    const safeEndChars = '经论律疏钞记传集要义品章节门分部卷篇录志目仪轨序跋注释解灯赞颂偈咒文抄本䟽'
    if (!safeEndChars.includes(lastChar)) {
      cleaned = cleaned.slice(0, -1)
    }
  }

  return cleaned.trim()
}

/** 递归查找所有指定标签的元素 */
function findAllElements(
  elements: (CbetaElement | string)[],
  tagName: string
): CbetaElement[] {
  const results: CbetaElement[] = []
  for (const el of elements) {
    if (typeof el === 'string') continue
    if (el.tag === tagName) results.push(el)
    if (el.children?.length > 0) {
      results.push(...findAllElements(el.children, tagName))
    }
  }
  return results
}

/** 提取梵文/巴利文标题 - 只从标题元素中查找 */
function extractSanskritPaliTitle(body: CbetaElement[]): { sanskrit: string | null; pali: string | null } {
  let sanskrit: string | null = null
  let pali: string | null = null

  // 只在标题元素（jhead 或 head）中查找
  const jhead = findFirst(body, el => el.tag === 'jhead')
  const head = findFirst(body, el => el.tag === 'head')
  const titleElement = jhead || head

  if (titleElement) {
    // 在标题元素内查找 t 元素
    const allT = findAllElements([titleElement], 't')
    for (const t of allT) {
      const lang = t.attrs.lang || ''
      const text = extractText(t).trim()
      if (lang === 'sa' && text && !sanskrit) {
        sanskrit = text
      }
      if (lang === 'pi' && text && !pali) {
        pali = text
      }
    }

    // 在标题元素内查找 note type=orig/mod 中的梵文/巴利文
    if (!sanskrit || !pali) {
      const notes = findAllElements([titleElement], 'note')
      for (const note of notes) {
        const noteType = note.attrs.type || ''
        if (noteType !== 'orig' && noteType !== 'mod') continue

        const text = extractText(note).trim()

        // 匹配常见的梵文经名格式
        if (!sanskrit) {
          const saMatch = text.match(/([A-Za-zĀāĪīŪūṀṁṂṃṄṅṆṇṚṛṜṝḌḍḤḥḶḷṢṣṬṭŚśÑñ-]+(?:\s+[A-Za-zĀāĪīŪūṀṁṂṃṄṅṆṇṚṛṜṝḌḍḤḥḶḷṢṣṬṭŚśÑñ-]+)*)/)
          if (saMatch && saMatch[1].length > 5) {
            sanskrit = saMatch[1]
          }
        }
      }
    }

    // 方法3：从原始标题文本中提取（如果上面没找到）
    if (!sanskrit || !pali) {
      const titleText = extractText(titleElement)
      // 匹配 Dīrgha-āgama 格式
      if (!sanskrit) {
        const saMatch = titleText.match(/([A-Za-zĀāĪīŪūṀṁṂṃṄṅṆṇṚṛṜṝḌḍḤḥḶḷṢṣṬṭŚśÑñ]+-[A-Za-zĀāĪīŪūṀṁṂṃṄṅṆṇṚṛṜṝḌḍḤḥḶḷṢṣṬṭŚśÑñ]+)/)
        if (saMatch) {
          sanskrit = saMatch[1]
        }
      }
      // 匹配 nikāya 格式（巴利文）
      if (!pali) {
        const piMatch = titleText.match(/([A-Za-zĀāĪīŪūṀṁṂṃṄṅṆṇṚṛṜṝḌḍḤḥḶḷṢṣṬṭŚśÑñ]+-nikāya)/i)
        if (piMatch) {
          pali = piMatch[1]
        }
      }
    }
  }

  return { sanskrit, pali }
}

/** 检查标题是否有效（不是纯卷号、不是单字等无意义内容） */
function isValidTitle(title: string): boolean {
  if (!title || title.length < 2) return false
  // 排除纯卷号
  if (/^第?[一二三四五六七八九十百千零\d]+卷?$/.test(title)) return false
  // 排除单个常见字
  if (/^[第卷序跋上中下之]$/.test(title)) return false
  // 排除章节篇名（如 "第一章"、"第八篇"、"上篇"）
  if (/^第?[一二三四五六七八九十百千零\d]+[章篇节品分]$/.test(title)) return false
  if (/^[上中下][篇章卷]$/.test(title)) return false
  // 排除纯品名（如 "迦旃延品"）- 太短的品名
  if (/^.{1,4}品$/.test(title) && title.length < 6) return false
  return true
}

/** 提取标题 */
function extractTitle(body: CbetaElement[]): {
  title: string
  titleRaw: string
  source: 'jhead' | 'head' | 'filename'
} {
  // 优先查找 jhead
  const jhead = findFirst(body, el => el.tag === 'jhead')
  if (jhead) {
    const text = extractText(jhead).trim()
    if (text) {
      const cleaned = cleanTitle(text)
      // 检查清理后的标题是否有效
      if (isValidTitle(cleaned)) {
        return { title: cleaned, titleRaw: text, source: 'jhead' }
      }
    }
  }

  // 其次查找 head
  const head = findFirst(body, el => el.tag === 'head')
  if (head) {
    const titleEl = findFirst(head.children, el => el.tag === 'title')
    if (titleEl) {
      const text = extractText(titleEl).trim()
      if (text) {
        const cleaned = cleanTitle(text)
        if (isValidTitle(cleaned)) {
          return { title: cleaned, titleRaw: text, source: 'head' }
        }
      }
    }
    const text = extractText(head).trim()
    if (text) {
      const cleaned = cleanTitle(text)
      if (isValidTitle(cleaned)) {
        return { title: cleaned, titleRaw: text, source: 'head' }
      }
    }
  }

  return { title: '', titleRaw: '', source: 'filename' }
}

/** 从原始标题提取别名
 *
 * 别名格式：
 * - "菩提道次第论摄颂（又名诸善乐根本颂）" → "诸善乐根本颂"
 * - "由说甚深缘起门中称赞无上大师世尊善说心藏略名「缘起赞」" → "缘起赞"
 * - "剃发仪式（即出家落发仪）" → "出家落发仪"
 * - "律藏　　经分别（Sutta-Vibhaṅga）" → "Sutta-Vibhaṅga"
 */
function extractTitleAlt(titleRaw: string): string | null {
  if (!titleRaw) return null

  // 模式1：又名 X（可用于 titleAlt）
  const youming = titleRaw.match(/又名([^\s（）()]{3,})/)
  if (youming) {
    return youming[1]
  }

  // 模式2：略名「X」或略名「X」
  const lue = titleRaw.match(/略名[「"]([^」"]+)[」"]/)
  if (lue) {
    return lue[1]
  }

  // 模式3：括号内是别名（排除卷号、数字、常见标注词）
  const excludePatterns = [
    /^卷[一二三四五六七八九十\d]+$/,  // 卷号
    /^[一二三四五六七八九十\d]+$/,    // 纯数字
    /^共.+$/,                          // "共五十八颂"
    /^古德宝训/,                       // 标注词
    /^依疏/,                           // 标注词
    /^即/,                             // 可能是 "即X"
  ]

  const parenMatch = titleRaw.match(/[（(]([^）()]{4,})[）)]/)
  if (parenMatch) {
    const alt = parenMatch[1].trim()
    // 检查是否应该排除
    const shouldExclude = excludePatterns.some(p => p.test(alt))
    if (!shouldExclude && alt.length >= 3) {
      return alt
    }
  }

  // 模式4：Pali/梵文名称（括号内的英文字符串）
  const paliMatch = titleRaw.match(/[（(]([A-Za-zĀāĪīŪūṀṁṂṃṄṅṆṇṚṛṜṝḌḍḤḥḶḷṢṣṬṭŚśÑñ\-]+)[）)]/)
  if (paliMatch) {
    return paliMatch[1]
  }

  return null
}

// ==================== 分类映射表 ====================

/** 大正藏分类映射表 (按卷号范围) */
const TAISHO_CATEGORIES: { id: string; name: string; volStart: number; volEnd: number }[] = [
  { id: 'ahan', name: '阿含部', volStart: 1, volEnd: 2 },
  { id: 'benyuan', name: '本缘部', volStart: 3, volEnd: 4 },
  { id: 'bore', name: '般若部', volStart: 5, volEnd: 8 },
  { id: 'fahua', name: '法华部', volStart: 9, volEnd: 9 },
  { id: 'huayan', name: '华严部', volStart: 10, volEnd: 10 },
  { id: 'baoji', name: '宝积部', volStart: 11, volEnd: 11 },
  { id: 'niepan', name: '涅槃部', volStart: 12, volEnd: 12 },
  { id: 'daji', name: '大集部', volStart: 13, volEnd: 13 },
  { id: 'jingji', name: '经集部', volStart: 14, volEnd: 17 },
  { id: 'mimi', name: '密教部', volStart: 18, volEnd: 21 },
  { id: 'lv', name: '律部', volStart: 22, volEnd: 24 },
  { id: 'shizong', name: '释经论部', volStart: 25, volEnd: 25 },
  { id: 'pitan', name: '毗昙部', volStart: 26, volEnd: 29 },
  { id: 'zhongguan', name: '中观部', volStart: 30, volEnd: 30 },
  { id: 'yuqie', name: '瑜伽部', volStart: 31, volEnd: 31 },
  { id: 'lunji', name: '论集部', volStart: 32, volEnd: 32 },
  { id: 'jinglu', name: '经录部', volStart: 49, volEnd: 49 },
  { id: 'shizuan', name: '史传部', volStart: 50, volEnd: 52 },
  { id: 'shihui', name: '事汇部', volStart: 53, volEnd: 53 },
  { id: 'waijiao', name: '外教部', volStart: 54, volEnd: 54 },
  { id: 'mulu', name: '目录部', volStart: 55, volEnd: 55 },
  // 大正藏续藏 (56-85)
  { id: 'xu_zhou', name: '续藏', volStart: 56, volEnd: 85 },
]

/** 根据藏经代码和卷号确定分类 */
function getCategoryId(canonId: string, volume: string): string | null {
  const vol = parseInt(volume, 10)
  if (Number.isNaN(vol)) return null

  // 大正藏分类
  if (canonId === 'T') {
    for (const cat of TAISHO_CATEGORIES) {
      if (vol >= cat.volStart && vol <= cat.volEnd) {
        return cat.id
      }
    }
    return 'xu_zhou' // 默认归入续藏
  }

  // 其他藏经暂无分类映射，返回 null
  return null
}

// ==================== 目录和卷处理 ====================

/** 从 mulu.n 提取卷号 */
function extractJuanNumber(n: string): number | null {
  if (!n) return null
  // 尝试解析纯数字
  const num = parseInt(n.replace(/^0+/, ''), 10)
  if (!Number.isNaN(num) && num > 0) {
    return num
  }
  // 尝试从混合字符串中提取数字
  const match = n.match(/\d+/)
  if (match) {
    const num2 = parseInt(match[0], 10)
    if (num2 > 0) return num2
  }
  return null
}

/** 提取目录（遍历时追踪当前卷号） */
function extractToc(body: CbetaElement[]): TocEntry[] {
  const entries: TocEntry[] = []
  let currentJuan = 0

  function walk(elements: (CbetaElement | string)[]) {
    for (const el of elements) {
      if (typeof el === 'string') continue

      // 遇到 milestone unit="juan" 时更新当前卷号
      if (el.tag === 'milestone' && el.attrs.unit === 'juan') {
        const n = el.attrs.n || '0'
        currentJuan = parseInt(n.replace(/^0+/, '') || '0', 10)
      }

      // 遇到 juan 标签时更新当前卷号
      if (el.tag === 'juan' && el.attrs.n) {
        const n = el.attrs.n
        currentJuan = parseInt(n.replace(/^0+/, '') || '0', 10)
      }

      // 遇到 mulu 时记录条目
      if (el.tag === 'mulu') {
        const title = extractText(el).trim()
        entries.push({
          level: parseInt(el.attrs.level || '1', 10),
          type: el.attrs.type || '',
          title,
          juanNumber: currentJuan > 0 ? currentJuan : null
        })
      }

      // 递归处理子元素
      if (el.children?.length > 0) {
        walk(el.children)
      }
    }
  }

  walk(body)
  return entries
}

/** 统计卷数 */
function countJuan(body: CbetaElement[]): number {
  // 方法1：统计 milestone unit="juan"
  const milestones = findElements(body, el =>
    el.tag === 'milestone' && el.attrs.unit === 'juan'
  )
  if (milestones.length > 0) return milestones.length

  // 方法2：统计 juan 标签
  const juans = findElements(body, el => el.tag === 'juan' && el.attrs.fun !== 'close')
  return juans.length || 1
}

/** 提取页码范围 */
function extractPageRange(body: CbetaElement[]): { start: string | null; end: string | null } {
  // 方法1: 优先使用 <pb> 标签
  const pageBreaks = findElements(body, el => el.tag === 'pb' && el.attrs.n)
  if (pageBreaks.length > 0) {
    return {
      start: pageBreaks[0].attrs.n,
      end: pageBreaks[pageBreaks.length - 1].attrs.n
    }
  }

  // 方法2: 后备方案 - 从 <lb> 标签提取页码（取每页第一行的页码）
  const lineBreaks = findElements(body, el => el.tag === 'lb' && el.attrs.n)

  if (lineBreaks.length === 0) {
    return { start: null, end: null }
  }

  // 提取页码部分（格式如 0855c03 -> 0855c）
  const extractPageNum = (n: string): string | null => {
    const match = n.match(/^(\d+[a-z])/)
    return match ? match[1] : null
  }

  const lineNums = lineBreaks.map(lb => lb.attrs.n)
  const pageNums = lineNums.map(extractPageNum).filter((p): p is string => p !== null)

  // 去重并获取首尾页码
  const uniquePages = [...new Set(pageNums)]

  if (uniquePages.length === 0) {
    return { start: null, end: null }
  }

  return {
    start: uniquePages[0],
    end: uniquePages[uniquePages.length - 1]
  }
}

// ==================== 内容特征检测 ====================

/** 检测陀罗尼/咒语 */
function hasDharani(body: CbetaElement[]): boolean {
  return findFirst(body, el => {
    // 检查 cb:type 属性（陀罗尼段落标记，如 <p cb:type="dharani">）
    const cbType = el.attrs['cb:type']
    if (cbType === 'dharani' || cbType === 'mantra') return true
    // 检查 div type 属性
    if (el.tag === 'div' && (el.attrs.type === 'dharani' || el.attrs.type === 'mantra')) return true
    return false
  }) !== null
}

/** 检测偈颂 */
function hasVerse(body: CbetaElement[]): boolean {
  return findFirst(body, el => el.tag === 'lg') !== null
}

/** 判断内容类型 */
function detectContentType(body: CbetaElement[]): string | null {
  const divsWithType = findElements(body, el => el.tag === 'div' && el.attrs.type)
  const divTypes = divsWithType.map(d => d.attrs.type)

  const allDivs = findElements(body, el => el.tag === 'div')
  const hasAnyDiv = allDivs.length > 0

  // 如果有 div.type="other"，返回 commentary（这些是现代著作/工具书等）
  if (divTypes.some(t => t === 'other')) return 'commentary'

  if (divTypes.some(t => t === 'jing' || t === '經')) return 'sutra'
  if (divTypes.some(t => t === 'xu' || t === '序')) return 'preface'
  if (divTypes.some(t => t === 'pin' || t === '品')) return 'sutra'
  if (divTypes.some(t => t === 'commentary' || t === '疏' || t === '釋')) return 'commentary'
  if (divTypes.some(t => t === 'vinaya' || t === '律')) return 'vinaya'
  if (divTypes.some(t => t === 'abhidharma' || t === '論')) return 'abhidharma'
  if (divTypes.some(t => t === 'fen' || t === '分')) return 'sutra'
  if (divTypes.some(t => t === 'mu' || t === '母')) return 'sutra'
  if (divTypes.some(t => t === 'xiang' || t === '相')) return 'sutra'
  if (divTypes.some(t => t === 'jie' || t === '節')) return 'sutra'
  if (divTypes.some(t => t === 'hui' || t === '會')) return 'sutra'
  if (divTypes.some(t => t === 'zhang' || t === '章')) return 'sutra'
  if (divTypes.some(t => t === 'di' || t === '第')) return 'sutra'
  if (divTypes.some(t => t === 'w' || t === '偈')) return 'verse'
  if (divTypes.some(t => t === 'lg')) return 'verse'

  // 如果有 div 但没有带 type 的，根据其他特征判断
  if (hasAnyDiv) {
    const hasByline = findFirst(body, el => el.tag === 'byline') !== null
    return hasByline ? 'commentary' : 'sutra'
  }

  // 如果没有任何 div，根据其他结构特征判断
  // 有 byline 的是注释/序跋类，没有 byline 的是正文类
  const hasByline = findFirst(body, el => el.tag === 'byline') !== null
  const hasMulu = findFirst(body, el => el.tag === 'mulu') !== null

  if (hasByline || hasMulu) {
    return 'commentary'
  }

  // 完全没有结构特征的，给 sutra 作为默认值
  return 'sutra'
}

// ==================== Byline 提取 ====================

/** 提取元素的纯文本内容（byline 专用：不过滤 note） */
function extractBylineText(element: CbetaElement | string): string {
  if (typeof element === 'string') return element
  return element.children?.map(child => extractBylineText(child)).join('') || ''
}

/** 提取 byline（只提取文本，解析交给 AI） */
function extractByline(body: CbetaElement[]): string | null {
  const bylines = findElements(body, el => el.tag === 'byline')
  if (bylines.length === 0) return null

  // 提取所有 byline 文本并去重（byline 内不过滤 note）
  const texts = bylines.map(bl => extractBylineText(bl).trim()).filter(t => t)
  const unique = [...new Set(texts)]

  return unique.length > 0 ? unique.join('；') : null
}

// ==================== 作者/译者解析 ====================

/** 朝代映射表 */
const DYNASTY_MAP: Record<string, { id: string; name: string }> = {
  // 秦汉
  '秦': { id: 'qin', name: '秦' },
  '前秦': { id: 'qin-former', name: '前秦' },
  '苻秦': { id: 'qin-former', name: '前秦' },
  '符秦': { id: 'qin-former', name: '前秦' },
  '后秦': { id: 'qin-later', name: '后秦' },
  '姚秦': { id: 'qin-later', name: '后秦' },
  '西汉': { id: 'han-west', name: '西汉' },
  '东汉': { id: 'han-east', name: '东汉' },
  '后汉': { id: 'han-east', name: '东汉' },
  // 三国
  '三国': { id: 'three-kingdoms', name: '三国' },
  '曹魏': { id: 'wei-cao', name: '曹魏' },
  '吴': { id: 'wu', name: '吴' },
  '蜀': { id: 'shu', name: '蜀' },
  // 两晋
  '西晋': { id: 'jin-west', name: '西晋' },
  '东晋': { id: 'jin-east', name: '东晋' },
  // 十六国（前秦已在秦汉部分）
  '前凉': { id: 'liang-former', name: '前凉' },
  '后凉': { id: 'liang-later-16', name: '后凉' },
  '南凉': { id: 'liang-south', name: '南凉' },
  '北凉': { id: 'liang-north', name: '北凉' },
  '西凉': { id: 'liang-west', name: '西凉' },
  '后燕': { id: 'yan-later', name: '后燕' },
  '西秦': { id: 'qin-west', name: '西秦' },
  '乞伏秦': { id: 'qin-west', name: '西秦' },
  // 南北朝
  '刘宋': { id: 'song-liu', name: '刘宋' },
  '南齐': { id: 'qi-south', name: '南齐' },
  '萧齐': { id: 'qi-south', name: '南齐' },
  '梁': { id: 'liang', name: '梁' },
  '陈': { id: 'chen', name: '陈' },
  '北魏': { id: 'wei-north', name: '北魏' },
  '元魏': { id: 'wei-north', name: '北魏' },
  '后魏': { id: 'wei-north', name: '北魏' },
  '东魏': { id: 'wei-east', name: '东魏' },
  '西魏': { id: 'wei-west', name: '西魏' },
  '北齐': { id: 'qi-north', name: '北齐' },
  '高齐': { id: 'qi-north', name: '北齐' },
  '北周': { id: 'zhou-north', name: '北周' },
  '宇文周': { id: 'zhou-north', name: '北周' },
  '南北朝': { id: 'southern-northern', name: '南北朝' },
  // 隋唐五代
  '隋': { id: 'sui', name: '隋' },
  '唐': { id: 'tang', name: '唐' },
  '五代': { id: 'five-dynasties', name: '五代' },
  '后梁': { id: 'liang-later', name: '后梁' },
  '后唐': { id: 'tang-later', name: '后唐' },
  '后晋': { id: 'jin-later', name: '后晋' },
  '后周': { id: 'zhou-later', name: '后周' },
  '南唐': { id: 'tang-south', name: '南唐' },
  '南汉': { id: 'han-south', name: '南汉' },
  '吴越': { id: 'wuyue', name: '吴越' },
  // 宋元明清
  '宋': { id: 'song', name: '宋' },
  '北宋': { id: 'song-north', name: '北宋' },
  '南宋': { id: 'song-south', name: '南宋' },
  '辽': { id: 'liao', name: '辽' },
  '金': { id: 'jin', name: '金' },
  '元': { id: 'yuan', name: '元' },
  '明': { id: 'ming', name: '明' },
  '清': { id: 'qing', name: '清' },
  '民国': { id: 'minguo', name: '民国' },
  // 西夏
  '西夏': { id: 'xixia', name: '西夏' },
  '夏': { id: 'xixia', name: '西夏' },
  // 外国
  '新罗': { id: 'silla', name: '新罗' },
  '高丽': { id: 'goryeo', name: '高丽' },
  '日本': { id: 'japan', name: '日本' },
  '日': { id: 'japan', name: '日本' },
  '朝鲜': { id: 'joseon', name: '朝鲜' },
  '韩国': { id: 'korea', name: '韩国' },
  '胡': { id: 'hu', name: '胡' },
  // 晋（统称）
  '晋': { id: 'jin-dynasty', name: '晋' },
  '晋世': { id: 'jin-dynasty', name: '晋' },
}

/** 角色关键词映射 */
const ROLE_MAP: Record<string, ContributorRole> = {
  // 多字角色词优先（按长度排序，正则匹配时长词优先）
  '口述': 'speaker',       // 如「法尊口述」
  '口说': 'speaker',       // 如「口说」
  '传译': 'translator',
  '傳譯': 'translator',
  // 单字角色词
  '译': 'translator',
  '譯': 'translator',
  '造': 'author',
  '作': 'author',
  '著': 'author',
  '撰': 'compiler',
  '集': 'compiler',
  '辑': 'compiler',
  '輯': 'compiler',
  '编': 'compiler',
  '編': 'compiler',
  '纂': 'compiler',
  '纘': 'compiler',
  '述': 'commentator',
  '注': 'commentator',
  '註': 'commentator',
  '疏': 'commentator',
  '解': 'commentator',
  '释': 'commentator',
  '釋': 'commentator',
  '录': 'recorder',
  '錄': 'recorder',
  '记': 'recorder',
  '記': 'recorder',
  '校': 'editor',
  '订': 'editor',
  '訂': 'editor',
  '定': 'editor',
  '补': 'editor',
  '補': 'editor',
  '增': 'editor',
  '说': 'speaker',
  '說': 'speaker',
  '讲': 'speaker',
  '講': 'speaker',
  '演': 'speaker',
  // 补充更多角色词
  '本': 'author',        // 如「慧立本」
  '笺': 'commentator',   // 如「彦悰笺」
  '箋': 'commentator',
  '次': 'editor',        // 如「诠次」
  '制': 'author',        // 如「太宗朱棣制」
  '唱': 'author',        // 如「原唱」
  '答': 'commentator',   // 如「仰答」
  '问': 'author',        // 如「设问」
  '問': 'author',
  '会': 'compiler',      // 如「辩才会」
  '會': 'compiler',
  '编修': 'compiler',    // 如「惟净等编修」
  '編修': 'compiler',
  '挈': 'editor',        // 如「提挈」
  '拟': 'author',        // 如「追拟」
  '擬': 'author',
  '颂': 'author',        // 如「颂古」
  '頌': 'author',
  '评': 'commentator',   // 如「评唱」
  '評': 'commentator',
  '抄': 'recorder',      // 如「译抄」
  '整理': 'editor',      // 如「方广锠整理」
  '着': 'author',        // 如「释印顺着」（着=著）
  '科': 'commentator',   // 如「智素科」（科判）
  '俗诠': 'commentator', // 如「明昱俗诠」
  '证义': 'commentator', // 如「明昱证义」
  '绎': 'commentator',   // 如「弘赞绎」
  '简要': 'editor',      // 如「李贽简要」
  // 复合角色词
  '科摄': 'commentator', // 如「弘悲科摄」
  '编注': 'commentator', // 如「伊文思温慈编注」
  '編注': 'commentator',
  '纂集': 'compiler',    // 如「伊文思温慈纂集」
  '纂輯': 'compiler',
  '译英': 'translator',  // 如「达瓦桑杜译英」
  '译汉': 'translator',  // 如「赵洪铸译汉」
  '译藏': 'translator',  // 如「法成译藏」
  '譯英': 'translator',
  '譯漢': 'translator',
  '譯藏': 'translator',
  '正译汉': 'translator', // 如「张妙定莲菩提金刚正译汉」
  '还译': 'translator',  // 如「观空还译」
  '還譯': 'translator',
  // 特殊角色
  '原诗': 'author',      // 如「寒山丰干拾得原诗」
  '原詩': 'author',
  '和': 'author',        // 如「梵琦济岳和」（和诗）
  '绘图': 'author',      // 如「费丹旭绘图」
  '繪圖': 'author',
  '集证': 'commentator', // 如「许光清集证」
  '集證': 'commentator',
  '科注': 'commentator', // 如「有闻科注」
  '科註': 'commentator',
  '证正': 'editor',      // 如「圣奎证正」
  '證正': 'editor',
  '释要': 'commentator', // 如「倓虚释要」
  '釋要': 'commentator',
  '诠注': 'commentator', // 如「杨彦国诠注」
  '詮注': 'commentator',
  '詮註': 'commentator',
  '译经': 'translator',  // 如「求那跋陀罗译经」
  '譯經': 'translator',
  // 编修类
  '钩沈': 'compiler',    // 如「唐晏钩沈」（辑佚）
  '鉤沈': 'compiler',
  '重修': 'editor',      // 如「释印光重修」
  '增修': 'editor',      // 如「范承勋增修」
  '续修': 'editor',      // 如「性幽独往等编订续修」
  '續修': 'editor',
  '编订': 'editor',      // 如「性幽独往等编订续修」
  '編訂': 'editor',
  '修': 'editor',        // 如「黄之隽等修」
  // 序跋类
  '序': 'author',        // 如「张抡序」
  '跋': 'author',        // 如「宗演跋」
  // 疏钞类
  '别行疏': 'commentator', // 如「澄观别行疏」
  '別行疏': 'commentator',
  '随疏钞': 'commentator', // 如「宗密随疏钞」
  '隨疏鈔': 'commentator',
  '并序': 'author',      // 如「智旭述并序」
  '並序': 'author',
  // 其他
  '重集': 'compiler',    // 如「不动金刚重集」
  '原辑': 'compiler',    // 如「普明原辑」
  '原輯': 'compiler',
  '原唱': 'author',      // 如「普明原唱」
  '和韵': 'author',      // 如「诸方和韵」
  '和韻': 'author',
  '编目': 'compiler',    // 如「如念编目」
  '編目': 'compiler',
  '重刻': 'editor',      // 如「智海重刻」「明声重刻」
  '塔铭': 'author',      // 如「陶汝鼐塔铭」
  '塔銘': 'author',
  '辑': 'compiler',      // 如「周理辑」
  '輯': 'compiler',
  '旧跋': 'author',      // 如「性音续集旧跋」
  '舊跋': 'author',
  '重校': 'editor',      // 如「大参重校」
  '语': 'author',        // 如「梦禅语」
  '語': 'author',
  // 补充缺失的角色词（从 unknown 案例分析得出）
  '叙': 'author',        // 如「戒珠叙」（序的异体）
  '敘': 'author',
  '请来': 'compiler',    // 如「空海请来」（日僧请来经典）
  '請來': 'compiler',
  '将来': 'compiler',    // 如「宗叡将来」（日僧将来经典）
  '將來': 'compiler',
  '缉': 'compiler',      // 如「道宣缉」（辑的异体）
  '緝': 'compiler',
  '略': 'editor',        // 如「湛然略」（节略）
  '节要': 'editor',      // 如「净源节要」
  '節要': 'editor',
  '合': 'compiler',      // 如「宝贵合」（合编）
  '集出': 'compiler',    // 如「法显集出」
  '撰出': 'compiler',    // 如「僧璩撰出」
  '纂要': 'compiler',    // 如「如馨纂要」
  '纂要': 'compiler',
  '录存': 'recorder',    // 如「程兆鸾录存」
  '錄存': 'recorder',
  '节钞': 'editor',      // 如「弟子节钞」
  '節鈔': 'editor',
  '补注': 'commentator', // 如「袾宏补注」
  '補注': 'commentator',
  '補註': 'commentator',
  '造本论': 'author',    // 如「大域龙菩萨造本论」
  '造論': 'author',
  '造论': 'author',      // 如「智旭造论」
  // 继续补充缺失的角色词
  '补遗': 'compiler',    // 如「智素补遗」
  '補遺': 'compiler',
  '拾遗': 'compiler',    // 如「一拾遗」
  '拾遺': 'compiler',
  '约意': 'commentator', // 如「明昱约意」
  '約意': 'commentator',
  '御选': 'compiler',    // 如「世宗皇帝御选」
  '御選': 'compiler',
  '宗通': 'commentator', // 如「曾凤仪宗通」
  '疏义': 'commentator', // 如「智旭疏义」
  '疏義': 'commentator',
  '解义': 'commentator', // 如「解义」
  '解義': 'commentator',
  '出': 'compiler',      // 如「道标出」（出示、显出）
  '再治': 'editor',      // 如「湛然再治」
  '分会': 'editor',      // 如「本纯分会」（分科会解）
  '分會': 'editor',
  '拈别': 'commentator', // 如「心圆拈别」
  '拈別': 'commentator',
  '集梓': 'compiler',    // 如「火莲集梓」
  '抄之': 'recorder',    // 如「不空译抄之」
  '鈔之': 'recorder',
  '疏钞': 'commentator', // 如「袾宏疏钞」
  '疏鈔': 'commentator',
  '撷': 'compiler',      // 如「徐槐廷撷」（撷取）
  '擷': 'compiler',
  '颂古': 'author',      // 如「颂古」
  '頌古': 'author',
  '阅': 'editor',        // 如「参阅」
  '閱': 'editor',
  '参阅': 'editor',      // 如「参阅」
  '參閱': 'editor',
  '刊': 'editor',        // 如「重刊」
  '校勘': 'editor',      // 如「校勘」
  '勘': 'editor',        // 如「勘」
  '排': 'editor',        // 如「排」（排版）
  // 第三批补充
  '钞': 'commentator',   // 如「钱谦益钞」「明昱钞」
  '鈔': 'commentator',
  '赞': 'author',        // 如「澄照赞」
  '贊': 'author',
  '传': 'compiler',      // 如「般若传」（传记）
  '傳': 'compiler',
  '衷论': 'commentator', // 如「王耕心衷论」
  '赘言': 'commentator', // 如「明昱赘言」
  '贅言': 'commentator',
  '随笔': 'author',      // 如「智旭随笔」
  '隨筆': 'author',
  '立': 'author',        // 如「玄奘立」（建立、确立）
  '厘经合论': 'editor',  // 如「志宁厘经合论」
  '釐經合論': 'editor',
  '订正': 'editor',      // 如「木增订正」
  '訂正': 'editor',
  '治定': 'editor',      // 如「正止治定」
  '依经录': 'recorder',  // 如「一行慧觉依经录」
  '依經錄': 'recorder',
  // 第四批补充
  '顺朱': 'editor',      // 如「德玉顺朱」（顺科朱点）
  '順朱': 'editor',
  '刊正': 'editor',      // 如「净源刊正」
  '节': 'editor',        // 如「智旭节」（节要）
  '添改': 'editor',      // 如「守千添改」
  '编正': 'editor',      // 如「善卿编正」
  '編正': 'editor',
  '较': 'editor',        // 如「大建较」（校较）
  '較': 'editor',
  '发隐': 'commentator', // 如「袾宏发隐」
  '發隱': 'commentator',
  '表': 'author',        // 如「弘储表」（表文）
  '提纲': 'compiler',    // 如「葛䵻提纲」
  '提綱': 'compiler',
  '拈古': 'author',      // 如「正觉拈古」「重显拈古」
  '击节': 'commentator', // 如「克勤击节」
  '擊節': 'commentator',
  '上进': 'compiler',    // 如「道忞上进」
  '上進': 'compiler',
  '录疏注经': 'commentator', // 如「净源录疏注经」
  '文句': 'commentator', // 如「宋濂文句」
  '汇辑': 'compiler',    // 如「智旭汇辑」
  '彙輯': 'compiler',
  '执笔': 'author',      // 如「曹凌执笔」
  '執筆': 'author',
  // 第五批补充：authorRaw 中发现的复合角色词
  '编集': 'compiler',    // 如「宝成编集」
  '編集': 'compiler',
  '记录': 'recorder',    // 如「记录」
  '記錄': 'recorder',
  '撰述': 'compiler',    // 如「撰述」
  '理述': 'commentator', // 如「理述」
  '译述': 'translator',  // 如「译述」
  '譯述': 'translator',
  '编述': 'compiler',    // 如「编述」
  '編述': 'compiler',
  '集记': 'recorder',    // 如「集记」
  '集記': 'recorder',
  '撰集': 'compiler',    // 如「撰集」
  '集撰': 'compiler',    // 如「集撰」
  '编撰': 'compiler',    // 如「编撰」
  '編撰': 'compiler',
  '编录': 'compiler',    // 如「编录」
  '編錄': 'compiler',
  '集录': 'compiler',    // 如「集录」
  '集錄': 'compiler',
  '集注': 'commentator', // 如「集注」
  '集註': 'commentator',
  '记注': 'commentator', // 如「记注」
  '記註': 'commentator',
  '疏记': 'commentator', // 如「疏记」
  '疏記': 'commentator',
  '科疏': 'commentator', // 如「科疏」
  '疏注': 'commentator', // 如「疏注」
  '疏註': 'commentator',
  '注疏': 'commentator', // 如「注疏」
  '註疏': 'commentator',
  '述记': 'commentator', // 如「述记」
  '述記': 'commentator',
  '颂疏': 'commentator', // 如「颂疏」
  '頌疏': 'commentator',
  '录集': 'compiler',    // 如「录集」
  '錄集': 'compiler',
  '录记': 'recorder',    // 如「录记」
  '錄記': 'recorder',
  '校注': 'commentator', // 如「校注」
  '校註': 'commentator',
  '造颂': 'author',      // 如「造颂」
  '造頌': 'author',
  '集颂': 'author',      // 如「集颂」
  '集頌': 'author',
  '集释': 'commentator', // 如「集释」
  '集釋': 'commentator',
  '集疏': 'commentator', // 如「集疏」
  '释造': 'author',      // 如「释造」
  '釋造': 'author',
  '释说': 'speaker',     // 如「释说」
  '釋說': 'speaker',
  '造疏': 'commentator', // 如「造疏」
  '述注': 'commentator', // 如「述注」
  '述註': 'commentator',
  '译释': 'translator',  // 如「译释」
  '譯釋': 'translator',
  '译编': 'translator',  // 如「译编」
  '譯編': 'translator',
  '释录': 'commentator', // 如「释录」
  '釋錄': 'commentator',
  '释记': 'commentator', // 如「释记」
  '釋記': 'commentator',
}

/** 国籍/地区关键词 */
const NATIONALITY_KEYWORDS = [
  '天竺', '中天竺', '西天竺', '北天竺', '南天竺', '东天竺',
  '中印度', '印度', '古印度',
  '龟兹', '龜茲',
  '月支', '月氏',
  '康居',
  '安息',
  '于阗', '于闐',
  '罽宾', '罽賓',
  '西域',
]

/** 身份关键词 */
const IDENTITY_KEYWORDS = [
  '菩萨', '菩薩',
  '三藏', '三藏法师', '三藏法師',
  '法师', '法師',
  '沙门', '沙門',
  '比丘', '比丘尼',
  '居士',
  '大德',
  '国师', '國師',
  '尊者',
]

/** 解析 author 字符串 */
function parseAuthor(authorRaw: string | undefined): AuthorInfo {
  const result: AuthorInfo = {
    raw: authorRaw || '',
    persons: [],
    translationDynasty: null,
    translationDynastyId: null,
  }

  if (!authorRaw || authorRaw === 'CBETA') {
    return result
  }

  // 优先使用手动覆盖配置
  if (AUTHOR_OVERRIDES[authorRaw]) {
    const overrides = AUTHOR_OVERRIDES[authorRaw]
    for (const override of overrides) {
      const dynastyInfo = override.dynasty ? DYNASTY_MAP[override.dynasty] : null
      // override.role 直接就是 roleType（如 "translator", "compiler"）
      result.persons.push({
        name: override.name,
        dynasty: dynastyInfo?.name || override.dynasty,
        dynastyId: dynastyInfo?.id || null,
        nationality: null,
        role: '',
        roleType: override.role as ContributorRole,
        identity: override.identity || null,
        aliases: override.aliases || null,
      })
      // 记录翻译朝代
      if (!result.translationDynasty && dynastyInfo) {
        result.translationDynasty = dynastyInfo.name
        result.translationDynastyId = dynastyInfo.id
      }
    }
    return result
  }

  // 处理「失译」「阙译」等特殊情况
  if (/^失译|^阙译|^闕譯/.test(authorRaw)) {
    result.persons.push({
      name: '佚名',
      dynasty: null,
      dynastyId: null,
      nationality: null,
      role: '译',
      roleType: 'translator',
      identity: null,
      aliases: null,
    })
    return result
  }

  // 构建朝代正则
  const dynastyPattern = Object.keys(DYNASTY_MAP).join('|')
  const dynastyRegex = new RegExp(`^(${dynastyPattern})`)

  // 构建角色正则（按长度降序排列，让长词优先匹配）
  const rolePattern = Object.keys(ROLE_MAP).sort((a, b) => b.length - a.length).join('|')
  const roleRegex = new RegExp(`(${rolePattern})$`)

  // 构建国籍正则
  const nationalityPattern = NATIONALITY_KEYWORDS.join('|')
  const nationalityRegex = new RegExp(`(${nationalityPattern})`)

  // 构建身份正则
  const identityPattern = IDENTITY_KEYWORDS.join('|')
  const identityRegex = new RegExp(`(${identityPattern})`)

  // 分割多个贡献者（用空格、逗号、顿号等分隔）
  // 常见格式：
  // 1. "唐 玄奘译" - 单人
  // 2. "世亲菩萨造 唐 玄奘译" - 造论者 + 译者
  // 3. "隋 阇那崛多共笈多译" - 共译
  // 4. "(门人)慧启．智粤 等编" - 门人编辑
  // 5. "均如著 金知见编" - 多人不同角色（无朝代）
  // 6. "宗喀巴造 法尊译" - 造论者 + 译者（无朝代）

  // 先按主要分隔符分割
  // 分割条件1：空格后跟完整的「朝代+空格」模式，如「唐 」「宋 」
  // 分割条件2：角色词+空格，如「著 」「造 」「译 」「编 」等
  // 避免把「陈舜俞」中的「陈」当成朝代分隔
  const dynastyList = '后秦|前秦|东汉|西汉|东晋|西晋|东魏|西魏|北魏|后魏|元魏|北齐|高齐|北周|宇文周|南齐|萧齐|刘宋|曹魏|姚秦|苻秦|符秦|后汉|后梁|后唐|后晋|后周|北宋|南宋|南北朝|前凉|后凉|南凉|北凉|西凉|后燕|西秦|乞伏秦|南唐|南汉|吴越|新罗|高丽|朝鲜|韩国|西夏|晋世|三国|五代|民国|日本|日|唐|宋|隋|梁|陈|吴|蜀|辽|金|元|明|清|秦|胡|夏|晋'
  // 角色词列表（用于分割）- 多字词优先，然后是常见单字角色词
  const roleListForSplit = '口述|口说|传译|傳譯|译|譯|造|著|撰|编|編|述|注|註|疏|释|釋|录|錄|记|記|校|说|說|讲|講'
  // 分割正则：在「角色词+空格」后分割，或在「朝代+空格」前分割
  const splitRegex = new RegExp(`(?<=${roleListForSplit})\\s+|\\s+(?=(?:${dynastyList})\\s)`)
  const segments = authorRaw.split(splitRegex)

  for (const segment of segments) {
    if (!segment.trim()) continue

    // 跳过注释性内容
    if (/^\(参学\)|\(门人\)|\(嗣法\)|\(侍者\)|\(受业\)|\(法侣\)|\(小师\)/.test(segment)) {
      continue
    }

    const person: PersonInfo = {
      name: '',
      dynasty: null,
      dynastyId: null,
      nationality: null,
      role: '',
      roleType: 'unknown',
      identity: null,
      aliases: null,
    }

    let remaining = segment.trim()

    // 0. 移除括号内的附加信息（如「本印」「并印」「附刻」等）
    remaining = remaining.replace(/[（(][^）)]*[印刻][）)]/g, '').trim()

    // 1. 提取朝代（开头）
    // 注意：只有当朝代后面还有足够的人名（至少2字）时才提取
    // 避免把「元晓」「陈那」「明昱」等人名错误拆分
    // 已知的佛教人名前缀（不应该被当作朝代）
    // 包括：陈那（印度论师）、清辩/清辨（印度论师）、元晓（新罗高僧）、陈沂（明代人）
    const knownBuddhistNames = ['陈那', '清辩', '清辨', '元晓', '陈沂']
    const isKnownName = knownBuddhistNames.some(name => remaining.startsWith(name))

    if (!isKnownName) {
      // 朝代匹配：必须是「朝代+空格」的格式，如「唐 玄奘」
      // 避免把「金知见」中的「金」当成朝代
      const dynastyWithSpaceRegex = new RegExp(`^(${dynastyPattern})\\s+`)
      const dynastyMatch = remaining.match(dynastyWithSpaceRegex)
      if (dynastyMatch) {
        const dynastyKey = dynastyMatch[1]
        const dynastyInfo = DYNASTY_MAP[dynastyKey]
        const afterDynasty = remaining.slice(dynastyMatch[0].length).trim()
        // 朝代后面必须有至少2个字符，否则可能是人名的一部分
        if (dynastyInfo && afterDynasty.length >= 2) {
          person.dynasty = dynastyInfo.name
          person.dynastyId = dynastyInfo.id
          remaining = afterDynasty

          // 记录翻译朝代（取第一个有朝代的人）
          if (!result.translationDynasty) {
            result.translationDynasty = dynastyInfo.name
            result.translationDynastyId = dynastyInfo.id
          }
        }
      }
    }

    // 2. 提取国籍（可能在朝代后面）
    const nationalityMatch = remaining.match(nationalityRegex)
    if (nationalityMatch) {
      person.nationality = nationalityMatch[1]
      remaining = remaining.replace(nationalityRegex, '').trim()
    }

    // 3. 提取角色（结尾）
    const roleMatch = remaining.match(roleRegex)
    if (roleMatch) {
      person.role = roleMatch[1]
      person.roleType = ROLE_MAP[roleMatch[1]] || 'unknown'
      remaining = remaining.slice(0, -roleMatch[0].length).trim()
    }

    // 4. 提取身份（如「菩萨」「三藏」）
    const identityMatch = remaining.match(identityRegex)
    if (identityMatch) {
      person.identity = identityMatch[1]
      remaining = remaining.replace(identityRegex, '').trim()
    }

    // 5. 剩余的就是人名
    // 清理可能的干扰字符
    // 注意：只在协作词后面有空格或其他人名时才移除，避免误删人名的一部分
    // 如「与咸」是人名，不能删掉「与」
    remaining = remaining
      .replace(/^共(?=\s)/, '')        // 只移除后面有空格的协作词
      .replace(/^与(?=\s)/, '')
      .replace(/^及(?=\s)/, '')
      .replace(/^同(?=\s)/, '')
      .replace(/等$/, '')              // 移除"等"
      .replace(/[．、,，]/g, '')        // 移除分隔符
      .trim()

    if (remaining) {
      person.name = remaining
      // 如果没有朝代、没有角色词，纯现代人名，默认为 editor
      if (person.roleType === 'unknown' && !person.dynasty && !person.nationality) {
        // 检查是否是纯中文人名（2-10字）
        if (/^[\u4e00-\u9fa5]{2,10}$/.test(remaining)) {
          person.roleType = 'editor'
        }
      }
      result.persons.push(person)
    }
  }

  // 如果没有解析出任何人，尝试简单提取
  if (result.persons.length === 0 && authorRaw) {
    // 简单模式：直接提取角色
    const simpleRoleMatch = authorRaw.match(roleRegex)
    if (simpleRoleMatch) {
      const name = authorRaw.slice(0, -simpleRoleMatch[0].length).trim()
      if (name) {
        result.persons.push({
          name,
          dynasty: null,
          dynastyId: null,
          nationality: null,
          role: simpleRoleMatch[1],
          roleType: ROLE_MAP[simpleRoleMatch[1]] || 'unknown',
          identity: null,
          aliases: null,
        })
      }
    } else {
      // 没有角色词的情况，只有人名（通常是现代编者）
      const cleanName = authorRaw.replace(/[．、,，]/g, '').trim()
      if (cleanName && /^[\u4e00-\u9fa5]{2,10}$/.test(cleanName)) {
        // 纯中文名字，2-10个字，默认为编者
        result.persons.push({
          name: cleanName,
          dynasty: null,
          dynastyId: null,
          nationality: null,
          role: '',
          roleType: 'editor',  // 默认为编者
          identity: null,
          aliases: null,
        })
      }
    }
  }

  return result
}

// ==================== DocNumber 解析 ====================

/** 解析 docNumber，提取关联文号 */
function extractDocNumber(body: CbetaElement[]): { raw: string | null; parsed: string[] } {
  const docNumbers = findElements(body, el => el.tag === 'docNumber')
  if (docNumbers.length === 0) return { raw: null, parsed: [] }

  // 取第一个 docNumber
  const first = docNumbers[0]
  const raw = extractText(first).trim()

  // 解析关联文号
  const parsed: string[] = []

  // 匹配 [No. xxx], [Nos. xxx], [cf. No. xxx] 等格式
  const bracketPattern = /\[(?:Nos?\.?|cf\.?)\s*([^\]]+)\]/g
  let match
  while ((match = bracketPattern.exec(raw)) !== null) {
    // 解析括号内的内容
    const content = match[1]
    // 分割多个编号
    const parts = content.split(/[,;]/)
    for (const part of parts) {
      const trimmed = part.trim()
      if (trimmed) {
        // 标准化格式
        const numMatch = trimmed.match(/(\d+)/)
        if (numMatch) {
          parsed.push(`No. ${numMatch[1]}`)
        }
      }
    }
  }

  return { raw, parsed }
}

// ==================== 缓存管理 ====================

interface CacheData {
  [filePath: string]: string
}

function loadCache(cacheFile: string): CacheData {
  if (existsSync(cacheFile)) {
    try {
      return JSON.parse(readFileSync(cacheFile, 'utf-8'))
    } catch {
      return {}
    }
  }
  return {}
}

function saveCache(cacheFile: string, cache: CacheData): void {
  writeFileSync(cacheFile, JSON.stringify(cache, null, 2))
}

function getAllJsonFiles(dir: string): string[] {
  const files: string[] = []
  const items = readdirSync(dir)
  for (const item of items) {
    const fullPath = join(dir, item)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      files.push(...getAllJsonFiles(fullPath))
    } else if (item.endsWith('.json') && !item.startsWith('.')) {
      files.push(fullPath)
    }
  }
  return files
}

// ==================== 主程序 ====================

async function main() {
  const projectRoot = join(import.meta.dirname, '../../..')
  const dataDir = join(projectRoot, 'data-simplified')
  const parsedDir = join(projectRoot, 'parsed')
  const cacheFile = join(parsedDir, '.cache.json')

  // 确保输出目录存在
  if (!existsSync(parsedDir)) {
    mkdirSync(parsedDir, { recursive: true })
  }

  // 加载缓存
  const cache = loadCache(cacheFile)
  const newCache: CacheData = {}

  // 获取所有 JSON 文件
  console.log('扫描 data-simplified 目录...')
  const jsonFiles = getAllJsonFiles(dataDir)
  console.log(`找到 ${jsonFiles.length} 个 JSON 文件\n`)

  let processed = 0
  let skipped = 0
  let errors = 0

  for (const filePath of jsonFiles) {
    const relPath = relative(dataDir, filePath)

    try {
      const content = readFileSync(filePath, 'utf-8')
      const hash = createHash('md5').update(content).digest('hex')

      // 检查缓存
      const outputPath = join(parsedDir, relPath)
      if (cache[relPath] === hash && existsSync(outputPath)) {
        newCache[relPath] = hash
        skipped++
        continue
      }

      // 解析文件
      const json: CbetaJson = JSON.parse(content)
      const { canonId, volume, number } = parseId(json.id)
      let { title, titleRaw, source: titleSource } = extractTitle(json.body)

      // 如果从 body 提取的标题无效，回退到 header.title
      if (!title && json.header.title) {
        title = cleanTitle(json.header.title)
        titleRaw = json.header.title
        titleSource = 'head'  // 标记为来自 header
      }

      const { sanskrit, pali } = extractSanskritPaliTitle(json.body)
      const { start: pageStart, end: pageEnd } = extractPageRange(json.body)
      const { raw: docNumberRaw, parsed: docNumberParsed } = extractDocNumber(json.body)
      const authorInfo = parseAuthor(json.header.author)

      const metadata: ParsedMetadata = {
        id: json.id,
        canonId,
        volume,
        number,
        title: title || json.id,
        titleSource: title ? titleSource : 'filename',
        titleRaw: titleRaw || json.header.title,
        titleTraditional: toTraditional(titleRaw || json.header.title || ''),
        titleSanskrit: sanskrit,
        titlePali: pali,
        titleAlt: extractTitleAlt(titleRaw || json.header.title),
        sourceText: json.header.source || null,
        categoryId: getCategoryId(canonId, volume),
        bylineRaw: extractByline(json.body),
        authorRaw: json.header.author || null,
        persons: authorInfo.persons,
        translationDynasty: authorInfo.translationDynasty,
        translationDynastyId: authorInfo.translationDynastyId,
        juanCount: countJuan(json.body),
        pageStart,
        pageEnd,
        toc: extractToc(json.body),
        hasDharani: hasDharani(json.body),
        hasVerse: hasVerse(json.body),
        contentType: detectContentType(json.body),
        docNumber: docNumberRaw,
        docNumberParsed,
        parsedAt: new Date().toISOString(),
        sourceHash: hash
      }

      // 确保输出目录存在
      const outputDir = dirname(outputPath)
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true })
      }

      // 写入结果
      writeFileSync(outputPath, JSON.stringify(metadata, null, 2))
      newCache[relPath] = hash
      processed++

      // 进度显示
      if (processed % 500 === 0) {
        console.log(`已处理: ${processed}, 跳过: ${skipped}, 错误: ${errors}`)
      }
    } catch (err) {
      console.error(`解析失败: ${relPath}`, err)
      errors++
    }
  }

  // 保存缓存
  saveCache(cacheFile, newCache)

  console.log('\n=== 完成 ===')
  console.log(`处理: ${processed}`)
  console.log(`跳过 (未变更): ${skipped}`)
  console.log(`错误: ${errors}`)
}

main().catch(console.error)
