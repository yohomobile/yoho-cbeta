CREATE TABLE "dynasties" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"name" varchar(32) NOT NULL,
	"aliases" text,
	"start_year" integer,
	"end_year" integer,
	"era" varchar(32),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "persons" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"aliases" text,
	"dynasty_id" varchar(32),
	"nationality" varchar(64),
	"identity" varchar(64),
	"bio" text
);
--> statement-breakpoint
CREATE TABLE "text_persons" (
	"id" serial PRIMARY KEY NOT NULL,
	"text_id" varchar(32) NOT NULL,
	"person_id" integer NOT NULL,
	"role_type" varchar(32) NOT NULL,
	"role_raw" varchar(32),
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "texts" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"volume_count" integer,
	"collection_id" varchar(16),
	"category" varchar(128)
);
--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_dynasty_id_dynasties_id_fk" FOREIGN KEY ("dynasty_id") REFERENCES "public"."dynasties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "text_persons" ADD CONSTRAINT "text_persons_text_id_texts_id_fk" FOREIGN KEY ("text_id") REFERENCES "public"."texts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "text_persons" ADD CONSTRAINT "text_persons_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;