/**
 * BM25 Ensemble 融合检索器
 * 使用 BM25 替代 tsvector 的全文检索
 */

import { BaseRetriever } from "@langchain/core/retrievers"
import { Document } from "@langchain/core/documents"
import { CallbackManagerForRetrieverRun } from "@langchain/core/callbacks/manager"
import { SemanticRetriever } from "./semantic-retriever.js"
import { BM25Retriever } from "./bm25-retriever.js"
import { DictionaryRetriever } from "./dictionary-retriever.js"
import { aliasResolver } from "./alias-resolver.js"
import type {
  EnsembleConfig,
  RetrieverConfig,
  RetrievalSource,
  ChunkMetadata,
  DictionaryMetadata,
  FusedResult,
  RetrievalMetrics,
} from "../types.js"
import type { RetrievalResultWithMetrics } from "./ensemble-retriever.js"

/** 经文类型权重 */
const TEXT_TYPE_WEIGHTS: Record<string, number> = {
  '经': 1.0,
  '律': 0.95,
  '论': 0.9,
  '注疏': 0.7,
  '仪轨': 0.6,
  '其他': 0.5,
}

function getTextTypeWeight(textType?: string): number {
  if (textType && textType in TEXT_TYPE_WEIGHTS) {
    return TEXT_TYPE_WEIGHTS[textType]
  }
  return TEXT_TYPE_WEIGHTS['其他']
}

export class BM25EnsembleRetriever extends BaseRetriever {
  lc_namespace = ["cbeta", "retrievers"]

  private semanticRetriever: SemanticRetriever
  private bm25Retriever: BM25Retriever
  private dictionaryRetriever: DictionaryRetriever
  private config: EnsembleConfig
  private aliasBoostFactor: number = 2.0

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
    this.bm25Retriever = new BM25Retriever(retrieverConfig)
    this.dictionaryRetriever = new DictionaryRetriever({ topK: 5 })
    this.config = ensembleConfig
  }

  async init(): Promise<void> {
    await aliasResolver.init()
  }

  async _getRelevantDocuments(
    query: string,
    runManager?: CallbackManagerForRetrieverRun
  ): Promise<Document[]> {
    const { results } = await this.getRelevantDocumentsWithMetrics(query, runManager)
    return results.slice(0, this.config.finalTopK).map(r => r.document)
  }

  /**
   * RRF (Reciprocal Rank Fusion) 算法
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

        // 应用经文类型权重
        if ("textId" in metadata) {
          const textTypeWeight = getTextTypeWeight(metadata.textType)
          rrfScore *= textTypeWeight

          // 别名匹配加分
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

    return [...scoreMap.values()].sort((a, b) => b.score - a.score)
  }

  private getDocumentId(doc: Document): string {
    const metadata = doc.metadata as ChunkMetadata | DictionaryMetadata

    if ("textId" in metadata) {
      return `${metadata.textId}:${metadata.juan}:${metadata.chunkIndex}`
    } else if ("term" in metadata) {
      return `dict:${metadata.term}`
    }

    return `content:${this.hashString(doc.pageContent.slice(0, 100))}`
  }

  private hashString(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return hash.toString(36)
  }

  /**
   * 获取融合结果 + 详细性能指标
   */
  async getRelevantDocumentsWithMetrics(
    query: string,
    runManager?: CallbackManagerForRetrieverRun
  ): Promise<RetrievalResultWithMetrics> {
    await aliasResolver.init()

    const aliasMatches = aliasResolver.extractAliases(query)
    const targetTextIds = aliasResolver.getTextIds(query)
    if (aliasMatches.length > 0) {
      console.log(`    [BM25Ensemble] 识别到经书别名: ${aliasMatches.map(a => `${a.alias}→${a.textId}`).join(", ")}`)
    }

    console.log(`    [BM25Ensemble] 并行执行三路检索...`)
    const startTime = Date.now()

    let semanticTime = 0, bm25Time = 0, dictTime = 0
    let targetedDocs: Document<ChunkMetadata>[] = []
    let targetedTime = 0

    const [semanticDocs, bm25Docs, dictionaryDocs] = await Promise.all([
      (async () => {
        const t0 = Date.now()
        const docs = await this.semanticRetriever._getRelevantDocuments(query, runManager)
        semanticTime = Date.now() - t0
        console.log(`      - 语义检索: ${docs.length} 条 (${semanticTime}ms)`)
        return docs
      })(),
      (async () => {
        const t0 = Date.now()
        const docs = await this.bm25Retriever._getRelevantDocuments(query, runManager)
        bm25Time = Date.now() - t0
        console.log(`      - BM25检索: ${docs.length} 条 (${bm25Time}ms)`)
        return docs
      })(),
      (async () => {
        const t0 = Date.now()
        const docs = await this.dictionaryRetriever._getRelevantDocuments(query, runManager)
        dictTime = Date.now() - t0
        console.log(`      - 词典检索: ${docs.length} 条 (${dictTime}ms)`)
        return docs
      })(),
    ])

    // 别名定向检索
    if (targetTextIds.length > 0) {
      const t0 = Date.now()
      targetedDocs = await this.semanticRetriever.getRelevantDocumentsByTextIds(query, targetTextIds, 5)
      targetedTime = Date.now() - t0
      console.log(`      - 别名定向检索: ${targetedDocs.length} 条 (${targetedTime}ms)`)
    }

    // 计算平均相似度
    const avgSimilarity = semanticDocs.length > 0
      ? semanticDocs.reduce((sum, d) => sum + ((d.metadata as ChunkMetadata).similarity || 0), 0) / semanticDocs.length
      : 0

    // RRF 融合
    console.log(`    [BM25Ensemble] RRF 融合中 (k=${this.config.rrfK})...`)
    const fusionStart = Date.now()
    const retrieverResultsToFuse: Array<{ docs: Document[]; weight: number; source: RetrievalSource }> = [
      { docs: semanticDocs, weight: this.config.semanticWeight, source: "semantic" },
      { docs: bm25Docs, weight: this.config.fulltextWeight, source: "fulltext" },
      { docs: dictionaryDocs, weight: this.config.dictionaryWeight, source: "dictionary" },
    ]
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
    console.log(`    [BM25Ensemble] 融合完成: ${fusedResults.length} → ${finalResults.length} 条 (融合耗时 ${fusionTime}ms)`)

    const metrics: RetrievalMetrics = {
      semantic: {
        timeMs: semanticTime,
        count: semanticDocs.length,
        avgSimilarity: Math.round(avgSimilarity * 1000) / 1000,
      },
      fulltext: {
        timeMs: bm25Time,
        count: bm25Docs.length,
        avgRank: 0,
        usedLike: false,
      },
      dictionary: {
        timeMs: dictTime,
        count: dictionaryDocs.length,
      },
      fusion: {
        timeMs: fusionTime,
        inputCount: semanticDocs.length + bm25Docs.length + dictionaryDocs.length,
        outputCount: finalResults.length,
        multiHitChunks,
        multiHitTexts,
      },
      totalTimeMs: totalTime,
    }

    return { results: finalResults, metrics }
  }
}
