# INV-03 — Inventaire des permissions et des rôles

> **Statut** : extrait · **Date d’extraction** : 2026-08-10
> **Sources** : `packages/types/src/permissions.ts` (catalogue, métadonnées, affectation par défaut) croisé avec **INV-01** (routes)
> **Nature de la preuve** : `IMPLÉMENTÉ`.

---

## 1. Synthèse

| Indicateur | Valeur |
|---|---|
| Permissions au catalogue | **128** |
| Permissions décrites (libellé + module) | **128** |
| Modules de permissions | **22** |
| Rôles système | **3** |
| Permissions exigées par au moins une route | **125** |
| Permissions sans aucune route | **3** (voir § 6) |

> ⚠️ **Arbitrage d’un écart documentaire.** Le README de l’application annonce « 116 permissions », et une documentation antérieure du projet « ~110 ». Le comptage direct du catalogue donne **128**. C’est cette valeur qui fait foi dans tout le mémoire — le code est l’autorité sur ce qui est livré.

### 1.1 Répartition par module

| Module | Permissions | ADMIN_SYSTEME | MEDECIN_CHEF | INFIRMIER |
|---|---:|:---:|:---:|:---:|
| `referentiel` | 29 | 29/29 | 29/29 | 9/29 |
| `patient` | 8 | 8/8 | 7/8 | 4/8 |
| `consultation` | 8 | 8/8 | 8/8 | 7/8 |
| `visite` | 7 | 7/7 | 7/7 | 5/7 |
| `ordonnance` | 7 | 7/7 | 7/7 | 7/7 |
| `bon_examen` | 7 | 7/7 | 6/7 | 5/7 |
| `utilisateur` | 7 | 7/7 | 0/7 | 0/7 |
| `evacuation` | 6 | 6/6 | 6/6 | 0/6 |
| `suivi_traitement` | 6 | 6/6 | 6/6 | 6/6 |
| `bon_pharmacie` | 5 | 5/5 | 4/5 | 3/5 |
| `delegation` | 5 | 5/5 | 5/5 | 0/5 |
| `personnel` | 4 | 4/4 | 4/4 | 0/4 |
| `sous_traitant` | 4 | 4/4 | 4/4 | 1/4 |
| `employe` | 4 | 4/4 | 4/4 | 2/4 |
| `role` | 4 | 4/4 | 0/4 | 0/4 |
| `notification` | 4 | 4/4 | 0/4 | 0/4 |
| `messagerie` | 4 | 4/4 | 0/4 | 0/4 |
| `synchronisation` | 3 | 3/3 | 0/3 | 0/3 |
| `rapport` | 2 | 2/2 | 2/2 | 1/2 |
| `parametre` | 2 | 2/2 | 0/2 | 0/2 |
| `dashboard` | 1 | 1/1 | 1/1 | 1/1 |
| `audit` | 1 | 1/1 | 1/1 | 0/1 |
| **Total** | **128** | **128** | **101** | **51** |

### 1.2 Les trois rôles

| Code | Libellé | Permissions | Part du catalogue | Vocation |
|---|---|---:|---:|---|
| `ADMIN_SYSTEME` | Administrateur Système | 128 | 100 % | Super-administrateur : gouvernance système **et** accès clinique complet. Choix assumé pour ce déploiement. |
| `MEDECIN_CHEF` | Médecin Chef | 101 | 79 % | Administrateur médical : activité clinique complète, gouvernance des référentiels, du personnel et de l’audit. |
| `INFIRMIER` | Infirmier | 51 | 40 % | Triage et consultation **déléguée** : prescrit uniquement sous délégation active accordée par le médecin chef. |

> **`MEDECIN` n’est pas un rôle.** C’est une *profession* du personnel médical (`TypePersonnel`) ; tout médecin reçoit le rôle `MEDECIN_CHEF`. Cette distinction doit être portée telle quelle au chapitre 6 (identification des acteurs), sous peine de créer un acteur qui n’existe pas.

---

## 2. Acteurs du système — dérivation pour le chapitre 6

