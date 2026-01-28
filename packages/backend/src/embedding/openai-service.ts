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

/**
 * RAG 问答 - 根据经文上下文回答问题
 */
export async function askWithContext(
  question: string,
  contexts: Array<{ title: string; juan: number; content: string }>
): Promise<string> {
  const contextText = contexts
    .map((c, i) => `【参考${i + 1}】《${c.title}》卷${c.juan}：\n${c.content}`)
    .join('\n\n')

  const response = await getClient().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `你是一个佛学专家助手。请根据提供的佛经原文回答用户问题。
要求：
1. 答案必须基于提供的经文内容，不要编造
2. 用现代白话文解释，通俗易懂
3. 适当引用原文作为依据
4. 如果经文内容不足以回答问题，请如实说明
5. 回答简洁明了，控制在 300 字以内`,
      },
      {
        role: 'user',
        content: `经文参考：\n${contextText}\n\n问题：${question}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 500,
  })

  return response.choices[0]?.message?.content || '无法生成回答'
}
