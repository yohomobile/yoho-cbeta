/**
 * RAG 评估器
 * 评估检索质量、引用准确性和答案质量
 */

import { db } from "../../db/index.js"
import { sql } from "drizzle-orm"
import { DeepRAGChain } from "../chains/deep-rag.js"
import type {
  TestQuestion,
  DeepAnswerResponse,
  RetrievalQuality,
  CitationValidation,
  AnswerQuality,
  QuestionEvaluation,
  EvaluationReport,
  FusedResult,
  ChunkMetadata,
  DictionaryMetadata,
} from "../types.js"

export class RAGEvaluator {
  private chain: DeepRAGChain

  constructor() {
    this.chain = new DeepRAGChain()
  }

  /**
   * 评估单个问题
   */
  async evaluateQuestion(question: TestQuestion): Promise<QuestionEvaluation> {
    console.log(`\n[Eval] 评估问题: "${question.question}" (${question.id})`)
    const startTime = Date.now()

    // 1. 调用 RAG 链获取响应
    const response = await this.chain.invoke(question.question, { includePerformance: true })

    // 2. 获取检索结果（用于评估检索质量）
    const retrievalResults = await this.chain.getRetrievalResults(question.question)

    // 3. 评估检索质量（包括答案关键词检查）
    const retrievalQuality = this.evaluateRetrievalQuality(question, retrievalResults, response)
    console.log(`  - 检索质量: 关键词命中 ${(retrievalQuality.keywordHitRate * 100).toFixed(1)}%`)
    if (retrievalQuality.answerKeywordHitRate !== undefined) {
      console.log(`  - 答案关键词: ${retrievalQuality.hitAnswerKeywords!.length}/${retrievalQuality.hitAnswerKeywords!.length + retrievalQuality.missedAnswerKeywords!.length} (${(retrievalQuality.answerKeywordHitRate * 100).toFixed(1)}%)`)
    }

    // 4. 验证引用
    const citationValidation = await this.validateCitations(response)
    console.log(`  - 引用验证: ${citationValidation.validCitations}/${citationValidation.totalCitations} (${(citationValidation.accuracy * 100).toFixed(1)}%)`)

    // 5. 评估答案质量
    const answerQuality = this.evaluateAnswerQuality(response)
    console.log(`  - 答案质量: ${answerQuality.pointsCount} 个要点, ${answerQuality.terminologyCoverage} 个术语`)

    // 6. 计算综合评分
    const overallScore = this.calculateOverallScore(retrievalQuality, citationValidation, answerQuality)
    console.log(`  - 综合评分: ${overallScore.toFixed(1)}`)

    const timeMs = Date.now() - startTime

    return {
      question,
      retrievalQuality,
      citationValidation,
      answerQuality,
      overallScore,
      timeMs,
      response,
    }
  }

