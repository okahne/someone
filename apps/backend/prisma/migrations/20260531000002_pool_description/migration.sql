-- Add description to pool (default + per-locale).
ALTER TABLE "pool" ADD COLUMN "default_description" TEXT;
ALTER TABLE "pool_translation" ADD COLUMN "description" TEXT;
