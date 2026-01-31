/**
 * BM25 全文搜索检索器
 * 使用 ParadeDB pg_search 扩展的 BM25 算法
 */

import { BaseRetriever } from "@langchain/core/retrievers"
import { Document } from "@langchain/core/documents"
import { CallbackManagerForRetrieverRun } from "@langchain/core/callbacks/manager"
import { db } from "../../db/index.js"
import { sql } from "drizzle-orm"
import type { ChunkMetadata, RetrieverConfig } from "../types.js"

export class BM25Retriever extends BaseRetriever {
  lc_namespace = ["cbeta", "retrievers"]

  private config: RetrieverConfig

  constructor(config: RetrieverConfig = { topK: 10 }) {
    super()
    this.config = config
  }

  async _getRelevantDocuments(
    query: string,
    _runManager?: CallbackManagerForRetrieverRun
  ): Promise<Document<ChunkMetadata>[]> {
    // 提取关键词
    const keywords = this.extractKeywords(query)
    const searchTerm = keywords.length > 0 ? keywords.join(' ') : query
    const searchTermEscaped = searchTerm.replace(/'/g, "''")

    console.log(`      [BM25] 关键词: "${searchTerm}"`)

    // 使用 ParadeDB BM25 搜索
    const results = await db.execute(sql.raw(`
      SELECT
        tc.id,
        tc.text_id,
        tc.juan,
        tc.chunk_index,
        tc.content,
        tc.char_start,
        tc.char_end,
        t.title,
        t.text_type,
        paradedb.score(tc.id) as rank
      FROM text_chunks tc
      JOIN texts t ON t.id = tc.text_id
      WHERE tc.content @@@ '${searchTermEscaped}'
      ORDER BY paradedb.score(tc.id) DESC
      LIMIT ${this.config.topK}
    `)) as unknown as Array<{
      id: number
      text_id: string
      juan: number
      chunk_index: number
      content: string
      char_start: number
      char_end: number
      title: string
      text_type: string
      rank: number
    }>

    console.log(`      [BM25] 找到 ${results.length} 条结果`)

    // 转换为 Document 格式
    const documents: Document<ChunkMetadata>[] = results.map(row => new Document({
      pageContent: row.content,
      metadata: {
        textId: row.text_id,
        title: row.title,
        juan: row.juan,
        chunkIndex: row.chunk_index,
        charStart: row.char_start,
        charEnd: row.char_end,
        source: "fulltext" as const,
        similarity: parseFloat(String(row.rank)),
        textType: (row.text_type || "其他") as ChunkMetadata["textType"],
      },
    }))

    return documents
  }

  /**
   * 从问句中提取关键词
   */
  private extractKeywords(query: string): string[] {
    // 佛教常见短语（优先保留）
    const buddhistPhrases = [
      '色即是空', '空即是色', '色不异空', '空不异色',
      '应无所住', '无所住而生其心',
      '一切有为法', '如梦幻泡影', '如露亦如电',
      '照见五蕴皆空', '度一切苦厄',
      '不生不灭', '不垢不净', '不增不减',
      '无我相', '无人相', '无众生相', '无寿者相',
      '涅槃寂静', '诸行无常', '诸法无我',
      '四圣谛', '八正道', '十二因缘', '三法印',
      '般若波罗蜜', '阿耨多罗三藐三菩提',
    ]

    // 提取并保留匹配的佛教短语
    const preservedPhrases: string[] = []
    let processedQuery = query
    for (const phrase of buddhistPhrases) {
      if (query.includes(phrase)) {
        preservedPhrases.push(phrase)
        processedQuery = processedQuery.replace(phrase, '')
      }
    }

    // 常见疑问词和虚词
    const stopWords = [
      '什么', '是什么', '怎么', '如何', '为什么', '为何', '哪些', '哪个',
      '的', '了', '吗', '呢', '吧', '啊', '呀', '哦', '嗯',
      '有', '在', '和', '与', '及', '或', '而', '但', '却', '就',
      '请', '问', '告诉', '解释', '说明', '介绍', '讲', '讲解',
      '能', '可以', '可', '会', '要', '想', '应该', '必须',
      '我', '你', '他', '她', '它', '我们', '你们', '他们',
      '这', '那', '这个', '那个', '这些', '那些',
      '一', '一个', '两', '几', '多', '少', '些',
      '意思', '含义', '怎么理解', '什么意思',
    ]

    let result = processedQuery

    // 移除疑问词
    for (const word of stopWords) {
      result = result.replace(new RegExp(word, 'g'), '')
    }

    // 移除标点
    result = result.replace(/[？?。，,！!、：:""''（）()]/g, '')

    // 合并保留的短语和剩余关键词
    const remainingKeywords = result.trim().split(/\s+/).filter(k => k.length > 0)
    const allKeywords = [...preservedPhrases, ...remainingKeywords]

    // 如果有保留的短语，优先返回短语
    if (preservedPhrases.length > 0) {
      return preservedPhrases
    }

    return allKeywords.length > 0 ? allKeywords : [query.replace(/[？?。，,！!、：:""''（）()]/g, '')]
  }
}
