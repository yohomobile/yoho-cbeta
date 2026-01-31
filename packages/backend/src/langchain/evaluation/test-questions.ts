/**
 * RAG 评估测试问题集
 * 覆盖不同类型和难度的佛学问题
 */

import type { TestQuestion } from "../types.js"

export const TEST_QUESTIONS: TestQuestion[] = [
  // ==================== 概念类 (concept) ====================
  {
    id: "concept-1",
    question: "什么是无常？",
    expectedKeywords: ["无常", "变化", "生灭", "迁流"],
    expectedTitles: ["阿含", "杂阿含"],
    category: "concept",
    difficulty: "easy",
  },
  {
    id: "concept-2",
    question: "四圣谛是什么？",
    expectedKeywords: ["苦", "集", "灭", "道", "四谛", "圣谛"],
    expectedTitles: ["阿含", "中阿含"],
    category: "concept",
    difficulty: "easy",
  },
  {
    id: "concept-3",
    question: "什么是空性？",
    expectedKeywords: ["空", "性空", "缘起", "无自性", "般若"],
    expectedTitles: ["般若", "心经", "中论"],
    category: "concept",
    difficulty: "medium",
  },
  {
    id: "concept-4",
    question: "什么是中道？",
    expectedKeywords: ["中道", "不二", "离边", "非有非无"],
    expectedTitles: ["中论", "阿含"],
    category: "concept",
    difficulty: "medium",
  },
  {
    id: "concept-5",
    question: "如来藏思想的核心是什么？",
    expectedKeywords: ["如来藏", "佛性", "真如", "本觉", "清净心"],
    expectedTitles: ["楞伽", "胜鬘", "如来藏"],
    category: "concept",
    difficulty: "hard",
  },
  // 新增：经书别名测试
  {
    id: "concept-6",
    question: "心经的核心思想是什么？",
    expectedKeywords: ["空", "色即是空", "五蕴皆空", "般若"],
    expectedTextIds: ["T08n0251"],
    expectedTitles: ["般若波罗蜜多心经", "心经"],
    category: "concept",
    difficulty: "easy",
  },
  {
    id: "concept-7",
    question: "法华经的一乘思想是什么？",
    expectedKeywords: ["一乘", "三乘", "方便", "开权显实", "会三归一"],
    expectedTextIds: ["T09n0262"],
    expectedTitles: ["妙法莲华经", "法华经"],
    category: "concept",
    difficulty: "medium",
  },
  {
    id: "concept-8",
    question: "华严经讲的法界观是什么？",
    expectedKeywords: ["法界", "事事无碍", "理事", "圆融", "毗卢遮那"],
    expectedTextIds: ["T10n0279"],
    expectedTitles: ["大方广佛华严经", "华严经"],
    category: "concept",
    difficulty: "hard",
  },

  // ==================== 引用类 (quote) ====================
  {
    id: "quote-1",
    question: "色即是空是什么意思？",
    expectedKeywords: ["色", "空", "不异", "般若"],
    expectedTextIds: ["T08n0251"],
    expectedTitles: ["心经", "般若波罗蜜多心经"],
    category: "quote",
    difficulty: "easy",
  },
  {
    id: "quote-2",
    question: "金刚经说的应无所住而生其心是什么意思？",
    expectedKeywords: ["无所住", "生心", "金刚经", "不住"],
    expectedTextIds: ["T08n0235"],
    expectedTitles: ["金刚般若波罗蜜经", "金刚经"],
    category: "quote",
    difficulty: "medium",
  },
  {
    id: "quote-3",
    question: "金刚经的一切有为法如梦幻泡影怎么理解？",
    expectedKeywords: ["有为法", "梦", "幻", "泡", "影", "露", "电"],
    expectedTextIds: ["T08n0235"],
    expectedTitles: ["金刚般若波罗蜜经", "金刚经"],
    category: "quote",
    difficulty: "easy",
  },
  // 新增：更多经书别名引用测试
  {
    id: "quote-4",
    question: "楞严经的七处征心讲了什么？",
    expectedKeywords: ["七处", "征心", "心", "妄心", "真心"],
    expectedTextIds: ["T19n0945"],
    expectedTitles: ["大佛顶如来密因修证了义诸菩萨万行首楞严经", "楞严经"],
    category: "quote",
    difficulty: "hard",
  },
  {
    id: "quote-5",
    question: "维摩经的不二法门是什么？",
    expectedKeywords: ["不二", "默然", "无言", "法门"],
    expectedTextIds: ["T14n0475"],
    expectedTitles: ["维摩诘所说经", "维摩经"],
    category: "quote",
    difficulty: "medium",
  },
  {
    id: "quote-6",
    question: "地藏经讲地狱有哪些？",
    expectedKeywords: ["地狱", "无间", "阿鼻", "业报", "罪报"],
    expectedTextIds: ["T13n0412"],
    expectedTitles: ["地藏菩萨本愿经", "地藏经"],
    category: "quote",
    difficulty: "medium",
  },

  // ==================== 比较类 (comparison) ====================
  {
    id: "comparison-1",
    question: "大乘和小乘的区别是什么？",
    expectedKeywords: ["大乘", "小乘", "菩萨", "声闻", "自利", "利他"],
    category: "comparison",
    difficulty: "medium",
  },
  {
    id: "comparison-2",
    question: "唯识和中观有什么不同？",
    expectedKeywords: ["唯识", "中观", "有", "空", "识", "缘起"],
    expectedTitles: ["唯识", "中论", "成唯识"],
    category: "comparison",
    difficulty: "hard",
  },

  // ==================== 实修类 (practice) ====================
  {
    id: "practice-1",
    question: "如何修习禅定？",
    expectedKeywords: ["禅定", "止", "观", "三摩地", "专注", "正念"],
    expectedTitles: ["禅", "定"],
    category: "practice",
    difficulty: "medium",
  },
  {
    id: "practice-2",
    question: "阿弥陀经说的念佛方法是什么？",
    expectedKeywords: ["念佛", "称名", "一心不乱", "阿弥陀佛", "净土"],
    expectedTextIds: ["T12n0366"],
    expectedTitles: ["佛说阿弥陀经", "阿弥陀经"],
    category: "practice",
    difficulty: "medium",
  },
  {
    id: "practice-3",
    question: "如何修习慈悲心？",
    expectedKeywords: ["慈", "悲", "喜", "舍", "四无量心", "众生"],
    category: "practice",
    difficulty: "easy",
  },
  // 新增：经书别名实修测试
  {
    id: "practice-4",
    question: "圆觉经讲的修行次第是什么？",
    expectedKeywords: ["圆觉", "修行", "观", "幻", "空"],
    expectedTextIds: ["T17n0842"],
    expectedTitles: ["大方广圆觉修多罗了义经", "圆觉经"],
    category: "practice",
    difficulty: "hard",
  },
  {
    id: "practice-5",
    question: "坛经说的顿悟法门是什么？",
    expectedKeywords: ["顿悟", "见性", "自性", "本心", "无念"],
    expectedTextIds: ["T48n2008"],
    expectedTitles: ["六祖大师法宝坛经", "坛经"],
    category: "practice",
    difficulty: "medium",
  },
  {
    id: "practice-6",
    question: "药师经的修行方法有哪些？",
    expectedKeywords: ["药师", "十二大愿", "灯", "持名", "消灾"],
    expectedTextIds: ["T14n0450"],
    expectedTitles: ["药师琉璃光如来本愿功德经", "药师经"],
    category: "practice",
    difficulty: "medium",
  },

  // ==================== 术语类 (terminology) ====================
  {
    id: "terminology-1",
    question: "什么是涅槃？",
    expectedKeywords: ["涅槃", "寂灭", "解脱", "灭度", "不生不灭"],
    category: "terminology",
    difficulty: "easy",
  },
  {
    id: "terminology-2",
    question: "什么是菩提心？",
    expectedKeywords: ["菩提心", "发心", "成佛", "利他", "愿"],
    category: "terminology",
    difficulty: "easy",
  },
  {
    id: "terminology-3",
    question: "阿赖耶识是什么？",
    expectedKeywords: ["阿赖耶", "藏识", "第八识", "种子", "异熟"],
    expectedTitles: ["唯识", "瑜伽"],
    category: "terminology",
    difficulty: "hard",
  },
  {
    id: "terminology-4",
    question: "十二因缘是什么？",
    expectedKeywords: ["无明", "行", "识", "名色", "六入", "触", "受", "爱", "取", "有", "生", "老死"],
    expectedTitles: ["阿含", "缘起"],
    category: "terminology",
    difficulty: "medium",
  },
  {
    id: "terminology-5",
    question: "五蕴是什么？",
    expectedKeywords: ["色", "受", "想", "行", "识", "蕴"],
    expectedTitles: ["阿含", "般若", "俱舍", "毘婆沙", "涅槃"],
    category: "terminology",
    difficulty: "easy",
  },
  // 新增：经书别名术语测试
  {
    id: "terminology-6",
    question: "楞伽经的五法三自性是什么？",
    expectedKeywords: ["五法", "三自性", "名", "相", "分别", "正智", "如如"],
    expectedTextIds: ["T16n0671"],
    expectedTitles: ["入楞伽经", "楞伽经"],
    category: "terminology",
    difficulty: "hard",
  },
  {
    id: "terminology-7",
    question: "涅槃经讲的佛性是什么？",
    expectedKeywords: ["佛性", "常乐我净", "涅槃", "如来藏"],
    expectedTextIds: ["T12n0374"],
    expectedTitles: ["大般涅槃经", "涅槃经"],
    category: "terminology",
    difficulty: "hard",
  },
]

/** 获取指定类别的测试问题 */
export function getQuestionsByCategory(category: TestQuestion["category"]): TestQuestion[] {
  return TEST_QUESTIONS.filter(q => q.category === category)
}

/** 获取指定难度的测试问题 */
export function getQuestionsByDifficulty(difficulty: TestQuestion["difficulty"]): TestQuestion[] {
  return TEST_QUESTIONS.filter(q => q.difficulty === difficulty)
}

/** 获取随机 N 个测试问题 */
export function getRandomQuestions(n: number): TestQuestion[] {
  const shuffled = [...TEST_QUESTIONS].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(n, TEST_QUESTIONS.length))
}
