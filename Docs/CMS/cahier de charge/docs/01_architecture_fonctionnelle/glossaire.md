# Glossaire — langage ubiquitaire CMS SARIS

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Historique** : v1.0 création

> Ce glossaire fixe le **langage ubiquitaire** du projet : un terme = une définition, référencée partout ailleurs par lien `[[...]]`. Il documente le système **tel que construit** (« as-built »). Les faits techniques renvoient au code réel sous `CMS/APP/CMS-SARIS/`. Voir aussi le brief système `[[_SOURCE_systeme]]`, les rôles dans `[[MODULE_02_acces_habilitations]]` et le contexte global `[[vision]]`.

---

## A

### Annonce
Communication diffusée par un administrateur à l'ensemble des utilisateurs d'un site, distincte d'un message privé. Inclut les **annonces de mise à jour** (lien d'installation de l'application desktop). Implémentée via le module `notification` (mécanisme `notification.create`), affichée par la cloche et le temps réel SSE.

### Assuré CDI
Patient de la catégorie **ASSURE_CDI** : travailleur de SARIS-CONGO en contrat à durée indéterminée, identifié par un **matricule**. Catégorie qui ouvre, avec l'**ayant droit**, le droit au **bon d'examen** et au **bon de pharmacie** (prestations MEDICAMENT et EXAMEN). Voir **Catégorie de patient**.

### Audit
Journalisation persistante et automatique des opérations sensibles (mutations des contrôleurs cliniques et de configuration), capturant acteur, action, IP réelle, géolocalisation et statut. Réalisée par le décorateur `@Audit` et un intercepteur global (`AuditInterceptor`) écrivant dans la table `JournalAudit`. Les actions des administrateurs auto-audités sont exclues.

### Ayant droit
Patient de la catégorie **AYANT_DROIT_CDI** : membre de la famille rattaché à un **assuré CDI** (via le matricule du CDI et un type de lien). Bénéficie, comme le CDI, du **bon d'examen** et du **bon de pharmacie**. Le rattachement est tracé (`RattachementAyantDroitCdi`, lié au registre **EmployeSaris**).

## B

### Bon d'examen
Document clinique prescrivant un examen complémentaire (laboratoire, imagerie…). Imprimable au format A4 SARIS. Sa création est **réservée aux CDI et ayants droit** (garde `assertPrestationCouverte(..., 'EXAMEN')`) et soumise au droit de prescription (médecin-chef, ou infirmier sous délégation active).

### Bon de pharmacie
Document distinct de l'**ordonnance** : bon de retrait de médicaments (voucher) en aval de la consultation. Cycle EN_ATTENTE → DELIVRE / ANNULE. **Réservé aux CDI et ayants droit** (garde `assertPrestationCouverte(..., 'MEDICAMENT')`). Imprimable A4. Module `apps/api/src/modules/bon-pharmacie`.

## C

### Catégorie de patient
Classement administratif qui **pilote les droits** aux prestations. Référentiel `CategoriePatient`. Catégories métier de référence : **CDI** (ASSURE_CDI), **ayant droit CDI** (AYANT_DROIT_CDI), **CDD** (ASSURE_CDD), **sous-traitant** et **riverain**. La matrice `DroitCategoriePatient` autorise CONSULTATION et PREMIERS_SOINS pour toutes les catégories, mais MEDICAMENT et EXAMEN uniquement pour CDI et ayants droit.

### Certificat
Document médical attestant un état (notamment certificat de **repos** maladie), imprimable A4. Existe comme document clinique du gabarit SARIS (à confirmer pour son périmètre exact, l'alignement au recueil ayant restreint cette zone).

### CGU (Conditions d'utilisation)
Conditions d'utilisation présentées à l'utilisateur (modale au login et dans les paramètres). L'**acceptation** est tracée (masque `cgu` sur l'utilisateur) et bloquante : un portail (`CguGate`) empêche l'accès tant que les CGU ne sont pas acceptées.

### Constantes vitales
Mesures physiologiques relevées au **triage** (et historisées dans le dossier) : tension, pouls, température, etc. Saisies lors de la **visite**, avant ou pendant la **consultation**. Des **alertes cliniques** automatiques peuvent en découler.

### Consultation
Acte clinique mené par un soignant pendant une **visite**, **piloté par la décision** : il aboutit à une **décision de consultation** (clôture simple, prescription, examen complémentaire ou évacuation) avec clôture guidée. Rattaché à un soignant (cloisonnement par initiateur). Module `apps/api/src/modules/consultation`.

## D

### Décision (de consultation)
Issue structurée d'une **consultation** qui en oriente le déroulé et la clôture. Valeurs : **CLOTURE_SIMPLE**, **PRESCRIPTION**, **EXAMEN_COMPLEMENTAIRE**, **EVACUATION**. La décision conditionne les documents générés et la fermeture de la visite.

### Dossier patient
Dossier médical **centralisé cross-site** : il suit le patient sur tous les sites. Contient identité, **matricule**, allergies/antécédents, alertes cliniques, mode de vie, données d'emploi, ayants droit, et la timeline des visites/consultations. Module `apps/api/src/modules/patient`. Peut être protégé par un **verrou de confidentialité**.

## E

### Évacuation
Décision et document orientant un patient vers une structure de soins supérieure (sortie critique). Comporte des étapes de suivi (ex. EN_TRANSPORT, ADMIS). Réservée au médecin-chef. Le module/menu s'intitule désormais « Évacuations » (anciennement « Sorties critiques »).

