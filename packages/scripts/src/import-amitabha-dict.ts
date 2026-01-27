/**
 * 阿彌陀佛聖教大辭典导入脚本
 *
 * 这是一个综合词典，包含20部佛学词典，需要按来源分别导入
 * 已存在的词典（佛光大辞典、丁福保佛学大辞典）会跳过
 *
 * 使用方法：
 *   pnpm tsx src/import-amitabha-dict.ts <mdx文件路径>
 */

import pg from 'pg'
import { toSimplified } from './zhconv.js'
import { execSync } from 'child_process'

// 数据库连接
const pool = new pg.Pool({
  database: 'cbeta',
  host: '/var/run/postgresql',
})

// 来源映射：繁体 -> 简体标准名
const SOURCE_MAP: Record<string, string> = {
  '佛光大辭典增訂版': '佛光大辞典',
  '丁福保佛學大辭典': '丁福保佛学大辞典',
  '佛教哲學大辭典(日蓮)': '佛教哲学大辞典(日莲)',
  '佛教人物傳': '佛教人物传',
  '釋氏六帖': '释氏六帖',
  '中華佛教百科全書': '中华佛教百科全书',
  '佛學常見辭彙': '佛学常见辞汇',
  '新編佛教辭典(陳兵)': '新编佛教辞典(陈兵)',
  '中國佛學人名辭典(明復法師)': '中国佛学人名辞典',
  '南山律學辭典': '南山律学辞典',
  '阿毗達磨辭典': '阿毗达磨辞典',
  '俗語佛源': '俗语佛源',
  '五百羅漢': '五百罗汉',
  '中國百科全書佛教篇': '中国百科全书佛教篇',
  '中國佛教小百科': '中国佛教小百科',
  '佛教常用唄器器物服裝簡述': '佛教常用呗器器物服装简述',
  '法苑談叢(周叔迦)': '法苑谈丛(周叔迦)',
  '佛源語詞詞典': '佛源语词词典',
}

// 已存在的词典（跳过导入）
const EXISTING_SOURCES = new Set(['佛光大辞典', '丁福保佛学大辞典'])

// 词典来源识别关键词
const DICT_KEYWORDS = ['辭典', '辭彙', '百科', '人物傳', '羅漢', '佛源', '六帖', '俗語', '法苑', '器物', '律學', '因明']

interface DictEntry {
  term: string
  termSimplified: string
  definition: string
  definitionText: string
  source: string
}

/**
 * 使用 Python readmdict 解析 MDX 文件
 */
async function parseMdxWithPython(mdxPath: string): Promise<DictEntry[]> {
  console.log(`\n📖 正在解析 MDX 文件...`)

  const pythonScript = `
import sys
import json
from readmdict import MDX
import re

mdx_path = sys.argv[1]
mdx = MDX(mdx_path)
items = list(mdx.items())

source_pattern = r'【([^】]+)】'
dict_keywords = ${JSON.stringify(DICT_KEYWORDS)}

entries = []
for key, value in items:
    if isinstance(key, bytes):
        key = key.decode('utf-8')
    if isinstance(value, bytes):
        value = value.decode('utf-8')

    # 提取来源
    match = re.search(source_pattern, value)
    if not match:
        continue

    source = match.group(1)

    # 检查是否是词典来源
    is_dict = False
    for kw in dict_keywords:
        if kw in source:
            is_dict = True
            break

    if not is_dict:
        continue

    # 清理词条名（去除前导数字序号）
    term = key.strip()
    if re.match(r'^\\d+\\s*', term):
        term = re.sub(r'^\\d+\\s*', '', term)

    # 跳过空词条或太短的词条
    if len(term) < 1:
        continue

    # 跳过目录类词条
    if '總目錄' in term or '製作說明' in term or '制作說明' in term:
        continue

    entries.append({
        'term': term,
        'definition': value,
        'source': source
    })

# 输出为 JSON Lines 格式
for entry in entries:
    print(json.dumps(entry, ensure_ascii=False))
`

  // 写入临时 Python 脚本
  const fs = await import('fs')
  const path = await import('path')
  const tempScript = '/tmp/parse_mdx.py'
  fs.writeFileSync(tempScript, pythonScript)

  // 运行 Python 脚本
  console.log(`   正在解析词条...`)
  const result = execSync(
    `source /home/guang/happy/yoho-cbeta/.venv/bin/activate && python3 ${tempScript} "${mdxPath}"`,
    {
      maxBuffer: 500 * 1024 * 1024, // 500MB buffer
      shell: '/bin/bash',
    }
  ).toString()

  const lines = result.trim().split('\n').filter(Boolean)
  console.log(`   解析到 ${lines.length} 条词条`)

  const entries: DictEntry[] = []
  for (const line of lines) {
    try {
      const data = JSON.parse(line)
      const sourceName = SOURCE_MAP[data.source] || toSimplified(data.source)

      entries.push({
        term: data.term,
        termSimplified: toSimplified(data.term),
        definition: data.definition,
        definitionText: extractText(data.definition),
        source: sourceName,
      })
    } catch {
      // 跳过解析失败的行
    }
  }

  return entries
}

/**
 * 清理 HTML 并提取纯文本
 */
function extractText(html: string): string {
  return sanitizeString(html)
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 清理无效字符
 */
function sanitizeString(str: string): string {
  return str.replace(/\x00/g, '').replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, '')
}

