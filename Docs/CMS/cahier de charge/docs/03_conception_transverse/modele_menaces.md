# Modèle de menaces — CMS SARIS (as-built)

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Historique** : v1.0 création

> CMS SARIS manipule des **données de santé** de travailleurs (et ayants droit / riverains /
> sous-traitants) : ce document est **obligatoire**. Il décrit les actifs sensibles, les acteurs
> de menace, les scénarios d'attaque et les **contre-mesures réellement implémentées** (« as-built »),
> avec leurs **risques résiduels** assumés. Chaque contre-mesure cite son chemin de code dans le
> monorepo `CMS/APP/CMS-SARIS/` et/ou son exigence non fonctionnelle de référence.
>
> Source de vérité : [[_SOURCE_systeme]], [[exigences_non_fonctionnelles]] (ENF-04 Sécurité,
> ENF-05 Confidentialité), [[registre_decisions]] (D-006, D-007, D-012, D-013, D-014, D-021),
> [[parametres_metier]] (PM-01 à PM-08, PM-14 à PM-16, PM-44, PM-45).
>
> Convention : un point « à confirmer » signale un fait non vérifié à la source ou un risque non
> traité au moment de la rédaction. Aucune contre-mesure n'est inventée : tout ce qui est affirmé
> « présent » est cité dans le code ou dans une exigence vérifiée.

---

## 1. Actifs sensibles

Les actifs ci-dessous sont classés du plus critique (impact santé / vie privée) au support.

