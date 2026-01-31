/**
 * 深度 RAG Chain
 * 整合多路检索 + LLM 生成结构化答案
 */

import { ChatOpenAI } from "@langchain/openai"
import { RunnableSequence } from "@langchain/core/runnables"
import { Document } from "@langchain/core/documents"
import { EnsembleRetriever } from "../retrievers/ensemble-retriever.js"
import { deepAnswerPrompt } from "../prompts/deep-answer.js"
import { db } from "../../db/index.js"
import { sql } from "drizzle-orm"
import type {
  DeepRAGConfig,
  DeepAnswerResponse,
  FusedResult,
  ChunkMetadata,
  DictionaryMetadata,
  SourceInfo,
  TermDefinition,
  PerformanceReport,
  RetrievalMetrics,
  ContextMetrics,
  GenerationMetrics,
} from "../types.js"
import type { RetrievalResultWithMetrics } from "../retrievers/ensemble-retriever.js"

/** 输出 Schema 定义 */
const outputSchema = {
  type: "object",
  properties: {
    summary: { type: "string", description: "简要回答（1-3句话）" },
    terminology: {
      type: "array",
      items: {
        type: "object",
        properties: {
          term: { type: "string" },
          definition: { type: "string" },
          source: { type: "string" },
        },
        required: ["term", "definition", "source"],
      },
    },
    points: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          explanation: { type: "string" },
          citations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                quote: { type: "string" },
                sutraTitle: { type: "string" },
                juan: { type: "number" },
                textId: { type: "string" },
                matchType: { type: "array", items: { type: "string" } },
              },
              required: ["quote", "sutraTitle", "juan", "textId", "matchType"],
            },
          },
        },
        required: ["title", "explanation", "citations"],
      },
    },
    comparison: {
      type: "array",
      items: {
        type: "object",
        properties: {
          aspect: { type: "string" },
          views: {
            type: "array",
            items: {
              type: "object",
              properties: {
                sutra: { type: "string" },
                position: { type: "string" },
                quote: { type: "string" },
              },
              required: ["sutra", "position", "quote"],
            },
          },
        },
        required: ["aspect", "views"],
      },
    },
    levels: {
      type: "object",
      properties: {
        literal: { type: "string" },
        profound: { type: "string" },
        practice: { type: "string" },
      },
    },
    followUpQuestions: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["summary", "terminology", "points", "followUpQuestions"],
} as const

export class DeepRAGChain {
  private retriever: EnsembleRetriever
  private llm: ChatOpenAI
  private config: DeepRAGConfig

  constructor(config?: Partial<DeepRAGConfig>) {
    const defaultConfig: DeepRAGConfig = {
      retriever: { topK: 10 },
      ensemble: {
        semanticWeight: 0.5,
        fulltextWeight: 0.3,
        dictionaryWeight: 0.2,
        rrfK: 60,
        finalTopK: 15,
      },
      expandContext: true,
      contextWindow: 2,
      maxChunkLength: 1500,
      maxContextLength: 20000,
    }

    this.config = { ...defaultConfig, ...config }

    this.retriever = new EnsembleRetriever(
      this.config.retriever,
      this.config.ensemble
    )

    this.llm = new ChatOpenAI({
      modelName: process.env.LLM_MODEL || "glm-4.7",  // litellm 模型名
      temperature: 0.3,
      maxTokens: 10240,
      configuration: {
        baseURL: "http://localhost:4000",
      },
      apiKey: process.env.LITELLM_API_KEY || "sk-litellm-41e2a2d4d101255ea6e76fd59f96548a",
    })
  }

  get modelName(): string {
    return process.env.LLM_MODEL || "GLM-4.7"
  }

  /**
   * 获取检索结果（不调用 LLM）
   * 用于评估检索质量
   */
  async getRetrievalResults(question: string): Promise<FusedResult[]> {
    const { results } = await this.retriever.getRelevantDocumentsWithMetrics(question)
    return results
  }

