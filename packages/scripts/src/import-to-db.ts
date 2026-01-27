import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const { Pool } = pg

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 数据库连接
const pool = new Pool({
  host: '101.100.174.21',
  database: 'cbeta',
  user: 'guang',
  password: 'Root,./000000',
  port: 5432,
})

// 数据目录
const PARSED_DIR = path.resolve(__dirname, '../../../parsed')
const DATA_SIMPLIFIED_DIR = path.resolve(__dirname, '../../../data-simplified')
const DATA_TRADITIONAL_DIR = path.resolve(__dirname, '../../../data')

interface ParsedData {
  id: string
  canonId: string
  volume: string
  number: string
  title: string
  titleSource: string
  titleRaw: string
  titleTraditional: string
  titleSanskrit: string | null
  titlePali: string | null
  titleAlt: string | null
  sourceText: string
  categoryId: string
  bylineRaw: string
  authorRaw: string
  persons: unknown[]
  translationDynasty: string | null
  translationDynastyId: string | null
  juanCount: number
  pageStart: string
  pageEnd: string
  docNumber: string
  docNumberParsed: string[] | null
  hasVerse: boolean
  hasDharani: boolean
  contentType: string
  toc: unknown[]
  sourceHash: string
  parsedAt: string
}

interface BodyData {
  id: string
  body: unknown[]
  header?: unknown
  meta?: unknown
}

// 递归查找所有 JSON 文件
function findJsonFiles(dir: string): string[] {
  const files: string[] = []

  if (!existsSync(dir)) {
    return files
  }

  const items = readdirSync(dir)
  for (const item of items) {
    if (item.startsWith('.')) continue
    const fullPath = path.join(dir, item)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      files.push(...findJsonFiles(fullPath))
    } else if (item.endsWith('.json')) {
      files.push(fullPath)
    }
  }
  return files
}

// 获取对应的 body 文件路径
function getBodyFilePath(parsedPath: string, bodyDir: string): string {
  const relativePath = path.relative(PARSED_DIR, parsedPath)
  return path.join(bodyDir, relativePath)
}

// 读取 JSON 文件
function readJson<T>(filePath: string): T | null {
  try {
    const content = readFileSync(filePath, 'utf-8')
    return JSON.parse(content) as T
  } catch {
    return null
  }
}

async function importTexts() {
  console.log('开始导入数据...')

  // 查找所有 parsed JSON 文件
  const parsedFiles = findJsonFiles(PARSED_DIR)
  console.log(`找到 ${parsedFiles.length} 个 parsed 文件`)

  let imported = 0
  let errors = 0

  const client = await pool.connect()

  try {
    // 开始事务
    await client.query('BEGIN')

    // 清空表
    await client.query('TRUNCATE texts')

    for (const parsedFile of parsedFiles) {
      const parsed = readJson<ParsedData>(parsedFile)
      if (!parsed || !parsed.id) {
        console.error(`跳过无效文件: ${parsedFile}`)
        errors++
        continue
      }

      // 读取简体正文
      const simplifiedPath = getBodyFilePath(parsedFile, DATA_SIMPLIFIED_DIR)
      const simplified = readJson<BodyData>(simplifiedPath)

      // 读取繁体正文
      const traditionalPath = getBodyFilePath(parsedFile, DATA_TRADITIONAL_DIR)
      const traditional = readJson<BodyData>(traditionalPath)

      try {
        await client.query(
          `INSERT INTO texts (
            id, canon_id, volume, number,
            title, title_source, title_raw, title_traditional,
            title_sanskrit, title_pali, title_alt,
            source_text, category_id,
            byline_raw, author_raw, persons,
            translation_dynasty, translation_dynasty_id,
            juan_count, page_start, page_end,
            doc_number, doc_number_parsed,
            has_verse, has_dharani, content_type,
            toc, body_simplified, body_traditional,
            source_hash, parsed_at
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8,
            $9, $10, $11,
            $12, $13,
            $14, $15, $16,
            $17, $18,
            $19, $20, $21,
            $22, $23,
            $24, $25, $26,
            $27, $28, $29,
            $30, $31
          )`,
          [
            parsed.id,
            parsed.canonId,
            parsed.volume,
            parsed.number,
            parsed.title,
            parsed.titleSource,
            parsed.titleRaw,
            parsed.titleTraditional,
            parsed.titleSanskrit,
            parsed.titlePali,
            parsed.titleAlt,
            parsed.sourceText,
            parsed.categoryId,
            parsed.bylineRaw,
            parsed.authorRaw,
            JSON.stringify(parsed.persons),
            parsed.translationDynasty,
            parsed.translationDynastyId,
            parsed.juanCount,
            parsed.pageStart,
            parsed.pageEnd,
            parsed.docNumber,
            parsed.docNumberParsed ? JSON.stringify(parsed.docNumberParsed) : null,
            parsed.hasVerse,
            parsed.hasDharani,
            parsed.contentType,
            JSON.stringify(parsed.toc),
            simplified?.body ? JSON.stringify(simplified.body) : null,
            traditional?.body ? JSON.stringify(traditional.body) : null,
            parsed.sourceHash,
            parsed.parsedAt ? new Date(parsed.parsedAt) : null,
          ]
        )

        imported++
        if (imported % 500 === 0) {
          console.log(`已导入 ${imported} 条...`)
        }
      } catch (err) {
        console.error(`导入失败 ${parsed.id}:`, err)
        errors++
      }
    }

    // 提交事务
    await client.query('COMMIT')

    console.log(`\n导入完成！`)
    console.log(`成功: ${imported}`)
    console.log(`失败: ${errors}`)

  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// 恢复外键约束
async function restoreConstraints() {
  console.log('\n恢复外键约束...')

  await pool.query(`
    ALTER TABLE text_persons
    ADD CONSTRAINT text_persons_text_id_texts_id_fk
    FOREIGN KEY (text_id) REFERENCES texts(id)
  `)

  console.log('外键约束已恢复')
}

async function main() {
  try {
    await importTexts()
    await restoreConstraints()
  } catch (err) {
    console.error('导入出错:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
