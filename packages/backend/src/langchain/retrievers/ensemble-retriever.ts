/**
 * Ensemble 融合检索器
 * 使用 RRF (Reciprocal Rank Fusion) 算法融合多路检索结果
 */

import { BaseRetriever } from "@langchain/core/retrievers"
import { Document } from "@langchain/core/documents"
import { CallbackManagerForRetrieverRun } from "@langchain/core/callbacks/manager"
import { SemanticRetriever } from "./semantic-retriever.js"
import { FulltextRetriever } from "./fulltext-retriever.js"
import { DictionaryRetriever } from "./dictionary-retriever.js"
import { aliasResolver, type AliasMapping } from "./alias-resolver.js"
import { synonymResolver, type ExpandedQuery } from "./synonym-resolver.js"
import type {
  EnsembleConfig,
  RetrieverConfig,
  RetrievalSource,
  ChunkMetadata,
  DictionaryMetadata,
  FusedResult,
  RetrievalMetrics,
} from "../types.js"

/** 检索结果（含指标） */
export interface RetrievalResultWithMetrics {
  results: FusedResult[]
  metrics: RetrievalMetrics
}

/**
 * 经文类型权重
 * 根据标题后缀判断经文类型，给予不同的权重
 */
const TEXT_TYPE_WEIGHTS: Record<string, number> = {
  '经': 1.0,    // 经藏 - 佛说原典
  '律': 0.95,   // 律藏 - 戒律
  '论': 0.9,    // 论藏 - 论著
  '注疏': 0.7,  // 注疏类 - 疏/记/释/注/解
  '仪轨': 0.6,  // 仪轨类 - 轨/法/仪
  '其他': 0.5,  // 其他
}

/**
 * 根据经文类型获取权重
 * 优先使用数据库中的 textType 字段
 */
function getTextTypeWeight(textType?: string): number {
  if (textType && textType in TEXT_TYPE_WEIGHTS) {
    return TEXT_TYPE_WEIGHTS[textType]
  }
  return TEXT_TYPE_WEIGHTS['其他']
}

export class EnsembleRetriever extends BaseRetriever {
  lc_namespace = ["cbeta", "retrievers"]

  private semanticRetriever: SemanticRetriever
  private fulltextRetriever: FulltextRetriever
  private dictionaryRetriever: DictionaryRetriever
  private config: EnsembleConfig
  private aliasBoostFactor: number = 2.0 // 别名命中时的分数提升倍数

  constructor(
    retrieverConfig: RetrieverConfig = { topK: 10 },
    ensembleConfig: EnsembleConfig = {
      semanticWeight: 0.5,
      fulltextWeight: 0.3,
      dictionaryWeight: 0.2,
      rrfK: 60,
      finalTopK: 15,
    }
  ) {
    super()
    this.semanticRetriever = new SemanticRetriever(retrieverConfig)
    this.fulltextRetriever = new FulltextRetriever(retrieverConfig)
    this.dictionaryRetriever = new DictionaryRetriever({ topK: 5 })
    this.config = ensembleConfig
  }

  /**
   * 初始化（加载别名和同义词缓存）
   */
  async init(): Promise<void> {
    await aliasResolver.init()
    await synonymResolver.init()
  }

