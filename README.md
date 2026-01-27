# yoho-cbeta

CBETA 佛典文本处理工具，将 TEI P5a XML 格式转换为 JSON，并提供繁简转换功能。

## 项目结构

```
yoho-cbeta/
├── packages/
│   ├── backend/          # 后端服务
│   ├── frontend/         # 前端应用
│   └── scripts/          # 转换脚本
│       └── src/
│           ├── batch-convert.ts      # XML → JSON 批量转换
│           ├── simplify-convert.ts   # 繁体 → 简体转换
│           ├── zhconv.ts             # 繁简转换库 (TypeScript)
│           ├── zhcdict.json          # 转换字典
│           ├── verify-simplify.ts    # 简体转换校验
│           ├── verify-zhconv.ts      # zhconv 校验
│           ├── test-zhconv.ts        # zhconv 测试
│           ├── parser.ts             # CBETA XML 解析器
│           ├── cli.ts                # 命令行工具
│           ├── types.ts              # 类型定义
│           └── index.ts              # 入口文件
├── data/                 # 繁体 JSON 数据 (4996 文件, 8.9GB)
│   ├── A/                # 阿含部
│   ├── B/                # 本缘部
│   ├── C/                # 华严部
│   ├── D/                # 般若部
│   ├── ...               # 其他部类
│   └── .file-commits.json  # 文件 commit 追踪
├── data-simplified/      # 简体 JSON 数据 (4986 文件, 8.9GB)
│   └── .file-commits.json  # 文件 commit 追踪
├── package.json
├── pnpm-workspace.yaml
└── pnpm-lock.yaml
```

## data 目录说明

`data/` 和 `data-simplified/` 目录包含从 CBETA XML 转换的 JSON 文件：

| 目录 | 说明 |
|------|------|
| A/   | 阿含部 |
| B/   | 本缘部 |
| C/   | 华严部 |
| CC/  | 华严部续 |
| D/   | 般若部 |
| F/   | 法华部 |
| G/   | 涅槃部 |
| GA/  | 经集部 |
| GB/  | 经集部续 |
| I/   | 印度撰述 |
| J/   | 嘉兴藏 |
| K/   | 杂密部 |
| L/   | 律部 |
| LC/  | 律部续 |
| M/   | 论集部 |
| N/   | 南传大藏经 |
| P/   | 藏外佛教文献 |
| S/   | 宋藏遗珍 |
| T/   | 大正藏 |
| TX/  | 大正藏续 |
| U/   | 历代藏经补辑 |
| X/   | 卍续藏 |
| Y/   | 印顺法师佛学著作集 |
| YP/  | 永乐北藏 |
| ZS/  | 正史佛教资料类编 |

## 使用方法

### 安装依赖

```bash
pnpm install
```

### XML 转 JSON

将 CBETA XML 文件转换为 JSON 格式：

```bash
cd packages/scripts

# 转换全部文件
pnpm convert

# 限制转换数量（用于测试）
pnpm convert 10
```

转换特点：
- 按文件追踪 git commit，支持增量更新
- 记录保存在 `data/.file-commits.json`

### 繁体转简体

将繁体 JSON 转换为简体 JSON：

```bash
cd packages/scripts

# 转换全部文件
pnpm simplify

# 限制转换数量（用于测试）
npx tsx src/simplify-convert.ts 10
```

转换特点：
- 使用本地 TypeScript 版 zhconv 库
- 按文件追踪 commit，支持增量更新
- 记录保存在 `data-simplified/.file-commits.json`

### 校验转换结果

```bash
cd packages/scripts

# 校验简体转换
npx tsx src/verify-simplify.ts

# 校验 zhconv 与 Python 版一致性
npx tsx src/verify-zhconv.ts
```

## 技术说明

### zhconv (TypeScript 版)

`packages/scripts/src/zhconv.ts` 是 Python zhconv 库的 TypeScript 移植版本：

- 使用 MediaWiki 转换表
- 最大正向匹配算法
- 支持 zh-cn, zh-tw, zh-hk, zh-sg 等多种目标语言
- 字典文件：`zhcdict.json` (481KB)

```typescript
import { toSimplified, toTraditional, convert } from './zhconv.js'

// 繁体转简体
toSimplified('佛說大乘僧伽吒法義經')
// => '佛说大乘僧伽吒法义经'

// 简体转繁体
toTraditional('计算机软件')
// => '計算機軟體'

// 指定目标语言
convert('人体内存在很多微生物', 'zh-tw')
// => '人體內存在很多微生物'
```

### 增量更新机制

两个转换脚本都支持增量更新：

1. **XML → JSON**：对比源 XML 文件的 git commit
2. **繁体 → 简体**：对比繁体 JSON 文件的 commit 记录

只有当源文件 commit 发生变化时，才会重新转换。

## 数据统计

- 繁体 JSON 文件：4996 个
- 简体 JSON 文件：4986 个
- 数据总大小：约 17.8GB
- 转换校验：139,726,736 个字符串，100% 正确率
