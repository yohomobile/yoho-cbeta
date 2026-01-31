/**
 * 经书别名解析器
 * 从查询中识别经书别名并解析为 textId
 */

import { db } from "../../db/index.js"
import { sql } from "drizzle-orm"

export interface AliasMapping {
  alias: string
  canonicalTitle: string
  textId: string
  priority: number
}

/** 经典短语到经书的映射 */
const PHRASE_TO_SUTRA: Record<string, { textId: string; title: string }> = {
  // 心经相关
  "色即是空": { textId: "T08n0251", title: "般若波罗蜜多心经" },
  "空即是色": { textId: "T08n0251", title: "般若波罗蜜多心经" },
  "色不异空": { textId: "T08n0251", title: "般若波罗蜜多心经" },
  "空不异色": { textId: "T08n0251", title: "般若波罗蜜多心经" },
  "五蕴皆空": { textId: "T08n0251", title: "般若波罗蜜多心经" },
  "照见五蕴皆空": { textId: "T08n0251", title: "般若波罗蜜多心经" },
  "度一切苦厄": { textId: "T08n0251", title: "般若波罗蜜多心经" },
  "揭谛揭谛": { textId: "T08n0251", title: "般若波罗蜜多心经" },
  // 金刚经相关
  "应无所住而生其心": { textId: "T08n0235", title: "金刚般若波罗蜜经" },
  "应无所住": { textId: "T08n0235", title: "金刚般若波罗蜜经" },
  "一切有为法": { textId: "T08n0235", title: "金刚般若波罗蜜经" },
  "如梦幻泡影": { textId: "T08n0235", title: "金刚般若波罗蜜经" },
  "如露亦如电": { textId: "T08n0235", title: "金刚般若波罗蜜经" },
  "无我相无人相": { textId: "T08n0235", title: "金刚般若波罗蜜经" },
  "凡所有相皆是虚妄": { textId: "T08n0235", title: "金刚般若波罗蜜经" },
  // 法华经相关
  "开权显实": { textId: "T09n0262", title: "妙法莲华经" },
  "会三归一": { textId: "T09n0262", title: "妙法莲华经" },
  "火宅三车": { textId: "T09n0262", title: "妙法莲华经" },
  // 楞严经相关
  "七处征心": { textId: "T19n0945", title: "大佛顶如来密因修证了义诸菩萨万行首楞严经" },
  "八还辨见": { textId: "T19n0945", title: "大佛顶如来密因修证了义诸菩萨万行首楞严经" },
  // 维摩经相关
  "不二法门": { textId: "T14n0475", title: "维摩诘所说经" },
  "默然无言": { textId: "T14n0475", title: "维摩诘所说经" },
  // 坛经相关
  "本来无一物": { textId: "T48n2008", title: "六祖大师法宝坛经" },
  "菩提本无树": { textId: "T48n2008", title: "六祖大师法宝坛经" },
  "何处惹尘埃": { textId: "T48n2008", title: "六祖大师法宝坛经" },
}

export class AliasResolver {
  private aliasCache: Map<string, AliasMapping> = new Map()
  private initialized = false

  /**
   * 初始化别名缓存
   */
  async init(): Promise<void> {
    if (this.initialized) return

    const results = await db.execute(sql.raw(`
      SELECT alias, canonical_title, text_id, priority
      FROM text_aliases
      ORDER BY priority DESC
    `)) as unknown as Array<{
      alias: string
      canonical_title: string
      text_id: string
      priority: number
    }>

    for (const row of results) {
      // 只有当缓存中不存在该别名，或新的优先级更高时才更新
      const existing = this.aliasCache.get(row.alias)
      if (!existing || row.priority > existing.priority) {
        this.aliasCache.set(row.alias, {
          alias: row.alias,
          canonicalTitle: row.canonical_title,
          textId: row.text_id,
          priority: row.priority,
        })
      }
    }

    this.initialized = true
    console.log(`[AliasResolver] 已加载 ${this.aliasCache.size} 个经书别名`)
  }

  /**
   * 从查询中提取所有匹配的经书别名
   * 返回按优先级排序的匹配结果
   */
  extractAliases(query: string): AliasMapping[] {
    if (!this.initialized) {
      console.warn("[AliasResolver] 警告: 未初始化，请先调用 init()")
      return []
    }

    const matches: AliasMapping[] = []

    // 1. 检查经书别名
    for (const [alias, mapping] of this.aliasCache) {
      if (query.includes(alias)) {
        matches.push(mapping)
      }
    }

    // 2. 检查经典短语（优先级设为 200，高于普通别名）
    for (const [phrase, sutra] of Object.entries(PHRASE_TO_SUTRA)) {
      if (query.includes(phrase)) {
        // 检查是否已经有这个 textId（避免重复）
        if (!matches.some(m => m.textId === sutra.textId)) {
          matches.push({
            alias: phrase,
            canonicalTitle: sutra.title,
            textId: sutra.textId,
            priority: 200, // 短语匹配优先级最高
          })
        }
      }
    }

    // 按优先级排序（高优先级在前）
    return matches.sort((a, b) => b.priority - a.priority)
  }

  /**
   * 获取查询中提到的所有 textId
   */
  getTextIds(query: string): string[] {
    const matches = this.extractAliases(query)
    // 使用 Set 去重
    return [...new Set(matches.map(m => m.textId))]
  }

  /**
   * 检查 textId 是否在查询提到的经书中
   */
  isRelevantText(query: string, textId: string): boolean {
    const textIds = this.getTextIds(query)
    return textIds.includes(textId)
  }

  /**
   * 获取别名对应的正式标题
   */
  getCanonicalTitle(alias: string): string | undefined {
    return this.aliasCache.get(alias)?.canonicalTitle
  }

  /**
   * 获取别名对应的 textId
   */
  getTextId(alias: string): string | undefined {
    return this.aliasCache.get(alias)?.textId
  }
}

// 导出单例
export const aliasResolver = new AliasResolver()
