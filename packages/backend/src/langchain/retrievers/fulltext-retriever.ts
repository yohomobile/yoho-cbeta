/**
 * 全文搜索检索器
 * 使用 PostgreSQL zhparser 中文分词 + tsvector
 */

import { BaseRetriever } from "@langchain/core/retrievers"
import { Document } from "@langchain/core/documents"
import { CallbackManagerForRetrieverRun } from "@langchain/core/callbacks/manager"
import { db } from "../../db/index.js"
import { sql } from "drizzle-orm"
import type { ChunkMetadata, RetrieverConfig } from "../types.js"

export class FulltextRetriever extends BaseRetriever {
  lc_namespace = ["cbeta", "retrievers"]

  private config: RetrieverConfig
  private minRank: number // 最小 rank 阈值

  constructor(config: RetrieverConfig = { topK: 10 }, minRank: number = 0.01) {
    super()
    this.config = config
    this.minRank = minRank
  }

  async _getRelevantDocuments(
    query: string,
    _runManager?: CallbackManagerForRetrieverRun
  ): Promise<Document<ChunkMetadata>[]> {
    // 从问句中提取关键词（去掉常见疑问词）
    const keywords = this.extractKeywords(query)
    const searchTerm = keywords.length > 0 ? keywords.join('') : query
    const searchTermEscaped = searchTerm.replace(/'/g, "''")

    // 检查分词结果，决定使用 tsvector 还是 LIKE
    const tsqueryResult = await db.execute(sql.raw(
      `SELECT plainto_tsquery('chinese', '${searchTermEscaped}')::text as tsq`
    )) as unknown as Array<{ tsq: string }>

    const tsq = tsqueryResult[0]?.tsq || ""
    const words = tsq.match(/'([^']+)'/g)?.map(w => w.replace(/'/g, "")) || []
    const maxWordLen = Math.max(...words.map(w => w.length), 0)

    // 如果分词结果全是单字或为空（说明分词失败），使用 LIKE
    const useLike = maxWordLen <= 1

    console.log(`      [Fulltext] 关键词: "${searchTerm}", 分词: "${tsq}", 使用LIKE: ${useLike}`)

    let results: Array<{
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

    if (useLike) {
      // 使用 LIKE 匹配 text_chunks 表
      results = await db.execute(sql.raw(`
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
          1.0 as rank
        FROM text_chunks tc
        JOIN texts t ON t.id = tc.text_id
        WHERE tc.content LIKE '%${searchTermEscaped}%'
        ORDER BY
          CASE WHEN t.canon_id = 'T' THEN 0 ELSE 1 END,
          tc.text_id, tc.juan, tc.chunk_index
        LIMIT ${this.config.topK}
      `)) as unknown as typeof results
    } else {
      // 使用 tsvector 全文搜索 text_chunks 表（带 rank 阈值过滤）
      results = await db.execute(sql.raw(`
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
          ts_rank(tc.content_tsv, plainto_tsquery('chinese', '${searchTermEscaped}')) as rank
        FROM text_chunks tc
        JOIN texts t ON t.id = tc.text_id
        WHERE tc.content_tsv @@ plainto_tsquery('chinese', '${searchTermEscaped}')
          AND ts_rank(tc.content_tsv, plainto_tsquery('chinese', '${searchTermEscaped}')) >= ${this.minRank}
        ORDER BY rank DESC
        LIMIT ${this.config.topK}
      `)) as unknown as typeof results
    }

    console.log(`      [Fulltext] 找到 ${results.length} 条结果 (rank >= ${this.minRank})`)

    // 直接返回 chunk 内容
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
   * 去掉常见的疑问词和虚词，但保留佛教常见短语
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
        // 用占位符替换，避免被后续处理破坏
        processedQuery = processedQuery.replace(phrase, '')
      }
    }

    // 常见疑问词和虚词（不包含"是"，因为它可能是短语的一部分）
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
