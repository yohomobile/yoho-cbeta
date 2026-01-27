export type InlineNode =
  | { type: 'text'; text: string }
  | { type: 'noteRef'; index: number }
  | { type: 'variantRef'; index: number }
  | { type: 'gaiji'; ref?: string }
  | { type: 'foreign'; lang?: string; inlines: InlineNode[] }
  | { type: 'inlineGroup'; items: { lang?: string; place?: string; inlines: InlineNode[] }[] }
  | { type: 'marker'; kind: 'lb' | 'pb'; label?: string; ed?: string; id?: string }
  | { type: 'caesura' }
  | { type: 'anchor'; id: string }
  | { type: 'emph'; inlines: InlineNode[]; rend?: string }
  | { type: 'term'; inlines: InlineNode[] }
  | { type: 'ref'; target?: string; inlines: InlineNode[] }
  | { type: 'sanskritRuby'; text: string }
  | { type: 'sanskritMarker'; text: string; chinese: string }

export type Block =
  | { type: 'paragraph'; inlines: InlineNode[]; id?: string }
  | { type: 'verse'; lines: InlineNode[][]; id?: string }
  | { type: 'heading'; text: string; level?: string; kind?: string }
  | { type: 'byline'; text: string }
  | { type: 'docNumber'; text: string }
  | { type: 'juan'; label: string }
  | { type: 'milestone'; label: string }
  | { type: 'list'; items: InlineNode[][]; markerless?: boolean }
  | { type: 'table'; rows: InlineNode[][][] }
  | { type: 'marker'; markers: InlineNode[] }

export type NoteItem = {
  id?: string
  text: string
  type?: string
  resp?: string
  place?: string
}

export type VariantItem = {
  id?: string
  lemma: string
  readings: { text: string; wit?: string; resp?: string }[]
}

export type Chapter = {
  id?: string
  title: string
  level?: number
  juanNumber?: number
  blocks: Block[]
  notes: NoteItem[]
  variants: VariantItem[]
}

export type VersionInfo = {
  id: string
  name: string
  note: string
  sourcePath: string
}

export type ClassicCatalog = {
  id: string
  title: string
  alias: string
  era: string
  translator: string
  category: string
  length: string
  status: string
  excerpt: string
  tone: string
  href: string
  sectionLabel: string
  annotations: string[]
  versions: VersionInfo[]
  defaultVersionId: string
}

export type Classic = ClassicCatalog & {
  chapters: Chapter[]
  juanChapters?: Chapter[]
  pinChapters?: Chapter[]
  currentVersionId: string
  // 从数据库获取的扩展元数据
  meta?: SutraMeta
}

// 从数据库 API 返回的元数据
export type SutraPerson = {
  id: number
  name: string
  aliases?: string
  dynasty_id?: string
  nationality?: string
  identity?: string
  bio?: string
  role_type: string
  role_raw?: string
  sort_order: number
}

// JSONB 存储的 persons 字段格式
export type SutraPersonJsonb = {
  name: string
  role?: string
  aliases?: string | null
  dynasty?: string
  identity?: string | null
  roleType?: string
  dynastyId?: string
  nationality?: string | null
}

export type SutraRelation = {
  relation_type: string
  relation_subtype?: string
  confidence?: number
  source?: string
  related_text_id: string
  related_title: string
  related_juan_count?: number
  related_author_raw?: string
}

export type SutraTranslationGroup = {
  id: number
  base_title: string
  texts: Array<{
    id: string
    title: string
    juan_count?: number
    translation_dynasty?: string
    author_raw?: string
  }>
}

export type SutraMeta = {
  id: string
  canon_id?: string
  volume?: string
  number?: string
  title: string
  title_source?: string
  title_raw?: string
  title_traditional?: string
  title_sanskrit?: string
  title_pali?: string
  title_alt?: string
  source_text?: string
  category_id?: string
  byline_raw?: string
  author_raw?: string
  persons?: SutraPersonJsonb[]
  translation_dynasty?: string
  translation_dynasty_id?: string
  juan_count?: number
  page_start?: string
  page_end?: string
  doc_number?: string
  has_verse?: boolean
  has_dharani?: boolean
  content_type?: string
  relatedPersons?: SutraPerson[]
  relations?: SutraRelation[]
  translationGroup?: SutraTranslationGroup | null
}

// 人物详情页数据
export type PersonWork = {
  id: string
  title: string
  title_traditional?: string
  author_raw?: string
  translation_dynasty?: string
  juan_count?: number
  content_type?: string
  category_id?: string
  role_type: string
  role_raw?: string
}

export type PersonDetail = {
  id: number
  name: string
  aliases?: string
  dynasty_id?: string
  dynasty_name?: string
  nationality?: string
  identity?: string
  bio?: string
  works: PersonWork[]
}
