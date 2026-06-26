-- CreateEnum
CREATE TYPE "ModeOverridePermission" AS ENUM ('GRANT', 'REVOKE');

-- CreateTable
CREATE TABLE "UtilisateurPermission" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "mode" "ModeOverridePermission" NOT NULL,
    "motif" TEXT,
    "accordePar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UtilisateurPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UtilisateurPermission_utilisateurId_idx" ON "UtilisateurPermission"("utilisateurId");

-- CreateIndex
CREATE UNIQUE INDEX "UtilisateurPermission_utilisateurId_permissionId_key" ON "UtilisateurPermission"("utilisateurId", "permissionId");

-- AddForeignKey
ALTER TABLE "UtilisateurPermission" ADD CONSTRAINT "UtilisateurPermission_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilisateurPermission" ADD CONSTRAINT "UtilisateurPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
