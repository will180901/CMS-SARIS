<!-- Fichier aligné sur Memoire_CMS_SARIS.docx le 24 août 2026. -->
<!-- Le document Word fait foi. Toute divergence est une erreur de ce fichier. -->

# Liste des abréviations et sigles

> **Vingt-cinq entrées.** Vérifié le 24 août 2026 : chaque sigle de cette liste est employé au moins une fois dans le mémoire, et aucun sigle du texte ne manque à la liste.

| Sigle | Signification |
|---|---|
| 2FA | Authentification à deux facteurs |
| 2TUP | Two-Track Unified Process |
| API | Interface de programmation applicative (Application Programming Interface) |
| BF | Besoin fonctionnel |
| BNF | Besoin non fonctionnel |
| CDD | Contrat à durée déterminée |
| CDI | Contrat à durée indéterminée |
| CFI | Centre de Formation en Informatique |
| CIRAS | Centre d'Informatique et de Recherche de l'Armée et de la Sécurité |
| CMS | Centre Médico-Sanitaire |
| GLA | Génie Logiciel Applicatif |
| HTTP | Protocole de transfert hypertexte |
| HTTPS | Protocole de transfert hypertexte sécurisé |
| IPC | Communication entre processus (Inter-Process Communication) |
| JSON | Format textuel d'échange de données (JavaScript Object Notation) |
| JWT | Jeton web signé (JSON Web Token) |
| ORM | Correspondance objet-relationnel (Object-Relational Mapping) |
| PWA | Application web installable (Progressive Web App) |
| REST | Style architectural des interfaces web (Representational State Transfer) |
| SARIS | Société Agricole de Raffinage Industriel du Sucre |
| SQL | Langage de requête structuré (Structured Query Language) |
| SSE | Flux d'événements du serveur vers le client (Server-Sent Events) |
| TOTP | Mot de passe à usage unique fondé sur le temps |
| UC | Cas d'utilisation (Use Case) |
| UML | Unified Modeling Language |

---

## Où chaque sigle technique est défini dans le mémoire

Règle appliquée : **un sigle n'entre dans cette liste que s'il est employé dans le texte**, et il est développé entre parenthèses à sa première apparition.

Relevé effectué le 24 août 2026 sur `apps/api/src`, `apps/web/src`, `apps/desktop/electron` et `packages`. **La copie du code API présente dans `apps/desktop/release/` est exclue** : c'est un artefact de compilation, la compter reviendrait à compter deux fois.

| Sigle | Première apparition | Preuve dans le code du projet |
|---|---|---|
| API | Ch. 3, le verrou de dossier | 77 emplois dans 43 fichiers |
| REST | Ch. 3, la thèse de Fielding | Les 273 routes de `INV-01`, réparties en GET 89 · POST 76 · PATCH 65 · DELETE 36 · PUT 2 |
| ORM | Ch. 7, l'architecture en couches | Prisma, couche d'accès aux données. ⚠️ Le sigle lui-même n'apparaît pas dans le code : c'est le terme standard pour ce que fait Prisma, et le mémoire écrivait déjà « correspondance objet-relationnel » |
| SQL | Ch. 7, l'architecture en couches | PostgreSQL et SQLite, les deux moteurs déclarés dans les schémas Prisma ; 21 emplois dans 9 fichiers |
| SSE | Ch. 7, le flux d'événements | 35 emplois dans 22 fichiers ; deux points d'entrée `@Sse` côté serveur — `notification.controller.ts:103` et `sync.controller.ts:86` — et 6 `EventSource` côté client |
| HTTP | Ch. 7, le diagramme de composants | 17 emplois dans 9 fichiers, plus les verbes des 273 routes |
| IPC | Ch. 7, le diagramme de composants | `ipcMain` 29, `ipcRenderer` 36, `contextBridge` 6 ; `contextIsolation: true` et `nodeIntegration: false` dans `electron/main.ts` |
| JSON | Ch. 8, la synthèse d'architecture | 82 emplois dans 23 fichiers |
| JWT | Ch. 8, la synthèse d'architecture | 49 emplois dans 24 fichiers ; paquets `@nestjs/jwt` et `passport-jwt` ; `JwtAuthGuard` sur toutes les routes protégées |
| PWA | Ch. 8, les trois canaux de diffusion | `vite-plugin-pwa` ; manifeste `display: standalone`, `registerType: autoUpdate`, service worker Workbox ; désactivé pour la version de bureau |

**BF, BNF et UC** ne s'emploient jamais seuls : ils apparaissent sous forme préfixée — BF21, BNF05, UC43 — exactement comme dans les tableaux 6.1 et 6.2. C'est un emploi légitime, qui justifie leur présence dans la liste.

**SGBD et IHM sont refusés.** Ni l'un ni l'autre n'apparaît dans le code du projet. Ce sont des sigles d'école : les employer donnerait au mémoire un vocabulaire que le système ne porte pas.

---

> 📌 **Correction du 24 août 2026.** Ce tableau annonçait d'abord « 281 décorateurs de route : 96 GET, 80 POST, 65 PATCH, 38 DELETE, 2 PUT ». Ce comptage était **faux sur deux points** : il incluait la copie dupliquée du code API dans `apps/desktop/release/`, et il comptait des décorateurs situés **dans des commentaires**. `INV-01` avait déjà instruit exactement cet écart (fiche E-01, une estimation antérieure à 273 ramenée à 268). Le chiffre qui fait foi est **273**, comme partout ailleurs dans le mémoire. Les autres relevés de ce tableau ont été refaits sur le même périmètre corrigé.
