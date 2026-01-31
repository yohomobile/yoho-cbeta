/**
 * 词典检索器
 * 查询佛学词典，获取术语解释
 */

import { BaseRetriever } from "@langchain/core/retrievers"
import { Document } from "@langchain/core/documents"
import { CallbackManagerForRetrieverRun } from "@langchain/core/callbacks/manager"
import { db } from "../../db/index.js"
import { sql } from "drizzle-orm"
import type { DictionaryMetadata, RetrieverConfig } from "../types.js"

export class DictionaryRetriever extends BaseRetriever {
  lc_namespace = ["cbeta", "retrievers"]

  private config: RetrieverConfig

  constructor(config: RetrieverConfig = { topK: 5 }) {
    super()
    this.config = config
  }

  async _getRelevantDocuments(
    query: string,
    _runManager?: CallbackManagerForRetrieverRun
  ): Promise<Document<DictionaryMetadata>[]> {
    const escaped = query.replace(/'/g, "''")

    // 从查询中提取可能的术语（简单分词）
    // 对于佛学术语，通常是 2-4 个字的词
    const terms = this.extractTerms(query)

    if (terms.length === 0) {
      return []
    }

    // 构建 OR 条件查询多个术语
    const termConditions = terms
      .map(t => `term = '${t.replace(/'/g, "''")}' OR term_simplified = '${t.replace(/'/g, "''")}'`)
      .join(" OR ")

    // 查询词典
    const results = await db.execute(sql.raw(`
      SELECT
        id,
        term,
        definition_text,
        source,
        CASE
          WHEN term = '${escaped}' OR term_simplified = '${escaped}' THEN 1.0
          WHEN term LIKE '${escaped}%' OR term_simplified LIKE '${escaped}%' THEN 0.9
          ELSE GREATEST(
            COALESCE(SIMILARITY(term, '${escaped}'), 0),
            COALESCE(SIMILARITY(term_simplified, '${escaped}'), 0)
          )
        END as relevance
      FROM dictionary_entries
      WHERE ${termConditions}
         OR term LIKE '%${escaped}%'
         OR term_simplified LIKE '%${escaped}%'
         OR term % '${escaped}'
         OR term_simplified % '${escaped}'
      ORDER BY relevance DESC
      LIMIT ${this.config.topK}
    `)) as unknown as Array<{
      id: number
      term: string
      definition_text: string
      source: string
      relevance: number
    }>

    return results.map(row => new Document({
      pageContent: `【${row.term}】${row.definition_text}`,
      metadata: {
        term: row.term,
        source: row.source,
        entrySource: "dictionary" as const,
      },
    }))
  }

  /**
   * 从查询中提取可能的术语
   * 佛学术语通常是 2-4 字的词
   */
  private extractTerms(query: string): string[] {
    const terms: string[] = []

    // 移除标点符号
    const cleanQuery = query.replace(/[？?。，,！!、：:""''（）()]/g, "")

    // 提取 2-4 字的连续子串作为候选术语
    for (let len = 4; len >= 2; len--) {
      for (let i = 0; i <= cleanQuery.length - len; i++) {
        const term = cleanQuery.slice(i, i + len)
        // 确保是中文
        if (/^[\u4e00-\u9fff]+$/.test(term)) {
          terms.push(term)
        }
      }
    }

    // 去重
    return [...new Set(terms)]
  }
}
