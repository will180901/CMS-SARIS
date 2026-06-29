# Cadre réglementaire — CMS SARIS

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Historique** : v1.0 création

> Document du cahier des charges **AS-BUILT**. Il décrit le cadre réglementaire applicable à la protection des données de santé manipulées par CMS SARIS, et met en regard **ce que le système met déjà en place**. Voir aussi [[_SOURCE_systeme]], [[glossaire]], [[vision]] et la fiche sécurité applicative [[exigences_non_fonctionnelles]].
>
> **Avertissement majeur.** Ce document est rédigé du point de vue produit/ingénierie. **Aucune affirmation juridique précise (numéro de loi, durée légale de conservation, obligation déclarative)** n'a été validée par un juriste. Toute mention de ce type porte explicitement la marque **« à vérifier auprès d'un juriste »**. La modale de conditions d'utilisation du logiciel le rappelle d'ailleurs elle-même (« document d'usage interne — ne se substitue pas à un conseil juridique », source : `apps/web/src/components/ConditionsModal.tsx`).

---

## 1. Objet et portée

CMS SARIS traite des **données de santé à caractère personnel** (identité de patients, antécédents, allergies, constantes vitales, consultations, prescriptions, certificats, évacuations) pour les travailleurs de SARIS-CONGO, leurs ayants droit, riverains et sous-traitants, sur les sites de Moutela et Nkayi.

Ces données relèvent, dans la quasi-totalité des cadres juridiques, d'une **catégorie « sensible »** soumise à des exigences renforcées (consentement, secret professionnel, sécurité, conservation, traçabilité). Le présent document :

1. énonce les **principes généraux** de protection des données de santé (sourcés ou marqués « à vérifier ») ;
2. pointe le **cadre national** (Congo-Brazzaville) avec la prudence requise (« à vérifier auprès d'un juriste ») ;
3. **recense les dispositifs déjà implémentés** dans le système en regard de chaque exigence.

**Hors périmètre de ce document** : la conformité opérationnelle réelle (registre de traitement signé, désignation d'un responsable de traitement, contrats sous-traitants, déclaration auprès d'une autorité). Ces actes relèvent de l'exploitant SARIS, pas du logiciel.

---

## 2. Principes généraux de protection des données de santé

Les principes ci-dessous sont **largement convergents** entre les grands référentiels de protection des données (par ex. RGPD UE 2016/679 pour l'espace européen, et la plupart des lois nationales qui s'en inspirent). Ils sont énoncés ici comme **bonnes pratiques de référence**, pas comme obligation locale opposable.

| Réf | Principe | Source / statut |
|---|---|---|
| P-01 | **Licéité, loyauté, transparence** : traitement fondé sur une base légale, information de la personne. | Principe RGPD art. 5 (UE 2016/679) — **applicabilité au Congo à vérifier auprès d'un juriste**. |
| P-02 | **Limitation des finalités** : données collectées pour le suivi médical, non réutilisées à d'autres fins (ex. RH/sanction). | Principe RGPD art. 5 — **à vérifier**. |
| P-03 | **Minimisation** : ne collecter que le nécessaire au soin. | Principe RGPD art. 5 — **à vérifier**. |
| P-04 | **Exactitude** : données tenues à jour. | Principe RGPD art. 5 — **à vérifier**. |
| P-05 | **Limitation de conservation** : durée bornée et justifiée (voir §5). | Principe RGPD art. 5 ; durée précise **à vérifier auprès d'un juriste**. |
| P-06 | **Intégrité et confidentialité** : sécurité technique et organisationnelle adaptée (chiffrement, contrôle d'accès, audit). | Principe RGPD art. 5(1)(f) et art. 32 — bonne pratique universelle. |
| P-07 | **Responsabilité (accountability)** : capacité à démontrer la conformité (traçabilité, journalisation). | Principe RGPD art. 5(2) — bonne pratique. |
| P-08 | **Catégorie particulière (données de santé)** : traitement par principe interdit sauf exception (soin, consentement explicite). | Principe RGPD art. 9 — **applicabilité locale à vérifier auprès d'un juriste**. |

> **Note d'honnêteté.** Le RGPD est cité comme **référentiel de bonnes pratiques** parce qu'il est public et largement repris. Il **n'est pas réputé applicable** au traitement local de SARIS-CONGO. La détermination du texte réellement opposable est **à vérifier auprès d'un juriste**.

---

## 3. Cadre national (Congo-Brazzaville)

| Réf | Élément | Statut |
|---|---|---|
| N-01 | Existence d'une loi nationale sur la protection des données à caractère personnel et d'une autorité de contrôle. | **À vérifier auprès d'un juriste** (le Congo-Brazzaville dispose d'un cadre sur les données personnelles ; le texte exact, son champ et l'autorité compétente ne sont pas confirmés dans ce document). |
| N-02 | Obligations déclaratives / d'autorisation préalable pour un traitement de données de santé. | **À vérifier auprès d'un juriste.** |
| N-03 | Encadrement du **secret médical** par le Code de déontologie / Code pénal local. | **À vérifier auprès d'un juriste** (le secret médical est un principe quasi universel — voir §4 — mais sa base textuelle locale n'est pas vérifiée). |
| N-04 | Durées légales de **conservation** des dossiers médicaux. | **À vérifier auprès d'un juriste** (voir §5). |
| N-05 | Régime particulier du **dossier de médecine du travail / d'entreprise** (CMS = service médical d'entreprise). | **À vérifier auprès d'un juriste** — point sensible, car SARIS est à la fois employeur et exploitant du centre médical (risque de confusion finalité soin / finalité RH, cf. P-02). |

> **Recommandation produit.** Le double rôle « employeur + centre médical » (N-05) est le risque juridique le plus structurant. Le système l'adresse partiellement par le **cloisonnement des accès** et le **verrou de confidentialité** (§7), mais la **séparation organisationnelle des finalités** reste une décision d'exploitation **à arbitrer avec un juriste**.

---

## 4. Secret médical

| Réf | Exigence | Statut |
|---|---|---|
| SM-01 | Les données cliniques d'un patient ne sont accessibles qu'aux soignants **impliqués dans sa prise en charge**. | Principe déontologique universel ; base textuelle locale **à vérifier auprès d'un juriste**. |
| SM-02 | Le partage entre soignants est limité à ce qui est **utile au soin**. | Principe déontologique — **à vérifier** pour la base locale. |
| SM-03 | Toute consultation de dossier doit être **traçable** (qui, quand). | Bonne pratique de sécurité ; voir audit §7. |

**Mise en regard (as-built)** — le système implémente le secret médical de façon opérationnelle :
- **dossier centralisé mais activité scopée à l'initiateur** : les consultations / triages sont rattachés au soignant qui les a créés, pas exposés à tous (cf. [[_SOURCE_systeme]] §Confidentialité) ;
- **cloisonnement par site** : la messagerie et plusieurs lectures cliniques sont restreintes au site de l'utilisateur (fermeture de failles IDOR cross-site) ;
- **verrou de confidentialité médecin-chef** : voir §7 ;
- **rideau de confidentialité** (flou visuel) sur les zones cliniques de l'écran, débrayable au survol.

---

## 5. Conservation et traçabilité

| Réf | Exigence | Statut |
|---|---|---|
| CT-01 | Durée de conservation des dossiers médicaux bornée et justifiée. | **Durée légale à vérifier auprès d'un juriste.** Le système **n'applique aujourd'hui aucune purge automatique des dossiers patients** (à confirmer côté exploitation). |
| CT-02 | Effacement = **soft-delete** (marquage `deletedAt`), non destructif, pour traçabilité et synchronisation. | **Fait** (as-built) : colonne `deletedAt DateTime?` présente sur de nombreuses tables (`packages/db/prisma/schema.prisma`), pattern tombstone exploité par le module `sync/`. |
| CT-03 | Journalisation des accès et mutations sensibles. | **Fait** : journal d'audit persistant (voir §7, AU-01). |
| CT-04 | Conservation des journaux d'authentification (connexions, échecs). | **Fait** : table `JournalAuthentification` (`schema.prisma`). |

> **Limite assumée.** Le soft-delete sert d'abord la **synchronisation multi-poste** (LWW, tombstones) ; sa valeur de **conservation légale** (CT-01) n'est pas configurée comme une politique de rétention juridiquement calibrée. **À vérifier auprès d'un juriste.**

---

## 6. Consentement

| Réf | Exigence | Statut |
|---|---|---|
| CO-01 | Base légale du traitement des données de santé (soin / consentement explicite). | **À vérifier auprès d'un juriste** (P-08, N-05). |
| CO-02 | Recueil et **trace** du consentement du patient au traitement de ses données. | **Non implémenté pour le patient** (à confirmer) : le système ne capture pas, à ce jour, un consentement patient horodaté distinct. |
| CO-03 | Acceptation par l'**utilisateur (soignant/admin)** des conditions d'usage du logiciel. | **Fait** : voir §7, CG-01 (tracking d'acceptation CGU horodaté + versionné). |

> **Distinction importante.** CG-01 trace l'acceptation des conditions par **l'utilisateur du logiciel**, ce qui n'est **pas** le consentement du **patient** au traitement de ses données (CO-02). Ces deux notions ne doivent pas être confondues. La pertinence d'un consentement patient explicite dans le contexte « médecine d'entreprise » est **à vérifier auprès d'un juriste**.

---

## 7. Dispositifs de sécurité déjà en place (mise en regard)

Tableau de correspondance **exigence de sécurité → implémentation as-built**. Tous les éléments « Fait » sont sourcés sur le code ou la mémoire projet.

| Réf | Dispositif | Couvre | Source |
|---|---|---|---|
| SEC-01 | **Chiffrement at-rest du secret TOTP** (AES-256-GCM, format `v1:<iv>:<tag>:<ct>`, clé dérivée scrypt de `TOTP_ENC_KEY`). | P-06, intégrité/confidentialité du 2FA. | `apps/api/src/common/crypto/totp-secret.ts`. |
| SEC-02 | **Codes de secours TOTP** (hashés bcrypt, usage unique) acceptés au login. | Continuité d'accès sécurisée. | `security.service.ts`. |
| SEC-03 | **Chiffrement at-rest de la messagerie** (AES-256-GCM, versionné `v2:<keyId>:…` + legacy `v1`, trousseau `MESSAGE_ENC_KEYS`, rotation de clé + ré-encryption non destructive). | P-06, confidentialité des échanges internes. | `apps/api/src/.../message-crypto.ts`. |
| SEC-04 | **Authentification JWT** (access + refresh, **session unique** par utilisateur, révocation immédiate). | Contrôle d'accès. | [[_SOURCE_systeme]] §Backend. |
| SEC-05 | **TOTP 2FA** (chiffré at-rest, cf. SEC-01). | Renforcement de l'authentification. | idem. |
| SEC-06 | **Contrôle d'accès par rôle et permissions** (3 rôles d'habilitation — ADMIN_SYSTEME, MEDECIN_CHEF, INFIRMIER ; la profession « Médecin » est mappée au rôle MEDECIN_CHEF — 110 permissions, guard `@RequirePermissions`). | SM-01, P-06, minimisation des accès. | `packages/types/src/permissions.ts`. |
| SEC-07 | **Verrou de confidentialité de dossier** : le MEDECIN_CHEF peut verrouiller un dossier sensible. | SM-01, confidentialité renforcée. | [[_SOURCE_systeme]] §Rôles/Patients. |
| SEC-08 | **Cloisonnement par site** (lectures cliniques et messagerie scopées au site, fermeture IDOR cross-site). | SM-01, SM-02. | (traçabilité interne). |
| SEC-09 | **Rideau de confidentialité** (flou des zones cliniques à l'écran, défaut activé). | Confidentialité « épaule » / écran partagé. | (traçabilité interne). |
| AU-01 | **Journal d'audit persistant** : table `JournalAudit` (utilisateur, action, module, entité, avant/après JSON, **IP**, statut SUCCES/ERREUR, date) alimentée par décorateur `@Audit` + interceptor global sur les mutations cliniques/config ; admins auto-audités. | CT-03, P-07, SM-03. | `schema.prisma` (model `JournalAudit`). |
| AU-02 | **Journal d'authentification** (connexions, échecs, code de secours `SUCCES_LOGIN_CODE_SECOURS`). | CT-04, P-07. | `schema.prisma` (`JournalAuthentification`). |
| AU-03 | **IP réelle + géolocalisation hors-ligne + parsing navigateur** dans les journaux. | Traçabilité des accès. | (traçabilité interne). |
| CG-01 | **CGU / Conditions d'utilisation** : modale bilingue bloquante, **acceptation horodatée et versionnée** (`cguAccepteeLe`, `cguVersion` sur `PreferenceUtilisateur`, `CGU_VERSION='v1-2026.06'`, gate `CguGate`). | CO-03, P-01 (transparence usage). | `schema.prisma` (`PreferenceUtilisateur`) ; `ConditionsModal.tsx`. |
| CG-02 | **Politique de confidentialité** affichable (modale `kind='privacy'`, lecture seule, 7 sections). | P-01 (transparence). | `apps/web/src/components/ConditionsModal.tsx`. |
| NET-01 | **CORS strict**, **rate-limit login** (10/min/IP), rate-limit messagerie par utilisateur, **trust proxy** (IP réelle). | P-06, anti-abus. | [[_SOURCE_systeme]] §Sécurité. |
| NET-02 | **Anti-spoofing de fichier** (rejet d'exécutables déguisés via magic-bytes), nettoyage des noms de fichier (anti path-traversal/XSS) sur la messagerie. | P-06. | (traçabilité interne). |
| KEY-01 | **Rotation / versioning de clé** de chiffrement + chargement depuis fichier (`MESSAGE_ENC_KEYS_FILE`, Vault/HSM-ready). | P-06, gestion du cycle de vie des clés. | (traçabilité interne). |

---

## 8. Écarts et points à arbitrer (synthèse honnête)

| Réf | Écart / point ouvert | Statut |
|---|---|---|
| E-01 | Texte juridique **réellement opposable** (national) non identifié. | **À vérifier auprès d'un juriste** (N-01 à N-05). |
| E-02 | **Durée légale de conservation** des dossiers non fixée ; aucune purge applicative des dossiers patients. | **À vérifier** (CT-01). |
| E-03 | **Consentement patient** au traitement : non capturé/horodaté dans le système. | Non implémenté (CO-02) — pertinence à confirmer avec un juriste. |
| E-04 | Risque **finalité soin vs finalité RH** (employeur = exploitant du CMS). | Atténué par cloisonnement/verrou ; séparation organisationnelle **à arbitrer** (N-05, P-02). |
| E-05 | **Run de ré-encryption en masse** post-rotation de clé non exécuté (sans objet tant qu'une seule clé est active). | Différé assumé (KEY-01). |
| E-06 | Mention d'un **responsable de traitement** désigné, registre des traitements, contrats sous-traitants. | Hors logiciel — décision d'exploitation SARIS, **à vérifier auprès d'un juriste**. |

---

## 9. Décisions et paramètres rattachés

- **D-001** — Tout fait juridique précis non vérifié est marqué « à vérifier auprès d'un juriste » ; aucune affirmation légale n'est inventée ni présentée comme certaine. (Méthodo ULAMU — honnêteté absolue.)
- **D-002** — La trace d'acceptation des CGU (CG-01) concerne l'**utilisateur du logiciel** et ne vaut **pas** consentement du **patient** (CO-02).
- **Version courante des CGU** (`v1-2026.06`) : voir [[parametres_metier]] **PM-61** ; un changement de version **re-demande** l'acceptation à tous les utilisateurs (source : `MeService.CGU_VERSION`).
- **Effacement applicatif = soft-delete** (`deletedAt`), non destructif : voir [[parametres_metier]] **PM-62** (source : `schema.prisma`).

---

## 10. Références croisées

- Brief canonique : [[_SOURCE_systeme]]
- Exigences non fonctionnelles / sécurité applicative : [[exigences_non_fonctionnelles]]
- Contexte métier (double rôle employeur/CMS) : [[vision]]
- Glossaire (rôles, catégories patient, CGU) : [[glossaire]]
- Module messagerie chiffrée : [[MODULE_13_messagerie]]
- Module audit & sécurité : [[MODULE_04_audit_supervision]]

> Les liens ci-dessus pointent vers des documents du cahier des charges (certains restent à créer) ; **à confirmer** au fil de la complétion de la documentation.
