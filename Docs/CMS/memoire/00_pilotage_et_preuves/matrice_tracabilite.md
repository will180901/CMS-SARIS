# Matrice de traçabilité

> **Objet** : établir, dans les deux sens, la chaîne complète qui relie un besoin à sa réalisation et à sa vérification.
> **Chaîne retenue** :
>
> `Besoin exprimé → Besoin documenté → Règle métier → Cas d'utilisation → Écran → Route API → Entité de données → Permission → Test → Chapitre`
>
> ✅ **Le premier maillon est établi depuis le 2026-08-10.** Les 18 besoins exprimés lors des entretiens sont tracés jusqu'à leur verdict dans `matrice_besoins_couverture.md`. La chaîne est désormais complète des deux côtés.

## 0. Du besoin exprimé au besoin documenté

| Besoin exprimé lors des entretiens | Acteur | Devient | Verdict |
|---|---|---|---|
| Système centralisé entre les deux sites | Médecin Chef | BF23, BNF05, BNF06 | ✅ couvert |
| Dossier patient numérique | Médecin Chef | BF08, BF09 | ✅ couvert |
| Automatisation des rapports | Médecin Chef | BF20, BF21 | ⚠️ partiel — 4 axes sur 10 |
| Formulaire de triage numérique | Infirmière | BF10, BF11 | ✅ couvert |
| Repos médicaux avec lien vers le service RH | Médecin Chef | BF22 | ⚠️ partiel — non transmis |
| Statistiques par catégorie et direction | Médecin Chef | BF21 | ⚠️ partiel |
| Délégation formalisée | Médecin Chef | BF06, BF13 | ✅ couvert |
| Espace de consultation autonome | Gestionnaire RH | BF20 | ✅ couvert pour le médical |
| Suivi des pathologies fréquentes | Gestionnaire RH | BF21 | ✅ couvert |
| Dématérialisation des flux | Gestionnaire RH | BF18, BF22 | ⚠️ partiel |
| Coûts d'évacuation · Absentéisme | Gestionnaire RH | — | 🚫 hors périmètre |
| Stock · Reçus · Facturation · Alertes · Réapprovisionnement · Inventaires | Pharmacienne | — | 🚫 hors périmètre |

**18 besoins · 6 couverts · 4 partiels · 8 hors périmètre · 0 non couvert dans le périmètre.**

---

---

## 1. Matrice principale — par besoin fonctionnel