  async _getRelevantDocuments(
    query: string,
    runManager?: CallbackManagerForRetrieverRun
  ): Promise<Document[]> {
    // 0. 确保解析器已初始化
    await aliasResolver.init()
    await synonymResolver.init()

    // 1. 解析查询中的经书别名
    const aliasMatches = aliasResolver.extractAliases(query)
    const targetTextIds = aliasResolver.getTextIds(query)
    if (aliasMatches.length > 0) {
      console.log(`    [Ensemble] 识别到经书别名: ${aliasMatches.map(a => `${a.alias}→${a.textId}`).join(", ")}`)
    }

    // 2. 同义词扩展查询
    const expandedQueries = synonymResolver.expandQuery(query)
    const synonymQueries = expandedQueries.filter(q => q.type !== 'original')

    if (synonymQueries.length > 0) {
      console.log(`    [Synonym] 扩展查询: ${synonymQueries.map(q => `"${q.query}"`).join(", ")}`)
    }

    // 3. 并行执行所有检索（原查询 + 扩展查询）
    const allQueries = [query, ...synonymQueries.map(q => q.query)]
    const [semanticDocs, fulltextDocs, dictionaryDocs] = await Promise.all([
      // 合并所有查询的语义检索结果
      this.mergeRetrieverResults(allQueries, (q) => this.semanticRetriever._getRelevantDocuments(q, runManager)),
      // 合并所有查询的全文检索结果
      this.mergeRetrieverResults(allQueries, (q) => this.fulltextRetriever._getRelevantDocuments(q, runManager)),
      // 词典检索只用原查询
      this.dictionaryRetriever._getRelevantDocuments(query, runManager),
    ])

    // 4. 使用 RRF 算法融合结果
    const fusedResults = this.rrfFusion(
      [
        { docs: semanticDocs, weight: this.config.semanticWeight, source: "semantic" },
        { docs: fulltextDocs, weight: this.config.fulltextWeight, source: "fulltext" },
        { docs: dictionaryDocs, weight: this.config.dictionaryWeight, source: "dictionary" },
      ],
      this.config.rrfK,
      targetTextIds
    )

    // 5. 返回 Top K 结果
    return fusedResults
      .slice(0, this.config.finalTopK)
      .map(r => r.document)
  }

  /**
   * 合并多个查询的检索结果，去重
   */
  private async mergeRetrieverResults<T>(
    queries: string[],
    retrieverFn: (query: string) => Promise<T>
  ): Promise<T[]> {
    const results = await Promise.all(queries.map(q => retrieverFn(q)))
    // 扁平化并去重（基于文档内容）
    const seen = new Set<string>()
    const merged: T[] = []

    for (const result of results) {
      for (const item of result as unknown as Document[]) {
        const id = this.getDocumentId(item as Document)
        if (!seen.has(id)) {
          seen.add(id)
          merged.push(item as unknown as T)
        }
      }
    }

    return merged
  }

  /**
   * RRF (Reciprocal Rank Fusion) 算法
   * score(d) = Σ (weight_i / (k + rank_i(d))) * textTypeWeight
   * - 经文类型权重：经(1.0) > 律(0.95) > 论(0.9) > 注疏(0.7) > 仪轨(0.6) > 其他(0.5)
   * - 如果文档来自目标经书（别名匹配），分数会乘以 aliasBoostFactor
   */
  private rrfFusion(
    retrieverResults: Array<{
      docs: Document[]
      weight: number
      source: RetrievalSource
    }>,
    k: number,
    targetTextIds: string[] = []
  ): FusedResult[] {
    const scoreMap = new Map<string, FusedResult>()

    for (const { docs, weight, source } of retrieverResults) {
      for (let rank = 0; rank < docs.length; rank++) {
        const doc = docs[rank]
        const id = this.getDocumentId(doc)
        let rrfScore = weight / (k + rank + 1)

        const metadata = doc.metadata as ChunkMetadata | DictionaryMetadata

        // 应用经文类型权重（仅对经文 chunk，不对词典条目）
        if ("textId" in metadata) {
          const textTypeWeight = getTextTypeWeight(metadata.textType)
          rrfScore *= textTypeWeight

          // 如果文档来自目标经书（别名匹配），提升分数
          if (targetTextIds.includes(metadata.textId)) {
            rrfScore *= this.aliasBoostFactor
          }
        }

        if (scoreMap.has(id)) {
          const existing = scoreMap.get(id)!
          existing.score += rrfScore
          if (!existing.sources.includes(source)) {
            existing.sources.push(source)
          }
          // 合并元数据中的 source
          this.mergeDocumentSources(existing.document, source)
        } else {
          scoreMap.set(id, {
            id,
            document: doc as Document<ChunkMetadata | DictionaryMetadata>,
            score: rrfScore,
            sources: [source],
          })
        }
      }
    }

    // 按分数排序
    return [...scoreMap.values()].sort((a, b) => b.score - a.score)
  }

