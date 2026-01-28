/**
 * CBETA 解析器共享工具函数
 */

import type { Block, InlineNode, NoteItem, VariantItem } from './types'

// ============ 类型定义 ============

export type CbetaNode = string | CbetaElement

export type CbetaElement = {
  tag?: string
  attrs?: Record<string, string>
  children?: CbetaNode[]
}

export type ParseContext = {
  notes: NoteItem[]
  variants: VariantItem[]
}

// ============ 基础工具函数 ============

export const isElement = (node: CbetaNode): node is CbetaElement =>
  typeof node === 'object' && node !== null

export const normalizeInlineText = (text: string) => {
  if (!text) {
    return ''
  }
  // 统一引号：『 → 「，』 → 」
  let normalized = text.replace(/『/g, '「').replace(/』/g, '」')
  const hasLatin = /[A-Za-z]/.test(normalized)
  if (hasLatin) {
    return normalized.replace(/\s+/g, ' ')
  }
  return normalized.replace(/\s+/g, '')
}

export const normalizeText = (text: string) => normalizeInlineText(text).trim()

export const formatGaijiRef = (ref?: string) => {
  if (!ref) {
    return '〔缺字〕'
  }
  return `〔${ref.replace('#', '')}〕`
}

export const formatJuanLabel = (n?: string) => {
  if (!n) {
    return '卷'
  }
  const normalized = n.replace(/^0+/, '') || n
  return `第${normalized}卷`
}

// ============ 文本提取 ============

export const extractPlainText = (node: CbetaNode, includeNotes = false): string => {
  if (typeof node === 'string') {
    return normalizeInlineText(node)
  }
  if (!node || !isElement(node)) {
    return ''
  }

  const tag = node.tag
  if (!tag) {
    return ''
  }

  if (tag === 'lb' || tag === 'pb' || tag === 'milestone' || tag === 'anchor' || tag === '#comment') {
    return ''
  }
  if (tag === 'note' && !includeNotes) {
    return ''
  }
  if (tag === 'app') {
    // 从 app 标签中提取 lem（校勘正文）的内容
    const children = node.children || []
    for (const child of children) {
      if (typeof child === 'object' && child.tag === 'lem') {
        return extractPlainText(child, includeNotes)
      }
    }
    return ''
  }
  if (tag === 't' || tag === 'tt' || tag === 'foreign') {
    return ''
  }
  if (tag === 'g') {
    return formatGaijiRef(node.attrs?.ref)
  }

  const children = node.children ?? []
  return children.map((child) => extractPlainText(child, includeNotes)).join('')
}

// ============ InlineNode 压缩处理 ============

export const compactInlines = (inlines: InlineNode[]): InlineNode[] => {
  const compacted: InlineNode[] = []
  let pendingSanskrit: string | null = null
  let chineseStartIndex: number | null = null

  for (let i = 0; i < inlines.length; i++) {
    const inline = inlines[i]

    if (inline.type === 'sanskritRuby') {
      pendingSanskrit = inline.text
      chineseStartIndex = compacted.length
      continue
    }

    if (inline.type === 'text') {
      if (!inline.text) {
        continue
      }
      if (pendingSanskrit) {
        const punctMatch = inline.text.match(/[、，。：；！？]/)
        if (punctMatch && punctMatch.index !== undefined) {
          const beforePunct = inline.text.slice(0, punctMatch.index)
          const punct = punctMatch[0]
          const afterPunct = inline.text.slice(punctMatch.index + 1)
          let chineseText = ''
          const startIdx = chineseStartIndex ?? 0
          for (let j = startIdx; j < compacted.length; j++) {
            const node = compacted[j]
            if (node.type === 'text') {
              chineseText += node.text
            }
          }
          chineseText += beforePunct
          const last = compacted[compacted.length - 1]
          if (last && last.type === 'text') {
            last.text += beforePunct
          } else if (beforePunct) {
            compacted.push({ type: 'text', text: beforePunct })
          }
          compacted.push({ type: 'sanskritMarker', text: pendingSanskrit, chinese: chineseText })
          pendingSanskrit = null
          chineseStartIndex = null
          compacted.push({ type: 'text', text: punct })
          if (afterPunct) {
            inlines[i] = { type: 'text', text: afterPunct }
            i--
          }
          continue
        }
      }
      const last = compacted[compacted.length - 1]
      if (last && last.type === 'text') {
        last.text += inline.text
      } else {
        compacted.push({ ...inline })
      }
      continue
    }

    if (inline.type === 'foreign') {
      const next = compactInlines(inline.inlines)
      if (next.length > 0) {
        compacted.push({ ...inline, inlines: next })
      }
      continue
    }

    if (inline.type === 'inlineGroup') {
      const items = inline.items
        .map((item) => ({ ...item, inlines: compactInlines(item.inlines) }))
        .filter((item) => item.inlines.length > 0)
      if (items.length > 0) {
        compacted.push({ ...inline, items })
      }
      continue
    }

    if (inline.type === 'emph' || inline.type === 'term' || inline.type === 'ref') {
      const next = compactInlines(inline.inlines)
      if (next.length > 0) {
        compacted.push({ ...inline, inlines: next })
      }
      continue
    }

    compacted.push(inline)
  }

  if (pendingSanskrit) {
    let chineseText = ''
    const startIdx = chineseStartIndex ?? 0
    for (let j = startIdx; j < compacted.length; j++) {
      const node = compacted[j]
      if (node.type === 'text') {
        chineseText += node.text
      }
    }
    compacted.push({ type: 'sanskritMarker', text: pendingSanskrit, chinese: chineseText })
  }

  if (compacted.length === 0) {
    return compacted
  }

  const first = compacted[0]
  if (first.type === 'text') {
    first.text = first.text.trimStart()
  }
  const last = compacted[compacted.length - 1]
  if (last.type === 'text') {
    last.text = last.text.trimEnd()
  }

  return compacted.filter((inline) => inline.type !== 'text' || inline.text.length > 0)
}

