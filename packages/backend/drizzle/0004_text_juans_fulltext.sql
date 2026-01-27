-- ============================================
-- 经文正文全文搜索配置
-- ============================================

-- 1. 创建递归提取 JSONB 中文本的函数
CREATE OR REPLACE FUNCTION extract_text_from_jsonb(data jsonb) RETURNS text AS $$
DECLARE
  result text := '';
  element jsonb;
  child jsonb;
  item jsonb;
BEGIN
  -- 如果是字符串，直接返回
  IF jsonb_typeof(data) = 'string' THEN
    RETURN data #>> '{}';
  END IF;

  -- 如果是数组，遍历每个元素
  IF jsonb_typeof(data) = 'array' THEN
    FOR element IN SELECT * FROM jsonb_array_elements(data)
    LOOP
      result := result || extract_text_from_jsonb(element);
    END LOOP;
    RETURN result;
  END IF;

  -- 如果是对象，提取 children 字段
  IF jsonb_typeof(data) = 'object' THEN
    -- 跳过注释节点（note 标签通常是校勘记）
    IF data->>'tag' IN ('note', 'anchor', 'milestone', 'pb', 'lb') THEN
      RETURN '';
    END IF;

    -- 递归处理 children
    IF data ? 'children' THEN
      FOR child IN SELECT * FROM jsonb_array_elements(data->'children')
      LOOP
        result := result || extract_text_from_jsonb(child);
      END LOOP;
    END IF;
    RETURN result;
  END IF;

  RETURN '';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. 添加纯文本列
ALTER TABLE text_juans ADD COLUMN IF NOT EXISTS content_text text;

-- 3. 添加全文搜索向量列
ALTER TABLE text_juans ADD COLUMN IF NOT EXISTS content_tsv tsvector;

-- 4. 填充纯文本列（这一步比较慢，约 5-10 分钟）
-- 注意：使用 COALESCE 处理可能的 NULL 值
UPDATE text_juans
SET content_text = extract_text_from_jsonb(COALESCE(content_simplified, '[]'::jsonb))
WHERE content_text IS NULL;

-- 5. 填充全文搜索向量（使用 zhparser 或 simple）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'chinese') THEN
    UPDATE text_juans SET content_tsv = to_tsvector('chinese', COALESCE(content_text, ''))
    WHERE content_tsv IS NULL;
  ELSE
    UPDATE text_juans SET content_tsv = to_tsvector('simple', COALESCE(content_text, ''))
    WHERE content_tsv IS NULL;
  END IF;
END $$;

-- 6. 创建 GIN 索引用于全文搜索
CREATE INDEX CONCURRENTLY IF NOT EXISTS text_juans_content_tsv_idx
  ON text_juans USING GIN (content_tsv);

-- 7. 创建 pg_trgm 索引用于模糊匹配（可选，用于 ILIKE 查询）
CREATE INDEX CONCURRENTLY IF NOT EXISTS text_juans_content_text_trgm_idx
  ON text_juans USING GIN (content_text gin_trgm_ops);

-- 8. 创建触发器自动更新
CREATE OR REPLACE FUNCTION text_juans_tsv_trigger() RETURNS trigger AS $$
BEGIN
  -- 提取纯文本
  NEW.content_text := extract_text_from_jsonb(COALESCE(NEW.content_simplified, '[]'::jsonb));

  -- 生成全文搜索向量
  IF EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'chinese') THEN
    NEW.content_tsv := to_tsvector('chinese', COALESCE(NEW.content_text, ''));
  ELSE
    NEW.content_tsv := to_tsvector('simple', COALESCE(NEW.content_text, ''));
  END IF;

  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS text_juans_tsv_update ON text_juans;
CREATE TRIGGER text_juans_tsv_update
  BEFORE INSERT OR UPDATE OF content_simplified ON text_juans
  FOR EACH ROW EXECUTE FUNCTION text_juans_tsv_trigger();
