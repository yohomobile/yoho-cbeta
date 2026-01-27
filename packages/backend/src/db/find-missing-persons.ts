/**
 * 找出 JSON 中引用但 persons 表中不存在的人物
 * 运行: npx tsx src/db/find-missing-persons.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

const PARSED_DIR = path.resolve(import.meta.dirname, '../../../../parsed')
const OUTPUT_SQL = path.resolve(import.meta.dirname, '../../drizzle/seed-missing-persons.sql')

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
  persons: ParsedPerson[]
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

function findMissingPersons() {
  console.log('🔍 分析缺失的人物...')

  // 获取数据库中已有的人物
  const existingPersonsRaw = execSync('psql -d cbeta -t -c "SELECT name FROM persons;"', { encoding: 'utf-8' })
  const existingPersons = new Set(
    existingPersonsRaw
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0)
  )
  console.log(`   数据库现有人物: ${existingPersons.size} 个`)

  // 收集 JSON 中的所有人物
  const jsonFiles = collectJsonFiles(PARSED_DIR)
  console.log(`   扫描 ${jsonFiles.length} 个 JSON 文件...`)

  // 人物信息 Map (name -> person info)
  const personInfoMap = new Map<string, ParsedPerson>()

  for (const filePath of jsonFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const data: ParsedText = JSON.parse(content)

      if (data.persons) {
        for (const person of data.persons) {
          if (person.name && !personInfoMap.has(person.name)) {
            personInfoMap.set(person.name, person)
          }
        }
      }
    } catch (err) {
      // 忽略解析错误
    }
  }

  console.log(`   JSON 中共有人物: ${personInfoMap.size} 个`)

  // 找出缺失的人物
  const missingPersons: ParsedPerson[] = []
  for (const [name, person] of personInfoMap) {
    if (!existingPersons.has(name)) {
      missingPersons.push(person)
    }
  }

  console.log(`   缺失的人物: ${missingPersons.length} 个`)

  if (missingPersons.length === 0) {
    console.log('\n✅ 没有缺失的人物!')
    return
  }

  // 生成插入 SQL
  const lines: string[] = [
    '-- 缺失人物种子数据 (自动生成)',
    `-- 生成时间: ${new Date().toISOString()}`,
    `-- 总计: ${missingPersons.length} 条记录`,
    '',
    '-- 插入缺失的人物',
  ]

  for (const person of missingPersons) {
    const aliases = person.aliases ? `'${JSON.stringify(person.aliases).replace(/'/g, "''")}'` : 'NULL'
    lines.push(
      `INSERT INTO persons (name, aliases, dynasty_id, nationality, identity) VALUES (${escapeSql(person.name)}, ${aliases}, ${escapeSql(person.dynastyId)}, ${escapeSql(person.nationality)}, ${escapeSql(person.identity)}) ON CONFLICT DO NOTHING;`
    )
  }

  // 写入文件
  fs.writeFileSync(OUTPUT_SQL, lines.join('\n'), 'utf-8')

  console.log(`\n✅ SQL 生成完成: ${OUTPUT_SQL}`)
  console.log(`\n📌 下一步执行:`)
  console.log(`   1. psql -d cbeta -f ${OUTPUT_SQL}`)
  console.log(`   2. npx tsx src/db/import-texts.ts`)
  console.log(`   3. psql -d cbeta -f drizzle/seed-texts.sql`)

  // 显示部分缺失人物
  console.log(`\n📋 部分缺失人物列表:`)
  for (const person of missingPersons.slice(0, 20)) {
    console.log(`   - ${person.name} (${person.dynastyId || '未知'})`)
  }
  if (missingPersons.length > 20) {
    console.log(`   ... 还有 ${missingPersons.length - 20} 个`)
  }
}

findMissingPersons()