Les acteurs du diagramme de cas d’utilisation se déduisent **exactement** des trois rôles. Aucun autre acteur humain n’existe dans le code.

| Acteur (chapitre 6) | Rôle technique | Type | Nombre d’UC accessibles |
|---|---|---|---:|
| Administrateur Système | `ADMIN_SYSTEME` | primaire | 128 permissions |
| Médecin Chef | `MEDECIN_CHEF` | primaire | 101 permissions |
| Infirmier | `INFIRMIER` | primaire | 51 permissions |
| Poste local (application de bureau autonome) | — | **secondaire** (système externe) | routes `/sync/*` |

---

## 3. Matrice complète permission × rôle

✅ = accordée par défaut · ⬜ = non accordée. La colonne « Routes » donne le nombre de routes qui exigent la permission (INV-01).

### Module `dashboard`

| Permission | Libellé | ADMIN | MÉDECIN CHEF | INFIRMIER | Routes |
|---|---|:---:|:---:|:---:|---:|
| `dashboard.read` | Consulter le tableau de bord | ✅ | ✅ | ✅ | 5 |

### Module `patient`

| Permission | Libellé | ADMIN | MÉDECIN CHEF | INFIRMIER | Routes |
|---|---|:---:|:---:|:---:|---:|
| `patient.read` | Consulter les dossiers patient | ✅ | ✅ | ✅ | 6 |
| `patient.create` | Créer un dossier patient | ✅ | ✅ | ✅ | 2 |
| `patient.update` | Modifier un dossier patient | ✅ | ✅ | ✅ | 13 |
| `patient.delete` | Supprimer un dossier patient | ✅ | ⬜ | ⬜ | 1 |
| `patient.archive` | Archiver / réactiver un dossier | ✅ | ✅ | ⬜ | 1 |
| `patient.change_category` | Changer la catégorie d’un patient | ✅ | ✅ | ⬜ | 1 |
| `patient.lock` | Verrouiller / déverrouiller l’accès à un dossier | ✅ | ✅ | ⬜ | 1 |
| `patient.rattachement.manage` | Gérer les rattachements (CDI / sous-traitants) | ✅ | ✅ | ✅ | 2 |

### Module `visite`

| Permission | Libellé | ADMIN | MÉDECIN CHEF | INFIRMIER | Routes |
|---|---|:---:|:---:|:---:|---:|
| `visite.read` | Consulter les visites de triage | ✅ | ✅ | ✅ | 4 |
| `visite.create` | Ouvrir une visite | ✅ | ✅ | ✅ | 1 |
| `visite.update` | Modifier une visite | ✅ | ✅ | ✅ | 3 |
| `visite.cancel` | Annuler une visite | ✅ | ✅ | ✅ | 1 |
| `visite.close` | Clôturer une visite sans consultation | ✅ | ✅ | ⬜ | 1 |
| `visite.delete` | Supprimer définitivement une visite | ✅ | ✅ | ⬜ | 1 |
| `visite.assign_soignant` | Assigner un soignant à une visite | ✅ | ✅ | ✅ | 1 |

### Module `consultation`

| Permission | Libellé | ADMIN | MÉDECIN CHEF | INFIRMIER | Routes |
|---|---|:---:|:---:|:---:|---:|
| `consultation.read` | Consulter les consultations | ✅ | ✅ | ✅ | 8 |
| `consultation.create` | Ouvrir une consultation | ✅ | ✅ | ✅ | 1 |
| `consultation.update` | Modifier une consultation | ✅ | ✅ | ✅ | 4 |
| `consultation.close` | Clôturer une consultation | ✅ | ✅ | ✅ | 1 |
| `consultation.cancel` | Annuler une consultation | ✅ | ✅ | ✅ | 1 |
| `consultation.delete` | Supprimer définitivement une consultation | ✅ | ✅ | ⬜ | 1 |
| `consultation.diagnose` | Poser un diagnostic | ✅ | ✅ | ✅ | 4 |
| `consultation.examen` | Saisir l’examen clinique | ✅ | ✅ | ✅ | 1 |

### Module `ordonnance`

