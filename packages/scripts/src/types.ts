/**
 * CBETA 文档类型定义
 */

export interface CbetaElement {
  /** 元素标签名（如 p, lg, note 等） */
  tag: string
  /** 命名空间前缀（tei 或 cb） */
  ns?: 'tei' | 'cb'
  /** 元素属性 */
  attrs: Record<string, string>
  /** 子元素或文本内容 */
  children: (CbetaElement | string)[]
}

export interface CbetaDocument {
  /** 文档 ID */
  id: string
  /** TEI header 信息 */
  header: {
    title: string
    author?: string
    source?: string
  }
  /** 文档正文（保持 XML 树结构） */
  body: CbetaElement[]
  /** 元数据 */
  meta: {
    /** 解析时间 */
    parsedAt: string
    /** 源文件路径 */
    sourceFile: string
  }
}
