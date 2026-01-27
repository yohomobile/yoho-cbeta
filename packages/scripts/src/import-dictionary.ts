/**
 * 佛学词典导入脚本
 *
 * 使用方法：
 * 1. 手动下载词典文件到 data/dictionary/ 目录
 *    - 佛光大辞典: https://forum.freemdict.com/t/topic/648
 *    - 丁福保佛学大辞典: FreeMdict 下载
 *
 * 2. 运行脚本:
 *    pnpm tsx src/import-dictionary.ts
 */

import { MDX } from 'js-mdict'
import * as fs from 'fs'
import * as path from 'path'
import pg from 'pg'
import { toSimplified } from './zhconv.js'

const DATA_DIR = path.join(import.meta.dirname, '../data/dictionary')

// 数据库连接 - 使用本地 socket 连接
const pool = new pg.Pool({
  database: 'cbeta',
  // 使用本地 Unix socket 连接 (peer authentication)
  host: '/var/run/postgresql',
})

interface DictEntry {
  term: string        // 词条
  definition: string  // 释义 (HTML)
  source: string      // 来源词典
}

/**
 * 解析 MDX 文件并提取所有词条
 */
async function parseMdxFile(filePath: string, source: string): Promise<DictEntry[]> {
  console.log(`\n📖 正在解析: ${path.basename(filePath)}`)

  const mdx = new MDX(filePath)
  const entries: DictEntry[] = []

  // 获取词条数量信息
  const keyInfoList = mdx.keyInfoList
  console.log(`   共 ${keyInfoList.length} 个关键块`)

  let totalEntries = 0
  for (const info of keyInfoList) {
    totalEntries += info.keyBlockEntriesNum
  }
  console.log(`   预计 ${totalEntries} 个词条`)

  // 遍历所有 key block
  for (let i = 0; i < keyInfoList.length; i++) {
    const keyList = mdx.lookupPartialKeyBlockListByKeyInfoId(i)

    for (const item of keyList) {
      try {
        const result = mdx.fetch(item)
        if (result && result.keyText && result.definition) {
          entries.push({
            term: toSimplified(result.keyText.trim()),
            definition: toSimplified(result.definition.trim()),
            source,
          })
        }
      } catch {
        // 跳过解析失败的词条
      }
    }

    // 每 10 个块显示一次进度
    if ((i + 1) % 10 === 0 || i === keyInfoList.length - 1) {
      console.log(`   进度: ${i + 1}/${keyInfoList.length} 块, 已提取 ${entries.length} 词条`)
    }
  }

  console.log(`   ✅ 成功提取 ${entries.length} 个有效词条`)
  return entries
}

/**
 * 创建词典数据库表
 */
async function createTable() {
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
    console.log('✅ 数据库表创建成功')
  } finally {
    client.release()
  }
}

/**
 * 清理字符串中的无效字符 (PostgreSQL 不支持 null byte)
 */
function sanitizeString(str: string): string {
  // 移除 null bytes 和其他控制字符 (除了换行和制表符)
  return str.replace(/\x00/g, '').replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, '')
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
 * 导入词条到数据库
 */
async function importEntries(entries: DictEntry[]) {
  const client = await pool.connect()
  let imported = 0
  let skipped = 0

  try {
    // 批量导入，每次 100 条
    const batchSize = 100
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize)

      for (const entry of batch) {
        try {
          const textOnly = extractText(entry.definition)

          // 清理所有字段中的无效字符
          const cleanTerm = sanitizeString(entry.term)
          const cleanDefinition = sanitizeString(entry.definition)

          await client.query(`
            INSERT INTO dictionary_entries (term, definition, definition_text, source)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (term, source) DO UPDATE SET
              definition = EXCLUDED.definition,
              definition_text = EXCLUDED.definition_text
          `, [cleanTerm, cleanDefinition, textOnly, entry.source])

          imported++
        } catch (error) {
          skipped++
          // 第一次错误时打印详细信息
          if (skipped === 1) {
            console.error('   ⚠️ 首次插入错误:', error)
            console.error('   词条:', entry.term?.slice(0, 50))
          }
        }
      }

      // 显示进度
      if ((i + batchSize) % 1000 === 0 || i + batchSize >= entries.length) {
        console.log(`   进度: ${Math.min(i + batchSize, entries.length)}/${entries.length}`)
      }
    }
  } finally {
    client.release()
  }

  console.log(`✅ 导入完成: ${imported} 条成功, ${skipped} 条跳过`)
}

/**
 * 扫描目录中的所有 MDX 文件
 */
function findMdxFiles(): string[] {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    return []
  }

  return fs.readdirSync(DATA_DIR)
    .filter(f => f.toLowerCase().endsWith('.mdx'))
    .map(f => path.join(DATA_DIR, f))
}

/**
 * 从文件名推断词典来源
 */
function inferSource(filename: string): string {
  const name = path.basename(filename).toLowerCase()

  if (name.includes('佛光') || name.includes('foguang')) {
    return '佛光大辞典'
  }
  if (name.includes('丁福保') || name.includes('dingfubao')) {
    return '丁福保佛学大辞典'
  }
  if (name.includes('陈义孝') || name.includes('常见')) {
    return '佛学常见辞汇'
  }
  if (name.includes('翻译名义')) {
    return '翻译名义集'
  }
  if (name.includes('三藏法数')) {
    return '三藏法数'
  }

  // 默认用文件名
  return path.basename(filename, '.mdx')
}

async function main() {
  console.log('🔍 扫描词典文件...')
  const mdxFiles = findMdxFiles()

  if (mdxFiles.length === 0) {
    console.log(`
⚠️  未找到词典文件！

请按以下步骤操作：
1. 访问 https://forum.freemdict.com/t/topic/648 下载佛光大辞典
2. 或访问其他 MDict 词典下载站点
3. 将 .mdx 文件放入目录: ${DATA_DIR}
4. 重新运行此脚本

支持的词典：
- 佛光大辞典 (佛光大辭典增訂版.mdx)
- 丁福保佛学大辞典
- 佛学常见辞汇
- 其他 MDict 格式的佛学词典
`)
    process.exit(1)
  }

  console.log(`找到 ${mdxFiles.length} 个词典文件:`)
  mdxFiles.forEach(f => console.log(`  - ${path.basename(f)}`))

  // 创建数据库表
  console.log('\n📦 准备数据库...')
  await createTable()

  // 解析并导入每个词典
  for (const mdxFile of mdxFiles) {
    const source = inferSource(mdxFile)

    try {
      const entries = await parseMdxFile(mdxFile, source)

      if (entries.length > 0) {
        console.log(`\n💾 导入到数据库...`)
        await importEntries(entries)
      }
    } catch (error) {
      console.error(`❌ 解析失败: ${path.basename(mdxFile)}`)
      console.error(error)
    }
  }

  // 统计
  const client = await pool.connect()
  try {
    const result = await client.query(`
      SELECT source, COUNT(*) as count
      FROM dictionary_entries
      GROUP BY source
      ORDER BY count DESC
    `)

    console.log('\n📊 词典统计:')
    console.log('─'.repeat(40))
    for (const row of result.rows) {
      console.log(`${row.source}: ${row.count} 条`)
    }

    const total = await client.query('SELECT COUNT(*) FROM dictionary_entries')
    console.log('─'.repeat(40))
    console.log(`总计: ${total.rows[0].count} 条`)
  } finally {
    client.release()
  }

  await pool.end()
  console.log('\n✨ 完成!')
}

main().catch(console.error)
