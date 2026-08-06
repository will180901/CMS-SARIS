-- Avertissement de double connexion : deux colonnes FACULTATIVES sur les sessions.
-- Aucune donnée existante n'est modifiée ni supprimée ; les sessions déjà ouvertes
-- restent valides avec ces deux champs à NULL.
--
-- "derniereActiviteAt" : dernier signe de vie (renouvellement de jeton). `createdAt`
--   seul ne suffit pas — une session ouverte le matin puis abandonnée (poste éteint)
--   paraîtrait active toute la journée. « Active il y a 30 s » et « plus rien depuis
--   6 h » appellent des réactions opposées de la part de l'utilisateur averti.
--
-- "appareilId" : identifiant stable de l'appareil, généré par le client. Permet de
--   reconnaître une reconnexion depuis le MÊME poste (app plantée, page rechargée) et
--   de ne pas déranger l'utilisateur dans ce cas. Distinct de "posteLocalId", qui n'est
--   rempli que par la session de SYNCHRO d'un poste desktop.
ALTER TABLE "SessionUtilisateur" ADD COLUMN "derniereActiviteAt" TIMESTAMP(3);
ALTER TABLE "SessionUtilisateur" ADD COLUMN "appareilId" TEXT;

-- Retrouver les sessions actives d'un utilisateur est fait à CHAQUE connexion
-- (détection de double session) : sans index, c'est un balayage de toute la table.
CREATE INDEX "SessionUtilisateur_utilisateurId_revokedAt_idx"
  ON "SessionUtilisateur" ("utilisateurId", "revokedAt");
