/**
 * 从 CBETA JSONB 内容中提取纯净中文文本
 * 用于生成语义搜索的嵌入向量
 */

type CbetaNode = string | CbetaElement

type CbetaElement = {
  tag?: string
  attrs?: Record<string, string>
  children?: CbetaNode[]
}

const isElement = (node: CbetaNode): node is CbetaElement =>
  typeof node === 'object' && node !== null

/**
 * 标准化文本：去除多余空白，统一引号，清理残留标签
 */
const normalizeText = (text: string): string => {
  if (!text) return ''
  // 统一引号
  let normalized = text.replace(/『/g, '「').replace(/』/g, '」')
  // 清理残留的 HTML 标签（如 <a> </a> 等）
  normalized = normalized.replace(/<[^>]+>/g, '')
  // 中文文本去除所有空白
  if (!/[A-Za-z]/.test(normalized)) {
    return normalized.replace(/\s+/g, '')
  }
  return normalized.replace(/\s+/g, ' ')
}

/**
 * 从 CBETA JSONB 节点提取纯净中文文本
 * - 排除梵文 (foreign)
 * - 排除行号标记 (lb, pb)
 * - 排除注释 (note)
 * - 从校勘 (app) 中只提取正文 (lem)
 * - 外字 (g) 用占位符表示
 */
export const extractPureText = (node: CbetaNode): string => {
  if (typeof node === 'string') {
    return normalizeText(node)
  }
  if (!node || !isElement(node)) {
    return ''
  }

  const tag = node.tag
  if (!tag) return ''

  // 跳过的标签
  if (
    tag === 'lb' ||      // 行号
    tag === 'pb' ||      // 页号
    tag === 'milestone' ||
    tag === 'anchor' ||
    tag === '#comment' ||
    tag === 'note' ||    // 注释
    tag === 'foreign' || // 外文（梵文等）
    tag === 't' ||       // 外文转写
    tag === 'tt' ||      // 外文音译
    tag === 'rdg' ||     // 异读（只保留 lem）
    tag === 'a' ||       // 锚点
    tag === 'ref'        // 引用
  ) {
    return ''
  }

  // app 标签：只提取 lem（校勘正文）
  if (tag === 'app') {
    const children = node.children || []
    for (const child of children) {
      if (typeof child === 'object' && child.tag === 'lem') {
        return extractPureText(child)
      }
    }
    return ''
  }

  // 外字：用方括号占位
  if (tag === 'g') {
    const ref = node.attrs?.ref?.replace('#', '') || ''
    return ref ? `[${ref}]` : '[缺字]'
  }

  // 递归提取子节点
  const children = node.children ?? []
  return children.map(extractPureText).join('')
}

/**
 * 从整个 JSONB content 数组提取纯净文本
 */
export const extractJuanText = (content: unknown[]): string => {
  const texts: string[] = []

  const walk = (node: CbetaNode | CbetaNode[]) => {
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }

    if (typeof node === 'string') {
      const text = normalizeText(node)
      if (text) texts.push(text)
      return
    }

    if (!node || !isElement(node)) return

    const tag = node.tag
    if (!tag) return

    // 段落和偈颂是主要内容
    if (tag === 'p' || tag === 'lg') {
      const text = extractPureText(node).trim()
      if (text) texts.push(text)
      return
    }

    // 列表项
    if (tag === 'list') {
      const text = extractPureText(node).trim()
      if (text) texts.push(text)
      return
    }

    // 跳过署名、标题、目录等元数据
    if (
      tag === 'byline' ||
      tag === 'docNumber' ||
      tag === 'juan' ||
      tag === 'jhead' ||
      tag === 'title' ||
      tag === 'mulu' ||    // 目录
      tag === 'head' ||    // 标题
      tag === 'cb:mulu'    // 目录
    ) {
      return
    }

    // 递归处理其他容器标签
    if (node.children) {
      node.children.forEach(walk)
    }
  }

  walk(content as CbetaNode[])

  // 用换行符连接段落
  return texts.join('\n')
}

/**
 * 文本分块
 */
export interface TextChunk {
  content: string
  charStart: number
  charEnd: number
}

export interface ChunkOptions {
  maxChars?: number   // 最大字符数，默认 500
  overlap?: number    // 重叠字符数，默认 50
  minChars?: number   // 最小字符数，默认 100
}

const DEFAULT_CHUNK_OPTIONS: Required<ChunkOptions> = {
  maxChars: 500,
  overlap: 50,
  minChars: 100,
}

/**
 * 将文本分块
 * 按句号、问号、叹号分句，然后组合成合适大小的块
 */
export const chunkText = (text: string, options: ChunkOptions = {}): TextChunk[] => {
  const opts = { ...DEFAULT_CHUNK_OPTIONS, ...options }
  const chunks: TextChunk[] = []

  // 按句号、问号、叹号分句
  const sentences = text.split(/(?<=[。？！」])/g).filter(s => s.trim())

  if (sentences.length === 0) return []

  let currentChunk = ''
  let currentStart = 0
  let charPos = 0

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i]

    if (currentChunk.length + sentence.length > opts.maxChars && currentChunk.length >= opts.minChars) {
      // 保存当前块
      chunks.push({
        content: currentChunk.trim(),
        charStart: currentStart,
        charEnd: charPos,
      })

      // 开始新块（带重叠）
      const overlapStart = Math.max(0, currentChunk.length - opts.overlap)
      const overlapText = currentChunk.slice(overlapStart)
      currentChunk = overlapText + sentence
      currentStart = charPos - (currentChunk.length - sentence.length)
    } else {
      currentChunk += sentence
    }

    charPos += sentence.length
  }

  // 保存最后一块
  if (currentChunk.length >= opts.minChars) {
    chunks.push({
      content: currentChunk.trim(),
      charStart: currentStart,
      charEnd: charPos,
    })
  } else if (chunks.length > 0) {
    // 最后一块太小，合并到前一块
    const lastChunk = chunks[chunks.length - 1]
    lastChunk.content += currentChunk
    lastChunk.charEnd = charPos
  } else if (currentChunk.trim()) {
    // 整个文本都很短，作为一块
    chunks.push({
      content: currentChunk.trim(),
      charStart: 0,
      charEnd: charPos,
    })
  }

  return chunks
}

/**
 * 构建用于嵌入的结构化文本
 */
export interface SutraChunkMeta {
  title: string
  authorRaw?: string | null
  translationDynasty?: string | null
  juan: number
  juanCount: number
}

export const buildEmbeddingText = (content: string, meta: SutraChunkMeta): string => {
  const parts = [
    `【${meta.title}】`,
    meta.authorRaw ? `译者：${meta.authorRaw}` : null,
    meta.translationDynasty ? `朝代：${meta.translationDynasty}` : null,
    meta.juanCount > 1 ? `第${meta.juan}卷（共${meta.juanCount}卷）` : null,
    '',
    content,
  ]
  return parts.filter(Boolean).join('\n')
}

/**
 * 构建词典条目的嵌入文本
 */
export const buildDictEmbeddingText = (term: string, definition: string, source: string): string => {
  return `【${term}】（${source}）\n${definition}`
}
