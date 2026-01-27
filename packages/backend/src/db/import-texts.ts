/**
 * 生成导入 SQL 文件（从 parsed JSON 数据）
 * 运行: npx tsx src/db/import-texts.ts
 * 然后执行: psql -d cbeta -f drizzle/seed-texts.sql
 */

import * as fs from 'fs'
import * as path from 'path'

const PARSED_DIR = path.resolve(import.meta.dirname, '../../../../parsed')
const OUTPUT_SQL = path.resolve(import.meta.dirname, '../../drizzle/seed-texts.sql')

interface ParsedPerson {
  name: string
  dynasty: string | null
  dynastyId: string | null
  nationality: string | null
  role: string | null
  roleType: string | null
  identity: string | null
  aliases: string[] | null
}

interface ParsedText {
  id: string
  canonId: string
  volume: string
  number: string
  title: string
  titleSource: string
  titleRaw: string
  titleTraditional: string | null
  titleSanskrit: string | null
  titlePali: string | null
  titleAlt: string | null
  sourceText: string
  categoryId: string | null
  bylineRaw: string | null
  authorRaw: string | null
  persons: ParsedPerson[]
  translationDynasty: string | null
  translationDynastyId: string | null
  juanCount: number | null
  pageStart: string
  pageEnd: string
  toc: unknown[]
  hasDharani: boolean
  hasVerse: boolean
  contentType: string | null
  docNumber: string | null
  docNumberParsed: string[] | null
  parsedAt: string
  sourceHash: string
}

// 收集所有 JSON 文件
function collectJsonFiles(dir: string): string[] {
  const files: string[] = []

  function walkDir(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        walkDir(fullPath)
      } else if (entry.name.endsWith('.json')) {
        files.push(fullPath)
      }
    }
  }

  walkDir(dir)
  return files
}

// 转义 SQL 字符串
function escapeSql(str: string | null | undefined): string {
  if (str == null) return 'NULL'
  return `'${str.replace(/'/g, "''")}'`
}

function generateSql() {
  console.log('📚 开始生成经文导入 SQL...')
  console.log(`📂 源目录: ${PARSED_DIR}`)
  console.log(`📄 输出文件: ${OUTPUT_SQL}`)

  // 收集所有 JSON 文件
  console.log('🔍 扫描 JSON 文件...')
  const jsonFiles = collectJsonFiles(PARSED_DIR)
  console.log(`   ✓ 发现 ${jsonFiles.length} 个文件`)

  // 生成 SQL
  const lines: string[] = [
    '-- texts 种子数据 (自动生成)',
    `-- 生成时间: ${new Date().toISOString()}`,
    `-- 总计: ${jsonFiles.length} 条记录`,
    '',
    'TRUNCATE TABLE text_persons CASCADE;',
    'TRUNCATE TABLE texts CASCADE;',
    '',
    '-- 插入 texts 数据',
  ]

  let textCount = 0
  const textPersonsLines: string[] = ['', '-- 插入 text_persons 数据']
  let textPersonCount = 0
  const allPersonNames = new Set<string>()

  for (const filePath of jsonFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const data: ParsedText = JSON.parse(content)

      // 插入 text
      const volumeCount = data.juanCount !== null ? data.juanCount.toString() : 'NULL'
      const category = escapeSql(data.categoryId)

      lines.push(
        `INSERT INTO texts (id, title, volume_count, collection_id, category) VALUES (${escapeSql(data.id)}, ${escapeSql(data.title)}, ${volumeCount}, ${escapeSql(data.canonId)}, ${category});`
      )
      textCount++

      // 收集人物
      if (data.persons) {
        for (let i = 0; i < data.persons.length; i++) {
          const person = data.persons[i]
          allPersonNames.add(person.name)
          textPersonsLines.push(
            `INSERT INTO text_persons (text_id, person_id, role_type, role_raw, sort_order) SELECT ${escapeSql(data.id)}, id, ${escapeSql(person.roleType || 'unknown')}, ${escapeSql(person.role)}, ${i} FROM persons WHERE name = ${escapeSql(person.name)};`
          )
          textPersonCount++
        }
      }
    } catch (err) {
      console.error(`❌ 解析文件失败: ${filePath}`, err)
    }
  }

  // 合并 SQL
  lines.push(...textPersonsLines)
  lines.push('')
  lines.push(`-- 统计: texts=${textCount}, text_persons=${textPersonCount}`)

  // 写入文件
  fs.writeFileSync(OUTPUT_SQL, lines.join('\n'), 'utf-8')

  console.log(`\n✅ SQL 生成完成:`)
  console.log(`   📖 texts: ${textCount} 条`)
  console.log(`   👥 text_persons: ${textPersonCount} 条`)
  console.log(`   👤 引用的人物: ${allPersonNames.size} 个`)
  console.log(`\n📌 下一步执行: psql -d cbeta -f ${OUTPUT_SQL}`)
}

generateSql()
