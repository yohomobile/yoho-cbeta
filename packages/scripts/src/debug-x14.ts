import * as fs from 'fs'

const relationships = JSON.parse(fs.readFileSync('/home/guang/happy/yoho-cbeta/relationships.json', 'utf-8'))

// 检查楞严经是否有注疏
const sutraId = 'T19n0945'
const data = relationships.commentaries[sutraId]
if (data) {
  console.log('原经: ' + sutraId + ' - ' + data.title)
  console.log('注疏数: ' + Object.keys(data.commentaries || {}).length)
  
  // 看看有哪些注疏
  const comms = Object.entries(data.commentaries || {}) as [string, any][]
  for (const [id, comm] of comms) {
    console.log('  - ' + id + ': ' + comm.title)
  }
}

// 检查 X14n0293 是否在里面
console.log('\nX14n0293 在注疏中:', !!(data?.commentaries?.['X14n0293']))

// 检查 X14n0293 的 header.title
const x14File = '/home/guang/happy/yoho-cbeta/data-simplified/X/X14/X14n0293.json'
const x14Data = JSON.parse(fs.readFileSync(x14File, 'utf-8'))
console.log('\nX14n0293 header.title:', x14Data.header?.title)
