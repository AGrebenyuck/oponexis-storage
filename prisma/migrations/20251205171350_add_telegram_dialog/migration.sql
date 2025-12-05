-- CreateTable
CREATE TABLE "TelegramDialog" (
    "id" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramDialog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TelegramDialog_telegramUserId_isActive_idx" ON "TelegramDialog"("telegramUserId", "isActive");

-- CreateIndex
CREATE INDEX "TelegramDialog_chatId_isActive_idx" ON "TelegramDialog"("chatId", "isActive");
