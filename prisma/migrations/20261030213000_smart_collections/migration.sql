-- v3.18.0 — smart collections extend BookGroup without changing static shelves.

ALTER TABLE "BookGroup" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'STATIC';
ALTER TABLE "BookGroup" ADD COLUMN "ruleJson" TEXT;
ALTER TABLE "BookGroup" ADD COLUMN "lastEvaluatedAt" DATETIME;
ALTER TABLE "BookGroup" ADD COLUMN "evaluationVersion" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "BookGroup_userId_mode_idx" ON "BookGroup"("userId", "mode");
