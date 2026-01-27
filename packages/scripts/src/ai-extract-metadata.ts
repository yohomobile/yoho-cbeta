/**
 * AI 增强元数据提取
 * 从 parsed/ 目录读取规则解析结果，用 AI 处理 byline（人物、朝代、年号、地点）
 *
 * 规则已处理：标题、卷数、页码、目录、特征、docNumber、梵文/巴利文
 * AI 处理：byline（人物识别、朝代、年号、地点、协作关系）
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join, dirname, relative } from 'path'

// ==================== AI 模型提供商配置 ====================
// 支持: 'minimax' (MiniMax-M2.1) / 'zhipu' (GLM-4) / 'zhipu-flash' (GLM-4-Flash)
// 通过环境变量 AI_PROVIDER 设置，默认 minimax

type AIProvider = 'minimax' | 'zhipu' | 'zhipu-flash'

const getProvider = (): AIProvider => {
  const provider = (process.env.AI_PROVIDER || 'minimax').toLowerCase() as AIProvider
  if (['minimax', 'zhipu', 'zhipu-flash'].includes(provider)) {
    return provider
  }
  return 'minimax'
}

// MiniMax 配置
const MINIMAX_API_URL = 'https://api.minimax.io/v1/chat/completions'
const MINIMAX_MODEL = 'MiniMax-M2.1'
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || ''

// Zhipu (智谱 AI) 配置
const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
const ZHIPU_MODEL = process.env.ZHIPU_MODEL || 'glm-4.7'  // 默认 glm-4.7
const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY || ''

// ==================== 类型定义 ====================

interface ParsedMetadata {
  id: string
  canonId: string
  volume: string
  number: string
  title: string
  titleRaw: string
  titleSource: 'jhead' | 'head' | 'filename'
  titleSanskrit: string | null
  titlePali: string | null
  bylineRaw: string | null
  juanCount: number
  pageStart: string | null
  pageEnd: string | null
  toc: Array<{ level: number; type: string; title: string; juanNumber: number | null }>
  hasDharani: boolean
  hasVerse: boolean
  contentType: string | null
  docNumber: string | null
  docNumberParsed: string[]
  parsedAt: string
  sourceHash: string
}

interface AIResult {
  // 人物信息（从 byline 解析）
  persons: Array<{
    name: string
    nameTraditional: string
    dynasty: string
    dynastyTraditional: string
    nationality: string
    nationalityTraditional: string
    identity: string
    identityTraditional: string
    title: string
    titleTraditional: string
  }>
  // 贡献者（经典-人物关联）
  contributors: Array<{
    name: string
    role: 'translator' | 'author' | 'compiler' | 'commentator' | 'recorder' | 'scribe' | 'editor' | 'collaborator'
    roleText: string
    isPrimary: boolean
    position: number
  }>
  // 翻译信息
  translationDynasty: string | null
  translationEra: string | null
  translationEraTraditional: string | null
  translationPlace: string | null
  translationPlaceTraditional: string | null
  // 协作关系
  collaboration: {
    type: 'joint_translation' | 'main_assistant' | 'division' | null
    persons: Array<{ name: string; role: string }>
    rawText: string
  }
  // 经典关系
  relations: Array<{
    relationType: 'same_origin' | 'commentary' | 'continuation' | 'reference' | 'parallel'
    targetHint: string
    rawText: string
  }>
}

const EXTRACT_TOOL = {
  type: 'function' as const,
  function: {
    name: 'save_byline_extraction',
    description: '保存从 byline 中提取的结构化信息',
    parameters: {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: '文档ID' },
              // 翻译信息
              translationDynasty: {
                type: 'string',
                description: '翻译朝代ID：han-later/wu/wei-cao/jin-west/jin-east/qin-former/qin-later/liang-n/liang-s/chen/sui/tang/song/yuan/ming/qing'
              },
              translationEra: { type: 'string', description: '翻译年号（简体）' },
              translationEraTraditional: { type: 'string', description: '翻译年号（繁体）' },
              translationPlace: { type: 'string', description: '翻译地点（简体）' },
              translationPlaceTraditional: { type: 'string', description: '翻译地点（繁体）' },
              // 人物
              persons: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: '人名（简体）' },
                    nameTraditional: { type: 'string', description: '人名（繁体）' },
                    dynasty: { type: 'string', description: '朝代（简体）' },
                    dynastyTraditional: { type: 'string', description: '朝代（繁体）' },
                    nationality: { type: 'string', description: '国籍（简体）：天竺/龟兹/月支/康居/安息/于阗/中土' },
                    nationalityTraditional: { type: 'string', description: '国籍（繁体）' },
                    identity: { type: 'string', description: '身份（简体）：僧侣/居士/法师/三藏/沙门' },
                    identityTraditional: { type: 'string', description: '身份（繁体）' },
                    title: { type: 'string', description: '头衔（简体）：三藏法师/大德/国师' },
                    titleTraditional: { type: 'string', description: '头衔（繁体）' }
                  },
                  required: ['name', 'nameTraditional']
                }
              },
              // 贡献者
              contributors: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    role: { type: 'string', enum: ['translator', 'author', 'compiler', 'commentator', 'recorder', 'scribe', 'editor', 'collaborator'] },
                    roleText: { type: 'string', description: '原文角色字' },
                    isPrimary: { type: 'boolean' },
                    position: { type: 'number' }
                  },
                  required: ['name', 'role', 'isPrimary', 'position']
                }
              },
              // 协作关系
              collaboration: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['joint_translation', 'main_assistant', 'division'] },
                  persons: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, role: { type: 'string' } } } },
                  rawText: { type: 'string' }
                }
              },
              // 经典关系
              relations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    relationType: { type: 'string', enum: ['same_origin', 'commentary', 'continuation', 'reference', 'parallel'] },
                    targetHint: { type: 'string' },
                    rawText: { type: 'string' }
                  }
                }
              }
            },
            required: ['id']
          }
        }
      },
      required: ['results']
    }
  }
}

// ==================== AI 调用 ====================

async function callAI(items: Array<{ id: string; byline: string; docNumber: string | null }>): Promise<Map<string, AIResult>> {
  const results = new Map<string, AIResult>()

  if (items.length === 0) return results

  const provider = getProvider()
  console.log(`[AI] 使用提供商: ${provider}`)

  const prompt = `## Byline 解析任务

从以下 ${items.length} 条佛经 byline 中提取结构化信息。

${items.map(item => `
### ${item.id}
- Byline: ${item.byline || '(无)'}
- DocNumber: ${item.docNumber || '(无)'}
`).join('\n')}

## 解析要求

### 1. 翻译信息
从 byline 中提取：
- **translationDynasty**: 朝代ID (han-later/wu/wei-cao/jin-west/jin-east/qin-former/qin-later/liang-n/liang-s/chen/sui/tang/song/yuan/ming/qing)
- **translationEra/translationEraTraditional**: 年号（简/繁）
- **translationPlace/translationPlaceTraditional**: 地点（简/繁）

### 2. 人物识别
从 byline 中识别所有人物（必须去重）：
- **name/nameTraditional**: 人名（简/繁）
- **dynasty/dynastyTraditional**: 朝代（简/繁）
- **nationality/nationalityTraditional**: 国籍（简/繁：天竺、龟兹/龜茲、月支、康居、安息、于闐/于阗、中土）
- **identity/identityTraditional**: 身份（简/繁：僧侣/僧侶、沙门/沙門、居士、法师/法師、三藏）
- **title/titleTraditional**: 头衔（简/繁：三藏法师/三藏法師、大德、国师/國師）

### 3. 贡献者关联
- **role**: translator/author/compiler/commentator/recorder/scribe/editor/collaborator
- **roleText**: 原文中的角色字（譯/造/撰/述/集/錄/校/筆受）
- **isPrimary**: 主要贡献者（通常是译者）
- **position**: 排序位置

### 4. 协作关系
如果有"共译"、"多人合作"等，提取协作类型和角色分工。

### 5. 经典关系
从 docNumber 中提取关联经典：
- **relationType**: same_origin (同本异译) / commentary (注疏) / continuation (续编) / reference (引用) / parallel (平行)
- **targetHint**: 目标经典提示（如 "No. 695"）

## 重要规则

1. **严格去重**：同一人名只能出现一次
2. **字段完整性**：每个字段都需要简体和繁体两个版本
3. **不要推断**：如果没有明确信息，不要填写
4. **byline 为空时**：persons 和 contributors 为空数组

请调用 save_byline_extraction 函数保存结果。`

  const MAX_RETRIES = 3

  for (let retry = 0; retry < MAX_RETRIES; retry++) {
    try {
      let response: Response

      if (provider === 'zhipu' || provider === 'zhipu-flash') {
        // Zhipu GLM API (兼容 OpenAI 格式)
        response = await fetch(ZHIPU_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ZHIPU_API_KEY}`
          },
          body: JSON.stringify({
            model: ZHIPU_MODEL,
            messages: [{ role: 'user', content: prompt }],
            tools: [EXTRACT_TOOL],
            tool_choice: { type: 'function', function: { name: 'save_byline_extraction' } },
            temperature: 0.2,
            max_tokens: 16000
          })
        })
      } else {
        // MiniMax API (默认)
        response = await fetch(MINIMAX_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MINIMAX_API_KEY}`
          },
          body: JSON.stringify({
            model: MINIMAX_MODEL,
            messages: [{ role: 'user', content: prompt }],
            tools: [EXTRACT_TOOL],
            tool_choice: { type: 'function', function: { name: 'save_byline_extraction' } },
            temperature: 0.2,
            max_tokens: 16000
          })
        })
      }

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[AI] ${provider} API error (attempt ${retry + 1}):`, response.status, errorText.substring(0, 500))
        if (retry < MAX_RETRIES - 1) {
          await new Promise(r => setTimeout(r, (retry + 1) * 2000))
          continue
        }
        throw new Error(`${provider} API error: ${response.status}`)
      }

      const result = await response.json() as any
      const firstChoice = result.choices && result.choices[0]
      const toolCalls = firstChoice && firstChoice.message && firstChoice.message.tool_calls

      if (toolCalls && toolCalls.length > 0) {
        for (const call of toolCalls) {
          if (call.function?.name === 'save_byline_extraction' && call.function.arguments) {
            try {
              const args = JSON.parse(call.function.arguments)
              const parsedResults = typeof args.results === 'string' ? JSON.parse(args.results) : args.results

              if (Array.isArray(parsedResults)) {
                for (const item of parsedResults) {
                  if (item?.id) {
                    results.set(item.id, {
                      translationDynasty: item.translationDynasty || null,
                      translationEra: item.translationEra || null,
                      translationEraTraditional: item.translationEraTraditional || null,
                      translationPlace: item.translationPlace || null,
                      translationPlaceTraditional: item.translationPlaceTraditional || null,
                      persons: item.persons || [],
                      contributors: item.contributors || [],
                      collaboration: item.collaboration || { type: null, persons: [], rawText: '' },
                      relations: item.relations || []
                    })
                  }
                }
              }
            } catch (e) {
              console.error('[AI] Parse error:', e)
            }
          }
        }
      }
      break
    } catch (error) {
      console.error(`[${provider}] Error:`, error)
      if (retry < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, (retry + 1) * 2000))
      }
    }
  }

  return results
}

// ==================== 工具函数 ====================

function getAllJsonFiles(dir: string): string[] {
  const files: string[] = []
  const items = readdirSync(dir)
  for (const item of items) {
    const fullPath = join(dir, item)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      files.push(...getAllJsonFiles(fullPath))
    } else if (item.endsWith('.json') && !item.startsWith('.')) {
      files.push(fullPath)
    }
  }
  return files
}

function loadCache(cacheFile: string): Record<string, string> {
  if (existsSync(cacheFile)) {
    try {
      return JSON.parse(readFileSync(cacheFile, 'utf-8'))
    } catch {
      return {}
    }
  }
  return {}
}

function saveCache(cacheFile: string, cache: Record<string, string>): void {
  writeFileSync(cacheFile, JSON.stringify(cache, null, 2))
}

function parseLimitArg(args: string[]): number {
  const sanitized = args.filter(arg => arg !== '--')
  for (const arg of sanitized) {
    if (arg.startsWith('--limit=')) {
      const n = parseInt(arg.slice(7), 10)
      return Number.isNaN(n) ? 0 : n
    }
  }
  const idx = sanitized.findIndex(a => a === '--limit' || a === '-l')
  if (idx >= 0 && sanitized[idx + 1]) {
    const n = parseInt(sanitized[idx + 1], 10)
    return Number.isNaN(n) ? 0 : n
  }
  const num = sanitized.find(a => /^\d+$/.test(a))
  return num ? parseInt(num, 10) : 0
}

// ==================== 主函数 ====================

async function main() {
  const projectRoot = join(import.meta.dirname, '../../..')
  const parsedDir = join(projectRoot, 'parsed')
  const extractedDir = join(import.meta.dirname, '../extracted')
  const cacheFile = join(extractedDir, '.ai-cache.json')

  // 显示当前配置
  const provider = getProvider()
  console.log('═'.repeat(60))
  console.log('  AI 元数据提取')
  console.log('═'.repeat(60))
  console.log(`模型提供商: ${provider}`)
  if (provider === 'zhipu' || provider === 'zhipu-flash') {
    console.log(`GLM 模型: ${ZHIPU_MODEL}`)
  } else {
    console.log(`MiniMax 模型: ${MINIMAX_MODEL}`)
  }
  console.log('')

  // 确保输出目录存在
  if (!existsSync(extractedDir)) {
    mkdirSync(extractedDir, { recursive: true })
  }

  // 加载缓存
  const cache = loadCache(cacheFile)
  const newCache: Record<string, string> = {}

  // 获取所有 parsed JSON 文件
  console.log('扫描 parsed 目录...')
  const jsonFiles = getAllJsonFiles(parsedDir)
  console.log(`找到 ${jsonFiles.length} 个文件\n`)

  // 过滤需要处理的文件
  const toProcess: Array<{ path: string; data: ParsedMetadata }> = []

  for (const filePath of jsonFiles) {
    const relPath = relative(parsedDir, filePath)
    const outputPath = join(extractedDir, relPath)

    try {
      const content = readFileSync(filePath, 'utf-8')
      const data: ParsedMetadata = JSON.parse(content)

      // 用 id + byline 作为 hash
      const sourceHash = `${data.id}:${data.bylineRaw || ''}`
      if (cache[data.id] === sourceHash && existsSync(outputPath)) {
        newCache[data.id] = sourceHash
        continue
      }

      toProcess.push({ path: filePath, data })
    } catch (e) {
      console.error(`读取失败: ${relPath}`, e)
    }
  }

  console.log(`需要 AI 处理: ${toProcess.length} 个文件`)
  console.log(`跳过 (已缓存): ${jsonFiles.length - toProcess.length} 个文件`)

  if (toProcess.length === 0) {
    console.log('无需处理')
    return
  }

  // 应用限制
  const args = process.argv.slice(2)
  const limit = parseLimitArg(args)
  const actualToProcess = limit > 0 ? toProcess.slice(0, limit) : toProcess
  if (limit > 0) {
    console.log(`测试模式：只处理前 ${limit} 个\n`)
  }

  // 批量处理
  const BATCH_SIZE = 10
  let processed = 0
  let errors = 0

  for (let i = 0; i < actualToProcess.length; i += BATCH_SIZE) {
    const batch = actualToProcess.slice(i, i + BATCH_SIZE)

    console.log(`处理批次 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(actualToProcess.length / BATCH_SIZE)}...`)

    // 准备 AI 输入
    const aiInput = batch.map(item => ({
      id: item.data.id,
      byline: item.data.bylineRaw || '',
      docNumber: item.data.docNumber
    }))

    // 调用 AI
    const aiResults = await callAI(aiInput)

    // 保存结果
    for (const item of batch) {
      const relPath = relative(parsedDir, item.path)
      const outputPath = join(extractedDir, relPath)

      const aiResult = aiResults.get(item.data.id)

      if (!aiResult) {
        console.warn(`  [跳过] ${item.data.id}: AI 未返回结果`)
        errors++
        continue
      }

      // 合并结果
      const extracted = {
        ...item.data,

        // AI 解析结果
        translationDynasty: aiResult.translationDynasty,
        translationEra: aiResult.translationEra,
        translationEraTraditional: aiResult.translationEraTraditional,
        translationPlace: aiResult.translationPlace,
        translationPlaceTraditional: aiResult.translationPlaceTraditional,
        persons: aiResult.persons,
        contributors: aiResult.contributors,
        collaboration: aiResult.collaboration,
        relations: aiResult.relations,

        // 元数据
        extractedAt: new Date().toISOString()
      }

      // 确保输出目录存在
      const outputDir = dirname(outputPath)
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true })
      }

      writeFileSync(outputPath, JSON.stringify(extracted, null, 2))
      newCache[item.data.id] = `${item.data.id}:${item.data.bylineRaw || ''}`
      processed++
    }

    console.log(`  已处理: ${processed}, 错误: ${errors}`)

    // 保存缓存
    saveCache(cacheFile, { ...cache, ...newCache })

    // 避免 API 限流
    if (i + BATCH_SIZE < actualToProcess.length) {
      await new Promise(r => setTimeout(r, 2000))
    }
  }

  console.log('\n=== 完成 ===')
  console.log(`处理: ${processed}`)
  console.log(`错误: ${errors}`)
}

main().catch(console.error)
