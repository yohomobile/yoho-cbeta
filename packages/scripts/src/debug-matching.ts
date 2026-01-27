import * as fs from 'fs'
import * as path from 'path'

// 读取关系数据
const relationships = JSON.parse(fs.readFileSync('/home/guang/happy/yoho-cbeta/relationships.json', 'utf-8'))

// 检查华严相关的注疏
console.log('=== 检查华严相关注疏 ===')
for (const [sutraId, data] of Object.entries(relationships.commentaries as Record<string, any>)) {
  if (data.title.includes('华严')) {
    console.log('\n原经: ' + sutraId + ' - ' + data.title)
    const commentaries = Object.keys(data.commentaries || {})
    console.log('  注疏数量: ' + commentaries.length)
    for (const commId of commentaries.slice(0, 5)) {
      console.log('    - ' + commId + ': ' + data.commentaries[commId].title)
    }
    if (commentaries.length > 5) console.log('    ...还有 ' + (commentaries.length - 5) + ' 个')
  }
}

// 检查如意轮相关
console.log('\n=== 检查如意轮相关注疏 ===')
for (const [sutraId, data] of Object.entries(relationships.commentaries as Record<string, any>)) {
  if (data.title.includes('如意轮')) {
    console.log('\n原经: ' + sutraId + ' - ' + data.title)
    const commentaries = Object.keys(data.commentaries || {})
    console.log('  注疏数量: ' + commentaries.length)
    for (const commId of commentaries) {
      console.log('    - ' + commId + ': ' + data.commentaries[commId].title)
    }
  }
}

// 检查律/戒本相关
console.log('\n=== 检查律/戒本相关注疏 ===')
for (const [sutraId, data] of Object.entries(relationships.commentaries as Record<string, any>)) {
  if (data.title.includes('律') || data.title.includes('戒本')) {
    console.log('\n原经: ' + sutraId + ' - ' + data.title)
    const commentaries = Object.keys(data.commentaries || {})
    console.log('  注疏数量: ' + commentaries.length)
    for (const commId of commentaries.slice(0, 3)) {
      console.log('    - ' + commId + ': ' + data.commentaries[commId].title)
    }
    if (commentaries.length > 3) console.log('    ...还有 ' + (commentaries.length - 3) + ' 个')
  }
}
