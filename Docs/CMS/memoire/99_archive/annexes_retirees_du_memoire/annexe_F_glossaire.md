# ANNEXE F — Glossaire du mémoire

> **Règle.** Un terme employé dans le mémoire figure ici. Un terme absent d'ici ne doit pas apparaître dans le mémoire.
> **Source** : glossaire du projet, complété et arbitré par l'analyse du code. Voir `matrice_alignement.md` pour les écarts tranchés.

---

## A

**Annonce** — Communication diffusée par un administrateur à l'ensemble des utilisateurs. Distincte d'un message privé. Inclut les annonces de mise à jour de l'application de bureau.

**Assuré CDD** — Patient de la catégorie correspondante : travailleur en contrat à durée déterminée, identifié par un matricule. **N'ouvre pas droit** aux bons de pharmacie et d'examen — point à confirmer, voir QO-06.

**Assuré CDI** — Travailleur en contrat à durée indéterminée, identifié par un matricule. Ouvre droit, avec ses ayants droit, aux bons de pharmacie et d'examen.

**Audit** — Journalisation automatique et persistante des opérations sensibles : auteur, action, entité, adresse IP réelle, statut. Alimentée par un intercepteur unique ; aucune route d'écriture n'y donne accès.

**Ayant droit** — Membre de la famille rattaché à un assuré en contrat à durée indéterminée. Bénéficie des mêmes droits que lui. Le rattachement est tracé et historisé.

## B

**Bon d'examen** — Document prescrivant un examen complémentaire, imprimable au format A4. **Réservé aux assurés CDI et à leurs ayants droit.** États : en attente, validé, reçu, annulé.

**Bon de pharmacie** — Bon de retrait de médicaments, distinct de l'ordonnance. **Réservé aux assurés CDI et à leurs ayants droit.** États : en attente, délivré, annulé. Un bon délivré ne peut plus être annulé.

## C

**Catégorie de patient** — Classement administratif qui **pilote les droits aux prestations**. **Cinq catégories** dans le système : assuré CDI, ayant droit CDI, assuré CDD, sous-traitant, riverain.

> ⚠️ Le recueil de l'existant recense **neuf statuts** au centre — s'y ajoutent les expatriés, les agents de la distillerie, les visiteurs et missionnaires, et les stagiaires. Tous relèvent de la **même règle** que les non-CDI : soins assurés, aucun droit aux bons, refacturation. Le modèle retient donc les seules distinctions produisant un comportement différent. Voir QO-16.

**EVASAN — évacuation sanitaire** — Terme employé au centre pour désigner l'orientation d'un patient vers un établissement partenaire, lorsque le centre n'est pas équipé ou que la ville ne dispose pas de structure adaptée. Le système gère la **décision médicale** et le suivi clinique ; le volet financier — certificat, bon de caisse, barème — relève de la Section des Affaires Sociales, **hors périmètre**.

**Certificat** — Document médical attestant un état, notamment le certificat de repos, imprimable au format A4. Périmètre exact à confirmer — QO-07.

**CGU** — Conditions d'utilisation, présentées à la connexion. Leur acceptation est tracée et **bloquante** : un portail interdit l'accès tant qu'elles ne sont pas acceptées.

**Constantes vitales** — Mesures physiologiques relevées au triage : température, tension, pouls, fréquence respiratoire, saturation, poids, taille, indice de masse corporelle, glycémie, état de conscience. Historisées dans le dossier.

**Consultation** — Acte clinique conduit pendant une visite, aboutissant à une conclusion et, éventuellement, à une décision. États : ouverte, clôturée, annulée. Un soignant ne peut avoir qu'une consultation ouverte à la fois.

## D

**Décision de consultation** — Issue structurée d'une consultation. **Deux valeurs seulement** : évacuation, suivi de traitement. L'**absence** de décision caractérise la clôture simple.

> ⚠️ Une documentation antérieure du projet en annonçait quatre. Le code n'en implémente que deux. Écart ÉC-01 de la matrice d'alignement, tranché en faveur du code.

**Délégation de prescription** — Autorisation temporaire, accordée par un médecin chef à un infirmier, de prescrire. Bornée par des dates de début et de fin. Son identifiant est enregistré sur l'ordonnance produite.

**Dossier patient** — Dossier médical centralisé, commun aux deux sites. Contient identité, matricule, allergies, antécédents, alertes, mode de vie, données d'emploi, rattachements et l'historique des passages. Peut être protégé par un verrou de confidentialité.

## É

**Évacuation** — Décision et document orientant un patient vers une structure de soins supérieure. Réservée au médecin chef. États : en cours, en transport, admis, clôturé, annulé.

## F

**File d'attente** — Liste ordonnée des visites en attente de prise en charge, **strictement par ordre d'arrivée**. La notion de priorité clinique a été retirée de l'ensemble du système.

## H

**Habilitation** — Ensemble des droits effectifs d'un agent, résultant des permissions de son rôle, diminuées de ses révocations individuelles et augmentées de ses octrois individuels.

## L

**LWW — dernière écriture gagnante** — Stratégie de résolution des conflits de synchronisation : en cas d'écritures concurrentes, la version la plus récente l'emporte. Comparaison fondée sur l'horodatage de modification.

