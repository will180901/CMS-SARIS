-- Durée des connexions et poste d'origine dans le journal d'authentification.
--
-- Chaque renouvellement de jeton crée une session NEUVE : une connexion est une chaîne
-- de lignes. "connexionId" relie les lignes d'une même connexion (id de la première),
-- et le journal garde la connexion ouverte par chaque évènement — d'où la durée.
-- "posteLocalId" : poste desktop d'origine (session de synchronisation).
-- Colonnes ajoutées, toutes vides : aucune donnée existante n'est modifiée.

-- AlterTable
ALTER TABLE "SessionUtilisateur" ADD COLUMN     "connexionId" TEXT;

-- AlterTable
ALTER TABLE "JournalAuthentification" ADD COLUMN     "connexionId" TEXT,
ADD COLUMN     "posteLocalId" TEXT;

-- CreateIndex
CREATE INDEX "SessionUtilisateur_connexionId_idx" ON "SessionUtilisateur"("connexionId");

