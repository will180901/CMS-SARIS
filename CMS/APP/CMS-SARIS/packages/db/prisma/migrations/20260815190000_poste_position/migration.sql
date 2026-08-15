-- Position géographique d'un POSTE de travail — quatre colonnes FACULTATIVES.
--
-- Aucune donnée existante n'est modifiée : les postes déjà déclarés restent
-- valides avec ces champs à NULL, et continuent de fonctionner sans position.
--
-- POURQUOI SUR LE POSTE, ET NON SUR LA TRACE D'AUTHENTIFICATION. Le journal
-- d'authentification s'en tient à l'adresse IP CONSTATÉE par le serveur : une
-- position transmise par le poste client serait falsifiable en trois clics et
-- n'aurait aucune valeur de preuve. Ici, il s'agit d'autre chose — situer une
-- MACHINE, une fois, à son installation, avec l'accord explicite de la personne
-- qui l'installe. Elle ne bouge qu'à une reconfiguration du poste, et n'est
-- jamais rafraîchie à la connexion d'un agent : on obtient une carte du parc
-- sans jamais suivre les déplacements de qui que ce soit.
--
-- "precisionM" : marge annoncée par le navigateur, en mètres. Elle est conservée
-- et affichée telle quelle, parce qu'elle varie énormément selon la machine —
-- une dizaine de mètres sur un appareil doté d'un GPS, plusieurs kilomètres sur
-- un poste fixe en Ethernet, où le navigateur retombe sur l'adresse IP. Une
-- position sans sa marge laisserait croire à une exactitude qu'elle n'a pas.
ALTER TABLE "PosteLocal" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "PosteLocal" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "PosteLocal" ADD COLUMN "precisionM" INTEGER;
ALTER TABLE "PosteLocal" ADD COLUMN "positionAt" TIMESTAMP(3);