  /**
   * 评估检索质量
   */
  private evaluateRetrievalQuality(
    question: TestQuestion,
    results: FusedResult[],
    response?: DeepAnswerResponse
  ): RetrievalQuality {
    // 1. 关键词命中检查 - 检索结果中
    const hitKeywords: string[] = []
    const missedKeywords: string[] = []

    for (const keyword of question.expectedKeywords) {
      const found = results.some(r => r.document.pageContent.includes(keyword))
      if (found) {
        hitKeywords.push(keyword)
      } else {
        missedKeywords.push(keyword)
      }
    }

    const keywordHitRate = question.expectedKeywords.length > 0
      ? hitKeywords.length / question.expectedKeywords.length
      : 1

    // 1.5. 答案关键词命中检查 - LLM 答案中（针对后学概括术语）
    let answerKeywordHitRate: number | undefined
    let hitAnswerKeywords: string[] | undefined
    let missedAnswerKeywords: string[] | undefined

    if (question.expectedAnswerKeywords && question.expectedAnswerKeywords.length > 0) {
      hitAnswerKeywords = []
      missedAnswerKeywords = []

      // 合并答案中的所有文本内容
      const answerText = [
        response?.summary || "",
        ...response?.points.map(p => p.title + p.explanation) || [],
        ...response?.terminology.map(t => t.term + t.definition) || [],
        response?.levels?.literal || "",
        response?.levels?.profound || "",
        response?.levels?.practice || "",
        ...response?.comparison?.map(c => c.aspect + c.views.map(v => v.position).join("")) || [],
      ].join("")

      for (const keyword of question.expectedAnswerKeywords) {
        if (answerText.includes(keyword)) {
          hitAnswerKeywords.push(keyword)
        } else {
          missedAnswerKeywords.push(keyword)
        }
      }

      answerKeywordHitRate = hitAnswerKeywords.length / question.expectedAnswerKeywords.length
    }

    // 2. 经文 ID 命中检查
    const hitTextIds: string[] = []
    if (question.expectedTextIds) {
      for (const textId of question.expectedTextIds) {
        const found = results.some(r => {
          const meta = r.document.metadata as ChunkMetadata | DictionaryMetadata
          return "textId" in meta && meta.textId === textId
        })
        if (found) {
          hitTextIds.push(textId)
        }
      }
    }

    const textIdHitRate = question.expectedTextIds && question.expectedTextIds.length > 0
      ? hitTextIds.length / question.expectedTextIds.length
      : 1

    // 3. 标题关键词命中检查
    const hitTitles: string[] = []
    if (question.expectedTitles) {
      for (const titleKeyword of question.expectedTitles) {
        const found = results.some(r => {
          const meta = r.document.metadata as ChunkMetadata | DictionaryMetadata
          return "title" in meta && meta.title.includes(titleKeyword)
        })
        if (found) {
          hitTitles.push(titleKeyword)
        }
      }
    }

    const titleHitRate = question.expectedTitles && question.expectedTitles.length > 0
      ? hitTitles.length / question.expectedTitles.length
      : 1

    // 4. 多路检索贡献分析
    let semanticCount = 0, fulltextCount = 0, dictionaryCount = 0, multiHitCount = 0

    for (const result of results) {
      if (result.sources.includes("semantic")) semanticCount++
      if (result.sources.includes("fulltext")) fulltextCount++
      if (result.sources.includes("dictionary")) dictionaryCount++
      if (result.sources.length > 1) multiHitCount++
    }

    const total = results.length || 1
    const sourceContribution = {
      semantic: semanticCount / total,
      fulltext: fulltextCount / total,
      dictionary: dictionaryCount / total,
      multiHit: multiHitCount / total,
    }

    return {
      keywordHitRate,
      hitKeywords,
      missedKeywords,
      textIdHitRate,
      hitTextIds,
      titleHitRate,
      hitTitles,
      answerKeywordHitRate,
      hitAnswerKeywords,
      missedAnswerKeywords,
      sourceContribution,
    }
  }