## L

### LWW (Last-Write-Wins)
Stratégie de résolution de conflits de la **synchronisation** : en cas d'écritures concurrentes sur un même enregistrement, la version la plus récente l'emporte. Comparaison fondée sur `updatedAt` (et `baseUpdatedAt`). Module `sync/`.

## M

### Matricule
Identifiant d'un travailleur SARIS. Porté par l'**assuré CDI** (et CDD), il sert de clé de rattachement des **ayants droit** et de lookup dans le registre **EmployeSaris**. Déclaratif (vérification visuelle à chaque visite), unique en base.

## O

### Ordonnance
Document de prescription de médicaments issu d'une **consultation**, imprimable A4. À la différence du **bon de pharmacie**, la prescription par ordonnance n'est **pas restreinte** par catégorie (libre pour toutes les catégories), mais reste soumise au droit de prescription (médecin-chef ou infirmier délégué).

## P

### Permission
Droit unitaire `module.action` (ex. `patient.lock`, `ordonnance.create`) du catalogue (~110 permissions, `packages/types/src/permissions.ts`). Les **rôles** reçoivent un sous-ensemble ; l'accès aux endpoints est contrôlé par le garde `@RequirePermissions`.

### Poste local
Instance de l'**application desktop** (Electron, Windows) en mode `local` : backend NestJS + base SQLite **embarqués**, opérationnelle **hors-ligne**, qui se **synchronise** avec le serveur central. Identifiée pour la synchro par un curseur `SyncState`.

## R

### Rideau de confidentialité
Dispositif d'interface masquant (effet de flou « verre poli ») en permanence les zones cliniques sensibles (triage/consultation), sauf au survol. Bascule globale dans l'en-tête (`privacy.store`), activée par défaut, neutralisée sur écran tactile. À distinguer du **verrou de confidentialité** (qui est une protection de données, pas un effet visuel).

### Riverain
Patient de la catégorie **RIVERAIN** : personne du voisinage, non rattachée à SARIS par un contrat. A droit à la consultation et aux premiers soins, mais **pas** au **bon d'examen** ni au **bon de pharmacie**.

### Rôle
Profil d'habilitation regroupant un ensemble de **permissions**. Le système compte **3 rôles** : **ADMIN_SYSTEME** (super-administrateur), **MEDECIN_CHEF** (admin médical + supervision), **INFIRMIER** (triage + consultation/prescription déléguée). À noter : **MEDECIN n'est pas un rôle** mais une **profession** du personnel médical (TypePersonnel) mappée au rôle **MEDECIN_CHEF** (tout médecin reçoit le rôle MEDECIN_CHEF). Voir `[[MODULE_02_acces_habilitations]]`.

## S

### Site
Établissement physique du CMS. Deux sites : **Moutela** et **Nkayi**. La plupart des activités (triage, consultations, messagerie) sont **cloisonnées par site** ; le **dossier patient** est, lui, centralisé cross-site.

### Sous-traitant
Patient de la catégorie **SOUS_TRAITANT** : travailleur d'une société sous-traitante (référentiel `SocieteSousTraitante`, rattachement via `societeId`). A droit à la consultation et aux premiers soins, mais **pas** au **bon d'examen** ni au **bon de pharmacie**.

### Supervision
Capacité de voir l'ensemble de l'activité clinique d'un site (au-delà de ses propres consultations) et de **verrouiller** un dossier. Réservée au groupe SUPERVISION = { **ADMIN_SYSTEME**, **MEDECIN_CHEF** }. Les autres rôles ne voient que leur propre activité (cloisonnement par initiateur).

### Synchronisation
Mécanisme rapprochant les données d'un **poste local** et du serveur central : **pull** (réception) + **push** (envoi), résolution **LWW**, propagation des suppressions par **tombstone**, purge planifiée (cron). Un écran admin supervise les postes, la file terrain, les sauvegardes de configuration et la volumétrie. Module `apps/api/src/modules/sync`.

## T

### Tombstone (soft-delete)
Marque de suppression logique : un enregistrement supprimé n'est pas effacé mais marqué (`deletedAt`), afin que la **synchronisation** propage la suppression à tous les **postes locaux** (soft-delete bi-cible). Permet une suppression cohérente en mode offline-first.

### Triage
Première étape du parcours : accueil et enregistrement d'une **visite** par ordre d'arrivée (**pas de priorité**), avec saisie/contrôle administratif **selon la catégorie**, relevé des **constantes vitales** et orientation vers la **file d'attente**. Module `apps/api/src/modules/triage`.

## V

### Verrou de confidentialité
Protection d'un **dossier patient** posée par un **médecin-chef** (permission `patient.lock`) restreignant l'accès au dossier. C'est un contrôle de **données** (gouvernance d'accès), à ne pas confondre avec le **rideau de confidentialité** (effet visuel d'interface). Implémenté dans `apps/api/src/modules/patient`.

### Visite
Passage d'un patient au CMS : unité de travail créée au **triage**, portant les **constantes vitales**, entrant dans la **file d'attente** par ordre d'arrivée, et clôturée par une **consultation**. États : EN_ATTENTE → EN_COURS → (CLOTUREE via consultation) / ANNULEE.

---

## File d'attente
Liste ordonnée des **visites** en attente de prise en charge, **par ordre d'arrivée** (la notion de priorité a été retirée de tout le système). Alimentée par le **triage**, consommée en **consultation**.
