-- Position géographique d'un POSTE — pendant SQLite de la migration PostgreSQL
-- du même nom (cf. prisma/migrations/20260815190000_poste_position).
--
-- Le backend embarqué du client de bureau porte le même schéma que le serveur
-- central : sans ces colonnes ici, un poste desktop planterait à la lecture d'un
-- enregistrement synchronisé depuis le central.
--
-- SQLite n'a ni DOUBLE PRECISION ni TIMESTAMP : Prisma y projette Float sur REAL
-- et DateTime sur DATETIME. Toutes facultatives, aucune donnée existante touchée.
ALTER TABLE "PosteLocal" ADD COLUMN "latitude" REAL;
ALTER TABLE "PosteLocal" ADD COLUMN "longitude" REAL;
ALTER TABLE "PosteLocal" ADD COLUMN "precisionM" INTEGER;
ALTER TABLE "PosteLocal" ADD COLUMN "positionAt" DATETIME;
