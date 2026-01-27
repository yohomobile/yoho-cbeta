import 'server-only'

import { existsSync, readFileSync } from 'fs'
import path from 'path'

import type { Block, Chapter, InlineNode } from './types'
import {
  type CbetaNode,
  type ParseContext,
  isElement,
  normalizeText,
  extractPlainText,
  compactInlines,
  collectInlines,
  formatJuanLabel,
  buildParagraphBlock,
  buildVerseBlock,
  buildListBlock,
  buildTableBlock,
} from './parser-utils'

const resolveDataPath = (relativePath: string) => {
  const roots = [process.cwd(), path.resolve(process.cwd(), '..', '..')]
  for (const root of roots) {
    const fullPath = path.join(root, 'data-simplified', relativePath)
    if (existsSync(fullPath)) {
      return fullPath
    }
  }
  return null
}

const resolveParsedPath = (relativePath: string) => {
  const roots = [process.cwd(), path.resolve(process.cwd(), '..', '..')]
  for (const root of roots) {
    const fullPath = path.join(root, 'parsed', relativePath)
    if (existsSync(fullPath)) {
      return fullPath
    }
  }
  return null
}

const extractHeadingText = (node: CbetaNode) => {
  return normalizeText(extractPlainText(node))
}

const hasHeadingTag = (nodes: CbetaNode[], tagName: 'mulu' | 'head') => {
  let found = false
  const walk = (node: CbetaNode | CbetaNode[]) => {
    if (found) {
      return
    }
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (!node || !isElement(node)) {
      return
    }
    if (node.tag === tagName) {
      const heading = extractHeadingText(node)
      if (heading) {
        found = true
        return
      }
    }
    if (node.children) {
      node.children.forEach(walk)
    }
  }
  walk(nodes)
  return found
}

const hasJuanTag = (nodes: CbetaNode[]) => {
  let foundJuan = false
  let foundMilestone = false

  const walk = (node: CbetaNode | CbetaNode[]) => {
    if (foundJuan && foundMilestone) {
      return
    }
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (!node || !isElement(node)) {
      return
    }
    if (node.tag === 'juan') {
      foundJuan = true
    }
    if (node.tag === 'milestone' && node.attrs?.unit === 'juan') {
      foundMilestone = true
    }
    if (node.children) {
      node.children.forEach(walk)
    }
  }

  walk(nodes)
  return { hasJuanElement: foundJuan, hasJuanMarker: foundJuan || foundMilestone }
}

export type ChapterMode = 'juan' | 'pin' | 'auto'

