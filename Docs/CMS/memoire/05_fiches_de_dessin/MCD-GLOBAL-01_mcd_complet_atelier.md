# MCD-GLOBAL-01 — Le modèle conceptuel complet, en deux planches d'atelier

> **Date** : 18 septembre 2026
> **Nature** : **document de travail, hors mémoire.** Ces deux planches ne sont pas des figures du mémoire et n'ont pas vocation à y entrer. Elles servent à travailler le modèle avec le directeur de mémoire.
> **Destination** : deux onglets supplémentaires dans `07_figures_drawio/FIG_00_TOUTES_LES_FIGURES.drawio`.
> **Statut** : fiche écrite, planches **non produites** — l'environnement de génération et de contrôle est indisponible depuis la mise à jour Windows du 8 septembre 2026.

---

## 1. Ce que ces planches doivent démontrer

Le mémoire ne montre que **29 classes sur 88** au diagramme de classes, et **12 entités sur 88** au modèle conceptuel. C'est un choix documenté — décisions D-07 et le § 7.3 — mais il laisse une question sans réponse visuelle : **à quoi ressemble le modèle entier ?**

Un directeur de mémoire posera cette question. Ces deux planches y répondent, et permettent de discuter :

- du **périmètre retenu** — pourquoi ces 29 classes et pas d'autres ;
- de la **frontière entre le métier et la technique** — les journaux, les sessions, la synchronisation et la messagerie ne sont pas des entités du domaine médical ;
- de la **densité réelle** du modèle, que les planches du mémoire ne laissent pas deviner.

**Ce que ces planches ne sont pas** : des figures du mémoire. La règle de lisibilité à 8 points sur A4 **ne s'y applique pas**, puisqu'elles ne seront jamais réduites à la largeur d'une page. Elles se lisent à l'écran, ou s'impriment en grand format.

---

## 2. Les deux planches

| Onglet | Contenu | Usage |
|---|---|---|
| **ATELIER — MCD structurel** | 88 entités réduites à leur **nom et leur identifiant**, 97 associations, toutes les cardinalités | La vue d'ensemble. C'est celle qui sert à discuter de la structure et du périmètre |
| **ATELIER — MCD détaillé** | Les mêmes 88 entités avec leurs **attributs descriptifs**, mêmes associations | Le travail sur le contenu : quel attribut est où, ce qui est porté par l'entité et ce qui est porté par l'association |

**Les deux onglets portent « ATELIER » en tête de leur nom.** C'est délibéré : personne ne doit les exporter par erreur dans le mémoire, et le nom seul doit suffire à l'éviter.

---

## 3. Les 88 entités, dans les dix modules du schéma

La répartition n'est pas une invention de mise en page : **le schéma de données se déclare lui-même en dix modules**, séparés par des en-têtes de section. C'est cette découpe qui est reprise, et c'est elle qui fait autorité.

| Module | Entités | Champs | Relations internes |
|---|---:|---:|---:|
| Sécurité & audit | 18 | 170 | 13 |
| Référentiels | 12 | 104 | 2 |
| Acteurs administratifs | 12 | 121 | 10 |
| Dossier patient | 13 | 163 | 13 |
| Accueil & triage | 3 | 54 | 2 |
| Consultation & actes prescrits | 11 | 163 | 12 |
| Sorties critiques | 2 | 21 | 1 |
| Suivi de traitement | 2 | 27 | 1 |
| Messagerie interne | 7 | 71 | 6 |
| Synchronisation hors connexion | 8 | 77 | 5 |
| **Total** | **88** | **971** | **97** |

### Le détail, module par module

**Sécurité & audit — 18** · Utilisateur · PreferenceUtilisateur · Notification · NotificationLecture · Role · Permission · UtilisateurPermission · UtilisateurRole · RolePermission · SessionUtilisateur · ConfigurationTotp · CodeSecoursTotp · JournalAudit · JournalAuthentification · AlerteAnomalie · ParametreSysteme · SauvegardeSysteme · RapportGenere

**Référentiels — 12** · Site · CategoriePatient · DroitCategoriePatient · MotifConsultation · TypeConsultation · PathologieReference · MedicamentReference · ContreIndicationMedicament · TypeExamen · TypeCertificat · EtablissementReference · SocieteSousTraitante

**Acteurs administratifs — 12** · PersonnelMedical · HabilitationPersonnel · PlanningPermutation · PresenceJournaliere · AbsencePersonnel · DelegationPrescription · DelegationMedicamentAutorise · EmployeSaris · RattachementAyantDroitCdi · HistoriqueRattachementAyantDroit · RattachementSousTraitant · HistoriqueRattachementSousTraitant

**Dossier patient — 13** · Patient · IdentitePatient · DonneesEmploi · ModeViePatient · ContactUrgence · AllergiePatient · AntecedentPatient · AlerteMedicale · HistoriqueCategoriePatient · FusionDossierPatient · PreSaisieMedicale · SuiviGrossesse · ConsultationPrenatale

**Accueil & triage — 3** · Visite · VisiteEvenement · ConstanteVitale

**Consultation & actes prescrits — 11** · Consultation · DiagnosticConsultation · Ordonnance · LigneOrdonnance · BonExamen · LigneExamen · ResultatExamen · BonPharmacie · LigneBonPharmacie · SuiviChronique · CertificatMedical

**Sorties critiques — 2** · Evacuation · SuiviEvacuation

**Suivi de traitement — 2** · SuiviTraitement · FicheSuiviTraitement

