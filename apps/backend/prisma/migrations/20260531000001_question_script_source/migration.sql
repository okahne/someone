-- Store the raw DSL source for organiser-uploaded question scripts so it
-- can be re-rendered, downloaded and re-validated. Existing `questions`
-- JSON keeps the structured payload (legacy entries + new parsed form).
ALTER TABLE "question_script" ADD COLUMN "source" TEXT;
