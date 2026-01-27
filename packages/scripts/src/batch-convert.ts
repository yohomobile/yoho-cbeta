/**
 * 批量转换 CBETA XML 为 JSON
 * - 保持目录结构一一对应
 * - 每个文件独立追踪 git commit，只处理有更新的文件
 */

import { execSync } from 'child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { basename, dirname, join, relative } from 'path'
import { CbetaParser } from './parser.js'

// 配置
const XML_SOURCE_DIR = '/home/guang/happy/xml-p5a'
const JSON_OUTPUT_DIR = '/home/guang/happy/yoho-cbeta/data'
const COMMIT_RECORD_FILE = join(JSON_OUTPUT_DIR, '.file-commits.json')

interface FileCommitRecord {
  [relativePath: string]: {
    commit: string
    processedAt: string
  }
}

/**
 * 获取单个文件的最新 commit hash
 */
function getFileCommit(relativePath: string): string {
  try {
    const result = execSync(`git log --format="%H" -1 -- "${relativePath}"`, {
      cwd: XML_SOURCE_DIR,
      encoding: 'utf-8'
    })
    return result.trim()
  } catch {
    return ''
  }
}

/**
 * 读取已处理的 commit 记录
 */
function getProcessedRecords(): FileCommitRecord {
  if (!existsSync(COMMIT_RECORD_FILE)) {
    return {}
  }
  try {
    const content = readFileSync(COMMIT_RECORD_FILE, 'utf-8')
    return JSON.parse(content)
  } catch {
    return {}
  }
}

/**
 * 保存已处理的 commit 记录
 */
function saveProcessedRecords(records: FileCommitRecord): void {
  writeFileSync(COMMIT_RECORD_FILE, JSON.stringify(records, null, 2), 'utf-8')
}

/**
 * 递归查找所有 XML 文件
 */
function findXmlFiles(dir: string, files: string[] = []): string[] {
  const entries = readdirSync(dir)

  for (const entry of entries) {
    // 跳过隐藏目录和文件
    if (entry.startsWith('.')) continue

    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      findXmlFiles(fullPath, files)
    } else if (entry.endsWith('.xml')) {
      files.push(fullPath)
    }
  }

  return files
}

/**
 * 转换单个 XML 文件为 JSON
 */
function convertFile(parser: CbetaParser, xmlPath: string): { success: boolean; error?: string } {
  try {
    // 计算相对路径和输出路径
    const relativePath = relative(XML_SOURCE_DIR, xmlPath)
    const jsonRelativePath = relativePath.replace(/\.xml$/, '.json')
    const jsonPath = join(JSON_OUTPUT_DIR, jsonRelativePath)

    // 确保输出目录存在
    const jsonDir = dirname(jsonPath)
    if (!existsSync(jsonDir)) {
      mkdirSync(jsonDir, { recursive: true })
    }

    // 解析并保存
    const doc = parser.parse(xmlPath)
    writeFileSync(jsonPath, JSON.stringify(doc, null, 2), 'utf-8')

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

  console.log('=== CBETA XML 转 JSON 批量工具 ===\n')
  if (limit > 0) {
    console.log(`限制处理数量: ${limit} 个文件\n`)
  }

  // 检查源目录
  if (!existsSync(XML_SOURCE_DIR)) {
    console.error(`错误: 源目录不存在 ${XML_SOURCE_DIR}`)
    process.exit(1)
  }

  // 确保输出目录存在
  if (!existsSync(JSON_OUTPUT_DIR)) {
    mkdirSync(JSON_OUTPUT_DIR, { recursive: true })
  }

  // 读取已处理记录
  const processedRecords = getProcessedRecords()
  console.log(`已有处理记录: ${Object.keys(processedRecords).length} 个文件\n`)

  // 查找所有 XML 文件
  console.log('扫描 XML 文件...')
  const xmlFiles = findXmlFiles(XML_SOURCE_DIR)
  console.log(`找到 ${xmlFiles.length} 个 XML 文件\n`)

  // 检查需要处理的文件
  console.log('检查文件更新状态...')
  const filesToProcess: { path: string; relativePath: string; commit: string }[] = []

  for (let i = 0; i < xmlFiles.length; i++) {
    const xmlPath = xmlFiles[i]
    const relativePath = relative(XML_SOURCE_DIR, xmlPath)

    // 显示进度
    if ((i + 1) % 500 === 0) {
      process.stdout.write(`\r检查进度: ${i + 1}/${xmlFiles.length}`)
    }

    // 获取文件当前 commit
    const currentCommit = getFileCommit(relativePath)
    if (!currentCommit) continue

    // 检查是否需要处理
    const record = processedRecords[relativePath]
    if (!record || record.commit !== currentCommit) {
      filesToProcess.push({ path: xmlPath, relativePath, commit: currentCommit })
    }
  }

  console.log(`\n\n需要处理: ${filesToProcess.length} 个文件`)
  console.log(`已是最新: ${xmlFiles.length - filesToProcess.length} 个文件\n`)

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
  const parser = new CbetaParser()
  let successCount = 0
  let errorCount = 0
  const errors: { file: string; error: string }[] = []

  for (let i = 0; i < actualFiles.length; i++) {
    const { path: xmlPath, relativePath, commit } = actualFiles[i]

    // 显示进度
    if ((i + 1) % 100 === 0 || i === actualFiles.length - 1) {
      process.stdout.write(`\r处理中: ${i + 1}/${actualFiles.length} (${Math.round((i + 1) / actualFiles.length * 100)}%)`)
    }

    const result = convertFile(parser, xmlPath)
    if (result.success) {
      successCount++
      // 更新记录
      processedRecords[relativePath] = {
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
    const errorLogPath = join(JSON_OUTPUT_DIR, '.conversion-errors.json')
    writeFileSync(errorLogPath, JSON.stringify(errors, null, 2), 'utf-8')
    console.log(`\n错误详情已保存到: ${errorLogPath}`)
  }

  // 保存处理记录
  saveProcessedRecords(processedRecords)
  console.log(`\n处理记录已更新，共 ${Object.keys(processedRecords).length} 个文件`)
}

main().catch(e => {
  console.error('执行出错:', e)
  process.exit(1)
})
