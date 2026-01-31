/**
 * OpenAI Embedding 服务
 */

import OpenAI from 'openai'

// 延迟初始化，只在实际调用时创建
let openai: OpenAI | null = null
let localLLM: OpenAI | null = null

// OpenAI 官方 API (用于 embedding)
function getClient(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openai
}

// LiteLLM 本地代理 (用于 chat，后端连接 GLM-4.7)
function getLocalClient(): OpenAI {
  if (!localLLM) {
    localLLM = new OpenAI({
      baseURL: 'http://localhost:4000',
      apiKey: process.env.LITELLM_API_KEY || 'sk-litellm-41e2a2d4d101255ea6e76fd59f96548a',
    })
  }
  return localLLM
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
 * 经文引用类型
 */
export interface Citation {
  quote: string  // 经文原文
  title: string  // 经书名
  juan: number  // 卷数
  position: string  // 用于定位的关键词
}

/**
 * 结构化回答类型
 */
export interface StructuredAnswer {
  summary: string  // 简要回答
  details: Array<{
    point: string  // 要点标题
    explanation: string  // 白话解释
    citations: Citation[]  // 可以有多个经文引用
  }>
  conclusion: string  // 总结
  relatedQuestions: string[]  // 相关问题推荐
}

/**
 * RAG 问答 - 根据经文上下文回答问题（结构化输出）
 */
export async function askWithContext(
  question: string,
  contexts: Array<{ title: string; juan: number; content: string; textId: string }>
): Promise<StructuredAnswer> {
  const contextText = contexts
    .map((c, i) => `【参考${i + 1}】《${c.title}》卷${c.juan}：\n${c.content}`)
    .join('\n\n')

  const response = await getLocalClient().chat.completions.create({
    model: process.env.LLM_MODEL || 'glm-4.7',  // litellm 模型名
    messages: [
      {
        role: 'system',
        content: `你是一个佛学专家助手。请严格根据提供的佛经原文回答用户问题。

重要原则：
- 只使用佛教的概念和术语来解释
- 禁止引入心理学、身心灵、道教、儒家或任何其他宗教/哲学的概念
- 保持佛法的纯正性，用经文本身的语言和概念来阐述
- 可以用现代白话解释，但概念必须是纯粹的佛法

你必须调用 submit_answer 函数来提交你的回答。

回答结构：
1. summary: 简要回答问题（1-3句话）
2. details: 详细解释，可以有多个要点。每个要点包含：
   - point: 要点标题
   - explanation: 用佛法语言解释
   - citations: 经文引用数组，每个要点可以引用多条经文，每条引用包含：
     - quote: 经文原文
     - title: 经书名
     - juan: 卷数
     - position: 用于定位的关键词
3. conclusion: 总结
4. relatedQuestions: 相关问题推荐（1-3个），根据当前问题和经文内容，推荐用户可能感兴趣的深入问题

注意：
- 每条 quote 必须是经文原文，不要改写
- 引用必须与所引经书对应，不要张冠李戴
- 一个要点可以引用多部经书或同一经书的多处内容
- 相关问题要与当前话题相关，帮助用户深入探索
- 如果经文不足以回答，请如实说明`,
      },
      {
        role: 'user',
        content: `经文参考：\n${contextText}\n\n问题：${question}`,
      },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'submit_answer',
          description: '提交结构化的佛学问答回答',
          parameters: {
            type: 'object',
            properties: {
              summary: {
                type: 'string',
                description: '简要回答，1-2句话概括',
              },
              details: {
                type: 'array',
                description: '详细解释，包含多个要点',
                items: {
                  type: 'object',
                  properties: {
                    point: {
                      type: 'string',
                      description: '要点标题',
                    },
                    explanation: {
                      type: 'string',
                      description: '用佛法语言解释',
                    },
                    citations: {
                      type: 'array',
                      description: '经文引用，可以有多条',
                      items: {
                        type: 'object',
                        properties: {
                          quote: {
                            type: 'string',
                            description: '经文原文',
                          },
                          title: {
                            type: 'string',
                            description: '经书名称',
                          },
                          juan: {
                            type: 'number',
                            description: '卷数',
                          },
                          position: {
                            type: 'string',
                            description: '用于定位的关键词',
                          },
                        },
                        required: ['quote', 'title', 'juan', 'position'],
                      },
                    },
                  },
                  required: ['point', 'explanation', 'citations'],
                },
              },
              conclusion: {
                type: 'string',
                description: '总结',
              },
              relatedQuestions: {
                type: 'array',
                description: '相关问题推荐，1-3个',
                items: {
                  type: 'string',
                },
                maxItems: 3,
              },
            },
            required: ['summary', 'details', 'conclusion', 'relatedQuestions'],
          },
        },
      },
    ],
    tool_choice: { type: 'function', function: { name: 'submit_answer' } },
    temperature: 0.3,
    max_tokens: 1500,
  })

  const toolCall = response.choices[0]?.message?.tool_calls?.[0]
  if (toolCall && toolCall.function.name === 'submit_answer') {
    try {
      // GLM-4.7 可能会返回<think>...</think> 标签，需要去掉
      const cleanedArgs = toolCall.function.arguments.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      const result = JSON.parse(cleanedArgs) as StructuredAnswer
      return result
    } catch {
      // 解析失败，返回默认结构
    }
  }

  // 回退到默认回答
  return {
    summary: '无法生成回答',
    details: [],
    conclusion: '请尝试重新提问',
    relatedQuestions: [],
  }
}
