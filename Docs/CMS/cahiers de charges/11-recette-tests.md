# Document 11 - Recette et Tests

## 1. Objectif

Ce document décrit la stratégie de recette et de validation de CMS SARIS telle qu'elle a été **réellement** appliquée pendant le développement, ainsi que les scénarios de validation des parcours critiques.

Le principe directeur de la recette est le suivant : un module n'est considéré comme acceptable que si ses parcours métier critiques fonctionnent en ligne, hors ligne quand le mode hors ligne est requis, et avec les permissions correctes.

Le document distingue clairement :

- ce qui a été **réalisé et validé** (recette manuelle bout en bout, vérifications de type, build) ;
- ce qui constitue une **extension future** (notamment une suite de tests automatisés étendue).

> **Note d'honnêteté méthodologique.** Le projet ne dispose **pas** à ce jour d'une suite de tests automatisés étendue (tests unitaires, tests d'intégration, tests end-to-end pilotés). La recette repose sur trois piliers réellement mis en oeuvre : (1) des scénarios **end-to-end manuels** exécutés dans le navigateur, (2) la **vérification statique de types** (`tsc`), et (3) la **compilation/build** des applications. La mise en place d'une suite automatisée complète est documentée en section 10 comme extension future.

## 2. Périmètre validé

La recette porte sur l'application telle que construite (« as-built ») :

- **8 modules MVP** : Sécurité/Administration/Audit, Référentiels, Acteurs administratifs, Dossier patient, Accueil/Triage, Consultation/Actes, Sorties critiques, Synchronisation offline-first ;
- **modules transversaux ajoutés** : Messagerie interne chiffrée, Notifications temps réel, Conditions générales d'utilisation versionnées, Documents A4 imprimables ;
- **socle de données** : 79 tables Prisma, 22 migrations ;
- **socle de sécurité** : 110 permissions, 6 rôles (ADMIN_SYSTEME, ADMIN_MEDICAL, MEDECIN_CHEF, INFIRMIER, INFIRMIER_DELEGUE, AGENT_RH).

## 3. Stratégie de recette réellement appliquée

La recette s'articule autour de trois niveaux complémentaires, tous effectivement exécutés au cours du projet.

### 3.1. Vérification statique des types (`tsc`)

L'ensemble du monorepo est typé en TypeScript de bout en bout (frontend React, backend NestJS, paquets partagés `packages/types`, `packages/ui`, `packages/db`).

- La compilation TypeScript (`tsc`) sert de premier filet de sécurité : elle garantit la cohérence des contrats de données entre le backend (DTO NestJS) et le frontend (appels d'API, hooks).
- Le typage partagé via `packages/types` réduit les régressions silencieuses entre couches.

**Statut : réalisé, exécuté régulièrement pendant le développement.**

### 3.2. Compilation / build des applications

- Build de l'application web (Vite 7), y compris la chaîne PWA (Workbox via `vite-plugin-pwa`).
- Build de l'API NestJS 11.
- Génération du client Prisma 6 et application des 22 migrations sur PostgreSQL 16.

Le build sert de second filet : il valide l'intégration des dépendances, la résolution des modules et la viabilité du bundle de production.

> **Limite connue (dette technique pré-existante).** Le build PWA de l'application web s'effectue via `vite build` directement, et non via la cible agrégée du monorepo, en raison d'une dette de configuration antérieure. Ce point est documenté comme tâche d'assainissement.

**Statut : réalisé.**

### 3.3. Recette fonctionnelle end-to-end manuelle (navigateur)

Les parcours critiques ont été validés manuellement dans le navigateur, en conditions réelles d'usage. Plusieurs fonctionnalités sensibles ont fait l'objet d'une validation E2E explicite, notamment :

- **TOTP** : persistance du secret chiffré (AES-GCM), codes de secours au login, vérification bout en bout ;
- **Acceptation des CGU** : porte bloquante (CguGate) au login et dans les paramètres, traçabilité date + version, parcours prouvé E2E ;
- **Messagerie chiffrée** : chiffrement au repos (AES-256-GCM), envoi/réception, pièces jointes chiffrées, accusés de lecture, compression d'image côté client et aller-retour chiffré inline, rotation/versioning de clé (test de rotation passant) ;
- **Triage et offline** : ouverture de visite, constantes, file d'attente temps réel, création hors ligne et rejeu à la reconnexion ;
- **Sauvegarde/restauration de configuration** : sauvegarde réelle (contenuJson) et restauration non destructive.

**Statut : réalisé (manuel), non automatisé.**

### 3.4. Couverture transverse attendue de la recette

Quel que soit le niveau, la recette cherche à couvrir :

- le parcours métier complet ;
- les droits et permissions (110 permissions, 6 rôles) ;
- les cas alternatifs et d'erreur utilisateur ;
- le fonctionnement offline-first ;
- l'audit (journalisation persistante des mutations) ;
- la cohérence et la non-perte de données.

## 4. Scénarios métier bout en bout

Les scénarios suivants constituent la grille de recette fonctionnelle. Ils sont exécutés manuellement.

### Scénario 1 - Consultation simple CDI

1. Créer ou rechercher un patient CDI (dédoublonnage à la saisie).
2. Ouvrir une visite à l'accueil.
3. Saisir les constantes (calcul IMC, alertes automatiques) et le motif.
4. Orienter vers le soignant (file d'attente par ordre d'arrivée).
5. Réaliser la consultation et poser le diagnostic.
6. Clôturer sans acte prescrit.

**Acceptation :** dossier, visite, consultation et journal d'audit sont cohérents ; la visite apparaît clôturée dans la file.

### Scénario 2 - Prescription sécurisée

1. Sélectionner un patient avec allergie connue.
2. Ouvrir une consultation.
3. Tenter de prescrire un médicament contre-indiqué.
4. Vérifier le contrôle de risque (allergie, contre-indication, grossesse).
5. Valider une ordonnance autorisée.

**Acceptation :** les contrôles de sécurité prescription se déclenchent et l'ordonnance validée reste tracée avec ses lignes.

### Scénario 3 - Examen complémentaire

1. Décider d'un examen depuis la consultation.
2. Créer le bon d'examen.
3. Saisir le résultat ultérieurement.
4. Mettre à jour le diagnostic.

**Acceptation :** le résultat reste rattaché au bon d'examen initial.

### Scénario 4 - Sous-traitant à droits restreints

1. Créer un patient sous-traitant rattaché à une société active.
2. Ouvrir une visite.
3. Vérifier l'application des droits de catégorie.
4. Réaliser la consultation.

**Acceptation :** les restrictions de droits s'affichent clairement et sont appliquées.

### Scénario 5 - Ayant droit CDI suspendu

1. Créer un ayant droit rattaché à un agent CDI.
2. Suspendre le rattachement / l'agent CDI.
3. Ouvrir une visite pour l'ayant droit.

**Acceptation :** l'alerte de suspension est visible et l'historique de rattachement est conservé.

### Scénario 6 - Évacuation urgente

1. Ouvrir une consultation.
2. Décider d'une évacuation.
3. Saisir destination et motif.
4. Suivre le départ et le retour d'information (suivi d'évacuation).
5. Générer la fiche A4 imprimable.

**Acceptation :** l'évacuation est rattachée à la consultation, l'alerte est visible et la fiche A4 se génère (logo réel, aperçu intégré).

### Scénario 7 - Accident du travail

1. Ouvrir une visite pour un patient éligible.
2. Qualifier l'AT depuis la consultation.
3. Saisir circonstances, lésions et gravité.
4. Suivre l'arrêt, la reprise ou la consolidation (suivi d'AT).
5. Générer la fiche A4.

