#!/usr/bin/env tsx
/**
 * 解析覆盖率分析脚本
 * 分析 parsed/ 目录下所有文件的字段覆盖率
 */

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'

interface ParsedMetadata {
  id: string
  canonId: string
  volume: string
  number: string
  title: string
  titleSource: 'jhead' | 'head' | 'filename'
  titleRaw: string
  titleTraditional: string | null  // 新增
  titleSanskrit: string | null
  titlePali: string | null
  titleAlt: string | null          // 新增
  sourceText: string | null        // 新增
  categoryId: string | null        // 新增
  bylineRaw: string | null
  juanCount: number
  pageStart: string | null
  pageEnd: string | null
  toc: Array<{ level: number; type: string; title: string; juanNumber: number | null }>
  hasDharani: boolean
  hasVerse: boolean
  contentType: string | null
  docNumber: string | null
  docNumberParsed: string[]
  parsedAt: string
  sourceHash: string
  // AI 增强字段
  translationDynasty?: string | null
  translationEra?: string | null
  translationEraTraditional?: string | null
  translationPlace?: string | null
  translationPlaceTraditional?: string | null
  persons?: Array<{
    name: string
    nameTraditional: string
    dynasty: string
    dynastyTraditional: string
    nationality: string
    nationalityTraditional: string
    identity: string
    identityTraditional: string
    title: string
    titleTraditional: string
  }>
  contributors?: Array<{
    name: string
    role: string
    roleText: string
    isPrimary: boolean
    position: number
  }>
  collaboration?: {
    type: string | null
    persons: Array<{ name: string; role: string }>
    rawText: string
  }
  relations?: Array<{
    relationType: string
    targetHint: string
    rawText: string
  }>
  extractedAt?: string
}

interface CoverageStats {
  total: number
  covered: number
  empty: number
  emptyIds: string[]
}

interface FullCoverageReport {
  totalFiles: number
  fields: {
    [field: string]: {
      coverage: number
      count: number
      total: number
      emptyExamples?: string[]
    }
  }
  contentTypeBreakdown?: { [type: string]: number }
  titleSourceBreakdown?: { [source: string]: number }
  canonBreakdown?: { [canon: string]: number }
}

function getAllJsonFiles(dir: string): string[] {
  const files: string[] = []
  const items = readdirSync(dir)
  for (const item of items) {
    const fullPath = join(dir, item)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      files.push(...getAllJsonFiles(fullPath))
    } else if (item.endsWith('.json') && !item.startsWith('.') && item !== '.cache.json') {
      files.push(fullPath)
    }
  }
  return files
}

function analyzeCoverage(files: string[]): FullCoverageReport {
  const stats: FullCoverageReport = {
    totalFiles: files.length,
    fields: {}
  }

  const contentTypeCounts: { [type: string]: number } = {}
  const titleSourceCounts: { [source: string]: number } = {}
  const canonCounts: { [canon: string]: number } = {}

  // 初始化字段统计
  const fieldsToAnalyze: (keyof ParsedMetadata)[] = [
    'id',
    'canonId',
    'volume',
    'number',
    'title',
    'titleSource',
    'titleRaw',
    'titleTraditional',   // 新增
    'titleSanskrit',
    'titlePali',
    'titleAlt',           // 新增
    'sourceText',         // 新增
    'categoryId',         // 新增
    'bylineRaw',
    'juanCount',
    'pageStart',
    'pageEnd',
    'toc',
    'hasDharani',
    'hasVerse',
    'contentType',
    'docNumber',
    'docNumberParsed',
  ]

  for (const field of fieldsToAnalyze) {
    stats.fields[field] = { coverage: 0, count: 0, total: files.length, emptyExamples: [] }
  }

  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8')
      const data: ParsedMetadata = JSON.parse(content)

      // canonId 分布
      if (data.canonId) {
        canonCounts[data.canonId] = (canonCounts[data.canonId] || 0) + 1
      }

      // titleSource 分布
      if (data.titleSource) {
        titleSourceCounts[data.titleSource] = (titleSourceCounts[data.titleSource] || 0) + 1
      }

      // contentType 分布
      if (data.contentType) {
        contentTypeCounts[data.contentType] = (contentTypeCounts[data.contentType] || 0) + 1
      }

      // 分析每个字段
      for (const field of fieldsToAnalyze) {
        const value = data[field]
        const isNonEmpty = checkNonEmpty(value, field)
        const statsField = stats.fields[field]

        if (isNonEmpty) {
          statsField.count++
        } else if (statsField.emptyExamples && statsField.emptyExamples.length < 5) {
          statsField.emptyExamples.push(data.id)
        }
      }
    } catch (e) {
      console.error(`解析失败: ${file}`)
    }
  }

  // 计算覆盖率
  for (const field of fieldsToAnalyze) {
    const statsField = stats.fields[field]
    statsField.coverage = parseFloat((statsField.count / statsField.total * 100).toFixed(1))
  }

  // 保存分类统计
  stats.contentTypeBreakdown = contentTypeCounts
  stats.titleSourceBreakdown = titleSourceCounts
  stats.canonBreakdown = canonCounts

  return stats
}

