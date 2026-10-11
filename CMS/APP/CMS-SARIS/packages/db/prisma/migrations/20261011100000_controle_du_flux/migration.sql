-- AlterTable
ALTER TABLE "PosteLocal" ADD COLUMN     "niveauControle" INTEGER,
ADD COLUMN     "resyncDemandeeAt" TIMESTAMP(3),
ADD COLUMN     "resyncFaiteAt" TIMESTAMP(3),
ADD COLUMN     "suspenduAt" TIMESTAMP(3),
ADD COLUMN     "suspenduPar" TEXT,
ADD COLUMN     "suspensionMotif" TEXT,
ADD COLUMN     "versionApp" TEXT;

-- CreateIndex
CREATE INDEX "JournalSynchronisation_posteLocalId_startedAt_idx" ON "JournalSynchronisation"("posteLocalId", "startedAt");

