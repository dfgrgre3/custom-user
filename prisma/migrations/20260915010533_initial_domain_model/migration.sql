-- CreateEnum
CREATE TYPE "SyncRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'invited', 'suspended');

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "apiBaseUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "companyName" TEXT,
    "companyIndustry" TEXT,
    "companyRole" TEXT,
    "companyWebsite" TEXT,
    "companyEmployees" INTEGER,
    "externalCreatedAt" TIMESTAMPTZ(3) NOT NULL,
    "externalUpdatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "status" "SyncRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),
    "recordsFetched" INTEGER,
    "recordsCreated" INTEGER,
    "recordsUpdated" INTEGER,
    "recordsDeleted" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_customerId_companyName_idx" ON "User"("customerId", "companyName");

-- CreateIndex
CREATE INDEX "User_customerId_updatedAt_idx" ON "User"("customerId", "updatedAt");

-- CreateIndex
CREATE INDEX "User_customerId_deletedAt_idx" ON "User"("customerId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_customerId_externalUserId_key" ON "User"("customerId", "externalUserId");

-- CreateIndex
CREATE INDEX "SyncRun_customerId_startedAt_idx" ON "SyncRun"("customerId", "startedAt");

-- CreateIndex
CREATE INDEX "SyncRun_customerId_status_idx" ON "SyncRun"("customerId", "status");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