**Acceptation :** le dossier AT est complet, lisible et rattaché à la consultation d'origine.

### Scénario 8 - Plusieurs jours sans réseau (offline-first)

1. Passer un poste en mode hors ligne.
2. Créer patients, visites, consultations et ordonnances hors ligne.
3. Rétablir le réseau.
4. Laisser le moteur de synchronisation rejouer la file.

**Acceptation :** aucune donnée perdue, aucun doublon critique ; la file de rejeu (IndexedDB) se vide et l'état temps réel se met à jour.

### Scénario 9 - Messagerie interne chiffrée

1. Ouvrir une conversation 1-1, puis un groupe.
2. Envoyer un message texte, une pièce jointe (image compressée) et une note vocale.
3. Vérifier le chiffrement au repos, les accusés de lecture (3 états) et la présence.
4. Supprimer un message « pour moi » puis « pour tout le monde » (≤ 15 min).

**Acceptation :** les contenus sont chiffrés au repos, les accusés et la présence se mettent à jour en temps réel, le cloisonnement par site est respecté.

### Scénario 10 - Conditions générales d'utilisation

1. Se connecter avec un compte n'ayant pas accepté la version courante des CGU.
2. Vérifier le blocage par la porte CGU (CguGate).
3. Accepter les CGU.
4. Vérifier la traçabilité (date + version) et l'accès débloqué.

