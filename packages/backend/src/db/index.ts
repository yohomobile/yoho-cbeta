/**
 * 数据库连接 (PostgreSQL)
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

// 使用对象配置方式避免 URL 编码问题
const client = postgres({
  host: process.env.DB_HOST || '101.100.174.21',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'cbeta',
  username: process.env.DB_USER || 'guang',
  password: process.env.DB_PASSWORD || 'Root,./000000',
})

export const db = drizzle(client, { schema })

export * from './schema.js'
