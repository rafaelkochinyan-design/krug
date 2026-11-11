CREATE TYPE "public"."notification_channel" AS ENUM('telegram', 'email', 'push');--> statement-breakpoint
CREATE TYPE "public"."circle_status" AS ENUM('draft', 'recruiting', 'active', 'finished', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('hy', 'ru', 'en');--> statement-breakpoint
CREATE TYPE "public"."meeting_status" AS ENUM('scheduled', 'cancelled', 'done');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('organizer', 'co_host', 'member');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('joined', 'waitlisted', 'left', 'removed');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sent', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."rsvp" AS ENUM('yes', 'no', 'maybe');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('private', 'public');--> statement-breakpoint
CREATE TABLE "attendance" (
	"meeting_id" text NOT NULL,
	"user_id" text NOT NULL,
	"rsvp" "rsvp",
	"responded_at" timestamp with time zone,
	"attended" boolean,
	"marked_at" timestamp with time zone,
	"marked_by" text,
	CONSTRAINT "attendance_meeting_id_user_id_pk" PRIMARY KEY("meeting_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"blocker_id" text NOT NULL,
	"blocked_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocks_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id")
);
--> statement-breakpoint
CREATE TABLE "circles" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organizer_id" text NOT NULL,
	"previous_circle_id" text,
	"title" text NOT NULL,
	"activity" text NOT NULL,
	"language" "locale" NOT NULL,
	"city" text DEFAULT 'Yerevan' NOT NULL,
	"time_zone" text DEFAULT 'Asia/Yerevan' NOT NULL,
	"venue_id" text,
	"venue_text" text,
	"weekday" smallint NOT NULL,
	"start_time" text NOT NULL,
	"weeks" smallint NOT NULL,
	"capacity" smallint NOT NULL,
	"status" "circle_status" DEFAULT 'recruiting' NOT NULL,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"invite_code" text NOT NULL,
	"chat_link" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "circles_inviteCode_unique" UNIQUE("invite_code"),
	CONSTRAINT "circles_weekday_range" CHECK ("circles"."weekday" between 1 and 7),
	CONSTRAINT "circles_weeks_range" CHECK ("circles"."weeks" between 1 and 16),
	CONSTRAINT "circles_capacity_range" CHECK ("circles"."capacity" between 3 and 20),
	CONSTRAINT "circles_start_time_format" CHECK ("circles"."start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"circle_id" text NOT NULL,
	"index" smallint NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"venue_text" text,
	"status" "meeting_status" DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"circle_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"status" "membership_status" NOT NULL,
	"offered_at" timestamp with time zone,
	"offer_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"template" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dedupe_key" text NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_dedupeKey_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"reporter_id" text NOT NULL,
	"target_user_id" text,
	"target_circle_id" text,
	"reason" text NOT NULL,
	"details" text,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"resolved_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"locale" "locale" DEFAULT 'hy' NOT NULL,
	"city" text,
	"adult_confirmed_at" timestamp with time zone,
	"telegram_chat_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_telegramChatId_unique" UNIQUE("telegram_chat_id")
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"city" text DEFAULT 'Yerevan' NOT NULL,
	"latitude" text,
	"longitude" text,
	"is_partner" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_marked_by_users_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circles" ADD CONSTRAINT "circles_organizer_id_users_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circles" ADD CONSTRAINT "circles_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_circle_id_circles_id_fk" FOREIGN KEY ("target_circle_id") REFERENCES "public"."circles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "circles_organizer_idx" ON "circles" USING btree ("organizer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meetings_circle_index_uq" ON "meetings" USING btree ("circle_id","index");--> statement-breakpoint
CREATE INDEX "meetings_starts_at_idx" ON "meetings" USING btree ("starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_circle_user_uq" ON "memberships" USING btree ("circle_id","user_id");--> statement-breakpoint
CREATE INDEX "memberships_circle_status_idx" ON "memberships" USING btree ("circle_id","status","created_at");--> statement-breakpoint
CREATE INDEX "notifications_due_idx" ON "notifications" USING btree ("status","scheduled_for");