  /**
   * 验证引用准确性
   */
  async validateCitations(response: DeepAnswerResponse): Promise<CitationValidation> {
    const details: CitationValidation["details"] = []

    // 收集所有引用
    const allCitations = response.points.flatMap(p => p.citations)

    for (const citation of allCitations) {
      console.log(`    [Citation] 验证: "${citation.quote.slice(0, 30)}..." (${citation.textId} 卷${citation.juan})`)

      // 跳过词典引用（textId 为空或包含"词典"）
      if (!citation.textId || citation.textId === "词典" || citation.textId.includes("词典")) {
        console.log(`      - 跳过词典引用`)
        continue
      }

      // 构建 textId 匹配条件 - 支持模糊匹配
      // LLM 可能把 T01n0001 简化成 T0001，需要兼容
      const textIdEscaped = citation.textId.replace(/'/g, "''")
      let textIdCondition: string
      if (/^[A-Z]\d+$/.test(citation.textId)) {
        // 简化格式如 T0001，需要模糊匹配 T01n0001, T02n0001 等
        const prefix = citation.textId[0]
        const num = citation.textId.slice(1).replace(/^0+/, '') // 去掉前导0
        textIdCondition = `text_id LIKE '${prefix}%n${num.padStart(4, '0')}%'`
      } else {
        textIdCondition = `text_id = '${textIdEscaped}'`
      }

      // 在数据库中查找对应的经文内容
      const result = await db.execute(sql.raw(`
        SELECT content
        FROM text_chunks
        WHERE ${textIdCondition}
          AND juan = ${citation.juan}
        ORDER BY chunk_index
      `)) as unknown as Array<{ content: string }>

      let isValid = false
      let matchScore = 0
      let matchedContent: string | undefined

      if (result.length > 0) {
        // 合并该卷所有 chunk
        const fullContent = result.map(r => r.content).join("")
        console.log(`      - 找到 ${result.length} 个 chunks, 总长度 ${fullContent.length}`)

        // 计算引用匹配度
        const cleanQuote = citation.quote.replace(/[。，、！？；：""''（）\s]/g, "")
        const cleanContent = fullContent.replace(/[。，、！？；：""''（）\s]/g, "")
        console.log(`      - 清理后引用长度: ${cleanQuote.length}, 内容长度: ${cleanContent.length}`)

        if (cleanContent.includes(cleanQuote)) {
          isValid = true
          matchScore = 1
          matchedContent = citation.quote
          console.log(`      ✓ 精确匹配成功`)
        } else {
          console.log(`      ✗ 精确匹配失败，尝试模糊匹配`)
          // 模糊匹配：检查引用中的关键片段
          const fragments = cleanQuote.match(/.{4,8}/g) || []
          const matchedFragments = fragments.filter(f => cleanContent.includes(f))
          matchScore = fragments.length > 0 ? matchedFragments.length / fragments.length : 0
          isValid = matchScore >= 0.5

          if (isValid && matchedFragments.length > 0) {
            // 找到最长匹配片段在原文中的位置
            const longestFragment = matchedFragments.sort((a, b) => b.length - a.length)[0]
            const idx = fullContent.indexOf(longestFragment)
            if (idx >= 0) {
              const start = Math.max(0, idx - 20)
              const end = Math.min(fullContent.length, idx + longestFragment.length + 20)
              matchedContent = fullContent.slice(start, end)
            }
          }
        }
      }

      details.push({
        quote: citation.quote,
        textId: citation.textId,
        juan: citation.juan,
        isValid,
        matchScore,
        matchedContent,
      })
    }

    const validCitations = details.filter(d => d.isValid).length
    const totalCitations = details.length

    return {
      totalCitations,
      validCitations,
      accuracy: totalCitations > 0 ? validCitations / totalCitations : 1,
      details,
    }
  }

  /**
   * 评估答案质量
   */
  private evaluateAnswerQuality(response: DeepAnswerResponse): AnswerQuality {
    const terminologyCoverage = response.terminology.length
    const pointsCount = response.points.length

    const totalCitations = response.points.reduce((sum, p) => sum + p.citations.length, 0)
    const avgCitationsPerPoint = pointsCount > 0 ? totalCitations / pointsCount : 0

    return {
      terminologyCoverage,
      pointsCount,
      avgCitationsPerPoint,
      hasComparison: !!response.comparison && response.comparison.length > 0,
      hasLevels: !!response.levels,
      followUpCount: response.followUpQuestions.length,
    }
  }

  /**
   * 计算综合评分 (0-100)
   */
  private calculateOverallScore(
    retrieval: RetrievalQuality,
    citation: CitationValidation,
    answer: AnswerQuality
  ): number {
    // 权重分配
    const weights = {
      keywordHit: 25,      // 关键词命中
      textIdHit: 15,       // 经文 ID 命中
      titleHit: 10,        // 标题命中
      citationAccuracy: 25, // 引用准确性
      answerCompleteness: 25, // 答案完整性
    }

    // 1. 检索质量分
    const keywordScore = retrieval.keywordHitRate * weights.keywordHit
    const textIdScore = retrieval.textIdHitRate * weights.textIdHit
    const titleScore = retrieval.titleHitRate * weights.titleHit

    // 2. 引用准确性分
    const citationScore = citation.accuracy * weights.citationAccuracy

    // 3. 答案完整性分
    const completenessFactors = [
      answer.pointsCount >= 2 ? 1 : answer.pointsCount / 2,  // 至少 2 个要点
      answer.avgCitationsPerPoint >= 1 ? 1 : answer.avgCitationsPerPoint, // 每个要点至少 1 个引用
      answer.terminologyCoverage >= 2 ? 1 : answer.terminologyCoverage / 2, // 至少 2 个术语
      answer.followUpCount >= 2 ? 1 : answer.followUpCount / 2, // 至少 2 个延伸问题
    ]
    const completenessScore = (completenessFactors.reduce((a, b) => a + b) / 4) * weights.answerCompleteness

    return keywordScore + textIdScore + titleScore + citationScore + completenessScore
  }

  /**
   * 运行完整评估
   */
  async runEvaluation(questions: TestQuestion[]): Promise<EvaluationReport> {
    console.log(`\n========== 开始 RAG 评估 ==========`)
    console.log(`测试问题数: ${questions.length}`)

    const details: QuestionEvaluation[] = []

    for (let i = 0; i < questions.length; i++) {
      console.log(`\n[${i + 1}/${questions.length}]`)
      const evaluation = await this.evaluateQuestion(questions[i])
      details.push(evaluation)
    }

    // 按类别统计
    const categoryMap = new Map<string, { scores: number[]; count: number }>()
    for (const d of details) {
      const cat = d.question.category
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, { scores: [], count: 0 })
      }
      categoryMap.get(cat)!.scores.push(d.overallScore)
      categoryMap.get(cat)!.count++
    }
    const byCategory = [...categoryMap.entries()].map(([category, data]) => ({
      category,
      count: data.count,
      avgScore: data.scores.reduce((a, b) => a + b, 0) / data.count,
    }))