/**
 * 创建数据库表
 */
async function ensureTable() {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS dictionary_entries (
        id SERIAL PRIMARY KEY,
        term VARCHAR(500) NOT NULL,
        term_simplified VARCHAR(500),
        definition TEXT NOT NULL,
        definition_text TEXT,
        source VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(term, source)
      );

      CREATE INDEX IF NOT EXISTS idx_dict_term ON dictionary_entries(term);
      CREATE INDEX IF NOT EXISTS idx_dict_term_simplified ON dictionary_entries(term_simplified);
      CREATE INDEX IF NOT EXISTS idx_dict_source ON dictionary_entries(source);
    `)
    console.log('✅ 数据库表已就绪')
  } finally {
    client.release()
  }
}

/**
 * 导入词条到数据库
 */
async function importEntries(entries: DictEntry[]) {
  const client = await pool.connect()

  // 按来源分组统计
  const sourceStats: Record<string, { total: number; imported: number; skipped: number }> = {}

  // 过滤掉已存在的词典
  const filteredEntries = entries.filter((e) => {
    if (!sourceStats[e.source]) {
      sourceStats[e.source] = { total: 0, imported: 0, skipped: 0 }
    }
    sourceStats[e.source].total++

    if (EXISTING_SOURCES.has(e.source)) {
      sourceStats[e.source].skipped++
      return false
    }
    return true
  })

  console.log(`\n📊 词条统计:`)
  console.log('─'.repeat(60))
  for (const [source, stats] of Object.entries(sourceStats).sort((a, b) => b[1].total - a[1].total)) {
    const status = EXISTING_SOURCES.has(source) ? '⏭️  跳过(已存在)' : '📥 待导入'
    console.log(`  ${source}: ${stats.total} 条 ${status}`)
  }
  console.log('─'.repeat(60))
  console.log(`  待导入: ${filteredEntries.length} 条`)

  if (filteredEntries.length === 0) {
    console.log('\n⚠️  没有新词条需要导入')
    return sourceStats
  }

  console.log(`\n💾 开始导入...`)

  try {
    const batchSize = 100
    let totalImported = 0

    for (let i = 0; i < filteredEntries.length; i += batchSize) {
      const batch = filteredEntries.slice(i, i + batchSize)

      for (const entry of batch) {
        try {
          await client.query(
            `
            INSERT INTO dictionary_entries (term, term_simplified, definition, definition_text, source)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (term, source) DO UPDATE SET
              definition = EXCLUDED.definition,
              definition_text = EXCLUDED.definition_text,
              term_simplified = EXCLUDED.term_simplified
          `,
            [
              sanitizeString(entry.term),
              sanitizeString(entry.termSimplified),
              sanitizeString(entry.definition),
              sanitizeString(entry.definitionText),
              entry.source,
            ]
          )
          sourceStats[entry.source].imported++
          totalImported++
        } catch (error) {
          // 错误时打印详情
          if (sourceStats[entry.source].imported === 0 && sourceStats[entry.source].skipped === 0) {
            console.error(`   ⚠️ 导入错误 [${entry.source}]:`, error)
            console.error(`   词条: ${entry.term?.slice(0, 50)}`)
          }
        }
      }

      // 显示进度
      if ((i + batchSize) % 5000 === 0 || i + batchSize >= filteredEntries.length) {
        console.log(`   进度: ${Math.min(i + batchSize, filteredEntries.length)}/${filteredEntries.length} (${totalImported} 条成功)`)
      }
    }
  } finally {
    client.release()
  }

  return sourceStats
}

/**
 * 显示最终统计
 */
async function showFinalStats() {
  const client = await pool.connect()
  try {
    const result = await client.query(`
      SELECT source, COUNT(*) as count
      FROM dictionary_entries
      GROUP BY source
      ORDER BY count DESC
    `)

    console.log('\n📊 数据库词典统计:')
    console.log('─'.repeat(50))
    for (const row of result.rows) {
      console.log(`  ${row.source}: ${row.count} 条`)
    }

    const total = await client.query('SELECT COUNT(*) FROM dictionary_entries')
    console.log('─'.repeat(50))
    console.log(`  总计: ${total.rows[0].count} 条`)
  } finally {
    client.release()
  }
}

async function main() {
  const mdxPath = process.argv[2]

  if (!mdxPath) {
    console.error('用法: pnpm tsx src/import-amitabha-dict.ts <mdx文件路径>')
    process.exit(1)
  }

  // 检查文件是否存在
  const fs = await import('fs')
  if (!fs.existsSync(mdxPath)) {
    console.error(`❌ 文件不存在: ${mdxPath}`)
    process.exit(1)
  }

  console.log('🔍 阿彌陀佛聖教大辭典导入工具')
  console.log('─'.repeat(50))
  console.log(`📁 文件: ${mdxPath}`)
  console.log(`⏭️  跳过已存在: ${Array.from(EXISTING_SOURCES).join(', ')}`)

  // 确保表存在
  await ensureTable()

  // 解析 MDX
  const entries = await parseMdxWithPython(mdxPath)

  // 导入
  await importEntries(entries)

  // 显示最终统计
  await showFinalStats()

  await pool.end()
  console.log('\n✨ 完成!')
}

main().catch(console.error)
