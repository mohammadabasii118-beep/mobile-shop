-- Phase 5: permanent redirects for changed slugs.
CREATE TABLE "SlugRedirect" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "oldSlug" TEXT NOT NULL,
    "newSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlugRedirect_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SlugRedirect_kind_oldSlug_key" ON "SlugRedirect"("kind", "oldSlug");
