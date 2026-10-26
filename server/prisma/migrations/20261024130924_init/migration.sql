-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('MUNICIPALITY', 'NGO', 'GOVERNMENT_AGENCY', 'EMERGENCY_SERVICE', 'OTHER');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('ORG_ADMIN', 'MUNICIPAL_OFFICIAL', 'NGO_STAFF', 'RESPONDER', 'RESOURCE_COORDINATOR');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "IncidentCategory" AS ENUM ('FLOOD', 'STORM', 'DROUGHT', 'FIRE', 'WATER', 'ELECTRICITY', 'ROAD_DAMAGE', 'HEALTH', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('REPORTED', 'UNDER_REVIEW', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VerificationDecision" AS ENUM ('VERIFIED', 'REJECTED', 'NEEDS_MORE_INFORMATION');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DispatchStatus" AS ENUM ('PREPARING', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConfirmationStatus" AS ENUM ('CONFIRMED', 'PARTIALLY_RECEIVED', 'NOT_RECEIVED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'PENDING',
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "district" TEXT,
    "province" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffProfile" (
    "id" UUID NOT NULL,
    "authUserId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" "StaffRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentReport" (
    "id" UUID NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "category" "IncidentCategory" NOT NULL,
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "IncidentStatus" NOT NULL DEFAULT 'REPORTED',
    "description" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "community" TEXT,
    "locationDetails" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "reporterPhone" TEXT,
    "submissionMethod" TEXT NOT NULL DEFAULT 'WEB',
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "IncidentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportVerification" (
    "id" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "decision" "VerificationDecision" NOT NULL,
    "notes" TEXT,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponseAssignment" (
    "id" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "assignedStaffId" UUID,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "instructions" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResponseAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceDispatch" (
    "id" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "dispatchedById" UUID NOT NULL,
    "resourceName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT,
    "destination" TEXT NOT NULL,
    "status" "DispatchStatus" NOT NULL DEFAULT 'PREPARING',
    "dispatchedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptConfirmation" (
    "id" UUID NOT NULL,
    "dispatchId" UUID NOT NULL,
    "confirmedById" UUID NOT NULL,
    "status" "ConfirmationStatus" NOT NULL,
    "quantityReceived" INTEGER,
    "notes" TEXT,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_email_key" ON "Organization"("email");

-- CreateIndex
CREATE INDEX "Organization_status_idx" ON "Organization"("status");

-- CreateIndex
CREATE INDEX "Organization_type_status_idx" ON "Organization"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_authUserId_key" ON "StaffProfile"("authUserId");

-- CreateIndex
CREATE INDEX "StaffProfile_organizationId_role_idx" ON "StaffProfile"("organizationId", "role");

-- CreateIndex
CREATE INDEX "StaffProfile_active_idx" ON "StaffProfile"("active");

-- CreateIndex
CREATE UNIQUE INDEX "IncidentReport_referenceNumber_key" ON "IncidentReport"("referenceNumber");

-- CreateIndex
CREATE INDEX "IncidentReport_status_severity_idx" ON "IncidentReport"("status", "severity");

-- CreateIndex
CREATE INDEX "IncidentReport_category_reportedAt_idx" ON "IncidentReport"("category", "reportedAt");

-- CreateIndex
CREATE INDEX "IncidentReport_province_district_idx" ON "IncidentReport"("province", "district");

-- CreateIndex
CREATE INDEX "IncidentReport_reportedAt_idx" ON "IncidentReport"("reportedAt");

-- CreateIndex
CREATE INDEX "ReportVerification_incidentId_verifiedAt_idx" ON "ReportVerification"("incidentId", "verifiedAt");

-- CreateIndex
CREATE INDEX "ReportVerification_organizationId_verifiedAt_idx" ON "ReportVerification"("organizationId", "verifiedAt");

-- CreateIndex
CREATE INDEX "ResponseAssignment_incidentId_status_idx" ON "ResponseAssignment"("incidentId", "status");

-- CreateIndex
CREATE INDEX "ResponseAssignment_organizationId_status_idx" ON "ResponseAssignment"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ResponseAssignment_assignedStaffId_status_idx" ON "ResponseAssignment"("assignedStaffId", "status");

-- CreateIndex
CREATE INDEX "ResourceDispatch_incidentId_status_idx" ON "ResourceDispatch"("incidentId", "status");

-- CreateIndex
CREATE INDEX "ResourceDispatch_organizationId_status_idx" ON "ResourceDispatch"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ReceiptConfirmation_dispatchId_confirmedAt_idx" ON "ReceiptConfirmation"("dispatchId", "confirmedAt");

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportVerification" ADD CONSTRAINT "ReportVerification_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "IncidentReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportVerification" ADD CONSTRAINT "ReportVerification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportVerification" ADD CONSTRAINT "ReportVerification_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseAssignment" ADD CONSTRAINT "ResponseAssignment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "IncidentReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseAssignment" ADD CONSTRAINT "ResponseAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseAssignment" ADD CONSTRAINT "ResponseAssignment_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "StaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceDispatch" ADD CONSTRAINT "ResourceDispatch_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "IncidentReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceDispatch" ADD CONSTRAINT "ResourceDispatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceDispatch" ADD CONSTRAINT "ResourceDispatch_dispatchedById_fkey" FOREIGN KEY ("dispatchedById") REFERENCES "StaffProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptConfirmation" ADD CONSTRAINT "ReceiptConfirmation_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "ResourceDispatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptConfirmation" ADD CONSTRAINT "ReceiptConfirmation_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "StaffProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
