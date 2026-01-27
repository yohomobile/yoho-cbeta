#!/usr/bin/env bash
set -euo pipefail

# 检查工作区是否干净
if ! git diff --quiet HEAD; then
    echo "❌ 错误：工作区有未提交的更改，请先提交或暂存"
    git status --short
    exit 1
fi

# 检查是否有未推送的提交
if [ -n "$(git log origin/main..main 2>/dev/null)" ]; then
    echo "❌ 错误：有未推送的提交，请先执行 git push"
    git log --oneline origin/main..main
    exit 1
fi

# 构建前后端（避免触发 scripts 包的 tsup 无输入失败）
pnpm --filter @cbeta/frontend build
pnpm --filter @cbeta/backend build

# 重启服务
pm2 restart cbeta-frontend
pm2 restart cbeta-backend
