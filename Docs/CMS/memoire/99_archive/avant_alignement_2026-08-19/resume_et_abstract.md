# Résumé et abstract

> Le plan officiel de l'école ne prévoit pas ces sections ; le modèle de mémoire les demande. **Décision D-01** : elles sont conservées, car elles valorisent le travail et permettent une lecture autonome.
> Contrainte : **150 à 200 mots** chacun, plus cinq mots-clés.

---

# RÉSUMÉ

*(187 mots)*

> Les centres de santé d'entreprise implantés en zone à connectivité intermittente rencontrent une difficulté structurelle : les outils informatiques classiques cessent de fonctionner dès que le réseau s'interrompt. Le Centre Médico-Sanitaire de SARIS-CONGO, réparti sur deux sites distants, gérait ses dossiers médicaux sur tableur et papier, sans dossier patient unique ni cohérence entre les sites, et appliquait de mémoire des règles de prise en charge différenciées selon la catégorie du patient.
>
> Ce mémoire présente la conception et la réalisation d'un système d'information médical répondant à ces contraintes. La démarche suit le processus 2TUP, qui traite séparément une branche fonctionnelle — parcours de soin, règles d'éligibilité, délégation de prescription — et une branche technique — persistance sur deux moteurs, réconciliation des données, protection des informations sensibles.
>
> Le système réalisé comporte 268 points d'accès, 88 entités de données et 128 permissions, déclinés en application web et en client de bureau, ce dernier pouvant embarquer son propre serveur et sa propre base pour fonctionner sans connexion. La continuité entre les deux sites est assurée par une réplication complète des dossiers et une résolution de conflit par dernière écriture. Les limites de validation sont explicitement énoncées.

**Mots-clés** : système d'information médical · offline-first · synchronisation de données · 2TUP · habilitations granulaires

---

# ABSTRACT

*(184 words)*

> Company health centres located in areas with intermittent connectivity face a structural difficulty: conventional software stops working as soon as the network goes down. The Medical Centre of SARIS-CONGO, spread across two remote sites, managed its medical records on spreadsheets and paper, with no unified patient record and no consistency between sites, and applied from memory a set of entitlement rules that differ according to patient category.
>
> This dissertation presents the design and implementation of a medical information system addressing these constraints. The approach follows the 2TUP process, which handles separately a functional track — care pathway, eligibility rules, prescription delegation — and a technical track — persistence across two database engines, data reconciliation, protection of sensitive information.
>
> The resulting system comprises 268 endpoints, 88 data entities and 128 permissions, delivered as a web application and a desktop client, the latter able to embed its own server and database in order to operate without connectivity. Continuity between the two sites is achieved through full replication of records and last-write-wins conflict resolution. Validation limitations are explicitly stated.

**Keywords**: medical information system · offline-first · data synchronisation · 2TUP · fine-grained permissions

---

## Contrôles

```
[ ] Résumé entre 150 et 200 mots — actuellement 187
[ ] Abstract entre 150 et 200 mots — actuellement 184
[ ] Les quatre éléments attendus sont présents : contexte, méthode, résultats, conclusion
[ ] Cinq mots-clés de chaque côté
[ ] L'abstract est une adaptation du résumé, non une traduction littérale
[ ] Aucun détail technique de bas niveau, aucun extrait de code
[ ] Les chiffres cités correspondent aux inventaires : 268, 88, 128
[ ] Chaque texte se lit de façon autonome
[ ] Les limites sont mentionnées — un résumé qui ne présente que des succès est suspect
```

## Note de traduction

L'abstract n'est pas une traduction mot à mot. Deux ajustements ont été faits pour l'usage anglophone : *« Centre Médico-Sanitaire »* est rendu par *« Medical Centre »*, plus lisible qu'un calque, et *« points d'accès »* par *« endpoints »*, terme standard dans la littérature technique anglophone.
