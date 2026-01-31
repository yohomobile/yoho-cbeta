/**
 * 语义向量检索器
 * 使用 pgvector 进行向量相似度搜索
 */

import { BaseRetriever } from "@langchain/core/retrievers"
import { Document } from "@langchain/core/documents"
import { CallbackManagerForRetrieverRun } from "@langchain/core/callbacks/manager"
import { db } from "../../db/index.js"
import { sql } from "drizzle-orm"
import { createSingleEmbedding, vectorToString } from "../../embedding/openai-service.js"
import type { ChunkMetadata, RetrieverConfig } from "../types.js"

export class SemanticRetriever extends BaseRetriever {
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
    // 1. 生成查询向量
    const { embedding } = await createSingleEmbedding(query)
    const vectorStr = vectorToString(embedding)

    // 2. 向量相似度搜索
    const results = await db.execute(sql.raw(`
      SELECT
        tc.text_id,
        tc.juan,
        tc.chunk_index,
        tc.content,
        tc.char_start,
        tc.char_end,
        t.title,
        t.text_type,
        1 - (tc.embedding <=> '${vectorStr}'::vector) as similarity
      FROM text_chunks tc
      JOIN texts t ON t.id = tc.text_id
      WHERE tc.embedding IS NOT NULL
      ORDER BY tc.embedding <=> '${vectorStr}'::vector
      LIMIT ${this.config.topK}
    `))

    // 3. 转换为 LangChain Document 格式
    return (results as unknown as Array<{
      text_id: string
      juan: number
      chunk_index: number
      content: string
      char_start: number
      char_end: number
      title: string
      text_type: string
      similarity: number
    }>).map(row => new Document({
      pageContent: row.content,
      metadata: {
        textId: row.text_id,
        title: row.title,
        juan: row.juan,
        chunkIndex: row.chunk_index,
        charStart: row.char_start,
        charEnd: row.char_end,
        source: "semantic" as const,
        similarity: parseFloat(String(row.similarity)),
        textType: (row.text_type || "其他") as ChunkMetadata["textType"],
      },
    }))
  }

  /**
   * 针对特定经书进行语义检索
   * 用于经书别名场景：当用户提到某部经书时，补充该经书的相关内容
   */
  async getRelevantDocumentsByTextIds(
    query: string,
    textIds: string[],
    limit: number = 5
  ): Promise<Document<ChunkMetadata>[]> {
    if (textIds.length === 0) return []

    // 1. 生成查询向量
    const { embedding } = await createSingleEmbedding(query)
    const vectorStr = vectorToString(embedding)

    // 2. 向量相似度搜索（限定 textId）
    const textIdList = textIds.map(id => `'${id}'`).join(", ")
    const results = await db.execute(sql.raw(`
      SELECT
        tc.text_id,
        tc.juan,
        tc.chunk_index,
        tc.content,
        tc.char_start,
        tc.char_end,
        t.title,
        t.text_type,
        1 - (tc.embedding <=> '${vectorStr}'::vector) as similarity
      FROM text_chunks tc
      JOIN texts t ON t.id = tc.text_id
      WHERE tc.embedding IS NOT NULL
        AND tc.text_id IN (${textIdList})
      ORDER BY tc.embedding <=> '${vectorStr}'::vector
      LIMIT ${limit}
    `))

    // 3. 转换为 LangChain Document 格式
    return (results as unknown as Array<{
      text_id: string
      juan: number
      chunk_index: number
      content: string
      char_start: number
      char_end: number
      title: string
      text_type: string
      similarity: number
    }>).map(row => new Document({
      pageContent: row.content,
      metadata: {
        textId: row.text_id,
        title: row.title,
        juan: row.juan,
        chunkIndex: row.chunk_index,
        charStart: row.char_start,
        charEnd: row.char_end,
        source: "semantic" as const,
        similarity: parseFloat(String(row.similarity)),
        textType: (row.text_type || "其他") as ChunkMetadata["textType"],
      },
    }))
  }
}