## M

**Matricule** — Identifiant d'un travailleur de l'entreprise. Sert de clé de rattachement des ayants droit. Déclaratif, vérifié visuellement à chaque visite, unique en base.

**Migration** — Fichier SQL versionné décrivant une évolution du schéma de base. Le projet en compte 41.

## O

**Offline-first** — Approche de conception où le fonctionnement **sans réseau est le cas normal**, la connexion constituant un enrichissement et non un prérequis.

**Ordonnance** — Document de prescription issu d'une consultation, imprimable au format A4. **Non restreinte par catégorie de patient** — c'est la différence essentielle avec le bon. Deux types : pharmaceutique, prescription d'examen. États : brouillon, validée, annulée.

## P

**Permission** — Droit unitaire de forme `module.action`. Le catalogue en compte **128**. L'accès aux points d'entrée est contrôlé par un garde dédié.

**Poste local** — Instance de l'application de bureau en mode autonome : serveur et base embarqués, opérationnelle sans connexion, se synchronisant avec le serveur central.

## R

**Rideau de confidentialité** — Dispositif d'**interface** masquant en permanence les zones cliniques sensibles, révélées au survol. Actif par défaut, neutralisé sur écran tactile. **À ne pas confondre avec le verrou de confidentialité.**

**Riverain** — Personne du voisinage, sans lien contractuel avec l'entreprise. A droit à la consultation et aux premiers soins, mais pas aux bons.

**Rôle** — Profil d'habilitation regroupant un ensemble de permissions. **Trois rôles** : administrateur système, médecin chef, infirmier.

> ⚠️ **`MEDECIN` n'est pas un rôle** : c'est une *profession* du personnel médical. Tout médecin reçoit le rôle de médecin chef.

## S

**Site** — Établissement physique du centre. **Deux sites : Moutela et Nkayi.** La plupart des activités opérationnelles sont cloisonnées par site ; le dossier patient est, lui, commun aux deux.

**Sous-traitant** — Travailleur d'une société sous-traitante. A droit à la consultation et aux premiers soins, mais pas aux bons.

**Suivi de traitement** — Épisode de contrôle ouvert depuis une consultation clôturée, alimenté ensuite par des fiches datées.

**Supervision** — Capacité de voir l'ensemble de l'activité clinique d'un site et de verrouiller un dossier. Réservée à l'administrateur système et au médecin chef. Les autres rôles ne voient que leur propre activité.

**Synchronisation** — Mécanisme rapprochant les données d'un poste local et du serveur central : réception, envoi, résolution par dernière écriture, propagation des suppressions, purge planifiée.

## T

**Tombstone — marque de suppression** — Trace laissée par une suppression logique. Un enregistrement supprimé n'est pas effacé mais horodaté, afin que la synchronisation puisse propager la suppression à tous les postes. Présente sur 47 entités sur 88.

**Triage** — Première étape du parcours : accueil et enregistrement d'une visite, **par ordre d'arrivée**, avec relevé des constantes vitales et orientation vers la file d'attente.

## V

**Verrou de confidentialité** — Protection d'un dossier patient posée par un médecin chef, restreignant l'accès. C'est un contrôle **de données**, appliqué par l'interface de programmation y compris sur le poste autonome. **À ne pas confondre avec le rideau de confidentialité**, qui est un effet visuel.

**Visite** — Passage d'un patient au centre. Unité de travail créée au triage, portant les constantes vitales, close par une consultation. États : en attente, en cours, clôturée, annulée.

---

## Trois confusions à éviter absolument

| Ne pas confondre | Différence |
|---|---|
| **Ordonnance** et **bon** | L'ordonnance est un acte médical, non restreint par catégorie. Le bon est un acte administratif de prise en charge, restreint. Un riverain reçoit une ordonnance ; il n'obtient pas de bon |
| **Verrou** et **rideau** de confidentialité | Le verrou protège les **données** d'un dossier. Le rideau est un **effet visuel** de floutage |
| **Rôle** et **profession** | Le système compte trois **rôles**. « Médecin » est une **profession**, mappée au rôle de médecin chef |

## Termes interdits dans le mémoire

| Terme | Motif | Employer à la place |
|---|---|---|
| `SGCDM` | Sigle d'un autre projet, hérité du modèle académique | **CMS SARIS** |
| Brazzaville, Pointe-Noire, Dolisie **comme sites du centre** | Le centre n'a que deux sites | **Moutela**, **Nkayi** |
| Centre Médico-**Social** | Formulation de la documentation du projet | **Centre Médico-Sanitaire** |
| « Module Pharmacie » | Le système ne gère pas de service de pharmacie | **bon de pharmacie** |
| « Priorité » à propos du triage | La notion a été retirée du système | **ordre d'arrivée** |

> ⚠️ **Nuance sur les noms de villes.** Brazzaville, Pointe-Noire et Dolisie sont **légitimes** lorsqu'ils désignent les villes des **établissements de santé partenaires** vers lesquels les patients sont évacués — le recueil de l'existant les cite à ce titre. Ils sont interdits uniquement pour désigner les **sites du centre**, qui sont Moutela et Nkayi.
