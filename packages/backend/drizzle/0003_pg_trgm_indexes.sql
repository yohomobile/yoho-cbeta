-- ============================================
-- pg_trgm + zhparser 全文搜索配置
-- ============================================

-- 1. 启用 pg_trgm 扩展（模糊搜索和相似度匹配）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. 启用 zhparser 中文分词扩展
-- 注意：zhparser 需要先在系统层面安装
-- Ubuntu: apt install postgresql-XX-zhparser
-- 如果 zhparser 未安装，此语句会失败但不影响 pg_trgm 功能
CREATE EXTENSION IF NOT EXISTS zhparser;

-- 3. 创建中文全文搜索配置
DO $$
BEGIN
  -- 检查 zhparser 是否可用
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'zhparser') THEN
    -- 创建中文搜索配置（如果不存在）
    IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'chinese') THEN
      CREATE TEXT SEARCH CONFIGURATION chinese (PARSER = zhparser);
      -- 添加词典映射
      ALTER TEXT SEARCH CONFIGURATION chinese ADD MAPPING FOR n,v,a,i,e,l,t WITH simple;
    END IF;
  END IF;
END $$;

-- ============================================
-- pg_trgm GIN 索引（用于模糊匹配）
-- ============================================

-- 经文表索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS texts_title_trgm_idx
  ON texts USING GIN (title gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS texts_author_trgm_idx
  ON texts USING GIN (author_raw gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS texts_title_alt_trgm_idx
  ON texts USING GIN (title_alt gin_trgm_ops);

-- 词典表索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS dict_term_trgm_idx
  ON dictionary_entries USING GIN (term gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS dict_term_simp_trgm_idx
  ON dictionary_entries USING GIN (term_simplified gin_trgm_ops);

-- 人物表索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS persons_name_trgm_idx
  ON persons USING GIN (name gin_trgm_ops);

-- ============================================
-- 全文搜索 tsvector 列和索引
-- ============================================

-- 为经文表添加全文搜索向量列
ALTER TABLE texts ADD COLUMN IF NOT EXISTS title_tsv tsvector;

-- 更新现有数据的 tsvector（使用 zhparser 或 simple 配置）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'chinese') THEN
    UPDATE texts SET title_tsv = to_tsvector('chinese', COALESCE(title, '') || ' ' || COALESCE(title_alt, ''));
  ELSE
    UPDATE texts SET title_tsv = to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(title_alt, ''));
  END IF;
END $$;

-- 创建 tsvector GIN 索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS texts_title_tsv_idx
  ON texts USING GIN (title_tsv);

-- 为词典添加释义全文搜索列
ALTER TABLE dictionary_entries ADD COLUMN IF NOT EXISTS definition_tsv tsvector;

-- 更新词典的 tsvector
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'chinese') THEN
    UPDATE dictionary_entries SET definition_tsv = to_tsvector('chinese', COALESCE(definition_text, ''));
  ELSE
    UPDATE dictionary_entries SET definition_tsv = to_tsvector('simple', COALESCE(definition_text, ''));
  END IF;
END $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS dict_definition_tsv_idx
  ON dictionary_entries USING GIN (definition_tsv);

-- ============================================
-- 自动更新 tsvector 的触发器
-- ============================================

-- 经文表触发器
CREATE OR REPLACE FUNCTION texts_tsv_trigger() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'chinese') THEN
    NEW.title_tsv := to_tsvector('chinese', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.title_alt, ''));
  ELSE
    NEW.title_tsv := to_tsvector('simple', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.title_alt, ''));
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS texts_tsv_update ON texts;
CREATE TRIGGER texts_tsv_update
  BEFORE INSERT OR UPDATE OF title, title_alt ON texts
  FOR EACH ROW EXECUTE FUNCTION texts_tsv_trigger();

-- 词典表触发器
CREATE OR REPLACE FUNCTION dict_tsv_trigger() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'chinese') THEN
    NEW.definition_tsv := to_tsvector('chinese', COALESCE(NEW.definition_text, ''));
  ELSE
    NEW.definition_tsv := to_tsvector('simple', COALESCE(NEW.definition_text, ''));
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dict_tsv_update ON dictionary_entries;
CREATE TRIGGER dict_tsv_update
  BEFORE INSERT OR UPDATE OF definition_text ON dictionary_entries
  FOR EACH ROW EXECUTE FUNCTION dict_tsv_trigger();
