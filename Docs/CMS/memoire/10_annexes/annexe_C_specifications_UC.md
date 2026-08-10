# ANNEXE C — Spécifications des cas d'utilisation

> **Objet** : la spécification des **65 cas d'utilisation** du système. Le chapitre 6 n'en détaille que cinq, et n'en décrit textuellement que deux — plafond imposé par le plan de rédaction de l'école.
> **Organisation** : une table synthétique par module, puis cinq fiches complètes pour les cas structurants non détaillés au chapitre 6.

---

## 1. Table synthétique des 65 cas

**Légende des acteurs** : `A` administrateur système · `M` médecin chef · `I` infirmier · `P` poste local.

### Module Sécurité et accès personnel

| Id | Cas | Acteurs | Précondition | Postcondition | Exception principale |
|---|---|---|---|---|---|
| UC01 | Se connecter | A M I | Compte non désactivé | Session ouverte, droits chargés | Compte bloqué : refus avec durée restante |
| UC02 | Valider le second facteur | A M I | Second facteur activé | Jetons émis | Code invalide : refus |
| UC03 | Résoudre une connexion concurrente | A M I | Session déjà ouverte | Session précédente révoquée | — |
| UC04 | Changer son mot de passe | A M I | Session valide | Mot de passe remplacé | Ancien mot de passe erroné |
| UC05 | Consulter et révoquer ses sessions | A M I | Session valide | Sessions choisies révoquées | — |
| UC06 | Activer ou désactiver son second facteur | A M I | Session valide | Second facteur enrôlé ou retiré | Code de vérification invalide |
| UC07 | Accepter les conditions d'utilisation | A M I | Conditions non acceptées | Acceptation tracée, accès débloqué | — |
| UC08 | Gérer ses préférences | A M I | Session valide | Préférences enregistrées | — |

### Module Habilitations

| Id | Cas | Acteurs | Précondition | Postcondition | Exception principale |
|---|---|---|---|---|---|
| UC09 | Créer et gérer un compte | A M | Droit de gestion des comptes | Compte créé ou modifié | Identifiant déjà pris |
| UC10 | Attribuer un rôle | A | Compte existant | Droits effectifs recalculés | — |
| UC11 | Éditer la matrice d'un rôle | A | Droit d'édition des rôles | Permissions du rôle mises à jour | **Retrait d'une permission vitale : refus** |
| UC12 | Accorder ou révoquer une permission individuelle | A | Compte existant | Dérogation enregistrée | Révocation sur soi-même d'une permission vitale : refus |
| UC13 | Réinitialiser un mot de passe | A | Compte existant | Mot de passe temporaire émis | — |

### Module Supervision et paramètres

| Id | Cas | Acteurs | Précondition | Postcondition | Exception |
|---|---|---|---|---|---|
| UC14 | Consulter le journal d'audit | A M | Droit de lecture de l'audit | Journal affiché, filtrable | — |
| UC15 | Consulter les paramètres système | A | Droit de lecture des paramètres | Paramètres affichés | — |
| UC16 | Modifier les paramètres système | A | Droit de modification | Paramètre appliqué | Valeur hors domaine |

### Module Référentiels

| Id | Cas | Acteurs | Précondition | Postcondition | Exception |
|---|---|---|---|---|---|
| UC17 | Consulter un référentiel | A M I | Droit de lecture du service concerné | Liste affichée | Onglet non affiché si le droit manque |
| UC18 | Créer, modifier ou désactiver une entrée | A M | Droit d'écriture du service | Entrée enregistrée | Code déjà utilisé |
| UC19 | Gérer les sociétés sous-traitantes | A M | Droit dédié | Société enregistrée | — |
| UC20 | Tenir le registre des employés | A M I | Droit dédié | Employé enregistré | Matricule déjà utilisé |

### Module Acteurs médicaux

| Id | Cas | Acteurs | Précondition | Postcondition | Exception |
|---|---|---|---|---|---|
| UC21 | Gérer une fiche de personnel | A M | Droit de gestion du personnel | Fiche enregistrée | Matricule déjà utilisé |
| UC22 | Accorder une délégation | M | Infirmier existant et actif | Délégation active sur une période | Période invalide |
| UC23 | Révoquer une délégation | M | Délégation active | Délégation révoquée | Déjà révoquée |
| UC24 | Consulter ses délégations actives | I | Session valide | Délégations affichées | — |

