ALTER TABLE "IncidentReport"
  ADD COLUMN "title" TEXT NOT NULL DEFAULT 'Incident report',
  ADD COLUMN "reporterAuthUserId" UUID;

CREATE INDEX "IncidentReport_reporterAuthUserId_reportedAt_idx"
  ON "IncidentReport" ("reporterAuthUserId", "reportedAt");
