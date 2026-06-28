# Modèle économique — CMS SARIS

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Historique** : v1.0 création

> CMS SARIS est un **outil interne** au Centre Médico-Social de SARIS-CONGO, développé dans le cadre d'une **soutenance de stage**. Ce n'est **pas un produit commercial** : il n'y a **aucun revenu** ni modèle de monétisation. Ce document décrit donc l'**économie de l'outil** : ses coûts d'exploitation et de maintenance, les hypothèses de volume, et la viabilité financière sous l'angle « coût pour l'organisation ». Voir aussi [[vision]], [[plan_modules]], [[modele_operationnel]].

---

## 1. Cadrage et principes

### D-001 — Outil interne, pas de revenu
CMS SARIS est destiné à un usage **interne** au CMS de SARIS-CONGO (sites de Moutela et Nkayi). Il **remplace** un suivi « façon Jeannette » sur Excel et papier. Il n'est ni vendu, ni facturé à des tiers, ni soumis à abonnement. **Conséquence** : il n'existe pas de chiffre d'affaires, de prix de licence, ni de plan tarifaire. Le « modèle économique » se réduit donc à la **maîtrise des coûts**.

### D-002 — Honnêteté des chiffres
Aucun montant n'est inventé dans ce document. Les coûts dont le tarif exact dépend du fournisseur, de la facturation réelle ou d'un arbitrage futur sont explicitement marqués **« à estimer »**. Les paliers d'hébergement cités (gratuit / payant « starter ») correspondent à des faits as-built (la démo tourne actuellement sur les paliers gratuits — voir [[modele_operationnel]]).

---

## 2. Postes de coût d'exploitation

L'architecture est **offline-first multi-poste** : un serveur central cloud (source de vérité) + des postes Windows qui embarquent leur propre backend et base SQLite (voir [[plan_modules]]). Les coûts se répartissent entre **infrastructure cloud centrale** et **postes clients existants**.