  /**
   * 生成文档的唯一标识
   */
  private getDocumentId(doc: Document): string {
    const metadata = doc.metadata as ChunkMetadata | DictionaryMetadata

    if ("textId" in metadata) {
      // 经文 chunk
      return `${metadata.textId}:${metadata.juan}:${metadata.chunkIndex}`
    } else if ("term" in metadata) {
      // 词典条目
      return `dict:${metadata.term}`
    }

    // 使用内容哈希作为后备
    return `content:${this.hashString(doc.pageContent.slice(0, 100))}`
  }

  /**
   * 简单字符串哈希
   */
  private hashString(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return hash.toString(36)
  }

  /**
   * 合并文档的来源标记
   */
  private mergeDocumentSources(doc: Document, newSource: RetrievalSource): void {
    const metadata = doc.metadata as ChunkMetadata | DictionaryMetadata

    if ("source" in metadata && typeof metadata.source === "string") {
      // 已经是单一来源，不需要额外处理
      // 来源信息通过 FusedResult.sources 追踪
    }
  }

  /**
   * 获取融合结果（包含来源信息）
   */
  async getRelevantDocumentsWithSources(
    query: string,
    runManager?: CallbackManagerForRetrieverRun
  ): Promise<FusedResult[]> {
    const { results } = await this.getRelevantDocumentsWithMetrics(query, runManager)
    return results
  }

