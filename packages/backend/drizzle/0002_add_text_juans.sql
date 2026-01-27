-- 创建分卷存储表
CREATE TABLE "text_juans" (
  "id" serial PRIMARY KEY NOT NULL,
  "text_id" varchar(32) NOT NULL,
  "juan" integer NOT NULL,
  "content_simplified" jsonb,
  "content_traditional" jsonb,
  CONSTRAINT "text_juans_text_id_texts_id_fk" FOREIGN KEY ("text_id") REFERENCES "public"."texts"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- 创建联合索引用于快速查询
CREATE UNIQUE INDEX "text_juans_text_id_juan_idx" ON "text_juans" ("text_id", "juan");

-- 创建 text_id 索引
CREATE INDEX "text_juans_text_id_idx" ON "text_juans" ("text_id");
