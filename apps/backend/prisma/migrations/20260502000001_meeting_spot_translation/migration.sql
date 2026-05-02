-- Per-locale translations for meeting spots
CREATE TABLE "meeting_spot_translation" (
    "id" UUID NOT NULL,
    "meeting_spot_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "meeting_spot_translation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "meeting_spot_translation_meeting_spot_id_locale_key"
    ON "meeting_spot_translation"("meeting_spot_id", "locale");

ALTER TABLE "meeting_spot_translation"
    ADD CONSTRAINT "meeting_spot_translation_meeting_spot_id_fkey"
    FOREIGN KEY ("meeting_spot_id") REFERENCES "meeting_spot"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
