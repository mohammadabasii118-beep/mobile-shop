-- CreateTable
CREATE TABLE "TopBarItem" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'link',
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "ctaLabel" TEXT,
    "link" TEXT,
    "copyText" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopBarItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TopBarItem_isActive_sortOrder_idx" ON "TopBarItem"("isActive", "sortOrder");

