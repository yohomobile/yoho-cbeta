import * as fs from 'fs'

function detectCommentaryType(title: string): string | null {
  const patterns = [
    { pattern: /悬谈/, type: '悬谈' },
  ]
  for (const { pattern, type } of patterns) {
    if (pattern.test(title)) return type
  }
  return null
}

function isValidCommentaryDirection(commentaryTitle: string, targetTitle: string): boolean {
  const cleanComm = commentaryTitle.replace(/^佛说/, '')
  const cleanTarget = targetTitle.replace(/^佛说/, '')

  // 如果原经本身是注疏，需要检查是否是「注疏的注疏」
  const subCommentaryPatterns = ['记', '钞', '科', '指归', '发挥', '补正', '疏']
  const targetIsCommentary = detectCommentaryType(cleanTarget)
  if (targetIsCommentary) {
    const hasSubPattern = subCommentaryPatterns.some(p => cleanComm.includes(p))
    if (!hasSubPattern) return false
  }

  // 直接包含检查
  if (cleanComm.includes(cleanTarget)) return true
  if (cleanTarget.length > 4 && cleanComm.includes(cleanTarget.slice(0, 4))) return true

  return true  // 默认保守策略
}

const commTitle = '首楞严经悬谈'
const targetTitle = '大佛顶如来密因修证了义诸菩萨万行首楞严经'

console.log('注疏标题:', commTitle)
console.log('原经标题:', targetTitle)
console.log('isValidCommentaryDirection:', isValidCommentaryDirection(commTitle, targetTitle))

// 分步检查
const cleanComm = commTitle.replace(/^佛说/, '')
const cleanTarget = targetTitle.replace(/^佛说/, '')
console.log('\ncleanComm:', cleanComm)
console.log('cleanTarget:', cleanTarget)
console.log('cleanComm.includes(cleanTarget):', cleanComm.includes(cleanTarget))
console.log('cleanTarget.slice(0, 4):', cleanTarget.slice(0, 4))
console.log('cleanComm.includes(cleanTarget.slice(0, 4)):', cleanComm.includes(cleanTarget.slice(0, 4)))
