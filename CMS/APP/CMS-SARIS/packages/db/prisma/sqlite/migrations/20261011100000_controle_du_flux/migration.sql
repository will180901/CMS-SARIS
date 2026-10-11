-- AlterTable
ALTER TABLE "PosteLocal" ADD COLUMN "niveauControle" INTEGER;
ALTER TABLE "PosteLocal" ADD COLUMN "resyncDemandeeAt" DATETIME;
ALTER TABLE "PosteLocal" ADD COLUMN "resyncFaiteAt" DATETIME;
ALTER TABLE "PosteLocal" ADD COLUMN "suspenduAt" DATETIME;
ALTER TABLE "PosteLocal" ADD COLUMN "suspenduPar" TEXT;
ALTER TABLE "PosteLocal" ADD COLUMN "suspensionMotif" TEXT;
ALTER TABLE "PosteLocal" ADD COLUMN "versionApp" TEXT;

-- CreateIndex
CREATE INDEX "JournalSynchronisation_posteLocalId_startedAt_idx" ON "JournalSynchronisation"("posteLocalId", "startedAt");

