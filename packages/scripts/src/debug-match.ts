import * as fs from 'fs'

// 测试后缀匹配
const title = '楞严经悬谈'
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
}

const baseName = '楞严经'
console.log('\n基名在 wellKnownSutras 中:', baseName, '->', wellKnownSutras[baseName])
