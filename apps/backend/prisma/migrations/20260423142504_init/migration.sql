-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'LIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SingleState" AS ENUM ('JOINED', 'AVAILABLE', 'SEARCHING', 'BOOKED', 'MOVING', 'MEETING', 'COMPLETED', 'UNMATCHED', 'OFFLINE');

-- CreateEnum
CREATE TYPE "UserRoleName" AS ENUM ('SYSTEM_ADMIN', 'ORGANISER');

-- CreateEnum
CREATE TYPE "IdentityProvider" AS ENUM ('GOOGLE', 'DISCORD');

-- CreateEnum
CREATE TYPE "MatchRunTrigger" AS ENUM ('SCHEDULED', 'IMMEDIATE');

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "IdentityProvider" NOT NULL,
    "provider_sub" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_role" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "UserRoleName" NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by" UUID,

    CONSTRAINT "user_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_organiser" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" UUID NOT NULL,

    CONSTRAINT "event_organiser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_language" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "event_language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pool" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "default_title" TEXT NOT NULL,
    "allow_rematch" BOOLEAN NOT NULL DEFAULT false,
    "call_schedule" JSONB NOT NULL,
    "meeting_time_limit_minutes" INTEGER,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pool_translation" (
    "id" UUID NOT NULL,
    "pool_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "pool_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag" (
    "id" UUID NOT NULL,
    "pool_id" UUID NOT NULL,
    "default_label" TEXT NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_translation" (
    "id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "tag_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_spot" (
    "id" UUID NOT NULL,
    "pool_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_spot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_spot_image" (
    "id" UUID NOT NULL,
    "meeting_spot_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_spot_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_script" (
    "id" UUID NOT NULL,
    "pool_id" UUID NOT NULL,
    "questions" JSONB NOT NULL,

    CONSTRAINT "question_script_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "single_session" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "user_id" UUID,
    "display_name" TEXT NOT NULL,
    "profile_image_key" TEXT,
    "profile_image_consent" BOOLEAN NOT NULL DEFAULT false,
    "state" "SingleState" NOT NULL DEFAULT 'JOINED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "single_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "single_pool_membership" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "pool_id" UUID NOT NULL,
    "own_tag_ids" UUID[],
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),

    CONSTRAINT "single_pool_membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "single_preference" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "pool_membership_id" UUID NOT NULL,
    "mandatory_tag_ids" UUID[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "single_preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscription" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "subscribed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "push_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_run" (
    "id" UUID NOT NULL,
    "pool_id" UUID NOT NULL,
    "trigger" "MatchRunTrigger" NOT NULL,
    "initiated_by" UUID,
    "ran_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_booked" INTEGER NOT NULL DEFAULT 0,
    "total_matched" INTEGER NOT NULL DEFAULT 0,
    "total_unmatched" INTEGER NOT NULL DEFAULT 0,
    "spots_shortfall" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "match_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match" (
    "id" UUID NOT NULL,
    "match_run_id" UUID NOT NULL,
    "session_a_id" UUID NOT NULL,
    "session_b_id" UUID NOT NULL,
    "meeting_spot_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMP(3),

    CONSTRAINT "match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_log" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "pool_id" UUID NOT NULL,
    "session_a_id" UUID NOT NULL,
    "session_b_id" UUID NOT NULL,
    "meeting_began_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meeting_ended_at" TIMESTAMP(3),

    CONSTRAINT "match_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_confirmation" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "confirmed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "no_show" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "meeting_confirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_entry" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "identity_user_id_idx" ON "identity"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "identity_provider_provider_sub_key" ON "identity"("provider", "provider_sub");

-- CreateIndex
CREATE INDEX "user_role_user_id_idx" ON "user_role"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_slug_key" ON "event"("slug");

-- CreateIndex
CREATE INDEX "event_organiser_user_id_idx" ON "event_organiser"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_organiser_event_id_user_id_key" ON "event_organiser"("event_id", "user_id");

-- CreateIndex
CREATE INDEX "event_language_event_id_idx" ON "event_language"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_language_default_unique" ON "event_language"("event_id", "is_default");

-- CreateIndex
CREATE UNIQUE INDEX "event_language_event_id_locale_key" ON "event_language"("event_id", "locale");

-- CreateIndex
CREATE INDEX "pool_event_id_idx" ON "pool"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "pool_translation_pool_id_locale_key" ON "pool_translation"("pool_id", "locale");

-- CreateIndex
CREATE INDEX "tag_pool_id_idx" ON "tag"("pool_id");

-- CreateIndex
CREATE UNIQUE INDEX "tag_translation_tag_id_locale_key" ON "tag_translation"("tag_id", "locale");

-- CreateIndex
CREATE INDEX "meeting_spot_pool_id_idx" ON "meeting_spot"("pool_id");

-- CreateIndex
CREATE INDEX "meeting_spot_image_meeting_spot_id_idx" ON "meeting_spot_image"("meeting_spot_id");

-- CreateIndex
CREATE UNIQUE INDEX "question_script_pool_id_key" ON "question_script"("pool_id");

-- CreateIndex
CREATE INDEX "single_session_event_id_idx" ON "single_session"("event_id");

-- CreateIndex
CREATE INDEX "single_session_user_id_idx" ON "single_session"("user_id");

-- CreateIndex
CREATE INDEX "single_pool_membership_session_id_idx" ON "single_pool_membership"("session_id");

-- CreateIndex
CREATE INDEX "single_pool_membership_pool_id_idx" ON "single_pool_membership"("pool_id");

-- CreateIndex
CREATE INDEX "single_preference_session_id_idx" ON "single_preference"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscription_endpoint_key" ON "push_subscription"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscription_session_id_idx" ON "push_subscription"("session_id");

-- CreateIndex
CREATE INDEX "match_run_pool_id_idx" ON "match_run"("pool_id");

-- CreateIndex
CREATE INDEX "match_match_run_id_idx" ON "match"("match_run_id");

-- CreateIndex
CREATE INDEX "match_session_a_id_idx" ON "match"("session_a_id");

-- CreateIndex
CREATE INDEX "match_session_b_id_idx" ON "match"("session_b_id");

-- CreateIndex
CREATE INDEX "match_meeting_spot_id_idx" ON "match"("meeting_spot_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_log_match_id_key" ON "match_log"("match_id");

-- CreateIndex
CREATE INDEX "match_log_pool_id_idx" ON "match_log"("pool_id");

-- CreateIndex
CREATE INDEX "match_log_session_a_id_idx" ON "match_log"("session_a_id");

-- CreateIndex
CREATE INDEX "match_log_session_b_id_idx" ON "match_log"("session_b_id");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_confirmation_match_id_session_id_key" ON "meeting_confirmation"("match_id", "session_id");

-- CreateIndex
CREATE INDEX "audit_entry_actor_id_occurred_at_idx" ON "audit_entry"("actor_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_entry_entity_type_entity_id_idx" ON "audit_entry"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "identity" ADD CONSTRAINT "identity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_organiser" ADD CONSTRAINT "event_organiser_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_organiser" ADD CONSTRAINT "event_organiser_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_organiser" ADD CONSTRAINT "event_organiser_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_language" ADD CONSTRAINT "event_language_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pool" ADD CONSTRAINT "pool_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pool_translation" ADD CONSTRAINT "pool_translation_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag" ADD CONSTRAINT "tag_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_translation" ADD CONSTRAINT "tag_translation_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_spot" ADD CONSTRAINT "meeting_spot_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_spot_image" ADD CONSTRAINT "meeting_spot_image_meeting_spot_id_fkey" FOREIGN KEY ("meeting_spot_id") REFERENCES "meeting_spot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_script" ADD CONSTRAINT "question_script_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "single_session" ADD CONSTRAINT "single_session_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "single_session" ADD CONSTRAINT "single_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "single_pool_membership" ADD CONSTRAINT "single_pool_membership_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "single_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "single_pool_membership" ADD CONSTRAINT "single_pool_membership_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "single_preference" ADD CONSTRAINT "single_preference_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "single_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "single_preference" ADD CONSTRAINT "single_preference_pool_membership_id_fkey" FOREIGN KEY ("pool_membership_id") REFERENCES "single_pool_membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "single_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_run" ADD CONSTRAINT "match_run_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_run" ADD CONSTRAINT "match_run_initiated_by_fkey" FOREIGN KEY ("initiated_by") REFERENCES "single_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_match_run_id_fkey" FOREIGN KEY ("match_run_id") REFERENCES "match_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_session_a_id_fkey" FOREIGN KEY ("session_a_id") REFERENCES "single_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_session_b_id_fkey" FOREIGN KEY ("session_b_id") REFERENCES "single_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_meeting_spot_id_fkey" FOREIGN KEY ("meeting_spot_id") REFERENCES "meeting_spot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_log" ADD CONSTRAINT "match_log_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_log" ADD CONSTRAINT "match_log_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_log" ADD CONSTRAINT "match_log_session_a_id_fkey" FOREIGN KEY ("session_a_id") REFERENCES "single_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_log" ADD CONSTRAINT "match_log_session_b_id_fkey" FOREIGN KEY ("session_b_id") REFERENCES "single_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_confirmation" ADD CONSTRAINT "meeting_confirmation_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_confirmation" ADD CONSTRAINT "meeting_confirmation_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "single_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_entry" ADD CONSTRAINT "audit_entry_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
