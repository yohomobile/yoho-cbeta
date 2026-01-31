/**
 * LangChain 深度问答系统类型定义
 */

import { Document } from "@langchain/core/documents"

/** 检索来源类型 */
export type RetrievalSource = "semantic" | "fulltext" | "dictionary"

/** 经文类型 */
export type TextType = "经" | "律" | "论" | "注疏" | "仪轨" | "其他"

/** 检索到的文档元数据 */
export interface ChunkMetadata {
  textId: string
  title: string
  juan: number
  chunkIndex: number
  charStart: number
  charEnd: number
  source: RetrievalSource
  similarity?: number
  /** 经文类型 (经/律/论/注疏/仪轨/其他) */
  textType?: TextType
}

/** 词典条目元数据 */
export interface DictionaryMetadata {
  term: string
  source: string
  entrySource: RetrievalSource
}

/** 统一的检索结果文档 */
export type RetrievedDocument = Document<ChunkMetadata | DictionaryMetadata>

/** 融合后的检索结果 */
export interface FusedResult {
  id: string // textId:juan:chunkIndex 或 dict:term
  document: RetrievedDocument
  score: number
  sources: RetrievalSource[]
}

/** 经文引用 */
export interface Citation {
  quote: string
  sutraTitle: string
  juan: number
  textId: string
  position?: string
  matchType: RetrievalSource[]
}

/** 详细要点 */
export interface AnswerPoint {
  title: string
  explanation: string
  citations: Citation[]
}

/** 层次解读 */
export interface LevelInterpretation {
  literal: string
  profound: string
  practice?: string
}

/** 多经比较 */
export interface SutraComparison {
  aspect: string
  views: {
    sutra: string
    position: string
    quote: string
  }[]
}

/** 术语解释 */
export interface TermDefinition {
  term: string
  definition: string
  source: string
}

/** 来源信息 */
export interface SourceInfo {
  textId: string
  title: string
  juan: number
  retrievalMethods: RetrievalSource[]
  similarity?: number
}

/** 性能指标 - 检索阶段 */
export interface RetrievalMetrics {
  /** 语义检索 */
  semantic: {
    timeMs: number
    count: number
    avgSimilarity: number
  }
  /** 全文检索 */
  fulltext: {
    timeMs: number
    count: number
    avgRank: number
    usedLike: boolean
  }
  /** 词典检索 */
  dictionary: {
    timeMs: number
    count: number
  }
  /** 融合 */
  fusion: {
    timeMs: number
    inputCount: number
    outputCount: number
    multiHitChunks: number
    multiHitTexts: number
  }
  /** 总计 */
  totalTimeMs: number
}

/** 性能指标 - 上下文处理阶段 */
export interface ContextMetrics {
  /** 扩展 */
  expansion: {
    timeMs: number
    queriesCount: number
  }
  /** 格式化与截断 */
  formatting: {
    timeMs: number
    chunkCount: number
    dictCount: number
    avgChunkLen: number
    maxChunkLen: number
    truncatedCount: number
    droppedCount: number
    finalLength: number
  }
}

/** 性能指标 - LLM 生成阶段 */
export interface GenerationMetrics {
  timeMs: number
  model: string
  inputTokensEstimate: number
  outputPointsCount: number
  outputTermsCount: number
}

/** 完整性能报告 */
export interface PerformanceReport {
  timestamp: string
  question: string
  retrieval: RetrievalMetrics
  context: ContextMetrics
  generation: GenerationMetrics
  totalTimeMs: number
}

/** 深度问答响应 */
export interface DeepAnswerResponse {
  question: string
  summary: string
  terminology: TermDefinition[]
  points: AnswerPoint[]
  comparison?: SutraComparison[]
  levels?: LevelInterpretation
  followUpQuestions: string[]
  sources: SourceInfo[]
  meta: {
    totalChunksSearched: number
    retrievalTimeMs: number
    generationTimeMs: number
  }
  /** 详细性能报告（可选，调试用） */
  performance?: PerformanceReport
}

/** 检索器配置 */
export interface RetrieverConfig {
  /** 每个检索器返回的最大结果数 */
  topK: number
}

/** 融合检索器配置 */
export interface EnsembleConfig {
  /** 语义检索权重 */
  semanticWeight: number
  /** 全文检索权重 */
  fulltextWeight: number
  /** 词典检索权重 */
  dictionaryWeight: number
  /** RRF 参数 k */
  rrfK: number
  /** 最终返回的结果数 */
  finalTopK: number
}

/** 深度 RAG 配置 */
export interface DeepRAGConfig {
  retriever: RetrieverConfig
  ensemble: EnsembleConfig
  /** 是否扩展上下文（获取前后 chunks） */
  expandContext: boolean
  /** 上下文扩展范围（前后各几个 chunk） */
  contextWindow: number
  /** 单条内容最大长度（超过则智能截断） */
  maxChunkLength: number
  /** 总上下文最大长度（超过则按相关性截断） */
  maxContextLength: number
}

