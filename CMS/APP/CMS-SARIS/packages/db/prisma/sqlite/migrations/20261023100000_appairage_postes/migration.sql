-- Appairage des postes : un code remis par un administrateur remplace l'identifiant et le mot de passe
-- d'un compte pour installer un poste de bureau. Ces tables n'ont aucun usage sur un poste local (le
-- serveur central les tient) ; elles existent pour que son schéma reste celui du serveur.

-- AlterTable
ALTER TABLE "PosteLocal" ADD COLUMN "accesRevoqueAt" DATETIME;
ALTER TABLE "PosteLocal" ADD COLUMN "appaireAt" DATETIME;
ALTER TABLE "PosteLocal" ADD COLUMN "appaireCodeId" TEXT;
ALTER TABLE "PosteLocal" ADD COLUMN "secretHash" TEXT;

-- CreateTable
CREATE TABLE "CodeAppairage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codeHash" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "usagesMax" INTEGER NOT NULL DEFAULT 1,
    "usagesFaits" INTEGER NOT NULL DEFAULT 0,
    "expireAt" DATETIME NOT NULL,
    "annuleAt" DATETIME,
    "note" TEXT,
    "creePar" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "CodeAppairage_codeHash_key" ON "CodeAppairage"("codeHash");

-- CreateIndex
CREATE INDEX "CodeAppairage_expireAt_idx" ON "CodeAppairage"("expireAt");