    // 按难度统计
    const difficultyMap = new Map<string, { scores: number[]; count: number }>()
    for (const d of details) {
      const diff = d.question.difficulty
      if (!difficultyMap.has(diff)) {
        difficultyMap.set(diff, { scores: [], count: 0 })
      }
      difficultyMap.get(diff)!.scores.push(d.overallScore)
      difficultyMap.get(diff)!.count++
    }
    const byDifficulty = [...difficultyMap.entries()].map(([difficulty, data]) => ({
      difficulty,
      count: data.count,
      avgScore: data.scores.reduce((a, b) => a + b, 0) / data.count,
    }))

    // 检索质量汇总
    const retrievalSummary = {
      avgKeywordHitRate: details.reduce((sum, d) => sum + d.retrievalQuality.keywordHitRate, 0) / details.length,
      avgTextIdHitRate: details.reduce((sum, d) => sum + d.retrievalQuality.textIdHitRate, 0) / details.length,
      avgTitleHitRate: details.reduce((sum, d) => sum + d.retrievalQuality.titleHitRate, 0) / details.length,
      semanticContribution: details.reduce((sum, d) => sum + d.retrievalQuality.sourceContribution.semantic, 0) / details.length,
      fulltextContribution: details.reduce((sum, d) => sum + d.retrievalQuality.sourceContribution.fulltext, 0) / details.length,
      dictionaryContribution: details.reduce((sum, d) => sum + d.retrievalQuality.sourceContribution.dictionary, 0) / details.length,
    }

    // 引用验证汇总
    const citationSummary = {
      totalCitations: details.reduce((sum, d) => sum + d.citationValidation.totalCitations, 0),
      validCitations: details.reduce((sum, d) => sum + d.citationValidation.validCitations, 0),
      overallAccuracy: 0,
    }
    citationSummary.overallAccuracy = citationSummary.totalCitations > 0
      ? citationSummary.validCitations / citationSummary.totalCitations
      : 1

