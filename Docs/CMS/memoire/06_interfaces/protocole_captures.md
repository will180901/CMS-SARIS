# Protocole de production des captures d'écran

> **Référencé par** : chapitre 8 § 8.3, figures 8.3 et suivantes.
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

Exemples : `Figure_8_3_connexion.png` · `Figure_8_4_tableau_bord_medecin.png` · `Figure_8_5_file_triage.png`

Format PNG. Ni recadrage partiel qui masquerait un défaut, ni retouche autre que le masquage des données sensibles.

## 6. Couverture minimale

Au moins une capture par module majeur.

| # | Écran | Rôle conseillé | Ce que la capture doit montrer |
|---|---|---|---|
| 8.3 | Connexion | — | L'écran initial, champs vides |
| 8.4 | Tableau de bord | Médecin chef | Indicateurs cliniques, menu complet |
| 8.5 | Tableau de bord | Infirmier | **Menu sans le groupe Administration** |
| 8.6 | File de triage | Infirmier | Ordre d'arrivée, deux panneaux |
| 8.7 | File de triage, rideau actif | Infirmier | Zones cliniques floutées |
| 8.8 | Dossier patient | Médecin chef | Sections, sous-onglets, badge de catégorie |
| 8.9 | Consultation | Médecin chef | Blocs cliniques, barre de clôture |
| 8.10 | Ordonnance et génération de bon | Médecin chef | Bouton de génération sur une ordonnance validée |
| 8.11 | **Refus d'éligibilité** | Médecin chef | **Le message de refus sur un patient non couvert** |
| 8.12 | Document imprimable | — | Aperçu A4 d'une ordonnance |
| 8.13 | Messagerie | — | Conversation, indicateur de saisie |
| 8.14 | Accès et habilitations | Administrateur | Matrice rôle × permission |
| 8.15 | Journal d'audit | Administrateur | Entrées, avec acteur et action |
| 8.16 | Supervision de la synchronisation | Administrateur | État des postes |

> **La capture 8.11 est la plus précieuse du mémoire.** Elle montre le système **refusant** une opération, avec un message qui nomme la catégorie et rappelle la règle. Un système qu'on ne voit jamais refuser ressemble à une maquette. Cette capture prouve que la règle centrale s'applique réellement.
>
> **Comment la produire** : ouvrir une consultation pour un patient de catégorie « riverain » ou « sous-traitant », créer une ordonnance pharmaceutique, la valider, puis demander la génération d'un bon.

## 7. Journal des captures

À tenir au fur et à mesure. Il constitue la preuve du respect du protocole.

| Figure | Écran | Rôle | Date | Masquages effectués | Rideau |
|---|---|---|---|---|---|
| 8.3 | | | | | |
| 8.4 | | | | | |
| … | | | | | |

## 8. Légende type

> **Figure 8.<n> — <Nom de la fonctionnalité>**
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
