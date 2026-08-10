# ANNEXE B — Registre des besoins identifiés

> **Objet** : le tableau complet des besoins, avec leur origine, leur statut et leur couverture par canal.
> **Complément du chapitre 6 § 6.0**, qui n'en présente que la synthèse.

---

## 1. Comment lire ce registre

| Colonne | Sens |
|---|---|
| **Origine** | `TERRAIN` = issu du recueil · `CODE` = reconstitué par analyse du système réalisé · `MIXTE` = les deux |
| **Statut** | `IMPLÉMENTÉ` · `PARTIELLEMENT IMPLÉMENTÉ` · `NON IMPLÉMENTÉ` · `À CONFIRMER` |
| **Web / API / Desktop** | ✅ couvert · ⚠️ partiel · ⬜ non concerné |
| **Sync** | ✅ synchronisé hors connexion · ⬜ non synchronisé |

> ⚠️ **Une réserve de méthode à énoncer.** La colonne « Origine » porte majoritairement `CODE`, parce que le recueil de l'existant n'a pas pu être exploité au moment de cette rédaction. Ce registre est donc, en l'état, un **inventaire des capacités livrées** plus qu'un registre de besoins recueillis. Il devra être **recroisé avec le recueil** dès sa récupération — voir QO-01.
>
> Ce recroisement fera apparaître deux catégories aujourd'hui invisibles : les besoins exprimés sur le terrain **non couverts** par le système, et les fonctions livrées **sans besoin exprimé**. Les deux sont des informations précieuses pour la soutenance.

---

## 2. Besoins fonctionnels

| Id | Besoin | Origine | Statut | Web | API | Desktop | Sync | Preuve |
|---|---|---|---|:---:|:---:|:---:|:---:|---|
| BF01 | Authentifier les agents et sécuriser l'accès | CODE | IMPLÉMENTÉ | ✅ | ✅ | ✅ | ⬜ | 7 routes, second facteur, blocage progressif |
| BF02 | Gérer comptes, rôles et habilitations | CODE | IMPLÉMENTÉ | ✅ | ✅ | ✅ | ✅ | 32 routes, 128 permissions |
| BF03 | Journaliser les actions sensibles | CODE | IMPLÉMENTÉ | ✅ | ✅ | ✅ | ⬜ | 151 routes auditées |
| BF04 | Paramétrer le système | CODE | IMPLÉMENTÉ | ✅ | ✅ | ✅ | ⬜ | 3 routes |
| BF05 | Gérer les référentiels métier | MIXTE | IMPLÉMENTÉ | ✅ | ✅ | ✅ | ✅ | 37 routes, 9 référentiels |
| BF06 | Gérer le personnel et les délégations | MIXTE | IMPLÉMENTÉ | ✅ | ✅ | ✅ | ✅ | 20 routes |
| BF07 | Tenir le registre des employés | MIXTE | IMPLÉMENTÉ | ✅ | ✅ | ✅ | ✅ | 5 routes |
| BF08 | Gérer le dossier patient centralisé | MIXTE | IMPLÉMENTÉ | ✅ | ✅ | ✅ | ✅ | 30 routes, 13 entités |
| BF09 | Rattacher ayants droit et sous-traitants | MIXTE | IMPLÉMENTÉ | ✅ | ✅ | ✅ | ✅ | Rattachements historisés |
| BF10 | Enregistrer et trier les visites | MIXTE | IMPLÉMENTÉ | ✅ | ✅ | ✅ | ✅ | 9 routes, file par arrivée |
| BF11 | Relever les constantes vitales | MIXTE | IMPLÉMENTÉ | ✅ | ✅ | ✅ | ✅ | 23 champs, plages validées |
| BF12 | Conduire une consultation | MIXTE | IMPLÉMENTÉ | ✅ | ✅ | ✅ | ✅ | 22 routes |
| BF13 | Prescrire médicaments ou examens | MIXTE | IMPLÉMENTÉ | ✅ | ✅ | ✅ | ✅ | 2 types, 3 états, délégation tracée |
| BF14 | Émettre un bon d'examen, saisir le résultat | MIXTE | IMPLÉMENTÉ | ✅ | ✅ | ✅ | ✅ | 7 routes, 4 états |
| BF15 | Émettre et délivrer un bon de pharmacie | MIXTE | IMPLÉMENTÉ | ✅ | ✅ | ✅ | ✅ | 5 routes, 3 états |
| BF16 | Orienter par évacuation et suivre les étapes | MIXTE | IMPLÉMENTÉ | ✅ | ✅ | ✅ | ✅ | 8 routes, 5 états |
| BF17 | Ouvrir et alimenter un suivi de traitement | CODE | IMPLÉMENTÉ | ✅ | ✅ | ✅ | ⬜ | 8 routes |
| BF18 | Communiquer par messagerie chiffrée | CODE | IMPLÉMENTÉ | ✅ | ✅ | ✅ | ✅ | 29 routes |
| BF19 | Notifier en temps réel | CODE | IMPLÉMENTÉ | ✅ | ✅ | ✅ | ⬜ | 9 routes, flux d'événements |
| BF20 | Piloter par tableau de bord adapté au rôle | CODE | IMPLÉMENTÉ | ✅ | ✅ | ✅ | ⬜ | 9 routes, 2 profils |
| BF21 | Produire des rapports statistiques | MIXTE | IMPLÉMENTÉ | ✅ | ✅ | ✅ | ⬜ | 2 routes, export |
| BF22 | Imprimer les documents cliniques | MIXTE | IMPLÉMENTÉ | ✅ | ⬜ | ✅ | ⬜ | 6 documents A4 |
| BF23 | Travailler sans connexion et se resynchroniser | MIXTE | **PARTIEL** | ✅ | ✅ | ⚠️ | — | 14 routes, 52 entités — validation d'exécution à faire |