function checkNonEmpty(value: any, field: string): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string' && value.trim() === '') return false
  if (Array.isArray(value) && value.length === 0) return false
  if (field === 'juanCount' && value <= 0) return false
  return true
}

function printReport(stats: FullCoverageReport): void {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║           CBETA 元数据提取覆盖率分析报告                    ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log()
  console.log(`📁 分析文件数: ${stats.totalFiles}`)
  console.log()

  // 规则解析字段
  console.log('【规则解析字段】')
  console.log('─'.repeat(60))
  const ruleFields: (keyof ParsedMetadata)[] = [
    'title',
    'titleTraditional',    // 新增
    'titleSanskrit',
    'titlePali',
    'titleAlt',            // 新增
    'sourceText',          // 新增
    'categoryId',          // 新增
    'bylineRaw',
    'juanCount',
    'pageStart',
    'pageEnd',
    'toc',
    'hasDharani',
    'hasVerse',
    'contentType',
    'docNumber',
  ]

  for (const field of ruleFields) {
    const s = stats.fields[field]
    const bar = '█'.repeat(Math.round(s.coverage / 5)) + '░'.repeat(20 - Math.round(s.coverage / 5))
    const status = s.coverage === 100 ? '✅' : s.coverage >= 90 ? '⚠️' : '❌'
    console.log(`${status} ${field.padEnd(16)} ${bar} ${s.coverage.toString().padStart(5)}% ${s.count}/${s.total}`)
    if (s.emptyExamples && s.emptyExamples.length > 0 && s.coverage < 100) {
      console.log(`    示例: ${s.emptyExamples.slice(0, 3).join(', ')}`)
    }
  }
  console.log()

  // AI 增强字段
  console.log('【AI 增强字段】')
  console.log('─'.repeat(60))
  const aiFields: (keyof ParsedMetadata)[] = [
    'translationDynasty',
    'translationEra',
    'translationPlace',
    'persons',
    'contributors',
    'collaboration',
    'relations',
  ]

  const hasAiData = aiFields.some(f => (stats.fields[f]?.count || 0) > 0)

  if (hasAiData) {
    for (const field of aiFields) {
      const s = stats.fields[field]
      const bar = '█'.repeat(Math.round(s.coverage / 5)) + '░'.repeat(20 - Math.round(s.coverage / 5))
      console.log(`${' '.repeat(4)} ${field.padEnd(16)} ${bar} ${s.coverage.toString().padStart(5)}% ${s.count}/${s.total}`)
    }
  } else {
    console.log('  (尚未运行 AI 增强处理)')
  }
  console.log()

  // 标题来源分布
  if (stats.titleSourceBreakdown) {
    console.log('【标题来源分布】')
    console.log('─'.repeat(60))
    const total = stats.totalFiles
    for (const [source, count] of Object.entries(stats.titleSourceBreakdown)) {
      const pct = (count / total * 100).toFixed(1)
      console.log(`  ${source.padEnd(8)} ${count.toString().padStart(5)} (${pct}%)`)
    }
    console.log()
  }

  // 内容类型分布
  if (stats.contentTypeBreakdown) {
    console.log('【内容类型分布】')
    console.log('─'.repeat(60))
    const sorted = Object.entries(stats.contentTypeBreakdown).sort((a, b) => b[1] - a[1])
    for (const [type, count] of sorted) {
      const pct = (count / stats.totalFiles * 100).toFixed(1)
      console.log(`  ${type.padEnd(12)} ${count.toString().padStart(5)} (${pct}%)`)
    }
    // 显示未分类的数量
    const classified = Object.values(stats.contentTypeBreakdown).reduce((a, b) => a + b, 0)
    const unclassified = stats.totalFiles - classified
    if (unclassified > 0) {
      const pct = (unclassified / stats.totalFiles * 100).toFixed(1)
      console.log(`  ${'null'.padEnd(12)} ${unclassified.toString().padStart(5)} (${pct}%)`)
    }
    console.log()
  }

  // 藏经分布
  if (stats.canonBreakdown) {
    console.log('【藏经分布】')
    console.log('─'.repeat(60))
    const sorted = Object.entries(stats.canonBreakdown).sort((a, b) => b[1] - a[1])
    for (const [canon, count] of sorted) {
      const pct = (count / stats.totalFiles * 100).toFixed(1)
      console.log(`  ${canon.padEnd(4)} ${count.toString().padStart(5)} (${pct}%)`)
    }
    console.log()
  }

  // 覆盖率总结
  console.log('【覆盖率总结】')
  console.log('─'.repeat(60))
  const ruleCoverages = ruleFields
    .filter(f => !['titleSanskrit', 'titlePali', 'titleAlt', 'categoryId'].includes(f)) // 排除数据稀少的字段
    .map(f => stats.fields[f]?.coverage || 0)
  const avgRuleCoverage = ruleCoverages.length > 0
    ? (ruleCoverages.reduce((a, b) => a + b, 0) / ruleCoverages.length).toFixed(1)
    : '0'

  console.log(`  规则解析平均覆盖率: ${avgRuleCoverage}%`)
  console.log(`  字段完全解析率: ${Object.values(stats.fields).filter(f => f.coverage === 100).length}/${Object.keys(stats.fields).length}`)
  console.log()
  console.log('【说明】')
  console.log('  • titleTraditional: 使用 zhconv.toTraditional() 转换')
  console.log('  • titleAlt: 又名/略名/括号提取（覆盖率低，需AI增强）')
  console.log('  • categoryId: 仅 Taisho 藏有分类映射（~39%）')
  console.log('  • sourceText: header.source 提取（~100%）')
  console.log('  • bylineRaw: 留给 AI 解析人物/朝代/年号/地点')
}

