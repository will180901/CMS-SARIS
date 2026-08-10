# UML-SEQO-01 — Séquence objets : émission d'un bon de pharmacie

## Bloc 1 — Cartouche

```
Identifiant       : UML-SEQO-01
Figure du mémoire : Figure 7.3 — Diagramme de séquence objets : émission d'un bon de pharmacie
Chapitre / section: 7 — § 7.4.1
Type UML          : Diagramme de séquence (boîte blanche)
Sources de preuve : Route POST /consultations/:id/ordonnances/:ordId/generer-bon
                    ConsultationService.genererBonDepuisOrdonnance · garde d'éligibilité
Statut            : IMPLÉMENTÉ
Format conseillé  : A4 paysage — 7 lignes de vie
Densité           : 7 lignes de vie · 17 messages · 1 fragment alt
```

## Bloc 2 — Objectif et périmètre

**Ce que la figure doit démontrer.** Comment les objets internes collaborent, et surtout **où se situent les deux étages de contrôle** : la garde de permission d'abord, la règle métier ensuite. La séquence système (figure 6.5) ne peut pas le montrer — c'est précisément l'apport de cette planche.

**Correspondance avec la séquence système.** Cette figure est la version « boîte blanche » de la figure 6.5. Les messages M01 et M13 des deux figures se correspondent.

## Bloc 3 — Lignes de vie à dessiner

| N° | Libellé exact | Forme | Ordre, de gauche à droite |
|---|---|---|---|
| L1 | `Soignant` | Bonhomme-bâton | 1 |
| L2 | `: ConsultationController` | Rectangle | 2 |
| L3 | `: JwtAuthGuard` | Rectangle | 3 |
| L4 | `: PermissionsGuard` | Rectangle | 4 |
| L5 | `: ConsultationService` | Rectangle | 5 |
| L6 | `: DroitsCategorie` | Rectangle | 6 |
| L7 | `: PrismaService` | Rectangle | 7 |
| L8 | `: AuditInterceptor` | Rectangle | 8, à l'extrême droite |

> Les noms sont ceux des **classes réelles** du système. Ne pas les franciser : un jury qui ouvre le code doit les retrouver.

## Bloc 4 — Contenu des formes

Chaque rectangle contient exactement le libellé indiqué, deux points initiaux compris — convention UML désignant une instance anonyme de la classe.

## Bloc 5 — Messages à tracer

| N° | De | Vers | Message | Type |
|---:|---|---|---|---|
| M01 | `Soignant` | `: ConsultationController` | `POST …/generer-bon(idConsultation, idOrdonnance)` | appel |
| M02 | `: ConsultationController` | `: JwtAuthGuard` | `canActivate()` | appel |
| M03 | `: JwtAuthGuard` | `: ConsultationController` | `utilisateur résolu` | retour |
| M04 | `: ConsultationController` | `: PermissionsGuard` | `canActivate()` | appel |
| M05 | `: PermissionsGuard` | `: PermissionsGuard` | `vérifier bon_pharmacie.create OU bon_examen.create` | **auto-appel** |
| M06 | `: PermissionsGuard` | `: ConsultationController` | `autorisé` | retour |
| M07 | `: ConsultationController` | `: ConsultationService` | `genererBonDepuisOrdonnance(...)` | appel |
| M08 | `: ConsultationService` | `: PrismaService` | `lireOrdonnance(idOrdonnance)` | appel |
| M09 | `: PrismaService` | `: ConsultationService` | `ordonnance (type, statut, lignes)` | retour |
| M10 | `: ConsultationService` | `: ConsultationService` | `vérifier statut = VALIDEE et type = PHARMACEUTIQUE` | auto-appel |
| M11 | `: ConsultationService` | `: PrismaService` | `lireCatégorieDuPatient()` | appel |
| M12 | `: PrismaService` | `: ConsultationService` | `identifiant de catégorie` | retour |
| M13 | `: ConsultationService` | `: DroitsCategorie` | `assertPrestationCouverte(catégorie, « MEDICAMENT »)` | **appel — point focal** |
| M14 | `: DroitsCategorie` | `: PrismaService` | `chercherDroit(catégorie, prestation, couvert = vrai)` | appel |
| M15 | `: PrismaService` | `: DroitsCategorie` | `droit trouvé ou absent` | retour |

### Fragment `alt` — Résultat du contrôle d'éligibilité

**Branche A — `[droit absent]`**

| N° | De | Vers | Message | Type |
|---:|---|---|---|---|
| M16 | `: DroitsCategorie` | `: PrismaService` | `lireLibelléDeLaCatégorie()` | appel |
| M17 | `: DroitsCategorie` | `: ConsultationService` | **`ForbiddenException` (message nommant la catégorie)** | **retour d'exception, trait pointillé rouge ou épais** |
| M18 | `: ConsultationService` | `: Soignant` | `403 — refus motivé` | retour |

