# CBETA 数据结构深度设计方案

## 一、调研发现汇总

### 1.1 数据规模

| 指标 | 数值 |
|------|------|
| 藏经种类 | 26 种 |
| XML/JSON 文件数 | 4,996 个 |
| 大正藏文件数 | 2,471 个 |
| 总字符数 | 7.93 亿 |
| 中文字符数 | 2.40 亿 |
| 唯一作者字段 | 2,236 种 |
| 特殊字符引用 | 205,806 处 |
| 校勘版本标识 | 40+ 种 |
| 预估 Tokens | 3-5 亿 |
| 段落 (p) 总数 | 2,720,968 个 |
| 行标记 (lb) 总数 | 12,878,003 个 |
| 页标记 (pb) 总数 | 296,146 个 |
| 含陀罗尼经典 | 948 个 |
| 陀罗尼标记 | 20,126 处 |
| 含引用的文件 | 934 个 |

### 1.2 发现的多维度分类体系

#### A. 藏经维度 (26种)

| 代码 | 名称 | 卷数 | 说明 |
|------|------|------|------|
| T | 大正新脩大藏經 | 85 | 最权威汉传佛典 |
| X | 卍新纂大日本續藏經 | 88 | 续藏 |
| J | 嘉興大藏經 | 40 | 明清新著 |
| N | 漢譯南傳大藏經 | 70 | 巴利语译本 |
| K | 高麗大藏經 | 47 | 韩国藏经 |
| L | 乾隆大藏經 | 164 | 清代官刻 |
| P | 永樂北藏 | 200 | 明代官刻 |
| A | 趙城金藏 | 121 | 金代藏经 |
| C | 中華大藏經 | 106 | 中华书局版 |
| F | 房山石經 | 29 | 石刻佛经 |
| G | 佛教大藏經 | 84 | - |
| GA | 中國佛寺史志彙刊 | 110 | 寺志 |
| GB | 中國佛寺志叢刊 | 130 | 寺志 |
| I | 北朝佛教石刻拓片百品 | 1 | 石刻 |
| B | 大藏經補編 | 36 | 补编 |
| M | 卍正藏經 | 69 | - |
| Q | 磧砂大藏經 | 37 | - |
| S | 宋藏遺珍 | 6 | - |
| U | 洪武南藏 | 241 | - |
| Y | 印順法師佛學著作集 | 44 | 当代著作 |
| TX | 太虛大師全書 | 32 | 当代著作 |
| YP | 演培法師全集 | 45 | 当代著作 |
| LC | 呂澂佛學著作集 | 8 | 当代著作 |
| ZS | 正史佛教資料類編 | 1 | 历史资料 |
| ZW | 藏外佛教文獻 | 12 | 藏外文献 |
| D | 國家圖書館善本佛典 | 64 | 善本 |
| CC | CBETA 選集 | 2 | 选集 |

#### B. 朝代/地域维度 (33种)

| 朝代 | 出现次数 | 年代范围 | 备注 |
|------|---------|---------|------|
| 清 | 504 | 1644-1912 | 最多 |
| 明 | 428 | 1368-1644 | |
| 唐 | 390 | 618-907 | 译经鼎盛 |
| 宋 | 339 | 960-1279 | |
| 元 | 131 | 1271-1368 | |
| 日本 | 59 | - | 外国 |
| 隋 | 50 | 581-618 | |
| 民國 | 39 | 1912-1949 | |
| 陳 | 35 | 557-589 | |
| 劉宋 | 23 | 420-479 | |
| 元魏 | 22 | 386-534 | 北魏 |
| 梁 | 20 | 502-557 | 萧梁 |
| 東晉 | 19 | 317-420 | |
| 新羅 | 17 | - | 韩国 |
| 姚秦 | 14 | 384-417 | 后秦 |
| 西晉 | 13 | 265-316 | |
| 吳 | 13 | 222-280 | 三国 |
| 後漢 | 12 | 25-220 | 东汉 |
| 後秦 | 11 | 384-417 | |
| 高麗 | 10 | - | 韩国 |
| 北涼 | 8 | 397-439 | |
| 蕭齊 | 5 | 479-502 | |
| 失譯 | 5 | - | 译者不详 |
| 曹魏 | 4 | 220-265 | |
| 天竺 | 4 | - | 印度 |
| 北周 | 4 | 557-581 | |
| 印度 | 3 | - | |
| 乞伏秦 | 2 | 385-431 | 西秦 |
| 西秦 | 1 | 385-431 | |
| 南北朝 | 1 | 420-589 | |
| 北魏 | 1 | 386-534 | |
| 前秦 | 1 | 351-394 | |
| 中天竺 | 1 | - | 印度 |

#### C. 人物角色维度 (25种)

| 角色 | 出现次数 | 说明 |
|------|---------|------|
| 譯 | 462 | 翻译者 |
| 編 | 365 | 编辑者 |
| 撰 | 337 | 撰写者 |
| 述 | 245 | 述作者 |
| 集 | 234 | 集录者 |
| 錄 | 178 | 记录者 |
| 造 | 151 | 造论者 |
| 著 | 147 | 著作者 |
| 註 | 85 | 注释者 |
| 記 | 78 | 记述者 |
| 輯 | 76 | 辑录者 |
| 解 | 43 | 解说者 |
| 疏 | 28 | 疏释者 |
| 重編 | 24 | 重新编辑 |
| 校 | 22 | 校订者 |
| 傳 | 21 | 传述者 |
| 和 | 15 | 和韵者 |
| 合 | 15 | 合编者 |
| 科 | 14 | 分科者 |
| 重譯 | 2 | 重新翻译 |
| 同譯 | 2 | 共同翻译 |
| 合譯 | 1 | 合作翻译 |
| 口譯 | 1 | 口头翻译 |
| 傳譯 | 1 | 传述翻译 |
| 筆受 | - | 笔录者 |

#### D. 内容结构维度

**div 类型分布：**

| 类型 | 出现次数 | 说明 |
|------|---------|------|
| other/其他 | 282,486 | 一般内容 |
| commentary | 244,586 | 注释内容 |
| orig | 281,158 | 原文 |
| ke | 12,562 | 科判 |
| pin/品 | 6,005 | 品目 |
| xu/序 | 4,801 | 序文 |
| jing/經 | 4,067 | 经文 |
| 附文 | 4,093 | 附录 |
| fen/分 | - | 分目 |

**mulu 目录类型分布：**

| 类型 | 出现次数 | 说明 |
|------|---------|------|
| 其他 | 283,547 | 一般目录 |
| 卷 | 19,805 | 卷号 |
| 品 | 5,826 | 品目 |
| 序 | 4,603 | 序言 |
| 附文 | 4,104 | 附录 |
| 科判 | 2,793 | 科判结构 |
| 經 | 2,706 | 经名 |

#### E. 特殊内容类型

**偈颂类型 (lg)：**

| 类型 | 出现次数 | 说明 |
|------|---------|------|
| regular | 67,130 | 普通偈颂 |
| v5 | 961 | 五言诗 |
| v7 | 318 | 七言诗 |
| v4 | 119 | 四言诗 |

**注释类型 (note)：**

| 类型 | 出现次数 | 说明 |
|------|---------|------|
| orig | 802,052 | 原版注 |
| mod | 576,460 | 修订注 |
| add | 355,504 | 增补注 |
| dharani | 16,138 | 陀罗尼标注 |
| variantRemark | 13,395 | 异文备注 |
| correctionRemark | 7,857 | 校正备注 |

**byline 署名类型：**

| 类型 | 出现次数 | 说明 |
|------|---------|------|
| dharani | 15,974 | 陀罗尼 |
| Translator | 4,966 | 译者 |
| author | 4,906 | 作者 |
| Collector | 358 | 集录者 |
| Editor | 152 | 编辑者 |
| Other | 105 | 其他 |
| 再治 | 45 | 再次修订 |
| 記 | 38 | 记录者 |
| Scribe | 14 | 抄写者 |

#### F. 语言维度 (9种)

| 语言代码 | 出现次数 | 说明 |
|---------|---------|------|
| zh-Hant | 4,996 | 繁体中文 |
| en | 4,996 | 英文 |
| sa-Sidd | 149 | 悉昙梵文 |
| sa | 52 | 梵文 |
| sa-x-rj | 19 | 罗马转写梵文 |
| pi | 12 | 巴利文 |
| zh-x-yy | 3 | 音译 |
| x-unknown | 3 | 未知 |
| san-tr | 1 | 梵文转写 |

#### G. 文献关联关系

**关联类型：**

1. **同本异译** `[Nos. 250, 252-255]`
   - 同一原典的不同翻译版本
   - 例：般若经系列

2. **参考关联** `[cf. No. 1585]`
   - 相关参考文献
   - 例：注疏与原典

3. **子章节引用** `[No. 278(11)]`
   - 引用特定章节
   - 例：华严经某品

4. **跨藏引用** `<ref cRef="PTS.Vin.1.1"/>`
   - 巴利圣典协会引用
   - 用于南传藏经

**关联格式示例：**

```
No. 251 [Nos. 250, 252-255, 257]          # 异译本组
No. 1831 [cf. No. 1585]                    # 参考关系
No. 284 [Nos. 278(11), 279(15), 281(2)]   # 章节引用
No. 1596 [Nos. 1595, 1597; cf. Nos. 1592-1594, 1598]  # 复合关联
```

#### H. 校勘版本维度 (40+种)

**主要版本标识：**

| 标识 | 出现次数 | 说明 |
|------|---------|------|
| 【大】 | 696,824 | 大正藏底本 |
| 【CB】 | 331,726 | CBETA 校订 |
| 【卍續】 | 198,065 | 卍续藏 |
| 【宋】【元】【明】【宮】 | 131,509 | 宋元明宫四本 |
| 【甲】 | 100,023 | 甲本 |
| 【宋】【元】【明】 | 89,013 | 宋元明三本 |
| 【明】 | 58,592 | 明本 |
| 【聖】 | 49,546 | 圣本 |
| 【宮】 | 38,977 | 宫本 |
| 【補編】 | 28,178 | 补编 |
| 【嘉興】 | 27,256 | 嘉兴藏 |
| 【國圖】 | 21,869 | 国家图书馆 |
| 【乙】 | 19,815 | 乙本 |
| 【麗】 | 3,214 | 高丽藏 |
| 【龍】 | 5,935 | 乾隆藏 |
| 【北藏】 | 4,000 | 永乐北藏 |
| 【石】 | 4,456 | 房山石经 |

#### I. 特殊内容标记

