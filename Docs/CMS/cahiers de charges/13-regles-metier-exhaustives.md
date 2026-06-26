# Document 13 — Règles Métier Exhaustives

## 1. Objectif

Ce document centralise les règles métier de CMS SARIS. Il est la référence pour la conception, le développement et la recette. Toute règle référencée dans les workflows ou la matrice de traçabilité doit exister ici.

Les règles sont exhaustives pour le périmètre réalisé. Les fonctionnalités hors périmètre sont signalées explicitement comme extensions futures et ne sont pas détaillées.

### 1.1 État de réalisation (as-built)

L'ensemble des modules décrits dans ce document est **réalisé et codé** dans l'application. Les règles ci-dessous reflètent l'état réel de l'implémentation et non une cible théorique.

| Élément | Valeur (état réel) |
|---|---|
| Tables Prisma | 78 |
| Migrations | 21 |
| Permissions (catalogue `packages/types/src/permissions.ts`) | 110 |
| Rôles | 6 — ADMIN_SYSTEME, ADMIN_MEDICAL, MEDECIN_CHEF, INFIRMIER, INFIRMIER_DELEGUE, AGENT_RH |
| Frontend | React 19 + Vite 7 + TypeScript + Tailwind v4 + shadcn/ui ; Zustand ; TanStack Query/Table ; Dexie.js (IndexedDB offline) ; vite-plugin-pwa (Workbox) ; recharts ; emoji-mart ; ffmpeg.wasm |
| Backend | NestJS 11 + Prisma 6 + PostgreSQL 16 ; otplib (TOTP) ; bcrypt (12 rounds) ; JWT (+ refresh 7 j) ; @nestjs/throttler ; @nestjs/schedule (cron) ; multer ; helmet ; geoip-lite ; node:crypto (AES-256-GCM) |
| Monorepo | Turborepo + pnpm (apps/web, apps/api, packages/ui, packages/types, packages/db) |

Les modules transversaux suivants ont été ajoutés au-delà des 8 modules du périmètre initial et sont également réalisés : **messagerie interne chiffrée**, **notifications temps réel**, **conditions générales d'utilisation versionnées**, **documents A4 imprimables**, **sauvegarde / restauration de configuration**.

---

## 2. Règles de périmètre

| ID | Règle |
|---|---|
| R-SCOPE-001 | Le système contient une seule application frontend, un seul backend et une seule base de données logique. |
| R-SCOPE-002 | Les modules sont des domaines internes, pas des applications séparées. |
| R-SCOPE-003 | La délivrance physique des médicaments est hors périmètre (extension future). |
| R-SCOPE-004 | La gestion des stocks est hors périmètre (extension future). |
| R-SCOPE-005 | Le réapprovisionnement est hors périmètre (extension future). |
| R-SCOPE-006 | Le reporting agrégé directionnel est hors périmètre (extension future). |
| R-SCOPE-007 | La transmission automatique CNSS est hors périmètre (extension future). |
| R-SCOPE-008 | Le planning et la présence du personnel (tables présentes mais non exposées) sont une extension future. |
| R-SCOPE-009 | Le suivi grossesse complet, l'internationalisation multilingue et une suite de tests automatisés étendue sont des extensions futures. |
| R-SCOPE-010 | Les sujets exclus peuvent être cités uniquement comme limites ou extensions futures. |

---

## 3. Sécurité, administration et audit

