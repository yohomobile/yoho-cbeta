import * as fs from 'fs'
import * as path from 'path'

interface CbetaElement {
  tag: string
  attrs?: Record<string, string>
  children?: (CbetaElement | string)[]
}

function extractText(element: CbetaElement | string): string {
  if (typeof element === 'string') return element
  if (element.tag === 'note') return ''
  if (element.tag === 'rdg') return ''
  if (element.tag === 'foreign') return ''
  return (element.children || []).map(child => extractText(child)).join('')
}

function findFirst(elements: (CbetaElement | string)[], predicate: (el: CbetaElement) => boolean): CbetaElement | null {
  for (const el of elements) {
    if (typeof el === 'string') continue
    if (predicate(el)) return el
    if (el.children) {
      const found = findFirst(el.children, predicate)
      if (found) return found
    }
  }
  return null
}

function cleanTitle(title: string): string {
  let cleaned = title
  cleaned = cleaned.replace(/[\r\n]+/g, '').replace(/\s+/g, '')
  cleaned = cleaned.replace(/\[[A-Za-zĀāĪīŪūṀṁṂṃṄṅṆṇṚṛṜṝḌḍḤḥḶḷṢṣṬṭŚśÑñḀẀẂẄỲỳ\s\-]+\]/g, '')
  cleaned = cleaned.replace(/[（(][A-Za-zĀāĪīŪūṀṁṂṃṄṅṆṇṚṛṜṝḌḍḤḥḶḷṢṣṬṭŚśÑñḀẀẂẄỲỳ\s\-]+[）)]/g, '')
  cleaned = cleaned.replace(/[A-Za-zĀāĪīŪūṀṁṂṃṄṅṆṇṚṛṜṝḌḍḤḥḶḷṢṣṬṭŚśÑñḀẀẂẄỲỳ-]+/g, '')
  cleaned = cleaned.replace(/卷第?[一二三四五六七八九十百千零\d]+/g, '')
  cleaned = cleaned.replace(/卷之?[一二三四五六七八九十百千零\d]+/g, '')
  cleaned = cleaned.replace(/卷[上中下]/g, '')
  cleaned = cleaned.replace(/[一二三四五六七八九十]+卷$/g, '')
  cleaned = cleaned.replace(/第[一二三四五六七八九十百千零\d]+卷/g, '')
  cleaned = cleaned.replace(/第$/g, '')
  cleaned = cleaned.replace(/\[\s*\]/g, '')
  cleaned = cleaned.replace(/[（(]\s*[）)]/g, '')
  return cleaned.trim()
}

function extractTitle(body: CbetaElement[], headerTitle: string): string {
  const jhead = findFirst(body, el => el.tag === 'jhead')
  if (jhead) {
    const text = extractText(jhead).trim()
    if (text) {
      const cleaned = cleanTitle(text)
      if (cleaned.length >= 2) return cleaned
    }
  }

  const head = findFirst(body, el => el.tag === 'head')
  if (head) {
    const text = extractText(head).trim()
    if (text) {
      const cleaned = cleanTitle(text)
      if (cleaned.length >= 2) return cleaned
    }
  }

  return cleanTitle(headerTitle) || headerTitle
}

// 测试 X14n0293
const file = '/home/guang/happy/yoho-cbeta/data-simplified/X/X14/X14n0293.json'
const data = JSON.parse(fs.readFileSync(file, 'utf-8'))

console.log('ID:', data.id)
console.log('header.title:', data.header?.title)
const extractedTitle = extractTitle(data.body, data.header?.title || '')
console.log('extractTitle 结果:', extractedTitle)
