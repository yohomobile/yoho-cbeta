/**
 * CBETA 数据库 Schema (PostgreSQL)
 */

import { pgTable, text, integer, serial, varchar, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core'

/**
 * 朝代表
 * 存储中国历史朝代及相关信息
 */
export const dynasties = pgTable('dynasties', {
  /** 朝代ID (如 tang, song, ming) */
  id: varchar('id', { length: 32 }).primaryKey(),
  /** 朝代名称 (如 唐、宋、明) */
  name: varchar('name', { length: 32 }).notNull(),
  /** 朝代别名 (JSON 数组，如 ["姚秦", "后秦"]) */
  aliases: text('aliases'),
  /** 起始年份 (负数表示公元前) */
  startYear: integer('start_year'),
  /** 结束年份 */
  endYear: integer('end_year'),
  /** 时代分类 (如 秦汉、魏晋南北朝、隋唐五代、宋元、明清、近现代、外国) */
  era: varchar('era', { length: 32 }),
  /** 排序权重 (用于时间排序) */
  sortOrder: integer('sort_order').notNull().default(0),
  /** 备注 */
  notes: text('notes'),
})

/**
 * 人物表
 * 存储译经师、论师、作者等佛教人物
 */
export const persons = pgTable('persons', {
  /** 人物ID (自动生成) */
  id: serial('id').primaryKey(),
  /** 人物主要名称 */
  name: varchar('name', { length: 128 }).notNull(),
  /** 别名 (JSON 数组) */
  aliases: text('aliases'),
  /** 所属朝代ID */
  dynastyId: varchar('dynasty_id', { length: 32 }).references(() => dynasties.id),
  /** 国籍 (用于外国人物) */
  nationality: varchar('nationality', { length: 64 }),
  /** 身份 (如 菩萨、比丘、法师、居士) */
  identity: varchar('identity', { length: 64 }),
  /** 简介 */
  bio: text('bio'),
})

/**
 * 经文表
 * 存储佛经元数据和内容
 */
export const texts = pgTable('texts', {
  /** 经文ID (如 T30n1579) */
  id: varchar('id', { length: 32 }).primaryKey(),
  /** 藏经集合ID (如 T, X, J) */
  canonId: varchar('canon_id', { length: 16 }),
  /** 卷号 */
  volume: varchar('volume', { length: 16 }),
  /** 编号 */
  number: varchar('number', { length: 16 }),
  /** 标题（简体） */
  title: text('title').notNull(),
  /** 标题来源 */
  titleSource: varchar('title_source', { length: 32 }),
  /** 原始标题 */
  titleRaw: text('title_raw'),
  /** 繁体标题 */
  titleTraditional: text('title_traditional'),
  /** 梵文标题 */
  titleSanskrit: text('title_sanskrit'),
  /** 巴利文标题 */
  titlePali: text('title_pali'),
  /** 别名 */
  titleAlt: text('title_alt'),
  /** 来源文本 */
  sourceText: varchar('source_text', { length: 128 }),
  /** 分类ID */
  categoryId: varchar('category_id', { length: 64 }),
  /** 署名行原文 */
  bylineRaw: text('byline_raw'),
  /** 作者行原文 */
  authorRaw: text('author_raw'),
  /** 人物信息 (JSONB) */
  persons: text('persons'),
  /** 翻译朝代 */
  translationDynasty: varchar('translation_dynasty', { length: 32 }),
  /** 翻译朝代ID */
  translationDynastyId: varchar('translation_dynasty_id', { length: 32 }),
  /** 卷数 */
  juanCount: integer('juan_count'),
  /** 起始页码 */
  pageStart: varchar('page_start', { length: 16 }),
  /** 结束页码 */
  pageEnd: varchar('page_end', { length: 16 }),
  /** 文档编号 */
  docNumber: text('doc_number'),
  /** 解析后的文档编号 (JSONB) */
  docNumberParsed: text('doc_number_parsed'),
  /** 是否包含偈颂 */
  hasVerse: integer('has_verse'),
  /** 是否包含陀罗尼 */
  hasDharani: integer('has_dharani'),
  /** 内容类型 */
  contentType: varchar('content_type', { length: 32 }),
  /** 经文类型 (经/律/论/注疏/仪轨/其他) - 根据标题后缀判断 */
  textType: varchar('text_type', { length: 16 }),
  /** 目录结构 (JSONB) */
  toc: text('toc'),
  // body_simplified 和 body_traditional 已迁移到 text_juans 表并从数据库删除
  /** 源文件哈希 */
  sourceHash: varchar('source_hash', { length: 64 }),
  /** 解析时间 */
  parsedAt: text('parsed_at'),
})

/**
 * 经文-人物关联表
 * 记录人物与经文的关系（译、撰、注等）
 */
export const textPersons = pgTable('text_persons', {
  id: serial('id').primaryKey(),
  /** 经文ID */
  textId: varchar('text_id', { length: 32 }).notNull().references(() => texts.id),
  /** 人物ID */
  personId: integer('person_id').notNull().references(() => persons.id),
  /** 角色类型 (translator, author, compiler, commentator, recorder, editor, speaker) */
  roleType: varchar('role_type', { length: 32 }).notNull(),
  /** 原始角色文字 (如 译、撰、注) */
  roleRaw: varchar('role_raw', { length: 32 }),
  /** 排序 */
  sortOrder: integer('sort_order').notNull().default(0),
})

/**
 * 经文关系表
 * 存储经文之间的关系（注疏、相关、别译等）
 */
export const textRelations = pgTable('text_relations', {
  id: serial('id').primaryKey(),
  /** 源经文ID */
  sourceTextId: varchar('source_text_id', { length: 32 }).notNull().references(() => texts.id),
  /** 目标经文ID */
  targetTextId: varchar('target_text_id', { length: 32 }).notNull().references(() => texts.id),
  /** 关系类型 (commentary, related, translation) */
  relationType: varchar('relation_type', { length: 32 }).notNull(),
  /** 关系子类型 (如注疏类型: 经疏、玄义、文句、科注等；相关类型: 相关、别译) */
  relationSubtype: varchar('relation_subtype', { length: 32 }),
  /** 置信度 (0-1, 来自自动匹配的置信度) */
  confidence: integer('confidence'),
  /** 数据来源 (rule:docNumber, rule:title_suffix, manual 等) */
  source: varchar('source', { length: 64 }),
})

/**
 * 异译组表
 * 存储同一部经的不同翻译版本
 */
export const translationGroups = pgTable('translation_groups', {
  id: serial('id').primaryKey(),
  /** 基础标题 (如 "金刚经") */
  baseTitle: text('base_title').notNull(),
  /** 数据来源 */
  source: varchar('source', { length: 64 }),
})

/**
 * 异译组-经文关联表
 */
export const translationGroupTexts = pgTable('translation_group_texts', {
  id: serial('id').primaryKey(),
  /** 异译组ID */
  groupId: integer('group_id').notNull().references(() => translationGroups.id),
  /** 经文ID */
  textId: varchar('text_id', { length: 32 }).notNull().references(() => texts.id),
  /** 排序 */
  sortOrder: integer('sort_order').notNull().default(0),
})

/**
 * 分卷内容表
 * 将经文正文按卷拆分存储，提升查询性能
 */
export const textJuans = pgTable('text_juans', {
  id: serial('id').primaryKey(),
  /** 经文ID */
  textId: varchar('text_id', { length: 32 }).notNull().references(() => texts.id, { onDelete: 'cascade' }),
  /** 卷号 (1-based) */
  juan: integer('juan').notNull(),
  /** 简体正文 (JSONB 数组) */
  contentSimplified: jsonb('content_simplified'),
  /** 繁体正文 (JSONB 数组) */
  contentTraditional: jsonb('content_traditional'),
}, (table) => [
  uniqueIndex('text_juans_text_id_juan_idx').on(table.textId, table.juan),
  index('text_juans_text_id_idx').on(table.textId),
])

/**
 * 词典条目表
 * 存储佛学词典词条
 */
export const dictionaryEntries = pgTable('dictionary_entries', {
  id: serial('id').primaryKey(),
  /** 词条 */
  term: varchar('term', { length: 500 }).notNull(),
  /** 简体词条 */
  termSimplified: varchar('term_simplified', { length: 500 }),
  /** 释义 (HTML) */
  definition: text('definition').notNull(),
  /** 释义纯文本 (用于搜索) */
  definitionText: text('definition_text'),
  /** 来源词典 */
  source: varchar('source', { length: 100 }).notNull(),
}, (table) => [
  uniqueIndex('dictionary_entries_term_source_idx').on(table.term, table.source),
  index('dictionary_entries_term_idx').on(table.term),
  index('dictionary_entries_source_idx').on(table.source),
])

/**
 * 术语同义词表
 * 存储佛学术语的同义词关系，用于查询扩展
 */
export const termSynonyms = pgTable('term_synonyms', {
  id: serial('id').primaryKey(),
  /** 标准词条（主词） */
  canonicalTerm: varchar('canonical_term', { length: 500 }).notNull(),
  /** 同义词 */
  synonym: varchar('synonym', { length: 500 }).notNull(),
  /** 实体类型 (term=术语, text=经文, person=人物) */
  entityType: varchar('entity_type', { length: 32 }).notNull().default('term'),
  /** 关联的实体ID (如经文的 textId) */
  entityId: varchar('entity_id', { length: 32 }),
  /** 关系类型 (exact=完全同义, related=相关概念, abbreviation=缩写) */
  relationType: varchar('relation_type', { length: 32 }).notNull().default('exact'),
  /** 优先级（数字越大优先级越高） */
  priority: integer('priority').notNull().default(0),
  /** 数据来源 (manual=手工, dict=词典提取, ai=AI生成) */
  source: varchar('source', { length: 100 }),
  /** 备注 */
  notes: text('notes'),
}, (table) => [
  uniqueIndex('term_synonyms_canonical_synonym_idx').on(table.canonicalTerm, table.synonym),
  index('term_synonyms_synonym_idx').on(table.synonym),
  index('term_synonyms_entity_type_idx').on(table.entityType),
  index('term_synonyms_priority_idx').on(table.priority),
])

// 类型导出
export type DictionaryEntry = typeof dictionaryEntries.$inferSelect
export type NewDictionaryEntry = typeof dictionaryEntries.$inferInsert
export type TermSynonym = typeof termSynonyms.$inferSelect
export type NewTermSynonym = typeof termSynonyms.$inferInsert
export type Dynasty = typeof dynasties.$inferSelect
export type NewDynasty = typeof dynasties.$inferInsert
export type Person = typeof persons.$inferSelect
export type NewPerson = typeof persons.$inferInsert
export type Text = typeof texts.$inferSelect
export type NewText = typeof texts.$inferInsert
export type TextPerson = typeof textPersons.$inferSelect
export type NewTextPerson = typeof textPersons.$inferInsert
export type TextRelation = typeof textRelations.$inferSelect
export type NewTextRelation = typeof textRelations.$inferInsert
export type TranslationGroup = typeof translationGroups.$inferSelect
export type NewTranslationGroup = typeof translationGroups.$inferInsert
export type TranslationGroupText = typeof translationGroupTexts.$inferSelect
export type NewTranslationGroupText = typeof translationGroupTexts.$inferInsert
export type TextJuan = typeof textJuans.$inferSelect
export type NewTextJuan = typeof textJuans.$inferInsert