### Module Dossier patient

| Id | Cas | Acteurs | Précondition | Postcondition | Exception |
|---|---|---|---|---|---|
| UC25 | Rechercher un patient | A M I | Droit de lecture des dossiers | Résultats affichés | — |
| UC26 | Créer un dossier | A M I | Droit de création | Dossier créé, numéro attribué | Matricule déjà utilisé |
| UC27 | Consulter un dossier | A M I | Droit de lecture | Dossier affiché | Dossier verrouillé : accès restreint |
| UC28 | Mettre à jour identité et données médicales | A M I | Droit de modification | Données enregistrées | Valeur hors plage |
| UC29 | Gérer les rattachements | A M I | Droit dédié | Rattachement enregistré et historisé | Employé introuvable |
| UC30 | Changer la catégorie | A M | Droit dédié | Catégorie changée, changement historisé | — |
| UC31 | Verrouiller ou déverrouiller un dossier | A M | Droit de verrouillage | Verrou posé ou levé, motif enregistré | — |
| UC32 | Archiver un dossier | A M | Droit d'archivage | Statut du dossier modifié | Visite en cours |
| UC33 | Imprimer un dossier | A M I | Droit de lecture | Document A4 généré | — |

### Module Triage

| Id | Cas | Acteurs | Précondition | Postcondition | Exception |
|---|---|---|---|---|---|
| UC34 | Ouvrir une visite | M I | Patient actif, aucune visite ouverte | Visite en attente, entrée dans la file | Patient inactif · motif inactif · visite déjà ouverte |
| UC35 | Relever les constantes vitales | M I | Visite modifiable | Constantes enregistrées, indice calculé | Valeur hors plage physiologique |
| UC36 | Affecter un soignant | M I | Visite non terminale | Soignant assigné | Soignant inactif |
| UC37 | Consulter la file d'attente | A M I | Droit de lecture des visites | File affichée, par ordre d'arrivée | — |
| UC38 | Annuler une visite | M I | Visite non terminale | Visite annulée, motif enregistré | Motif absent : refus |

### Module Consultation et actes prescrits

| Id | Cas | Acteurs | Précondition | Postcondition | Exception |
|---|---|---|---|---|---|
| UC39 | Ouvrir une consultation | M I | Visite en cours, soignant libre | Consultation ouverte | **Soignant déjà occupé** · visite déjà en consultation |
| UC40 | Saisir l'examen clinique | M I | Consultation ouverte | Examen enregistré | Consultation terminale |
| UC41 | Poser un diagnostic | M I | Consultation ouverte | Diagnostic ajouté | Pathologie inactive |
| UC42 | Créer et valider une ordonnance | M I* | **Droit de prescrire vérifié** | Ordonnance validée | **Infirmier sans délégation : refus** |
| UC43 | Émettre un bon de pharmacie | M I | Ordonnance pharmaceutique validée | Bon en attente | **Catégorie non couverte : refus motivé** |
| UC44 | Délivrer un bon de pharmacie | M | Bon en attente | Bon délivré, état définitif | Bon déjà délivré ou annulé |
| UC45 | Émettre un bon d'examen | M I | Ordonnance d'examen validée | Bon en attente | **Catégorie non couverte : refus motivé** |
| UC46 | Saisir un résultat d'examen | M I | Bon validé | Résultat enregistré, bon reçu | Bon non validé : refus |
| UC47 | Délivrer un certificat de repos | M I | Consultation ouverte | Certificat imprimable, date de reprise calculée | — |
| UC48 | Clôturer une consultation | M I | Consultation ouverte | Consultation et **visite parente** clôturées | État terminal : refus |
| UC49 | Annuler une consultation | M I | Consultation ouverte | Consultation annulée, motif enregistré | Motif absent : refus |

\* Infirmier uniquement sous délégation active.

### Module Sorties critiques et suivi