/** 默认配置 */
export const DEFAULT_CONFIG: DeepRAGConfig = {
  retriever: {
    topK: 10,
  },
  ensemble: {
    semanticWeight: 0.5,
    fulltextWeight: 0.3,
    dictionaryWeight: 0.2,
    rrfK: 60,
    finalTopK: 15,
  },
  expandContext: true,
  contextWindow: 2,
  maxChunkLength: 1500, // 单条最大 1500 字
  maxContextLength: 20000, // 总上下文最大 20000 字
}

// ==================== 评估系统类型 ====================

/** 测试问题 */
export interface TestQuestion {
  id: string
  question: string
  /** 期望在检索结果中出现的关键词 */
  expectedKeywords: string[]
  /** 期望在 LLM 答案中出现的关键词（对于后学概括术语） */
  expectedAnswerKeywords?: string[]
  /** 期望检索到的经文 ID（可选） */
  expectedTextIds?: string[]
  /** 期望检索到的经文标题关键词（可选） */
  expectedTitles?: string[]
  /** 问题类别 */
  category: "concept" | "quote" | "comparison" | "practice" | "terminology"
  /** 难度 */
  difficulty: "easy" | "medium" | "hard" | "expert"
}

/** 检索质量评分 */
export interface RetrievalQuality {
  /** 关键词命中率 (0-1) - 检索结果中 */
  keywordHitRate: number
  /** 命中的关键词（检索结果中） */
  hitKeywords: string[]
  /** 未命中的关键词（检索结果中） */
  missedKeywords: string[]
  /** 经文 ID 命中率 (0-1) */
  textIdHitRate: number
  /** 命中的经文 ID */
  hitTextIds: string[]
  /** 标题关键词命中率 (0-1) */
  titleHitRate: number
  /** 命中的标题关键词 */
  hitTitles: string[]
  /** 答案关键词命中率 (0-1) - LLM 答案中 */
  answerKeywordHitRate?: number
  /** 命中的答案关键词 */
  hitAnswerKeywords?: string[]
  /** 未命中的答案关键词 */
  missedAnswerKeywords?: string[]
  /** 多路检索贡献分析 */
  sourceContribution: {
    semantic: number
    fulltext: number
    dictionary: number
    multiHit: number
  }
}

/** 引用验证结果 */
export interface CitationValidation {
  /** 总引用数 */
  totalCitations: number
  /** 有效引用数（能在原文中找到） */
  validCitations: number
  /** 引用准确率 (0-1) */
  accuracy: number
  /** 详细验证结果 */
  details: {
    quote: string
    textId: string
    juan: number
    isValid: boolean
    matchScore: number
    matchedContent?: string
  }[]
}

/** 答案质量评分 */
export interface AnswerQuality {
  /** 术语覆盖率 */
  terminologyCoverage: number
  /** 要点数量 */
  pointsCount: number
  /** 平均引用数 */
  avgCitationsPerPoint: number
  /** 是否包含多经比较 */
  hasComparison: boolean
  /** 是否包含层次解读 */
  hasLevels: boolean
  /** 延伸问题数量 */
  followUpCount: number
}

/** 单个问题的评估结果 */
export interface QuestionEvaluation {
  question: TestQuestion
  /** 检索质量 */
  retrievalQuality: RetrievalQuality
  /** 引用验证 */
  citationValidation: CitationValidation
  /** 答案质量 */
  answerQuality: AnswerQuality
  /** 综合评分 (0-100) */
  overallScore: number
  /** 耗时 */
  timeMs: number
  /** 原始响应 */
  response: DeepAnswerResponse
}

/** 评估报告 */
export interface EvaluationReport {
  /** 评估时间 */
  timestamp: string
  /** 测试问题数 */
  totalQuestions: number
  /** 按类别统计 */
  byCategory: {
    category: string
    count: number
    avgScore: number
  }[]
  /** 按难度统计 */
  byDifficulty: {
    difficulty: string
    count: number
    avgScore: number
  }[]
  /** 检索质量汇总 */
  retrievalSummary: {
    avgKeywordHitRate: number
    avgTextIdHitRate: number
    avgTitleHitRate: number
    semanticContribution: number
    fulltextContribution: number
    dictionaryContribution: number
  }
  /** 引用验证汇总 */
  citationSummary: {
    totalCitations: number
    validCitations: number
    overallAccuracy: number
  }
  /** 答案质量汇总 */
  answerSummary: {
    avgTerminologyCoverage: number
    avgPointsCount: number
    avgCitationsPerPoint: number
    comparisonRate: number
    levelsRate: number
  }
  /** 综合评分 */
  overallScore: number
  /** 平均耗时 */
  avgTimeMs: number
  /** 各问题详细结果 */
  details: QuestionEvaluation[]
}