| Besoin | Règle métier | Cas d'utilisation | Écran | Route(s) API | Entité principale | Permission | Test | Chapitre |
|---|---|---|---|---|---|---|---|---|
| **BF01** Authentification | Blocage progressif ×4 · session unique | UC01–UC07 | `/login` | `POST /auth/login`, `/auth/totp/verify`, `/auth/session/confirmer`, `/auth/refresh` | `Utilisateur`, `SessionUtilisateur`, `ConfigurationTotp` | _aucune_ (séquence d'auth) | `totp-secret` 11 cas ⚠️ non exécuté | 6 § 6.5, 7 § 7.1.4 |
| **BF02** Habilitations | Écrire implique lire · permissions vitales protégées | UC09–UC13 | `/admin/acces` | 32 routes d'administration | `Role`, `Permission`, `UtilisateurRole`, `UtilisateurPermission` | `utilisateur.*`, `role.*` | ⛔ aucun | 6 § 6.3.2, 7 § 7.1.4 |
| **BF03** Audit | Seul l'intercepteur écrit au journal | UC14 | `/admin/audit` | `GET /admin/audit` | `JournalAudit` | `audit.read` | ⛔ aucun | 7 § 7.1.5 |
| **BF04** Paramètres | — | UC15, UC16 | `/admin/parametres-systeme` | 3 routes | `ParametreSysteme` | `parametre.*` | ⛔ aucun | 8 § 8.5 |
| **BF05** Référentiels | Lecture granulaire par service | UC17–UC19 | `/referentiels` (9 onglets) | 37 routes | 12 entités de référentiel | `referentiel.*.*` | `crud-integration` 19 cas ⚠️ non exécuté | 6 § 6.3.4 |
| **BF06** Personnel et délégations | **Délégation active exigée pour prescrire** | UC21–UC24 | `/admin/acces` | 20 routes | `PersonnelMedical`, `DelegationPrescription` | `personnel.*`, `delegation.*` | ⛔ aucun | 7 § 7.1.4, annexe C |
| **BF07** Registre des employés | Matricule unique | UC20 | `/referentiels` onglet employés | 5 routes | `EmployeSaris` | `employe.*` | ⛔ aucun | 6 § 6.3.4 |
| **BF08** Dossier patient | Portée globale · verrou de confidentialité | UC25–UC33 | `/patients`, `/patients/:id` | 30 routes | `Patient` + 12 satellites | `patient.*` | ⛔ aucun | 7 § 7.2.3 |
| **BF09** Rattachements | Historisation obligatoire | UC29 | Onglet rattachements | Routes de rattachement | `RattachementAyantDroitCdi`, `RattachementSousTraitant` | `patient.rattachement.manage` | ⛔ aucun | 7 § 7.2.3 |
| **BF10** Visites et triage | **Ordre d'arrivée strict** · 1 visite ouverte par patient | UC34–UC38 | `/triage` | 9 routes | `Visite` | `visite.*` | ⛔ aucun | 6 § 6.5, 7 § 7.3 |
| **BF11** Constantes vitales | Plages physiologiques alignées client-serveur | UC35 | Onglet constantes | `POST /triage/visites/:id/constantes` | `ConstanteVitale` | `visite.update` | `validation` 34 cas ⚠️ **orphelin** | 6 § 6.0.2 |
| **BF12** Consultation | 1 consultation ouverte par soignant **et** par visite | UC39–UC41, UC48, UC49 | `/consultations` | 22 routes | `Consultation`, `DiagnosticConsultation` | `consultation.*` | ⛔ aucun | 6 § 6.6.2, 7 § 7.3 |
| **BF13** Ordonnance | **Contrôle de prescription à deux étages** | UC42 | Bloc ordonnances | `POST /consultations/:id/ordonnances` + 6 routes | `Ordonnance`, `LigneOrdonnance` | `ordonnance.*` | ⛔ aucun | 6 § 6.5, 7 § 7.4.1 |
| **BF14** Bon d'examen | **Éligibilité par catégorie** · résultat sur bon validé | UC45, UC46 | Bloc bons | 7 routes | `BonExamen`, `LigneExamen`, `ResultatExamen` | `bon_examen.*` | ⛔ aucun | annexe C |
| **BF15** Bon de pharmacie | **Éligibilité par catégorie** · délivrance irréversible | UC43, UC44 | Bloc bons | 5 routes | `BonPharmacie`, `LigneBonPharmacie` | `bon_pharmacie.*` | ⛔ aucun | 6 § 6.6.1, 7 § 7.4.1 |
| **BF16** Évacuation | Réservée au médecin chef | UC50, UC51 | Bloc évacuation | 8 routes | `Evacuation`, `SuiviEvacuation` | `evacuation.*` | ⛔ aucun | annexe C |
| **BF17** Suivi de traitement | Ouvert par décision de clôture | UC52, UC53 | Onglet suivi | 8 routes | `SuiviTraitement`, `FicheSuiviTraitement` | `suivi_traitement.*` | ⛔ aucun | 7 § 7.3 |
| **BF18** Messagerie | Chiffrement au repos · conversation créée au 1er message | UC54–UC56 | `/messagerie` | 29 routes | `Conversation`, `Message` + 4 | `messagerie.*` | `message-crypto` 23 cas · `messaging-integration` 12 · `conversation-firstmessage` 9 ⚠️ non exécutés | 8 § 8.4 |
| **BF19** Notifications | Diffusion filtrée par permission et site | UC57, UC58 | Tiroir de notifications | 9 routes | `Notification`, `NotificationLecture` | `notification.*` | ⛔ aucun | 7 § 7.5.4 |
| **BF20** Tableaux de bord | Vue adaptée au profil | UC59 | `/dashboard` | 9 routes | *(agrégations)* | `dashboard.read` | ⛔ aucun | 7 § 7.8 |
| **BF21** Rapports | — | UC60, UC61 | `/rapports` | 2 routes | `RapportGenere` | `rapport.*` | ⛔ aucun | 6 § 6.3.11 |
| **BF22** Impressions | 6 documents, 2 gabarits partagés | UC33, UC47 | 6 modales | — *(côté client)* | — | `ordonnance.print` | ⛔ aucun | 7 § 7.8 |
| **BF23** Synchronisation | **Dernière écriture gagnante** · tombstones · jamais bloquant | UC62–UC65 | `/synchronisation`, `/base-donnees` | 14 routes | 52 entités synchronisées | `synchronisation.*` | `sync-conflict` 17 cas ⚠️ **orphelin** · `soft-delete-core` 10 · `soft-delete-revive` 8 | 7 § 7.5, 8 § 8.2.3 |

---

## 2. Matrice inverse — des règles métier vers leur réalisation

Les cinq règles transverses, et **tout** ce qu'elles touchent.

### R1 — Éligibilité par catégorie de patient

| Dimension | Réalisation |
|---|---|
| Entité porteuse | `DroitCategoriePatient` — matrice en base, modifiable sans redéploiement |
| Point d'application | Garde `assertPrestationCouverte`, utilitaire transverse |
| Cas d'utilisation | UC43, UC45 |
| Routes concernées | `POST /consultations/:id/ordonnances/:ordId/generer-bon` |
| Écrans | Bloc bons de l'écran de consultation |
| Figures | 6.5, 7.2, 7.3 |
| Chapitres | 3 § 3.1.3 · 6 § 6.6.1 · 7 § 7.4.1 |
| Test | ⛔ **aucun** — la règle la plus structurante n'est pas testée |

### R2 — Droit de prescrire à deux étages

| Dimension | Réalisation |
|---|---|
| Étage 1 | Garde de permission `ordonnance.create` |
| Étage 2 | Garde `assertPeutPrescrire` — exige une délégation active |
| Entités | `DelegationPrescription`, `Ordonnance.delegationId` |
| Cas d'utilisation | UC22, UC24, UC42 |
| Figures | 6.3, 7.2, 7.3 |
| Chapitres | 3 § 3.1.1 · 6 § 6.5 · 7 § 7.1.4 |
| Test | ⛔ aucun |

### R3 — Portée globale du dossier patient

| Dimension | Réalisation |
|---|---|
| Mécanisme | Registre des modèles synchronisés — 42 entités en portée globale |
| Contrepartie | Verrou de dossier appliqué par l'API, y compris sur le poste autonome |
| Cas d'utilisation | UC31, UC63 |
| Figures | 6.6, 7.4, 7.7 |
| Chapitres | 3 § 3.1.2 · 7 § 7.5.3 |
| Test | ⛔ aucun test de bout en bout |

### R4 — Suppression logique et propagation

| Dimension | Réalisation |
|---|---|
| Mécanisme | Extension de la couche d'accès aux données — 47 entités |
| Limites documentées | Création avec écrasement, compteurs relationnels, inclusions imbriquées |
| Cas d'utilisation | Tous les cas de suppression |
| Chapitres | 7 § 7.2.5 · 8 § 8.6.5 |
| Test | ✅ `soft-delete-core` 10 cas · `soft-delete-revive` 8 cas ⚠️ non exécutés |

### R5 — Ordre d'arrivée sans priorité

| Dimension | Réalisation |
|---|---|
| Mécanisme | Tri de la file par date d'ouverture. **La notion de priorité a été retirée du système** — migration dédiée |
| Cas d'utilisation | UC34, UC37 |
| Figures | 7.2, 7.10 |
| Chapitres | 3 § 3.1.1 · 6 § 6.5 |
| Test | ⛔ aucun |

---

## 3. Couverture par canal

| Besoin | Web | API | Desktop connecté | Desktop autonome | Synchronisé |
|---|:---:|:---:|:---:|:---:|:---:|
| BF01 à BF04 | ✅ | ✅ | ✅ | ✅ | partiel |
| BF05 à BF09 | ✅ | ✅ | ✅ | ✅ | ✅ |
| BF10 à BF17 | ✅ | ✅ | ✅ | ✅ | ✅ sauf BF17 |
| BF18, BF19 | ✅ | ✅ | ✅ | ✅ | BF18 ✅ · BF19 ⬜ |
| BF20, BF21 | ✅ | ✅ | ✅ | ✅ | ⬜ |
| BF22 | ✅ | ⬜ | ✅ | ✅ | ⬜ |
| BF23 | ✅ | ✅ | ✅ | ⚠️ | — |

---

## 4. Ce que la matrice révèle

### 4.1 Le déséquilibre de la couverture de test

**16 besoins fonctionnels sur 23 n'ont aucun test.** Les tests existants couvrent le chiffrement, la suppression logique, la résolution de conflit et la validation — c'est-à-dire les **mécanismes techniques transverses**, non le **métier**.

Autrement dit : ce qui est testé, ce sont les fondations. Ce qui ne l'est pas, c'est le bâtiment. Les deux règles les plus structurantes — éligibilité par catégorie et droit de prescrire — ne sont couvertes par aucun test.

### 4.2 Deux suites orphelines couvrent la logique la plus critique

`sync-conflict` (17 cas) et `validation` (34 cas) ne sont rattachées à aucune commande. Or elles couvrent la résolution de conflit hors connexion et les plages physiologiques des constantes vitales. **51 cas sur 145 ne s'exécutent jamais automatiquement.**

### 4.3 Trois permissions sans route

`ordonnance.read`, `ordonnance.print` et `rapport.export` ne sont exigées par aucune route serveur : ce sont des contrôles d'**affichage**. Une permission purement cliente **n'est pas une protection** — un appel direct à l'interface de programmation la contourne. À signaler au chapitre 7.

---

## 5. État de la traçabilité amont

| Lien de la chaîne | État |
|---|---|
| Cas d'utilisation → écran → route → entité → permission | ✅ **complet**, vérifié par les inventaires |
| Règle métier → cas d'utilisation | ✅ complet |
| Besoin → règle métier | ✅ complet |
| **Besoin observé sur le terrain → besoin documenté** | ⛔ **manquant** — QO-01 |
| Besoin → test | ⚠️ **incomplet** — 16 besoins sur 23 sans test |

> **La chaîne est solide en aval et rompue en amont.** Tout ce qui va du besoin documenté jusqu'au code est tracé et vérifiable. Ce qui manque, c'est le premier maillon : le lien entre un besoin **exprimé par un agent du centre** et le besoin tel qu'il figure ici. Ce maillon exige le recueil de l'existant.
>
> Cette limite doit être énoncée telle quelle au chapitre 5 : la traçabilité descendante est établie, la traçabilité ascendante reste à compléter.