    // 答案质量汇总
    const answerSummary = {
      avgTerminologyCoverage: details.reduce((sum, d) => sum + d.answerQuality.terminologyCoverage, 0) / details.length,
      avgPointsCount: details.reduce((sum, d) => sum + d.answerQuality.pointsCount, 0) / details.length,
      avgCitationsPerPoint: details.reduce((sum, d) => sum + d.answerQuality.avgCitationsPerPoint, 0) / details.length,
      comparisonRate: details.filter(d => d.answerQuality.hasComparison).length / details.length,
      levelsRate: details.filter(d => d.answerQuality.hasLevels).length / details.length,
    }

    const overallScore = details.reduce((sum, d) => sum + d.overallScore, 0) / details.length
    const avgTimeMs = details.reduce((sum, d) => sum + d.timeMs, 0) / details.length

    const report: EvaluationReport = {
      timestamp: new Date().toISOString(),
      totalQuestions: questions.length,
      byCategory,
      byDifficulty,
      retrievalSummary,
      citationSummary,
      answerSummary,
      overallScore,
      avgTimeMs,
      details,
    }

    // 打印报告摘要
    this.printReportSummary(report)

    return report
  }

  /**
   * 打印报告摘要
   */
  private printReportSummary(report: EvaluationReport): void {
    console.log(`\n========== 评估报告摘要 ==========`)
    console.log(`时间: ${report.timestamp}`)
    console.log(`测试问题数: ${report.totalQuestions}`)
    console.log(`综合评分: ${report.overallScore.toFixed(1)}/100`)
    console.log(`平均耗时: ${(report.avgTimeMs / 1000).toFixed(1)}s`)

    console.log(`\n--- 按类别 ---`)
    for (const cat of report.byCategory) {
      console.log(`  ${cat.category}: ${cat.avgScore.toFixed(1)} (${cat.count} 题)`)
    }

    console.log(`\n--- 按难度 ---`)
    for (const diff of report.byDifficulty) {
      console.log(`  ${diff.difficulty}: ${diff.avgScore.toFixed(1)} (${diff.count} 题)`)
    }

    console.log(`\n--- 检索质量 ---`)
    console.log(`  关键词命中率: ${(report.retrievalSummary.avgKeywordHitRate * 100).toFixed(1)}%`)
    console.log(`  经文ID命中率: ${(report.retrievalSummary.avgTextIdHitRate * 100).toFixed(1)}%`)
    console.log(`  标题命中率: ${(report.retrievalSummary.avgTitleHitRate * 100).toFixed(1)}%`)
    console.log(`  语义检索贡献: ${(report.retrievalSummary.semanticContribution * 100).toFixed(1)}%`)
    console.log(`  全文检索贡献: ${(report.retrievalSummary.fulltextContribution * 100).toFixed(1)}%`)
    console.log(`  词典检索贡献: ${(report.retrievalSummary.dictionaryContribution * 100).toFixed(1)}%`)

    console.log(`\n--- 引用验证 ---`)
    console.log(`  总引用数: ${report.citationSummary.totalCitations}`)
    console.log(`  有效引用数: ${report.citationSummary.validCitations}`)
    console.log(`  准确率: ${(report.citationSummary.overallAccuracy * 100).toFixed(1)}%`)

    console.log(`\n--- 答案质量 ---`)
    console.log(`  平均术语数: ${report.answerSummary.avgTerminologyCoverage.toFixed(1)}`)
    console.log(`  平均要点数: ${report.answerSummary.avgPointsCount.toFixed(1)}`)
    console.log(`  平均引用/要点: ${report.answerSummary.avgCitationsPerPoint.toFixed(2)}`)
    console.log(`  包含比较: ${(report.answerSummary.comparisonRate * 100).toFixed(1)}%`)
    console.log(`  包含层次解读: ${(report.answerSummary.levelsRate * 100).toFixed(1)}%`)

    console.log(`\n========================================\n`)
  }
}
