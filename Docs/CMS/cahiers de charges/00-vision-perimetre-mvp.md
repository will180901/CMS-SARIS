# Document 00 - Vision et Périmètre

## 1. Objectif du document

Ce document pose la vision claire du système CMS SARIS. Il explique le problème à résoudre, le périmètre fonctionnel réellement livré, les exclusions et le scénario global de fonctionnement.

Il sert de point d'entrée pour toute personne qui découvre le projet : encadreur, jury, développeur, designer, administrateur ou futur utilisateur.

> Note importante sur la version. Ce document décrit l'état **as-built** (tel que construit) du logiciel. Le périmètre effectivement réalisé **dépasse le MVP initial** : aux 8 modules cibles se sont ajoutés une messagerie interne chiffrée, des notifications temps réel, un tableau de bord, une sauvegarde/restauration réelle de la configuration et le suivi des conditions d'utilisation. Le détail des écarts est donné en section 5.

## 2. Contexte métier

SARIS Congo dispose de deux Centres Médico-Sociaux :

- CMS Moutela ;
- CMS Nkayi.

Ces centres assurent les soins de premier recours pour les travailleurs et certaines personnes rattachées. Le contexte impose plusieurs contraintes fortes :

- deux sites distants ;
- connexion réseau instable ;
- personnel médical qui peut tourner entre les sites ;
- catégories de patients avec des droits différents ;
- besoin de tracer les actes médicaux et administratifs ;
- besoin de travailler même sans réseau.

## 3. Vision du système

Le système CMS SARIS est une application médico-sociale offline-first. Son rôle est de gérer le parcours patient depuis l'arrivée au CMS jusqu'à la décision médicale finale, tout en sécurisant les accès, les droits, les traces et la synchronisation entre les sites. Il assure également la coordination interne des équipes (messagerie chiffrée, notifications temps réel) et la gouvernance technique de la configuration (sauvegarde, restauration, audit).

En phrase simple :

> Le système sait qui se connecte, qui soigne, quel patient est reçu, quels droits il possède, quelle visite est ouverte, quelle décision médicale est prise, comment les équipes communiquent, et comment tout reste cohérent entre Moutela et Nkayi même sans réseau.

## 4. Objectifs métier

- Remplacer les registres dispersés par un dossier patient numérique unique.
- Structurer le triage, la consultation et les actes prescrits.
- Vérifier les droits selon la catégorie patient.
- Sécuriser les prescriptions par des contrôles automatiques.
- Tracer les évacuations et accidents de travail.
- Assurer le suivi des pathologies chroniques.
- Gérer les personnels, habilitations, délégations et sous-traitants.
- Garantir le fonctionnement hors ligne et la synchronisation au retour réseau.
- Permettre une communication interne sécurisée entre soignants.
- Diffuser des notifications temps réel sur les événements cliniques et administratifs.
- Conserver une trace fiable et persistante des actions sensibles (audit).
- Tracer l'acceptation des conditions d'utilisation par chaque utilisateur.

## 5. Périmètre réalisé

### 5.1 Modules cibles du MVP (8) — tous réalisés

Les huit modules prévus à l'origine sont **codés et fonctionnels**, frontend (React) et backend (NestJS + Prisma) :

1. **Sécurité, Administration et Audit** — authentification JWT, double authentification TOTP, blocage progressif, gestion des comptes, rôles et permissions granulaires, audit persistant des mutations et des authentifications.
2. **Référentiels et Droits** — sites, motifs de consultation, pathologies, médicaments, catégories de patients, types d'examen, droits par catégorie.
3. **Synchronisation Offline-First** — file de rejeu IndexedDB, moteur de synchronisation, sauvegarde/restauration de la configuration.
4. **Acteurs Administratifs** — personnel médical, habilitations, délégations de prescription, sous-traitants, rattachements.
5. **Dossier Patient** — identité, allergies, antécédents, alertes médicales, catégories, rattachements (ayants droit CDI et sous-traitants).
6. **Accueil et Triage** — file d'attente par ordre d'arrivée, constantes vitales, machine d'états de la visite, orientation.
7. **Consultation et Actes Prescrits** — examen clinique, diagnostics, ordonnances, bons d'examen, clôture et décision médicale.
8. **Sorties Critiques** — évacuations et accidents de travail, avec suivi.

