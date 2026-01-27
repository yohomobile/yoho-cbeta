CREATE TABLE "text_relations" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_text_id" varchar(32) NOT NULL,
	"target_text_id" varchar(32) NOT NULL,
	"relation_type" varchar(32) NOT NULL,
	"relation_subtype" varchar(32),
	"confidence" integer,
	"source" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "translation_group_texts" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"text_id" varchar(32) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "translation_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"base_title" text NOT NULL,
	"source" varchar(64)
);
--> statement-breakpoint
ALTER TABLE "text_relations" ADD CONSTRAINT "text_relations_source_text_id_texts_id_fk" FOREIGN KEY ("source_text_id") REFERENCES "public"."texts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "text_relations" ADD CONSTRAINT "text_relations_target_text_id_texts_id_fk" FOREIGN KEY ("target_text_id") REFERENCES "public"."texts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translation_group_texts" ADD CONSTRAINT "translation_group_texts_group_id_translation_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."translation_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translation_group_texts" ADD CONSTRAINT "translation_group_texts_text_id_texts_id_fk" FOREIGN KEY ("text_id") REFERENCES "public"."texts"("id") ON DELETE no action ON UPDATE no action;