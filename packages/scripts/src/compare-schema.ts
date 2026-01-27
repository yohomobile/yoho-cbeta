#!/usr/bin/env tsx
/**
 * 对比数据库设计与解析字段
 */

console.log('═'.repeat(70))
console.log('  数据库设计 (data-design.md) vs 解析字段 (ParsedMetadata) 对比')
console.log('═'.repeat(70))

// data-design.md sutras 表字段
const sutrasFields = [
  'id', 'canon_id', 'volume', 'number',
  'title', 'title_traditional', 'title_sanskrit', 'title_pali', 'title_alt',
  'juan_count', 'page_start', 'page_end',
  'category_id', 'content_type', 'has_dharani', 'has_verse',
  'source_text', 'translation_place_id', 'translation_era_id'
]

// 当前 ParsedMetadata 字段（规则处理）
const parsedFields = [
  'id', 'canonId', 'volume', 'number',
  'title', 'titleSource', 'titleRaw',
  'titleTraditional', 'titleSanskrit', 'titlePali', 'titleAlt',
  'sourceText', 'categoryId',
  'bylineRaw',
  'juanCount', 'pageStart', 'pageEnd',
  'toc',
  'hasDharani', 'hasVerse', 'contentType',
  'docNumber', 'docNumberParsed'
]

// sutra_persons 表字段（AI 增强后）
const sutraPersonsFields = [
  'sutra_id', 'person_id', 'role_id', 'role_text',
  'is_primary', 'position', 'raw_text'
]

// sutra_relations 表字段
const sutraRelationsFields = [
  'source_id', 'target_id', 'relation_type', 'relation_subtype',
  'raw_text', 'target_section', 'confidence'
]

console.log('\n【sutras 表 vs ParsedMetadata】')
console.log('-'.repeat(70))
console.log('数据库字段'.padEnd(22) + '解析字段'.padEnd(22) + '状态')
console.log('-'.repeat(70))

const missing: string[] = []
const different: string[] = []
const extra: string[] = []
const aiPending: string[] = []

for (const sf of sutrasFields) {
  const pf = toCamelCase(sf)
  if (parsedFields.includes(pf)) {
    // title_alt 映射到 titleAlt
    if (sf === 'title_alt' && pf === 'titleAlt') {
      console.log(sf.padEnd(22) + pf.padEnd(22) + '✅ 规则解析')
    }
    // source_text 映射到 sourceText
    else if (sf === 'source_text' && pf === 'sourceText') {
      console.log(sf.padEnd(22) + pf.padEnd(22) + '✅ 规则解析')
    }
    // category_id 映射到 categoryId
    else if (sf === 'category_id' && pf === 'categoryId') {
      console.log(sf.padEnd(22) + pf.padEnd(22) + '✅ 规则解析')
    }
    // translation_ 需要 AI 解析 byline
    else if (sf.startsWith('translation_')) {
      console.log(sf.padEnd(22) + '(byline AI)'.padEnd(22) + '⏳ AI待实现')
      aiPending.push(sf)
    }
    else {
      console.log(sf.padEnd(22) + pf.padEnd(22) + '✅')
    }
  } else {
    console.log(sf.padEnd(22) + '(缺失)'.padEnd(22) + '❌')
    missing.push(sf)
  }
}

console.log('\n【解析独有字段】')
for (const pf of parsedFields) {
  const sf = toSnakeCase(pf)
  if (!sutrasFields.includes(sf)) {
    console.log('  ' + pf + ' (数据库无对应)')
    extra.push(pf)
  }
}

console.log('\n' + '='.repeat(70))
console.log('【sutras 表缺失字段 - 需要 AI 增强】')
console.log('='.repeat(70))
for (const m of missing) {
  console.log('  ❌ ' + m)
}
console.log('  → 这些字段需要 ai-extract-metadata.ts 处理 byline 后填充')

console.log('\n' + '='.repeat(70))
console.log('【sutra_persons 表 (AI 增强)】')
console.log('='.repeat(70))
console.log('字段: ' + sutraPersonsFields.join(', '))
console.log('→ 来源: AI 解析 bylineRaw')

console.log('\n' + '='.repeat(70))
console.log('【sutra_relations 表 (规则+AI)】')
console.log('='.repeat(70))
for (const f of sutraRelationsFields) {
  console.log('  - ' + f)
}
console.log('→ rule: docNumberParsed → target_hint')
console.log('→ AI: relation_type, raw_text')

console.log('\n' + '='.repeat(70))
console.log('【结论】')
console.log('='.repeat(70))

console.log('\n📊 sutras 表字段处理状态:')
console.log(`  ✅ 规则解析已完成: 17/19`)
console.log(`  ⏳ AI 需解析 byline: 2 (translation_place_id, translation_era_id)`)

console.log('\n【AI 增强字段 - 需解析 bylineRaw】')
const aiFields = ['translation_place_id', 'translation_era_id']
for (const f of aiFields) {
  console.log(`  ⏳ ${f}`)
}

console.log('\n【解析独有字段（数据库无对应）】')
for (const pf of parsedFields) {
  const sf = toSnakeCase(pf)
  if (!sutrasFields.includes(sf)) {
    console.log('  + ' + pf)
  }
}

console.log('\n【sutra_persons 表 (AI 解析 bylineRaw)】')
console.log('  → 译者、朝代、年号、地点等从 bylineRaw 提取')
console.log('  → ai-extract-metadata.ts 实现')

console.log('\n【sutra_relations 表 (规则+AI)】')
console.log('  → rule: docNumberParsed → target_hint')
console.log('  → AI: relation_type, raw_text')

console.log('\n【建议】')
console.log('1. ✅ 规则解析已完成所有可自动处理的字段')
console.log('2. ⏳ AI 增强 (ai-extract-metadata.ts) 需实现:')
console.log('   - translation_place_id (翻译地点)')
console.log('   - translation_era_id (翻译年号)')
console.log('   - sutra_persons 表数据填充')
console.log('   - sutra_relations 表 relation_type')
console.log('3. 📋 数据库设计无需调整，ParsedMetadata 已覆盖 sutras 表')

function toCamelCase(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function toSnakeCase(s: string): string {
  return s.replace(/[A-Z]/g, c => '_' + c.toLowerCase())
}

console.log('\n')