### 5.2 Modules supplémentaires livrés (au-delà du MVP)

Le développement a dépassé le périmètre initial. Les modules suivants sont eux aussi **codés et fonctionnels** :

| Module | Description |
|---|---|
| **Messagerie interne chiffrée** | Conversations directes et de groupe, messages chiffrés AES-256-GCM au repos, pièces jointes chiffrées (images, vidéos, audio, documents), réactions emoji, accusés de lecture, présence en ligne, suppression à deux niveaux, cloisonnement par site. |
| **Notifications temps réel (SSE)** | Flux Server-Sent Events, notifications individuelles et diffusions ciblées par site et par permission, niveaux (information, succès, avertissement, critique), compteur de non-lus, présence des utilisateurs. |
| **Suivi chronique** | Ouverture et clôture du suivi des pathologies chroniques, visites de suivi, depuis une consultation ou manuellement. |
| **Tableau de bord** | Indicateurs du jour, tendances, séries temporelles, état du personnel, patients à risque, cloisonné par site. |
| **Documents imprimables** | Génération côté client d'ordonnances et de bons d'examen au format A4. |
| **Conditions d'utilisation (CGU)** | Conditions versionnées, acceptation tracée par utilisateur, re-demande automatique en cas de nouvelle version. |
| **Sauvegarde / restauration de la configuration** | Snapshots de la configuration (référentiels, rôles/permissions, paramètres) avec sauvegarde automatique quotidienne et restauration non destructive — les données cliniques ne sont jamais incluses. |

### 5.3 Périmètre technique transverse

- **Cloisonnement multi-site** appliqué à toutes les requêtes via le jeton d'authentification.
- **Permissions granulaires** : 110 permissions au catalogue, réparties sur 6 rôles, avec dérogations individuelles (autorisation / révocation) calculées selon la formule `(permissions des rôles ∪ autorisations) − révocations`.
- **Audit persistant** : journal des mutations métier et journal des authentifications, horodatés, avec adresse IP et géolocalisation.
- **Sécurité applicative** : en-têtes HTTP durcis (Helmet), validation systématique des entrées, limitation de débit par utilisateur, chiffrement des secrets TOTP et des messages.

## 6. Hors périmètre strict

Les sujets suivants restent **hors périmètre** et constituent des extensions futures :

- délivrance interne des médicaments ;
- suivi des stocks ;
- seuils de stock et réapprovisionnement ;
- commandes ou achats médicamenteux ;
- reporting agrégé directionnel ;
- moteur centralisé d'exports ;
- transmission automatique CNSS, SIRH, laboratoires ou autorités sanitaires.

Règle pratique : si une fonctionnalité demande de suivre la sortie physique d'un produit, de consolider des statistiques directionnelles ou de produire des rapports centralisés à destination de tiers, elle sort du périmètre.

## 7. Acteurs principaux

| Acteur | Rôle technique | Rôle dans le système |
|---|---|---|
| Administrateur système | `ADMIN_SYSTEME` | Super-administrateur : accès complet au catalogue (110 permissions). Gère comptes, sécurité, paramètres, synchronisation et supervision. |
| Administrateur médical | `ADMIN_MEDICAL` | Gouvernance clinique : référentiels médicaux, personnel, droits et configuration métier. |
| Médecin chef | `MEDECIN_CHEF` | Pleins droits cliniques : consultations, diagnostics, prescriptions, évacuations et accidents de travail. |
| Infirmier | `INFIRMIER` | Triage, constantes, orientation et actes autorisés (sans prescription). |
| Infirmier délégué | `INFIRMIER_DELEGUE` | Triage et prescription dans un périmètre autorisé par délégation. |
| Agent RH | `AGENT_RH` | Personnel, sous-traitants, ayants droit et rattachements administratifs. |

