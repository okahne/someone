-- Add timezone to event (moved from per-pool callSchedule)
ALTER TABLE "event" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';
