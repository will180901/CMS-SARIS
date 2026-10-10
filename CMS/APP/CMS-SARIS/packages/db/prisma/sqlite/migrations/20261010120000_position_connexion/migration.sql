-- Pendant SQLite de la migration PostgreSQL du meme nom.
-- AlterTable
ALTER TABLE "JournalAuthentification" ADD COLUMN "latitude" REAL;
ALTER TABLE "JournalAuthentification" ADD COLUMN "longitude" REAL;
ALTER TABLE "JournalAuthentification" ADD COLUMN "positionLe" DATETIME;
ALTER TABLE "JournalAuthentification" ADD COLUMN "positionStatut" TEXT;
ALTER TABLE "JournalAuthentification" ADD COLUMN "precisionM" REAL;