export const loadMainTextChapters = (
  relativePath: string,
  title = '正文',
  chapterMode: ChapterMode = 'auto'
): Chapter[] => {
  const fullPath = resolveDataPath(relativePath)
  if (!fullPath) {
    return [{ title, blocks: [], notes: [], variants: [] }]
  }

  const raw = JSON.parse(readFileSync(fullPath, 'utf-8')) as {
    body?: CbetaNode[]
  }

  if (!raw.body) {
    return [{ title, blocks: [], notes: [], variants: [] }]
  }

  const headingTag: 'mulu' | 'head' | null = hasHeadingTag(raw.body, 'mulu')
    ? 'mulu'
    : hasHeadingTag(raw.body, 'head')
      ? 'head'
      : null
  const { hasJuanElement, hasJuanMarker } = hasJuanTag(raw.body)

  const useJuanSections =
    chapterMode === 'juan' ? true : chapterMode === 'pin' ? false : hasJuanMarker

  const chapters: Chapter[] = []
  let current: Chapter = { title, blocks: [], notes: [], variants: [] }
  let ctx: ParseContext = { notes: [], variants: [] }
  let markerBuffer: InlineNode[] = []
  let frontMatterKeys = new Set<string>()
  let currentJuanLabel: string | null = null
  let lastMuluType: string | null = null

  const allowFrontMatter = (key: string) => {
    if (frontMatterKeys.has(key)) {
      return false
    }
    frontMatterKeys.add(key)
    return true
  }

  const syncChapterMeta = () => {
    current.notes = ctx.notes
    current.variants = ctx.variants
  }

  const pushChapter = () => {
    syncChapterMeta()
    const hasContent = current.blocks.some(
      (block) =>
        block.type === 'paragraph' ||
        block.type === 'verse' ||
        block.type === 'list' ||
        block.type === 'table' ||
        block.type === 'heading' ||
        block.type === 'byline',
    )
    if (hasContent || current.title !== title) {
      chapters.push(current)
    }
  }

  const startChapter = (heading: string, mergeInitial = false, level?: number) => {
    if (mergeInitial && current.title === title) {
      current.title = heading
      current.level = level
    } else {
      pushChapter()
      current = { title: heading, level, blocks: [], notes: [], variants: [] }
      ctx = { notes: [], variants: [] }
      markerBuffer = []
      frontMatterKeys = new Set()
    }
  }

  const pushBlock = (block: Block | null) => {
    if (!block) {
      return
    }
    if (markerBuffer.length > 0 && block.type === 'paragraph') {
      block.inlines = compactInlines([...markerBuffer, ...block.inlines])
      markerBuffer = []
    } else if (markerBuffer.length > 0) {
      current.blocks.push({ type: 'marker', markers: markerBuffer })
      markerBuffer = []
    }
    current.blocks.push(block)
  }

  const pushMarkerBlock = () => {
    if (markerBuffer.length === 0) {
      return
    }
    current.blocks.push({ type: 'marker', markers: markerBuffer })
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

    if (headingTag === 'mulu' && tag === 'mulu' && !useJuanSections) {
      const muluType = node.attrs?.type
      const muluLevel = node.attrs?.level
      lastMuluType = muluType ?? null

      if (muluType === '卷') {
        return
      }

      const heading = extractHeadingText(node)
      if (heading) {
        const isFirstChapter = chapters.length === 0 && current.title === title
        const level = muluLevel ? Number.parseInt(muluLevel, 10) : undefined
        startChapter(heading, isFirstChapter, level)
      }
      return
    }

    if (headingTag === 'mulu' && tag === 'mulu' && useJuanSections) {
      lastMuluType = node.attrs?.type ?? null
    }

    if (headingTag === 'mulu' && tag === 'head' && !useJuanSections) {
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
      const label = formatJuanLabel(node.attrs?.n)
      if (useJuanSections && node.attrs?.fun !== 'close') {
        if (label && label !== currentJuanLabel) {
          const isFirstJuan = currentJuanLabel === null
          startChapter(label, isFirstJuan)
          currentJuanLabel = label
        }
      }
      if (allowFrontMatter(`juan:${label}`)) {
        pushBlock({ type: 'juan', label })
      }
      return
    }

    if (tag === 'milestone') {
      if (node.attrs?.unit === 'juan') {
        const label = formatJuanLabel(node.attrs?.n)
        if (useJuanSections && !hasJuanElement) {
          if (label && label !== currentJuanLabel) {
            const isFirstJuan = currentJuanLabel === null
            startChapter(label, isFirstJuan)
            currentJuanLabel = label
          }
        }
        if (allowFrontMatter(`juan:${label}`)) {
          pushBlock({ type: 'milestone', label })
        }
      }
      return
    }

    if (tag === 'head' || tag === 'mulu' || tag === 'jhead' || tag === 'title') {
      if (tag === 'mulu') {
        if (!useJuanSections) {
          return
        }
        const muluType = node.attrs?.type
        if (muluType === '卷') {
          return
        }
      }
      if (headingTag === 'mulu' && tag === 'head') {
        if (!useJuanSections) {
          if (lastMuluType !== '卷') {
            return
          }
        }
      }
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

    if (node.children) {
      node.children.forEach(walk)
    }
  }

  walk(raw.body)
  pushMarkerBlock()
  pushChapter()

  if (chapters.length === 0) {
    syncChapterMeta()
    return [current]
  }

  return chapters
}

export const loadTocIndex = (relativePath: string): Chapter[] => {
  const fullPath = resolveParsedPath(relativePath)
  if (!fullPath) {
    return []
  }

  const raw = JSON.parse(readFileSync(fullPath, 'utf-8')) as {
    toc?: Array<{
      level: number
      type: string
      title: string
      juanNumber: number | null
    }>
  }

  if (!raw.toc) {
    return []
  }

  return raw.toc
    .filter((item) => item.type !== '卷' && item.title)
    .map((item) => ({
      id: `toc-${item.level}-${item.title}`,
      title: item.title,
      level: item.level,
      juanNumber: item.juanNumber ?? undefined,
      blocks: [],
      notes: [],
      variants: [],
    }))
}