| Permission | Libellé | ADMIN | MÉDECIN CHEF | INFIRMIER | Routes |
|---|---|:---:|:---:|:---:|---:|
| `ordonnance.read` | Consulter les ordonnances | ✅ | ✅ | ✅ | 0 |
| `ordonnance.create` | Créer une ordonnance | ✅ | ✅ | ✅ | 2 |
| `ordonnance.update` | Modifier une ordonnance brouillon | ✅ | ✅ | ✅ | 3 |
| `ordonnance.validate` | Valider une ordonnance | ✅ | ✅ | ✅ | 1 |
| `ordonnance.cancel` | Annuler une ordonnance validée | ✅ | ✅ | ✅ | 1 |
| `ordonnance.delete` | Supprimer une ordonnance brouillon | ✅ | ✅ | ✅ | 1 |
| `ordonnance.print` | Imprimer une ordonnance | ✅ | ✅ | ✅ | 0 |

### Module `bon_examen`

| Permission | Libellé | ADMIN | MÉDECIN CHEF | INFIRMIER | Routes |
|---|---|:---:|:---:|:---:|---:|
| `bon_examen.read` | Consulter les bons d’examen | ✅ | ✅ | ✅ | 2 |
| `bon_examen.create` | Créer un bon d’examen | ✅ | ✅ | ✅ | 1 |
| `bon_examen.update` | Modifier un bon d’examen | ✅ | ✅ | ✅ | 1 |
| `bon_examen.validate` | Valider un bon d’examen | ✅ | ✅ | ⬜ | 1 |
| `bon_examen.cancel` | Annuler un bon d’examen | ✅ | ✅ | ✅ | 1 |
| `bon_examen.delete` | Supprimer définitivement un bon d’examen | ✅ | ⬜ | ⬜ | 1 |
| `bon_examen.result` | Saisir un résultat d’examen | ✅ | ✅ | ✅ | 1 |

### Module `bon_pharmacie`

| Permission | Libellé | ADMIN | MÉDECIN CHEF | INFIRMIER | Routes |
|---|---|:---:|:---:|:---:|---:|
| `bon_pharmacie.read` | Consulter les bons de pharmacie | ✅ | ✅ | ✅ | 2 |
| `bon_pharmacie.create` | Créer un bon de pharmacie | ✅ | ✅ | ✅ | 1 |
| `bon_pharmacie.deliver` | Marquer un bon de pharmacie délivré | ✅ | ✅ | ⬜ | 1 |
| `bon_pharmacie.cancel` | Annuler un bon de pharmacie | ✅ | ✅ | ✅ | 1 |
| `bon_pharmacie.delete` | Supprimer définitivement un bon de pharmacie | ✅ | ⬜ | ⬜ | 1 |

### Module `evacuation`

| Permission | Libellé | ADMIN | MÉDECIN CHEF | INFIRMIER | Routes |
|---|---|:---:|:---:|:---:|---:|
| `evacuation.read` | Consulter les évacuations | ✅ | ✅ | ⬜ | 2 |
| `evacuation.create` | Initier une évacuation | ✅ | ✅ | ⬜ | 1 |
| `evacuation.update` | Suivre une évacuation | ✅ | ✅ | ⬜ | 3 |
| `evacuation.cancel` | Annuler une évacuation | ✅ | ✅ | ⬜ | 1 |
| `evacuation.close` | Clôturer une évacuation | ✅ | ✅ | ⬜ | 1 |
| `evacuation.delete` | Supprimer définitivement une évacuation | ✅ | ✅ | ⬜ | 1 |

### Module `suivi_traitement`

| Permission | Libellé | ADMIN | MÉDECIN CHEF | INFIRMIER | Routes |
|---|---|:---:|:---:|:---:|---:|
| `suivi_traitement.read` | Consulter les suivis de traitement | ✅ | ✅ | ✅ | 2 |
| `suivi_traitement.create` | Ouvrir un suivi de traitement | ✅ | ✅ | ✅ | 1 |
| `suivi_traitement.update` | Ajouter une fiche de suivi | ✅ | ✅ | ✅ | 3 |
| `suivi_traitement.cancel` | Annuler un suivi de traitement | ✅ | ✅ | ✅ | 1 |
| `suivi_traitement.close` | Clôturer un suivi de traitement | ✅ | ✅ | ✅ | 1 |
| `suivi_traitement.delete` | Supprimer définitivement un suivi de traitement | ✅ | ✅ | ✅ | 1 |

