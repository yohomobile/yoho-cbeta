import { readdirSync, statSync, readFileSync } from 'fs'
import { join } from 'path'

function getAllJsonFiles(dir: string): string[] {
  const files: string[] = []
  const items = readdirSync(dir)
  for (const item of items) {
    const fullPath = join(dir, item)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      files.push(...getAllJsonFiles(fullPath))
    } else if (item.endsWith('.json') && !item.startsWith('.') && item !== '.cache.json') {
      files.push(fullPath)
    }
  }
  return files
}

function extractText(el: any): string {
  if (typeof el === 'string') return el
  if (el.tag === 'note') return ''  // Current logic
  return el.children?.map((c: any) => extractText(c)).join('') || ''
}

const parsedDir = '/home/guang/happy/yoho-cbeta/parsed'
const dataDir = '/home/guang/happy/yoho-cbeta/data-simplified'
const files = getAllJsonFiles(parsedDir)

let bylineButEmpty = 0
let bylineWithNote = 0
let bylineWithNoteContent = 0
let noBylineInSource = 0
const samples: { id: string; reason: string }[] = []

for (const file of files) {
  try {
    const parsedContent = readFileSync(file, 'utf-8')
    const parsed = JSON.parse(parsedContent)
    
    if (!parsed.bylineRaw) {
      // Check if there's a byline in source but it was empty after extraction
      const relPath = file.replace(parsedDir + '/', '')
      const sourceFile = join(dataDir, relPath)
      
      try {
        const sourceContent = readFileSync(sourceFile, 'utf-8')
        const source = JSON.parse(sourceContent)
        
        const bylines = source.body?.filter((el: any) => typeof el === 'object' && el.tag === 'byline') || []
        
        if (bylines.length > 0) {
          bylineButEmpty++
          const text = bylines.map((bl: any) => extractText(bl)).join('；').trim()
          const hasNote = bylines.some((bl: any) => {
            const hasNoteChild = (el: any): boolean => {
              if (el.tag === 'note') return true
              return el.children?.some(hasNoteChild) || false
            }
            return hasNoteChild(bl)
          })
          
          if (hasNote && text === '') {
            bylineWithNote++
            bylineWithNoteContent++
            if (samples.length < 10) {
              samples.push({ id: parsed.id, reason: 'byline only contains note elements' })
            }
          } else if (text === '') {
            samples.push({ id: parsed.id, reason: 'byline empty after extraction' })
          }
        } else {
          noBylineInSource++
        }
      } catch (e) {}
    }
  } catch (e) {}
}

console.log('=== Byline 提取问题分析 ===\n')
console.log('总文件数: ' + files.length)
console.log('bylineRaw 为空: ' + bylineButEmpty)
console.log('  - 源数据有 byline 但内容为空: ' + bylineWithNote)
console.log('  - 源数据没有 byline: ' + noBylineInSource)
console.log('样本:')
for (const s of samples) {
  console.log('  ' + s.id + ': ' + s.reason)
}
