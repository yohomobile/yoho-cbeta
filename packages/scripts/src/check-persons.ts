/**
 * 检查解析数据与数据库的差异
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const PARSED_DIR = path.resolve(import.meta.dirname, '../../../parsed')

interface PersonInfo {
  name: string
  dynastyId: string | null
  aliases: string[] | null
}

function walkDir(dir: string, callback: (filepath: string) => void) {
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const filepath = path.join(dir, file)
    const stat = fs.statSync(filepath)
    if (stat.isDirectory()) {
      walkDir(filepath, callback)
    } else if (file.endsWith('.json') && !file.startsWith('.')) {
      callback(filepath)
    }
  }
}

const personMap = new Map<string, PersonInfo>()

walkDir(PARSED_DIR, (filepath) => {
  try {
    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'))
    if (data.persons) {
      for (const p of data.persons) {
        if (p.name && p.name !== '佚名') {
          if (!personMap.has(p.name)) {
            personMap.set(p.name, p)
          }
        }
      }
    }
  } catch {}
})

console.log('解析数据中的独立人名:', personMap.size)

// 过滤条件
const validNames: string[] = []
const filteredNames: string[] = []

for (const [name, person] of personMap) {
  let valid = true
  let reason = ''

  if (name.includes('．') || name.includes('(')) {
    valid = false
    reason = '包含特殊字符'
  } else if (name.length > 20) {
    valid = false
    reason = '过长(>20)'
  } else if (/[造撰编译释著集述注疏录记说]\s/.test(name)) {
    valid = false
    reason = '复合名(角色词+空格)'
  } else if (name.includes('等') && name.length > 5) {
    valid = false
    reason = '包含"等"'
  } else if (name.length > 8) {
    valid = false
    reason = '过长(>8)'
  } else if (name.includes('共')) {
    valid = false
    reason = '合译者'
  }

  if (valid) {
    validNames.push(name)
  } else {
    filteredNames.push(`${name} (${reason})`)
  }
}

console.log('有效人名:', validNames.length)
console.log('被过滤:', filteredNames.length)

// 显示部分被过滤的
console.log('\n被过滤的示例 (前30个):')
filteredNames.slice(0, 30).forEach(n => console.log('  -', n))