| ID | Actif | Description | Où il vit |
|----|-------|-------------|-----------|
| **AC-01** | **Données de santé patients** | Identité, allergies, antécédents, alertes cliniques, mode de vie, constantes vitales, consultations, documents (ordonnance, bon d'examen, bon de pharmacie, certificat, évacuation). | PostgreSQL (Neon, central) + SQLite répliqué sur **chaque poste desktop** (dossier GLOBAL cross-site, cf. [[registre_decisions]] D-005). |
| **AC-02** | **Identifiants & sessions** | Mots de passe (hachés), jetons JWT (access `sid` + refresh 7 j + temp 2FA 5 min), sessions applicatives. | Table `Session`/`Utilisateur` (PG/SQLite) ; jetons en mémoire client + coffre DPAPI desktop. |
| **AC-03** | **Secrets 2FA (TOTP)** | Secret TOTP par compte + codes de secours. | Stockés **chiffrés AES-256-GCM at-rest** ([[parametres_metier]] PM-45). |
| **AC-04** | **Contenus de messagerie** | Messages internes + pièces jointes (médias) entre soignants, cloisonnés par site. | Stockés **chiffrés AES-256-GCM** en base (contenu + PJ). |
| **AC-05** | **Clés de chiffrement** | Clé(s) TOTP (`TOTP_ENC_KEY`), trousseau messagerie (`MESSAGE_ENC_KEYS` / `…_FILE`, format `v2:keyId`), secret JWT, clé de la file IndexedDB chiffrée web. | Variables d'environnement Render (central) ; **bakées dans l'`.asar`** côté desktop (cf. risque résiduel RR-01). |
| **AC-06** | **Journal d'audit** | Traçabilité des mutations cliniques/config (action, module, entité, utilisateur, **IP réelle**, géolocalisation, statut succès/erreur). | Table `JournalAudit` (PG/SQLite). Actif d'intégrité (preuve) — sa falsification compromet la traçabilité. |
| **AC-07** | **File de mutations hors-ligne** | Mutations cliniques en attente de synchronisation (web : IndexedDB ; desktop : SQLite). | IndexedDB **chiffrée AES-256-GCM** (web) ; base SQLite locale (desktop). |

---

## 2. Acteurs de menace

| ID | Acteur | Capacité / position | Motivation |
|----|--------|---------------------|------------|
| **AM-01** | **Utilisateur interne curieux** | Compte légitime (INFIRMIER, MEDECIN_CHEF…), authentifié, sur le réseau. | Consulter un dossier hors de son périmètre (collègue, proche, personne connue). |
| **AM-02** | **Utilisateur interne malveillant** | Compte légitime, cherche à élever ses privilèges ou exfiltrer en masse. | Vol/altération de données, abus de droits. |
| **AM-03** | **Attaquant réseau** | Position homme-du-milieu / écoute sur le lien client ↔ central, ou attaque applicative à distance (non authentifié). | Interception de jetons/données, brute-force, injection. |
| **AM-04** | **Vol de poste / de base locale** | Accès physique à un poste Windows desktop (vol, poste non verrouillé) → accès à la **base SQLite GLOBALE** et au coffre de secrets. | Exfiltration hors-ligne de tout le dossier patient répliqué. |
| **AM-05** | **Compromission de l'hébergeur** | Accès au central (Render/Neon) : base PostgreSQL, variables d'environnement, logs. | Accès massif aux données et aux **clés de chiffrement** stockées dans l'environnement. |
| **AM-06** | **Poste partagé / regard par-dessus l'épaule** | Tiers physiquement présent près d'un poste de soin ouvert (« shoulder surfing »). | Lecture opportuniste de données cliniques à l'écran. |

---

## 3. Scénarios d'attaque

| ID | Scénario | Acteur(s) | Actif visé |
|----|----------|-----------|------------|
| **SC-01** | **IDOR cross-site / cross-dossier** : accès à une conversation, un destinataire ou une ressource d'un autre site via un identifiant deviné. | AM-01, AM-02 | AC-04, AC-01 |
| **SC-02** | **Lecture d'un dossier hors périmètre / verrouillé** : un soignant non-superviseur lit un dossier verrouillé ou l'activité d'un autre soignant. | AM-01, AM-02 | AC-01 |
| **SC-03** | **Élévation de privilèges** : un rôle limité accède à des opérations réservées (gouvernance, clinique d'un autre). | AM-02 | AC-01, AC-02, AC-06 |
| **SC-04** | **Vol / réutilisation de jeton ou de session** : un jeton volé ou une session restée ouverte est rejoué après logout/révocation. | AM-02, AM-03, AM-04 | AC-02 |
| **SC-05** | **Interception réseau** : écoute du trafic client ↔ central pour capter jetons et données. | AM-03 | AC-01, AC-02 |
| **SC-06** | **Brute-force de connexion / 2FA** : essais massifs de mots de passe ou de codes TOTP. | AM-03 | AC-02, AC-03 |
| **SC-07** | **Exfiltration de la base SQLite locale** : copie du fichier de base répliqué globale sur un poste volé. | AM-04 | AC-01, AC-07 |
| **SC-08** | **Injection (SQL / NoSQL / paramètres)** : payload malveillant via un champ de saisie. | AM-02, AM-03 | AC-01, AC-06 |
| **SC-09** | **XSS** : injection de script s'exécutant dans le navigateur d'un autre utilisateur. | AM-02, AM-03 | AC-02 (jeton/clé web), AC-01 |
| **SC-10** | **Upload de fichier malveillant** : exécutable déguisé en média/document via la messagerie. | AM-02 | poste destinataire |
| **SC-11** | **Fuite via logs** : données sensibles ou secrets écrits dans les journaux applicatifs/hébergeur. | AM-05 | AC-01, AC-05 |
| **SC-12** | **Compromission de l'hébergeur / des secrets** : accès direct à la base PG et aux clés d'environnement. | AM-05 | tous |
| **SC-13** | **Lecture opportuniste à l'écran** (shoulder surfing) sur poste partagé. | AM-06 | AC-01 |

---

## 4. Contre-mesures AS-BUILT (Menace → Contre-mesure → Résiduel)

> Toutes les contre-mesures sont **présentes dans le code** (chemin cité) ou couvertes par une
> exigence vérifiée [[exigences_non_fonctionnelles]]. La colonne « Résiduel » renvoie aux risques
> de la section 5 quand le traitement est partiel.

| Menace | Contre-mesure as-built (référence) | Résiduel |
|--------|------------------------------------|----------|
| **SC-01 IDOR messagerie** | **Cloisonnement par site anti-IDOR** : destinataire/participants filtrés `siteId === siteId(JWT)` et `statut ACTIF` ; participation à la conversation vérifiée (`ForbiddenException` « Vous ne participez pas à cette conversation »). Réf. `apps/api/src/modules/messagerie/messagerie.service.ts` (`getOrCreateDirect`, `createGroup`, `listContacts`, garde participation). | Faible. |
| **SC-02 dossier hors périmètre / verrouillé** | **Verrou de confidentialité médecin-chef** (perm `patient.lock`) : pour un appelant hors supervision, contenu clinique **dépouillé/masqué** (allergies, antécédents, alertes, mode de vie, emploi vidés ; constantes/alertes/documents → liste vide) + bannière « Verrouillé », **appliqué aussi côté backend local**. **Activité scopée à l'initiateur** : consultations filtrées `soignantId = moi`, historique triage par soignant ; supervision = {ADMIN_SYSTEME, MEDECIN_CHEF} voit tout. Réf. [[registre_decisions]] D-006, D-007 ; [[exigences_non_fonctionnelles]] ENF-05-02/03 ; `apps/api/src/modules/{patient,consultation,triage}`. | Faible (le dossier reste GLOBAL en lecture partagée par conception D-005 ; le verrou est ponctuel). |
| **SC-03 élévation de privilèges** | **RBAC à ~110 permissions** appliqué par garde `@RequirePermissions` / `PermissionsGuard` : pas de bypass, la garde vérifie `userPerms.has(p)`. **4 rôles** au catalogue (`ROLE_CATALOG`). ADMIN_SYSTEME a tout uniquement parce que son rôle vaut l'ensemble des permissions. Réf. `packages/types/src/permissions.ts`, `apps/api/src/.../guards/permissions.guard.ts` ; [[registre_decisions]] D-004 ; ENF-05-05. | Écart de décompte permissions/rôles **à confirmer** (cf. RR-04). |
| **SC-04 vol / réutilisation de session** | **Session unique** par utilisateur (un nouveau login révoque les autres) + **révocation immédiate** : la `JwtStrategy` vérifie le `sid` en base à chaque requête (session existante, non révoquée, non expirée) ; déconnexion poussée par SSE `SESSION_REVOKED`. Exemption : sessions de synchro desktop (`posteLocalId`). Réf. `apps/api/src/modules/security/strategies/jwt.strategy.ts`, `security.service.ts` ; [[registre_decisions]] D-021 ; ENF-04-02/03. | Voir RR-02 (mode local : la stratégie JWT **saute** la vérif DB de session ; révocation reste effective côté central). |
| **SC-05 interception réseau** | **TLS** fourni par l'hébergement (Render HTTPS) pour le central et le web. **CORS strict** (liste blanche `CORS_ORIGINS`/`FRONTEND_URL` + `app://cms-saris` + loopback ; méthodes limitées, `credentials: true`). **helmet** (en-têtes de sécurité). Réf. `apps/api/src/main.ts` (`enableCors`, `helmet`) ; ENF-04-07/10. | Réseau SARIS cible réel non encore déployé ; **TLS interne à confirmer** au déploiement on-premise. |
| **SC-06 brute-force login / 2FA** | **Rate-limit** : login et vérification TOTP **10 req/min/IP** ; refresh 30/min ; throttling global **100 req/min** ; **throttling par utilisateur** (derrière proxy/NAT). **Blocage de compte** après 5 tentatives (escalade ×4, [[parametres_metier]] PM-07/08). Réf. `security.controller.ts` (`@Throttle`), `app.module.ts` (`ThrottlerModule`), `guards/user-throttler.guard.ts` ; PM-04/05/06 ; ENF-04-08. | Faible. |
| **SC-07 exfiltration SQLite locale** | **Coffre sécurisé DPAPI / `safeStorage`** pour les secrets de session sur le poste ; backend embarqué lié à **127.0.0.1** uniquement (jamais le LAN). Réf. `apps/desktop/electron` (`window.saris.secure.*`), `main.ts` ; ENF-04-11, ENF-10-04 ; [[registre_decisions]] D-005. | **Élevé** — voir RR-03 : la base SQLite (dossier patient **global**) **n'est pas chiffrée at-rest** ; un vol de poste déverrouillé expose les données. |
| **SC-08 injection** | **Prisma** (requêtes paramétrées, pas de SQL concaténé) ; **validation globale stricte des DTO** : `whitelist` + `forbidNonWhitelisted` (rejet des champs inconnus). Réf. `apps/api/src/main.ts` (`ValidationPipe`) ; ENF-04-10. | Faible. |
| **SC-09 XSS** | React (échappement par défaut du rendu) ; en-têtes helmet ; pas de `dangerouslySetInnerHTML` non maîtrisé *(à confirmer par revue exhaustive)*. Réf. `apps/web`, helmet. | Voir RR-05 : un XSS même-origine exposerait le jeton/la clé de la file IndexedDB côté web. |
| **SC-10 upload malveillant** | **Validation par magic-bytes** (`assertSafeBinary`) : rejet de tout fichier dont les octets de tête trahissent un exécutable/script (MZ, ELF, Mach-O, `#!`) **quel que soit le MIME déclaré** → bloque le « .exe déguisé en .pdf ». Limites **16 Mio/fichier**, **10 fichiers/envoi** ; nom de fichier assaini. Réf. `apps/api/src/modules/messagerie/messagerie.controller.ts` (`assertSafeBinary`, `limits`) ; [[parametres_metier]] PM-15/16. | Validation **négative** (liste de signatures dangereuses), pas une allow-list positive : un format dangereux non listé pourrait passer. |
| **SC-11 fuite via logs** | **Audit persistant** structuré (`@Audit` + `AuditInterceptor` global) journalisant action/module/entité/utilisateur/**IP réelle**/statut, **sans contenu clinique sensible** dans la trace ; messagerie volontairement non auditée (volume + sémantique). Réf. décorateur `@Audit` + `AuditInterceptor` (`APP_INTERCEPTOR`), table `JournalAudit` ; [[registre_decisions]] D-014 ; ENF-04-06. | Logs d'infrastructure de l'hébergeur **non maîtrisés** (cf. RR-06) ; **absence de fuite de secrets/PII dans les logs applicatifs à confirmer** par revue. |
| **SC-12 compromission hébergeur** | **Chiffrement at-rest** des actifs les plus sensibles : secret TOTP (AES-256-GCM) et contenu+PJ de messagerie (AES-256-GCM, clés versionnées `v2:keyId`, trousseau Vault-ready `MESSAGE_ENC_KEYS_FILE`). Mots de passe hachés. Secrets de prod en **variables d'environnement Render** (jamais dans le dépôt). Réf. `common/crypto/{totp-secret,message-crypto}.ts` ; [[parametres_metier]] PM-45 ; [[registre_decisions]] D-002, D-013. | **Élevé** — voir RR-06 : les **données cliniques (AC-01) ne sont PAS chiffrées at-rest** au niveau applicatif ; les **clés vivent dans l'environnement Render** (compromission hébergeur = accès clés + données). |
| **SC-13 shoulder surfing** | **Rideau de confidentialité** : zones cliniques (triage, consultation, messagerie, aperçu patient, éditeur de rôle) **floutées en permanence** (verre poli + grain), révélées au survol ; bascule globale persistée (défaut activé), neutralisée sur tactile. Réf. `apps/web/src/components/PrivacyCurtain.tsx`, `stores/privacy.store.ts` ; ENF-05-04 ; mémoire rideau de confidentialité. | Faible (protection visuelle, pas un contrôle d'accès). |
| **Transverse — perte hors-ligne** | **File de rejeu chiffrée** : mutations hors-ligne conservées (IndexedDB **chiffrée AES-256-GCM** côté web, SQLite côté desktop) jusqu'à pousse réussie (RPO 0). Réf. `apps/web/src/lib/{sync,offlineCrypto}.ts` ; ENF-01-02/03. | — |
| **Transverse — comptes / IP** | **IP réelle** derrière reverse-proxy (`trust proxy`, `TRUST_PROXY`) + géolocalisation hors-ligne (geoip-lite) pour l'audit ; **CGU** tracées et bloquantes (CguGate). Réf. `main.ts` (trust proxy + geoip-lite) ; ENF-04-09/12. | `TRUST_PROXY` **à régler** au déploiement réel. |

---

## 5. Risques résiduels (assumés)

> Honnêteté as-built : les points suivants ne sont **pas (entièrement) traités**. Ils sont
> documentés pour décision consciente avant le déploiement réel.

| ID | Risque résiduel | Description & impact | Atténuation actuelle / piste |
|----|-----------------|----------------------|------------------------------|
| **RR-01** | **Secrets bakés dans l'`.asar` (desktop)** | Les builds de test sont bakés sur `localhost` avec des clés `.env` de développement ; l'`.asar` Electron n'est **pas un secret** (extractible). Le déploiement réel impose un **re-packaging** avec l'URL Render et les clés du central (TOTP/messagerie doivent matcher). Réf. [[exigences_non_fonctionnelles]] ENF-04 (note honnêteté), mémoire offline-first. | Re-packaging avec secrets de prod ; ne pas distribuer un build de test. **À régulariser au déploiement.** |
| **RR-02** | **Mode local : vérif de session JWT sautée** | En backend embarqué (SQLite, loopback), la `JwtStrategy` **saute la vérification de session en base** (un token émis par le central est accepté localement, online-first D-020). La **révocation immédiate reste effective côté central**, mais un token encore valide est accepté localement hors-ligne. | Acté par conception (D-020/D-021) ; impact borné par la durée de vie du jeton (PM-01) et l'isolation loopback. |
| **RR-03** | **Base SQLite locale non chiffrée at-rest** | La base SQLite du poste détient le **dossier patient GLOBAL** (tous sites, D-005). Elle **n'est pas chiffrée** : un vol de poste déverrouillé / une copie du fichier expose les données de santé. Seuls les **secrets de session** sont protégés (DPAPI). | DPAPI (secrets), liaison 127.0.0.1, install per-user. **Chiffrement du fichier SQLite (ex. SQLCipher) non implémenté — à confirmer/évaluer.** |
| **RR-04** | **Écart décompte rôles / permissions** | Divergence « 3 vs 4 rôles » et « 88 vs ~110 permissions » entre le code (`permissions.ts`), le brief et les mémoires (cf. [[parametres_metier]] PM-46/47, [[registre_decisions]] D-003). N'affaiblit pas le mécanisme (pas de bypass) mais brouille la matrice de droits à auditer. | Trancher dans le code puis aligner doc + `test-permissions.ps1`. **À régulariser.** |
| **RR-05** | **XSS même-origine → clé/jeton web** | Un XSS sur l'origine web pourrait lire le jeton JWT et la **clé de la file IndexedDB chiffrée** (toutes deux accessibles au JS de la page). Le chiffrement de la file ne protège donc pas contre un attaquant same-origin. | Échappement React + helmet ; **revue exhaustive anti-XSS + CSP stricte à confirmer.** |
| **RR-06** | **Données cliniques en clair côté central + clés dans l'environnement** | Les données de santé (AC-01) **ne sont pas chiffrées at-rest** au niveau applicatif (seuls TOTP et messagerie le sont) ; les **clés de chiffrement vivent dans l'environnement Render**. Une compromission de l'hébergeur (Neon/Render) donne accès aux données **et** aux clés. | TLS, secrets hors dépôt, audit. **Chiffrement applicatif des données cliniques + gestion de clés type Vault/KMS non en place — à évaluer pour l'on-premise réel.** |
| **RR-07** | **Plan gratuit Render/Neon** | Le plan gratuit **met le service en veille** (première requête lente), n'offre pas de garanties de disponibilité/sauvegarde de niveau production, et n'est pas le réseau SARIS cible. Réf. [[registre_decisions]] D-002. | Sauvegardes de config par cron ([[exigences_non_fonctionnelles]] ENF-03-03) ; passage à un plan payant / on-premise prévu. **Contexte soutenance assumé.** |
| **RR-08** | **Signature de code desktop absente** | L'installeur n'est pas signé (certificat OV/EV) → SmartScreen « éditeur inconnu » ; risque d'altération de l'installeur diffusé non détectée par le poste. Réf. ENF-04 (note honnêteté), [[registre_decisions]] D-017. | Diffusion contrôlée par annonce admin ; **certificat de signature = bloquant externe non résolu.** |

---

## 6. Traçabilité

| Section | Source principale de vérité |
|---------|-----------------------------|
| Actifs (AC) | `packages/db/prisma/schema.prisma`, `common/crypto/*`, `apps/desktop/electron` |
| Acteurs (AM) | [[_SOURCE_systeme]], [[exigences_non_fonctionnelles]] ENF-04/05 |
| Scénarios (SC) | [[registre_decisions]] (D-006/007/012/014/021), `apps/api/src/modules/{patient,consultation,triage,messagerie}` |
| Contre-mesures | `apps/api/src/main.ts`, `security/strategies/jwt.strategy.ts`, `modules/messagerie/*`, `common/crypto/*`, `PrivacyCurtain.tsx` |
| Risques résiduels (RR) | [[exigences_non_fonctionnelles]] ENF-04 (notes honnêteté), [[registre_decisions]] D-002/003/020, mémoire offline-first |

> Tout risque résiduel marqué « à régulariser / à confirmer » doit être levé ou explicitement
> accepté avant la mise en production sur le réseau SARIS réel.
