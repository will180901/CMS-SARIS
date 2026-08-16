# Protocole de production des captures d'écran

> **Référencé par** : chapitre 8 § 8.3 — figures **8.3, 8.4 et 8.5**.
> **Trois captures, pas une de plus.** Le mémoire a été ramené de 24 illustrations à 15 ; trois seulement sont des captures d'écran.
> **Règle absolue** : une capture est une **preuve**. Elle montre le système tel qu'il est, jamais tel qu'on voudrait qu'il soit.

---

## 1. Préparation de l'environnement

```bash
pnpm install
```

```bash
powershell -ExecutionPolicy Bypass -File .\setup-db.ps1
```

```bash
pnpm --filter api start:dev
```

```bash
pnpm --filter web dev
```

L'application est alors accessible en local. Les identifiants du jeu de démonstration figurent dans le fichier de description du projet ; **ils ne doivent jamais apparaître dans le mémoire**.

## 2. Règles de contenu — non négociables

| # | Règle | Motif |
|---|---|---|
| R1 | **Jeu de données de démonstration uniquement** | Aucune donnée réelle de patient ne doit sortir du centre |
| R2 | **Vérifier les noms du jeu de démonstration** | S'ils correspondent à des personnes réelles, les remplacer avant capture — QO-12 |
| R3 | **Ne jamais illustrer une fonction non implémentée** | Une capture d'un écran incomplet présenté comme achevé est une falsification |
| R4 | Ne jamais afficher un champ de mot de passe rempli | Même masqué |
| R5 | Masquer jetons, adresses IP réelles, matricules réels, clés | Avant insertion dans le document |
| R6 | Une seule fonctionnalité par capture | Une capture qui montre tout ne montre rien |

## 3. Réglages avant capture

| Paramètre | Valeur |
|---|---|
| Thème | Clair — meilleur rendu à l'impression |
| Langue | Français |
| Largeur de fenêtre | 1440 pixels au minimum |
| Zoom du navigateur | 100 % |
| **Rideau de confidentialité** | **Désactivé**, et le signaler en légende |
| Notifications système | Désactivées, pour éviter les fenêtres intruses |

> ⚠️ **Sur le rideau de confidentialité.** Il floute les zones cliniques par défaut. Le désactiver pour la capture est légitime — sinon on ne voit rien — mais **doit être mentionné en légende**, sans quoi la capture donne une image fausse du comportement réel du système.
>
> **Recommandation** : produire **une capture supplémentaire avec le rideau actif**, en regard de la capture de l'écran de triage. La comparaison est plus démonstrative que n'importe quelle description.

## 4. Le rôle est une information, pas un détail

L'interface **change selon le rôle**. Chaque capture doit indiquer sous quel rôle elle a été prise.

**Trois captures s'imposent en regard** pour le tableau de bord et le menu latéral : une par rôle. C'est la démonstration la plus directe de l'adaptation par profil, et elle ne coûte que deux captures de plus.

## 5. Nommage et rangement

```
06_interfaces/captures/Figure_8_<n>_<sujet>.png
```

Les trois noms attendus : `Figure_8_3_consultation.png` · `Figure_8_4_bon_pharmacie.png` · `Figure_8_5_tableau_bord_audit.png`

Format PNG. Ni recadrage partiel qui masquerait un défaut, ni retouche autre que le masquage des données sensibles.

## 6. Les trois captures à produire

Le mémoire en retient trois, choisies pour couvrir les trois rôles et les trois moments qui portent le sens du système : l'acte clinique, la règle métier, et la supervision.

| Figure | Écran | Rôle | Ce que la capture doit montrer |
|---|---|---|---|
| **8.3** | Consultation en cours | Médecin Chef | L'examen clinique et les diagnostics saisis, la barre de clôture visible |
| **8.4** | Émission d'un bon de pharmacie | Infirmier | Le contrôle d'éligibilité par catégorie de patient, à l'œuvre |
| **8.5** | Tableau de bord et journal d'audit | Administrateur système | Les indicateurs, puis les entrées du journal avec acteur et action |

> **La 8.4 est la plus précieuse des trois.** Si tu peux la produire sur un patient **non couvert**, elle montre le système en train de **refuser** une opération, avec un message qui nomme la catégorie et rappelle la règle. Un système qu'on ne voit jamais refuser ressemble à une maquette ; celui-là prouve que sa règle centrale s'applique vraiment.
>
> **Comment l'obtenir** : ouvrir une consultation pour un patient de catégorie « riverain » ou « sous-traitant », créer une ordonnance pharmaceutique, la valider, puis demander la génération du bon.

## 7. Journal des captures

À remplir au fur et à mesure. Il constitue la preuve du respect du protocole.

| Figure | Écran | Rôle | Date | Masquages effectués | Rideau |
|---|---|---|---|---|---|
| 8.3 | Consultation en cours | Médecin Chef | | | |
| 8.4 | Bon de pharmacie | Infirmier | | | |
| 8.5 | Tableau de bord et audit | Administrateur système | | | |

## 8. Légende type

> **Figure 8.<n> — <Libellé exact repris du mémoire>**
> Capture prise sous le rôle <rôle>, sur le jeu de données de démonstration. <Mention du rideau de confidentialité si désactivé.>
> *Source : capture de l'application CMS SARIS, <date>.*

## 9. Contrôles avant insertion

```
[ ] Aucune donnée réelle de patient
[ ] Aucun mot de passe visible, même masqué
[ ] Aucun jeton, aucune clé, aucune adresse IP réelle
[ ] Aucune fenêtre système ou notification intruse
[ ] Le rôle est indiqué en légende
[ ] Le rideau de confidentialité est signalé s'il est désactivé
[ ] La capture est lisible imprimée en noir et blanc
[ ] La fonctionnalité montrée est bien marquée IMPLÉMENTÉE aux inventaires
[ ] Le nom du fichier suit la convention
[ ] Le journal des captures est renseigné
```