| ID | Règle |
|---|---|
| R-SEC-001 | Aucun utilisateur ne peut accéder au système sans compte actif. |
| R-SEC-002 | Un compte possède exactement un statut actif à un instant donné. |
| R-SEC-003 | Un compte désactivé ne peut pas ouvrir de session. |
| R-SEC-004 | Un compte bloqué ne peut pas ouvrir de session avant déblocage autorisé. |
| R-SEC-005 | Le mot de passe n'est jamais stocké en clair (hachage bcrypt, 12 rounds). |
| R-SEC-006 | Un mot de passe temporaire impose un changement à la première connexion. |
| R-SEC-007 | Le système refuse un mot de passe ne respectant pas la politique configurée. |
| R-SEC-008 | Les rôles sensibles doivent utiliser le TOTP. |
| R-SEC-009 | Les codes de secours TOTP sont à usage unique. |
| R-SEC-010 | Le secret TOTP est chiffré au repos (AES-256-GCM) et n'est jamais exposé en clair après l'enrôlement. |
| R-SEC-011 | Les codes de secours TOTP peuvent être saisis à la connexion en remplacement du code temporaire. |
| R-SEC-012 | Une session inactive expire automatiquement. |
| R-SEC-013 | Une révocation de session prend effet immédiatement. |
| R-SEC-014 | Une révocation d'urgence désactive les sessions actives du compte ciblé. |
| R-SEC-015 | Les jetons d'accès JWT ont une durée de vie courte ; un jeton de rafraîchissement (7 jours) permet le renouvellement. |
| R-SEC-016 | Les permissions sont contrôlées côté interface et côté backend. |
| R-SEC-017 | Le catalogue de permissions comporte 110 permissions réparties par module. |
| R-SEC-018 | Les permissions peuvent être attribuées par rôle et par dérogation individuelle (GRANT / REVOKE). |
| R-SEC-019 | Le rôle ADMIN_SYSTEME est super-administrateur : il dispose de l'intégralité du catalogue de permissions, y compris l'accès clinique. |
| R-SEC-020 | Toute tentative d'action interdite est bloquée et auditée. |
| R-SEC-021 | Les actions critiques sont inscrites dans le journal d'audit. |
| R-SEC-022 | Le journal d'audit est alimenté automatiquement par un intercepteur global `@Audit` (AuditInterceptor en APP_INTERCEPTOR) sur les mutations des contrôleurs cliniques et de configuration. |
| R-SEC-023 | Chaque entrée d'audit enregistre l'auteur, l'action, l'IP réelle, la géolocalisation, le navigateur et le statut de l'opération. |
| R-SEC-024 | Le journal d'audit n'est pas modifiable par l'interface applicative. |
| R-SEC-025 | Une connexion réussie est journalisée (journal d'authentification). |
| R-SEC-026 | Une connexion échouée est journalisée (journal d'authentification). |
| R-SEC-027 | Plusieurs échecs successifs déclenchent un blocage selon le seuil configuré. |
| R-SEC-028 | Une alerte d'anomalie peut être marquée comme investiguée avec commentaire. |
| R-SEC-029 | Les sauvegardes sont tracées avec date, statut et auteur ou déclencheur. |
| R-SEC-030 | Les paramètres système sensibles gardent un historique de modification (ancienne et nouvelle valeur). |
| R-SEC-031 | La durée de session est configurable par l'administrateur système. |
| R-SEC-032 | La liste des sessions actives d'un utilisateur est consultable par l'administrateur système. |
| R-SEC-033 | Le changement de mot de passe force l'invalidation des autres sessions actives. |
| R-SEC-034 | Un administrateur peut forcer la déconnexion immédiate de tout utilisateur. |
| R-SEC-035 | L'IP réelle est résolue derrière proxy (paramètre TRUST_PROXY) ; la géolocalisation est hors-ligne (geoip-lite). |
| R-SEC-036 | Les actions des administrateurs auto-audités sont exclues pour éviter le bruit de boucle. |

---

## 4. Référentiels et droits

| ID | Règle |
|---|---|
| R-REF-001 | Les sites Moutéla et Nkayi doivent exister avant la mise en service. |
| R-REF-002 | Une catégorie patient doit avoir des droits définis. |
| R-REF-003 | Les droits de prise en charge sont calculés à partir de la catégorie active du patient. |
| R-REF-004 | Les droits ne doivent pas être codés en dur dans les modules métier. |
| R-REF-005 | Une entrée référentielle utilisée ne doit pas être supprimée physiquement ; la suppression est refusée (409) si l'entrée est référencée. |
| R-REF-006 | Une entrée obsolète doit être désactivée ou archivée. |
| R-REF-007 | Le CRUD des référentiels est complet (création, lecture, modification, suppression 409-safe) et diffusé en temps réel (LIVE_REFERENTIELS). |
| R-REF-008 | Un médicament de référence peut être utilisé pour prescrire, sans suivi de stock. |
| R-REF-009 | Une contre-indication doit préciser le médicament, le type de condition et le niveau de gravité. |
| R-REF-010 | Les motifs de consultation doivent venir du référentiel. |
| R-REF-011 | Les motifs d'évacuation doivent venir du référentiel. |
| R-REF-012 | Les types d'accidents de travail doivent venir du référentiel. |
| R-REF-013 | Les types d'examens doivent venir du référentiel. |
| R-REF-014 | Une société sous-traitante suspendue ne permet pas de nouveau rattachement actif. |
| R-REF-015 | Un établissement de référence inactif ne peut pas être sélectionné pour une nouvelle évacuation. |
| R-REF-016 | Une modification d'un droit de catégorie doit être auditée. |
| R-REF-017 | Une modification de paramètre métier doit garder ancienne et nouvelle valeur. |
| R-REF-018 | Les libellés de référentiel doivent être uniques dans leur domaine fonctionnel. |
| R-REF-019 | Le code fonctionnel d'un référentiel ne doit pas changer après utilisation. |
| R-REF-020 | Les listes affichées aux utilisateurs masquent par défaut les entrées inactives. |
| R-REF-021 | Les anciennes données restent lisibles même si le référentiel associé est inactif. |
| R-REF-022 | Un droit de catégorie peut inclure un nombre maximum de consultations par période configurable. |
| R-REF-023 | Les médicaments de référence peuvent être classés par famille thérapeutique. |
| R-REF-024 | Un médicament de référence doit avoir un nom générique et peut avoir un ou plusieurs noms commerciaux. |
| R-REF-025 | Les contre-indications peuvent être liées à une pathologie ou à un état physiologique (grossesse, allaitement). |
| R-REF-026 | Les types d'examens doivent être classés par domaine : biologie, imagerie, spécialisé. |
| R-REF-027 | Un établissement de référence doit indiquer son type et sa localisation. |
| R-REF-028 | Un établissement de référence doit indiquer les types de soins qu'il accepte. |
| R-REF-029 | Les pathologies chroniques de référence sont gérées indépendamment des motifs de consultation. |
| R-REF-030 | Une pathologie chronique de référence peut définir des critères de suivi recommandés. |

> Note : la notion de priorité par défaut sur les motifs (ancienne règle) a été retirée de l'interface. La file d'attente est traitée par ordre d'arrivée. La colonne `priorite` a été **supprimée de la base** (migration `remove_priorite` : `DROP COLUMN` sur `MotifConsultation` et `Visite`).

---

## 5. Acteurs administratifs

| ID | Règle |
|---|---|
| R-ACT-001 | Un membre du personnel médical doit avoir un profil actif. |
| R-ACT-002 | Une habilitation peut être activée, suspendue ou révoquée. |
| R-ACT-003 | L'historique des habilitations doit être conservé. |
| R-ACT-004 | Une délégation de prescription doit être accordée par le médecin chef. |
| R-ACT-005 | Une délégation doit avoir une période de validité. |
| R-ACT-006 | Une délégation doit définir le périmètre autorisé (médicaments autorisés). |
| R-ACT-007 | Une délégation suspendue bloque immédiatement les prescriptions déléguées. |
| R-ACT-008 | Une prescription déléguée doit référencer la délégation utilisée. |
| R-ACT-009 | Un ayant droit CDI doit être rattaché à un CDI actif. |
| R-ACT-010 | Le statut de l'ayant droit dépend du statut du CDI de rattachement. |
| R-ACT-011 | La suspension d'un CDI suspend les rattachements actifs de ses ayants droit. |
| R-ACT-012 | Un rattachement ayant droit doit indiquer le type de lien familial. |
| R-ACT-013 | Un transfert d'ayant droit vers un autre CDI doit être historisé. |
| R-ACT-014 | Un sous-traitant doit être rattaché à une société active. |
| R-ACT-015 | La suspension d'une société suspend les sous-traitants rattachés. |
| R-ACT-016 | Un transfert de sous-traitant vers une autre société doit être historisé. |
| R-ACT-017 | Les sous-traitants conservent des droits restreints. |
| R-ACT-018 | Un CDI peut avoir un nombre maximum d'ayants droit configurable via un paramètre système. |
| R-ACT-019 | Un ayant droit peut être conjoint ou enfant ; le type de lien est obligatoire. |
| R-ACT-020 | Un enfant ayant droit perd ses droits à la majorité selon l'âge limite configuré. |
| R-ACT-021 | Un rattachement ayant droit inactif ne génère plus de droits de prise en charge. |
| R-ACT-022 | La suspension d'un CDI suspend immédiatement les droits de tous ses ayants droit. |
| R-ACT-023 | La réactivation d'un CDI réactive les rattachements ayants droit qui avaient été suspendus pour ce seul motif. |
| R-ACT-024 | Un transfert d'ayant droit vers un nouveau CDI clôture le rattachement précédent avec date d'effet. |
| R-ACT-025 | Un divorce ou une séparation documentée clôture le rattachement conjoint avec motif. |
| R-ACT-026 | La clôture d'un rattachement ayant droit indique la date d'effet et le motif. |
| R-ACT-027 | Les visites et consultations passées d'un ayant droit restent accessibles après clôture du rattachement. |
| R-ACT-028 | Un ayant droit décédé doit être marqué comme décédé et son rattachement clôturé. |
| R-ACT-029 | La liste des ayants droit actifs d'un CDI est consultable par l'agent RH. |
| R-ACT-030 | Un sous-traitant doit appartenir à une société prestataire active pour bénéficier d'une prise en charge. |
| R-ACT-031 | Les droits d'un sous-traitant sont restreints par rapport aux droits d'un CDI. |
| R-ACT-032 | La suspension d'une société prestataire suspend tous ses sous-traitants rattachés. |
| R-ACT-033 | La réactivation d'une société réactive les sous-traitants suspendus uniquement pour ce motif. |
| R-ACT-034 | Un sous-traitant peut être transféré vers une autre société prestataire active. |
| R-ACT-035 | Le transfert d'un sous-traitant clôture le rattachement précédent et crée un nouveau rattachement. |
| R-ACT-036 | La fin de mission d'un sous-traitant clôture le rattachement avec date d'effet. |
| R-ACT-037 | Les droits des sous-traitants peuvent être personnalisés par rapport aux droits par défaut de la catégorie. |
| R-ACT-038 | Un sous-traitant avec statut suspendu ne peut pas ouvrir de nouvelle visite. |
| R-ACT-039 | L'historique des rattachements d'un sous-traitant est consultable par l'agent RH. |
| R-ACT-040 | Les actes médicaux d'un sous-traitant restent accessibles après fin de mission. |
| R-ACT-041 | Le nombre de consultations autorisées pour un sous-traitant est paramétrable par société. |
| R-ACT-042 | Un sous-traitant ne peut pas être rattaché simultanément à deux sociétés actives. |

> Note : les tables de planning, présence journalière et absence du personnel sont présentes dans le schéma mais non encore exposées dans l'interface ; il s'agit d'une extension future. Les règles relatives au planning prévisionnel et aux alertes de couverture de site sont donc reportées.

---

## 6. Dossier patient

| ID | Règle |
|---|---|
| R-PAT-001 | Un patient doit avoir un dossier unique actif. |
| R-PAT-002 | La création d'un dossier impose une recherche préalable. |
| R-PAT-003 | Un doublon probable doit être signalé avant création. |
| R-PAT-004 | Un dossier médical avec historique ne doit pas être supprimé physiquement. |
| R-PAT-005 | Un dossier peut être archivé, décédé ou fusionné. |
| R-PAT-006 | L'identité administrative doit être rattachée au patient. |
| R-PAT-007 | La catégorie active du patient doit être visible sur le dossier. |
| R-PAT-008 | Un changement de catégorie doit être historisé. |
| R-PAT-009 | Un changement de catégorie doit indiquer auteur, date, ancienne catégorie, nouvelle catégorie et motif. |
| R-PAT-010 | Les allergies actives doivent être visibles en consultation et à la prescription. |
| R-PAT-011 | Une allergie doit indiquer son niveau de gravité. |
| R-PAT-012 | Les antécédents actifs doivent être visibles en consultation. |
| R-PAT-013 | Les constantes vitales doivent être datées et rattachées à une visite. |
| R-PAT-014 | Le contact d'urgence doit être accessible en sortie critique. |
| R-PAT-015 | Une alerte médicale active doit être affichée dans les parcours de soin. |
| R-PAT-016 | Une alerte résolue reste historisée. |
| R-PAT-017 | Une fusion de dossiers doit conserver les historiques des deux dossiers. |
| R-PAT-018 | Une fusion doit indiquer le dossier conservé et le dossier fusionné. |
| R-PAT-019 | Un suivi grossesse actif crée une alerte médicale permanente. |
| R-PAT-020 | Une consultation prénatale doit être rattachée à un suivi grossesse. |
| R-PAT-021 | La clôture d'un suivi grossesse doit indiquer le devenir. |
| R-PAT-022 | Les données médicales pré-saisies doivent être distinguées des données validées. |
| R-PAT-023 | Une identité administrative doit comporter au minimum le nom, le prénom et la date de naissance. |
| R-PAT-024 | Le numéro de patient est généré automatiquement et ne peut pas être modifié après création. |
| R-PAT-025 | La création d'un patient hors ligne génère une mutation locale avec un UUID client non modifiable. |
| R-PAT-026 | Un changement de catégorie requiert une habilitation spécifique définie dans les droits. |
| R-PAT-027 | La date d'effet d'un changement de catégorie ne peut pas être antérieure de plus de 30 jours sans validation renforcée. |
| R-PAT-028 | Un changement de catégorie vers AYANT_DROIT_CDI exige le rattachement à un CDI actif. |
| R-PAT-029 | Un changement de catégorie vers SOUS_TRAITANT exige le rattachement à une société prestataire active. |
| R-PAT-030 | Les visites et consultations passées conservent la catégorie applicable au moment de la visite. |
| R-PAT-031 | Les droits de prise en charge appliqués sont ceux de la catégorie active à l'ouverture de la visite. |
| R-PAT-032 | Un dossier patient dont la catégorie est archivée reste lisible mais ne peut plus être mis à jour. |
| R-PAT-033 | Le statut DECEDE bloque l'ouverture de nouvelles visites pour ce patient. |
| R-PAT-034 | La fusion de deux dossiers requiert la validation de l'administrateur médical. |
| R-PAT-035 | Un suivi grossesse ne peut être ouvert que pour un patient identifié de sexe féminin. |
| R-PAT-036 | Un seul suivi grossesse actif peut exister à un instant donné pour un même patient. |
| R-PAT-037 | La date prévue d'accouchement est obligatoire à l'ouverture du suivi grossesse. |
| R-PAT-038 | Une grossesse active génère une alerte médicale permanente pendant toute la durée du suivi. |
| R-PAT-039 | Le suivi grossesse actif est affiché de façon prominente dans les consultations et prescriptions. |
| R-PAT-040 | Toute prescription pour un patient avec grossesse active déclenche les contrôles de sécurité grossesse. |
| R-PAT-041 | Une consultation prénatale doit indiquer le terme de grossesse au moment de la visite. |
| R-PAT-042 | Les consultations prénatales sont rattachées automatiquement au suivi grossesse actif. |
| R-PAT-043 | Le poids et la tension artérielle sont obligatoires à chaque consultation prénatale. |
| R-PAT-044 | Une anomalie grave détectée en consultation prénatale déclenche une alerte critique immédiate. |
| R-PAT-045 | La clôture d'un suivi grossesse exige un devenir parmi : naissance à terme, prématuré, fausse couche, mort fœtal, évacuation. |
| R-PAT-046 | La clôture d'un suivi grossesse doit indiquer la date réelle d'accouchement ou de fin. |
| R-PAT-047 | Un suivi grossesse clôturé reste dans l'historique du dossier patient. |
| R-PAT-048 | Les facteurs de risque identifiés en cours de grossesse sont conservés dans le dossier. |
| R-PAT-049 | L'ouverture d'un suivi grossesse pour une patiente sans catégorie adéquate génère une alerte à l'administrateur médical. |
| R-PAT-050 | Les consultations prénatales successives doivent indiquer une progression logique du terme. |

---

## 7. Accueil et triage

| ID | Règle |
|---|---|
| R-TRI-001 | Aucune consultation ne peut exister sans visite ouverte. |
| R-TRI-002 | Une visite doit être rattachée à un patient. |
| R-TRI-003 | Les droits du patient sont vérifiés à l'ouverture de visite. |
| R-TRI-004 | Les alertes médicales actives sont affichées à l'ouverture de visite. |
| R-TRI-005 | Le motif principal doit venir du référentiel. |
| R-TRI-006 | Les constantes saisies doivent être rattachées à la visite. |
| R-TRI-007 | L'IMC est calculé si taille et poids sont disponibles. |
| R-TRI-008 | Une constante anormale déclenche une alerte visuelle. |
| R-TRI-009 | L'orientation vers infirmier délégué exige une délégation active. |
| R-TRI-010 | Une visite clôturée ne doit plus être modifiée directement. |
| R-TRI-011 | Une correction sur visite clôturée doit être encadrée et auditée. |
| R-TRI-012 | Une visite annulée doit avoir un motif. |
| R-TRI-013 | Des droits suspendus n'empêchent pas les soins de base, mais doivent être signalés. |
| R-TRI-014 | Le triage doit fonctionner hors ligne avec les données locales disponibles. |
| R-TRI-015 | Une visite peut avoir plusieurs constantes saisies à des moments différents. |
| R-TRI-016 | La température, la pression artérielle, la saturation en O2 et la glycémie ont des seuils d'alerte configurables. |
| R-TRI-017 | L'IMC est recalculé automatiquement à chaque modification du poids ou de la taille. |
| R-TRI-018 | Un motif secondaire peut être ajouté à une visite après le motif principal. |
| R-TRI-019 | La file d'attente est visible par tous les soignants du site en temps réel. |
| R-TRI-020 | La file d'attente est traitée par ordre d'arrivée ; la notion de priorité a été retirée de l'interface. |
| R-TRI-021 | Un patient peut être sorti de la file sans consultation si l'infirmier le décide (abandon de visite). |
| R-TRI-022 | L'heure d'arrivée et l'heure de prise en charge sont tracées pour chaque visite. |
| R-TRI-023 | La durée d'attente est calculée et affichée en temps réel dans la file. |
| R-TRI-024 | L'ouverture de visite est atomique et déduplique le patient (un patient ne peut pas être ouvert deux fois en file). |
| R-TRI-025 | Une visite ouverte hors ligne est marquée avec l'indicateur de synchronisation PENDING. |
| R-TRI-026 | Les données de triage hors ligne sont synchronisées avant les consultations associées. |
| R-TRI-027 | L'orientation vers un soignant spécifique peut être précisée au triage. |
| R-TRI-028 | Une pré-saisie médicale réalisée au triage est clairement distinguée des données validées en consultation. |
| R-TRI-029 | La visite indique si elle a été créée en mode hors ligne. |
| R-TRI-030 | Toute modification des constantes après enregistrement initial est tracée avec auteur et heure. |

---

## 8. Consultation et actes prescrits

| ID | Règle |
|---|---|
| R-CON-001 | Une consultation doit être rattachée à une visite active. |
| R-CON-002 | Une consultation doit être réalisée par un acteur habilité. |
| R-CON-003 | Une consultation clôturée ne doit pas être modifiée directement. |
| R-CON-004 | Une consultation ne peut pas être clôturée sans conclusion médicale. |
| R-CON-005 | Le diagnostic principal est obligatoire si une décision médicale est prise. |
| R-CON-006 | Une décision médicale doit appartenir à la liste de référence. |
| R-CON-007 | Une ordonnance doit être rattachée à une consultation. |
| R-CON-008 | Une ordonnance validée ne doit pas être modifiée directement. |
| R-CON-009 | Une ordonnance annulée doit avoir un motif. |
| R-CON-010 | Une ligne d'ordonnance doit référencer un médicament de référence actif. |
| R-CON-011 | Le système vérifie les allergies connues avant validation d'une ordonnance. |
| R-CON-012 | Le système vérifie les contre-indications avant validation d'une ordonnance. |
| R-CON-013 | La grossesse active déclenche les contrôles de sécurité grossesse à la prescription. |
| R-CON-014 | Une contre-indication absolue bloque la prescription. |
| R-CON-015 | Une contre-indication relative exige une justification clinique. |
| R-CON-016 | Un infirmier délégué ne prescrit que dans son périmètre de délégation. |
| R-CON-017 | Une prescription déléguée doit référencer la délégation active. |
| R-CON-018 | Un bon d'examen doit être rattaché à une consultation. |
| R-CON-019 | Un examen demandé doit avoir une indication clinique. |
| R-CON-020 | Un résultat d'examen doit être rattaché à la demande initiale. |
| R-CON-021 | Un résultat d'examen doit indiquer date de réception et auteur de saisie. |
| R-CON-022 | Les résultats d'examen sont confidentiels. |
| R-CON-023 | Un suivi chronique doit référencer une pathologie de référence. |
| R-CON-024 | Un suivi chronique clôturé doit avoir un motif de clôture. |
| R-CON-025 | La délivrance physique de médicaments est hors périmètre. |
| R-CON-026 | Une ordonnance doit être datée et associée au prescripteur. |
| R-CON-027 | Une ordonnance peut contenir plusieurs lignes de médicaments. |
| R-CON-028 | Une ligne d'ordonnance doit préciser posologie, durée et voie d'administration. |
| R-CON-029 | Des instructions supplémentaires au patient peuvent être ajoutées en texte libre. |
| R-CON-030 | Une prescription déléguée n'est possible que si une délégation active couvre le médicament. |
| R-CON-031 | Un infirmier délégué ne voit que les médicaments de son périmètre de délégation. |
| R-CON-032 | L'identifiant de la délégation est inscrit dans chaque ligne de prescription déléguée. |
| R-CON-033 | Une allergie confirmée affiche une alerte bloquante avant toute prescription du médicament incriminé. |
| R-CON-034 | Une allergie non confirmée affiche un avertissement sans blocage. |
| R-CON-035 | Une allergie de niveau SEVERE bloque la prescription même si l'allergie n'est pas confirmée. |
| R-CON-036 | Un antécédent médical pertinent déclenche une vérification de compatibilité à la prescription. |
| R-CON-037 | La grossesse active déclenche la vérification de la catégorie de risque du médicament. |
| R-CON-038 | Un médicament formellement contre-indiqué en grossesse est bloqué si une grossesse active est détectée. |
| R-CON-039 | Une contre-indication relative exige une justification clinique obligatoire en texte libre. |
| R-CON-040 | La justification pour une contre-indication relative est enregistrée dans l'ordonnance et auditée. |
| R-CON-041 | Une ordonnance en brouillon peut être supprimée par le prescripteur avant validation. |
| R-CON-042 | Une ordonnance validée peut être imprimée au format A4 unifié (logo, monochrome). |
| R-CON-043 | Un renouvellement d'ordonnance doit référencer l'ordonnance d'origine. |
| R-CON-044 | Un renouvellement exige une nouvelle consultation ou une justification médicale documentée. |
| R-CON-045 | Le nombre de renouvellements autorisés dépend du protocole de suivi chronique si applicable. |
| R-CON-046 | Un bon d'examen doit référencer un type d'examen du référentiel. |
| R-CON-047 | L'indication clinique est obligatoire sur un bon d'examen. |
| R-CON-048 | Un bon d'examen peut inclure plusieurs types d'examens différents. |
| R-CON-049 | Un bon d'examen peut indiquer un établissement de référence ou laisser le champ libre. |
| R-CON-050 | L'annulation d'un bon d'examen exige un motif. |
| R-CON-051 | Un bon d'examen sans résultat reste en statut ATTENTE_RESULTAT jusqu'à saisie ou annulation. |
| R-CON-052 | Les résultats d'examens sont accessibles uniquement aux soignants autorisés. |
| R-CON-053 | Un résultat d'examen doit indiquer le laboratoire ou l'établissement réalisateur. |
| R-CON-054 | Un résultat peut être saisi en texte libre ou avec des valeurs numériques selon le type d'examen. |
| R-CON-055 | Un résultat hors normes déclenche une alerte visible au médecin prescripteur. |
| R-CON-056 | Un résultat peut être retourné partiellement avec un statut RESULTAT_PARTIEL. |
| R-CON-057 | Toute modification d'un résultat déjà saisi est tracée avec auteur, date et ancienne valeur. |
| R-CON-058 | Un résultat d'examen est confidentiel et non accessible à l'agent RH. |
| R-CON-059 | Le médecin peut ajouter une interprétation clinique du résultat. |
| R-CON-060 | La demande d'examen et son résultat restent liés dans le dossier après clôture de la visite. |
| R-CON-061 | Un suivi chronique est rattaché à une pathologie de référence active. |
| R-CON-062 | Un patient peut avoir plusieurs suivis chroniques actifs simultanément pour des pathologies différentes. |
| R-CON-063 | La consultation d'un patient avec suivi chronique actif affiche les suivis en cours. |
| R-CON-064 | La fréquence de suivi et les objectifs thérapeutiques sont définis à l'ouverture du suivi chronique. |
| R-CON-065 | Une consultation peut être rattachée à un suivi chronique existant actif. |
| R-CON-066 | Le protocole d'un suivi chronique peut être modifié sans clôturer le suivi. |
| R-CON-067 | La clôture d'un suivi chronique exige un motif parmi : rémission, décès, transfert, abandon, guérison. |
| R-CON-068 | Les suivis chroniques clôturés restent dans l'historique du dossier et sont consultables. |

---

## 9. Sorties critiques

| ID | Règle |
|---|---|
| R-SOR-001 | Une évacuation doit être rattachée à une consultation. |
| R-SOR-002 | Une évacuation doit avoir un motif médical issu du référentiel. |
| R-SOR-003 | Une évacuation doit avoir un niveau d'urgence. |
| R-SOR-004 | Une évacuation immédiate déclenche une alerte prioritaire. |
| R-SOR-005 | Une évacuation annulée doit avoir un motif médical. |
| R-SOR-006 | Le contact d'urgence du patient doit être affiché pendant une évacuation. |
| R-SOR-007 | Le suivi post-évacuation doit conserver les retours d'information disponibles. |
| R-SOR-008 | Une évacuation clôturée ne doit pas être modifiée directement. |
| R-SOR-009 | Un accident de travail doit être rattaché à une consultation. |
| R-SOR-010 | Un AT doit être qualifié par le médecin chef. |
| R-SOR-011 | Un AT doit indiquer date, heure, lieu et circonstances. |
| R-SOR-012 | Un AT doit indiquer les lésions constatées. |
| R-SOR-013 | Un AT doit indiquer la gravité. |
| R-SOR-014 | Un arrêt de travail doit avoir une durée ou une date de réévaluation. |
| R-SOR-015 | Une prolongation d'arrêt doit être rattachée à l'AT initial. |
| R-SOR-016 | Une consolidation doit indiquer la présence ou l'absence de séquelles. |
| R-SOR-017 | Une rechute doit être rattachée à l'AT initial. |
| R-SOR-018 | L'agent RH ne modifie pas les données médicales. |
| R-SOR-019 | La transmission automatique CNSS est hors périmètre. |
| R-SOR-020 | Une évacuation d'urgence IMMEDIATE peut être initiée sans attendre la clôture de la consultation. |
| R-SOR-021 | L'établissement de référence peut ne pas être précisé en cas d'extrême urgence. |
| R-SOR-022 | Les informations cliniques transmises lors d'une évacuation sont figées à la date de départ. |
| R-SOR-023 | Un suivi post-évacuation peut recevoir plusieurs mises à jour successives. |
| R-SOR-024 | L'absence de retour d'information après un délai configurable déclenche une alerte de suivi. |
| R-SOR-025 | Un AT ne peut être qualifié que pour un patient de catégorie CDI ou SOUS_TRAITANT. |
| R-SOR-026 | La date et l'heure exactes de l'accident sont obligatoires. |
| R-SOR-027 | Le lieu de l'accident (zone de travail ou description) doit être indiqué. |
| R-SOR-028 | Les circonstances de l'accident doivent être décrites en texte libre. |
| R-SOR-029 | Les lésions constatées doivent être décrites avec leur localisation et leur nature. |
| R-SOR-030 | La gravité de l'AT doit être classifiée parmi : léger, moyen, grave, très grave. |
| R-SOR-031 | La qualification médicale de l'AT est réservée au médecin chef. |
| R-SOR-032 | Les données administratives de l'AT peuvent être consultées par l'agent RH en lecture. |
| R-SOR-033 | L'agent RH ne peut pas modifier les données médicales du dossier AT. |
| R-SOR-034 | Un arrêt de travail doit indiquer la date de début et la durée ou la date de réévaluation. |
| R-SOR-035 | Une prolongation d'arrêt de travail doit indiquer la date d'effet et être rattachée à l'AT. |
| R-SOR-036 | Les prolongations successives sont historisées dans le dossier AT dans l'ordre chronologique. |
| R-SOR-037 | La consolidation de l'AT doit indiquer la présence ou l'absence de séquelles. |
| R-SOR-038 | En cas de séquelles, une description et un taux d'incapacité indicatif sont saisis. |
| R-SOR-039 | La date de consolidation est obligatoire pour clôturer un dossier AT. |
| R-SOR-040 | Une rechute est créée comme un nouvel événement rattaché à l'AT initial par son identifiant. |
| R-SOR-041 | Le dossier AT reste ouvert jusqu'à consolidation ou clôture par le médecin chef. |
| R-SOR-042 | Un dossier AT ne peut pas être supprimé physiquement. |
| R-SOR-043 | Les témoins de l'accident peuvent être enregistrés en information libre. |
| R-SOR-044 | Si le patient est évacué à la suite d'un AT, la fiche AT et la fiche d'évacuation sont liées. |
| R-SOR-045 | Les données AT ne sont pas exportées automatiquement vers un système tiers. |
| R-SOR-046 | Un dossier AT clôturé reste consultable en lecture seule. |
| R-SOR-047 | Toute modification d'un AT déjà qualifié est journalisée dans le journal d'audit. |
| R-SOR-048 | Un AT peut être annulé (erreur de saisie) uniquement par le médecin chef, avec motif obligatoire. |
| R-SOR-049 | Un AT annulé reste dans l'historique avec le statut ANNULE et le motif d'annulation. |
| R-SOR-050 | Le formulaire AT doit être accessible hors ligne si une consultation est déjà ouverte localement. |
| R-SOR-051 | Une évacuation doit indiquer si le transport est assuré par SARIS ou externe. |
| R-SOR-052 | Le retour d'information post-évacuation peut être saisi par le médecin chef ou l'administrateur médical. |
| R-SOR-053 | La clôture d'un suivi post-évacuation indique le statut final : retour au travail, décès, transfert définitif. |
| R-SOR-054 | Les fiches d'évacuation, d'accident de travail et de suivi sont imprimables au format A4 unifié. |

---

## 10. Synchronisation offline-first et sauvegarde

### 10.1 File de rejeu et synchronisation

| ID | Règle |
|---|---|
| R-SYNC-001 | Le système doit afficher l'état de connexion en permanence. |
| R-SYNC-002 | Une perte réseau ne doit pas bloquer les parcours critiques locaux. |
| R-SYNC-003 | Une action hors ligne doit créer une mutation locale (file de rejeu IndexedDB). |
| R-SYNC-004 | Une mutation locale doit avoir un identifiant unique. |
| R-SYNC-005 | Les mutations sont synchronisées dans l'ordre causal. |
| R-SYNC-006 | Une mutation déjà synchronisée ne doit pas être rejouée (idempotence). |
| R-SYNC-007 | Les données de sécurité sont synchronisées en priorité. |
| R-SYNC-008 | Les référentiels sont synchronisés avant les données métier dépendantes. |
| R-SYNC-009 | Les dossiers patients sont synchronisés avant les visites associées. |
| R-SYNC-010 | Les visites sont synchronisées avant les consultations associées. |
| R-SYNC-011 | Les consultations sont synchronisées avant les actes prescrits associés. |
| R-SYNC-012 | Un conflit détecté doit être journalisé. |
| R-SYNC-013 | Un conflit simple peut être résolu automatiquement selon règle documentée. |
| R-SYNC-014 | Un conflit complexe doit être soumis à résolution manuelle. |
| R-SYNC-015 | Une résolution manuelle doit indiquer auteur, date et justification. |
| R-SYNC-016 | Une file locale trop volumineuse déclenche une alerte. |
| R-SYNC-017 | Une désynchronisation prolongée déclenche une alerte. |
| R-SYNC-018 | Une synchronisation interrompue doit pouvoir reprendre au dernier accusé de réception connu. |
| R-SYNC-019 | Le journal de synchronisation doit rester consultable par l'administrateur système. |
| R-SYNC-020 | Les droits des utilisateurs en mode hors ligne sont ceux du dernier téléchargement connu. |
| R-SYNC-021 | L'accès hors ligne est limité aux données du site de rattachement de l'utilisateur. |
| R-SYNC-022 | Un utilisateur hors ligne ne peut pas accéder aux données des autres sites. |
| R-SYNC-023 | Les références croisées entre entités fonctionnent avec les UUIDs clients générés hors ligne. |
| R-SYNC-024 | Le cache des référentiels est valide pour une durée configurable (valeur par défaut : 24 heures). |
| R-SYNC-025 | Un référentiel expiré déclenche une alerte mais ne bloque pas le travail en cours. |
| R-SYNC-026 | La synchronisation démarre automatiquement dès la détection du retour de connexion (useSyncEngine). |
| R-SYNC-027 | La synchronisation peut être déclenchée manuellement. |
| R-SYNC-028 | Chaque mutation reçoit un accusé de réception serveur avant d'être marquée APPLIED. |
| R-SYNC-029 | Une mutation rejetée est marquée REJECTED avec le motif détaillé (format invalide, droits insuffisants, contrainte d'intégrité). |
| R-SYNC-030 | Après le PUSH des mutations, le PULL récupère les données distantes mises à jour, filtré par site et date de dernière synchronisation. |
| R-SYNC-031 | Un conflit SAME_FIELD est résolu par last-write-wins ; un conflit DIFFERENT_FIELDS est résolu par merge automatique. |
| R-SYNC-032 | La résolution d'un conflit est journalisée avec les valeurs avant et après. |
| R-SYNC-033 | La version d'une entité est incrémentée à chaque modification côté serveur et sert à détecter les modifications concurrentes. |
| R-SYNC-034 | L'historique des synchronisations est conservé au minimum 30 jours. |
| R-SYNC-035 | Une synchronisation échouée est retentée selon une stratégie de backoff ; le nombre maximal de tentatives est configurable. |
| R-SYNC-036 | L'état de synchronisation de chaque enregistrement modifié est visible pour l'utilisateur (chip TopHeader). |
| R-SYNC-037 | L'application est une PWA (vite-plugin-pwa / Workbox) : les ressources et les GET API sont mises en cache (NetworkFirst). |
| R-SYNC-038 | L'état du temps réel global (SSE) diffuse l'événement LIVE_SYNC lors des opérations de synchronisation. |

### 10.2 Sauvegarde et restauration de configuration

| ID | Règle |
|---|---|
| R-BCK-001 | La sauvegarde de configuration capture le contenu réel (contenuJson) des paramètres et référentiels système. |
| R-BCK-002 | Une sauvegarde est tracée (table SauvegardeSysteme) avec date, statut, déclencheur (manuel ou automatique) et volumétrie. |
| R-BCK-003 | Une sauvegarde automatique est exécutée par un cron quotidien à 02h00 (@nestjs/schedule). |
| R-BCK-004 | La rétention des sauvegardes est de 30 jours ; les sauvegardes plus anciennes sont purgées automatiquement. |
| R-BCK-005 | La restauration d'une sauvegarde est NON destructive : elle ré-applique la configuration sans effacer les données métier existantes. |
| R-BCK-006 | La restauration est réservée à l'administrateur système et journalisée dans le journal d'audit. |
| R-BCK-007 | L'écran de synchronisation présente trois zones : terrain hors ligne, sauvegardes de configuration, volumétrie. |

---

## 11. Messagerie interne chiffrée

> Module transversal réalisé. Conversations 1-1 et de groupe, pièces jointes chiffrées, notes vocales, réactions, accusés de lecture, présence, suppression à deux niveaux. Chiffrement AES-256-GCM au repos.

### 11.1 Chiffrement et clés

| ID | Règle |
|---|---|
| R-MSG-001 | Le contenu des messages est chiffré au repos en AES-256-GCM (node:crypto). |
| R-MSG-002 | Les pièces jointes sont chiffrées au repos selon le même algorithme. |
| R-MSG-003 | Les clés de chiffrement sont versionnées au format `v2:keyId` ; le format v1 historique reste déchiffrable en lecture. |
| R-MSG-004 | Les clés sont fournies via la variable MESSAGE_ENC_KEYS (avec une clé courante CURRENT) et peuvent être lues depuis un fichier (MESSAGE_ENC_KEYS_FILE) compatible avec un coffre de secrets (Vault-ready). |
| R-MSG-005 | Un outil de ré-encryption (endpoint POST /synchronisation/messagerie/rechiffrer) permet de migrer les messages v1 vers v2 de façon non destructive. |
| R-MSG-006 | La présence d'une clé de production faible ou par défaut déclenche un avertissement au démarrage. |

### 11.2 Conversations et participants

| ID | Règle |
|---|---|
| R-MSG-010 | Une conversation peut être individuelle (1-1) ou de groupe. |
| R-MSG-011 | Le nombre de participants d'un groupe est plafonné à 50. |
| R-MSG-012 | Une conversation et ses messages sont cloisonnés par site : un utilisateur ne peut pas accéder aux conversations d'un autre site (anti-IDOR cross-site). |
| R-MSG-013 | Un participant ne peut accéder qu'aux conversations dont il est membre. |
| R-MSG-014 | La suppression d'une conversation côté utilisateur s'effectue depuis la carte (menu) sans affecter les autres participants. |

### 11.3 Messages, édition et suppression

| ID | Règle |
|---|---|
| R-MSG-020 | Un message peut être modifié par son auteur dans une fenêtre de 15 minutes après l'envoi. |
| R-MSG-021 | Un message peut être supprimé pour tout le monde par son auteur dans une fenêtre de 15 minutes après l'envoi. |
| R-MSG-022 | La suppression « pour moi » est toujours possible et masque le message uniquement pour l'utilisateur courant (table MessageMasque). |
| R-MSG-023 | Au-delà de 15 minutes, un message ne peut plus être modifié ni supprimé pour tout le monde. |
| R-MSG-024 | Un message peut citer (répondre à) un message précédent. |
| R-MSG-025 | La suppression multiple de messages est possible. |
| R-MSG-026 | Les messages sont paginés et l'envoi est optimiste (affichage immédiat avant accusé serveur). |

### 11.4 Pièces jointes et médias

| ID | Règle |
|---|---|
| R-MSG-030 | Les pièces jointes acceptées sont de type image, vidéo, audio et document. |
| R-MSG-031 | La taille maximale par fichier est de 16 Mo, avec un maximum de 10 fichiers par message. |
| R-MSG-032 | Une vidéo est limitée à 2 minutes et 16 Mo ; au-delà, un rogneur intégré (ffmpeg.wasm) permet d'extraire un segment sans ré-encodage. |
| R-MSG-033 | Une image trop volumineuse est automatiquement compressée côté client avant envoi. |
| R-MSG-034 | Le type réel des fichiers est vérifié par signature binaire (magic-bytes) ; les exécutables sont refusés. |
| R-MSG-035 | Le nom de fichier est assaini (sanitize) avant stockage. |
| R-MSG-036 | Les notes vocales sont prises en charge comme pièce jointe audio. |
| R-MSG-037 | Un message peut regrouper plusieurs médias en album dans une seule bulle. |

### 11.5 Réactions, accusés et présence

| ID | Règle |
|---|---|
| R-MSG-040 | Un message peut recevoir des réactions emoji (ajout / retrait par bascule). |
| R-MSG-041 | Une réaction génère une notification à l'auteur du message. |
| R-MSG-042 | Les accusés de lecture comportent trois états : envoyé, remis, lu. |
| R-MSG-043 | Le marquage « lu » est instantané et propagé en temps réel (événement SSE MESSAGE_STATUS). |
| R-MSG-044 | La présence des utilisateurs (en ligne / vu à) est diffusée en temps réel (PresenceService via SSE, champ lastSeenAt). |
| R-MSG-045 | Un badge de messages non lus est affiché en temps réel dans la barre latérale. |
| R-MSG-046 | Les emojis sont rendus en jeu de symboles Apple à partir d'une planche locale (aucune dépendance à un CDN externe). |

### 11.6 Durcissement et sécurité

| ID | Règle |
|---|---|
| R-MSG-050 | L'envoi de messages est limité par un rate-limit de 40 requêtes par minute et par utilisateur. |
| R-MSG-051 | Toute requête de messagerie vérifie l'appartenance du demandeur à la conversation et son site (anti-IDOR). |
| R-MSG-052 | Les liens contenus dans les messages sont rendus cliquables après assainissement. |

---

## 12. Notifications temps réel

| ID | Règle |
|---|---|
| R-NOT-001 | Les notifications sont diffusées en temps réel via un flux SSE (stream serveur). |
| R-NOT-002 | Les événements temps réel invalident les caches react-query concernés (carte d'invalidations clinique). |
| R-NOT-003 | Les rafraîchissements « LIVE » des référentiels, acteurs et bons d'examen sont silencieux (sans notification visible). |
| R-NOT-004 | Une notification de type MESSAGE est émise à la réception d'un nouveau message, sans en exposer le contenu. |
| R-NOT-005 | Une notification est émise lorsqu'un message reçoit une réaction. |
| R-NOT-006 | Une notification peut être supprimée au survol, en sélection multiple, ou en totalité. |
| R-NOT-007 | La suppression « pour moi » d'une notification masque l'entrée pour l'utilisateur courant (table NotificationLecture, champ masque) sans la supprimer pour les autres destinataires. |
| R-NOT-008 | Des sons d'interface accompagnent les notifications, avec un réglage d'activation par utilisateur. |

---

## 13. Conditions générales d'utilisation (CGU)

| ID | Règle |
|---|---|
| R-CGU-001 | Les CGU sont versionnées (version courante v1-2026.06) et structurées en 7 sections. |
| R-CGU-002 | L'acceptation des CGU est tracée par utilisateur avec la date et la version acceptée. |
| R-CGU-003 | Une porte bloquante (CguGate, intégrée à l'AppShell) interdit l'accès à l'application tant que la version courante des CGU n'est pas acceptée. |
| R-CGU-004 | La publication d'une nouvelle version des CGU réimpose l'acceptation à tous les utilisateurs concernés. |
| R-CGU-005 | Les CGU sont consultables à la connexion et depuis les paramètres (ConditionsModal). |

---

## 14. Documents imprimables

| ID | Règle |
|---|---|
| R-DOC-001 | Les documents imprimables utilisent un gabarit A4 unifié (logo réel, fond de sécurité, rendu monochrome). |
| R-DOC-002 | Les documents disponibles sont : ordonnance, bon d'examen, fiche d'évacuation, fiche d'accident de travail, fiche de suivi, synthèse du dossier. |
| R-DOC-003 | L'aperçu du document est intégré dans la zone de droite de l'écran avant impression. |

---

## 15. Limites et extensions futures

| ID | Règle |
|---|---|
| R-EXT-001 | La gestion des stocks, la délivrance physique des médicaments et le réapprovisionnement sont des extensions futures. |
| R-EXT-002 | La transmission automatique CNSS et le reporting directionnel agrégé sont des extensions futures. |
| R-EXT-003 | Le planning, la présence et les absences du personnel (tables présentes) sont une extension future non encore exposée. |
| R-EXT-004 | Le suivi grossesse complet et l'internationalisation multilingue sont des extensions futures. |
| R-EXT-005 | Il n'existe pas, à ce stade, de suite de tests automatisés étendue ; la validation repose sur des contrôles E2E navigateur manuels, la vérification de types (tsc) et la compilation. La couverture de tests automatisés est une extension future. |
| R-EXT-006 | Le run de masse de la ré-encryption des messages (v1 → v2) n'a pas été exécuté ; il est prévu au moment d'une rotation de clé réelle. |
