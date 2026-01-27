/**
 * 从解析后的 JSON 文件中提取人名信息，生成 SQL 导入文件
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const PARSED_DIR = path.resolve(import.meta.dirname, '../../../parsed')
const OUTPUT_FILE = path.resolve(import.meta.dirname, '../../backend/drizzle/seed-persons.sql')

interface PersonInfo {
  name: string
  dynasty: string | null
  dynastyId: string | null
  nationality: string | null
  identity: string | null
  aliases: string[] | null
}

interface ParsedDocument {
  id: string
  persons?: PersonInfo[]
}

// 朝代名到ID的映射
const DYNASTY_NAME_TO_ID: Record<string, string> = {
  '秦': 'qin',
  '前秦': 'qin-former',
  '苻秦': 'qin-former',
  '符秦': 'qin-former',
  '后秦': 'qin-later',
  '姚秦': 'qin-later',
  '西秦': 'qin-west',
  '乞伏秦': 'qin-west',
  '西汉': 'han-west',
  '东汉': 'han-east',
  '后汉': 'han-east',
  '三国': 'three-kingdoms',
  '曹魏': 'wei-cao',
  '吴': 'wu',
  '蜀': 'shu',
  '西晋': 'jin-west',
  '东晋': 'jin-east',
  // 十六国
  '前凉': 'liang-former',
  '后凉': 'liang-later-16',
  '南凉': 'liang-south',
  '北凉': 'liang-north',
  '西凉': 'liang-west',
  '后燕': 'yan-later',
  // 南北朝
  '刘宋': 'song-liu',
  '南齐': 'qi-south',
  '梁': 'liang',
  '陈': 'chen',
  '北魏': 'wei-north',
  '元魏': 'wei-north',
  '后魏': 'wei-north',
  '东魏': 'wei-east',
  '西魏': 'wei-west',
  '北齐': 'qi-north',
  '北周': 'zhou-north',
  '南北朝': 'southern-northern',
  '萧齐': 'qi-south',
  '高齐': 'qi-north',
  '宇文周': 'zhou-north',
  '隋': 'sui',
  '唐': 'tang',
  '五代': 'five-dynasties',
  '后梁': 'liang-later',
  '后唐': 'tang-later',
  '后晋': 'jin-later',
  '后周': 'zhou-later',
  '南唐': 'tang-south',
  '南汉': 'han-south',
  '吴越': 'wuyue',
  '宋': 'song',
  '北宋': 'song-north',
  '南宋': 'song-south',
  '辽': 'liao',
  '金': 'jin',
  '元': 'yuan',
  '明': 'ming',
  '清': 'qing',
  '民国': 'minguo',
  '新罗': 'silla',
  '高丽': 'goryeo',
  '日本': 'japan',
  '日': 'japan',
  '朝鲜': 'joseon',
  '韩国': 'korea',
  '西夏': 'xixia',
  '夏': 'xixia',
  '晋': 'jin-dynasty',
  '晋世': 'jin-dynasty',
  '胡': 'hu',
}

function escapeSQL(str: string | null): string {
  if (str === null) return 'NULL'
  return `'${str.replace(/'/g, "''")}'`
}

function main() {
  console.log('📚 从解析数据中提取人名...')

  // 用于去重的 Map: name -> PersonInfo (保留信息最完整的)
  const personMap = new Map<string, PersonInfo>()

  // 递归遍历目录
  function processDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        processDir(fullPath)
      } else if (entry.name.endsWith('.json') && !entry.name.startsWith('.')) {
        processFile(fullPath)
      }
    }
  }

  function processFile(filePath: string) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const doc: ParsedDocument = JSON.parse(content)

      if (!doc.persons || doc.persons.length === 0) return

      for (const person of doc.persons) {
        // 跳过无效名称
        if (!person.name || person.name === '佚名') continue
        // 跳过包含多人的复杂名称
        if (person.name.includes('．') || person.name.includes('(') || person.name.includes('（')) continue
        // 跳过过长的名称
        if (person.name.length > 20) continue
        // 跳过单字名（通常是解析不完整）
        if (person.name.length === 1) continue
        // 跳过复合名（包含角色词 + 空格的）
        if (/[造撰编译释著集述注疏录记说校辑定]\s/.test(person.name)) continue
        // 跳过明显不是人名的
        if (person.name.includes('等') && person.name.length > 5) continue
        // 跳过包含注释性内容的
        if (/有行实|有塔铭|附年谱|卷\d|原书|依民国|依驹本|原目|内题|后附|前有/.test(person.name)) continue
        // 跳过包含机构名的
        if (/大学|图书馆|研读班|基金会|书陵部|僧众/.test(person.name)) continue
        // 跳过包含多个空格的（通常是复杂未解析的）
        if ((person.name.match(/ /g) || []).length > 1) continue
        // 跳过以"附"开头的非人名
        if (/^附/.test(person.name)) continue
        // 跳过末尾带角色词的不完整解析（但保留有效人名如"无著"、"难提"等）
        if (/[讲述录编纂辑注会集标排略删续提书评句私补直解重译]$/.test(person.name) && person.name.length > 2) {
          // 白名单：这些是有效人名
          const validNames = ['无著', '难提', '那提', '康僧会', '师会', '杨文会', '功德直']
          if (!validNames.includes(person.name)) continue
        }
        // 跳过以"共"/"同"/"仝"结尾的复合名
        if (/[共同仝]$/.test(person.name) && person.name.length > 3) continue
        // 跳过 CBETA 等机构名
        if (person.name === 'CBETA' || person.name === '集云堂') continue

        const existing = personMap.get(person.name)
        if (!existing) {
          personMap.set(person.name, person)
        } else {
          // 合并信息，优先保留有值的
          if (!existing.dynastyId && person.dynastyId) {
            existing.dynastyId = person.dynastyId
            existing.dynasty = person.dynasty
          }
          if (!existing.nationality && person.nationality) {
            existing.nationality = person.nationality
          }
          if (!existing.identity && person.identity) {
            existing.identity = person.identity
          }
          if (!existing.aliases && person.aliases) {
            existing.aliases = person.aliases
          } else if (existing.aliases && person.aliases) {
            // 合并别名
            const allAliases = new Set([...existing.aliases, ...person.aliases])
            existing.aliases = Array.from(allAliases)
          }
        }
      }
    } catch {
      // 忽略解析错误
    }
  }

  processDir(PARSED_DIR)

  // 合并同一人的不同写法
  // 规则: 释X -> X, 竺X -> X, X大士 -> X, 玄宗李隆基 -> 李隆基 等
  const mergeRules: Array<{ pattern: RegExp; extract: (name: string) => string }> = [
    // 释X -> X (僧人名)
    { pattern: /^释(.{2,})$/, extract: (n) => n.slice(1) },
    // 竺X -> X (早期僧人)
    { pattern: /^竺(.{2,})$/, extract: (n) => n.slice(1) },
    // X大士 -> X
    { pattern: /^(.{2,})大士$/, extract: (n) => n.slice(0, -2) },
  ]

  // 皇帝名合并映射
  const emperorMerge: Record<string, string> = {
    '玄宗李隆基': '李隆基',
    '太宗赵炅': '赵炅',
    '太宗朱棣': '朱棣',
    '明成祖朱棣': '朱棣',
    '真宗赵恒': '赵恒',
  }

  // 印度论师等同名合并（主名 -> 别名列表）
  const scholarMerge: Record<string, string[]> = {
    '世亲': ['天亲', '婆薮槃豆', '婆薮盘豆', '婆薮开士'],
    '无著': ['阿僧伽'],
    '龙树': ['龙猛', '圣者龙树'],
    '陈那': ['陈那论师', '大域龙', '域龙'],
    '提婆': ['圣天', '圣者提婆'],
    '法称': ['法称论师'],
    '功德施': ['功德施菩萨'],
    '护法': ['护法菩萨', '护法论师'],
    '安慧': ['安慧菩萨'],
    '清辩': ['清辩论师', '清辨', '分别明'],
    '戒贤': ['戒贤论师'],
    '月称': ['月称论师'],
    '寂天': ['寂天论师', '寂天菩萨'],
    '莲华戒': ['莲花戒'],
    '菩提达摩': ['达摩', '菩提达磨', '达磨'],
    // 音译变体（佛驮 = 佛陀）
    '佛陀跋陀罗': ['佛驮跋陀罗', '觉贤'],
    '佛陀扇多': ['佛驮扇多'],
    '佛陀蜜多': ['佛驮蜜多'],
    '佛陀耶舍': ['佛驮耶舍'],
    '佛陀多罗': ['佛驮多罗'],
    // 其他音译变体
    '瞿昙般若流支': ['瞿昙般若留支'],
    '昙摩流支': ['昙摩留支'],

    // 唐代译师
    '不空': ['不空遍智', '不空金刚'],
    '金刚智': ['国金刚智'],
    '善无畏': ['输波迦罗', '输婆迦罗'],

    // 东晋译师
    '帛尸梨密多罗': ['帛尸梨蜜多罗'],

    // 隋代译师
    '阇那崛多': ['禅那崛多'],
    // 北魏译师
    '菩提流支': ['菩提留支'],

    // 瞿昙系译师
    '瞿昙僧伽提婆': ['僧伽提婆'],

    // 元代译师
    '沙啰巴': ['沙罗巴'],

    // 僧人号与法名
    '明本': ['中峰明本'],
    '一行': ['一行慧觉'],

    // 隋/唐代译师
    '阿地瞿多': ['瞿多'],
    '达摩笈多': ['笈多', '达磨笈多'],

    // 华严宗初祖（557-640，跨隋唐）
    '杜顺': ['释杜顺'],

    // 惠/慧 异体字（同一人）
    '慧沼': ['惠沼'],
    '慧洪': ['惠洪'],
    '慧简': ['惠简'],
    '安慧': ['安惠'],
    '大惠': ['大慧'],  // 明代吴门北禅寺沙门

    // 藏传佛教/印度佛教
    '多罗那他': ['达喇那他'],  // Tāranātha (1575-1634)，觉囊派高僧
    '阿底峡': ['阿底霞'],  // Atiśa (982-1054)，印度佛教大师

    // 张妙定莲菩提金刚
    '张妙定莲菩提金刚': ['张妙定莲菩提金刚正'],

    // 三国吴译师
    '支谦': ['支越'],  // 支越是支谦的字（恭明）

    // 集体作者
    '五百罗汉': ['五百大阿罗汉'],  // 同一概念

    // 唐代法相宗祖师（632-682）
    '窥基': ['大乘基'],  // 玄奘弟子，唯识宗创始人

    // 唐代密宗大师（705-774）
    '不空': ['阿目佉', '阿谟伽'],  // Amoghavajra，阿目佉/阿谟伽音译变体

    // 明末四大高僧（1599-1655）
    '智旭': ['蕅益'],  // 蕅益智旭大师，法名智旭，号蕅益

    // 惠辨/惠辩 异体字
    '惠辨': ['惠辩禅师'],  // 辨/辩异体字，同一人

    // 刘宋译师 Dharmamitra
    '昙摩蜜多': ['昙无蜜多'],  // 摩/无 音译变体

    // 明初黑衣宰相（1335-1418）
    '姚广孝': ['道衍'],  // 俗名姚广孝，法名道衍

    // 清代居士（1740-1796）
    '彭绍升': ['彭际清'],  // 名绍升，号际清

    // 元代禅师 天如惟则
    '惟则': ['天如则'],  // 天如惟则禅师

    // 唐代译师 Prajñācakra
    '般若斫羯啰': ['般若惹羯罗'],  // 惹/斫、罗/啰 音译变体

    // 印度论师 Kātyāyanīputra
    '迦多衍尼子': ['迦旃延子', '迦栴延子'],  // 发智论作者，栴/旃异体字

    // 斯里兰卡论师 Anuruddha
    '阿耨楼陀': ['阿那律陀'],  // 摄阿毗达磨义论作者

    // 斯里兰卡论师 Buddhaghosa
    '觉音': ['佛音'],  // 清净道论作者

    // 藏传佛教 贡噶呼图克图
    '贡噶呼图克图': ['贡噶'],  // 贡噶上师

    // 北魏译师 Dharmaruci
    '昙摩流支': ['瞿昙流支'],  // 瞿昙是姓氏

    // 北魏译师 Prajñāruci
    '般若流支': ['瞿昙般若流支'],  // 瞿昙是姓氏

    // 弥勒菩萨 Maitreya
    '弥勒': ['慈氏'],  // 弥勒是音译，慈氏是意译

    // 刘宋凉州沙门
    '宝云': ['释宝云'],  // 同一人，释是僧人通称

    // 明代湖南邵陵五台庵沙门
    '观衡': ['释观衡'],  // 同一人，释是僧人通称

    // 新罗青丘沙门（8世纪）
    '太贤': ['大贤'],  // 同一人，太/大 异体

    // 明代中吴沙门
    '空谷景隆': ['释景隆'],  // 同一人，空谷是号
  }

  // 合并印度论师
  for (const [mainName, aliasNames] of Object.entries(scholarMerge)) {
    const main = personMap.get(mainName)
    for (const aliasName of aliasNames) {
      const alias = personMap.get(aliasName)
      if (alias) {
        if (main) {
          // 合并到主名
          if (!main.aliases) main.aliases = []
          if (!main.aliases.includes(aliasName)) main.aliases.push(aliasName)
          // 合并其他信息
          if (!main.dynastyId && alias.dynastyId) {
            main.dynastyId = alias.dynastyId
            main.dynasty = alias.dynasty
          }
          if (!main.identity && alias.identity) main.identity = alias.identity
          if (alias.aliases) {
            for (const a of alias.aliases) {
              if (!main.aliases.includes(a) && a !== mainName) main.aliases.push(a)
            }
          }
          personMap.delete(aliasName)
        } else {
          // 主名不存在，将别名改为主名
          alias.name = mainName
          if (!alias.aliases) alias.aliases = []
          if (!alias.aliases.includes(aliasName)) alias.aliases.push(aliasName)
          personMap.delete(aliasName)
          personMap.set(mainName, alias)
        }
      }
    }
  }

  for (const [fullName, shortName] of Object.entries(emperorMerge)) {
    const full = personMap.get(fullName)
    const short = personMap.get(shortName)
    if (full && short) {
      // 合并到短名，添加全名为别名
      if (!short.aliases) short.aliases = []
      if (!short.aliases.includes(fullName)) short.aliases.push(fullName)
      personMap.delete(fullName)
    } else if (full && !short) {
      // 只有全名，改为短名
      full.name = shortName
      if (!full.aliases) full.aliases = []
      if (!full.aliases.includes(fullName)) full.aliases.push(fullName)
      personMap.delete(fullName)
      personMap.set(shortName, full)
    }
  }

  // 合并 释X/竺X 等变体
  for (const rule of mergeRules) {
    for (const [name, person] of Array.from(personMap.entries())) {
      if (rule.pattern.test(name)) {
        const baseName = rule.extract(name)
        const base = personMap.get(baseName)
        if (base) {
          // 同朝代才合并
          if (base.dynastyId === person.dynastyId || !base.dynastyId || !person.dynastyId) {
            // 合并到基础名，添加变体为别名
            if (!base.aliases) base.aliases = []
            if (!base.aliases.includes(name)) base.aliases.push(name)
            // 合并其他信息
            if (!base.dynastyId && person.dynastyId) {
              base.dynastyId = person.dynastyId
              base.dynasty = person.dynasty
            }
            if (!base.identity && person.identity) base.identity = person.identity
            personMap.delete(name)
          }
        }
      }
    }
  }

  // 转换为数组并排序
  const persons = Array.from(personMap.values()).sort((a, b) => {
    // 按朝代排序，然后按名字排序
    const aOrder = a.dynastyId ? 1 : 0
    const bOrder = b.dynastyId ? 1 : 0
    if (aOrder !== bOrder) return bOrder - aOrder
    return a.name.localeCompare(b.name, 'zh-CN')
  })

  console.log(`✓ 提取到 ${persons.length} 个独立人名`)

  // 生成 SQL
  const sqlLines: string[] = [
    '-- 人名种子数据 (自动生成)',
    `-- 生成时间: ${new Date().toISOString()}`,
    `-- 总计: ${persons.length} 条记录`,
    '',
    'TRUNCATE TABLE persons CASCADE;',
    '',
  ]

  // 分批插入 (每批100条)
  const batchSize = 100
  for (let i = 0; i < persons.length; i += batchSize) {
    const batch = persons.slice(i, i + batchSize)

    sqlLines.push('INSERT INTO persons (name, aliases, dynasty_id, nationality, identity) VALUES')

    const values = batch.map((p, idx) => {
      const dynastyId = p.dynastyId || (p.dynasty ? DYNASTY_NAME_TO_ID[p.dynasty] : null)
      const aliasesJson = p.aliases ? JSON.stringify(p.aliases) : null

      const line = `(${escapeSQL(p.name)}, ${escapeSQL(aliasesJson)}, ${escapeSQL(dynastyId)}, ${escapeSQL(p.nationality)}, ${escapeSQL(p.identity)})`
      return idx === batch.length - 1 ? line + ';' : line + ','
    })

    sqlLines.push(...values)
    sqlLines.push('')
  }

  fs.writeFileSync(OUTPUT_FILE, sqlLines.join('\n'), 'utf-8')
  console.log(`✓ SQL 文件已生成: ${OUTPUT_FILE}`)

  // 统计信息
  const withDynasty = persons.filter(p => p.dynastyId || p.dynasty).length
  const withAliases = persons.filter(p => p.aliases && p.aliases.length > 0).length
  const withIdentity = persons.filter(p => p.identity).length

  console.log(`\n统计:`)
  console.log(`  有朝代信息: ${withDynasty} (${(withDynasty / persons.length * 100).toFixed(1)}%)`)
  console.log(`  有别名: ${withAliases} (${(withAliases / persons.length * 100).toFixed(1)}%)`)
  console.log(`  有身份: ${withIdentity} (${(withIdentity / persons.length * 100).toFixed(1)}%)`)
}

main()