  /**
   * 执行深度问答
   */
  async invoke(
    question: string,
    options: { includePerformance?: boolean } = {}
  ): Promise<DeepAnswerResponse> {
    const includePerformance = options.includePerformance ?? false
    const startTime = Date.now()
    console.log(`\n${"=".repeat(60)}`)
    console.log(`[DeepRAG] 开始处理问题: "${question}"`)
    console.log(`${"=".repeat(60)}`)

    // 1. 多路检索（带详细指标）
    console.log(`\n[1/5] 多路检索中...`)
    const { results: fusedResults, metrics: retrievalMetrics } =
      await this.retriever.getRelevantDocumentsWithMetrics(question)

    // 输出检索阶段详细指标
    console.log(`    ✓ 检索完成 (${retrievalMetrics.totalTimeMs}ms)`)
    console.log(`    ┌─────────────────────────────────────────────────`)
    console.log(`    │ 语义检索: ${retrievalMetrics.semantic.count} 条, ${retrievalMetrics.semantic.timeMs}ms, 平均相似度 ${retrievalMetrics.semantic.avgSimilarity}`)
    console.log(`    │ 全文检索: ${retrievalMetrics.fulltext.count} 条, ${retrievalMetrics.fulltext.timeMs}ms, 平均rank ${retrievalMetrics.fulltext.avgRank}`)
    console.log(`    │ 词典检索: ${retrievalMetrics.dictionary.count} 条, ${retrievalMetrics.dictionary.timeMs}ms`)
    console.log(`    │ RRF融合: ${retrievalMetrics.fusion.inputCount} → ${retrievalMetrics.fusion.outputCount} 条, ${retrievalMetrics.fusion.timeMs}ms`)
    console.log(`    │ 多路命中: ${retrievalMetrics.fusion.multiHitChunks} chunks, ${retrievalMetrics.fusion.multiHitTexts} 部经文`)
    console.log(`    └─────────────────────────────────────────────────`)

    // 2. 上下文扩展（可选）
    let expandedResults = fusedResults
    let expansionTime = 0
    let expansionQueries = 0
    if (this.config.expandContext) {
      console.log(`\n[2/5] 扩展上下文 (窗口: ±${this.config.contextWindow} chunks)...`)
      const expandStart = Date.now()
      const { results: expanded, queriesCount } = await this.expandContextWithMetrics(fusedResults)
      expandedResults = expanded
      expansionTime = Date.now() - expandStart
      expansionQueries = queriesCount
      console.log(`    ✓ 扩展完成 (${expansionTime}ms, ${expansionQueries} 次数据库查询)`)
    }

    // 3. 格式化上下文（含智能截断和总量控制）
    console.log(`\n[3/5] 格式化上下文...`)
    const formatStart = Date.now()
    const { context, stats } = this.formatContextWithStats(expandedResults, question)
    const formatTime = Date.now() - formatStart

    console.log(`    ✓ 上下文长度: ${context.length} 字符 (上限 ${this.config.maxContextLength})`)
    console.log(`    ┌─────────────────────────────────────────────────`)
    console.log(`    │ 经文片段: ${stats.chunkCount} 条, 平均 ${stats.avgChunkLen} 字/条, 最长 ${stats.maxLen} 字`)
    console.log(`    │ 词典条目: ${stats.dictCount} 条, 平均 ${stats.avgDictLen} 字/条`)
    console.log(`    │ 智能截断: ${stats.truncatedCount} 条 (阈值 ${this.config.maxChunkLength} 字)`)
    console.log(`    │ 总量丢弃: ${stats.droppedCount} 条`)
    console.log(`    │ 格式化耗时: ${formatTime}ms`)
    console.log(`    └─────────────────────────────────────────────────`)

    // 构建上下文指标
    const contextMetrics: ContextMetrics = {
      expansion: {
        timeMs: expansionTime,
        queriesCount: expansionQueries,
      },
      formatting: {
        timeMs: formatTime,
        chunkCount: stats.chunkCount,
        dictCount: stats.dictCount,
        avgChunkLen: stats.avgChunkLen,
        maxChunkLen: stats.maxLen,
        truncatedCount: stats.truncatedCount,
        droppedCount: stats.droppedCount,
        finalLength: context.length,
      },
    }

    // 4. LLM 生成
    console.log(`\n[4/5] LLM 生成中 (${this.modelName})...`)
    const generationStart = Date.now()
    const inputTokensEstimate = Math.round(context.length / 1.5) // 粗略估算中文 token

    // 定义 tool
    const deepAnswerTool = {
      type: "function" as const,
      function: {
        name: "deep_answer",
        description: "提交深度问答的结构化回答",
        parameters: outputSchema,
      },
    }

    // 使用 bindTools 绑定工具
    const llmWithTools = this.llm.bindTools([deepAnswerTool], {
      tool_choice: { type: "function", function: { name: "deep_answer" } },
    })

    // 使用 LangChain RunnableSequence
    const chain = RunnableSequence.from([
      deepAnswerPrompt,
      llmWithTools,
    ])

    const llmResponse = await chain.invoke({
      context,
      question,
    })

    // 解析 tool_calls 响应
    let llmResult: Record<string, unknown>
    try {
      const toolCalls = llmResponse.tool_calls
      const invalidToolCalls = llmResponse.invalid_tool_calls

      if (toolCalls && toolCalls.length > 0 && toolCalls[0].args) {
        // 正常的 tool_calls
        llmResult = toolCalls[0].args as Record<string, unknown>
      } else if (invalidToolCalls && invalidToolCalls.length > 0 && invalidToolCalls[0].args) {
        // 处理 invalid_tool_calls (可能是因为 JSON 被截断)
        console.log('    ⚠ 使用 invalid_tool_calls 中的部分数据')
        let args = invalidToolCalls[0].args as string
        // 尝试修复被截断的 JSON
        // 如果 JSON 被截断，尝试补全
        if (!args.endsWith('}')) {
          // 找到最后一个完整的字段
          const lastCompleteField = args.lastIndexOf('",')
          if (lastCompleteField > 0) {
            args = args.substring(0, lastCompleteField + 1) + '}'
          }
        }
        // 尝试解析嵌套的 JSON 字符串
        try {
          const parsed = JSON.parse(args)
          // terminology 可能是字符串形式的 JSON
          if (typeof parsed.terminology === 'string') {
            try {
              parsed.terminology = JSON.parse(parsed.terminology)
            } catch { /* ignore */ }
          }
          if (typeof parsed.points === 'string') {
            try {
              parsed.points = JSON.parse(parsed.points)
            } catch { /* ignore */ }
          }
          llmResult = parsed
        } catch {
          llmResult = {}
        }
      } else {
        // 回退：尝试从 content 解析 JSON
        let content = typeof llmResponse.content === 'string'
          ? llmResponse.content
          : JSON.stringify(llmResponse.content)
        // GLM-4.7 可能会返回<think>...</think> 标签，需要去掉
        content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
        // 去掉 markdown 代码块标记
        content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
        // 尝试提取 JSON 部分
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          content = jsonMatch[0]
        }
        llmResult = JSON.parse(content)
      }
    } catch (e) {
      console.error('解析失败:', e, llmResponse)
      llmResult = {}
    }

