/**
 * CBETA JSONB 数据解析器（前端可用）
 * 从 API 返回的 JSONB 内容解析为 Chapter 格式
 */

import type { Block, Chapter, InlineNode } from './types'
import {
  type CbetaNode,
  type CbetaElement,
  type ParseContext,
  isElement,
  normalizeText,
  extractPlainText,
  compactInlines,
  collectInlines,
  buildParagraphBlock,
  buildVerseBlock,
  buildListBlock,
  buildTableBlock,
} from './parser-utils'

/**
 * 将 CBETA JSONB 数据解析为 Chapter 格式
 * @param content API 返回的 JSONB content 数组
 * @param title 章节标题（默认"正文"）
 */
export const parseJuanContent = (
  content: unknown[],
  title = '正文'
): Chapter => {
  const ctx: ParseContext = { notes: [], variants: [] }
  const blocks: Block[] = []
  let markerBuffer: InlineNode[] = []
  const frontMatterKeys = new Set<string>()

  const allowFrontMatter = (key: string) => {
    if (frontMatterKeys.has(key)) {
      return false
    }
    frontMatterKeys.add(key)
    return true
  }

  const pushBlock = (block: Block | null) => {
    if (!block) {
      return
    }
    if (markerBuffer.length > 0 && block.type === 'paragraph') {
      block.inlines = compactInlines([...markerBuffer, ...block.inlines])
      markerBuffer = []
    } else if (markerBuffer.length > 0) {
      blocks.push({ type: 'marker', markers: markerBuffer })
      markerBuffer = []
    }
    blocks.push(block)
  }

  const pushMarkerBlock = () => {
    if (markerBuffer.length === 0) {
      return
    }
    blocks.push({ type: 'marker', markers: markerBuffer })
    markerBuffer = []
  }

  const walk = (node: CbetaNode | CbetaNode[]) => {
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (typeof node === 'string') {
      const text = normalizeText(node)
      if (text) {
        const inline: InlineNode = { type: 'text', text }
        pushBlock({ type: 'paragraph', inlines: [inline] })
      }
      return
    }
    if (!node || !isElement(node)) {
      return
    }

    const tag = node.tag
    if (!tag) {
      return
    }

    if (tag === 'p') {
      pushBlock(buildParagraphBlock(node, ctx))
      return
    }

    if (tag === 'lg') {
      pushBlock(buildVerseBlock(node, ctx))
      return
    }

    if (tag === 'list') {
      pushBlock(buildListBlock(node, ctx))
      return
    }

    if (tag === 'table') {
      pushBlock(buildTableBlock(node, ctx))
      return
    }

    if (tag === 'byline') {
      const text = normalizeText(extractPlainText(node))
      if (text && allowFrontMatter(`byline:${text}`)) {
        pushBlock({ type: 'byline', text })
      }
      return
    }

    if (tag === 'docNumber') {
      const text = normalizeText(extractPlainText(node))
      if (text && allowFrontMatter(`doc:${text}`)) {
        pushBlock({ type: 'docNumber', text })
      }
      return
    }

    if (tag === 'juan') {
      return
    }

    if (tag === 'milestone') {
      return
    }

    // mulu 是目录标签，用于生成侧边栏目录，不在正文中显示
    if (tag === 'mulu') {
      return
    }

    if (tag === 'head' || tag === 'jhead' || tag === 'title') {
      const text = normalizeText(extractPlainText(node))
      if (text) {
        pushBlock({
          type: 'heading',
          text,
          level: node.attrs?.level,
          kind: node.attrs?.type,
        })
      }
      return
    }

    if (tag === 'lb' || tag === 'pb') {
      const marker = collectInlines(node, ctx)
      markerBuffer = markerBuffer.concat(marker)
      return
    }

    if (tag === '#comment') {
      return
    }

    if (tag === 'note') {
      return
    }

    if ((node as CbetaElement).children) {
      ;(node as CbetaElement).children!.forEach(walk)
    }
  }

  walk(content as CbetaNode[])
  pushMarkerBlock()

  return {
    title,
    blocks,
    notes: ctx.notes,
    variants: ctx.variants,
  }
}
