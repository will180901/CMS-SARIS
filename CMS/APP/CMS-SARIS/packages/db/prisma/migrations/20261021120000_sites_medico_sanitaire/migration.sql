-- Le centre s'appelle « Centre Médico-Sanitaire » (et non « Médico-Social ») : renomme les sites
-- dont le nom porte encore l'ancienne expression (les deux sites d'origine et ceux créés depuis
-- l'application, ex. « Centre Médico-Social Pointe-Noire »). Données seulement, aucun changement
-- de schéma.
--
-- Seule l'expression « Centre Médico-Social » est remplacée : un site nommé autrement
-- (ex. « CMS Moutela ») n'est pas touché. `updatedAt` est avancé pour que le nouveau nom parte
-- vers les postes de bureau à leur prochaine synchronisation.

UPDATE "Site"
   SET "libelle" = REPLACE("libelle", 'Centre Médico-Social', 'Centre Médico-Sanitaire'),
       "updatedAt" = CURRENT_TIMESTAMP
 WHERE "libelle" LIKE '%Centre Médico-Social%';
