/**
 * 将 parsed 目录中的经文-人物关系数据导入数据库
 * 使用 person-name-map.json 将人名映射到 person_id
 */
import { execSync } from 'child_process'
import { readFileSync, readdirSync, statSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface Person {
  name: string
  dynasty: string | null
  dynastyId: string | null
  nationality: string | null
  role: string
  roleType: string
  identity: string | null
  aliases: string[] | null
}

interface ParsedText {
  id: string
  title: string
  persons: Person[]
}

// 加载人名映射
const nameMapPath = path.join(__dirname, '../../backend/drizzle/person-name-map.json')
const nameToId: Record<string, number> = JSON.parse(readFileSync(nameMapPath, 'utf-8'))
console.log(`已加载 ${Object.keys(nameToId).length} 个人名映射`)

// 遍历 parsed 目录
const parsedDir = path.join(__dirname, '../../../parsed')
const collections = readdirSync(parsedDir)

// 收集所有 text_persons 记录
const textPersonsRecords: Array<{
  textId: string
  personId: number
  roleType: string
  roleRaw: string
  sortOrder: number
}> = []

let totalFiles = 0
let matchedPersons = 0
let unmatchedPersons = 0
const unmatchedNames = new Map<string, number>()

for (const collection of collections) {
  const collectionPath = path.join(parsedDir, collection)
  if (!statSync(collectionPath).isDirectory()) continue

  const volumes = readdirSync(collectionPath)
  for (const volume of volumes) {
    const volumePath = path.join(collectionPath, volume)
    if (!statSync(volumePath).isDirectory()) continue

    const files = readdirSync(volumePath).filter(f => f.endsWith('.json'))
    for (const file of files) {
      const filePath = path.join(volumePath, file)
      const data: ParsedText = JSON.parse(readFileSync(filePath, 'utf-8'))
      totalFiles++

      if (!data.persons || data.persons.length === 0) continue

      for (let i = 0; i < data.persons.length; i++) {
        const person = data.persons[i]
        if (!person.name) continue

        // 尝试匹配人名
        const personId = nameToId[person.name]
        if (personId) {
          textPersonsRecords.push({
            textId: data.id,
            personId,
            roleType: person.roleType || 'unknown',
            roleRaw: person.role || '',
            sortOrder: i,
          })
          matchedPersons++
        } else {
          unmatchedPersons++
          unmatchedNames.set(person.name, (unmatchedNames.get(person.name) || 0) + 1)
        }
      }
    }
  }
}

console.log(`\n处理了 ${totalFiles} 个文件`)
console.log(`匹配成功: ${matchedPersons}`)
console.log(`匹配失败: ${unmatchedPersons}`)
console.log(`待插入记录: ${textPersonsRecords.length}`)

// 显示未匹配的人名
if (unmatchedNames.size > 0) {
  console.log(`\n未匹配的人名 (前20个):`)
  const sorted = [...unmatchedNames.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
  for (const [name, count] of sorted) {
    console.log(`  ${name}: ${count}`)
  }
}

// 插入数据
console.log('\n正在插入数据...')
const escapeStr = (s: string): string => `'${s.replace(/'/g, "''")}'`

// 分批插入
const batchSize = 500
for (let i = 0; i < textPersonsRecords.length; i += batchSize) {
  const batch = textPersonsRecords.slice(i, i + batchSize)
  const values = batch
    .map(
      r =>
        `(${escapeStr(r.textId)}, ${r.personId}, ${escapeStr(r.roleType)}, ${escapeStr(r.roleRaw)}, ${r.sortOrder})`
    )
    .join(',\n')
  const sql = `INSERT INTO text_persons (text_id, person_id, role_type, role_raw, sort_order) VALUES\n${values};`
  execSync(`sudo -u postgres psql -d cbeta -c "${sql.replace(/"/g, '\\"')}"`, {
    encoding: 'utf-8',
  })
  console.log(`  已插入 ${Math.min(i + batchSize, textPersonsRecords.length)}/${textPersonsRecords.length}`)
}

// 验证
const count = execSync(
  `sudo -u postgres psql -d cbeta -t -A -c "SELECT COUNT(*) FROM text_persons;"`,
  { encoding: 'utf-8' }
).trim()

console.log(`\n✓ 导入完成! text_persons 表共有 ${count} 条记录`)

// 显示示例
console.log('\n示例数据:')
const sample = execSync(
  `sudo -u postgres psql -d cbeta -c "
SELECT tp.text_id, t.title, p.name, tp.role_type, tp.role_raw
FROM text_persons tp
JOIN texts t ON tp.text_id = t.id
JOIN persons p ON tp.person_id = p.id
LIMIT 10;
"`,
  { encoding: 'utf-8' }
)
console.log(sample)