### Module `referentiel`

| Permission | Libellé | ADMIN | MÉDECIN CHEF | INFIRMIER | Routes |
|---|---|:---:|:---:|:---:|---:|
| `referentiel.read` | Accéder au module Référentiels | ✅ | ✅ | ✅ | 1 |
| `referentiel.site.read` | Consulter les sites | ✅ | ✅ | ✅ | 2 |
| `referentiel.motif.read` | Consulter les motifs de consultation | ✅ | ✅ | ✅ | 1 |
| `referentiel.pathologie.read` | Consulter les pathologies | ✅ | ✅ | ✅ | 1 |
| `referentiel.medicament.read` | Consulter les médicaments | ✅ | ✅ | ✅ | 1 |
| `referentiel.categorie.read` | Consulter les catégories de patient | ✅ | ✅ | ✅ | 1 |
| `referentiel.examen.read` | Consulter les types d’examen | ✅ | ✅ | ✅ | 1 |
| `referentiel.type_consultation.read` | Consulter les types de consultation | ✅ | ✅ | ✅ | 1 |
| `referentiel.site.create` | Créer un site | ✅ | ✅ | ⬜ | 1 |
| `referentiel.site.update` | Modifier un site | ✅ | ✅ | ⬜ | 1 |
| `referentiel.site.delete` | Désactiver ou supprimer un site | ✅ | ✅ | ⬜ | 2 |
| `referentiel.motif.create` | Créer un motif de consultation | ✅ | ✅ | ✅ | 1 |
| `referentiel.motif.update` | Modifier un motif de consultation | ✅ | ✅ | ⬜ | 1 |
| `referentiel.motif.delete` | Désactiver ou supprimer un motif | ✅ | ✅ | ⬜ | 2 |
| `referentiel.pathologie.create` | Créer une pathologie | ✅ | ✅ | ⬜ | 1 |
| `referentiel.pathologie.update` | Modifier une pathologie | ✅ | ✅ | ⬜ | 1 |
| `referentiel.pathologie.delete` | Désactiver ou supprimer une pathologie | ✅ | ✅ | ⬜ | 2 |
| `referentiel.medicament.create` | Créer un médicament | ✅ | ✅ | ⬜ | 1 |
| `referentiel.medicament.update` | Modifier un médicament | ✅ | ✅ | ⬜ | 1 |
| `referentiel.medicament.delete` | Désactiver ou supprimer un médicament | ✅ | ✅ | ⬜ | 2 |
| `referentiel.categorie.create` | Créer une catégorie de patient | ✅ | ✅ | ⬜ | 1 |
| `referentiel.categorie.update` | Modifier une catégorie de patient | ✅ | ✅ | ⬜ | 1 |
| `referentiel.categorie.delete` | Désactiver ou supprimer une catégorie | ✅ | ✅ | ⬜ | 2 |
| `referentiel.examen.create` | Créer un type d’examen | ✅ | ✅ | ⬜ | 1 |
| `referentiel.examen.update` | Modifier un type d’examen | ✅ | ✅ | ⬜ | 1 |
| `referentiel.examen.delete` | Désactiver ou supprimer un type d’examen | ✅ | ✅ | ⬜ | 2 |
| `referentiel.type_consultation.create` | Créer un type de consultation | ✅ | ✅ | ⬜ | 1 |
| `referentiel.type_consultation.update` | Modifier un type de consultation | ✅ | ✅ | ⬜ | 1 |
| `referentiel.type_consultation.delete` | Désactiver ou supprimer un type de consultation | ✅ | ✅ | ⬜ | 2 |

### Module `personnel`