Terminer la branche par une **croix** sur la ligne de vie du service : la transaction n'a pas lieu.

**Branche B — `[droit présent]`**

| N° | De | Vers | Message | Type |
|---:|---|---|---|---|
| M19 | `: DroitsCategorie` | `: ConsultationService` | `autorisé` | retour |
| M20 | `: ConsultationService` | `: PrismaService` | `transaction : créerBonPharmacie(EN_ATTENTE) + créerLignes()` | appel |
| M21 | `: PrismaService` | `: ConsultationService` | `bon créé` | retour |
| M22 | `: ConsultationService` | `: ConsultationController` | `bon` | retour |
| M23 | `: ConsultationController` | `: AuditInterceptor` | *(interception automatique de la mutation)* | **appel implicite, trait pointillé** |
| M24 | `: AuditInterceptor` | `: PrismaService` | `écrireJournalAudit(auteur, action, entité, IP)` | appel |
| M25 | `: ConsultationController` | `Soignant` | `201 — bon créé` | retour |

### Notes obligatoires

| Attachée à | Texte |
|---|---|
| M05 | *« Étage 1 : la permission ouvre la porte. »* |
| M13 | *« Étage 2 : la règle métier autorise l'acte. Un agent parfaitement autorisé est refusé si le patient n'ouvre pas droit. »* |
| M20 | *« Transaction unique : le bon et ses lignes sont créés ensemble, ou pas du tout. »* |
| M23 | *« L'audit est déclenché par un intercepteur global, jamais appelé par le service. C'est ce qui rend le journal infalsifiable par l'API. »* |

## Bloc 6 — Plan de placement

Huit lignes de vie verticales, réparties sur toute la largeur de la planche, dans l'ordre du bloc 3.

**Bandes horizontales, de haut en bas :**

1. **Sécurité** — M01 à M06. Concerne les lignes de vie 1 à 4.
2. **Lecture** — M07 à M12. Concerne les lignes de vie 2, 5, 7.
3. **Contrôle métier** — M13 à M15, puis le fragment `alt`. **Concerne les lignes de vie 5, 6, 7. C'est le cœur de la figure : lui donner le plus d'espace vertical.**
4. **Écriture et audit** — M20 à M25.

**Règles de tracé :**
- Les barres d'activation doivent être visibles : elles montrent que le contrôleur reste actif pendant tout l'appel du service.
- Le fragment `alt` englobe les lignes de vie 1, 5, 6 et 7.
- La branche A est **au-dessus** de la branche B.
- M17 est un **retour d'exception** : trait pointillé plus épais, ou en couleur, avec le nom de l'exception écrit.
- M23 est un **appel implicite** : trait pointillé, annoté *« intercepté »*.
- Les quatre bulles de note se placent à gauche ou à droite selon la place, sans masquer les messages.

## Bloc 7 — Conventions et légende

| Élément | Convention |
|---|---|
| Ligne de vie | Rectangle nommé `: NomDeClasse`, trait vertical pointillé |
| Appel | Flèche pleine, tête pleine |
| Retour | Flèche pointillée, tête ouverte |
| Retour d'exception | Flèche pointillée épaisse, nom de l'exception |
| Auto-appel | Boucle sur la ligne de vie |
| Barre d'activation | Rectangle étroit sur la ligne de vie |
| Interception | Trait pointillé annoté |

**Légende à reproduire :**

> **Figure 7.3 — Diagramme de séquence objets : émission d'un bon de pharmacie**
> Version boîte blanche de la figure 6.5. Les deux étages de contrôle apparaissent : la garde de permission, puis la règle métier d'éligibilité.
> *Source : conception propre.*

## Bloc 8 — Contrôles après dessin

```
[ ] Les 8 lignes de vie sont présentes, dans l'ordre du bloc 3
[ ] Les noms de classes sont ceux du code, non traduits
[ ] Les 25 messages sont tracés dans l'ordre
[ ] Les gardes précèdent le service — jamais l'inverse
[ ] Le fragment alt comporte ses deux gardes entre crochets
[ ] La branche de refus se termine par une croix
[ ] M17 est visuellement distinct : c'est une exception
[ ] M23 est en pointillés et annoté « intercepté »
[ ] Les 4 notes obligatoires sont présentes
[ ] Les barres d'activation sont tracées
[ ] Nulle part le service n'appelle directement l'audit
```

## Vérification finale

| Point | Source |
|---|---|
| Route et méthode réelles | INV-01, contrôleur de consultation |
| Permissions exigées : l'une ou l'autre | INV-01, deux permissions en mode « au moins une » |
| Le service appelle bien la garde d'éligibilité | Service de consultation, génération de bon |
| Le message d'exception nomme la catégorie | Texte de l'exception |
| L'audit passe par un intercepteur global | INV-01 § 5.3 |
