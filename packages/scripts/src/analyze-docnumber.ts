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
  // 分析 docNumber 缺失的藏经
  const missingDoc: { id: string; canon: string; vol: string }[] = []
  for (const file of getAllFiles('/home/guang/happy/yoho-cbeta/parsed')) {
    const meta = JSON.parse(readFileSync(file, 'utf-8'))
    if (!meta.docNumber && meta.canonId !== 'T') {
      missingDoc.push({ id: meta.id, canon: meta.canonId, vol: meta.volume })
    }
  }

  console.log('=== docNumber 缺失分析 ===')
  console.log('总计: ' + missingDoc.length + ' 个非 Taisho 藏文件')

  // 按藏经统计
  const byCanon: Record<string, number> = {}
  for (const f of missingDoc) {
    byCanon[f.canon] = (byCanon[f.canon] || 0) + 1
  }
  console.log('\n按藏经分布:')
  for (const [c, n] of Object.entries(byCanon).sort((a, b) => b[1] - a[1])) {
    console.log('  ' + c + ': ' + n)
  }

  // 检查这些藏经的 header 中是否有 No. 信息
  console.log('\n=== 检查源数据 header ===')
  const sampleByCanon: Record<string, string> = {}
  for (const c of Object.keys(byCanon).slice(0, 5)) {
    const sample = missingDoc.find(f => f.canon === c)
    if (sample) sampleByCanon[c] = sample.id
  }

  for (const [canon, id] of Object.entries(sampleByCanon)) {
    const vol = id.substring(1, 3)
    const dataFile = '/home/guang/happy/yoho-cbeta/data-simplified/' + canon + '/' + canon + vol + '/' + id + '.json'
    try {
      const json = JSON.parse(readFileSync(dataFile, 'utf-8'))
      console.log(canon + ' (' + id + '): header =', JSON.stringify(json.header))
    } catch (e) {
      console.log(canon + ': file not found')
    }
  }
}

main().catch(console.error)
