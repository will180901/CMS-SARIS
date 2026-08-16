# ANNEXE E — Extraits de code source commentés

> **Objet** : illustrer la qualité technique de la réalisation par des extraits représentatifs.
> **Règle absolue** : aucun secret, aucune clé, aucune chaîne de connexion, aucune donnée patient. Tous les extraits ci-dessous ont été vérifiés sur ce point.
> **Langage** : TypeScript. **Présentation** : police à chasse fixe.

---

## Extrait n° 1 — La règle d'éligibilité par catégorie de patient

**Module** : utilitaire transverse de l'interface de programmation · **Rôle** : garde métier centrale du système.

C'est la fonction la plus importante du projet au regard du métier. Elle détermine si un patient ouvre droit à une prestation, et elle est appelée par tous les services qui émettent un bon.

```typescript
/**
 * Droits par catégorie de patient — règle centrale du recueil de l'existant.
 *
 * Certaines prestations ne sont couvertes que pour certaines catégories :
 *  - CONSULTATION + PREMIERS_SOINS : TOUTES les catégories.
 *  - MEDICAMENT (bon de pharmacie) + EXAMEN (bon d'examens) : UNIQUEMENT le personnel
 *    CDI et ses ayants droit (prise en charge complète).
 *
 * La matrice est portée par la table `DroitCategoriePatient` (peuplée par le seed).
 * Convention : autorisé s'il existe une ligne (catégorie, prestation) avec couvert=true.
 */
export async function assertPrestationCouverte(
  prisma: PrismaService,
  categorieId: string,
  typePrestation: TypePrestation,
): Promise<void> {
  const droit = await prisma.droitCategoriePatient.findFirst({
    where: { categorieId, typePrestation, couvert: true },
    select: { id: true },
  })
  if (droit) return                       // couverture trouvée → l'acte est autorisé

  // Refus : le message NOMME la catégorie et rappelle la règle, pour que l'agent
  // comprenne pourquoi et n'ait pas à deviner.
  const cat = await prisma.categoriePatient.findUnique({
    where: { id: categorieId },
    select: { libelle: true },
  })
  const libelle = cat?.libelle ?? 'cette catégorie'
  throw new ForbiddenException(
    `La catégorie « ${libelle} » n'ouvre pas droit ${quoi} — ` +
    `réservé au personnel CDI et à leurs ayants droit.`,
  )
}
```

**Trois points à commenter en soutenance.**

La règle n'est pas écrite en dur : elle est **lue dans une table**. Une politique d'entreprise peut évoluer sans redéploiement.

La convention est **positive** : autorisé s'il existe une ligne de couverture. Une catégorie inconnue est donc refusée par défaut — comportement sûr.

Le message de refus **nomme la catégorie**. Un refus qu'on ne comprend pas est un refus qu'on contourne.

---

## Extrait n° 2 — Le contrôle de prescription à deux étages

**Module** : utilitaire transverse · **Rôle** : distinguer le droit d'agir de l'autorisation d'agir.

```typescript
/**
 * Garde de prescription — règle du recueil de l'existant.
 *
 *  - MEDECIN_CHEF / ADMIN_SYSTEME : prescrivent librement.
 *  - INFIRMIER : autorisé UNIQUEMENT s'il dispose d'une DÉLÉGATION ACTIVE,
 *    accordée par un médecin chef et couvrant la date du jour.
 *
 * Retourne l'id de la délégation utilisée (pour tracer Ordonnance.delegationId).
 */
export async function assertPeutPrescrire(
  prisma: PrismaService,
  scope: PrescriptionScope,
): Promise<string | null> {
  const roles = scope.roles ?? []

  // Prescription libre : aucune délégation à tracer.
  if (roles.includes('MEDECIN_CHEF') || roles.includes('ADMIN_SYSTEME')) return null

  if (roles.includes('INFIRMIER')) {
    if (!scope.personnelMedicalId) {
      throw new ForbiddenException(
        'Prescription réservée au médecin chef ou à un infirmier délégué.',
      )
    }
    const now = new Date()
    const deleg = await prisma.delegationPrescription.findFirst({
      where: {
        infirmierId: scope.personnelMedicalId,
        statut: 'ACTIVE',
        dateDebut: { lte: now },        // délégation commencée
        dateFin:   { gte: now },        // et non expirée
        deletedAt: null,                // et non supprimée
      },
      select: { id: true },
    })
    if (!deleg) {
      throw new ForbiddenException(
        "Vous devez disposer d'une délégation de prescription active " +
        "(accordée par le médecin chef) pour prescrire.",
      )
    }
    return deleg.id                     // tracé sur l'ordonnance → responsabilité imputable
  }

  throw new ForbiddenException("Vous n'êtes pas autorisé à prescrire.")
}
```

**Ce qu'il faut retenir.** L'infirmier **possède** la permission de créer une ordonnance : le garde d'autorisation le laisse passer. C'est le **service** qui refuse, faute de délégation. Un diagramme qui ne montrerait que la garde décrirait un système plus permissif qu'il ne l'est.

L'identifiant de la délégation est **retourné puis enregistré** sur l'ordonnance : on peut établir après coup sous quelle délégation un acte a été prescrit.

---

## Extrait n° 3 — La résolution de conflit de synchronisation

**Module** : paquet de types partagés · **Rôle** : arbitrer entre deux versions concurrentes.

Reproduit au chapitre 8 § 8.2.3. Rappelé ici pour l'exhaustivité de l'annexe.

**Caractéristique déterminante** : la fonction est **pure** — aucune entrée-sortie, aucune dépendance, déterministe. Elle est donc testable unitairement (17 cas) et réutilisable à l'identique par le serveur central et par le poste autonome. C'est ce qui garantit que les deux extrémités de la synchronisation arbitrent exactement de la même façon.

---

## Extrait n° 4 — Une portabilité qui ne va pas de soi

**Module** : utilitaire d'accès aux données · **Rôle** : rendre une requête exécutable sur deux moteurs.

```typescript
/**
 * Recherche insensible à la casse — compatible PostgreSQL (serveur) ET SQLite
 * (backend embarqué desktop).
 *
 * `mode: 'insensitive'` est une option PostgreSQL-ONLY : le moteur SQLite la REJETTE
 * (« Unknown argument `mode` »). Or SQLite fait déjà un `LIKE` insensible à la casse
 * (ASCII) par défaut. On injecte donc `mode: 'insensitive'` uniquement hors SQLite.
 */