**特殊字符 (gaiji)：**
- 总数：205,806 处
- CB开头：CBETA 造字 (如 #CB16765)
- SD开头：悉昙梵字 (如 #SD-A5E5)

**音注标记 (cb:yin)：**
- 用于标注反切读音
- 格式：`<cb:yin><cb:zi>婆</cb:zi><cb:sg>蒲我切</cb:sg></cb:yin>`

**多语对照 (cb:tt)：**
- 汉梵对照
- 格式：`<cb:tt><cb:t xml:lang="zh-Hant">緣起</cb:t><cb:t xml:lang="sa">Nidāna</cb:t></cb:tt>`

**偈颂停顿 (caesura)：**
- 标记偈颂句中的停顿
- 格式：`<caesura/>`

#### J. 标题层级 (title level)

| level | 出现次数 | 说明 |
|-------|---------|------|
| m | 56,612 | 经典标题 (monograph) |
| s | 10,202 | 丛书标题 (series) |
| a | 10,167 | 篇章标题 (article) |
| j | 964 | 期刊标题 (journal) |
| 1-6 | 1,454 | 子标题层级 |

#### K. 人物身份维度

| 身份类型 | 说明 |
|---------|------|
| 菩薩 | 最高精神修行者 (观自在菩萨、地藏菩萨等) |
| 論師 | 佛学理论家 (护法论师、世亲论师等) |
| 三藏法師 | 掌握经律论三藏的翻译家 |
| 沙門 | 出家修行者 (68,100次) |
| 和尚/大師 | 寺院主持或高级教师 |
| 國師 | 皇帝身边的精神导师 |
| 法師 | 精通法理的教师 |

#### L. 人物协作关系

| 协作类型 | 说明 | 示例 |
|---------|------|------|
| 共译 | 多人平等参与翻译 | 鳩摩羅什与佛陀耶舍 |
| 主译+助翻 | 主译者指导+助手参与 | 玄奘与其弟子团队 |
| 分工型 | 笔受、证义、润文等 | 角色清晰分工 |
| 后代补译 | 原译不全后人补充 | 地婆訶羅补译华严 |

#### M. 地理来源维度

| 地域 | 出现次数 | 说明 |
|------|---------|------|
| 天竺/印度 | 13,834 | 佛教圣地 |
| 西域 | 21,565 | 龜茲、于闐等 |
| 长安 | - | 唐代译经中心 |
| 洛阳 | - | 北朝译经重镇 |

**主要译经寺院：**
- 西太原寺 (长安)
- 大慈恩寺 (长安) - 玄奘译场
- 大兴善寺 (长安) - 不空、金剛智

**经典中的印度圣地：**
- 舍卫国 (Sravasti)
- 王舍城 (Rajagrha)
- 祇园精舍 (Jetavana)
- 灵鹫山 (Vulture Peak)
- 那兰陀寺 (Nalanda)

#### N. 时间纪年维度

**年号使用频率：**

| 年号 | 频率 | 朝代 |
|------|------|------|
| 貞觀 | 2,928 | 唐 (67.6%) |
| 元祿 | 336 | 日本江户 |
| 景龍 | 323 | 唐 |
| 永隆 | 260 | 唐 |
| 大治 | 131 | 日本平安 |

**时间格式：**
- 完整格式：`大唐景龍四年歲次庚戌四月壬午朔十五日景申`
- 简化格式：`大唐龍朔元年，歲次辛酉，六月一日`
- XML 修订：ISO 8601 格式 `2013-05-20`

#### O. 文献引用关系

| 引用类型 | 数量 | 格式示例 |
|---------|------|---------|
| 同本异译 | 934 | `[Nos. 250, 252-255]` |
| 参考关联 | 268 | `[cf. No. 1585]` |
| 等价引用 | 249 | `<note type="equivalent">` |
| 章节引用 | - | `[No. 278(11)]` |
| 跨藏引用 | - | `ed="X"` / `ed="T"` |

#### P. 段落类型维度

| cb:type | 数量 | 说明 |
|---------|------|------|
| author | 21,544 | 作者段落 |
| dharani | 20,112 | 陀罗尼 |
| head1-5 | 1,759-6,496 | 标题层级 |
| pre | 3,879 | 科判树形结构 |
| question | 4,796 | 问题 |
| answer | 7,160 | 回答 |

#### Q. 佛教计量单位

| 单位 | 出现次数 | 说明 |
|------|---------|------|
| 由旬 (Yojana) | 31,961 | 距离单位 |
| 劫 | 808,312 | 时间单位 |
| 恒河沙 | 7 | 数量比喻 |

---

## 二、数据库设计 (PostgreSQL + pgvector)

### 2.1 技术选型

**数据库**: PostgreSQL 16+
**向量扩展**: pgvector
**连接池**: 推荐使用 PgBouncer 或 Drizzle ORM 内置连接池

**初始化脚本：**
```sql
-- 启用扩展
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- 用于模糊搜索

-- 设置默认 schema
SET search_path TO public;
```

### 2.2 核心实体

```
┌─────────────────────────────────────────────────────────────┐
│                      CBETA 数据模型                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐               │
│  │ Canons  │────→│ Sutras  │←────│ Persons │               │
│  │ (藏经)  │     │ (经典)  │     │ (人物)  │               │
│  └─────────┘     └────┬────┘     └─────────┘               │
│                       │                                     │
│  ┌─────────┐     ┌────┴────┐     ┌─────────┐               │
│  │Dynasties│←────│Relations│────→│Languages│               │
│  │ (朝代)  │     │ (关联)  │     │ (语言)  │               │
│  └─────────┘     └─────────┘     └─────────┘               │
│                       │                                     │
│  ┌─────────┐     ┌────┴────┐     ┌─────────┐               │
│  │  Roles  │     │ Chunks  │     │Categories│              │
│  │ (角色)  │     │ (向量)  │     │ (分类)  │               │
│  └─────────┘     └─────────┘     └─────────┘               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 表结构定义

> **设计原则**：
> 1. 所有自引用外键使用 `DEFERRABLE INITIALLY DEFERRED` 支持批量插入
> 2. 关联表统一添加 `ON DELETE CASCADE` 级联删除
> 3. 所有业务表添加 `created_at` / `updated_at` 时间戳
> 4. 高频查询字段添加索引

#### 藏经表 (canons)

```sql
CREATE TABLE canons (
  id TEXT PRIMARY KEY,              -- T, X, J, N, ...
  title TEXT NOT NULL,              -- Taishō Tripiṭaka
  title_zh TEXT NOT NULL,           -- 大正新脩大藏經
  short_title_zh TEXT,              -- 大正藏
  abbreviation TEXT,                -- 【大】
  volumes INTEGER,                  -- 85

  category TEXT,                    -- 北传/南传/藏传/当代
  origin TEXT,                      -- 日本/中国/韩国
  period TEXT,                      -- 古代/近现代

  description TEXT,
  sort_order INTEGER,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_canons_category ON canons(category);
```

#### 经典表 (sutras)

```sql
CREATE TABLE sutras (
  id TEXT PRIMARY KEY,              -- T01n0001
  canon_id TEXT NOT NULL REFERENCES canons(id) ON DELETE RESTRICT,
  volume INTEGER NOT NULL,          -- 1
  number TEXT NOT NULL,             -- 1, 1005A, 1005B

  -- 标题
  title TEXT NOT NULL,              -- 长阿含经
  title_traditional TEXT,           -- 長阿含經
  title_sanskrit TEXT,              -- Dīrgha-āgama
  title_pali TEXT,                  -- Dīgha-nikāya
  title_alt TEXT,                   -- 别名

  -- 元数据
  juan_count INTEGER,               -- 22
  page_start TEXT,                  -- 0001a
  page_end TEXT,                    -- 0149c

  -- 分类
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,

  -- 内容类型
  content_type TEXT,                -- sutra/vinaya/abhidharma/commentary/misc
  has_dharani BOOLEAN DEFAULT false,
  has_verse BOOLEAN DEFAULT false,

  -- 来源
  source_text TEXT,                 -- 大正新脩大藏经

  -- 翻译信息 (新增关联)
  translation_place_id TEXT REFERENCES places(id) ON DELETE SET NULL,
  translation_era_id TEXT REFERENCES era_names(id) ON DELETE SET NULL,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sutras_canon ON sutras(canon_id);
CREATE INDEX idx_sutras_category ON sutras(category_id);
CREATE INDEX idx_sutras_content_type ON sutras(content_type);
CREATE INDEX idx_sutras_translation_place ON sutras(translation_place_id);
CREATE INDEX idx_sutras_translation_era ON sutras(translation_era_id);
```

#### 人物表 (persons)

```sql
CREATE TABLE persons (
  id TEXT PRIMARY KEY,              -- kumarajiva

  -- 姓名
  name TEXT NOT NULL,               -- 鸠摩罗什
  name_traditional TEXT,            -- 鳩摩羅什
  name_sanskrit TEXT,               -- Kumārajīva
  name_pali TEXT,
  name_tibetan TEXT,
  name_alias TEXT[],                -- 别名数组

  -- 时间
  dynasty_id TEXT REFERENCES dynasties(id) ON DELETE SET NULL,
  birth_year INTEGER,
  death_year INTEGER,
  floruit TEXT,                     -- 活跃年代描述

  -- 身份
  nationality TEXT,                 -- 龟兹/天竺/中土
  identity TEXT,                    -- 僧侣/居士/菩萨/阿罗汉
  school TEXT,                      -- 中观/唯识/天台/华严

  -- 地理关联 (新增)
  birthplace_id TEXT REFERENCES places(id) ON DELETE SET NULL,
  active_place_id TEXT REFERENCES places(id) ON DELETE SET NULL,

  -- 简介
  bio TEXT,
  bio_source TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_persons_dynasty ON persons(dynasty_id);
CREATE INDEX idx_persons_identity ON persons(identity);
CREATE INDEX idx_persons_school ON persons(school);
CREATE INDEX idx_persons_birthplace ON persons(birthplace_id);
```

#### 经典-人物关联表 (sutra_persons)

```sql
CREATE TABLE sutra_persons (
  id SERIAL PRIMARY KEY,
  sutra_id TEXT NOT NULL REFERENCES sutras(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,

  -- 角色
  role_id TEXT REFERENCES roles(id) ON DELETE SET NULL,
  role_text TEXT,                      -- 原文: 譯、造、述

  -- 排序
  is_primary BOOLEAN DEFAULT true,
  position INTEGER DEFAULT 0,

  -- 元数据
  raw_text TEXT,                       -- 原始署名文本

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(sutra_id, person_id, role_id)
);

CREATE INDEX idx_sutra_persons_sutra ON sutra_persons(sutra_id);
CREATE INDEX idx_sutra_persons_person ON sutra_persons(person_id);
CREATE INDEX idx_sutra_persons_role ON sutra_persons(role_id);
```

#### 角色表 (roles)

```sql
CREATE TABLE roles (
  id TEXT PRIMARY KEY,              -- translator
  name TEXT NOT NULL,               -- 译者
  name_traditional TEXT,            -- 譯者
  name_english TEXT,                -- Translator

  -- 角色标识
  role_markers TEXT[],              -- ['譯', '翻', '同譯', '重譯']

  category TEXT,                    -- translation/authoring/editing/recording
  description TEXT,
  sort_order INTEGER,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_roles_category ON roles(category);

-- 预置角色
INSERT INTO roles (id, name, name_traditional, name_english, role_markers, category, description, sort_order) VALUES
  ('translator', '译者', '譯者', 'Translator', ARRAY['譯','翻','同譯','重譯','合譯','口譯','傳譯','筆受'], 'translation', '翻译经典', 1),
  ('author', '作者', '作者', 'Author', ARRAY['造','著','撰','作'], 'authoring', '原创著作', 2),
  ('compiler', '编者', '編者', 'Compiler', ARRAY['編','集','輯','會','合','重編'], 'editing', '编辑整理', 3),
  ('commentator', '注释者', '註釋者', 'Commentator', ARRAY['註','疏','解','釋','科'], 'authoring', '注释讲解', 4),
  ('recorder', '记录者', '記錄者', 'Recorder', ARRAY['錄','記','述'], 'recording', '记录整理', 5),
  ('scribe', '抄写者', '抄寫者', 'Scribe', ARRAY['書','寫','抄'], 'recording', '抄写传承', 6),
  ('editor', '校订者', '校訂者', 'Editor', ARRAY['校','勘','治','重治'], 'editing', '校勘修订', 7),
  ('collaborator', '协作者', '協作者', 'Collaborator', ARRAY['共','同','助'], 'translation', '协作翻译', 8);
```

#### 朝代表 (dynasties)

```sql
CREATE TABLE dynasties (
  id TEXT PRIMARY KEY,              -- tang

  -- 名称
  name TEXT NOT NULL,               -- 唐
  name_traditional TEXT,            -- 唐
  name_english TEXT,                -- Tang
  name_full TEXT,                   -- 唐朝

  -- 时间
  start_year INTEGER,               -- 618
  end_year INTEGER,                 -- 907

  -- 地域
  region TEXT,                      -- 中原/江南/西北
  capital TEXT,                     -- 长安
  territory TEXT,                   -- 中国

  -- 层级 (自引用使用 DEFERRABLE 支持批量插入)
  parent_id TEXT REFERENCES dynasties(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,
  period TEXT,                      -- 魏晋南北朝/隋唐/...

  sort_order INTEGER,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_dynasties_period ON dynasties(period);
CREATE INDEX idx_dynasties_territory ON dynasties(territory);
CREATE INDEX idx_dynasties_years ON dynasties(start_year, end_year);

-- 预置朝代 (按年代排序)
INSERT INTO dynasties (id, name, name_traditional, name_english, name_full, start_year, end_year, region, capital, territory, parent_id, period, sort_order) VALUES
  ('han-later', '后汉', '後漢', 'Later Han', '东汉', 25, 220, '中原', '洛阳', '中国', NULL, '秦汉', 1),
  ('wu', '吴', '吳', 'Wu', '东吴', 222, 280, '江南', '建业', '中国', NULL, '三国', 2),
  ('wei-cao', '曹魏', '曹魏', 'Cao Wei', '曹魏', 220, 265, '中原', '洛阳', '中国', NULL, '三国', 3),
  ('jin-west', '西晋', '西晉', 'Western Jin', '西晋', 265, 316, '中原', '洛阳', '中国', NULL, '魏晋', 4),
  ('jin-east', '东晋', '東晉', 'Eastern Jin', '东晋', 317, 420, '江南', '建康', '中国', NULL, '魏晋', 5),
  ('qin-former', '前秦', '前秦', 'Former Qin', '前秦', 351, 394, '关中', '长安', '中国', NULL, '十六国', 6),
  ('qin-later', '后秦', '後秦', 'Later Qin', '姚秦', 384, 417, '关中', '长安', '中国', NULL, '十六国', 7),
  ('qin-west', '西秦', '西秦', 'Western Qin', '乞伏秦', 385, 431, '陇西', '苑川', '中国', NULL, '十六国', 8),
  ('liang-north', '北凉', '北涼', 'Northern Liang', '北凉', 397, 439, '河西', '姑臧', '中国', NULL, '十六国', 9),
  ('song-liu', '刘宋', '劉宋', 'Liu Song', '刘宋', 420, 479, '江南', '建康', '中国', NULL, '南朝', 10),
  ('qi-xiao', '萧齐', '蕭齊', 'Southern Qi', '南齐', 479, 502, '江南', '建康', '中国', NULL, '南朝', 11),
  ('liang-xiao', '梁', '梁', 'Liang', '萧梁', 502, 557, '江南', '建康', '中国', NULL, '南朝', 12),
  ('chen', '陈', '陳', 'Chen', '南陈', 557, 589, '江南', '建康', '中国', NULL, '南朝', 13),
  ('wei-north', '北魏', '北魏', 'Northern Wei', '元魏', 386, 534, '北方', '平城/洛阳', '中国', NULL, '北朝', 14),
  ('zhou-north', '北周', '北周', 'Northern Zhou', '北周', 557, 581, '关中', '长安', '中国', NULL, '北朝', 15),
  ('sui', '隋', '隋', 'Sui', '隋朝', 581, 618, '中原', '大兴/洛阳', '中国', NULL, '隋唐', 16),
  ('tang', '唐', '唐', 'Tang', '唐朝', 618, 907, '中原', '长安', '中国', NULL, '隋唐', 17),
  ('song', '宋', '宋', 'Song', '宋朝', 960, 1279, '中原/江南', '开封/临安', '中国', NULL, '宋元', 18),
  ('yuan', '元', '元', 'Yuan', '元朝', 1271, 1368, '全国', '大都', '中国', NULL, '宋元', 19),
  ('ming', '明', '明', 'Ming', '明朝', 1368, 1644, '全国', '南京/北京', '中国', NULL, '明清', 20),
  ('qing', '清', '清', 'Qing', '清朝', 1644, 1912, '全国', '北京', '中国', NULL, '明清', 21),
  ('minguo', '民国', '民國', 'Republic', '中华民国', 1912, 1949, '全国', '南京', '中国', NULL, '近现代', 22),
  -- 外国
  ('india', '天竺', '天竺', 'India', '印度', NULL, NULL, '南亚', NULL, '印度', NULL, '外国', 100),
  ('silla', '新罗', '新羅', 'Silla', '新罗', 57, 935, '朝鲜半岛', '庆州', '韩国', NULL, '外国', 101),
  ('goryeo', '高丽', '高麗', 'Goryeo', '高丽', 918, 1392, '朝鲜半岛', '开京', '韩国', NULL, '外国', 102),
  ('japan', '日本', '日本', 'Japan', '日本', NULL, NULL, '日本列岛', NULL, '日本', NULL, '外国', 103);
```

#### 分类表 (categories)

```sql
CREATE TABLE categories (
  id TEXT PRIMARY KEY,              -- ahan

  -- 名称
  name TEXT NOT NULL,               -- 阿含部
  name_traditional TEXT,            -- 阿含部
  name_english TEXT,                -- Āgama

  -- 层级 (自引用使用 DEFERRABLE)
  parent_id TEXT REFERENCES categories(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,
  level INTEGER DEFAULT 1,          -- 1: 大类, 2: 子类

  -- 归属
  canon_id TEXT REFERENCES canons(id) ON DELETE SET NULL,

  -- 大正藏卷号范围
  taisho_vol_start INTEGER,         -- 1
  taisho_vol_end INTEGER,           -- 2

  description TEXT,
  sort_order INTEGER,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_categories_canon ON categories(canon_id);
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_level ON categories(level);

-- 大正藏分类体系 (21部)
INSERT INTO categories (id, name, name_traditional, name_english, parent_id, level, canon_id, taisho_vol_start, taisho_vol_end, description, sort_order) VALUES
  ('ahan', '阿含部', '阿含部', 'Āgama', NULL, 1, 'T', 1, 2, '原始佛教经典', 1),
  ('benyuan', '本缘部', '本緣部', 'Jātaka', NULL, 1, 'T', 3, 4, '本生因缘', 2),
  ('bore', '般若部', '般若部', 'Prajñā', NULL, 1, 'T', 5, 8, '般若经典', 3),
  ('fahua', '法华部', '法華部', 'Saddharmapuṇḍarīka', NULL, 1, 'T', 9, 9, '法华经典', 4),
  ('huayan', '华严部', '華嚴部', 'Avataṃsaka', NULL, 1, 'T', 9, 10, '华严经典', 5),
  ('baoji', '宝积部', '寶積部', 'Ratnakūṭa', NULL, 1, 'T', 11, 12, '宝积经典', 6),
  ('niepan', '涅槃部', '涅槃部', 'Nirvāṇa', NULL, 1, 'T', 12, 12, '涅槃经典', 7),
  ('daji', '大集部', '大集部', 'Mahāsannipāta', NULL, 1, 'T', 13, 13, '大集经典', 8),
  ('jingji', '经集部', '經集部', 'Sūtra Collection', NULL, 1, 'T', 14, 17, '经集', 9),
  ('mimi', '密教部', '密教部', 'Tantra', NULL, 1, 'T', 18, 21, '密教经典', 10),
  ('lv', '律部', '律部', 'Vinaya', NULL, 1, 'T', 22, 24, '律藏', 11),
  ('shizong', '释经论部', '釋經論部', 'Commentary', NULL, 1, 'T', 25, 26, '经论释', 12),
  ('pitan', '毗昙部', '毘曇部', 'Abhidharma', NULL, 1, 'T', 26, 29, '论藏', 13),
  ('zhongguan', '中观部', '中觀部', 'Madhyamaka', NULL, 1, 'T', 30, 30, '中观论', 14),
  ('yuqie', '瑜伽部', '瑜伽部', 'Yogācāra', NULL, 1, 'T', 30, 31, '唯识论', 15),
  ('lunji', '论集部', '論集部', 'Śāstra Collection', NULL, 1, 'T', 32, 32, '论集', 16),
  ('jinglu', '经录部', '經錄部', 'Catalogue', NULL, 1, 'T', 49, 49, '经录', 17),
  ('shijuan', '史传部', '史傳部', 'History', NULL, 1, 'T', 49, 52, '史传', 18),
  ('shilun', '事汇部', '事彙部', 'Encyclopedia', NULL, 1, 'T', 53, 54, '事汇', 19),
  ('waijiao', '外教部', '外教部', 'Non-Buddhist', NULL, 1, 'T', 54, 54, '外教', 20),
  ('mulubu', '目录部', '目錄部', 'Catalogue', NULL, 1, 'T', 55, 55, '目录', 21);
```

#### 文献关联表 (sutra_relations)

```sql
CREATE TABLE sutra_relations (
  id SERIAL PRIMARY KEY,

  source_id TEXT NOT NULL REFERENCES sutras(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES sutras(id) ON DELETE CASCADE,

  -- 关联类型
  relation_type TEXT NOT NULL,      -- same_origin/commentary/reference/continuation/parallel

  -- 细分
  relation_subtype TEXT,            -- 同本异译/注疏/参考/续编

  -- 元数据
  raw_text TEXT,                    -- 原始关联文本
  target_section TEXT,              -- 目标章节 (如 278(11))

  confidence FLOAT DEFAULT 1.0,     -- 置信度

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(source_id, target_id, relation_type)
);

CREATE INDEX idx_relations_source ON sutra_relations(source_id);
CREATE INDEX idx_relations_target ON sutra_relations(target_id);
CREATE INDEX idx_relations_type ON sutra_relations(relation_type);

-- 关联类型说明
-- same_origin: 同本异译 [Nos. 250, 252-255]
-- commentary: 注疏关系 [cf. No. 1585]
-- reference: 参考引用
-- continuation: 续编关系
-- parallel: 对应关系 (南传/北传)
```

#### 语言表 (languages)

```sql
CREATE TABLE languages (
  id TEXT PRIMARY KEY,              -- zh-Hant
  name TEXT NOT NULL,               -- 繁体中文
  name_english TEXT,                -- Traditional Chinese
  script TEXT,                      -- 汉字/梵文/巴利文
  is_original BOOLEAN DEFAULT false, -- 是否原典语言
  sort_order INTEGER,

  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO languages (id, name, name_english, script, is_original, sort_order) VALUES
  ('zh-Hant', '繁体中文', 'Traditional Chinese', '汉字', false, 1),
  ('zh-Hans', '简体中文', 'Simplified Chinese', '汉字', false, 2),
  ('sa', '梵文', 'Sanskrit', '天城体', true, 3),
  ('sa-Sidd', '悉昙梵文', 'Siddham Sanskrit', '悉昙', true, 4),
  ('sa-x-rj', '罗马转写梵文', 'Romanized Sanskrit', '拉丁', true, 5),
  ('pi', '巴利文', 'Pali', '巴利', true, 6),
  ('bo', '藏文', 'Tibetan', '藏文', true, 7),
  ('en', '英文', 'English', '拉丁', false, 8);
```

#### 经典语言关联表 (sutra_languages)

```sql
CREATE TABLE sutra_languages (
  id SERIAL PRIMARY KEY,
  sutra_id TEXT NOT NULL REFERENCES sutras(id) ON DELETE CASCADE,
  language_id TEXT NOT NULL REFERENCES languages(id) ON DELETE CASCADE,

  content_type TEXT NOT NULL,       -- full/term/dharani/verse
  -- full: 全文
  -- term: 术语对照
  -- dharani: 陀罗尼
  -- verse: 偈颂

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(sutra_id, language_id, content_type)
);

CREATE INDEX idx_sutra_languages_sutra ON sutra_languages(sutra_id);
CREATE INDEX idx_sutra_languages_lang ON sutra_languages(language_id);
```

#### 目录表 (toc_entries)

```sql
CREATE TABLE toc_entries (
  id SERIAL PRIMARY KEY,
  sutra_id TEXT NOT NULL REFERENCES sutras(id) ON DELETE CASCADE,

  -- 层级
  level INTEGER NOT NULL,           -- 1, 2, 3, 4, 5, 6
  type TEXT NOT NULL,               -- 卷/分/品/經/序/附文/科判

  -- 内容
  title TEXT NOT NULL,              -- 大本经
  title_number TEXT,                -- 1 (品/分的序号)

  -- 位置
  juan_number INTEGER,              -- 所在卷号
  page_id TEXT,                     -- 页码 0001b
  line_start TEXT,                  -- 起始行
  anchor TEXT,                      -- 页面内锚点 (lb的n属性)

  -- 层级关系 (自引用使用 DEFERRABLE)
  parent_id INTEGER REFERENCES toc_entries(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  sort_order INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_toc_sutra ON toc_entries(sutra_id);
CREATE INDEX idx_toc_parent ON toc_entries(parent_id);
CREATE INDEX idx_toc_type ON toc_entries(type);
CREATE INDEX idx_toc_juan ON toc_entries(juan_number);
```

#### 校勘版本表 (witnesses)

```sql
CREATE TABLE witnesses (
  id TEXT PRIMARY KEY,              -- dazheng

  -- 名称
  name TEXT NOT NULL,               -- 大正藏
  abbreviation TEXT NOT NULL,       -- 【大】

  -- 类型
  type TEXT NOT NULL,               -- base/variant/cbeta
  -- base: 底本
  -- variant: 异本
  -- cbeta: CBETA校订

  -- 来源
  canon_id TEXT REFERENCES canons(id) ON DELETE SET NULL,

  description TEXT,
  sort_order INTEGER,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_witnesses_type ON witnesses(type);
CREATE INDEX idx_witnesses_canon ON witnesses(canon_id);

-- 预置版本
INSERT INTO witnesses (id, name, abbreviation, type, canon_id, description, sort_order) VALUES
  ('dazheng', '大正藏', '【大】', 'base', 'T', '大正新脩大藏经底本', 1),
  ('cbeta', 'CBETA', '【CB】', 'cbeta', NULL, 'CBETA校订', 2),
  ('song', '宋本', '【宋】', 'variant', NULL, '宋代刻本', 3),
  ('yuan', '元本', '【元】', 'variant', NULL, '元代刻本', 4),
  ('ming', '明本', '【明】', 'variant', NULL, '明代刻本', 5),
  ('gong', '宫本', '【宮】', 'variant', NULL, '宫内省本', 6),
  ('sheng', '圣本', '【聖】', 'variant', NULL, '圣语藏本', 7),
  ('li', '丽本', '【麗】', 'variant', 'K', '高丽藏本', 8),
  ('long', '龙本', '【龍】', 'variant', 'L', '乾隆藏本', 9),
  ('shi', '石本', '【石】', 'variant', 'F', '房山石经', 10);
```

#### 特殊字符表 (gaiji)

```sql
CREATE TABLE gaiji (
  id TEXT PRIMARY KEY,              -- CB16765, SD-A5E5

  -- 类型
  type TEXT NOT NULL,               -- cb/sd/rj/other
  -- cb: CBETA造字
  -- sd: 悉昙梵字
  -- rj: 罗马转写
  -- other: 其他

  -- Unicode
  unicode TEXT,                     -- U+XXXX (如有对应)
  unicode_char TEXT,                -- 实际字符
  pua_code TEXT,                    -- PUA 私用区编码

  -- 描述
  description TEXT,                 -- 字形描述
  components TEXT,                  -- 部件说明
  normalized TEXT,                  -- 近似替代字符

  -- 图片
  svg_path TEXT,                    -- SVG 字形路径
  image_url TEXT,                   -- 字形图片URL

  -- 统计
  usage_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_gaiji_type ON gaiji(type);
CREATE INDEX idx_gaiji_unicode ON gaiji(unicode);
```

#### 术语对照表 (terms)

```sql
CREATE TABLE terms (
  id TEXT PRIMARY KEY,

  -- 多语言
  zh_hant TEXT,                     -- 繁体中文
  zh_hans TEXT,                     -- 简体中文
  sanskrit TEXT,                    -- 梵文
  pali TEXT,                        -- 巴利文
  tibetan TEXT,                     -- 藏文
  english TEXT,                     -- 英文

  -- 分类
  category TEXT NOT NULL,           -- person/place/concept/dharani

  -- 说明
  definition TEXT,
  notes TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_terms_category ON terms(category);
CREATE INDEX idx_terms_zh_hant ON terms(zh_hant);
CREATE INDEX idx_terms_sanskrit ON terms(sanskrit);

-- 经典-术语关联表
CREATE TABLE sutra_terms (
  id SERIAL PRIMARY KEY,
  sutra_id TEXT NOT NULL REFERENCES sutras(id) ON DELETE CASCADE,
  term_id TEXT NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  page TEXT,                        -- 出现页码
  line TEXT,                        -- 出现行号
  frequency INTEGER DEFAULT 1,      -- 出现次数

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(sutra_id, term_id, page)
);

CREATE INDEX idx_sutra_terms_sutra ON sutra_terms(sutra_id);
CREATE INDEX idx_sutra_terms_term ON sutra_terms(term_id);
```

#### 标签表 (tags)

```sql
CREATE TABLE tags (
  id TEXT PRIMARY KEY,              -- meditation
  name TEXT NOT NULL,               -- 禅定
  name_traditional TEXT,            -- 禪定
  name_english TEXT,                -- Meditation

  category TEXT NOT NULL,           -- topic/school/practice
  description TEXT,
  sort_order INTEGER,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tags_category ON tags(category);

-- 经典-标签关联表
CREATE TABLE sutra_tags (
  sutra_id TEXT NOT NULL REFERENCES sutras(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  confidence FLOAT DEFAULT 1.0,     -- 标签置信度 (机器学习标注时使用)

  created_at TIMESTAMP DEFAULT NOW(),

  PRIMARY KEY (sutra_id, tag_id)
);

CREATE INDEX idx_sutra_tags_tag ON sutra_tags(tag_id);
```

#### 向量分块表 (chunks) - pgvector

```sql
-- 文本分块及向量存储
CREATE TABLE chunks (
  id TEXT PRIMARY KEY,              -- T01n0001-juan-1-p-12
  sutra_id TEXT REFERENCES sutras(id) ON DELETE CASCADE,

  -- 位置信息
  juan_number INTEGER,              -- 卷号
  section_title TEXT,               -- 章节标题
  page_id TEXT,                     -- 页码 (0001b12)

  -- 内容
  content TEXT NOT NULL,            -- 原文内容
  content_type TEXT NOT NULL,       -- paragraph/verse/dharani/quote
  char_count INTEGER,               -- 字符数

  -- 上下文
  context_before TEXT,              -- 前文片段 (用于 RAG)
  context_after TEXT,               -- 后文片段

  -- 向量 (pgvector)
  embedding vector(1536),           -- OpenAI text-embedding-3-small
  -- 或 embedding vector(1024),     -- BGE-M3 / Jina

  -- 元数据 (用于过滤)
  metadata JSONB DEFAULT '{}',      -- 灵活存储额外信息

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 向量索引 (IVFFlat 或 HNSW)
CREATE INDEX idx_chunks_embedding ON chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 或使用 HNSW (更快但占用更多内存)
-- CREATE INDEX idx_chunks_embedding_hnsw ON chunks
--   USING hnsw (embedding vector_cosine_ops)
--   WITH (m = 16, ef_construction = 64);

-- 其他索引
CREATE INDEX idx_chunks_sutra ON chunks(sutra_id);
CREATE INDEX idx_chunks_type ON chunks(content_type);
CREATE INDEX idx_chunks_metadata ON chunks USING gin(metadata);

-- 全文搜索索引 (中文需要 zhparser 或 pg_jieba)
CREATE INDEX idx_chunks_content ON chunks USING gin(to_tsvector('simple', content));
```

#### 搜索历史表 (search_logs)

```sql
CREATE TABLE search_logs (
  id SERIAL PRIMARY KEY,
  query TEXT NOT NULL,
  query_embedding vector(1536),
  results_count INTEGER,
  top_results JSONB,                -- 前 N 个结果的 ID
  user_id TEXT,                     -- 可选用户标识
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_search_logs_time ON search_logs(created_at DESC);
```

### 2.4 向量搜索示例

```sql
-- 语义搜索：找最相似的 10 个分块
SELECT
  c.id,
  c.content,
  c.sutra_id,
  s.title as sutra_title,
  1 - (c.embedding <=> $1) as similarity
FROM chunks c
JOIN sutras s ON c.sutra_id = s.id
WHERE c.embedding IS NOT NULL
ORDER BY c.embedding <=> $1  -- 余弦距离
LIMIT 10;

-- 带过滤的语义搜索
SELECT
  c.id,
  c.content,
  1 - (c.embedding <=> $1) as similarity
FROM chunks c
JOIN sutras s ON c.sutra_id = s.id
WHERE c.embedding IS NOT NULL
  AND s.canon_id = 'T'              -- 只搜大正藏
  AND c.content_type = 'paragraph'  -- 只搜段落
  AND (c.metadata->>'dynasty') = '唐'  -- 只搜唐代
ORDER BY c.embedding <=> $1
LIMIT 10;

-- 混合搜索 (向量 + 全文)
WITH semantic AS (
  SELECT id, content, 1 - (embedding <=> $1) as score
  FROM chunks
  WHERE embedding IS NOT NULL
  ORDER BY embedding <=> $1
  LIMIT 50
),
fulltext AS (
  SELECT id, content, ts_rank(to_tsvector('simple', content), plainto_tsquery('simple', $2)) as score
  FROM chunks
  WHERE to_tsvector('simple', content) @@ plainto_tsquery('simple', $2)
  LIMIT 50
)
SELECT
  COALESCE(s.id, f.id) as id,
  COALESCE(s.content, f.content) as content,
  COALESCE(s.score, 0) * 0.7 + COALESCE(f.score, 0) * 0.3 as combined_score
FROM semantic s
FULL OUTER JOIN fulltext f ON s.id = f.id
ORDER BY combined_score DESC
LIMIT 10;
```

### 2.5 数据库配置建议

```sql
-- PostgreSQL 配置优化 (postgresql.conf)

-- 内存设置
shared_buffers = '4GB'              -- 25% 系统内存
effective_cache_size = '12GB'       -- 75% 系统内存
work_mem = '256MB'                  -- 用于排序和向量操作
maintenance_work_mem = '1GB'        -- 用于创建索引

-- 向量搜索优化
-- ivfflat.probes = 10              -- 搜索时探测的列表数
-- hnsw.ef_search = 40              -- HNSW 搜索参数

-- 连接设置
max_connections = 100
```

---

## 三、前端渲染 JSON 结构

### 3.1 完整文档结构

```json
{
  "id": "T01n0001",
  "meta": {
    "canon": {
      "id": "T",
      "name": "大正新脩大藏经",
      "abbreviation": "【大】"
    },
    "volume": 1,
    "number": "1",

    "title": "长阿含经",
    "titleTraditional": "長阿含經",
    "titleSanskrit": "Dīrgha-āgama",
    "titlePali": "Dīgha-nikāya",

    "juanCount": 22,
    "category": "阿含部",
    "contentType": "sutra",

    "authors": [
      {
        "name": "佛陀耶舍",
        "role": "translator",
        "roleText": "譯",
        "dynasty": "后秦",
        "isPrimary": true
      },
      {
        "name": "竺佛念",
        "role": "translator",
        "roleText": "譯",
        "dynasty": "后秦",
        "isPrimary": false
      }
    ],

    "relations": [
      {
        "type": "parallel",
        "targetId": "N15n0006",
        "note": "南传长部对应"
      }
    ],

    "languages": ["zh-Hant", "sa", "pi"],
    "hasDharani": false,
    "hasVerse": true,

    "source": "大正新脩大藏经",
    "charCount": 234567
  },

  "toc": [
    {
      "id": "xu-1",
      "level": 1,
      "type": "序",
      "title": "长阿含经序",
      "author": "释僧肇"
    },
    {
      "id": "juan-1",
      "level": 1,
      "type": "卷",
      "title": "卷第一",
      "children": [
        {
          "id": "fen-1",
          "level": 2,
          "type": "分",
          "title": "第一分",
          "children": [
            {
              "id": "jing-1",
              "level": 3,
              "type": "經",
              "title": "大本经第一"
            }
          ]
        }
      ]
    }
  ],

  "content": [
    {
      "id": "xu-1",
      "type": "preface",
      "title": "长阿含经序",
      "byline": {
        "text": "长安释僧肇述",
        "parsed": {
          "place": "长安",
          "person": "释僧肇",
          "role": "述"
        }
      },
      "blocks": [
        {
          "type": "paragraph",
          "page": "0001a05",
          "text": "夫宗极绝于称谓，贤圣以之冲默；玄旨非言不传，释迦所以致教。"
        }
      ]
    },
    {
      "id": "juan-1",
      "type": "juan",
      "number": 1,
      "byline": {
        "text": "后秦弘始年佛陀耶舍共竺佛念译",
        "parsed": {
          "dynasty": "后秦",
          "era": "弘始年",
          "persons": [
            {"name": "佛陀耶舍", "role": "译"},
            {"name": "竺佛念", "role": "译"}
          ]
        }
      },
      "sections": [
        {
          "id": "fen-1",
          "type": "division",
          "title": "第一分",
          "sections": [
            {
              "id": "jing-1",
              "type": "sutra",
              "title": "大本经第一",
              "blocks": [
                {
                  "type": "paragraph",
                  "page": "0001b12",
                  "text": "如是我闻："
                },
                {
                  "type": "paragraph",
                  "page": "0001b12",
                  "text": "一时，佛在舍卫国祇树花林窟，与大比丘众千二百五十人俱。"
                },
                {
                  "type": "verse",
                  "style": "regular",
                  "page": "0001c03",
                  "lines": [
                    "比丘集法堂，讲说贤圣论；",
                    "如来处静室，天耳尽闻知。"
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ],

  "notes": {
    "0001001": {
      "type": "variant",
      "original": "此序依宋元明三本ニ依テ載ス"
    },
    "0001002": {
      "type": "variant",
      "original": "〔长安〕－【宋】",
      "parsed": {
        "base": "长安",
        "variants": [
          {"witness": "【宋】", "reading": "－"}
        ]
      }
    }
  },

  "terms": [
    {
      "zh": "舍卫",
      "sa": "Śrāvastī",
      "pi": "Sāvatthī",
      "page": "0001b12"
    }
  ],

  "gaiji": {
    "CB16765": {
      "type": "cb",
      "unicode": null,
      "description": "从水从鑒",
      "fallback": "鑑"
    },
    "SD-A5E5": {
      "type": "sd",
      "unicode": null,
      "description": "悉昙字母 ma"
    }
  }
}
```

### 3.2 内容块类型

```typescript
type ContentBlock =
  | ParagraphBlock
  | VerseBlock
  | DharaniBlock
  | QuoteBlock
  | ListBlock;

interface ParagraphBlock {
  type: 'paragraph';
  page: string;
  text: string;
  noteRefs?: string[];  // 注释引用
}

interface VerseBlock {
  type: 'verse';
  style: 'regular' | 'v4' | 'v5' | 'v7';
  page: string;
  lines: string[];
}

interface DharaniBlock {
  type: 'dharani';
  page: string;
  text: string;
  transliteration?: string;  // 音译
  siddham?: string;          // 悉昙文
}

interface QuoteBlock {
  type: 'quote';
  page: string;
  text: string;
  source?: string;
}

interface FanqieBlock {
  type: 'fanqie';
  page: string;
  char: string;       // 被注字
  reading: string;    // 反切 (如 "蒲我切")
}
```

### 3.3 校勘记结构

```typescript
interface Note {
  id: string;           // 0001002
  type: NoteType;       // 'orig' | 'mod' | 'add' | 'variant' | 'correction'

  // 原文
  original: string;     // 〔长安〕－【宋】

  // 解析后
  parsed?: {
    base: string;       // 底本文字
    variants: Variant[];
  };
}

interface Variant {
  witness: string;      // 【宋】【元】
  reading: string;      // 异文内容 (－ 表示删除)
  type?: string;        // 类型说明
}

// 校勘类型
type NoteType =
  | 'orig'           // 原版注释 (大正藏)
  | 'mod'            // CBETA修订
  | 'add'            // CBETA增补
  | 'variantRemark'  // 异文备注
  | 'correctionRemark'; // 校正备注
```

### 3.4 特殊字符处理

```typescript
interface GaijiChar {
  id: string;           // CB16765 或 SD-A5E5
  type: 'cb' | 'sd' | 'other';

  // 显示
  unicode?: string;     // Unicode 码点 (如有)
  fallback?: string;    // 替代字符
  imageUrl?: string;    // 字形图片

  // 描述
  description?: string; // 字形说明
}

// 在文本中的表示方式
// 原始: <g ref="#CB16765"/>
// JSON: "\uE001" (使用私用区) 或 "[CB16765]" (纯文本)
// 渲染: 查询 gaiji 表获取图片或替代字
```

---

## 四、Embedding 分块策略

### 4.1 分块规则

| 内容类型 | 分块策略 | chunk 大小 |
|---------|---------|-----------|
| 正文 | 按段落 | 100-800 字 |
| 偈颂 | 整首为一块 | 不限 |
| 陀罗尼 | 整段为一块 | 不限 |
| 长段落 | 按句号分割 | 最大 800 字 |

### 4.2 Chunk 结构

```json
{
  "id": "T01n0001-juan-1-p-12",
  "sutraId": "T01n0001",
  "sutraTitle": "长阿含经",

  "location": {
    "juan": 1,
    "section": "大本经",
    "page": "0001b12"
  },

  "content": {
    "type": "paragraph",
    "text": "一时，佛在舍卫国祇树花林窟，与大比丘众千二百五十人俱。时，诸比丘于乞食后集花林堂，各共议言...",
    "textLength": 156
  },

  "context": {
    "before": "如是我闻：",
    "after": "诸贤比丘！唯无上尊为最奇特，神通远达，威力弘大..."
  },

  "metadata": {
    "canon": "T",
    "category": "阿含部",
    "dynasty": "后秦",
    "translator": "佛陀耶舍",
    "contentType": "sutra",
    "hasVerse": false,
    "hasDharani": false
  }
}
```

### 4.3 PostgreSQL chunks 表数据

```sql
-- 插入分块数据
INSERT INTO chunks (id, sutra_id, juan_number, section_title, page_id,
                    content, content_type, char_count, context_before, context_after, metadata)
VALUES (
  'T01n0001-juan-1-p-12',
  'T01n0001',
  1,
  '大本经',
  '0001b12',
  '一时，佛在舍卫国祇树花林窟，与大比丘众千二百五十人俱。时，诸比丘于乞食后集花林堂，各共议言...',
  'paragraph',
  156,
  '如是我闻：',
  '诸贤比丘！唯无上尊为最奇特，神通远达，威力弘大...',
  '{"canon": "T", "category": "阿含部", "dynasty": "后秦", "translator": "佛陀耶舍"}'::jsonb
);

-- 更新向量 (通过应用层调用 embedding API 后)
UPDATE chunks
SET embedding = $1::vector
WHERE id = 'T01n0001-juan-1-p-12';
```

---

## 五、目录结构

```
yoho-cbeta/
├── data/                        # 原始繁体 JSON (现有)
├── data-simplified/             # 简体 JSON (现有)
├── data-display/                # 前端渲染 JSON (新)
│   ├── T/
│   │   ├── T01/
│   │   │   ├── T01n0001.json
│   │   │   └── ...
│   │   └── ...
│   └── ...
├── data-chunks/                 # Embedding 分块 JSONL (新)
│   ├── T/
│   │   ├── T01/
│   │   │   ├── T01n0001.jsonl
│   │   │   └── ...
│   │   └── ...
│   └── ...
├── database/                    # 数据库迁移和种子 (新)
│   ├── migrations/              # Drizzle 迁移文件
│   │   ├── 0001_initial.sql
│   │   └── 0002_add_vectors.sql
│   ├── schema.ts                # Drizzle schema 定义
│   └── seed/                    # 种子数据
│       ├── canons.json
│       ├── dynasties.json
│       ├── roles.json
│       ├── categories.json
│       ├── witnesses.json       # 校勘版本
│       └── gaiji.json           # 特殊字符
├── docs/
│   ├── data-design.md           # 本文档
│   └── api-design.md            # API 设计
└── packages/
    ├── backend/
    │   └── src/
    │       ├── db/
    │       │   ├── client.ts         # PostgreSQL 连接
    │       │   ├── schema.ts         # Drizzle schema
    │       │   └── vectors.ts        # 向量操作
    │       └── services/
    │           ├── search.ts         # 搜索服务
    │           └── embedding.ts      # Embedding 服务
    └── scripts/
        └── src/
            ├── extract-metadata.ts      # 元数据提取
            ├── parse-author.ts          # 作者字段解析
            ├── transform-display.ts     # 生成渲染 JSON
            ├── chunk-for-embedding.ts   # 分块
            ├── import-to-pg.ts          # 导入 PostgreSQL
            └── generate-embeddings.ts   # 批量生成向量
```

---

## 六、实施路线

### Phase 1: 数据库基础 (数据层)

1. 创建 SQLite 数据库和表结构
2. 导入种子数据 (藏经、朝代、角色、分类)
3. 从 canons.json 导入藏经信息
4. 编写作者字段解析器
5. 提取并导入所有经典元数据

### Phase 2: JSON 转换 (渲染层)

1. 设计新 JSON 结构
2. 编写转换器
3. 生成 data-display/ 目录
4. 验证转换正确性

### Phase 3: Embedding 分块 (检索层)

1. 设计分块策略
2. 编写分块脚本
3. 生成 data-chunks/ 目录
4. 集成 embedding API
5. 导入向量数据库

### Phase 4: API 开发 (服务层)

1. 阅读 API
2. 搜索 API
3. 浏览 API (人物/朝代/分类)
4. 语义检索 API

### Phase 5: 前端开发 (展示层)

1. 阅读界面
2. 搜索界面
3. 浏览界面
4. 移动端适配

---

## 七、统计与预估

### 7.1 数据规模

| 指标 | 数值 |
|------|------|
| 经典数量 | ~5,000 |
| 人物数量 (预估) | ~3,000 |
| 目录条目 (预估) | ~50,000 |
| 分块数量 (预估) | ~500,000 |

### 7.2 Embedding 成本预估

| 模型 | 价格 | 预估成本 |
|------|------|---------|
| text-embedding-3-small | $0.02/1M tokens | ~$6-10 |
| text-embedding-3-large | $0.13/1M tokens | ~$40-70 |
| BGE-M3 (本地) | 免费 | 硬件成本 |

### 7.3 存储预估 (PostgreSQL + pgvector)

| 数据 | 大小 | 说明 |
|------|------|------|
| PostgreSQL 元数据表 | ~200MB | sutras, persons, relations 等 |
| PostgreSQL chunks 表 (不含向量) | ~2GB | 文本分块 |
| PostgreSQL 向量数据 (1536d) | ~3GB | 50万分块 × 1536 × 4bytes |
| PostgreSQL 向量索引 (IVFFlat) | ~1GB | 索引开销 |
| 渲染 JSON 文件 | ~10GB | 前端静态资源 |
| 分块 JSONL 文件 | ~2GB | 备份/迁移用 |
| 特殊字符图片 | ~50MB | gaiji SVG |
| **PostgreSQL 总计** | **~6-7GB** | 含索引 |

### 7.4 PostgreSQL 硬件建议

| 规模 | CPU | 内存 | 存储 | 说明 |
|------|-----|------|------|------|
| 开发环境 | 2核 | 4GB | 20GB SSD | 本地测试 |
| 生产环境 (小) | 4核 | 16GB | 50GB SSD | 单用户/少量并发 |
| 生产环境 (中) | 8核 | 32GB | 100GB SSD | 中等并发 |

**向量搜索性能参考：**
- IVFFlat (lists=100): ~10-50ms / 查询
- HNSW (m=16): ~1-10ms / 查询
- 50万向量，1536维，召回 top-10

---

## 八、技术细节与注意事项

### 8.1 作者字段解析规则

```typescript
// 作者字段模式 (按优先级)
const AUTHOR_PATTERNS = [
  // 1. 论主 + 造 + 朝代 + 译者 + 譯
  /^(.+?)(菩薩|論師)?(造|著)\s*(.+?)\s+(.+?)(譯|翻)$/,

  // 2. 朝代 + 人名 + 角色
  /^(後秦|前秦|東晉|西晉|吳|後漢|曹魏|劉宋|蕭梁|梁|蕭齊|陳|北涼|北魏|元魏|北周|隋|唐|宋|元|明|清|民國)\s+(.+?)(譯|造|述|撰|集|編|著|錄|註|疏|解|校)$/,

  // 3. 共译模式
  /^(.+?)共(.+?)(譯|翻)$/,

  // 4. 侍者/门人模式
  /^\(?(侍者|門人)\)?(.+?)\s*(錄|編)$/,

  // 5. 失译
  /^失譯$/,

  // 6. 佚名
  /^佚名$/,
];

// 朝代别名映射
const DYNASTY_ALIASES = {
  '姚秦': '後秦',
  '乞伏秦': '西秦',
  '元魏': '北魏',
  '蕭梁': '梁',
  '蕭齊': '南齊',
  '天竺': '印度',
  '中天竺': '印度',
};
```

### 8.2 校勘记解析规则

```typescript
// 校勘记格式
// 1. 异文: 長安【大】，〔－〕【宋】
// 2. 增补: （釋）＋基【甲】
// 3. 脱文: 〔早〕－【甲】
// 4. 讹误: 磬【大】，罄【考偽-大】

const NOTE_PATTERNS = {
  // 删除标记
  deletion: /〔(.+?)〕－【(.+?)】/,

  // 增补标记
  addition: /（(.+?)）＋(.+?)【(.+?)】/,

  // 异文标记
  variant: /(.+?)【(.+?)】[，、](.+?)【(.+?)】/,

  // 校正标记
  correction: /(.+?)【大】[，、](.+?)【考偽-大】/,
};
```

### 8.3 PTS 引用系统

南传藏经使用 PTS (Pali Text Society) 引用系统：

```typescript
interface PTSReference {
  collection: string;  // Vin, D, M, S, A, etc.
  volume: number;
  page: number;
}

// 格式: PTS.Vin.1.1 → 律藏第1卷第1页
const PTS_COLLECTIONS = {
  'Vin': '律藏 Vinaya',
  'D': '长部 Dīgha Nikāya',
  'M': '中部 Majjhima Nikāya',
  'S': '相应部 Saṃyutta Nikāya',
  'A': '增支部 Aṅguttara Nikāya',
  'Kh': '小部 Khuddaka Nikāya',
  'Dhp': '法句经 Dhammapada',
  'It': '如是语 Itivuttaka',
  'Sn': '经集 Sutta Nipāta',
  'Th': '长老偈 Theragāthā',
  'Thī': '长老尼偈 Therīgāthā',
  'J': '本生经 Jātaka',
};
```

### 8.4 特殊字符处理策略

```typescript
// 1. 优先使用 Unicode
// 2. 无 Unicode 则使用 PUA (Private Use Area)
// 3. 纯文本模式使用 [ID] 标记

const GAIJI_STRATEGIES = {
  // 渲染模式: 使用 SVG/图片
  render: (id: string) => `<img src="/gaiji/${id}.svg" class="gaiji"/>`,

  // 纯文本模式: 使用替代字或标记
  plaintext: (id: string, fallback?: string) =>
    fallback || `[${id}]`,

  // Embedding 模式: 跳过或使用描述
  embedding: (id: string, description?: string) =>
    description || '',
};
```

### 8.5 数据质量检查清单

- [ ] 所有经典都有正确的 canon_id
- [ ] 作者字段都能被解析
- [ ] 朝代字段都能映射到 dynasties 表
- [ ] 校勘记都能被正确解析
- [ ] 特殊字符都有定义或替代方案
- [ ] 目录层级正确嵌套
- [ ] 页码格式统一
- [ ] 文献关联都能解析

---

## 九、FAQ

### Q: 为什么选择 PostgreSQL + pgvector?

A: 主要优势：
1. **一体化存储**：元数据和向量在同一数据库，无需维护多个系统
2. **事务支持**：向量更新和元数据更新可在同一事务中完成
3. **SQL 生态**：可使用 Drizzle/Prisma 等成熟 ORM
4. **过滤搜索**：向量搜索时可直接 JOIN 其他表进行过滤
5. **成本效益**：单个 PostgreSQL 实例即可，无需额外的向量数据库服务

### Q: pgvector vs 专用向量数据库 (Pinecone/Milvus)?

A:
- **50万向量规模**：pgvector 完全胜任，性能足够
- **百万级以上**：考虑 Milvus 或 Qdrant
- **Serverless 需求**：考虑 Pinecone 或 Supabase (内置 pgvector)
- **本项目推荐**：pgvector，因为规模可控且简化架构

### Q: 推荐的向量索引类型?

A:
- **IVFFlat**：适合静态数据，创建快，占用空间小
  - 参数：`lists = sqrt(rows)`，约 700 for 50万行
  - 查询时：`SET ivfflat.probes = 10`
- **HNSW**：适合需要高召回率和低延迟的场景
  - 参数：`m = 16, ef_construction = 64`
  - 占用更多内存，但查询更快

### Q: 特殊字符 (gaiji) 如何在前端显示?

A: 三种方案：
1. SVG 字形图片 (最精确)
2. Unicode PUA 编码 + 自定义字体
3. 近似替代字符

### Q: Embedding 时是否保留校勘记?

A: 不保留。Embedding 使用纯净文本，校勘记作为元数据存储在 `chunks.metadata` JSONB 字段中，用于精确引用时显示。

### Q: 如何处理同本异译的搜索?

A: 通过 sutra_relations 表的 same_origin 关系，搜索时可自动关联异译本，提供"查看其他译本"功能。

### Q: 南传藏经的 PTS 引用如何与北传对应?

A: 通过 sutra_relations 表的 parallel 关系，建立南传与北传对应经典的关联。

### Q: 如何部署 PostgreSQL + pgvector?

A: 推荐方案：
1. **本地开发**：Docker `pgvector/pgvector:pg16`
2. **生产环境**：
   - Supabase (内置 pgvector，免费额度)
   - Railway / Render PostgreSQL
   - AWS RDS PostgreSQL + pgvector 扩展
   - 自建 VPS (推荐 Hetzner/Vultr)

```bash
# Docker 本地开发
docker run -d \
  --name cbeta-pg \
  -e POSTGRES_PASSWORD=cbeta123 \
  -e POSTGRES_DB=cbeta \
  -p 5432:5432 \
  -v cbeta_pgdata:/var/lib/postgresql/data \
  pgvector/pgvector:pg16
```

---

## 十、XML 结构深度解析

### 10.1 teiHeader 元数据结构

```xml
<teiHeader>
  <fileDesc>
    <titleStmt>
      <title level="s">Taishō Tripiṭaka</title>
      <title level="s" xml:lang="zh-Hant">大正新脩大藏經</title>
      <title level="m" xml:lang="zh-Hant">長阿含經</title>
      <author>後秦 佛陀耶舍共竺佛念譯</author>
    </titleStmt>
    <extent>22卷</extent>
    <publicationStmt>
      <idno type="CBETA">
        <idno type="canon">T</idno>.<idno type="vol">1</idno>.<idno type="no">1</idno>
      </idno>
    </publicationStmt>
    <sourceDesc>
      <bibl>大正新脩大藏經</bibl>
    </sourceDesc>
  </fileDesc>
  <encodingDesc>
    <projectDesc>
      <p xml:lang="zh-Hant" cb:type="ly">CBETA 人工輸入</p>
    </projectDesc>
    <editorialDecl>
      <punctuation resp="CBETA"><p>新式標點</p></punctuation>
    </editorialDecl>
    <tagsDecl>
      <namespace name="http://www.tei-c.org/ns/1.0">
        <tagUsage gi="rdg">
          <listWit>
            <witness xml:id="wit.orig">【大】</witness>
            <witness xml:id="wit.cbeta">【CB】</witness>
          </listWit>
        </tagUsage>
      </namespace>
    </tagsDecl>
  </encodingDesc>
  <profileDesc>
    <langUsage>
      <language ident="zh-Hant">Chinese (Traditional)</language>
    </langUsage>
  </profileDesc>
  <revisionDesc>
    <change when="2013-05-20">P4 to P5 conversion</change>
  </revisionDesc>
</teiHeader>
```

**关键元素说明：**

| 元素 | 用途 | 出现率 |
|------|------|--------|
| title level="s" | 藏经系列名 | 100% |
| title level="m" | 具体文献名 | 100% |
| extent | 卷数 | 100% |
| punctuation resp | 标点来源 | 60% |
| witness | 版本标识 | 100% |

### 10.2 正文结构模式

**cb:div 嵌套层级分布：**

| 深度 | 特征 | 示例 |
|------|------|------|
| 1-2 级 | 最小结构 | 简单经文 |
| 2-4 级 | 常见 (主流) | 标准经注体 |
| 4-6 级 | 复杂注释 | 多层科判 |
| 6-8+ 级 | 极端情况 | 密集注解 |

**典型结构组合：**

```xml
<!-- 模式 A: 论注体 (orig + commentary) -->
<cb:div type="orig">
  <p>論文原文</p>
</cb:div>
<cb:div type="commentary">
  <p style="margin-left:1em">注疏解释</p>
</cb:div>

<!-- 模式 B: 科判结构 -->
<p cb:type="pre">
┌一敘古┬一敘說
│　　　└二斥非
└二述今┬一述文
　　　　└二示教
</p>

<!-- 模式 C: 问答体 -->
<p cb:type="question">問：云何...</p>
<p cb:type="answer">答：謂...</p>
```

### 10.3 行页标记系统

**lb (行标记) 格式：**
```xml
<lb n="0001a01" ed="T"/>  <!-- 第1页a栏第1行 -->
<lb n="0001a02" ed="T"/>
...
<lb n="0001b01" ed="T"/>  <!-- 第1页b栏第1行 -->
```

**pb (页标记) 格式：**
```xml
<pb n="0001a" ed="T" xml:id="T01.0001.0001a"/>
<!-- 格式: [卷号].[经号].[页码] -->
```

**页码结构：**
- 数字部分：页号 (0001-9999)
- 字母部分：栏位 (a=左栏, b=中栏, c=右栏)
- 完整 ID：`T01.0001.0001a`

### 10.4 段落属性详解

```xml
<!-- 普通段落 -->
<p xml:id="pT01p0001a0501">正文内容</p>

<!-- 行内继续段落 -->
<p xml:id="pT01p0001a0504" cb:place="inline">继续内容</p>

<!-- 标题段落 -->
<p cb:type="head1">卷第一</p>

<!-- 陀罗尼段落 -->
<p cb:type="dharani">「怛文睇微...」</p>

<!-- 科判段落 -->
<p cb:type="pre">┌一初分...</p>
```

**p 元素 ID 编码规则：**
```
pT01p0001a0501
│ │  │    │
│ │  │    └─ 行号+序号 (05行第01段)
│ │  └────── 页码 (0001a)
│ └───────── 固定前缀 (p)
└──────────── 藏经+卷号 (T01)
```

### 10.5 陀罗尼特殊处理

**悉昙文编码：**
```xml
<cb:tt place="inline">
  <cb:t xml:lang="sa-Sidd"><g ref="#SD-CFC5"/></cb:t>
  <cb:t xml:lang="zh-Hant">阿</cb:t>
</cb:tt>
```

**音译注释：**
```xml
<p cb:type="dharani">
  「怛文<note place="inline">二合，汝也</note>睇微...」
</p>
```

**注释类型：**
- "二合"/"三合"/"四合" - 合成音节标记 (42,250次)
- "引" - 长音标记
- "女声" - 音色标记
- 语义注释："一切也"、"佛也"等

### 10.6 校勘记结构

```xml
<app n="0001002">
  <lem wit="【大】">長安</lem>
  <rdg resp="Taisho" wit="【宋】">〔－〕</rdg>
  <rdg resp="Taisho" wit="【元】【明】">长安</rdg>
</app>

<note n="0001001" resp="Taisho" type="orig" place="foot text">
  【原】寬文年間版本，【甲】天治六年寫法隆寺藏本
</note>
```

**校勘符号说明：**
- `〔X〕－【版本】` - 该版本删除 X
- `（X）＋【版本】` - 该版本增加 X
- `A【大】，B【甲】` - 大正藏作 A，甲本作 B

---

## 十一、新增数据库表

> **注意**：places 和 era_names 表需在 dynasties 表之后创建，因为有外键依赖。
> 同时 sutras 和 persons 表的外键也依赖这两个表。

### 11.1 地点表 (places)

```sql
CREATE TABLE places (
  id TEXT PRIMARY KEY,              -- jetavana

  -- 名称
  name TEXT NOT NULL,               -- 祇園精舍
  name_traditional TEXT,            -- 祇園精舍
  name_sanskrit TEXT,               -- Jetavana
  name_pali TEXT,                   -- Jetavana
  name_english TEXT,                -- Jeta's Grove

  -- 类型
  type TEXT NOT NULL,               -- monastery/city/mountain/country/region

  -- 地理
  region TEXT,                      -- 印度/中国/西域
  country TEXT,                     -- 古印度/中国
  modern_location TEXT,             -- 现代地名

  -- 关联 (自引用使用 DEFERRABLE)
  parent_id TEXT REFERENCES places(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,

  description TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_places_type ON places(type);
CREATE INDEX idx_places_region ON places(region);
CREATE INDEX idx_places_parent ON places(parent_id);

-- 预置数据
INSERT INTO places (id, name, name_traditional, name_sanskrit, name_pali, name_english, type, region, country, modern_location, parent_id, description) VALUES
  ('sravasti', '舍衛國', '舍衛國', 'Śrāvastī', 'Sāvatthī', 'Savatthi', 'city', '印度', '古印度', '印度北方邦', NULL, '佛陀说法主要地点'),
  ('rajagaha', '王舍城', '王舍城', 'Rājagṛha', 'Rājagaha', 'Rajgir', 'city', '印度', '古印度', '印度比哈尔邦', NULL, '摩竭陀国首都'),
  ('jetavana', '祇園精舍', '祇園精舍', 'Jetavana', 'Jetavana', 'Jeta Grove', 'monastery', '印度', '古印度', NULL, 'sravasti', '孤独长者布施'),
  ('vulture-peak', '靈鷲山', '靈鷲山', 'Gṛdhrakūṭa', 'Gijjhakūṭa', 'Vulture Peak', 'mountain', '印度', '古印度', NULL, 'rajagaha', '法华经等宣讲地'),
  ('nalanda', '那爛陀寺', '那爛陀寺', 'Nālandā', 'Nālandā', 'Nalanda', 'monastery', '印度', '古印度', '印度比哈尔邦', NULL, '古代佛教大学'),
  ('cien-temple', '大慈恩寺', '大慈恩寺', NULL, NULL, 'Da Ci En Temple', 'monastery', '中国', '中国', '西安', NULL, '玄奘译场'),
  ('xitaiyuan', '西太原寺', '西太原寺', NULL, NULL, 'Xi Taiyuan Temple', 'monastery', '中国', '中国', '长安', NULL, '唐代译经重镇'),
  ('kuci', '龜茲', '龜茲', 'Kucha', NULL, 'Kucha', 'city', '西域', '古西域', '新疆库车', NULL, '鸠摩罗什故乡'),
  ('kashmir', '罽賓', '罽賓', 'Kaśmīra', NULL, 'Kashmir', 'region', '印度', '古印度', '克什米尔', NULL, '佛教传播重镇');
```

### 11.2 年号表 (era_names)

```sql
CREATE TABLE era_names (
  id TEXT PRIMARY KEY,              -- zhenguan

  name TEXT NOT NULL,               -- 貞觀
  name_simplified TEXT,             -- 贞观
  name_english TEXT,                -- Zhenguan

  dynasty_id TEXT REFERENCES dynasties(id) ON DELETE SET NULL,
  start_year INTEGER,               -- 627
  end_year INTEGER,                 -- 649

  -- 统计
  usage_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_era_names_dynasty ON era_names(dynasty_id);
CREATE INDEX idx_era_names_years ON era_names(start_year, end_year);

-- 高频年号
INSERT INTO era_names (id, name, name_simplified, name_english, dynasty_id, start_year, end_year, usage_count) VALUES
  ('zhenguan', '貞觀', '贞观', 'Zhenguan', 'tang', 627, 649, 2928),
  ('jinglong', '景龍', '景龙', 'Jinglong', 'tang', 707, 710, 323),
  ('yonglong', '永隆', '永隆', 'Yonglong', 'tang', 680, 681, 260),
  ('longshuo', '龍朔', '龙朔', 'Longshuo', 'tang', 661, 663, 0),
  ('kaiyuan', '開元', '开元', 'Kaiyuan', 'tang', 713, 741, 0),
  ('yonghui', '永徽', '永徽', 'Yonghui', 'tang', 650, 655, 0),
  ('tianbao', '天寶', '天宝', 'Tianbao', 'tang', 742, 756, 0);
```

### 11.3 协作关系表 (collaborations)

> **说明**：此表用于记录复杂的多人协作翻译关系，与 sutra_persons 表互补。
> sutra_persons 记录单个人物与经典的关系，collaborations 记录一个翻译团队的整体情况。

```sql
CREATE TABLE collaborations (
  id SERIAL PRIMARY KEY,
  sutra_id TEXT NOT NULL REFERENCES sutras(id) ON DELETE CASCADE,

  -- 协作类型
  type TEXT NOT NULL,               -- joint_translation/main_assistant/division
  -- joint_translation: 共译
  -- main_assistant: 主译+助翻
  -- division: 分工翻译

  -- 参与者 (使用 JSONB 存储复杂关系)
  persons JSONB NOT NULL,           -- [{"person_id": "x", "role": "主译"}, ...]

  -- 描述
  raw_text TEXT,                    -- 原始署名
  description TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_collaborations_sutra ON collaborations(sutra_id);
CREATE INDEX idx_collaborations_type ON collaborations(type);
CREATE INDEX idx_collaborations_persons ON collaborations USING gin(persons);
```

---

## 十二、数据库触发器与函数

### 12.1 自动更新时间戳

```sql
-- 通用更新时间戳函数
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为需要的表添加触发器
CREATE TRIGGER tr_sutras_updated
  BEFORE UPDATE ON sutras
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER tr_persons_updated
  BEFORE UPDATE ON persons
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER tr_chunks_updated
  BEFORE UPDATE ON chunks
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER tr_terms_updated
  BEFORE UPDATE ON terms
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER tr_places_updated
  BEFORE UPDATE ON places
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER tr_canons_updated
  BEFORE UPDATE ON canons
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();
```

### 12.2 统计更新函数

```sql
-- 更新 gaiji 使用计数
CREATE OR REPLACE FUNCTION update_gaiji_usage()
RETURNS void AS $$
BEGIN
  UPDATE gaiji g
  SET usage_count = (
    SELECT COUNT(*)
    FROM chunks c
    WHERE c.content LIKE '%' || g.id || '%'
  );
END;
$$ LANGUAGE plpgsql;

-- 更新年号使用计数
CREATE OR REPLACE FUNCTION update_era_usage()
RETURNS void AS $$
BEGIN
  UPDATE era_names e
  SET usage_count = (
    SELECT COUNT(*)
    FROM sutras s
    WHERE s.translation_era_id = e.id
  );
END;
$$ LANGUAGE plpgsql;
```

---

## 十三、表创建顺序

由于外键依赖关系，表必须按以下顺序创建：

```
第一批 (无依赖):
├── canons
├── languages
├── roles
├── gaiji
└── tags

第二批 (依赖第一批):
├── dynasties (自引用)
├── places (自引用)
├── categories (依赖 canons, 自引用)
└── witnesses (依赖 canons)

第三批 (依赖第二批):
├── era_names (依赖 dynasties)
├── persons (依赖 dynasties, places)
└── terms

第四批 (依赖第三批):
├── sutras (依赖 canons, categories, places, era_names)

第五批 (依赖 sutras):
├── sutra_persons (依赖 sutras, persons, roles)
├── sutra_relations (依赖 sutras)
├── sutra_languages (依赖 sutras, languages)
├── sutra_terms (依赖 sutras, terms)
├── sutra_tags (依赖 sutras, tags)
├── toc_entries (依赖 sutras, 自引用)
├── chunks (依赖 sutras)
├── collaborations (依赖 sutras)
└── search_logs
```

---

## 十四、标点符号规范

### 12.1 句子边界标记

| 标点 | 优先级 | 用途 | 频率 |
|------|--------|------|------|
| 。 | 1 (最强) | 完整句子结束 | 42.3% |
| ； | 2 | 复杂关系分段 | 14.0% |
| ， | 3 | 普通停顿 | - |
| ： | 4 | 引导解释 | 11.8% |
| 、 | 5 (最弱) | 并列关系 | 30.8% |

### 12.2 引用标点

| 标点 | 用途 | 嵌套规则 |
|------|------|---------|
| 「」 | 一级引用 | 外层 |
| 『』 | 二级引用 | 内层 (罕见) |
| （） | 梵文注音 | 行内 |
| 【】 | 版本标识 | 校勘专用 |

### 12.3 科判符号

```
┌ ├ └ ┤ ┬ ─   树形连接符
　　　　　　　  全角空格 (缩进)
一二三四五...   序号
```

---

## 十五、完整分类维度汇总

| 维度 | 类型数 | 说明 |
|------|--------|------|
| A. 藏经 | 26 | 大正藏、续藏、嘉兴藏等 |
| B. 朝代 | 33 | 后汉至民国 |
| C. 角色 | 25 | 译、撰、述、集等 |
| D. 内容结构 | 8+ | orig, commentary, pin, xu等 |
| E. 特殊内容 | 6 | 偈颂、陀罗尼、问答等 |
| F. 语言 | 9 | zh-Hant, sa, pi等 |
| G. 文献关联 | 4 | 同本异译、参考、续编等 |
| H. 校勘版本 | 40+ | 大、宋、元、明、宫等 |
| I. 特殊标记 | 4 | gaiji, 音注, 多语对照等 |
| J. 标题层级 | 6 | m, s, a, j, 1-6 |
| K. 人物身份 | 7 | 菩萨、论师、三藏法师等 |
| L. 协作关系 | 4 | 共译、主译助翻等 |
| M. 地理来源 | 4 | 天竺、西域、中土等 |
| N. 时间纪年 | 12+ | 贞观、景龙等年号 |
| O. 引用关系 | 5 | 同本异译、参考等 |
| P. 段落类型 | 6 | author, dharani, head等 |
| Q. 计量单位 | 3 | 由旬、劫、恒河沙 |

**总计：17 个主要维度，200+ 个分类值**

---

## 十六、前端渲染设计

### 14.1 JSON 节点结构

所有 JSON 节点遵循统一结构：

```typescript
interface JsonNode {
  tag: string         // 标签名：p, lb, note, app, lg, g, tt 等
  ns: 'tei' | 'cb'    // 命名空间：TEI 标准 或 CBETA 扩展
  attrs: Record<string, string>  // 属性
  children: (string | JsonNode)[]  // 子元素：文本或嵌套节点
}

// body 结构
interface SutraJson {
  id: string          // "T01n0001"
  header: { title: string }
  body: (string | JsonNode)[]
}
```

### 14.2 核心组件映射

| 标签 | 命名空间 | React 组件 | 渲染说明 |
|------|----------|------------|----------|
| `p` | tei | `<Paragraph>` | 段落容器 |
| `lb` | tei | `<LineBreak>` | 行标记（可隐藏/显示行号） |
| `pb` | tei | `<PageBreak>` | 页标记（可跳转定位） |
| `lg` | tei | `<VerseGroup>` | 偈颂容器 |
| `l` | tei | `<VerseLine>` | 偈颂行 |
| `caesura` | tei | `<Caesura>` | 偈颂中顿（空格或分隔符） |
| `note` | tei | `<Note>` | 脚注/校勘注 |
| `app` | tei | `<Apparatus>` | 校勘记容器 |
| `lem` | tei | `<Lemma>` | 正文（底本） |
| `rdg` | tei | `<Reading>` | 异文（其他版本） |
| `g` | tei | `<Gaiji>` | 特殊字符 |
| `head` | tei | `<Heading>` | 标题 |
| `byline` | tei | `<Byline>` | 署名行 |
| `div` | cb | `<Division>` | 内容区块 |
| `mulu` | cb | `<TableOfContents>` | 目录项 |
| `juan` | cb | `<Juan>` | 卷标记 |
| `jhead` | cb | `<JuanHeader>` | 卷首标题 |
| `tt` | cb | `<Parallel>` | 多语对照 |
| `t` | cb | `<Translation>` | 对照译文 |
| `docNumber` | cb | `<DocNumber>` | 经号 |

### 14.3 渲染器核心实现

```typescript
// 核心渲染函数
function renderNode(node: string | JsonNode, key: number): ReactNode {
  // 纯文本
  if (typeof node === 'string') {
    return <span key={key}>{node}</span>
  }

  const { tag, ns, attrs, children } = node
  const fullTag = ns === 'cb' ? `cb:${tag}` : tag

  // 递归渲染子元素
  const renderedChildren = children.map((child, i) => renderNode(child, i))

  switch (fullTag) {
    // 结构元素
    case 'p':
      return <Paragraph key={key} id={attrs.id} type={attrs['cb:type']} place={attrs['cb:place']}>
        {renderedChildren}
      </Paragraph>

    case 'lb':
      return <LineBreak key={key} n={attrs.n} ed={attrs.ed} type={attrs.type} />

    case 'pb':
      return <PageBreak key={key} n={attrs.n} id={attrs['xml:id']} />

    // 偈颂
    case 'lg':
      return <VerseGroup key={key} type={attrs.type} style={attrs.style}>
        {renderedChildren}
      </VerseGroup>

    case 'l':
      return <VerseLine key={key}>{renderedChildren}</VerseLine>

    case 'caesura':
      return <Caesura key={key} />

    // 校勘
    case 'note':
      return <Note key={key} type={attrs.type} n={attrs.n} resp={attrs.resp} place={attrs.place}>
        {renderedChildren}
      </Note>

    case 'app':
      return <Apparatus key={key} n={attrs.n}>{renderedChildren}</Apparatus>

    case 'lem':
      return <Lemma key={key} wit={attrs.wit}>{renderedChildren}</Lemma>

    case 'rdg':
      return <Reading key={key} wit={attrs.wit} resp={attrs.resp}>
        {renderedChildren}
      </Reading>

    // 特殊字符
    case 'g':
      return <Gaiji key={key} ref={attrs.ref} />

    // 多语对照
    case 'cb:tt':
      return <Parallel key={key} place={attrs.place}>{renderedChildren}</Parallel>

    case 'cb:t':
      return <Translation key={key} lang={attrs['xml:lang']}>
        {renderedChildren}
      </Translation>

    // 标题
    case 'head':
      return <Heading key={key}>{renderedChildren}</Heading>

    case 'cb:jhead':
      return <JuanHeader key={key}>{renderedChildren}</JuanHeader>

    // 署名
    case 'byline':
      return <Byline key={key} type={attrs['cb:type']}>{renderedChildren}</Byline>

    // 目录
    case 'cb:mulu':
      return <MuluEntry key={key} level={attrs.level} type={attrs.type}>
        {renderedChildren}
      </MuluEntry>

    // 卷
    case 'cb:juan':
      return <Juan key={key} n={attrs.n} fun={attrs.fun}>
        {renderedChildren}
      </Juan>

    // 区块
    case 'cb:div':
      return <Division key={key} type={attrs.type}>{renderedChildren}</Division>

    // 默认
    default:
      return <span key={key} data-tag={fullTag}>{renderedChildren}</span>
  }
}
```

### 14.4 校勘记显示方案

#### 显示模式

| 模式 | 说明 | 用户场景 |
|------|------|----------|
| 隐藏模式 | 只显示底本(lem)，不显示校勘 | 普通阅读 |
| 悬浮模式 | 底本加下划线，悬浮显示异文 | 快速参考 |
| 展开模式 | 行内显示所有版本异文 | 学术研究 |
| 脚注模式 | 异文显示在页面底部 | 打印输出 |

#### 组件实现

```tsx
// 校勘记容器
function Apparatus({ n, children, mode = 'hover' }: ApparatusProps) {
  const [isOpen, setIsOpen] = useState(false)

  // 提取 lem 和 rdg
  const lem = children.find(c => c.type === Lemma)
  const readings = children.filter(c => c.type === Reading)

  if (mode === 'hidden') {
    return <>{lem}</>
  }

  if (mode === 'hover') {
    return (
      <span
        className="apparatus-hover"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        <span className="lem-text">{lem}</span>
        {isOpen && (
          <div className="readings-popup">
            <div className="reading-label">校勘 #{n}</div>
            {readings.map((rdg, i) => (
              <div key={i} className="reading-item">
                <span className="wit">{rdg.props.wit}</span>
                <span className="text">{rdg.props.children}</span>
              </div>
            ))}
          </div>
        )}
      </span>
    )
  }

  if (mode === 'inline') {
    return (
      <span className="apparatus-inline">
        {lem}
        <span className="readings-inline">
          {readings.map((rdg, i) => (
            <span key={i} className="reading-inline">
              {rdg.props.wit}: {rdg.props.children}
            </span>
          ))}
        </span>
      </span>
    )
  }
}

// 悬浮样式
const apparatusStyles = `
.apparatus-hover {
  position: relative;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 3px;
  cursor: help;
}

.readings-popup {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  z-index: 100;
  min-width: 200px;
  white-space: nowrap;
}

.wit {
  color: #666;
  font-size: 0.85em;
  margin-right: 4px;
}
`
```

#### note 类型处理

| type | 渲染方式 | 说明 |
|------|----------|------|
| `orig` | 隐藏或脚注 | 原版校勘（大正藏格式） |
| `mod` | 悬浮提示 | CBETA 修订版校勘 |
| `add` | 行内小字 | 增补说明 |
| `dharani` | 音译提示 | 陀罗尼音注 |
| `variantRemark` | 脚注 | 异文备注 |
| `correctionRemark` | 警告图标 | 校正说明 |

### 14.5 特殊字符 (gaiji) 渲染

#### 字符引用格式

```json
{ "tag": "g", "attrs": { "ref": "#CB06948" }, "children": [] }
{ "tag": "g", "attrs": { "ref": "#SD-CFC5" }, "children": [] }
{ "tag": "g", "attrs": { "ref": "#RJ-CCE7" }, "children": [] }
```

#### 引用前缀

| 前缀 | 含义 | 渲染方式 |
|------|------|----------|
| `CB` | CBETA 组字 | SVG/PUA |
| `SD` | 悉昙梵文 | Siddham 字体 |
| `RJ` | 罗马转写 | Unicode |

#### 组件实现

```tsx
function Gaiji({ ref }: GaijiProps) {
  const id = ref.replace('#', '')
  const prefix = id.slice(0, 2)

  switch (prefix) {
    case 'CB':
      // 方案1: SVG 图片
      return (
        <img
          src={`/gaiji/svg/${id}.svg`}
          alt={id}
          className="gaiji-svg"
        />
      )
      // 方案2: PUA 字体
      // return <span className="gaiji-pua" data-gaiji={id}>{pua[id]}</span>

    case 'SD':
      // 悉昙文字体
      return <span className="siddham">{siddhamMap[id]}</span>

    case 'RJ':
      // 罗马转写
      return <span className="rjchar">{romanMap[id]}</span>

    default:
      return <span className="gaiji-unknown">[{id}]</span>
  }
}

// 样式
const gaijiStyles = `
.gaiji-svg {
  height: 1em;
  vertical-align: baseline;
  display: inline-block;
}

.siddham {
  font-family: 'Siddham', 'Noto Sans Siddham', serif;
}

.rjchar {
  font-family: 'Times New Roman', serif;
  font-style: italic;
}
`
```

#### 字符映射表

需要预加载 gaiji 映射表：

```typescript
// /data/gaiji-map.json
interface GaijiMap {
  [id: string]: {
    unicode?: string      // PUA 码点
    svg?: string          // SVG 路径
    normalized?: string   // 近似替代
    description?: string  // 描述
  }
}

// 加载示例
const gaijiMap = await fetch('/data/gaiji-map.json').then(r => r.json())
```

### 14.6 偈颂 (lg) 渲染

#### 结构示例

```json
{
  "tag": "lg",
  "attrs": { "type": "regular", "style": "margin-left:1em;text-indent:-1em" },
  "children": [
    {
      "tag": "l",
      "children": ["「比丘集法堂，", { "tag": "caesura" }, "講說賢聖論；"]
    },
    {
      "tag": "l",
      "children": ["去來今佛法，", { "tag": "caesura" }, "皆從是中出。」"]
    }
  ]
}
```

#### 组件实现

```tsx
function VerseGroup({ type, style, children }: VerseGroupProps) {
  // 解析 style 属性
  const inlineStyle = parseStyle(style)

  return (
    <div
      className={`verse-group verse-${type || 'regular'}`}
      style={inlineStyle}
    >
      {children}
    </div>
  )
}

function VerseLine({ children }: VerseLineProps) {
  return <div className="verse-line">{children}</div>
}

function Caesura() {
  return <span className="caesura">　</span>  // 全角空格
}

// 样式
const verseStyles = `
.verse-group {
  margin: 1em 0;
  line-height: 1.8;
}

.verse-regular {
  margin-left: 2em;
}

.verse-v5 .verse-line {
  /* 五言诗 */
  letter-spacing: 0.1em;
}

.verse-v7 .verse-line {
  /* 七言诗 */
  letter-spacing: 0.05em;
}

.verse-line {
  display: block;
  text-indent: -1em;
  padding-left: 1em;
}

.caesura {
  display: inline-block;
  width: 2em;
  text-align: center;
}
`
```

### 14.7 陀罗尼渲染

#### 结构示例

```json
{
  "tag": "p",
  "attrs": { "cb:type": "dharani" },
  "children": [
    "「怛文",
    { "tag": "note", "attrs": { "place": "inline" }, "children": ["二合，汝也"] },
    "睇微...」"
  ]
}
```

#### 多语对照 (cb:tt)

```json
{
  "tag": "tt",
  "ns": "cb",
  "attrs": { "place": "inline" },
  "children": [
    { "tag": "t", "ns": "cb", "attrs": { "xml:lang": "sa-Sidd" },
      "children": [{ "tag": "g", "attrs": { "ref": "#SD-CFC5" } }] },
    { "tag": "t", "ns": "cb", "attrs": { "xml:lang": "zh-Hant" },
      "children": ["阿"] }
  ]
}
```

#### 组件实现

```tsx
function DharaniParagraph({ children }: ParagraphProps) {
  return (
    <p className="dharani">
      {children}
    </p>
  )
}

function Parallel({ place, children }: ParallelProps) {
  // 分离各语言版本
  const translations = children.filter(c => c.type === Translation)

  if (place === 'inline') {
    return (
      <span className="parallel-inline">
        {translations.map((t, i) => (
          <span key={i} className={`lang-${t.props.lang}`}>
            {t.props.children}
          </span>
        ))}
      </span>
    )
  }

  // 对照表格形式
  return (
    <div className="parallel-block">
      {translations.map((t, i) => (
        <div key={i} className={`parallel-row lang-${t.props.lang}`}>
          <span className="lang-label">{getLangLabel(t.props.lang)}</span>
          {t.props.children}
        </div>
      ))}
    </div>
  )
}

// 样式
const dharaniStyles = `
.dharani {
  font-family: 'Noto Sans TC', serif;
  line-height: 2;
  background: #f9f6f0;
  padding: 1em;
  border-left: 3px solid #c9a227;
}

.dharani .note {
  font-size: 0.8em;
  color: #666;
  vertical-align: super;
}

.parallel-inline {
  display: inline;
}

.lang-sa-Sidd {
  font-family: 'Siddham', serif;
  font-size: 1.2em;
}

.lang-zh-Hant {
  font-family: 'Noto Sans TC', serif;
}

.lang-sa-x-rj {
  font-family: 'Times New Roman', serif;
  font-style: italic;
}
`
```

### 14.8 目录导航结构

#### mulu 结构

```json
{
  "tag": "mulu",
  "ns": "cb",
  "attrs": { "level": "1", "type": "品" },
  "children": ["大本經"]
}
```

#### 目录树构建

```typescript
interface TocItem {
  text: string
  type: string       // 卷, 品, 經, 序, 附文, 科判
  level: number
  anchor: string     // 页面内定位锚点
  children: TocItem[]
}

function buildToc(body: JsonNode[]): TocItem[] {
  const toc: TocItem[] = []
  const stack: TocItem[] = []
  let lastAnchor = ''

  for (const node of body) {
    // 记录最近的 lb 作为锚点
    if (node.tag === 'lb') {
      lastAnchor = node.attrs.n
    }

    // 提取 mulu
    if (node.tag === 'mulu' && node.ns === 'cb') {
      const item: TocItem = {
        text: getText(node.children),
        type: node.attrs.type || '其他',
        level: parseInt(node.attrs.level || '1'),
        anchor: lastAnchor,
        children: []
      }

      // 按层级插入
      while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
        stack.pop()
      }

      if (stack.length === 0) {
        toc.push(item)
      } else {
        stack[stack.length - 1].children.push(item)
      }

      stack.push(item)
    }

    // 递归处理子元素
    if (node.children) {
      const childToc = buildToc(node.children.filter(c => typeof c !== 'string'))
      // 合并...
    }
  }

  return toc
}
```

#### 目录组件

```tsx
function TableOfContents({ items, onNavigate }: TocProps) {
  return (
    <nav className="toc">
      <h3>目錄</h3>
      <TocLevel items={items} onNavigate={onNavigate} />
    </nav>
  )
}

function TocLevel({ items, onNavigate }: TocLevelProps) {
  return (
    <ul className="toc-list">
      {items.map((item, i) => (
        <li key={i} className={`toc-item toc-level-${item.level} toc-type-${item.type}`}>
          <a href={`#${item.anchor}`} onClick={() => onNavigate(item.anchor)}>
            <span className="toc-type">[{item.type}]</span>
            {item.text}
          </a>
          {item.children.length > 0 && (
            <TocLevel items={item.children} onNavigate={onNavigate} />
          )}
        </li>
      ))}
    </ul>
  )
}

// 样式
const tocStyles = `
.toc {
  position: sticky;
  top: 0;
  max-height: 100vh;
  overflow-y: auto;
  padding: 1em;
  background: #fafafa;
}

.toc-list {
  list-style: none;
  padding-left: 0;
}

.toc-level-1 { padding-left: 0; font-weight: bold; }
.toc-level-2 { padding-left: 1.5em; }
.toc-level-3 { padding-left: 3em; }

.toc-type {
  color: #888;
  font-size: 0.8em;
  margin-right: 0.5em;
}

.toc-type-卷 .toc-type { color: #c41d7f; }
.toc-type-品 .toc-type { color: #1890ff; }
.toc-type-序 .toc-type { color: #52c41a; }
`
```

### 14.9 页码行号定位

#### 行标记结构

```json
{ "tag": "lb", "attrs": { "n": "0001a05", "ed": "T" } }
// n 格式: 页码(4位) + 栏(a/b/c) + 行号(2位)
```

#### 解析与显示

```typescript
// 解析行号
function parseLbN(n: string): { page: string; column: string; line: string } {
  const page = n.slice(0, 4)      // "0001"
  const column = n.slice(4, 5)    // "a"
  const line = n.slice(5)         // "05"
  return { page, column, line }
}

// 生成引用格式
function formatCitation(ed: string, vol: string, page: string, column: string, line: string): string {
  return `${ed}${vol}, p.${parseInt(page)}${column}${parseInt(line)}`
  // 例: "T01, p.1a5"
}
```

#### 行号显示组件

```tsx
function LineBreak({ n, ed, type, showLineNumber }: LineBreakProps) {
  const { page, column, line } = parseLbN(n)

  // 尊敬换行（如"諸佛"前）
  if (type === 'honorific') {
    return <br className="honorific-break" />
  }

  return (
    <>
      {showLineNumber && (
        <span
          id={`lb-${n}`}
          className="line-number"
          data-page={page}
          data-column={column}
          data-line={line}
        >
          {line}
        </span>
      )}
    </>
  )
}

// 样式
const lineStyles = `
.line-number {
  position: absolute;
  left: -3em;
  color: #ccc;
  font-size: 0.75em;
  user-select: none;
}

.line-number:hover {
  color: #666;
  cursor: pointer;
}

.honorific-break {
  display: block;
  height: 0;
}
`
```

#### 页面跳转

```tsx
function PageBreak({ n, id }: PageBreakProps) {
  const pageNum = n.replace(/[a-c]$/, '')  // 去掉栏标记

  return (
    <div id={id} className="page-break" data-page={n}>
      <span className="page-marker">[{pageNum}]</span>
    </div>
  )
}

// 跳转功能
function scrollToPage(pageRef: string) {
  // pageRef 格式: "T01.0001.0001a" 或简写 "0001a"
  const el = document.querySelector(`[data-page="${pageRef}"]`)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// 引用输入框
function PageJumper({ onJump }: { onJump: (ref: string) => void }) {
  const [input, setInput] = useState('')

  return (
    <div className="page-jumper">
      <input
        placeholder="輸入頁碼 (如: 0001a05)"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onJump(input)}
      />
      <button onClick={() => onJump(input)}>跳轉</button>
    </div>
  )
}
```

### 14.10 阅读器状态管理

```typescript
interface ReaderState {
  // 经典信息
  sutraId: string
  sutraData: SutraJson | null

  // 显示设置
  fontSize: number           // 16-24px
  lineHeight: number         // 1.5-2.5
  showLineNumbers: boolean
  showPageMarkers: boolean
  apparatusMode: 'hidden' | 'hover' | 'inline' | 'footnote'

  // 导航
  currentPage: string        // 当前页码
  currentJuan: number        // 当前卷
  toc: TocItem[]

  // 搜索
  searchQuery: string
  searchResults: SearchHit[]

  // 书签
  bookmarks: Bookmark[]
}

interface Bookmark {
  id: string
  sutraId: string
  anchor: string             // lb 的 n 属性
  text: string               // 选中的文本
  note?: string              // 用户笔记
  createdAt: Date
}
```

### 14.11 响应式布局

```css
/* 移动端 */
@media (max-width: 768px) {
  .reader-container {
    flex-direction: column;
  }

  .toc {
    position: fixed;
    left: -100%;
    transition: left 0.3s;
  }

  .toc.open {
    left: 0;
    width: 80%;
  }

  .line-number {
    display: none;
  }

  .readings-popup {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    transform: none;
    border-radius: 12px 12px 0 0;
  }
}

/* 平板 */
@media (min-width: 769px) and (max-width: 1024px) {
  .reader-container {
    display: grid;
    grid-template-columns: 250px 1fr;
  }
}

/* 桌面 */
@media (min-width: 1025px) {
  .reader-container {
    display: grid;
    grid-template-columns: 280px 1fr 280px;
  }

  .annotation-panel {
    display: block;
  }
}
```

### 14.12 性能优化

#### 虚拟滚动

对于长经文（如《大般若经》600卷），使用虚拟滚动：

```tsx
import { useVirtualizer } from '@tanstack/react-virtual'

function VirtualizedSutra({ body }: { body: JsonNode[] }) {
  const parentRef = useRef<HTMLDivElement>(null)

  // 按段落分块
  const paragraphs = useMemo(() => splitByParagraph(body), [body])

  const virtualizer = useVirtualizer({
    count: paragraphs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,  // 估算每段高度
    overscan: 5               // 预渲染数量
  })

  return (
    <div ref={parentRef} className="sutra-scroll" style={{ height: '100vh', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: virtualRow.start,
              width: '100%'
            }}
          >
            {renderNode(paragraphs[virtualRow.index], virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  )
}
```

#### 懒加载

```typescript
// 按卷加载
async function loadJuan(sutraId: string, juan: number): Promise<JsonNode[]> {
  const res = await fetch(`/api/sutra/${sutraId}/juan/${juan}`)
  return res.json()
}

// 预加载下一卷
function prefetchNextJuan(sutraId: string, currentJuan: number) {
  const link = document.createElement('link')
  link.rel = 'prefetch'
  link.href = `/api/sutra/${sutraId}/juan/${currentJuan + 1}`
  document.head.appendChild(link)
}
```

#### 缓存策略

```typescript
// Service Worker 缓存
const CACHE_NAME = 'cbeta-reader-v1'

self.addEventListener('fetch', event => {
  if (event.request.url.includes('/api/sutra/')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fetched = fetch(event.request).then(response => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
          return response
        })
        return cached || fetched
      })
    )
  }
})
```

---

## 十七、数据库设计修复清单

本章节记录了设计审查中发现的问题及其修复状态。

### 17.1 已修复问题

| # | 问题 | 原状态 | 修复方案 | 状态 |
|---|------|--------|----------|------|
| 1 | dynasties 自引用外键无法批量插入 | `REFERENCES dynasties(id)` | 添加 `DEFERRABLE INITIALLY DEFERRED` | ✅ |
| 2 | categories 自引用外键无法批量插入 | 同上 | 同上 | ✅ |
| 3 | places 自引用外键无法批量插入 | 同上 | 同上 | ✅ |
| 4 | toc_entries 自引用外键无法批量插入 | 同上 | 同上 | ✅ |
| 5 | 多数表缺少 ON DELETE 策略 | 无定义 | 添加 CASCADE/SET NULL | ✅ |
| 6 | places 表未被其他表引用 | 孤立表 | sutras/persons 添加 place 外键 | ✅ |
| 7 | era_names 表未被其他表引用 | 孤立表 | sutras 添加 translation_era_id | ✅ |
| 8 | 多数表缺少 created_at/updated_at | 无时间戳 | 添加时间戳字段 | ✅ |
| 9 | 缺少更新时间触发器 | 无触发器 | 添加 update_timestamp() 函数和触发器 | ✅ |
| 10 | 缺少必要索引 | 部分索引 | 为所有外键和常用查询字段添加索引 | ✅ |
| 11 | toc_entries.id 使用 TEXT 手动生成 | 易冲突 | 改为 SERIAL 自增 | ✅ |
| 12 | INSERT 语句缺少字段名 | VALUES(...) | 改为显式字段 INSERT | ✅ |
| 13 | sutra_terms 主键包含 page | 粒度过细 | 改为 SERIAL + UNIQUE 约束 | ✅ |
| 14 | gaiji 缺少 normalized 字段 | 无近似替代 | 添加 normalized, svg_path, pua_code | ✅ |
| 15 | languages 缺少 sa-x-rj | 遗漏语言 | 添加罗马转写梵文 | ✅ |

### 17.2 设计改进

| 改进项 | 说明 |
|--------|------|
| 表创建顺序文档 | 新增第十三章，明确依赖关系和创建顺序 |
| 触发器和函数 | 新增第十二章，统一管理自动化逻辑 |
| 索引策略 | 每个表定义后紧跟 CREATE INDEX 语句 |
| 外键策略 | 关联表使用 CASCADE，引用表使用 SET NULL |
| DEFERRABLE | 所有自引用外键支持批量插入 |

### 17.3 表统计 (更新后)

| 表名 | 用途 | 预估行数 | 索引数 | 外键数 |
|------|------|----------|--------|--------|
| canons | 藏经 | 26 | 1 | 0 |
| sutras | 经典 | ~5,000 | 5 | 4 |
| persons | 人物 | ~3,000 | 4 | 3 |
| dynasties | 朝代 | ~30 | 3 | 1 |
| categories | 分类 | ~50 | 3 | 2 |
| roles | 角色 | 8 | 1 | 0 |
| sutra_persons | 经-人关联 | ~8,000 | 3 | 3 |
| sutra_relations | 经-经关联 | ~2,000 | 3 | 2 |
| toc_entries | 目录 | ~50,000 | 4 | 2 |
| chunks | 向量分块 | ~500,000 | 4 | 1 |
| witnesses | 校勘版本 | 10 | 2 | 1 |
| gaiji | 特殊字符 | ~20,000 | 2 | 0 |
| languages | 语言 | 8 | 0 | 0 |
| sutra_languages | 经-语言关联 | ~10,000 | 2 | 2 |
| places | 地点 | ~100 | 3 | 1 |
| era_names | 年号 | ~50 | 2 | 1 |
| terms | 术语 | ~5,000 | 3 | 0 |
| sutra_terms | 经-术语关联 | ~50,000 | 2 | 2 |
| tags | 标签 | ~100 | 1 | 0 |
| sutra_tags | 经-标签关联 | ~10,000 | 1 | 2 |
| collaborations | 协作关系 | ~1,000 | 3 | 1 |
| search_logs | 搜索日志 | ~100,000 | 1 | 0 |

**总计**: 22 张表，~50+ 索引，~30 外键关系

### 17.4 ER 图 (更新后)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CBETA 数据库 ER 图 (修订版)                          │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌──────────┐
                                    │ canons   │
                                    │──────────│
                                    │ id (PK)  │
                                    └────┬─────┘
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              │                          │                          │
              ▼                          ▼                          ▼
       ┌────────────┐            ┌──────────────┐           ┌────────────┐
       │ categories │◄──┐        │    sutras    │           │ witnesses  │
       │────────────│   │        │──────────────│           │────────────│
       │ parent_id ─┼───┘        │ canon_id     │───────────│ canon_id   │
       │ canon_id ──┼────────────│ category_id  │           └────────────┘
       └────────────┘            │ place_id     │
                                 │ era_id       │
                                 └──────┬───────┘
                                        │
     ┌──────────┐                       │                    ┌────────────┐
     │ places   │◄──────────────────────┼────────────────────│ era_names  │
     │──────────│                       │                    │────────────│
     │parent_id │◄──┐                   │                    │ dynasty_id │───┐
     └──────────┘   │                   │                    └────────────┘   │
                    │                   │                                      │
                    │    ┌──────────────┼──────────────┐                      │
                    │    │              │              │                      │
                    │    ▼              ▼              ▼                      │
                    │ ┌─────────┐ ┌───────────┐ ┌────────────┐               │
                    │ │ chunks  │ │toc_entries│ │sutra_rels  │               │
                    │ │─────────│ │───────────│ │────────────│               │
                    │ │sutra_id │ │ sutra_id  │ │ source_id  │               │
                    │ │embedding│ │ parent_id │ │ target_id  │               │
                    │ └─────────┘ └───────────┘ └────────────┘               │
                    │                                                         │
     ┌──────────┐   │     ┌──────────────┐      ┌────────────┐               │
     │ persons  │───┼─────│sutra_persons │      │  dynasties │◄──────────────┘
     │──────────│   │     │──────────────│      │────────────│
     │dynasty_id│───┼─────│ sutra_id     │      │ parent_id  │◄──┐
     │ place_id │───┘     │ person_id    │      └────────────┘   │
     └──────────┘         │ role_id      │───────────────────────┘
                          └──────────────┘
                                 │
                                 ▼
                          ┌────────────┐
                          │   roles    │
                          └────────────┘
```

---

## 十八、JSON 结构检查与数据导入分析

### 18.1 检查结果汇总

**总文件数**: 4998 个

#### header.title（经名字段）

| 情况 | 数量 | 结论 |
|------|------|------|
| 有标题 | 0 | ❌ **全部为空！** |
| 空标题 | 4998 | |

> ⚠️ `header.title` 完全不能用，必须从 body 里的 `jhead` 或 `head` 标签提取

#### 经名提取（jhead/head 标签）

| 情况 | 数量 | 百分比 |
|------|------|--------|
| 有 jhead 或 head | 4992 | 99.88% ✅ |
| 无 jhead 也无 head | 6 | 0.12% |

**例外文件**:
- `YP00na001` - 演培法师传略，经名在 mulu 里
- `D53n8952` - 善本佛典，直接是正文
- `D03n8701` - 善本佛典，直接是正文

#### 译者/作者信息（byline 标签）

| 情况 | 数量 | 百分比 |
|------|------|--------|
| 有 byline | 4061 | 81.3% |
| 无 byline | 937 | 18.7% ⚠️ |

**byline 类型分布 (cb:type 属性)**:

| 类型 | 数量 | 说明 |
|------|------|------|
| author | 21704 | 作者 |
| other | 7198 | 其他 |
| Translator | 4966 | 译者 |
| editor | 2083 | 编者 |
| collector | 838 | 集录者 |
| unknown | 1426 | 未标注类型 |

**byline 内容格式示例**:

| 格式 | 示例 | 需要拆分 |
|------|------|----------|
| 朝代+身份+人名+角色 | `姚秦龜茲三藏鳩摩羅什譯` | 需要 AI |
| 人名+角色 | `沙門智周撰` | 需要 AI |
| 复杂格式 | `法師玄奘奉　詔譯` | 需要 AI |
| 多人协作 | `三藏法師玄奘譯 僧叡筆受` | 需要 AI |

#### 目录结构（mulu 标签）

| 情况 | 数量 | 百分比 |
|------|------|--------|
| 有 mulu | 4996 | 99.96% ✅ |
| 无 mulu | 2 | 0.04% |

**mulu 类型分布**:

| 类型 | 数量 |
|------|------|
| 其他 | 283,547 |
| 卷 | 19,780 |
| 品 | 5,826 |
| 序 | 4,603 |
| 附文 | 4,104 |
| 科判 | 2,793 |
| 經 | 2,706 |

#### 经号（docNumber 标签）

| 情况 | 数量 | 百分比 |
|------|------|--------|
| 有 docNumber | 3740 | 74.8% |
| 无 docNumber | 1258 | 25.2% ⚠️ |

**docNumber 格式类型**:

| 格式 | 数量 | 示例 |
|------|------|------|
| 标准格式 | 3150 | `No. 1` |
| 带参考 | 581 | `No. 1833 [cf. No. 1830]` |
| 带关联 | - | `No. 1597 [Nos. 1595, 1596]` |
| 高丽藏格式 | 8 | `K. no. 1257` |

> 无 docNumber 的文件可从文件名 `T01n0001` 解析经号

#### 页码（pb）和行号（lb）

| 标签 | 有 | 无 | 百分比 |
|------|-----|-----|--------|
| pb (页码) | 4973 | 25 | 99.5% ✅ |
| lb (行号) | 4998 | 0 | 100% ✅ |
| milestone (卷标) | 4996 | 2 | 99.96% ✅ |

**无 pb 的文件**: 主要是 T85（敦煌写本）的短经，可从 lb.n 提取页码

### 18.2 数据解析能力矩阵

| 字段 | 解析方式 | 可解析比例 | 例外处理方式 |
|------|---------|-----------|--------------|
| 经典ID (sutra.id) | ✅ 规则 | 100% | 直接取 json.id |
| 藏经代码 (canon_id) | ✅ 规则 | 100% | 正则: `T01n0001` → `T` |
| 卷号 (volume) | ✅ 规则 | 100% | 正则: `T01n0001` → `01` |
| 经号 (number) | ✅ 规则 | 100% | docNumber 或文件名解析 |
| 经名 (title) | ✅ 规则 | 99.88% | 从 jhead/head 提取，6个从 mulu |
| 卷数 (juan_count) | ✅ 规则 | 100% | 统计 milestone[unit=juan] |
| 起始页 (page_start) | ✅ 规则 | 99.5% | 第一个 pb.n 或 lb.n |
| 目录 (toc_entries) | ✅ 规则 | 99.96% | 直接解析 mulu 标签 |
| 是否有偈颂 | ✅ 规则 | 100% | 检查有无 lg 标签 |
| 是否有陀罗尼 | ✅ 规则 | 100% | 检查 cb:type="dharani" |
| 关联经典 | ⚠️ 规则+校验 | 74.8% | 解析 docNumber 里的 [No. xxx] |
| 译者/作者文本 | ✅ 规则 | 81.3% | 提取 byline 纯文本 |
| **人名拆分** | ❌ AI | 0% | 必须用 AI 拆分朝代+人名+角色 |
| **分类归属** | ❌ AI | 0% | JSON 中无，需要 AI 或外部数据 |
| **标签生成** | ❌ AI | 0% | 需要 AI 分析内容 |

### 18.3 数据导入流程设计

```
┌─────────────────────────────────────────────────────────────────┐
│                        数据导入四阶段                            │
└─────────────────────────────────────────────────────────────────┘

【阶段一】原始导入 (纯机械，无需 AI)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  输入: 4998 个 JSON 文件

  ┌──────────┐     ┌──────────────┐
  │ JSON文件  │────►│ sutra_raw 表  │  存完整 JSON
  └──────────┘     └──────────────┘

【阶段二】规则解析 (代码处理，无需 AI)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  解析器提取:
  ├── 经典ID、藏经代码、卷号、经号
  ├── 经名 (从 jhead/head)
  ├── 卷数 (统计 milestone)
  ├── 页码范围 (pb/lb)
  ├── 目录结构 (mulu)
  ├── 译者原文 (byline 纯文本)
  └── 特征标记 (has_dharani, has_verse)

  ┌──────────┐     ┌──────────────┐     ┌──────────────┐
  │ sutra_raw │────►│   sutras     │────►│ toc_entries  │
  └──────────┘     │ (基础字段)    │     │ (目录结构)    │
                   └──────────────┘     └──────────────┘

【阶段三】AI 分析 (需要大模型)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  AI 任务:
  ├── 人名拆分: "姚秦龜茲三藏鳩摩羅什譯"
  │   → 朝代:姚秦, 身份:龜茲三藏, 人名:鳩摩羅什, 角色:譯
  ├── 人名标准化: "羅什" = "什公" = "鳩摩羅什"
  ├── 无 byline 文件的作者识别
  ├── 分类归属判断
  └── 标签生成

  ┌──────────┐     ┌──────────────┐     ┌──────────────┐
  │ AI 模型   │────►│   persons    │────►│sutra_persons │
  │ (Claude)  │     │ (人物信息)    │     │ (人物关联)   │
  └──────────┘     └──────────────┘     └──────────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │ sutra_tags   │
                   │ (标签关联)    │
                   └──────────────┘

【阶段四】向量生成 (Embedding 模型)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ├── 按段落/章节分块
  ├── 生成文本 embedding
  └── 存入 chunks 表

  ┌──────────┐     ┌──────────────┐
  │ Embedding │────►│   chunks     │
  │ 模型      │     │ (向量分块)    │
  └──────────┘     └──────────────┘
```

### 18.4 新增表: sutra_raw (原始数据表)

```sql
-- 存储原始 JSON，便于重新解析和数据溯源
CREATE TABLE sutra_raw (
  sutra_id TEXT PRIMARY KEY REFERENCES sutras(id) ON DELETE CASCADE,

  -- 原始内容
  json_content JSONB NOT NULL,        -- 完整 JSON
  json_size INTEGER,                  -- JSON 大小 (字节)

  -- 来源追踪
  source_file TEXT,                   -- 原文件路径
  xml_hash TEXT,                      -- 原 XML 的 hash (用于检测更新)

  -- 解析状态
  parse_status TEXT DEFAULT 'pending', -- pending/parsed/failed
  parse_version TEXT,                 -- 解析器版本号
  parsed_at TIMESTAMP,                -- 解析时间
  parse_error TEXT,                   -- 解析错误信息

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sutra_raw_status ON sutra_raw(parse_status);
```

### 18.5 新增表: ai_tasks (AI 分析任务表)

```sql
-- AI 分析任务追踪
CREATE TABLE ai_tasks (
  id SERIAL PRIMARY KEY,

  -- 任务信息
  task_type TEXT NOT NULL,            -- byline_parse/classify/tag/summarize
  sutra_id TEXT REFERENCES sutras(id) ON DELETE CASCADE,

  -- 输入
  input_text TEXT NOT NULL,           -- 需要分析的文本
  input_context JSONB,                -- 额外上下文

  -- 输出
  status TEXT DEFAULT 'pending',      -- pending/processing/completed/failed
  result JSONB,                       -- AI 分析结果
  confidence FLOAT,                   -- 置信度

  -- AI 信息
  model TEXT,                         -- claude-3-haiku / gpt-4 等
  tokens_used INTEGER,                -- token 消耗
  cost DECIMAL(10,6),                 -- 成本 (USD)

  -- 人工审核
  reviewed BOOLEAN DEFAULT false,
  reviewed_by TEXT,
  reviewed_at TIMESTAMP,
  review_notes TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,

  error_message TEXT
);

CREATE INDEX idx_ai_tasks_status ON ai_tasks(status);
CREATE INDEX idx_ai_tasks_type ON ai_tasks(task_type);
CREATE INDEX idx_ai_tasks_sutra ON ai_tasks(sutra_id);
```

### 18.6 AI 分析任务类型

| task_type | 输入 | 输出 | 模型建议 |
|-----------|------|------|----------|
| `byline_parse` | `"姚秦龜茲三藏鳩摩羅什譯"` | `{dynasty, identity, name, role}` | Claude Haiku |
| `person_normalize` | `["羅什", "什公", "鳩摩羅什"]` | `{canonical: "鳩摩羅什", aliases: [...]}` | Claude Haiku |
| `classify` | 经文前500字 | `{category: "般若部", subcategory: "..."}` | Claude Sonnet |
| `tag` | 经文摘要 | `{tags: ["禅定", "空性", ...]}` | Claude Haiku |
| `summarize` | 完整经文 | `{summary: "...", key_concepts: [...]}` | Claude Sonnet |
| `find_author` | 无 byline 的经文 | `{possible_authors: [...], source: "..."}` | Claude Sonnet |

### 18.7 AI 分析成本估算

| 任务 | 数量 | 平均 tokens | 单价 | 预估成本 |
|------|------|-------------|------|----------|
| byline 拆分 | ~5,000 | 200 | $0.001/1K | $1 |
| 人名标准化 | ~2,000 | 150 | $0.001/1K | $0.3 |
| 分类判断 | ~5,000 | 1,000 | $0.003/1K | $15 |
| 标签生成 | ~5,000 | 500 | $0.001/1K | $2.5 |
| 向量生成 | ~500,000 | 500 | $0.0001/1K | $25 |
| **总计** | | | | **~$50** |

> 使用 Claude Haiku 处理简单任务，Claude Sonnet 处理复杂分类，成本可控

### 18.8 解析器伪代码

```python
def parse_sutra_json(json_path: str) -> dict:
    """解析单个 JSON 文件，提取可规则化的字段"""

    with open(json_path) as f:
        data = json.load(f)

    body = data.get('body', [])
    result = {
        'id': data['id'],
        'canon_id': extract_canon_id(data['id']),      # T01n0001 → T
        'volume': extract_volume(data['id']),           # T01n0001 → 1
        'number': None,
        'title': None,
        'juan_count': 0,
        'page_start': None,
        'page_end': None,
        'has_dharani': False,
        'has_verse': False,
        'byline_raw': [],
        'toc': [],
        'related_sutras': [],
    }

    # 遍历 body 提取信息
    for node in traverse(body):
        tag = node.get('tag')
        ns = node.get('ns')

        # 经名
        if tag in ('jhead', 'head') and not result['title']:
            result['title'] = extract_text(node)

        # 经号
        if tag == 'docNumber':
            text = extract_text(node)
            result['number'] = parse_doc_number(text)
            result['related_sutras'] = parse_related_nos(text)

        # 卷数
        if tag == 'milestone' and node['attrs'].get('unit') == 'juan':
            result['juan_count'] += 1

        # 页码
        if tag == 'pb':
            page = node['attrs'].get('n')
            if not result['page_start']:
                result['page_start'] = page
            result['page_end'] = page

        # 译者原文
        if tag == 'byline':
            result['byline_raw'].append({
                'type': node['attrs'].get('cb:type'),
                'text': extract_text(node)
            })

        # 目录
        if tag == 'mulu':
            result['toc'].append({
                'level': node['attrs'].get('level', 1),
                'type': node['attrs'].get('type'),
                'title': extract_text(node)
            })

        # 特征
        if tag == 'lg':
            result['has_verse'] = True
        if node.get('attrs', {}).get('cb:type') == 'dharani':
            result['has_dharani'] = True

    return result
```