// ============ InlineNode 收集 ============

export const collectInlineChildren = (node: CbetaElement, ctx: ParseContext): InlineNode[] => {
  const children = node.children ?? []
  return children.flatMap((child) => collectInlines(child, ctx))
}


export const collectInlines = (node: CbetaNode, ctx: ParseContext): InlineNode[] => {
  if (typeof node === 'string') {
    const text = normalizeInlineText(node)
    return text ? [{ type: 'text', text }] : []
  }
  if (!node || !isElement(node)) {
    return []
  }

  const tag = node.tag
  if (!tag) {
    return []
  }

  if (tag === '#comment') {
    return []
  }

  if (tag === 'lb') {
    return [
      {
        type: 'marker',
        kind: 'lb',
        label: node.attrs?.n,
        ed: node.attrs?.ed,
      },
    ]
  }

  if (tag === 'pb') {
    return [
      {
        type: 'marker',
        kind: 'pb',
        label: node.attrs?.n,
        ed: node.attrs?.ed,
        id: node.attrs?.id,
      },
    ]
  }

  if (tag === 'space') {
    return [{ type: 'text', text: ' ' }]
  }

  if (tag === 'caesura') {
    return [{ type: 'caesura' }]
  }

  if (tag === 'anchor') {
    const anchorId = node.attrs?.id
    if (!anchorId) {
      return []
    }
    return [{ type: 'anchor', id: anchorId }]
  }

  if (tag === 'note') {
    return []
  }

  if (tag === 'app') {
    // 从 app 标签中提取 lem（校勘正文）的内容
    const children = node.children || []
    for (const child of children) {
      if (typeof child === 'object' && child.tag === 'lem') {
        return collectInlineChildren(child, ctx)
      }
    }
    return []
  }

  if (tag === 'rdg') {
    return []
  }

  if (tag === 'lem') {
    return collectInlineChildren(node, ctx)
  }

  if (tag === 'g') {
    return [{ type: 'gaiji', ref: node.attrs?.ref }]
  }

  if (tag === 't') {
    return []
  }

  if (tag === 'tt') {
    return []
  }

  if (tag === 'foreign') {
    return []
  }

  if (tag === 'hi') {
    const inlines = compactInlines(collectInlineChildren(node, ctx))
    if (inlines.length === 0) {
      return []
    }
    return [{ type: 'emph', rend: node.attrs?.rend ?? node.attrs?.style, inlines }]
  }

  if (tag === 'term') {
    const inlines = compactInlines(collectInlineChildren(node, ctx))
    if (inlines.length === 0) {
      return []
    }
    return [{ type: 'term', inlines }]
  }

  if (tag === 'ref') {
    const inlines = compactInlines(collectInlineChildren(node, ctx))
    if (inlines.length === 0) {
      return []
    }
    return [
      {
        type: 'ref',
        target: node.attrs?.target ?? node.attrs?.cRef ?? node.attrs?.ref,
        inlines,
      },
    ]
  }

  return collectInlineChildren(node, ctx)
}

// ============ Block 构建 ============

export const buildParagraphBlock = (node: CbetaElement, ctx: ParseContext): Block | null => {
  const inlines = compactInlines(collectInlineChildren(node, ctx))
  if (inlines.length === 0) {
    return null
  }
  return { type: 'paragraph', inlines, id: node.attrs?.id }
}

export const buildVerseBlock = (node: CbetaElement, ctx: ParseContext): Block | null => {
  const lines: InlineNode[][] = []
  for (const child of node.children ?? []) {
    if (isElement(child) && child.tag === 'l') {
      const inlines = compactInlines(collectInlineChildren(child, ctx))
      if (inlines.length > 0) {
        lines.push(inlines)
      }
    }
  }
  if (lines.length === 0) {
    return null
  }
  return { type: 'verse', lines, id: node.attrs?.id }
}

export const buildListBlock = (node: CbetaElement, ctx: ParseContext): Block | null => {
  const items: InlineNode[][] = []
  for (const child of node.children ?? []) {
    if (isElement(child) && child.tag === 'item') {
      const inlines = compactInlines(collectInlineChildren(child, ctx))
      if (inlines.length > 0) {
        items.push(inlines)
      }
    }
  }
  if (items.length === 0) {
    return null
  }
  const markerless = node.attrs?.rend?.includes('no-marker') ?? false
  return { type: 'list', items, markerless }
}

export const buildTableBlock = (node: CbetaElement, ctx: ParseContext): Block | null => {
  const rows: InlineNode[][][] = []
  for (const child of node.children ?? []) {
    if (!isElement(child)) {
      continue
    }
    if (child.tag === 'row') {
      const cells: InlineNode[][] = []
      for (const cell of child.children ?? []) {
        if (isElement(cell) && cell.tag === 'cell') {
          const inlines = compactInlines(collectInlineChildren(cell, ctx))
          cells.push(inlines)
        }
      }
      if (cells.length > 0) {
        rows.push(cells)
      }
    }
  }

  if (rows.length === 0) {
    const inlines = compactInlines(collectInlineChildren(node, ctx))
    if (inlines.length === 0) {
      return null
    }
    rows.push([inlines])
  }

  return { type: 'table', rows }
}
