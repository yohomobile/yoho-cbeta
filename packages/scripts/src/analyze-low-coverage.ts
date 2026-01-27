import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join } from 'path'

function getAllFiles(dir: string): string[] {
  const files: string[] = []
  const items = readdirSync(dir)
  for (const item of items) {
    const fullPath = join(dir, item)
    if (statSync(fullPath).isDirectory()) {
      files.push(...getAllFiles(fullPath))
    } else if (item.endsWith('.json') && !item.startsWith('.')) {
      files.push(fullPath)
    }
  }
  return files
}

async function main() {
  const files = getAllFiles('/home/guang/happy/yoho-cbeta/parsed')

  // 分析缺失字段
  const missingPage: string[] = []
  const missingByline: string[] = []
  const missingDoc: string[] = []

  for (const file of files) {
    try {
      const meta = JSON.parse(readFileSync(file, 'utf-8'))
      if (!meta.pageStart) missingPage.push(meta.id)
      if (!meta.bylineRaw) missingByline.push(meta.id)
      if (!meta.docNumber) missingDoc.push(meta.id)
    } catch (e) {}
  }

  console.log('═'.repeat(60))
  console.log('  低覆盖率字段详细分析')
  console.log('═'.repeat(60))

  // 1. pageStart/End 分析
  console.log('\n【1. pageStart/End 缺失分析】')
  console.log('总计: ' + missingPage.length + ' 个文件')
  const pageByCanon: Record<string, number> = {}
  for (const id of missingPage) {
    pageByCanon[id[0]] = (pageByCanon[id[0]] || 0) + 1
  }
  console.log('按藏经分布:')
  for (const [c, n] of Object.entries(pageByCanon).sort((a, b) => b[1] - a[1])) {
    console.log('  ' + c + ': ' + n)
  }
  console.log('文件列表: ' + missingPage.join(', '))

  // 2. bylineRaw 分析
  console.log('\n【2. bylineRaw 缺失分析】')
  console.log('总计: ' + missingByline.length + ' 个文件')
  const bylineByCanon: Record<string, number> = {}
  for (const id of missingByline) {
    bylineByCanon[id[0]] = (bylineByCanon[id[0]] || 0) + 1
  }
  console.log('按藏经分布:')
  for (const [c, n] of Object.entries(bylineByCanon).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log('  ' + c + ': ' + n)
  }
  console.log('示例: ' + missingByline.slice(0, 10).join(', '))

  // 3. docNumber 分析
  console.log('\n【3. docNumber 缺失分析】')
  console.log('总计: ' + missingDoc.length + ' 个文件')
  const docByCanon: Record<string, number> = {}
  for (const id of missingDoc) {
    docByCanon[id[0]] = (docByCanon[id[0]] || 0) + 1
  }
  console.log('按藏经分布:')
  for (const [c, n] of Object.entries(docByCanon).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log('  ' + c + ': ' + n)
  }

  // 4. 检查源数据中是否有其他标记页码的方式
  console.log('\n【4. 源数据页码标记检查】')
  const pageSampleIds = missingPage.slice(0, 3)
  for (const id of pageSampleIds) {
    const vol = id.substring(1, 3)
    const dataFile = '/home/guang/happy/yoho-cbeta/data-simplified/' + id[0] + '/' + id.substring(0, 4) + '/' + id + '.json'
    if (existsSync(dataFile)) {
      const json = JSON.parse(readFileSync(dataFile, 'utf-8'))

      function countTags(els: any[], counts: Record<string, number> = {}) {
        for (const el of els) {
          if (typeof el === 'object') {
            counts[el.tag] = (counts[el.tag] || 0) + 1
            if (el.children) countTags(el.children, counts)
          }
        }
        return counts
      }

      const tags = countTags(json.body)
      console.log(id + ': tags = ' + JSON.stringify(tags))
    }
  }

  // 5. 检查没有 byline 的文件是否有其他信息
  console.log('\n【5. 源数据 byline 检查】')
  const bylineSampleIds = missingByline.slice(0, 5)
  for (const id of bylineSampleIds) {
    const vol = id.substring(1, 3)
    const dataFile = '/home/guang/happy/yoho-cbeta/data-simplified/' + id[0] + '/' + id.substring(0, 4) + '/' + id + '.json'
    if (existsSync(dataFile)) {
      const json = JSON.parse(readFileSync(dataFile, 'utf-8'))

      function hasBylineTag(els: any[]): boolean {
        for (const el of els) {
          if (typeof el === 'object') {
            if (el.tag === 'byline') return true
            if (el.children && hasBylineTag(el.children)) return true
          }
        }
        return false
      }

      console.log(id + ': has byline tag = ' + hasBylineTag(json.body))
    }
  }
}

main().catch(console.error)