| Permission | Libellé | ADMIN | MÉDECIN CHEF | INFIRMIER | Routes |
|---|---|:---:|:---:|:---:|---:|
| `personnel.read` | Consulter le personnel médical | ✅ | ✅ | ⬜ | 2 |
| `personnel.create` | Créer une fiche personnel | ✅ | ✅ | ⬜ | 1 |
| `personnel.update` | Modifier une fiche personnel | ✅ | ✅ | ⬜ | 1 |
| `personnel.delete` | Désactiver ou supprimer une fiche personnel | ✅ | ✅ | ⬜ | 2 |

### Module `sous_traitant`

| Permission | Libellé | ADMIN | MÉDECIN CHEF | INFIRMIER | Routes |
|---|---|:---:|:---:|:---:|---:|
| `sous_traitant.read` | Consulter les sociétés sous-traitantes | ✅ | ✅ | ✅ | 2 |
| `sous_traitant.create` | Créer une société sous-traitante | ✅ | ✅ | ⬜ | 1 |
| `sous_traitant.update` | Modifier une société sous-traitante | ✅ | ✅ | ⬜ | 1 |
| `sous_traitant.delete` | Désactiver ou supprimer une société sous-traitante | ✅ | ✅ | ⬜ | 2 |

### Module `employe`

| Permission | Libellé | ADMIN | MÉDECIN CHEF | INFIRMIER | Routes |
|---|---|:---:|:---:|:---:|---:|
| `employe.read` | Consulter le registre des employés SARIS | ✅ | ✅ | ✅ | 2 |
| `employe.create` | Enregistrer un employé SARIS | ✅ | ✅ | ✅ | 1 |
| `employe.update` | Modifier un employé SARIS | ✅ | ✅ | ⬜ | 1 |
| `employe.delete` | Supprimer un employé SARIS | ✅ | ✅ | ⬜ | 1 |

### Module `delegation`

| Permission | Libellé | ADMIN | MÉDECIN CHEF | INFIRMIER | Routes |
|---|---|:---:|:---:|:---:|---:|
| `delegation.read` | Consulter les délégations | ✅ | ✅ | ⬜ | 2 |
| `delegation.create` | Créer une délégation | ✅ | ✅ | ⬜ | 1 |
| `delegation.update` | Modifier une délégation | ✅ | ✅ | ⬜ | 1 |
| `delegation.revoke` | Révoquer une délégation | ✅ | ✅ | ⬜ | 1 |
| `delegation.delete` | Supprimer définitivement une délégation | ✅ | ✅ | ⬜ | 1 |

### Module `utilisateur`

| Permission | Libellé | ADMIN | MÉDECIN CHEF | INFIRMIER | Routes |
|---|---|:---:|:---:|:---:|---:|
| `utilisateur.read` | Consulter les comptes utilisateur | ✅ | ⬜ | ⬜ | 4 |
| `utilisateur.create` | Créer un compte utilisateur | ✅ | ⬜ | ⬜ | 1 |
| `utilisateur.update` | Modifier un compte utilisateur | ✅ | ⬜ | ⬜ | 2 |
| `utilisateur.delete` | Supprimer définitivement un compte utilisateur | ✅ | ⬜ | ⬜ | 1 |
| `utilisateur.reset_password` | Réinitialiser un mot de passe | ✅ | ⬜ | ⬜ | 4 |
| `utilisateur.assign_role` | Attribuer des rôles | ✅ | ⬜ | ⬜ | 1 |
| `utilisateur.manage_permissions` | Gérer les dérogations de permissions individuelles | ✅ | ⬜ | ⬜ | 3 |

### Module `role`

| Permission | Libellé | ADMIN | MÉDECIN CHEF | INFIRMIER | Routes |
|---|---|:---:|:---:|:---:|---:|
| `role.read` | Consulter les rôles | ✅ | ⬜ | ⬜ | 4 |
| `role.create` | Créer un rôle | ✅ | ⬜ | ⬜ | 1 |
| `role.update` | Modifier un rôle (permissions) | ✅ | ⬜ | ⬜ | 1 |
| `role.delete` | Supprimer un rôle | ✅ | ⬜ | ⬜ | 1 |