| Id | Cas | Acteurs | Précondition | Postcondition | Exception |
|---|---|---|---|---|---|
| UC50 | Initier une évacuation | M | Décision d'évacuation | Évacuation en cours | Évacuation déjà rattachée |
| UC51 | Suivre et clôturer une évacuation | M | Évacuation non terminale | Étape enregistrée, ou clôture | État terminal : refus |
| UC52 | Ouvrir un suivi de traitement | M I | Décision de suivi | Suivi en cours | Suivi déjà rattaché |
| UC53 | Ajouter une fiche de suivi | M I | Suivi en cours | Fiche datée ajoutée | Suivi terminal |

### Module Communication

| Id | Cas | Acteurs | Précondition | Postcondition | Exception |
|---|---|---|---|---|---|
| UC54 | Consulter ses conversations | A M I | Session valide | Conversations affichées | — |
| UC55 | Envoyer un message | A M I | Conversation ouverte | Message chiffré et distribué | Pièce jointe trop volumineuse |
| UC56 | Réagir, répondre, masquer | A M I | Message existant | Action enregistrée | — |
| UC57 | Consulter ses notifications | A M I | Session valide | Notifications affichées | — |
| UC58 | Diffuser une annonce | A | Droit dédié | Annonce distribuée aux destinataires éligibles | — |

### Module Pilotage

| Id | Cas | Acteurs | Précondition | Postcondition | Exception |
|---|---|---|---|---|---|
| UC59 | Consulter le tableau de bord | A M I | Droit de lecture | Indicateurs de son profil affichés | — |
| UC60 | Consulter un rapport | A M I | Droit de lecture des rapports | Rapport affiché | — |
| UC61 | Exporter un rapport | A M | Droit d'export | Fichier produit | — |

### Module Synchronisation

| Id | Cas | Acteurs | Précondition | Postcondition | Exception |
|---|---|---|---|---|---|
| UC62 | Enregistrer un poste local | P | Poste configuré | Poste connu du central | — |
| UC63 | Synchroniser un poste | P | Poste enregistré | Données à jour, conflits journalisés | Serveur injoignable : le poste continue localement |
| UC64 | Superviser le parc | A | Droit de lecture de la synchronisation | État du parc affiché | — |
| UC65 | Restaurer une sauvegarde | A | Droit de restauration | Configuration restaurée | — |

---

## 2. Fiches complètes des cas structurants

> Les cas UC01, UC34, UC42, UC48 et UC63 sont spécifiés au chapitre 6 § 6.5, et les descriptions textuelles complètes de UC43 et UC48 au § 6.6. Les cinq fiches ci-dessous complètent le tableau pour les cas les plus porteurs de règle.

### UC11 — Éditer la matrice de permissions d'un rôle

**Acteur** : administrateur système · **Module** : habilitations

**Préconditions.** L'acteur détient le droit d'édition des rôles. Le rôle existe.

**Postconditions.** Les permissions du rôle sont mises à jour ; les droits effectifs de tous les comptes portant ce rôle sont recalculés.

**Scénario nominal.** 1. L'acteur ouvre la matrice du rôle. 2. Il coche ou décoche des permissions. 3. **Le système complète automatiquement les lectures impliquées** : accorder une écriture accorde la lecture correspondante. 4. Il enregistre. 5. Les droits sont recalculés.

**Alternative A1 — Retrait d'une permission.** Le système étend la révocation à toutes les permissions qui en dépendent : retirer une lecture retire les écritures qu'elle rendait utilisables.

**Exception E1 — Permission vitale.** Le système refuse le retrait d'une des dix permissions de gouvernance si l'acteur se l'ôterait à lui-même, ou l'ôterait au dernier administrateur actif.

> **Règle à expliquer.** *Un droit d'écriture sans le droit de lecture correspondant est un droit mort* : l'utilisateur n'atteint jamais le formulaire, alors que la case cochée laisse croire à l'administrateur qu'il a accordé quelque chose. La complétion automatique évite ce piège.

### UC22 — Accorder une délégation de prescription

**Acteur** : médecin chef · **Module** : acteurs médicaux

**Préconditions.** L'acteur est médecin chef. L'infirmier destinataire existe et est actif.

**Postconditions.** Une délégation active existe, bornée par une date de début et une date de fin. L'infirmier peut prescrire pendant cette période.

