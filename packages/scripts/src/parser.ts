/**
 * CBETA XML 解析器
 * 使用 fast-xml-parser 保持 XML 树结构
 */

import { XMLParser } from 'fast-xml-parser'
import { readFileSync } from 'fs'
import type { CbetaDocument, CbetaElement } from './types.js'

// TEI 和 CBETA 命名空间
const NS = {
  tei: 'http://www.tei-c.org/ns/1.0',
  cb: 'http://www.cbeta.org/ns/1.0',
  xml: 'http://www.w3.org/XML/1998/namespace'
}

export class CbetaParser {
  private parser: XMLParser

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      preserveOrder: true,
      commentPropName: '#comment',
      textNodeName: '#text',
      trimValues: false,
      parseTagValue: false,
      parseAttributeValue: false
    })
  }

  /**
   * 解析 CBETA XML 文件
   */
  parse(filePath: string): CbetaDocument {
    const xml = readFileSync(filePath, 'utf-8')
    const parsed = this.parser.parse(xml)

    const teiRoot = this.findElement(parsed, 'TEI')
    if (!teiRoot) {
      throw new Error('Invalid CBETA XML: missing TEI root element')
    }

    const header = this.extractHeader(teiRoot)
    const body = this.extractBody(teiRoot)

    return {
      id: this.extractDocId(teiRoot),
      header,
      body,
      meta: {
        parsedAt: new Date().toISOString(),
        sourceFile: filePath
      }
    }
  }

  /**
   * 在解析结果中查找指定元素
   */
  private findElement(nodes: any[], tagName: string): any | null {
    for (const node of nodes) {
      const keys = Object.keys(node).filter(k => !k.startsWith(':@'))
      for (const key of keys) {
        if (key === tagName || key.endsWith(`:${tagName}`)) {
          return node
        }
      }
    }
    return null
  }

  /**
   * 获取指定标签在节点中的 key
   */
  private getElementKey(node: any, tagName: string): string | null {
    const keys = Object.keys(node).filter(k => !k.startsWith(':@') && k !== '#text' && k !== '#comment')
    return keys.find(k => k === tagName || k.endsWith(`:${tagName}`)) || null
  }

  /**
   * 获取指定标签的子节点数组
   */
  private getElementChildren(node: any | null, tagName: string): any[] {
    if (!node) return []
    const key = this.getElementKey(node, tagName)
    if (!key) return []
    const children = node[key]
    return Array.isArray(children) ? children : []
  }

  /**
   * 递归查找所有匹配的元素节点
   */
  private findElements(nodes: any[], tagName: string): any[] {
    const results: any[] = []
    for (const node of nodes) {
      if (typeof node === 'string') continue
      if (node['#text'] !== undefined || node['#comment'] !== undefined) continue

      const keys = Object.keys(node).filter(k => !k.startsWith(':@') && k !== '#text' && k !== '#comment')
      for (const key of keys) {
        if (key === tagName || key.endsWith(`:${tagName}`)) {
          results.push(node)
        }
        const children = node[key]
        if (Array.isArray(children)) {
          results.push(...this.findElements(children, tagName))
        }
      }
    }
    return results
  }

  /**
   * 提取节点树中的纯文本
   */
  private extractTextFromNodes(nodes: any[]): string {
    let text = ''
    for (const node of nodes) {
      if (typeof node === 'string') {
        text += node
        continue
      }
      if (node['#text'] !== undefined) {
        text += node['#text']
        continue
      }
      if (node['#comment'] !== undefined) {
        continue
      }
      const keys = Object.keys(node).filter(k => !k.startsWith(':@') && k !== '#text' && k !== '#comment')
      for (const key of keys) {
        const children = node[key]
        if (Array.isArray(children)) {
          text += this.extractTextFromNodes(children)
        }
      }
    }
    return text
  }

  /**
   * 规范化 header 文本
   */
  private normalizeHeaderText(text: string): string {
    return text.replace(/\s+/g, ' ').trim()
  }

  /**
   * 读取属性值
   */
  private getAttr(node: any, name: string): string | undefined {
    const attrs = node[':@'] || {}
    const value = attrs[`@_${name}`]
    return typeof value === 'string' ? value : undefined
  }

  /**
   * 提取指定元素的文本内容
   */
  private extractTextFromElement(node: any, tagName: string): string {
    const children = this.getElementChildren(node, tagName)
    return this.normalizeHeaderText(this.extractTextFromNodes(children))
  }

  /**
   * 选择最合适的标题
   */
  private pickTitleFromNodes(titleNodes: any[]): string {
    const candidates = titleNodes
      .map(node => {
        const text = this.extractTextFromElement(node, 'title')
        const level = this.getAttr(node, 'level') || ''
        const lang = this.getAttr(node, 'xml:lang') || this.getAttr(node, 'lang') || ''
        return { text, level, lang }
      })
      .filter(item => item.text)

    const isZh = (lang: string) => lang.toLowerCase().startsWith('zh')
    const pick = (items: typeof candidates) => (items.length > 0 ? items[0].text : '')

    return (
      pick(candidates.filter(item => item.level === 'm' && isZh(item.lang))) ||
      pick(candidates.filter(item => item.level === 'm')) ||
      pick(candidates.filter(item => isZh(item.lang))) ||
      pick(candidates)
    )
  }

  /**
   * 选择藏经系列标题作为来源
   */
  private pickSeriesTitleFromNodes(titleNodes: any[]): string {
    const candidates = titleNodes
      .map(node => {
        const text = this.extractTextFromElement(node, 'title')
        const level = this.getAttr(node, 'level') || ''
        const lang = this.getAttr(node, 'xml:lang') || this.getAttr(node, 'lang') || ''
        return { text, level, lang }
      })
      .filter(item => item.text)

    const isZh = (lang: string) => lang.toLowerCase().startsWith('zh')
    const pick = (items: typeof candidates) => (items.length > 0 ? items[0].text : '')

    return (
      pick(candidates.filter(item => item.level === 's' && isZh(item.lang))) ||
      pick(candidates.filter(item => item.level === 's')) ||
      ''
    )
  }

  /**
   * 合并去重文本
   */
  private joinUnique(texts: string[]): string {
    const unique = [...new Set(texts.map(text => text.trim()).filter(Boolean))]
    return unique.join('; ')
  }

  /**
   * 提取作者信息
   */
  private extractAuthorFromNodes(nodes: any[]): string {
    if (nodes.length === 0) return ''

    const authorNodes = this.findElements(nodes, 'author')
    const authorTexts = authorNodes
      .map(node => this.extractTextFromElement(node, 'author'))
      .filter(Boolean)
    const author = this.joinUnique(authorTexts)
    if (author) return author

    const respStmtNodes = this.findElements(nodes, 'respStmt')
    const respNames: string[] = []
    for (const respStmt of respStmtNodes) {
      const respChildren = this.getElementChildren(respStmt, 'respStmt')
      const nameNodes = this.findElements(respChildren, 'name')
      const persNameNodes = this.findElements(respChildren, 'persName')
      respNames.push(
        ...nameNodes.map(node => this.extractTextFromElement(node, 'name')).filter(Boolean),
        ...persNameNodes.map(node => this.extractTextFromElement(node, 'persName')).filter(Boolean)
      )
    }
    return this.joinUnique(respNames)
  }

  /**
   * 提取文档 ID
   */
  private extractDocId(teiRoot: any): string {
    const attrs = teiRoot[':@'] || {}
    return attrs['@_xml:id'] || 'unknown'
  }

  /**
   * 提取 header 信息
   */
  private extractHeader(teiRoot: any): CbetaDocument['header'] {
    const emptyHeader = {
      title: '',
      author: undefined,
      source: undefined
    }

    const teiKey = this.getElementKey(teiRoot, 'TEI')
    if (!teiKey) return emptyHeader

    const teiChildren = Array.isArray(teiRoot[teiKey]) ? teiRoot[teiKey] : []
    const headerNode = this.findElement(teiChildren, 'teiHeader')
    if (!headerNode) return emptyHeader

    const headerChildren = this.getElementChildren(headerNode, 'teiHeader')
    const fileDescNode = this.findElement(headerChildren, 'fileDesc')
    if (!fileDescNode) return emptyHeader

    const fileDescChildren = this.getElementChildren(fileDescNode, 'fileDesc')
    const titleStmtNode = this.findElement(fileDescChildren, 'titleStmt')
    const titleStmtChildren = titleStmtNode ? this.getElementChildren(titleStmtNode, 'titleStmt') : []
    const titleNodes = titleStmtChildren.length > 0 ? this.findElements(titleStmtChildren, 'title') : []
    const title = this.pickTitleFromNodes(titleNodes)

    const author = this.extractAuthorFromNodes(titleStmtChildren)

    let source = ''
    const sourceDescNode = this.findElement(fileDescChildren, 'sourceDesc')
    if (sourceDescNode) {
      source = this.extractTextFromElement(sourceDescNode, 'sourceDesc')
    }
    if (!source && titleNodes.length > 0) {
      source = this.pickSeriesTitleFromNodes(titleNodes)
    }

    return {
      title,
      author: author || undefined,
      source: source || undefined
    }
  }

  /**
   * 提取 body 内容，保持树结构
   */
  private extractBody(teiRoot: any): CbetaElement[] {
    const teiKey = Object.keys(teiRoot).find(k => k === 'TEI' || k.endsWith(':TEI'))
    if (!teiKey) return []

    const teiChildren = teiRoot[teiKey]
    const textNode = this.findElement(teiChildren, 'text')
    if (!textNode) return []

    const textKey = Object.keys(textNode).find(k => k === 'text' || k.endsWith(':text'))
    if (!textKey) return []

    const textChildren = textNode[textKey]
    const bodyNode = this.findElement(textChildren, 'body')
    if (!bodyNode) return []

    const bodyKey = Object.keys(bodyNode).find(k => k === 'body' || k.endsWith(':body'))
    if (!bodyKey) return []

    return this.convertNodes(bodyNode[bodyKey])
  }

  /**
   * 将 fast-xml-parser 的节点转换为 CbetaElement
   */
  private convertNodes(nodes: any[]): (CbetaElement | string)[] {
    const result: (CbetaElement | string)[] = []

    for (const node of nodes) {
      if (typeof node === 'string') {
        result.push(node)
        continue
      }

      // 处理文本节点
      if ('#text' in node) {
        const text = node['#text']
        if (text !== undefined && text !== null) {
          result.push(String(text))
        }
        continue
      }

      // 处理元素节点
      const tagKeys = Object.keys(node).filter(k => !k.startsWith(':@') && k !== '#text')
      for (const tagKey of tagKeys) {
        const { ns, tag } = this.parseTagName(tagKey)
        const attrs = this.extractAttrs(node[':@'] || {})
        const children = Array.isArray(node[tagKey])
          ? this.convertNodes(node[tagKey])
          : []

        result.push({
          tag,
          ns,
          attrs,
          children
        })
      }
    }

    return result
  }

  /**
   * 解析标签名，提取命名空间前缀
   */
  private parseTagName(tagKey: string): { ns?: 'tei' | 'cb', tag: string } {
    if (tagKey.startsWith('cb:')) {
      return { ns: 'cb', tag: tagKey.slice(3) }
    }
    if (tagKey.startsWith('tei:')) {
      return { ns: 'tei', tag: tagKey.slice(4) }
    }
    // 默认是 tei 命名空间
    return { ns: 'tei', tag: tagKey }
  }

  /**
   * 提取属性，简化属性名
   */
  private extractAttrs(rawAttrs: Record<string, string>): Record<string, string> {
    const attrs: Record<string, string> = {}

    for (const [key, value] of Object.entries(rawAttrs)) {
      if (!key.startsWith('@_')) continue

      let attrName = key.slice(2) // 移除 @_ 前缀

      // 简化 xml:id 等常见属性
      if (attrName === 'xml:id') {
        attrs['id'] = value
      } else if (attrName === 'xml:lang') {
        attrs['lang'] = value
      } else {
        attrs[attrName] = value
      }
    }

    return attrs
  }
}