**23 besoins fonctionnels · 22 pleinement implémentés · 1 partiel.**

---

## 3. Besoins non fonctionnels

| Id | Besoin | Exigence | Statut | Preuve |
|---|---|---|---|---|
| BNF01 | Sécurité de l'accès | Authentification forte, protection contre la force brute | IMPLÉMENTÉ | Hachage, second facteur, codes de secours, blocage à durée multipliée par quatre, plafond de 100 requêtes par minute par utilisateur |
| BNF02 | Confidentialité des données | Aucune donnée sensible lisible au repos | IMPLÉMENTÉ | Messagerie et secrets du second facteur chiffrés ; file hors ligne chiffrée ; jetons protégés par le coffre du système |
| BNF03 | Confidentialité d'usage | Un dossier sensible n'est pas visible de tous | IMPLÉMENTÉ | Verrou de dossier, cloisonnement par initiateur, floutage des zones cliniques |
| BNF04 | Traçabilité | Toute action sensible imputable | IMPLÉMENTÉ | Journal alimenté par un intercepteur unique, sans route d'écriture |
| BNF05 | Continuité hors connexion | Poste opérationnel sans réseau | **PARTIEL** | Deux mécanismes distincts ; validation d'exécution du poste autonome à faire |
| BNF06 | Cohérence entre les deux sites | Un patient vu à Moutela retrouvé à Nkayi | IMPLÉMENTÉ | Dossier et parcours en portée globale |
| BNF07 | Intégrité des saisies | Une donnée invalide n'entre jamais | IMPLÉMENTÉ | Validation stricte avec rejet des champs inconnus ; plages alignées client-serveur |
| BNF08 | Réversibilité des suppressions | Une suppression se propage sans perte | IMPLÉMENTÉ | Suppression logique sur 47 entités |
| BNF09 | Accessibilité linguistique | Français et anglais | IMPLÉMENTÉ | Bascule en direct, préférence mémorisée |
| BNF10 | Ergonomie et mobilité | Poste, tablette, téléphone | IMPLÉMENTÉ | Interface adaptative, application installable |
| BNF11 | Déployabilité | Installation sans droits d'administrateur, mise à jour automatique | **PARTIEL** | Installateur par utilisateur ; signature de code non active |
| BNF12 | Maintenabilité | Une règle n'existe qu'à un seul endroit | IMPLÉMENTÉ | Monorepo à types partagés, utilitaires « source unique » |
| BNF13 | Robustesse des erreurs | Toute erreur produit une réponse exploitable | IMPLÉMENTÉ | Filtre global, traduction des erreurs de base |

**13 besoins non fonctionnels · 11 implémentés · 2 partiels.**

> **Sur les performances.** Aucune exigence chiffrée de temps de réponse n'a pu être établie : elle n'existe ni dans les documents du projet, ni sous forme mesurable dans le code, et aucune campagne de mesure n'a été conduite. **Annoncer un seuil serait une invention.** Le sujet est renvoyé aux perspectives.

---

## 4. Besoins couverts par contrainte plutôt que par fonction

Trois exigences ne sont pas des fonctions mais des propriétés d'architecture. Elles méritent d'être distinguées, car un jury peut demander où elles se trouvent.

| Exigence | Où elle est réalisée |
|---|---|
| Un patient ne peut avoir deux visites ouvertes | Contrôle au service de triage, avant création |
| Un soignant ne peut avoir deux consultations ouvertes | Contrôle au service de consultation, avant création |
| Une consultation clôturée clôt sa visite | Couplage obligatoire dans le service de consultation |

---

## 5. Ce qui reste à faire sur ce registre

```
[ ] Recroiser avec le recueil de l'existant dès sa récupération — QO-01
[ ] Ajouter la colonne « besoin exprimé sur le terrain » avec sa source datée
[ ] Faire apparaître les besoins exprimés NON couverts
[ ] Faire apparaître les fonctions livrées SANS besoin exprimé
[ ] Faire valider la priorité de chaque besoin par la direction du centre
[ ] Confirmer l'exclusion des employés en contrat à durée déterminée — QO-06
```
