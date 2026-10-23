-- Appairage des postes : un code remis par un administrateur remplace l'identifiant et le mot de passe
-- d'un compte pour installer un poste de bureau. Le poste reçoit ensuite son propre secret (empreinte
-- conservée ici), échangé contre un jeton limité à la synchronisation.

-- AlterTable
ALTER TABLE "PosteLocal" ADD COLUMN     "accesRevoqueAt" TIMESTAMP(3),
ADD COLUMN     "appaireAt" TIMESTAMP(3),
ADD COLUMN     "appaireCodeId" TEXT,
ADD COLUMN     "secretHash" TEXT;

-- CreateTable
CREATE TABLE "CodeAppairage" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "usagesMax" INTEGER NOT NULL DEFAULT 1,
    "usagesFaits" INTEGER NOT NULL DEFAULT 0,
    "expireAt" TIMESTAMP(3) NOT NULL,
    "annuleAt" TIMESTAMP(3),
    "note" TEXT,
    "creePar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodeAppairage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CodeAppairage_codeHash_key" ON "CodeAppairage"("codeHash");

-- CreateIndex
CREATE INDEX "CodeAppairage_expireAt_idx" ON "CodeAppairage"("expireAt");
