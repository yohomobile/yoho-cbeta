#!/usr/bin/env tsx
/**
 * 校验简体转换结果
 *
 * 校验逻辑：对比繁体原文和简体结果
 * 如果用 zhconv 转换繁体原文得到的结果与简体文件不一致，则报错
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join } from 'path'
import { toSimplified } from './zhconv.js'

const DATA_DIR = '/home/guang/happy/yoho-cbeta/data'
const SIMPLIFIED_DIR = '/home/guang/happy/yoho-cbeta/data-simplified'

/**
 * 递归收集所有字符串及路径
 */
function collectStrings(obj: any, path = '', results: Array<{ path: string; value: string }> = []) {
  if (typeof obj === 'string') {
    results.push({ path, value: obj })
  } else if (Array.isArray(obj)) {
    obj.forEach((item, i) => collectStrings(item, `${path}[${i}]`, results))
  } else if (obj !== null && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      collectStrings(v, path ? `${path}.${k}` : k, results)
    }
  }
  return results
}

/**
 * 递归查找 JSON 文件
 */
function findJsonFiles(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) return files
  const entries = readdirSync(dir)
  for (const entry of entries) {
    if (entry.startsWith('.')) continue
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      findJsonFiles(fullPath, files)
    } else if (entry.endsWith('.json')) {
      files.push(fullPath)
    }
  }
  return files
}

async function main() {
  console.log('=== 简体转换严格校验 ===\n')

  // 找到已转换的简体文件
  const simplifiedFiles = findJsonFiles(SIMPLIFIED_DIR)
  console.log(`找到 ${simplifiedFiles.length} 个简体 JSON 文件\n`)

  if (simplifiedFiles.length === 0) {
    console.log('没有找到简体文件，请先运行 pnpm simplify')
    process.exit(1)
  }

  let totalStrings = 0
  let mismatchCount = 0
  const mismatches: Array<{ file: string; path: string; original: string; expected: string; actual: string }> = []

  for (const simpFile of simplifiedFiles) {
    // 对应的繁体文件
    const relPath = simpFile.replace(SIMPLIFIED_DIR, '')
    const tradFile = DATA_DIR + relPath

    if (!existsSync(tradFile)) {
      console.log(`警告: 找不到繁体原文 ${tradFile}`)
      continue
    }

    // 读取繁体和简体
    const tradData = JSON.parse(readFileSync(tradFile, 'utf-8'))
    const simpData = JSON.parse(readFileSync(simpFile, 'utf-8'))

    const tradStrings = collectStrings(tradData)
    const simpStrings = collectStrings(simpData)

    // 构建简体文件的 path->value 映射
    const simpMap = new Map<string, string>()
    for (const { path, value } of simpStrings) {
      simpMap.set(path, value)
    }

    // 逐一比对
    for (const { path, value: tradValue } of tradStrings) {
      totalStrings++

      // 用 zhconv 转换繁体
      const expected = toSimplified(tradValue)

      // 简体文件中的实际值
      const actual = simpMap.get(path) || ''

      if (expected !== actual) {
        mismatchCount++
        if (mismatches.length < 20) {
          mismatches.push({
            file: relPath,
            path,
            original: tradValue.slice(0, 40),
            expected: expected.slice(0, 40),
            actual: actual.slice(0, 40)
          })
        }
      }
    }
  }

  console.log(`总字符串数: ${totalStrings}`)
  console.log(`不一致数量: ${mismatchCount}`)
  console.log(`一致率: ${((totalStrings - mismatchCount) / totalStrings * 100).toFixed(4)}%`)

  if (mismatches.length > 0) {
    console.log('\n=== 不一致详情 ===')
    for (const m of mismatches) {
      console.log(`文件: ${m.file}`)
      console.log(`路径: ${m.path}`)
      console.log(`原文: ${m.original}`)
      console.log(`期望: ${m.expected}`)
      console.log(`实际: ${m.actual}`)
      console.log('---')
    }
    console.log('\n❌ 校验未通过')
    process.exit(1)
  } else {
    console.log('\n✅ 所有字段转换正确')
    process.exit(0)
  }
}

main()