**Acceptation :** l'accès est bloqué tant que la version courante n'est pas acceptée ; l'acceptation est tracée.

## 5. Recette par module

| Module | Points de recette principaux | Statut |
|---|---|---|
| Sécurité / Admin / Audit | Connexion bcrypt, TOTP chiffré + codes de secours, JWT + sessions, rôles + dérogations GRANT/REVOKE, audit persistant (IP + géo), journal d'authentification, paramètres système, sauvegarde/restauration | Réalisé |
| Référentiels | Création, modification, suppression 409-safe, temps réel LIVE_REFERENTIELS | Réalisé |
| Acteurs administratifs | Personnel médical, sociétés sous-traitantes, délégations de prescription (+ médicaments autorisés), rattachements ayant-droit CDI & sous-traitant (+ historiques) | Réalisé |
| Dossier patient | Recherche/dédoublonnage, identité, contacts urgence, allergies, antécédents, alertes médicales, catégorie + historique, fusion de dossiers, constantes, documents | Réalisé |
| Accueil / Triage | Ouverture visite, constantes + alertes auto + IMC, motif, file temps réel (ordre d'arrivée), orientation, clôture/annulation, offline complet | Réalisé |
| Consultation / Actes | Examen + diagnostic, conclusion, ordonnance (contrôles allergie/contre-indication/grossesse) + validation, bon d'examen + résultats, suivi chronique, délégation de prescription | Réalisé |
| Sorties critiques | Évacuations (+ suivi), accidents du travail (+ suivi), suivis chroniques, fiches A4 | Réalisé |
| Synchronisation offline-first | PWA Workbox, file de rejeu IndexedDB, moteur de synchronisation, sauvegarde/restauration config, cron quotidien 02h00, LIVE_SYNC | Réalisé |
| Messagerie interne | Conversations 1-1 + groupes, pièces jointes chiffrées, notes vocales, réactions emoji, accusés 3 états, présence, suppression 2 niveaux, rotation de clé | Réalisé |
| Notifications temps réel | Flux SSE, invalidations react-query, suppression au survol/multiple/tout, sons UI | Réalisé |
| CGU versionnées | Charte 7 sections, acceptation tracée, porte bloquante CguGate | Réalisé |
| Documents imprimables | Gabarit A4 unifié (ordonnance, bon d'examen, évacuation, accident, suivi, synthèse dossier) | Réalisé |
| Suite de tests automatisés | Tests unitaires/intégration/E2E pilotés couvrant l'ensemble | Extension future |

## 6. Tests de sécurité

Vérifications de recette du socle de sécurité (110 permissions, 6 rôles) :

- un rôle non autorisé ne voit pas l'écran (filtrage côté frontend) ;
- le serveur refuse une action interdite (le frontend ne fait pas autorité — la décision finale est côté API) ;
- une session expire (JWT, refresh 7 jours) ;
- une action sensible apparaît dans l'audit persistant (interceptor global `@Audit` → `journalAudit`, avec IP + géolocalisation) ;
- un compte désactivé ne peut plus se connecter ;
- les dérogations individuelles GRANT/REVOKE priment correctement sur les permissions de rôle ;
- durcissement messagerie : rate-limit 40/min/utilisateur, anti-IDOR cross-site, contrôle magic-bytes + assainissement du nom de fichier, cloisonnement par site.

## 7. Tests offline

Le mode hors ligne est le coeur fonctionnel du projet ; il fait l'objet d'une recette manuelle dédiée :

- créer une visite hors ligne ;
- clôturer une consultation hors ligne ;
- créer une ordonnance hors ligne ;
- synchroniser sans doublon à la reconnexion (file de rejeu `apps/web/src/lib/sync.ts`, `useSyncEngine`) ;
- rejouer une synchronisation interrompue ;
- vérifier la résilience du cache PWA (NetworkFirst sur les GET d'API).

> La gestion fine des conflits de synchronisation (tables `ConflitSynchronisation`, `ResolutionConflit` présentes au schéma) est partiellement outillée ; la résolution manuelle assistée enrichie reste une piste d'extension.

## 8. Tests de cohérence des données

- un patient fusionné conserve son historique (`FusionDossierPatient`) ;
- une catégorie patient modifiée conserve son historique (`HistoriqueCategoriePatient`) ;
- une ordonnance validée conserve ses lignes (`LigneOrdonnance`) ;
- un résultat d'examen reste rattaché à son bon (`BonExamen` / `LigneExamen` / `ResultatExamen`) ;
- un accident du travail reste rattaché à sa consultation d'origine ;
- la suppression d'un référentiel référencé est bloquée (409-safe) plutôt que de casser l'intégrité ;
- la restauration d'une sauvegarde de configuration est non destructive.

## 9. Critères d'acceptation MVP

Le MVP est jugé acceptable si :

- les 8 modules fonctionnent dans leur périmètre, ainsi que les modules transversaux ajoutés (messagerie, notifications, CGU, documents) ;
- les parcours patient principaux sont complets de bout en bout ;
- les droits par catégorie de patient sont appliqués ;
- les permissions utilisateurs (110 permissions, 6 rôles) sont appliquées côté serveur ;
- l'audit capture les actions sensibles de manière persistante ;
- le mode hors ligne couvre triage, dossier, consultation et actes principaux, avec rejeu sans perte ;
- la vérification de types (`tsc`) et le build passent ;
- les sujets explicitement hors périmètre ne sont pas implémentés (cf. document de cadrage).

## 10. Limites de la recette et extensions futures

Cette section assume la transparence sur l'état réel de la qualité logicielle.

### 10.1. Limite principale : absence de suite de tests automatisés étendue

À ce jour, la validation repose sur la recette manuelle, le typecheck et le build. Il n'existe **pas** de suite automatisée couvrant l'ensemble du périmètre. Conséquences :

- la non-régression dépend de la rigueur de la recette manuelle ;
- certaines vérifications fines (contrôles prescription, calculs de constantes, résolution de conflits offline) gagneraient à être figées dans des tests.

### 10.2. Extensions de recette envisagées

| Extension | Apport attendu |
|---|---|
| Tests unitaires backend (Jest) | Figer les règles métier sensibles (contrôles allergie/contre-indication/grossesse, calculs IMC/alertes) |
| Tests d'intégration API + base | Valider permissions, audit et contraintes d'intégrité côté serveur |
| Tests E2E pilotés (Playwright/Cypress) | Automatiser les scénarios 1 à 10 et le offline-first |
| Jeux de données réalistes (seed de recette) | Rendre la recette représentative et reproductible |
| Pipeline CI (typecheck + build + tests) | Bloquer les régressions à chaque modification |

> Ces extensions sont cohérentes avec les autres extensions hors périmètre déjà identifiées (gestion des stocks, délivrance physique des médicaments, transmission CNSS, reporting directionnel agrégé, suivi grossesse complet, planning/présence du personnel, i18n multilingue).

## 11. Points de vigilance

- Sans jeux de données réalistes, la recette manuelle peut donner une fausse impression de robustesse.
- Sans tests offline réels et répétés, le coeur du projet (offline-first) reste sensible aux régressions.
- Sans matrice de permissions tenue à jour, les erreurs d'accès passent inaperçues — la décision d'autorisation doit toujours être validée côté serveur.
- Sans automatisation, l'effort de recette croît à chaque évolution : la mise en place d'une CI et de tests automatisés est la priorité d'industrialisation post-MVP.
