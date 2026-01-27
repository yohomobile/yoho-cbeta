/**
 * 将繁体 JSON 转换为简体 JSON
 * - 读取 data/ 目录的繁体 JSON
 * - 输出到 data-simplified/ 目录
 * - 按文件 commit 追踪，增量更新
 * - 使用本地 zhconv (TypeScript) 进行繁简转换
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { toSimplified } from './zhconv.js'

// 配置
const SOURCE_DIR = '/home/guang/happy/yoho-cbeta/data'
const OUTPUT_DIR = '/home/guang/happy/yoho-cbeta/data-simplified'
const SOURCE_COMMITS_FILE = join(SOURCE_DIR, '.file-commits.json')
const SIMPLIFIED_COMMITS_FILE = join(OUTPUT_DIR, '.file-commits.json')

interface FileCommitRecord {
  [relativePath: string]: {
    commit: string
    processedAt: string
  }
}

/**
 * 递归转换 JSON 中的所有字符串为简体
 */
function simplifyValue(value: any): any {
  if (typeof value === 'string') {
    return toSimplified(value)
  }
  if (Array.isArray(value)) {
    return value.map(simplifyValue)
  }
  if (value !== null && typeof value === 'object') {
    const result: any = {}
    for (const [k, v] of Object.entries(value)) {
      result[k] = simplifyValue(v)
    }
    return result
  }
  return value
}

/**
 * 读取 commit 记录
 */
function getCommitRecords(filePath: string): FileCommitRecord {
  if (!existsSync(filePath)) {
    return {}
  }
  try {
    const content = readFileSync(filePath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return {}
  }
}

/**
 * 保存 commit 记录
 */
function saveCommitRecords(filePath: string, records: FileCommitRecord): void {
  writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf-8')
}

/**
 * 转换单个文件
 */
function convertFile(sourcePath: string, outputPath: string): { success: boolean; error?: string } {
  try {
    // 读取源文件
    const content = readFileSync(sourcePath, 'utf-8')
    const data = JSON.parse(content)

    // 转换为简体
    const simplified = simplifyValue(data)

    // 确保输出目录存在
    const outputDir = dirname(outputPath)
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true })
    }

    // 写入文件
    writeFileSync(outputPath, JSON.stringify(simplified, null, 2), 'utf-8')

    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

/**
 * 主函数
 */
async function main() {
  // 从命令行参数获取处理数量限制
  const limitArg = process.argv[2]
  const limit = limitArg ? parseInt(limitArg, 10) : 0

  console.log('=== 繁体 → 简体 JSON 转换工具 ===\n')
  if (limit > 0) {
    console.log(`限制处理数量: ${limit} 个文件\n`)
  }

  // 检查源目录
  if (!existsSync(SOURCE_DIR)) {
    console.error(`错误: 源目录不存在 ${SOURCE_DIR}`)
    process.exit(1)
  }

  // 检查源 commit 记录
  if (!existsSync(SOURCE_COMMITS_FILE)) {
    console.error(`错误: 源 commit 记录不存在，请先运行 pnpm convert`)
    process.exit(1)
  }

  // 确保输出目录存在
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  // 读取 commit 记录
  const sourceRecords = getCommitRecords(SOURCE_COMMITS_FILE)
  const simplifiedRecords = getCommitRecords(SIMPLIFIED_COMMITS_FILE)

  console.log(`源文件记录: ${Object.keys(sourceRecords).length} 个`)
  console.log(`已简化记录: ${Object.keys(simplifiedRecords).length} 个\n`)

  // 找出需要处理的文件
  const filesToProcess: { relativePath: string; commit: string }[] = []

  for (const [relativePath, record] of Object.entries(sourceRecords)) {
    const simplifiedRecord = simplifiedRecords[relativePath]
    // 如果没处理过，或者源文件 commit 变了，需要重新处理
    if (!simplifiedRecord || simplifiedRecord.commit !== record.commit) {
      filesToProcess.push({ relativePath, commit: record.commit })
    }
  }

  console.log(`需要处理: ${filesToProcess.length} 个文件`)
  console.log(`已是最新: ${Object.keys(sourceRecords).length - filesToProcess.length} 个文件\n`)

  if (filesToProcess.length === 0) {
    console.log('所有文件均已是最新，无需处理。')
    return
  }

  // 应用数量限制
  const actualFiles = limit > 0 ? filesToProcess.slice(0, limit) : filesToProcess
  if (limit > 0 && filesToProcess.length > limit) {
    console.log(`本次只处理前 ${limit} 个文件\n`)
  }

  // 开始转换
  let successCount = 0
  let errorCount = 0
  const errors: { file: string; error: string }[] = []

  for (let i = 0; i < actualFiles.length; i++) {
    const { relativePath, commit } = actualFiles[i]

    // 显示进度
    if ((i + 1) % 100 === 0 || i === actualFiles.length - 1) {
      process.stdout.write(`\r处理中: ${i + 1}/${actualFiles.length} (${Math.round((i + 1) / actualFiles.length * 100)}%)`)
    }

    // 构建路径
    const jsonRelativePath = relativePath.replace(/\.xml$/, '.json')
    const sourcePath = join(SOURCE_DIR, jsonRelativePath)
    const outputPath = join(OUTPUT_DIR, jsonRelativePath)

    const result = convertFile(sourcePath, outputPath)
    if (result.success) {
      successCount++
      // 更新记录
      simplifiedRecords[relativePath] = {
        commit,
        processedAt: new Date().toISOString()
      }
    } else {
      errorCount++
      errors.push({ file: relativePath, error: result.error || '未知错误' })
    }
  }

  console.log('\n\n=== 转换完成 ===')
  console.log(`成功: ${successCount}`)
  console.log(`失败: ${errorCount}`)

  // 保存错误日志
  if (errors.length > 0) {
    const errorLogPath = join(OUTPUT_DIR, '.conversion-errors.json')
    writeFileSync(errorLogPath, JSON.stringify(errors, null, 2), 'utf-8')
    console.log(`\n错误详情已保存到: ${errorLogPath}`)
  }

  // 保存处理记录
  saveCommitRecords(SIMPLIFIED_COMMITS_FILE, simplifiedRecords)
  console.log(`\n处理记录已更新，共 ${Object.keys(simplifiedRecords).length} 个文件`)
}

main().catch(e => {
  console.error('执行出错:', e)
  process.exit(1)
})
