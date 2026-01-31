/**
 * 术语同义词解析器
 * 从数据库加载同义词，支持查询扩展
 */

import { db } from "../../db/index.js"
import { sql } from "drizzle-orm"

export interface SynonymMapping {
  canonicalTerm: string  // 标准词条
  synonym: string        // 同义词
  entityType: string     // 实体类型
  relationType: string   // 关系类型
  priority: number       // 优先级
}

/**
 * 扩展查询结果
 */
export interface ExpandedQuery {
  query: string           // 扩展后的查询文本
  type: 'original' | 'synonym' | 'canonical'  // 查询类型
  sourceTerm?: string     // 原始术语
  weight: number          // 检索权重 (0-1)
}

export class SynonymResolver {
  private synonymCache: Map<string, SynonymMapping[]> = new Map()
  private canonicalCache: Map<string, string> = new Map()
  private initialized = false

  /**
   * 初始化同义词缓存
   */
  async init(): Promise<void> {
    if (this.initialized) return

    const startTime = Date.now()

    const results = await db.execute(sql.raw(`
      SELECT canonical_term, synonym, entity_type, relation_type, priority
      FROM term_synonyms
      ORDER BY priority DESC, canonical_term
    `)) as unknown as Array<{
      canonical_term: string
      synonym: string
      entity_type: string
      relation_type: string
      priority: number
    }>

    // 建立正向索引：标准词 → 同义词列表
    for (const row of results) {
      if (!this.synonymCache.has(row.canonical_term)) {
        this.synonymCache.set(row.canonical_term, [])
      }
      this.synonymCache.get(row.canonical_term)!.push({
        canonicalTerm: row.canonical_term,
        synonym: row.synonym,
        entityType: row.entity_type,
        relationType: row.relation_type,
        priority: row.priority,
      })

      // 建立反向索引：同义词 → 标准词
      this.canonicalCache.set(row.synonym, row.canonical_term)
    }

    this.initialized = true
    const elapsed = Date.now() - startTime
    console.log(`[SynonymResolver] 已加载 ${this.synonymCache.size} 个词条的同义词 (${elapsed}ms)`)
  }

  /**
   * 获取词条的所有同义词
   */
  getSynonyms(term: string): string[] {
    if (!this.initialized) {
      console.warn('[SynonymResolver] 警告: 未初始化，请先调用 init()')
      return []
    }

    const mappings = this.synonymCache.get(term)
    return mappings ? mappings.map(m => m.synonym) : []
  }

  /**
   * 获取同义词的详细信息
   */
  getSynonymMappings(term: string): SynonymMapping[] {
    if (!this.initialized) {
      return []
    }

    return this.synonymCache.get(term) || []
  }

  /**
   * 反向查找：获取同义词对应的标准词
   */
  getCanonicalTerm(synonym: string): string | undefined {
    if (!this.initialized) {
      console.warn('[SynonymResolver] 警告: 未初始化，请先调用 init()')
      return undefined
    }

    return this.canonicalCache.get(synonym)
  }

  /**
   * 扩展查询：从查询中提取术语并生成扩展查询
   *
   * 返回的扩展查询包括：
   * 1. 原始查询（权重 1.0）
   * 2. 查询中术语的同义词扩展（权重 0.7-0.9）
   */
  expandQuery(query: string): ExpandedQuery[] {
    if (!this.initialized) {
      return [{ query, type: 'original', weight: 1.0 }]
    }

    const results: ExpandedQuery[] = []
    const processedTerms = new Set<string>()

    // 始终包含原查询
    results.push({ query, type: 'original', weight: 1.0 })

    // 遍历所有已知的标准词，检查是否在查询中
    for (const [canonicalTerm, synonyms] of this.synonymCache) {
      // 检查标准词是否在查询中
      if (query.includes(canonicalTerm)) {
        if (!processedTerms.has(canonicalTerm)) {
          processedTerms.add(canonicalTerm)

          for (const syn of synonyms) {
            // 如果同义词不在原查询中，添加为扩展查询
            if (!query.includes(syn.synonym)) {
              const expandedQuery = query.replace(canonicalTerm, syn.synonym)
              results.push({
                query: expandedQuery,
                type: 'synonym',
                sourceTerm: canonicalTerm,
                weight: syn.relationType === 'abbreviation' ? 0.8 : 0.9,
              })
            }
          }
        }
      }

      // 检查同义词是否在查询中，反向替换
      for (const syn of synonyms) {
        if (query.includes(syn.synonym) && !query.includes(canonicalTerm)) {
          if (!processedTerms.has(syn.synonym)) {
            processedTerms.add(syn.synonym)

            const expandedQuery = query.replace(syn.synonym, canonicalTerm)
            results.push({
              query: expandedQuery,
              type: 'canonical',
              sourceTerm: syn.synonym,
              weight: 1.0,  // 标准词权重更高
            })
          }
        }
      }
    }

    // 按权重排序，去重
    const unique = Array.from(
      new Map(results.map(r => [r.query, r])).values()
    ).sort((a, b) => b.weight - a.weight)

    // 限制扩展数量（避免过多查询）
    return unique.slice(0, 5)
  }

  /**
   * 检查两个词是否为同义词关系
   */
  areSynonyms(term1: string, term2: string): boolean {
    if (!this.initialized) return false

    // 检查 term1 → term2
    if (this.getSynonyms(term1).includes(term2)) return true

    // 检查 term2 → term1
    if (this.getSynonyms(term2).includes(term1)) return true

    // 检查它们是否指向同一标准词
    const canonical1 = this.getCanonicalTerm(term1)
    const canonical2 = this.getCanonicalTerm(term2)
    if (canonical1 && canonical1 === canonical2) return true

    return false
  }

  /**
   * 获取统计信息
   */
  getStats(): { termCount: number; totalSynonyms: number } {
    if (!this.initialized) {
      return { termCount: 0, totalSynonyms: 0 }
    }

    let totalSynonyms = 0
    for (const synonyms of this.synonymCache.values()) {
      totalSynonyms += synonyms.length
    }

    return {
      termCount: this.synonymCache.size,
      totalSynonyms,
    }
  }
}

// 导出单例
export const synonymResolver = new SynonymResolver()
