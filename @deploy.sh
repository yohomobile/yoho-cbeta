#!/usr/bin/env bash
set -euo pipefail

# 构建前后端（避免触发 scripts 包的 tsup 无输入失败）
pnpm --filter @cbeta/frontend build
pnpm --filter @cbeta/backend build

# 重启服务
pm2 restart cbeta-frontend
pm2 restart cbeta-backend
