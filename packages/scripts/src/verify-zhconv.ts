#!/usr/bin/env tsx
/**
 * 严格校验 TypeScript 版 zhconv 与 Python 版的一致性
 *
 * 校验内容：
 * 1. 单字符转换一致性
 * 2. 词组转换一致性
 * 3. 实际文件转换一致性
 */

import { execSync } from 'child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { toSimplified } from './zhconv.js'

const ZHCONV_PATH = '/home/guang/happy/zhconv'
const DATA_DIR = '/home/guang/happy/yoho-cbeta/data'

/**
 * 用 Python zhconv 转换
 */
function pythonConvert(text: string): string {
  // 转义特殊字符
  const escaped = text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')

  const cmd = `python3 -c "
import sys
sys.path.insert(0, '${ZHCONV_PATH}')
from zhconv import convert
print(convert('${escaped}', 'zh-cn'), end='')
"`

  try {
    return execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 })
  } catch (e) {
    console.error('Python 转换失败:', e)
    return text
  }
}

/**
 * 收集 JSON 中所有字符串
 */
function collectStrings(obj: any, results: string[] = []): string[] {
  if (typeof obj === 'string') {
    results.push(obj)
  } else if (Array.isArray(obj)) {
    for (const item of obj) {
      collectStrings(item, results)
    }
  } else if (obj !== null && typeof obj === 'object') {
    for (const v of Object.values(obj)) {
      collectStrings(v, results)
    }
  }
  return results
}

/**
 * 递归查找 JSON 文件
 */
function findJsonFiles(dir: string, files: string[] = [], limit = 100): string[] {
  if (files.length >= limit) return files

  const entries = readdirSync(dir)
  for (const entry of entries) {
    if (files.length >= limit) break
    if (entry.startsWith('.')) continue

    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      findJsonFiles(fullPath, files, limit)
    } else if (entry.endsWith('.json')) {
      files.push(fullPath)
    }
  }
  return files
}

async function main() {
  console.log('=== zhconv 严格校验 ===\n')

  let totalTests = 0
  let passedTests = 0
  let failedTests = 0
  const failures: { text: string; expected: string; actual: string }[] = []

  // ========== 1. 单字符测试 ==========
  console.log('1. 单字符转换测试...')

  const singleChars = [
    '說', '經', '義', '譯', '輪', '師', '門', '詔', '寶', '賜',
    '爾', '時', '無', '勝', '諦', '聞', '間', '開', '關', '問',
    '學', '習', '練', '導', '國', '際', '網', '絡', '電', '話',
    '號', '碼', '視', '頻', '圖', '書', '館', '歷', '史', '發',
    '尒', '鼈', '麼', '幹', '體', '內', '計', '算', '機', '軟',
    // 特殊字符
    '㊀', '㊁', '㊂', '①', '②', '③',
  ]

  for (const char of singleChars) {
    const expected = pythonConvert(char)
    const actual = toSimplified(char)
    totalTests++

    if (expected === actual) {
      passedTests++
    } else {
      failedTests++
      failures.push({ text: char, expected, actual })
    }
  }
  console.log(`   单字符: ${passedTests}/${totalTests} 通过\n`)

  // ========== 2. 词组测试 ==========
  console.log('2. 词组转换测试...')

  const phrases = [
    '我幹什麼不干你事。',
    '人体内存在很多微生物',
    '佛說大乘僧伽吒法義經',
    '西天譯經三藏寶輪大師賜紫沙門臣金揔持等奉　詔譯',
    '尒時，有十八酤胝無知外道來詣',
    '計算機軟體工程',
    '網絡安全與資訊技術',
    '電子郵件地址',
    '數據庫管理系統',
    '人工智慧與機器學習',
  ]

  const phraseStart = passedTests
  for (const phrase of phrases) {
    const expected = pythonConvert(phrase)
    const actual = toSimplified(phrase)
    totalTests++

    if (expected === actual) {
      passedTests++
    } else {
      failedTests++
      failures.push({ text: phrase, expected, actual })
    }
  }
  console.log(`   词组: ${passedTests - phraseStart}/${phrases.length} 通过\n`)

  // ========== 3. 实际文件测试 ==========
  console.log('3. 实际文件转换测试...')

  if (!existsSync(DATA_DIR)) {
    console.log('   跳过（data 目录不存在）\n')
  } else {
    const jsonFiles = findJsonFiles(DATA_DIR, [], 20) // 取 20 个文件
    let fileTestCount = 0
    let filePassCount = 0
    let stringCount = 0

    for (const filePath of jsonFiles) {
      try {
        const content = readFileSync(filePath, 'utf-8')
        const data = JSON.parse(content)
        const strings = collectStrings(data)

        // 只取有中文的字符串
        const chineseStrings = strings.filter(s => /[\u4e00-\u9fff]/.test(s))

        // 每个文件取前 100 个字符串测试
        for (const str of chineseStrings.slice(0, 100)) {
          const expected = pythonConvert(str)
          const actual = toSimplified(str)
          stringCount++
          totalTests++

          if (expected === actual) {
            passedTests++
            filePassCount++
          } else {
            failedTests++
            if (failures.length < 10) {
              failures.push({ text: str.slice(0, 50), expected: expected.slice(0, 50), actual: actual.slice(0, 50) })
            }
          }
        }
        fileTestCount++
      } catch (e) {
        // 忽略解析错误
      }
    }
    console.log(`   文件数: ${fileTestCount}`)
    console.log(`   字符串数: ${stringCount}`)
    console.log(`   通过: ${filePassCount}/${stringCount}\n`)
  }

  // ========== 结果汇总 ==========
  console.log('=== 校验结果 ===')
  console.log(`总测试数: ${totalTests}`)
  console.log(`通过: ${passedTests}`)
  console.log(`失败: ${failedTests}`)
  console.log(`一致率: ${(passedTests / totalTests * 100).toFixed(4)}%`)

  if (failures.length > 0) {
    console.log('\n=== 失败详情 ===')
    for (const f of failures.slice(0, 10)) {
      console.log(`原文: ${f.text}`)
      console.log(`期望: ${f.expected}`)
      console.log(`实际: ${f.actual}`)
      console.log('---')
    }
  }

  // 返回状态码
  if (failedTests > 0) {
    console.log('\n❌ 校验未通过')
    process.exit(1)
  } else {
    console.log('\n✅ 校验通过')
    process.exit(0)
  }
}

main().catch(e => {
  console.error('校验出错:', e)
  process.exit(1)
})