**Messagerie interne — 7** · Conversation · ConversationParticipant · Message · MessageMasque · MessageReaction · MessagePieceJointe · SyncState

**Synchronisation hors connexion — 8** · PosteLocal · FileMutation · JournalSynchronisation · ConflitSynchronisation · ResolutionConflit · AlerteTechnique · ParametreMetier · HistoriqueParametreMetier

---

## 4. Métier et technique : la distinction se voit, elle ne se dit pas

Un modèle conceptuel de données décrit, par définition, **le métier**. Les journaux, les sessions, les files de synchronisation et la messagerie sont des entités techniques : elles n'appartiennent pas au domaine médical, et un directeur de mémoire le relèvera.

Elles figurent quand même sur ces planches — elles font partie du système — mais **les cadres de module sont teintés différemment** :

| Nature | Modules concernés | Entités |
|---|---|---:|
| **Métier** | Référentiels · Acteurs administratifs · Dossier patient · Accueil & triage · Consultation & actes prescrits · Sorties critiques · Suivi de traitement | **55** |
| **Technique et transverse** | Sécurité & audit · Messagerie interne · Synchronisation hors connexion | **33** |

Cette distinction sert directement la défense du périmètre : **les 29 classes du mémoire sont toutes du côté métier**, et les 33 entités techniques expliquent à elles seules la moitié des 59 écartées.

---

## 5. Notation

Celle des planches 8.1a à 8.1c, sans changement, pour qu'un lecteur passe de l'une à l'autre sans réapprendre.

| Élément | Forme |
|---|---|
| Entité | rectangle, bandeau de nom, **identifiant souligné** |
| Association | **ellipse** portant un verbe à l'infinitif |
| Cardinalité | sur la patte, **du côté de l'entité**, forme `minimum,maximum` |
| Clé étrangère | **n'apparaît jamais** — c'est la règle MERISE, un lien est porté par l'association |
| Cadre de module | rectangle titré, teinté selon la nature métier ou technique |

---

## 6. Le point à trancher avec le directeur de mémoire : les verbes

**C'est le seul endroit où ces planches ne peuvent pas être fidèles au code**, et il faut le savoir avant de les montrer.

Une association MERISE porte un verbe. Or le schéma de données n'en contient aucun : il déclare des relations, pas des verbes. Dans le mémoire, les verbes des planches 7.x et 8.1x ont été **sourcés un par un dans le texte du Word** — c'est la règle *rien ne s'invente*, et douze d'entre eux ont même exigé qu'on ajoute un paragraphe au § 7.3 pour les fonder (décision D-72).

Sur **97 associations**, le mémoire n'en nomme qu'une quinzaine.

**Règle retenue pour ces deux planches d'atelier** : les verbes manquants sont **proposés**, et la planche le dit en toutes lettres dans son cartouche. Un verbe proposé se reconnaît à sa mise en forme — écriture en gris et entre parenthèses. Aucun de ces verbes ne peut entrer dans le mémoire sans avoir été sourcé au préalable.

C'est précisément le genre de chose sur quoi un directeur de mémoire est utile : il valide ou corrige les verbes, et ceux qu'il valide deviennent sourçables.

---

## 7. Disposition

**Principe directeur, hérité de D-68 et D-73** : sur une planche dense, c'est le placement qui décide de la lisibilité, pas le routage. Deux cadres qui échangent des liens s'alignent à la même hauteur, et leur contenu s'ordonne pour que les liens soient courts.

**Ordre des cadres, dicté par le flux des liens** — de l'amont vers l'aval, pour que les associations aillent majoritairement dans le même sens :

```
Référentiels  →  Acteurs administratifs  →  Dossier patient
                                                   ↓
                                          Accueil & triage
                                                   ↓
                                    Consultation & actes prescrits
                                          ↙                ↘
                              Sorties critiques    Suivi de traitement

        Sécurité & audit   ·   Messagerie   ·   Synchronisation
                     (bande technique, en bas, à l'écart)
```

**Gouttières** : dimensionnées au nombre d'étiquettes qu'elles portent, jamais par symétrie — règle D-75. La gouttière entre Référentiels et le domaine clinique est la plus chargée ; elle sera la plus large.

---

## 8. Contrôles à passer avant livraison

Les mêmes que pour les vingt-six planches du mémoire, **moins celui de la lisibilité à 8 points**, qui n'a pas de sens ici.

XML valide et identifiants uniques · aucun lien qui pointe dans le vide · aucune forme hors page · aucun chevauchement entre formes · aucun trait qui traverse un encadré · aucune étiquette de lien posée sur une forme · aucune étiquette qui en recouvre une autre · largeur des textes mesurée dans la police de draw.io · aucune balise doublement échappée · étendue réelle du dessin mesurée · **aperçu rendu et regardé avant livraison**.

> ⚠️ **Ces contrôles exigent l'environnement de génération, actuellement indisponible.** Produire ces planches sans eux reviendrait à livrer un brouillon non vérifié — ce qui n'a jamais été fait depuis le début du projet. La production attend donc le rétablissement de l'environnement.

---

## 9. Ce que cette fiche ne contient pas, volontairement

Conformément à la décision **D-78**, une fiche de dessin dit **ce que la figure doit démontrer, avec quelle notation et dans quel ordre**. Elle **ne fait pas foi sur les contenus**.

La liste des 97 associations, leurs cardinalités et les attributs des 88 entités seront donc **relevés dans le schéma au moment de produire**, et non recopiés ici. Trois fiches du dossier se sont déjà révélées fausses pour avoir voulu porter les contenus — c'est exactement l'erreur que cette règle empêche.
