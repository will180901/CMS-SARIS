# 📦 Installateur de bureau — CMS SARIS

Ce dossier contient l'**application de bureau (Windows)** de CMS SARIS, prête à installer.

| | |
|---|---|
| **Fichier** | `CMS SARIS-Local-Setup-1.4.1.exe` |
| **Version** | 1.4.1 |
| **Taille** | ~204 Mo |
| **Plateforme** | Windows 10 / 11 (64 bits) |
| **Suivi par** | **Git LFS** (le binaire dépasse la limite GitHub de 100 Mo) |

## ⬇️ Télécharger & installer

1. Ouvre `CMS SARIS-Local-Setup-1.4.1.exe` (bouton **Download** sur GitHub, ou double‑clic après un `git clone`).
2. ⚠️ Windows **SmartScreen** affichera un avertissement (« éditeur inconnu ») car l'installateur **n'est pas signé** (pas de certificat de signature de code). C'est normal pour ce projet : clique **« Informations complémentaires » → « Exécuter quand même »**.
3. Suis l'assistant d'installation.

## ℹ️ Ce que fait cette application

Application **offline‑first** (Electron) : elle embarque son propre backend + base SQLite, **fonctionne hors‑ligne**, et se **synchronise** avec le serveur central quand la connexion revient. Elle inclut : badge **En ligne / Hors ligne**, **annonces de mise à jour** (téléchargement + installation depuis l'app), messagerie chiffrée, et tout le parcours clinique.

## ⚠️ Build de DÉMONSTRATION

Cet installateur est une **démo de soutenance** :
- il pointe vers le **serveur central de démo** (Render) et embarque des **clés/secrets de démo** ;
- il ne contient **pas de données réelles de patients**.

Pour un **déploiement de production**, il faut : régénérer les secrets (`JWT_SECRET`, `TOTP_ENC_KEY`, `MESSAGE_ENC_KEY`), les poser sur le central de prod, puis **re‑builder** l'installateur avec ces clés (`pnpm --filter @cms-saris/desktop dist`). Le code source du desktop est dans `CMS/APP/CMS-SARIS/apps/desktop/`.

## 🔁 Reconstruire l'installateur

```powershell
cd "CMS/APP/CMS-SARIS"
pnpm install
pnpm --filter @cms-saris/desktop dist
# Sortie : apps/desktop/release/CMS SARIS-Setup-<version>.exe
```

*`latest.yml` (présent ici) est le manifeste de version généré par electron‑builder.*