  /**
   * 获取融合结果 + 详细性能指标
   */
  async getRelevantDocumentsWithMetrics(
    query: string,
    runManager?: CallbackManagerForRetrieverRun
  ): Promise<RetrievalResultWithMetrics> {
    // 确保解析器已初始化
    await aliasResolver.init()
    await synonymResolver.init()

    // 解析查询中的经书别名
    const aliasMatches = aliasResolver.extractAliases(query)
    const targetTextIds = aliasResolver.getTextIds(query)
    if (aliasMatches.length > 0) {
      console.log(`    [Ensemble] 识别到经书别名: ${aliasMatches.map(a => `${a.alias}→${a.textId}`).join(", ")}`)
    }

    // 同义词扩展查询
    const expandedQueries = synonymResolver.expandQuery(query)
    const synonymQueries = expandedQueries.filter(q => q.type !== 'original')
    if (synonymQueries.length > 0) {
      console.log(`    [Synonym] 扩展查询: ${synonymQueries.map(q => `"${q.query}"`).join(", ")}`)
    }

    const allQueries = [query, ...synonymQueries.map(q => q.query)]
    console.log(`    [Ensemble] 并行执行三路检索...`)
    const startTime = Date.now()

    // 记录每个检索器的指标
    let semanticTime = 0, fulltextTime = 0, dictTime = 0
    let fulltextUsedLike = false

    let targetedDocs: Document<ChunkMetadata>[] = []
    let targetedTime = 0

    const [semanticDocs, fulltextDocs, dictionaryDocs] = await Promise.all([
      (async () => {
        const t0 = Date.now()
        // 合并所有查询的语义检索结果
        const allDocs = await this.mergeRetrieverResults(allQueries, (q) => this.semanticRetriever._getRelevantDocuments(q, runManager))
        semanticTime = Date.now() - t0
        console.log(`      - 语义检索: ${allDocs.length} 条 (${semanticTime}ms)`)
        return allDocs
      })(),
      (async () => {
        const t0 = Date.now()
        // 合并所有查询的全文检索结果
        const allDocs = await this.mergeRetrieverResults(allQueries, (q) => this.fulltextRetriever._getRelevantDocuments(q, runManager))
        fulltextTime = Date.now() - t0
        console.log(`      - 全文检索: ${allDocs.length} 条 (${fulltextTime}ms)`)
        return allDocs
      })(),
      (async () => {
        const t0 = Date.now()
        // 词典检索只用原查询
        const docs = await this.dictionaryRetriever._getRelevantDocuments(query, runManager)
        dictTime = Date.now() - t0
        console.log(`      - 词典检索: ${docs.length} 条 (${dictTime}ms)`)
        return docs
      })(),
    ])

    // 如果识别到经书别名，补充针对性检索
    if (targetTextIds.length > 0) {
      const t0 = Date.now()
      targetedDocs = await this.semanticRetriever.getRelevantDocumentsByTextIds(query, targetTextIds, 5)
      targetedTime = Date.now() - t0
      console.log(`      - 别名定向检索: ${targetedDocs.length} 条 (${targetedTime}ms) [${targetTextIds.join(", ")}]`)
    }

    // 计算平均相似度/rank
    const avgSimilarity = semanticDocs.length > 0
      ? semanticDocs.reduce((sum, d) => sum + ((d.metadata as ChunkMetadata).similarity || 0), 0) / semanticDocs.length
      : 0
    const avgRank = fulltextDocs.length > 0
      ? fulltextDocs.reduce((sum, d) => sum + ((d.metadata as ChunkMetadata).similarity || 0), 0) / fulltextDocs.length
      : 0

    // RRF 融合（带别名加权）
    // 将定向检索结果也加入融合，使用较高权重
    console.log(`    [Ensemble] RRF 融合中 (k=${this.config.rrfK})...`)
    const fusionStart = Date.now()
    const retrieverResultsToFuse: Array<{
      docs: Document[]
      weight: number
      source: RetrievalSource
    }> = [
      { docs: semanticDocs, weight: this.config.semanticWeight, source: "semantic" },
      { docs: fulltextDocs, weight: this.config.fulltextWeight, source: "fulltext" },
      { docs: dictionaryDocs, weight: this.config.dictionaryWeight, source: "dictionary" },
    ]
    // 定向检索结果使用高权重（与语义检索相同）
    if (targetedDocs.length > 0) {
      retrieverResultsToFuse.push({
        docs: targetedDocs,
        weight: this.config.semanticWeight,
        source: "semantic",
      })
    }
    const fusedResults = this.rrfFusion(
      retrieverResultsToFuse,
      this.config.rrfK,
      targetTextIds
    )
    const fusionTime = Date.now() - fusionStart

    const finalResults = fusedResults.slice(0, this.config.finalTopK)

    // 统计多路命中
    const multiHitChunks = finalResults.filter(r => r.sources.length > 1).length
    const textHits = new Map<string, Set<string>>()
    for (const r of finalResults) {
      const meta = r.document.metadata as ChunkMetadata | DictionaryMetadata
      if ("textId" in meta) {
        const key = `${meta.textId}:${meta.juan}`
        if (!textHits.has(key)) textHits.set(key, new Set())
        r.sources.forEach(s => textHits.get(key)!.add(s))
      }
    }
    const multiHitTexts = [...textHits.values()].filter(s => s.size > 1).length

    const totalTime = Date.now() - startTime
    console.log(`    [Ensemble] 融合完成: ${fusedResults.length} → ${finalResults.length} 条 (融合耗时 ${fusionTime}ms)`)

    // 构建性能指标
    const metrics: RetrievalMetrics = {
      semantic: {
        timeMs: semanticTime,
        count: semanticDocs.length,
        avgSimilarity: Math.round(avgSimilarity * 1000) / 1000,
      },
      fulltext: {
        timeMs: fulltextTime,
        count: fulltextDocs.length,
        avgRank: Math.round(avgRank * 1000) / 1000,
        usedLike: fulltextUsedLike,
      },
      dictionary: {
        timeMs: dictTime,
        count: dictionaryDocs.length,
      },
      fusion: {
        timeMs: fusionTime,
        inputCount: semanticDocs.length + fulltextDocs.length + dictionaryDocs.length,
        outputCount: finalResults.length,
        multiHitChunks,
        multiHitTexts,
      },
      totalTimeMs: totalTime,
    }

    return { results: finalResults, metrics }
  }
}

// 导出所有检索器
export { SemanticRetriever } from "./semantic-retriever.js"
export { FulltextRetriever } from "./fulltext-retriever.js"
export { DictionaryRetriever } from "./dictionary-retriever.js"
