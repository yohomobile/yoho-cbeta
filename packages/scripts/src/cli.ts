#!/usr/bin/env node
/**
 * CBETA 解析器命令行工具
 */

import { CbetaParser } from './parser.js'

const args = process.argv.slice(2)

if (args.length === 0) {
  console.log('用法: tsx src/cli.ts <xml文件路径>')
  console.log('示例: tsx src/cli.ts /path/to/T01n0001.xml')
  process.exit(1)
}

const filePath = args[0]

try {
  const parser = new CbetaParser()
  const doc = parser.parse(filePath)
  console.log(JSON.stringify(doc, null, 2))
} catch (err) {
  console.error('解析失败:', err)
  process.exit(1)
}
