import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 从数据库获取所有人名数据
const result = execSync(
  `sudo -u postgres psql -d cbeta -t -A -c "SELECT id, name, aliases FROM persons ORDER BY name;"`,
  { encoding: 'utf-8' }
)

// 解析数据，构建映射
const nameToId: Record<string, number> = {}

for (const line of result.trim().split('\n')) {
  if (!line) continue

  const [idStr, name, aliasesStr] = line.split('|')
  const id = parseInt(idStr, 10)

  if (!name || isNaN(id)) continue

  // 主名映射
  nameToId[name] = id

  // 别名映射（从数据库）
  if (aliasesStr) {
    try {
      const aliases = JSON.parse(aliasesStr) as string[]
      for (const alias of aliases) {
        if (alias && !nameToId[alias]) {
          nameToId[alias] = id
        }
      }
    } catch (e) {
      // 忽略解析错误
    }
  }
}

// 从 author-overrides.json 提取额外的别名
const overridesPath = path.join(__dirname, 'author-overrides.json')
const overrides = JSON.parse(readFileSync(overridesPath, 'utf-8'))
let overrideAliasCount = 0

for (const [, persons] of Object.entries(overrides)) {
  if (!Array.isArray(persons)) continue
  for (const p of persons as Array<{ name?: string; aliases?: string[] }>) {
    if (!p.name || !p.aliases) continue
    const id = nameToId[p.name]
    if (!id) continue // 主名必须在数据库中存在
    for (const alias of p.aliases) {
      if (alias && !nameToId[alias]) {
        nameToId[alias] = id
        overrideAliasCount++
      }
    }
  }
}

// 输出统计
const mainNames = result.trim().split('\n').filter(l => l).length
const totalMappings = Object.keys(nameToId).length
const dbAliasCount = totalMappings - mainNames - overrideAliasCount
console.log(`主名数量: ${mainNames}`)
console.log(`数据库别名: ${dbAliasCount}`)
console.log(`author-overrides 补充别名: ${overrideAliasCount}`)
console.log(`总映射数量: ${totalMappings}`)

// 写入文件
const outputPath = path.join(__dirname, '../../backend/drizzle/person-name-map.json')
writeFileSync(outputPath, JSON.stringify(nameToId, null, 2), 'utf-8')
console.log(`✓ 映射文件已生成: ${outputPath}`)
