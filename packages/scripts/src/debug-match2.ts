import * as fs from 'fs'

// 测试后缀匹配
const title = '首楞严经悬谈'
const suffixes = [
  '疏钞', '疏记', '义疏', '略疏', '悬谈', '讲录', '讲记', '讲义',
  '集注', '科注', '子注', '合释', '通释', '详释', '会释',
  '玄义', '文句', '玄赞', '述记', '义记', '要解', '纲要', '直解', '略解', '集解',
  '科文', '音义', '句解', '私记', '别记', '纂要', '演义', '节要', '辑略', '撮要',
  '释签', '指掌', '入疏', '大疏', '略记', '广记', '要义', '指归', '决疑',
  '疏', '注', '记', '钞', '解', '论', '义', '科'
]

console.log('测试标题:', title)

for (const suffix of suffixes) {
  const pattern = new RegExp(`(.+)${suffix}$`)
  const match = title.match(pattern)
  if (match) {
    console.log('匹配后缀:', suffix)
    console.log('基名:', match[1])
    break
  }
}

// 检查 wellKnownSutras
const wellKnownSutras: Record<string, string> = {
  '楞严经': 'T19n0945',
  '首楞严经': 'T19n0945',
  '首楞严': 'T19n0945',
}

const baseName = '首楞严经'
console.log('\n基名在 wellKnownSutras 中:', baseName, '->', wellKnownSutras[baseName])

// 检查 detectCommentaryType
function detectCommentaryType(title: string): string | null {
  const excludePatterns = [
    /授记经/, /记果经/, /解夏经/, /解脱经/, /解脱戒/, /解脱道论/,
  ]
  for (const pattern of excludePatterns) {
    if (pattern.test(title)) return null
  }
  const patterns = [
    { pattern: /悬谈/, type: '悬谈' },
    { pattern: /疏$/, type: '疏' },
  ]
  for (const { pattern, type } of patterns) {
    if (pattern.test(title)) return type
  }
  return null
}

console.log('\ndetectCommentaryType:', detectCommentaryType(title))
