-- CreateTable
CREATE TABLE "RequiredChannel" (
    "id" TEXT NOT NULL,
    "chatId" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "username" TEXT,
    "inviteUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequiredChannel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RequiredChannel_chatId_key" ON "RequiredChannel"("chatId");
