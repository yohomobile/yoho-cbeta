import * as fs from 'fs'
import * as path from 'path'

// 读取关系数据
const relationships = JSON.parse(fs.readFileSync('/home/guang/happy/yoho-cbeta/relationships.json', 'utf-8'))

// 分析 X 藏的前30个未匹配注疏
const xMissing = [
  { id: 'X03n0221', title: '续华严略疏刊定记', baseName: '华严' },
  { id: 'X05n0229', title: '大方广佛华严经普贤行愿品别行疏钞', baseName: '华严经' },
  { id: 'X08n0236', title: '华严悬谈会玄记', baseName: '华严' },
  { id: 'X09n0244', title: '大方广圆觉经大疏钞科', baseName: '圆觉经' },
  { id: 'X10n0250', title: '圆觉疏钞随文要解', baseName: '圆觉' },
  { id: 'X10n0253', title: '大方广圆觉修多罗了义经夹颂集解讲义', baseName: '圆觉经' },
  { id: 'X10n0256', title: '大方广圆觉修多罗了义经略疏', baseName: '圆觉经' },
  { id: 'X10n0257', title: '大方广圆觉修多罗了义经集注', baseName: '圆觉经' },
  { id: 'X10n0260', title: '大方广圆觉修多罗了义经要解', baseName: '圆觉经' },
  { id: 'X14n0293', title: '首楞严经悬谈', baseName: '楞严经' },
  { id: 'X15n0299', title: '大佛顶如来密因修证了义诸菩萨万行首楞严经讲录', baseName: '楞严经' },
  { id: 'X16n0313', title: '大佛顶经序指味疏', baseName: '楞严经' },
  { id: 'X16n0315', title: '大佛顶首楞严经宝镜疏悬谈', baseName: '楞严经' },
  { id: 'X17n0324', title: '楞伽经集注', baseName: '楞伽经' },
  { id: 'X18n0332', title: '楞伽阿䟦多罗宝经参订疏', baseName: '楞伽经' },
  { id: 'X18n0338', title: '维摩罗诘经文疏', baseName: '维摩经' },
  { id: 'X19n0348', title: '维摩诘所说经无我疏', baseName: '维摩经' },
  { id: 'X19n0351', title: '胜鬘经义记', baseName: '胜鬘经' },
  { id: 'X19n0352', title: '胜鬘经述记', baseName: '胜鬘经' },
  { id: 'X21n0381', title: '药师瑠璃光如来本愿功德经直解', baseName: '药师经' },
  { id: 'X22n0413', title: '佛说观无量寿佛经直指疏', baseName: '观无量寿经' },
  { id: 'X25n0482', title: '金刚略疏', baseName: '金刚经' },
  { id: 'X25n0483', title: '金刚般若波罗蜜经直解', baseName: '金刚经' },
]

console.log('=== 分析 X 藏未匹配注疏 ===\n')

// 检查这些注疏对应的原经是否存在
for (const { id, title, baseName } of xMissing.slice(0, 15)) {
  console.log(id + ': ' + title)
  console.log('  预期原经: ' + baseName)
  
  // 搜索可能的原经
  let found = false
  for (const [sutraId, data] of Object.entries(relationships.commentaries as Record<string, any>)) {
    if (data.title.includes(baseName) && !data.title.includes('疏') && !data.title.includes('记') &&
        !data.title.includes('钞') && !data.title.includes('注') && !data.title.includes('解')) {
      console.log('  找到原经: ' + sutraId + ' - ' + data.title)
      
      // 检查此原经是否有该注疏
      if (data.commentaries && data.commentaries[id]) {
        console.log('    ✓ 已匹配')
      } else {
        console.log('    ✗ 未匹配 (应添加)')
      }
      found = true
      break
    }
  }
  if (!found) {
    console.log('  未找到原经')
  }
  console.log('')
}