### Module `rapport`

| Permission | Libellé | ADMIN | MÉDECIN CHEF | INFIRMIER | Routes |
|---|---|:---:|:---:|:---:|---:|
| `rapport.read` | Consulter les rapports statistiques | ✅ | ✅ | ✅ | 2 |
| `rapport.export` | Exporter un rapport (Excel/PDF) | ✅ | ✅ | ⬜ | 0 |

### Module `audit`

| Permission | Libellé | ADMIN | MÉDECIN CHEF | INFIRMIER | Routes |
|---|---|:---:|:---:|:---:|---:|
| `audit.read` | Consulter les journaux d’audit | ✅ | ✅ | ⬜ | 2 |

### Module `parametre`

| Permission | Libellé | ADMIN | MÉDECIN CHEF | INFIRMIER | Routes |
|---|---|:---:|:---:|:---:|---:|
| `parametre.read` | Consulter les paramètres système | ✅ | ⬜ | ⬜ | 1 |
| `parametre.update` | Modifier les paramètres système | ✅ | ⬜ | ⬜ | 2 |

### Module `synchronisation`

| Permission | Libellé | ADMIN | MÉDECIN CHEF | INFIRMIER | Routes |
|---|---|:---:|:---:|:---:|---:|
| `synchronisation.read` | Consulter l’état de synchronisation | ✅ | ⬜ | ⬜ | 9 |
| `synchronisation.execute` | Lancer une sauvegarde système | ✅ | ⬜ | ⬜ | 8 |
| `synchronisation.restore` | Restaurer une sauvegarde de configuration | ✅ | ⬜ | ⬜ | 1 |

### Module `notification`

| Permission | Libellé | ADMIN | MÉDECIN CHEF | INFIRMIER | Routes |
|---|---|:---:|:---:|:---:|---:|
| `notification.read` | Consulter ses notifications | ✅ | ⬜ | ⬜ | 5 |
| `notification.create` | Émettre une notification / annonce | ✅ | ⬜ | ⬜ | 1 |
| `notification.update` | Marquer ses notifications comme lues | ✅ | ⬜ | ⬜ | 2 |
| `notification.delete` | Supprimer des notifications | ✅ | ⬜ | ⬜ | 1 |

### Module `messagerie`

| Permission | Libellé | ADMIN | MÉDECIN CHEF | INFIRMIER | Routes |
|---|---|:---:|:---:|:---:|---:|
| `messagerie.read` | Consulter la messagerie interne | ✅ | ⬜ | ⬜ | 11 |
| `messagerie.create` | Envoyer un message | ✅ | ⬜ | ⬜ | 7 |
| `messagerie.update` | Modifier un message | ✅ | ⬜ | ⬜ | 6 |
| `messagerie.delete` | Supprimer un message | ✅ | ⬜ | ⬜ | 5 |

---

## 4. Règle de cohérence « écrire implique consulter »

Le catalogue n’est pas une simple liste : il porte une **règle structurelle** appliquée des deux côtés (client et serveur).

> Un droit d’écriture sans le droit de lecture correspondant est un **droit mort** : l’utilisateur n’atteint jamais le formulaire, alors que la case cochée laisse croire à l’administrateur qu’il a accordé quelque chose.

Résolution appliquée, en chaîne :

```text
module.action        → module.read
module.sous.action   → module.sous.read s’il existe, sinon module.read
module.sous.read     → module.read

exemple : referentiel.site.create → referentiel.site.read → referentiel.read
```

Deux fonctions en découlent : `completerLectures()` (sens « on accorde ») et `completerRevocations()` (sens « on retire », qui étend la révocation à tout ce qui en dépend).

| Permission | Lectures impliquées (chaîne complète) |
|---|---|
| `referentiel.site.create` | `referentiel.site.read` → `referentiel.read` |
| `referentiel.medicament.delete` | `referentiel.medicament.read` → `referentiel.read` |
| `patient.rattachement.manage` | `patient.read` |
| `consultation.close` | `consultation.read` |
| `ordonnance.validate` | `ordonnance.read` |
| `utilisateur.assign_role` | `utilisateur.read` |

