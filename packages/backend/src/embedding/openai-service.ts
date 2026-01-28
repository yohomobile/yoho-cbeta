/**
 * OpenAI Embedding 服务
 */

import OpenAI from 'openai'

// 延迟初始化，只在实际调用时创建
let openai: OpenAI | null = null

function getClient(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openai
}

const BATCH_SIZE = 100  // OpenAI 单次最多 2048 个输入
const RATE_LIMIT_DELAY = 100  // ms
const MODEL = 'text-embedding-3-small'
const DIMENSIONS = 1536

export interface EmbeddingResult {
  embedding: number[]
  tokenCount: number
}

/**
 * 批量创建嵌入向量
 */
export async function createEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
  const results: EmbeddingResult[] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)

    const response = await getClient().embeddings.create({
      model: MODEL,
      input: batch,
      dimensions: DIMENSIONS,
    })

    for (const data of response.data) {
      results.push({
        embedding: data.embedding,
        tokenCount: response.usage?.total_tokens || 0,
      })
    }

    // 速率限制
    if (i + BATCH_SIZE < texts.length) {
      await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY))
    }
  }

  return results
}

/**
 * 创建单个嵌入向量
 */
export async function createSingleEmbedding(text: string): Promise<EmbeddingResult> {
  const response = await getClient().embeddings.create({
    model: MODEL,
    input: text,
    dimensions: DIMENSIONS,
  })

  return {
    embedding: response.data[0].embedding,
    tokenCount: response.usage?.total_tokens || 0,
  }
}

/**
 * 将向量转为 pgvector 格式的字符串
 */
export function vectorToString(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}