Tous les rôles disposent d'un socle commun donnant accès à la messagerie interne et aux notifications.

## 8. Vocabulaire stable

| Terme | Définition |
|---|---|
| Patient | Personne possédant un dossier dans le système. |
| Visite | Passage d'un patient au CMS pour un motif donné. |
| Triage | Étape obligatoire d'entrée : droits, constantes, motif, orientation. |
| Consultation | Acte médical réalisé après triage. |
| Décision médicale | Résultat de la consultation : clôture, prescription, examen, évacuation, accident de travail, suivi chronique. |
| Dossier patient | Registre central des données administratives et médicales. |
| Droit de prise en charge | Ce que la catégorie du patient autorise dans le système. |
| Offline-first | Capacité à travailler sans réseau puis à synchroniser ensuite. |
| Permission effective | Droit réel d'un utilisateur, calculé comme `(rôles ∪ autorisations) − révocations`. |
| Audit | Trace persistante et horodatée d'une action sensible (mutation ou authentification). |
| Notification | Message d'événement poussé en temps réel à un ou plusieurs utilisateurs. |

## 9. Scénario global A à Z

1. L'administrateur configure les sites, catégories, droits, pathologies, examens et sociétés.
2. Les utilisateurs reçoivent un compte, un rôle et des permissions ; ils acceptent les conditions d'utilisation à la première connexion.
3. Le personnel médical est organisé : habilitations, délégations et sous-traitants.
4. Le système fonctionne en ligne ou hors ligne selon l'état réseau.
5. Un patient arrive au CMS.
6. L'infirmier recherche le dossier patient.
7. Si le dossier n'existe pas, il le crée après vérification de doublon.
8. Une visite est ouverte au triage.
9. Les droits, alertes et constantes sont vérifiés.
10. Le patient est orienté vers le médecin chef ou un infirmier délégué.
11. La consultation est ouverte depuis la file d'attente.
12. Le soignant examine, pose le diagnostic et prend une décision.
13. Selon la décision, le système peut créer une ordonnance, un bon d'examen, un suivi chronique, une évacuation ou un dossier accident de travail.
14. Les ordonnances et bons d'examen peuvent être imprimés au format A4.
15. La visite est clôturée administrativement.
16. Les soignants se coordonnent via la messagerie interne chiffrée ; les événements importants génèrent des notifications temps réel.
17. Le dossier patient est enrichi.
18. Les actions sensibles sont auditées (mutations et authentifications).
19. Si le site était hors ligne, les données sont synchronisées au retour du réseau.
20. La configuration est sauvegardée automatiquement chaque nuit et peut être restaurée sans perte de données cliniques.

## 10. Repères de réalisation

Quelques chiffres caractérisant l'état livré (vérifiés sur le code) :

| Indicateur | Valeur |
|---|---|
| Tables du modèle de données | 78 |
| Migrations de base de données | 21 |
| Permissions au catalogue | 110 |
| Rôles | 6 |
| Sites | 2 (Moutela, Nkayi) |
| Modules métier | 8 cibles + extensions (messagerie, notifications, suivi chronique, tableau de bord, documents, CGU, sauvegarde) |
| Frontend | React 19, Vite, Tailwind CSS v4, PWA offline-first |
| Backend | NestJS 11, Prisma 6, PostgreSQL |

## 11. Principe directeur

Chaque fonctionnalité du cœur métier doit répondre à une question simple :

> Est-ce nécessaire pour identifier le patient, vérifier ses droits, assurer sa prise en charge, tracer la décision médicale, coordonner les équipes ou garantir la continuité offline ?

Si la réponse est non, la fonctionnalité doit être sortie du périmètre ou placée en roadmap.
