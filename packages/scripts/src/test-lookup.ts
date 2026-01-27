import * as fs from 'fs'
import * as path from 'path'

// 读取所有文件建立标题索引
const dataDir = '/home/guang/happy/yoho-cbeta/data-simplified'
const canons = fs.readdirSync(dataDir).filter(d => fs.statSync(path.join(dataDir, d)).isDirectory())

const titleIndex = new Map<string, { id: string; canon: string }>()

for (const canon of canons) {
  const canonDir = path.join(dataDir, canon)
  const vols = fs.readdirSync(canonDir).filter(v => fs.statSync(path.join(canonDir, v)).isDirectory())
  
  for (const vol of vols) {
    const volDir = path.join(canonDir, vol)
    const files = fs.readdirSync(volDir).filter(f => f.endsWith('.json'))
    
    for (const file of files) {
      const filePath = path.join(volDir, file)
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      const title = data.header?.title || ''
      if (title && !titleIndex.has(title)) {
        titleIndex.set(title, { id: data.id, canon })
      }
    }
  }
}

// 测试查找
const testNames = [
  '首楞严经',
  '楞伽经',
  '妙法莲华经',
  '圆觉经',
  '金刚般若波罗蜜经',
]

console.log('=== 测试标题查找 ===')
for (const name of testNames) {
  const entry = titleIndex.get(name)
  if (entry) {
    console.log(name + ' -> ' + entry.id + ' (' + entry.canon + ')')
  } else {
    console.log(name + ' -> 未找到')
    // 模糊搜索
    console.log('  模糊搜索:')
    let count = 0
    for (const [title, e] of titleIndex) {
      if (title.includes(name) && e.canon === 'T') {
        console.log('    ' + title + ' -> ' + e.id)
        count++
        if (count >= 5) break
      }
    }
  }
}