    // 修复可能被序列化为字符串的数组字段
    const arrayFields = ['terminology', 'points', 'comparison', 'followUpQuestions']
    for (const field of arrayFields) {
      if (typeof llmResult[field] === 'string') {
        try {
          llmResult[field] = JSON.parse(llmResult[field] as string)
        } catch { /* ignore */ }
      }
    }
    // 修复 levels 字段
    if (typeof llmResult.levels === 'string') {
      try {
        llmResult.levels = JSON.parse(llmResult.levels as string)
      } catch { /* ignore */ }
    }

    const generationTime = Date.now() - generationStart
    console.log(`    ✓ 生成完成 (${generationTime}ms / ${(generationTime/1000).toFixed(1)}s)`)
    console.log(`    ┌─────────────────────────────────────────────────`)
    console.log(`    │ 输入 tokens (估): ~${inputTokensEstimate}`)
    console.log(`    │ 要点数: ${llmResult.points?.length || 0}`)
    console.log(`    │ 术语数: ${llmResult.terminology?.length || 0}`)
    console.log(`    │ 对比数: ${llmResult.comparison?.length || 0}`)
    console.log(`    │ 层次解读: ${llmResult.levels ? '有' : '无'}`)
    console.log(`    └─────────────────────────────────────────────────`)

