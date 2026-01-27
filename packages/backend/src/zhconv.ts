/**
 * zhconv - 简繁中文转换 (TypeScript 版)
 *
 * 基于 MediaWiki 的转换表，使用最大正向匹配算法
 * 原版: https://github.com/gumblex/zhconv
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Locale 回退顺序
const Locales: Record<string, string[]> = {
  'zh-cn': ['zh-cn', 'zh-hans', 'zh-sg', 'zh'],
  'zh-hk': ['zh-hk', 'zh-hant', 'zh-tw', 'zh'],
  'zh-tw': ['zh-tw', 'zh-hant', 'zh-hk', 'zh'],
  'zh-sg': ['zh-sg', 'zh-hans', 'zh-cn', 'zh'],
  'zh-my': ['zh-my', 'zh-sg', 'zh-hans', 'zh-cn', 'zh'],
  'zh-mo': ['zh-mo', 'zh-hk', 'zh-hant', 'zh-tw', 'zh'],
  'zh-hant': ['zh-hant', 'zh-tw', 'zh-hk', 'zh'],
  'zh-hans': ['zh-hans', 'zh-cn', 'zh-sg', 'zh'],
  'zh': ['zh']
}

interface ZhcDict {
  zh2Hans: Record<string, string>
  zh2Hant: Record<string, string>
  zh2CN: Record<string, string>
  zh2TW: Record<string, string>
  zh2HK: Record<string, string>
  zh2SG: Record<string, string>
  SIMPONLY: string[]
  TRADONLY: string[]
}

// 字典缓存
let zhcdicts: ZhcDict | null = null
let dictCache: Record<string, Record<string, string>> = {}
let pfsetCache: Record<string, Set<string>> = {}

/**
 * 加载字典
 */
function loadDict(): void {
  if (zhcdicts) return

  // 获取当前文件所在目录
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  const dictPath = join(__dirname, 'zhcdict.json')

  const content = readFileSync(dictPath, 'utf-8')
  zhcdicts = JSON.parse(content)
}

/**
 * 生成前缀集合 (用于最大正向匹配)
 */
function getPrefixSet(convDict: Record<string, string>): Set<string> {
  const pfset = new Set<string>()
  for (const word of Object.keys(convDict)) {
    for (let i = 1; i <= word.length; i++) {
      pfset.add(word.slice(0, i))
    }
  }
  return pfset
}

/**
 * 获取指定 locale 的转换字典
 */
function getDict(locale: string): Record<string, string> {
  if (!zhcdicts) {
    loadDict()
  }

  if (dictCache[locale]) {
    return dictCache[locale]
  }

  let dict: Record<string, string>

  switch (locale) {
    case 'zh-cn':
      dict = { ...zhcdicts!.zh2Hans, ...zhcdicts!.zh2CN }
      break
    case 'zh-tw':
      dict = { ...zhcdicts!.zh2Hant, ...zhcdicts!.zh2TW }
      break
    case 'zh-hk':
    case 'zh-mo':
      dict = { ...zhcdicts!.zh2Hant, ...zhcdicts!.zh2HK }
      break
    case 'zh-sg':
    case 'zh-my':
      dict = { ...zhcdicts!.zh2Hans, ...zhcdicts!.zh2SG }
      break
    case 'zh-hans':
      dict = zhcdicts!.zh2Hans
      break
    case 'zh-hant':
      dict = zhcdicts!.zh2Hant
      break
    default:
      dict = {}
  }

  dictCache[locale] = dict
  pfsetCache[locale] = getPrefixSet(dict)

  return dict
}

/**
 * 转换文本
 *
 * @param s 要转换的文本
 * @param locale 目标语言，如 'zh-cn', 'zh-tw', 'zh-hk', 'zh-hans', 'zh-hant'
 * @param update 可选的自定义转换规则
 * @returns 转换后的文本
 *
 * @example
 * convert('我幹什麼不干你事。', 'zh-cn') // => '我干什么不干你事。'
 * convert('人体内存在很多微生物', 'zh-tw') // => '人體內存在很多微生物'
 */
export function convert(s: string, locale: string, update?: Record<string, string>): string {
  if (locale === 'zh' || !(locale in Locales)) {
    return s
  }

  const zhdict = getDict(locale)
  let pfset = pfsetCache[locale]

  // 如果有自定义规则，扩展前缀集合
  let newset: Set<string> | null = null
  if (update) {
    newset = new Set<string>()
    for (const word of Object.keys(update)) {
      for (let i = 1; i <= word.length; i++) {
        newset.add(word.slice(0, i))
      }
    }
  }

  const result: string[] = []
  const N = s.length
  let pos = 0

  while (pos < N) {
    let i = pos
    let frag = s[pos]
    let maxword: string | null = null
    let maxpos = 0

    // 最大正向匹配
    while (i < N && (pfset.has(frag) || (newset && newset.has(frag)))) {
      if (update && frag in update) {
        maxword = update[frag]
        maxpos = i
      } else if (frag in zhdict) {
        maxword = zhdict[frag]
        maxpos = i
      }
      i++
      frag = s.slice(pos, i + 1)
    }

    if (maxword === null) {
      result.push(s[pos])
      pos++
    } else {
      result.push(maxword)
      pos = maxpos + 1
    }
  }

  return result.join('')
}

/**
 * 检测文本是简体还是繁体
 *
 * @param s 要检测的文本
 * @param full 是否完整检测（统计所有字符），默认 false（遇到第一个即返回）
 * @returns true=简体, false=繁体, null=无法判断
 */
export function isSimplified(s: string, full = false): boolean | null {
  if (!zhcdicts) {
    loadDict()
  }

  const simpOnly = new Set(zhcdicts!.SIMPONLY)
  const tradOnly = new Set(zhcdicts!.TRADONLY)

  let simp = 0
  let trad = 0

  if (full) {
    for (const ch of s) {
      if (simpOnly.has(ch)) {
        simp++
      } else if (tradOnly.has(ch)) {
        trad++
      }
    }
    if (simp > trad) return true
    if (simp < trad) return false
    return null
  } else {
    for (const ch of s) {
      if (simpOnly.has(ch)) return true
      if (tradOnly.has(ch)) return false
    }
    return null
  }
}

// 导出常用的转换函数
export const toSimplified = (s: string) => convert(s, 'zh-cn')
export const toTraditional = (s: string) => convert(s, 'zh-tw')
export const toHK = (s: string) => convert(s, 'zh-hk')
export const toTW = (s: string) => convert(s, 'zh-tw')
export const toCN = (s: string) => convert(s, 'zh-cn')
export const toSG = (s: string) => convert(s, 'zh-sg')

export default {
  convert,
  isSimplified,
  toSimplified,
  toTraditional,
  toHK,
  toTW,
  toCN,
  toSG
}
