#!/usr/bin/env tsx
/**
 * 测试解析金刚经 - 完全无损解析
 */

import { XMLParser } from 'fast-xml-parser'
import { readFileSync, writeFileSync } from 'fs'

const filePath = '/home/guang/happy/xml-p5a/T/T08/T08n0235.xml'
const xml = readFileSync(filePath, 'utf-8')

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  preserveOrder: true,
  commentPropName: '#comment',
  textNodeName: '#text',
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false
})

const result = parser.parse(xml)

// 保存完整 JSON（无损）
const outputPath = '/tmp/diamond_sutra_full.json'
writeFileSync(outputPath, JSON.stringify(result, null, 2))
console.log(`完整 JSON 已保存到 ${outputPath}`)

// 统计信息
const jsonStr = JSON.stringify(result)
console.log(`\nXML 大小: ${xml.length} 字节`)
console.log(`JSON 大小: ${jsonStr.length} 字节`)
console.log(`压缩比: ${(jsonStr.length / xml.length * 100).toFixed(1)}%`)