    // 构建生成指标
    const generationMetrics: GenerationMetrics = {
      timeMs: generationTime,
      model: this.modelName,
      inputTokensEstimate,
      outputPointsCount: llmResult.points?.length || 0,
      outputTermsCount: llmResult.terminology?.length || 0,
    }

    // 5. 组装最终响应
    console.log(`\n[5/5] 组装响应...`)
    const sources = this.extractSources(expandedResults)

    const totalTime = Date.now() - startTime

    // 输出性能摘要
    console.log(`\n${"=".repeat(60)}`)
    console.log(`[DeepRAG] 性能摘要`)
    console.log(`${"=".repeat(60)}`)
    console.log(`┌────────────────┬──────────┬─────────┐`)
    console.log(`│ 阶段           │ 耗时     │ 占比    │`)
    console.log(`├────────────────┼──────────┼─────────┤`)
    console.log(`│ 检索           │ ${String(retrievalMetrics.totalTimeMs).padStart(5)}ms │ ${String(Math.round(retrievalMetrics.totalTimeMs / totalTime * 100)).padStart(5)}%  │`)
    console.log(`│   ├ 语义       │ ${String(retrievalMetrics.semantic.timeMs).padStart(5)}ms │         │`)
    console.log(`│   ├ 全文       │ ${String(retrievalMetrics.fulltext.timeMs).padStart(5)}ms │         │`)
    console.log(`│   ├ 词典       │ ${String(retrievalMetrics.dictionary.timeMs).padStart(5)}ms │         │`)
    console.log(`│   └ 融合       │ ${String(retrievalMetrics.fusion.timeMs).padStart(5)}ms │         │`)
    console.log(`│ 上下文处理     │ ${String(contextMetrics.expansion.timeMs + contextMetrics.formatting.timeMs).padStart(5)}ms │ ${String(Math.round((contextMetrics.expansion.timeMs + contextMetrics.formatting.timeMs) / totalTime * 100)).padStart(5)}%  │`)
    console.log(`│   ├ 扩展       │ ${String(contextMetrics.expansion.timeMs).padStart(5)}ms │         │`)
    console.log(`│   └ 格式化     │ ${String(contextMetrics.formatting.timeMs).padStart(5)}ms │         │`)
    console.log(`│ LLM生成        │ ${String(generationTime).padStart(5)}ms │ ${String(Math.round(generationTime / totalTime * 100)).padStart(5)}%  │`)
    console.log(`├────────────────┼──────────┼─────────┤`)
    console.log(`│ 总计           │ ${String(totalTime).padStart(5)}ms │  100%  │`)
    console.log(`└────────────────┴──────────┴─────────┘`)
    console.log(`${"=".repeat(60)}\n`)

    // 构建完整性能报告
    const performanceReport: PerformanceReport = {
      timestamp: new Date().toISOString(),
      question,
      retrieval: retrievalMetrics,
      context: contextMetrics,
      generation: generationMetrics,
      totalTimeMs: totalTime,
    }

    const response: DeepAnswerResponse = {
      question,
      summary: llmResult.summary || "",
      terminology: (llmResult.terminology || []) as TermDefinition[],
      points: llmResult.points || [],
      comparison: llmResult.comparison,
      levels: llmResult.levels,
      followUpQuestions: llmResult.followUpQuestions || [],
      sources,
      meta: {
        totalChunksSearched: fusedResults.length,
        retrievalTimeMs: retrievalMetrics.totalTimeMs,
        generationTimeMs: generationTime,
      },
    }

    // 可选：包含详细性能报告
    if (includePerformance) {
      response.performance = performanceReport
    }