**Scénario nominal.** 1. Le médecin chef ouvre la gestion des délégations. 2. Il sélectionne l'infirmier. 3. Il fixe la période et, le cas échéant, le périmètre. 4. Il enregistre. 5. La délégation devient active.

**Alternative A1.** Révocation avant terme : l'infirmier ne peut plus prescrire immédiatement.

**Exception E1.** Période invalide — date de fin antérieure à la date de début.

> **Portée réelle.** La délégation ne modifie **aucune** permission. Elle agit au niveau du service : l'infirmier possédait déjà la permission, il lui manquait l'autorisation. C'est la distinction centrale du système de droits.

### UC31 — Verrouiller un dossier patient

**Acteur** : médecin chef · **Module** : dossier patient

**Préconditions.** L'acteur détient le droit de verrouillage. Le dossier existe.

**Postconditions.** Le dossier est verrouillé, avec l'identité de celui qui a posé le verrou, la date et le motif. L'accès est restreint aux profils de supervision.

**Scénario nominal.** 1. Le médecin chef ouvre le dossier. 2. Il pose le verrou en indiquant un motif. 3. Le système enregistre le verrou et journalise l'action.

**Alternative A1.** Levée du verrou par un profil de supervision.

> **Point d'architecture.** Le verrou est appliqué **par l'interface de programmation, y compris sur le serveur embarqué du poste autonome**. C'est ce qui rend acceptable la réplication de tous les dossiers sur tous les postes : détenir la donnée n'est pas y avoir accès.
>
> À ne pas confondre avec le **rideau** de confidentialité, qui est un effet visuel de floutage.

### UC46 — Saisir un résultat d'examen

**Acteurs** : médecin chef, infirmier · **Module** : consultation et actes prescrits

**Préconditions.** L'acteur détient le droit de saisie de résultat. Le bon d'examen est **validé**.

**Postconditions.** Le résultat est enregistré et rattaché au bon ; le bon passe à l'état reçu.

**Scénario nominal.** 1. L'acteur ouvre le bon validé. 2. Il saisit le résultat. 3. Le système enregistre et fait passer le bon à l'état reçu.

**Exception E1.** Bon non validé : le système refuse. Un résultat ne peut se rattacher qu'à un examen effectivement prescrit et validé.

> **Point notable.** L'infirmier détient ce droit **sans avoir besoin d'une délégation** : saisir un résultat n'est pas un acte de prescription. La distinction entre acte de prescription et acte de délivrance ou de saisie est constante dans le système.

### UC50 — Initier une évacuation

**Acteur** : médecin chef exclusivement · **Module** : sorties critiques

**Préconditions.** Une consultation est en cours de clôture avec la décision d'évacuation. Aucune évacuation non annulée n'est déjà rattachée à cette consultation.

**Postconditions.** Une évacuation existe à l'état « en cours », rattachée à la consultation, avec son niveau d'urgence et son établissement de destination.

**Scénario nominal.** 1. Le médecin chef choisit la décision d'évacuation à la clôture. 2. Il renseigne le niveau d'urgence, l'établissement de destination et les informations cliniques. 3. Le système crée l'évacuation. 4. La fiche est imprimable et accompagne le patient.

**Alternatives.** A1 — suivi des étapes : en transport, puis admis. A2 — clôture. A3 — annulation, uniquement depuis l'état « en cours », avec motif obligatoire.

**Exception E1.** Une évacuation non annulée est déjà rattachée : refus.

> **Restriction d'acteur.** L'évacuation est le seul acte clinique **totalement fermé à l'infirmier**, même délégué. C'est cohérent : orienter un patient vers une structure supérieure engage une responsabilité médicale qui ne se délègue pas.

---

## 3. Contrôles de cette annexe

```
[ ] Les 65 cas d'utilisation du chapitre 6 § 6.3 figurent tous dans la table
[ ] Les acteurs correspondent à la matrice de permissions — INV-03 § 3
[ ] Les exceptions citées correspondent aux refus réellement implémentés — INV-07
[ ] Aucun cas d'utilisation n'a été inventé pour compléter un module
[ ] Les cinq fiches complètes ne dupliquent pas celles du chapitre 6
[ ] Le vocabulaire est conforme au glossaire, annexe F
```