async function main() {
  const projectRoot = join(import.meta.dirname, '../../..')
  const parsedDir = join(projectRoot, 'parsed')

  if (!existsSync(parsedDir)) {
    console.error('parsed 目录不存在，请先运行 extract-metadata.ts')
    process.exit(1)
  }

  console.log('扫描 parsed 目录...')
  const files = getAllJsonFiles(parsedDir)
  console.log(`找到 ${files.length} 个文件\n`)

  const stats = analyzeCoverage(files)
  printReport(stats)

  // 保存 JSON 报告
  const reportPath = join(import.meta.dirname, '../coverage-report.json')
  const { emptyExamples, ...reportForJson } = stats
  // 移除 emptyExamples 避免报告过大
  for (const key of Object.keys(reportForJson.fields)) {
    delete (reportForJson.fields as any)[key].emptyExamples
  }
  // 保留简化的空示例
  const simpleReport = {
    ...reportForJson,
    summary: {
      totalFiles: stats.totalFiles,
      fieldsAt100: Object.entries(stats.fields).filter(([, v]) => v.coverage === 100).map(([k]) => k),
      fieldsBelow100: Object.entries(stats.fields).filter(([, v]) => v.coverage < 100).map(([k]) => k),
      ruleFieldsCoverage: Object.fromEntries(
        Object.entries(stats.fields).filter(([k]) =>
          k.startsWith('title') || k.startsWith('juan') || k.startsWith('page') ||
          k === 'toc' || k === 'hasDharani' || k === 'hasVerse' || k === 'contentType' ||
          k === 'docNumber' || k === 'bylineRaw' || k === 'sourceText' || k === 'categoryId'
        )
      )
    }
  }
  writeFileSync(reportPath, JSON.stringify(simpleReport, null, 2))
  console.log(`\n📊 JSON 报告已保存: ${reportPath}`)
}

main().catch(console.error)