    return response
  }

  /**
   * 扩展上下文 - 获取匹配 chunk 的前后文
   */
  private async expandContext(results: FusedResult[]): Promise<FusedResult[]> {
    const { results: expanded } = await this.expandContextWithMetrics(results)
    return expanded
  }

  /**
   * 扩展上下文（带指标）
   */
  private async expandContextWithMetrics(results: FusedResult[]): Promise<{
    results: FusedResult[]
    queriesCount: number
  }> {
    const expanded: FusedResult[] = []
    let queriesCount = 0

    for (const result of results) {
      const metadata = result.document.metadata as ChunkMetadata | DictionaryMetadata

      // 词典条目不需要扩展
      if ("term" in metadata) {
        expanded.push(result)
        continue
      }

      // 经文 chunk 需要扩展前后文
      const chunkMeta = metadata as ChunkMetadata
      if (chunkMeta.chunkIndex < 0) {
        // 全文搜索结果，已经包含上下文
        expanded.push(result)
        continue
      }

      // 查询前后 chunks
      const window = this.config.contextWindow
      const neighbors = await db.execute(sql.raw(`
        SELECT
          tc.content,
          tc.chunk_index
        FROM text_chunks tc
        WHERE tc.text_id = '${chunkMeta.textId}'
          AND tc.juan = ${chunkMeta.juan}
          AND tc.chunk_index BETWEEN ${chunkMeta.chunkIndex - window} AND ${chunkMeta.chunkIndex + window}
        ORDER BY tc.chunk_index
      `)) as unknown as Array<{ content: string; chunk_index: number }>
      queriesCount++

      // 合并内容
      const expandedContent = neighbors.map(n => n.content).join("")

      expanded.push({
        ...result,
        document: new Document({
          pageContent: expandedContent,
          metadata: result.document.metadata,
        }),
      })
    }

    return { results: expanded, queriesCount }
  }

  /**
   * 格式化上下文为 Prompt 字符串
   */
  private formatContext(results: FusedResult[]): string {
    return this.formatContextWithStats(results).context
  }

  /**
   * 格式化上下文并返回统计信息
   * 包含智能截断和总量控制
   */
  private formatContextWithStats(results: FusedResult[], question?: string): {
    context: string
    stats: {
      chunkCount: number
      dictCount: number
      avgChunkLen: number
      avgDictLen: number
      maxLen: number
      maxSource: string
      truncatedCount: number
      droppedCount: number
    }
  } {
    const parts: string[] = []
    let chunkCount = 0
    let dictCount = 0
    let chunkTotalLen = 0
    let dictTotalLen = 0
    let maxLen = 0
    let maxSource = ""
    let truncatedCount = 0
    let droppedCount = 0
    let totalLen = 0

    const maxChunkLen = this.config.maxChunkLength
    const maxContextLen = this.config.maxContextLength

    for (const result of results) {
      const metadata = result.document.metadata as ChunkMetadata | DictionaryMetadata
      let content = result.document.pageContent

      // 智能截断：如果内容超过阈值，保留关键词周围的内容
      if (content.length > maxChunkLen) {
        content = this.smartTruncate(content, maxChunkLen, question)
        truncatedCount++
      }

      // 来源标记
      const sourceTag = result.sources.length > 1
        ? "[多路命中]"
        : result.sources[0] === "semantic"
          ? "[语义匹配]"
          : result.sources[0] === "fulltext"
            ? "[关键词匹配]"
            : "[词典]"

      let part: string
      if ("term" in metadata) {
        // 词典条目
        part = `【词典】${content} ${sourceTag}`
        dictCount++
        dictTotalLen += content.length
      } else {
        // 经文
        const chunkMeta = metadata as ChunkMetadata
        part = `【经文】《${chunkMeta.title}》卷${chunkMeta.juan} (${chunkMeta.textId}) ${sourceTag}\n${content}`
        chunkCount++
        chunkTotalLen += content.length
      }

      // 总量控制：如果加入这条会超过总长度限制，跳过
      if (totalLen + part.length > maxContextLen) {
        droppedCount++
        continue
      }

      parts.push(part)
      totalLen += part.length + 10 // 10 是分隔符长度

      // 记录最长的片段
      if (content.length > maxLen) {
        maxLen = content.length
        if ("term" in metadata) {
          maxSource = `词典:${metadata.term}`
        } else {
          const chunkMeta = metadata as ChunkMetadata
          maxSource = `${chunkMeta.title}:卷${chunkMeta.juan}`
        }
      }
    }

    return {
      context: parts.join("\n\n---\n\n"),
      stats: {
        chunkCount,
        dictCount,
        avgChunkLen: chunkCount > 0 ? Math.round(chunkTotalLen / chunkCount) : 0,
        avgDictLen: dictCount > 0 ? Math.round(dictTotalLen / dictCount) : 0,
        maxLen,
        maxSource,
        truncatedCount,
        droppedCount,
      },
    }
  }

  /**
   * 智能截断：保留关键词周围的内容
   */
  private smartTruncate(content: string, maxLen: number, question?: string): string {
    if (content.length <= maxLen) return content

    // 提取关键词（去掉常见疑问词）
    const keywords = question
      ? this.extractKeywords(question)
      : []

    if (keywords.length === 0) {
      // 没有关键词，取中间部分
      const start = Math.floor((content.length - maxLen) / 2)
      return "..." + content.slice(start, start + maxLen - 6) + "..."
    }

    // 找到关键词在文本中的位置
    let bestPos = -1
    for (const kw of keywords) {
      const pos = content.indexOf(kw)
      if (pos !== -1) {
        bestPos = pos
        break
      }
    }

    if (bestPos === -1) {
      // 没找到关键词，取开头
      return content.slice(0, maxLen - 3) + "..."
    }

    // 以关键词为中心，前后各取一半
    const half = Math.floor(maxLen / 2)
    let start = Math.max(0, bestPos - half)
    let end = Math.min(content.length, bestPos + half)

    // 调整边界确保长度正确
    if (end - start < maxLen && start > 0) {
      start = Math.max(0, end - maxLen)
    }
    if (end - start < maxLen && end < content.length) {
      end = Math.min(content.length, start + maxLen)
    }

    let result = content.slice(start, end)

    // 添加省略号
    if (start > 0) result = "..." + result
    if (end < content.length) result = result + "..."

    return result
  }

  /**
   * 从问句中提取关键词
   */
  private extractKeywords(query: string): string[] {
    const stopWords = [
      '什么', '是什么', '怎么', '如何', '为什么', '为何', '哪些', '哪个',
      '是', '的', '了', '吗', '呢', '吧', '啊', '呀', '哦', '嗯',
      '有', '在', '和', '与', '及', '或', '而', '但', '却', '就',
      '请', '问', '告诉', '解释', '说明', '介绍', '讲', '讲解',
    ]

    let result = query
    for (const word of stopWords) {
      result = result.replace(new RegExp(word, 'g'), '')
    }
    result = result.replace(/[？?。，,！!、：:""''（）()]/g, '')

    return result.trim().split(/\s+/).filter(k => k.length > 0)
  }

  /**
   * 提取来源信息
   */
  private extractSources(results: FusedResult[]): SourceInfo[] {
    const sourceMap = new Map<string, SourceInfo>()

    for (const result of results) {
      const metadata = result.document.metadata as ChunkMetadata | DictionaryMetadata

      if ("textId" in metadata) {
        const key = `${metadata.textId}:${metadata.juan}`

        if (!sourceMap.has(key)) {
          sourceMap.set(key, {
            textId: metadata.textId,
            title: metadata.title,
            juan: metadata.juan,
            retrievalMethods: [...result.sources],
            similarity: metadata.similarity,
          })
        } else {
          const existing = sourceMap.get(key)!
          for (const source of result.sources) {
            if (!existing.retrievalMethods.includes(source)) {
              existing.retrievalMethods.push(source)
            }
          }
        }
      }
    }

    return [...sourceMap.values()]
  }
}
