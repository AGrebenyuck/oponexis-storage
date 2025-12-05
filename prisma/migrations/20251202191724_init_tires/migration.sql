-- CreateEnum
CREATE TYPE "TireBatchType" AS ENUM ('STOCK', 'STORAGE');

-- CreateEnum
CREATE TYPE "TireSeason" AS ENUM ('SUMMER', 'WINTER', 'ALL_SEASON');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('IN', 'OUT', 'SCRAP', 'MOVE');

-- CreateTable
CREATE TABLE "TireBatch" (
    "id" TEXT NOT NULL,
    "type" "TireBatchType" NOT NULL,
    "rimDiameter" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "season" "TireSeason",
    "brand" TEXT,
    "model" TEXT,
    "condition" TEXT,
    "quantityTotal" INTEGER NOT NULL,
    "quantityAvailable" INTEGER NOT NULL,
    "pricePerTire" INTEGER,
    "pricePerSet" INTEGER,
    "storageOwnerName" TEXT,
    "storageOwnerPhone" TEXT,
    "storageStartedAt" TIMESTAMP(3),
    "storageExpiresAt" TIMESTAMP(3),
    "locationCode" TEXT,
    "photoNeedsUpdate" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TireBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TirePhoto" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TirePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TireMovement" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TireMovement_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TirePhoto" ADD CONSTRAINT "TirePhoto_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "TireBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TireMovement" ADD CONSTRAINT "TireMovement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "TireBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