### PM-01 — Hébergement de l'API centrale (Render)
- **As-built (démo)** : API NestJS déployée sur **Render**, plan **free** (région Frankfurt). Coût : **0 €**.
- **Limite du palier gratuit** : mise en **veille après ~15 min** d'inactivité ; la première requête après réveil prend ~50 s. Acceptable pour une démo, **inadapté à un central permanent**.
- **Palier payant pour un central permanent** : plan **« starter »** Render (service web sans veille). Coût mensuel : **à estimer** (dépend du plan retenu au moment d'un déploiement réel SARIS).

### PM-02 — Base de données centrale (Neon)
- **As-built (démo)** : PostgreSQL **Neon** (région eu-central-1, projet `neondb`), palier **gratuit**. Coût : **0 €**.
- **Limite** : mise en veille / quotas du palier gratuit, comparable à Render.
- **Palier payant** : passage à un plan Neon payant pour un central permanent. Coût mensuel : **à estimer**.

### PM-03 — Hébergement du site web public (Render static)
- **As-built** : front React/Vite (PWA) servi en **static site** sur Render, palier **gratuit**. Coût : **0 €**. Le static hosting n'a pas la contrainte de veille du service web.

### PM-04 — Postes Windows clients
- Les **postes existent déjà** au CMS (matériel SARIS). L'application desktop (Electron, Windows) s'installe dessus **sans coût matériel additionnel** dans l'hypothèse nominale.
- Coût logiciel des postes : **0 €** (Electron, backend NestJS et SQLite embarqués sont libres / sans licence).
- Coût matériel additionnel éventuel (remplacement/ajout de postes) : **hors périmètre de l'outil**, **à estimer** par SARIS le cas échéant.

### PM-05 — Connectivité internet
- Nécessaire **uniquement pour la synchronisation** et le temps réel (l'outil fonctionne hors-ligne sur chaque poste). La connexion internet des sites est **préexistante** ; **pas de coût imputable** à l'outil. Coût d'une liaison dédiée éventuelle : **à estimer**, hors périmètre.

### PM-06 — Nom de domaine / TLS
- **As-built** : URLs Render par défaut (`*.onrender.com`) avec **HTTPS fourni par Render**. Coût : **0 €**.
- Un nom de domaine personnalisé est **optionnel** ; coût annuel : **à estimer** s'il est souhaité.

### PM-07 — Secrets et sauvegardes
- Les secrets de production (JWT, clés de chiffrement TOTP/messagerie) sont stockés dans les variables d'environnement Render (sans coût dédié).
- Les **sauvegardes de configuration** sont assurées par un mécanisme interne (cron quotidien + rétention, voir [[MODULE_16_synchronisation]]) : **pas de service de sauvegarde payant** dans l'as-built. Une sauvegarde externalisée (stockage objet) serait **à estimer** si exigée.

---

## 3. Coûts de maintenance

### PM-08 — Maintenance applicative
- **Nature** : corrections, montées de version (React 19 / NestJS 11 / Prisma 6), diffusion des mises à jour desktop (via **annonce admin + lien d'installation**, sans recompilation de l'installeur côté poste — voir [[modele_operationnel]]).
- **Coût monétaire as-built** : **0 €** (réalisé par l'équipe de stage / interne). Une maintenance externalisée future serait **à estimer** (jours-homme).

### PM-09 — Hébergement des binaires de mise à jour
- La distribution d'une mise à jour desktop nécessite d'héberger le `.exe` d'installeur quelque part (release GitHub, static Render, drive public). Sur les solutions citées (release GitHub publique, static Render gratuit) : **0 €**. Un stockage payant serait **à estimer**.

### PM-10 — Exploitation / supervision
- Supervision des postes, file de synchronisation et volumétrie via l'écran **Synchronisation** intégré (voir [[MODULE_16_synchronisation]]) — pas d'outil de monitoring tiers payant dans l'as-built. Effort d'administration : **interne**, **à estimer** en charge.

---

## 4. Hypothèses de volume

Ces hypothèses dimensionnent la charge et donc le palier d'hébergement nécessaire. Elles sont des **hypothèses de cadrage**, à valider avec SARIS.

### PM-11 — Périmètre déployé
- **2 sites** : Moutela et Nkayi (fait canonique, voir [[vision]]).

### PM-12 — Utilisateurs (soignants et administration)
- **N soignants** répartis sur les 4 rôles (ADMIN_SYSTEME, MEDECIN_CHEF, MEDECIN, INFIRMIER — voir [[MODULE_02_acces_habilitations]]). Effectif réel : **à estimer** (la démo est seedée avec ~10 comptes, ce qui n'est pas l'effectif cible).
- **Sessions** : une **session unique par utilisateur** (révocation immédiate), ce qui borne la concurrence.

### PM-13 — Patientèle
- Population suivie : **travailleurs SARIS + ayants droit + riverains + sous-traitants**. Volume réel de la patientèle et flux de consultations quotidiens : **à estimer** (la démo contient 5 patients de démonstration, non représentatifs).

### PM-14 — Volumétrie de données
- Schéma **87 tables**, UUID majoritaire, colonnes de synchronisation (`updatedAt`, `deletedAt`). La croissance dépend du flux de consultations et de la rétention. Volume cible et trajectoire de croissance : **à estimer**. La charge réseau est lissée par l'architecture offline-first (chaque poste travaille en local, synchronise par lots).

> Tant que ces volumes ne sont pas mesurés en conditions réelles, le choix entre palier gratuit (démo) et palier payant « starter » (PM-01, PM-02) reste un **arbitrage à instruire**.

---

## 5. Synthèse des coûts (as-built démo)

| Poste | Fournisseur / nature | Palier as-built | Coût as-built | Coût central permanent |
|---|---|---|---|---|
| API centrale | Render (web) | free | 0 € | « starter » — **à estimer** |
| Base de données | Neon (PostgreSQL) | free | 0 € | plan payant — **à estimer** |
| Site web public | Render (static) | free | 0 € | 0 € (static) |
| Postes Windows | matériel SARIS existant | — | 0 € (logiciel) | matériel additionnel **à estimer** |
| Internet | liaison préexistante | — | 0 € imputable | liaison dédiée **à estimer** |
| Domaine / TLS | Render (`*.onrender.com`) | inclus | 0 € | domaine perso **à estimer** |
| Diffusion MAJ | release GitHub / static | gratuit | 0 € | stockage payant **à estimer** |
| Maintenance | interne (stage) | — | 0 € | externalisation **à estimer** |

---

## 6. Conclusion — Viabilité

CMS SARIS est **économiquement viable comme outil interne** :

- **Coût d'hébergement faible**, voire **nul en démonstration** (paliers gratuits Render + Neon), et **maîtrisé** pour un central permanent (un unique service web « starter » + une base payante, montants **à estimer** lors d'un déploiement réel).
- **Pas de coût de licence logicielle** (pile entièrement libre) et **pas de coût matériel additionnel** dans l'hypothèse nominale (postes Windows existants).
- L'architecture **offline-first** réduit la dépendance et la charge sur le central : les postes restent opérationnels hors-ligne, ce qui limite le besoin d'un dimensionnement coûteux.
- **Aucun modèle de monétisation** : l'outil ne génère pas de revenu et n'en a pas vocation. Sa « rentabilité » est **opérationnelle** (remplacement d'un suivi Excel/papier, gain de fiabilité et de traçabilité), non financière.

> **Risque économique principal** : la dépendance aux paliers gratuits (veille, quotas) impose, pour un usage permanent, de basculer sur des paliers payants dont le coût exact reste **à estimer**. Cet arbitrage dépend des volumes réels (section 4), eux-mêmes à mesurer en exploitation.
