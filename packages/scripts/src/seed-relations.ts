/**
 * 将 relationships.json 中的经文关系数据导入数据库
 */
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface Commentary {
  id: string
  title: string
  type: string
  confidence: number
  source: string
}

interface RelatedSutra {
  id: string
  title: string
  relation: string
}

interface TextEntry {
  title: string
  commentaries: Record<string, Commentary>
  relatedSutras: RelatedSutra[]
}

interface TranslationGroup {
  baseTitle: string
  sutras: Array<{ id: string; title: string }>
  source: string
}

interface RelationshipsData {
  commentaries: Record<string, TextEntry>
  translations: TranslationGroup[]
}

// 读取 relationships.json
const relationsPath = path.join(__dirname, '../../../relationships.json')
const data: RelationshipsData = JSON.parse(readFileSync(relationsPath, 'utf-8'))

// 获取数据库中存在的 text_id 列表
const existingTextsResult = execSync(
  `sudo -u postgres psql -d cbeta -t -A -c "SELECT id FROM texts;"`,
  { encoding: 'utf-8' }
)
const existingTextIds = new Set(existingTextsResult.trim().split('\n').filter(Boolean))

console.log(`数据库中已有 ${existingTextIds.size} 条经文记录`)

// 收集所有关系数据
const textRelations: Array<{
  sourceTextId: string
  targetTextId: string
  relationType: string
  relationSubtype: string | null
  confidence: number | null
  source: string | null
}> = []

const translationGroups: Array<{
  baseTitle: string
  source: string
  textIds: string[]
}> = []

// 处理注疏和相关经文关系
let skipCount = 0
for (const [textId, entry] of Object.entries(data.commentaries)) {
  // 检查源经文是否存在
  if (!existingTextIds.has(textId)) {
    skipCount++
    continue
  }

  // 处理注疏关系
  for (const [commentaryId, commentary] of Object.entries(entry.commentaries)) {
    if (!existingTextIds.has(commentaryId)) {
      skipCount++
      continue
    }
    textRelations.push({
      sourceTextId: textId,
      targetTextId: commentaryId,
      relationType: 'commentary',
      relationSubtype: commentary.type,
      confidence: Math.round(commentary.confidence * 100),
      source: commentary.source,
    })
  }

  // 处理相关经文关系
  for (const related of entry.relatedSutras) {
    if (!existingTextIds.has(related.id)) {
      skipCount++
      continue
    }
    textRelations.push({
      sourceTextId: textId,
      targetTextId: related.id,
      relationType: related.relation === '别译' ? 'translation' : 'related',
      relationSubtype: related.relation,
      confidence: null,
      source: 'cbeta_ref',
    })
  }
}

// 处理异译组
for (const group of data.translations) {
  const validTextIds = group.sutras.map(s => s.id).filter(id => existingTextIds.has(id))
  if (validTextIds.length >= 2) {
    translationGroups.push({
      baseTitle: group.baseTitle,
      source: group.source,
      textIds: validTextIds,
    })
  }
}

console.log(`跳过了 ${skipCount} 条关系（经文不存在于数据库）`)
console.log(`准备插入 ${textRelations.length} 条经文关系`)
console.log(`准备插入 ${translationGroups.length} 个异译组`)

// 生成 SQL
const escapeStr = (s: string | null): string => {
  if (s === null) return 'NULL'
  return `'${s.replace(/'/g, "''")}'`
}

// 插入 text_relations
console.log('\n正在插入经文关系...')
if (textRelations.length > 0) {
  // 分批插入，每批 500 条
  const batchSize = 500
  for (let i = 0; i < textRelations.length; i += batchSize) {
    const batch = textRelations.slice(i, i + batchSize)
    const values = batch
      .map(
        r =>
          `(${escapeStr(r.sourceTextId)}, ${escapeStr(r.targetTextId)}, ${escapeStr(r.relationType)}, ${escapeStr(r.relationSubtype)}, ${r.confidence ?? 'NULL'}, ${escapeStr(r.source)})`
      )
      .join(',\n')
    const sql = `INSERT INTO text_relations (source_text_id, target_text_id, relation_type, relation_subtype, confidence, source) VALUES\n${values};`
    execSync(`sudo -u postgres psql -d cbeta -c "${sql.replace(/"/g, '\\"')}"`, {
      encoding: 'utf-8',
    })
    console.log(`  已插入 ${Math.min(i + batchSize, textRelations.length)}/${textRelations.length}`)
  }
}

// 插入 translation_groups 和 translation_group_texts
console.log('\n正在插入异译组...')
for (const group of translationGroups) {
  // 插入组
  const insertGroupSql = `INSERT INTO translation_groups (base_title, source) VALUES (${escapeStr(group.baseTitle)}, ${escapeStr(group.source)}) RETURNING id;`
  const groupIdResult = execSync(
    `sudo -u postgres psql -d cbeta -t -A -c "${insertGroupSql.replace(/"/g, '\\"')}"`,
    { encoding: 'utf-8' }
  )
  const groupId = parseInt(groupIdResult.trim(), 10)

  // 插入关联
  const textValues = group.textIds.map((textId, idx) => `(${groupId}, ${escapeStr(textId)}, ${idx})`).join(', ')
  const insertTextsSql = `INSERT INTO translation_group_texts (group_id, text_id, sort_order) VALUES ${textValues};`
  execSync(`sudo -u postgres psql -d cbeta -c "${insertTextsSql.replace(/"/g, '\\"')}"`, {
    encoding: 'utf-8',
  })
}

// 统计结果
const relationsCount = execSync(
  `sudo -u postgres psql -d cbeta -t -A -c "SELECT COUNT(*) FROM text_relations;"`,
  { encoding: 'utf-8' }
).trim()

const groupsCount = execSync(
  `sudo -u postgres psql -d cbeta -t -A -c "SELECT COUNT(*) FROM translation_groups;"`,
  { encoding: 'utf-8' }
).trim()

const groupTextsCount = execSync(
  `sudo -u postgres psql -d cbeta -t -A -c "SELECT COUNT(*) FROM translation_group_texts;"`,
  { encoding: 'utf-8' }
).trim()

console.log('\n✓ 导入完成!')
console.log(`  - text_relations: ${relationsCount} 条`)
console.log(`  - translation_groups: ${groupsCount} 个`)
console.log(`  - translation_group_texts: ${groupTextsCount} 条`)

// 显示一些示例数据
console.log('\n示例数据:')
const sampleRelations = execSync(
  `sudo -u postgres psql -d cbeta -c "SELECT source_text_id, target_text_id, relation_type, relation_subtype FROM text_relations LIMIT 5;"`,
  { encoding: 'utf-8' }
)
console.log('text_relations:')
console.log(sampleRelations)

const sampleGroups = execSync(
  `sudo -u postgres psql -d cbeta -c "SELECT tg.base_title, COUNT(tgt.text_id) as text_count FROM translation_groups tg JOIN translation_group_texts tgt ON tg.id = tgt.group_id GROUP BY tg.id, tg.base_title LIMIT 5;"`,
  { encoding: 'utf-8' }
)
console.log('translation_groups:')
console.log(sampleGroups)
