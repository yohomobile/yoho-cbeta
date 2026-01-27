import * as fs from 'fs'
import * as path from 'path'

interface CbetaElement {
  tag: string
  attrs?: Record<string, string>
  children?: (CbetaElement | string)[]
}

function extractText(el: CbetaElement | string): string {
  if (typeof el === 'string') return el
  if (el.children) return el.children.map(extractText).join('')
  return ''
}

function findElements(elements: (CbetaElement | string)[], predicate: (el: CbetaElement) => boolean): CbetaElement[] {
  const results: CbetaElement[] = []
  function search(arr: (CbetaElement | string)[]) {
    for (const el of arr) {
      if (typeof el === 'object' && el !== null) {
        if (predicate(el)) results.push(el)
        if (el.children) search(el.children)
      }
    }
  }
  search(elements)
  return results
}

const ids = ['T18n0855', 'T19n0958', 'T20n1088', 'T45n1879b', 'T54n2128', 'T54n2129', 'T85n2788', 'T85n2789']

for (const id of ids) {
  const vol = id.match(/T\d+/)?.[0]
  const file = path.join('/home/guang/happy/yoho-cbeta/data-simplified/T', vol || '', id + '.json')

  console.log('\n=== ' + id + ' ===')

  if (!fs.existsSync(file)) {
    console.log('文件不存在:', file)
    continue
  }

  const data = JSON.parse(fs.readFileSync(file, 'utf-8'))
  console.log('标题:', data.header?.title)

  // 提取 docNumber
  const docNumbers = findElements(data.body, (el: CbetaElement) => el.tag === 'docNumber')
  if (docNumbers.length > 0) {
    console.log('docNumber:', extractText(docNumbers[0]).trim())
  } else {
    console.log('无 docNumber')
  }
}