Au total, **106 permissions sur 128** impliquent au moins une lecture.

> ⚠️ La règle est **dupliquée** : `packages/types/src/permissions.ts` (client) et `apps/api/src/common/permission-coherence.ts` (serveur), l’API ne pouvant pas importer de valeur depuis ce paquet. Toute divergence entre les deux copies produirait une incohérence de droits invisible. À signaler au chapitre 7 comme dette technique assumée.

---

## 5. Dérogations individuelles

Au-delà des rôles, une permission peut être accordée ou retirée **compte par compte** via le modèle `UtilisateurPermission` et l’énumération `ModeOverridePermission` :

| Mode | Effet |
|---|---|
| `GRANT` | Ajoute la permission à l’utilisateur, même si son rôle ne la contient pas |
| `REVOKE` | Retire la permission à l’utilisateur, même si son rôle la contient |

Les droits effectifs sont donc calculés par `PermissionsResolverService` : *permissions des rôles* − *révocations individuelles* + *octrois individuels*. Cette résolution est un point à représenter dans la séquence objets de l’authentification (UML-SEQO).

---

## 6. Permissions sans route associée

**3 permissions** du catalogue ne sont exigées par aucune route. Ce ne sont pas nécessairement des oublis : certaines gouvernent l’affichage côté client (visibilité d’un onglet, d’un bouton), pas un point d’entrée serveur.

| Permission | Libellé | Interprétation |
|---|---|---|
| `ordonnance.read` | Consulter les ordonnances | À CONFIRMER — vérifier l’usage côté client |
| `ordonnance.print` | Imprimer une ordonnance | Action d’impression, réalisée intégralement côté client |
| `rapport.export` | Exporter un rapport (Excel/PDF) | À CONFIRMER — vérifier l’usage côté client |

### 6.1 Cohérence inverse

Aucune route n’exige une permission absente du catalogue. La correspondance code ↔ gardes est **complète**.

---

## 7. Écarts et points de vigilance

| # | Constat | Conséquence documentaire |
|---|---|---|
| E-01 | Le catalogue compte **128** permissions. Le glossaire disait « ~110 », le README « 116 ». | Retenir 128 partout. Corriger le glossaire et le README, ou consigner l’écart. |
| E-02 | `ADMIN_SYSTEME` détient **100 % du catalogue**, y compris les actes cliniques. | Choix de gouvernance assumé, à justifier explicitement au chapitre 6 : sans cela, le jury y verra une faille de séparation des pouvoirs. |
| E-03 | Les permissions de prescription sont accordées à `INFIRMIER`, mais le **service** (`assertPeutPrescrire`) exige en plus une **délégation active**. | Le contrôle d’accès est à **deux étages** : garde de permission, puis règle métier. À représenter dans le diagramme de séquence objets de la prescription, sinon la logique est incompréhensible. |
| E-04 | La règle de cohérence est **dupliquée** entre le paquet partagé et l’API. | Dette technique à mentionner honnêtement au chapitre 8 (difficultés rencontrées). |
| E-05 | Les permissions de communication () sont ajoutées automatiquement à **tous** les rôles, y compris ceux créés ultérieurement. | À décrire comme un « socle commun », sinon la matrice paraît incohérente avec le code. |

---

## 8. Alimente

| Destination | Usage |
|---|---|
| Chapitre 6 § 6.1 | Identification des acteurs : 3 acteurs primaires, 1 secondaire |
| Chapitre 6 § 6.4 | Classification des UC par module et par acteur |
| Chapitre 7 § 7.1 | Architecture de sécurité : garde de permission + règle métier |
| Fiche UML-UC-01 → Figures 6.2 à 6.6 | Répartition des UC par acteur |
| Fiche UML-CTX-01 → Figure 6.1 | Acteurs en périphérie du système |
| Matrice de traçabilité | Colonne « permission requise » |
| ~~Annexe B~~ | **Annexe retirée du mémoire**. Le tableau des acteurs et de leur périmètre est le tableau 6.4 ; le détail des droits reste dans le présent inventaire |

