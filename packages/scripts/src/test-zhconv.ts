#!/usr/bin/env tsx
/**
 * 测试 zhconv TypeScript 版
 */

import { convert, toSimplified } from './zhconv.js'

const tests = [
  '尒',
  '鼈',
  '說',
  '經',
  '義',
  '佛說大乘僧伽吒法義經',
  '我幹什麼不干你事。',
  '人体内存在很多微生物',
  '西天譯經三藏寶輪大師賜紫沙門臣金揔持等奉　詔譯',
  // 新增测试
  '馀',
  '後',
  '乾',
  '於',
  '乾隆',
  '乾闼婆',
  '復有',
  '於菟',
]

console.log('=== 繁 → 简 ===')
for (const t of tests) {
  console.log(`${t} → ${toSimplified(t)}`)
}

console.log()
console.log('=== 简 → 繁 ===')
const simpTests = ['人体内存在很多微生物', '计算机', '软件']
for (const t of simpTests) {
  console.log(`${t} → ${convert(t, 'zh-tw')}`)
}
