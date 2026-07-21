-- Index unique PARTIEL (pas représentable dans schema.prisma — écrit à la main) : un seul bon
-- ACTIF (non annulé, non soft-supprimé) par ordonnance à la fois. Défense en profondeur en plus
-- de la vérification applicative dans ConsultationService.genererBonDepuisOrdonnance, pour
-- fermer la fenêtre de race entre deux requêtes concurrentes sur la même ordonnance.
-- Un bon ANNULE ou soft-supprimé n'est pas couvert par l'index : la régénération reste possible.
CREATE UNIQUE INDEX "BonExamen_ordonnanceId_actif_key"
  ON "BonExamen" ("ordonnanceId")
  WHERE "ordonnanceId" IS NOT NULL AND "statut" != 'ANNULE' AND "deletedAt" IS NULL;

CREATE UNIQUE INDEX "BonPharmacie_ordonnanceId_actif_key"
  ON "BonPharmacie" ("ordonnanceId")
  WHERE "ordonnanceId" IS NOT NULL AND "statut" != 'ANNULE' AND "deletedAt" IS NULL;