export const CI: { mode?: 'insensitive' } =
  process.env['DATABASE_PROVIDER'] === 'sqlite' ? {} : { mode: 'insensitive' }
```

**Pourquoi cet extrait mérite sa place.** Il tient en trois lignes et illustre le coût réel de la portabilité entre deux moteurs. Sans cette précaution, **toute recherche ferait échouer le poste autonome** — c'est-à-dire précisément le mode qui devait garantir la continuité de service.

Ce genre de détail ne se découvre pas à la conception. Il se découvre à l'exécution.

---

## Extrait n° 5 — La cascade de suppression, faite explicitement

**Module** : utilitaire du module de consultation · **Rôle** : supprimer une consultation et tout ce qui en dépend.

```typescript
/**
 * Construit la liste des opérations de suppression en cascade d'UNE consultation
 * (lignes → documents → diagnostics), dans l'ordre de dépendance des clés
 * étrangères (aucune des relations documentaires n'a de `onDelete: Cascade` en
 * base — la cascade doit être faite explicitement, dans la même transaction que
 * la suppression de la consultation elle-même).
 *
 * Partagé entre ConsultationService.delete et TriageService.deleteVisite — pour
 * ne jamais faire diverger cette logique destructrice entre deux copies.
 */
export function consultationCascadeDeleteOps(
  prisma: PrismaClient,
  consultationId: string,
): Prisma.PrismaPromise<unknown>[] {
  const where = { consultationId }
  return [
    prisma.ligneOrdonnance.deleteMany({ where: { ordonnance: where } }),
    prisma.ordonnance.deleteMany({ where }),
    prisma.ligneExamen.deleteMany({ where: { bon: where } }),
    prisma.resultatExamen.deleteMany({ where: { bon: where } }),
    prisma.bonExamen.deleteMany({ where }),
    prisma.ligneBonPharmacie.deleteMany({ where: { bon: where } }),
    prisma.bonPharmacie.deleteMany({ where }),
    prisma.suiviEvacuation.deleteMany({ where: { evacuation: where } }),
    prisma.evacuation.deleteMany({ where }),
    // … fiches de suivi de traitement, diagnostics
  ]
}
```

**Deux enseignements.** L'ordre n'est pas arbitraire : il suit la dépendance des clés étrangères, des enfants vers les parents. Inverser deux lignes produirait une violation d'intégrité.

Et la fonction est **partagée** entre deux points d'appel — supprimer une consultation, supprimer une visite qui en contient. Le commentaire dit pourquoi : *pour ne jamais faire diverger cette logique destructrice entre deux copies*. C'est une décision de conception motivée par le risque, non par l'élégance.

---

## Vérification de sûreté

```
[ ] Aucun mot de passe, aucune clé de chiffrement
[ ] Aucune chaîne de connexion, aucun nom d'hôte de production
[ ] Aucune donnée patient, même fictive et plausible
[ ] Aucun jeton, aucun secret
[ ] Les extraits sont reproduits fidèlement, sans réécriture embellissante
[ ] Chaque extrait indique son module et son rôle
[ ] Chaque extrait est suivi d'un commentaire d'analyse
```

## Choix des extraits — justification

Ces cinq extraits ont été retenus parce qu'ils couvrent, ensemble, les quatre dimensions du travail : la **règle métier** (extraits 1 et 2), l'**algorithme** (extrait 3), la **portabilité** (extrait 4) et la **rigueur d'implémentation** (extrait 5). Aucun ne dépasse trente lignes ; tous sont commentés dans le code d'origine.

Si un seul devait être conservé dans le corps du mémoire, ce serait le **troisième** — il porte le mécanisme le plus original du système. C'est celui qui figure au chapitre 8.
