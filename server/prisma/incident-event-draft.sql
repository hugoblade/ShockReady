-- CreateTable
CREATE TABLE "IncidentEvent" (
    "id" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "oldStatus" "IncidentStatus",
    "newStatus" "IncidentStatus" NOT NULL,
    "changedById" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IncidentEvent_incidentId_createdAt_idx" ON "IncidentEvent"("incidentId", "createdAt");

-- CreateIndex
CREATE INDEX "IncidentEvent_changedById_createdAt_idx" ON "IncidentEvent"("changedById", "createdAt");

-- AddForeignKey
ALTER TABLE "IncidentEvent" ADD CONSTRAINT "IncidentEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "IncidentReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
