# Checklist de mise en production (« déménagement ») — CMS SARIS

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Vivant · **Lié à** : [[modele_operationnel]], [[modele_menaces]], [[strategie_offline_sync]].

> État franc de la préparation au déploiement réel. Légende : ✅ fait · 🟡 partiel · 🔴 à faire (bloquant prod) · ⬜ à faire (non bloquant).

---

## A. Socle déjà en place (vérifié)
- ✅ **Base PostgreSQL Neon** : schéma migré (`migrate deploy`, migration `sync_schema_drift` incluse), `migrate diff` vide (schéma = code).
- ✅ **API NestJS sur Render** : `https://cms-saris-api.onrender.com` — `/health` + login admin prouvés en ligne.
- ✅ **Site web sur Render** : `https://cms-saris-web.onrender.com` (HTTP 200, PWA).
- ✅ **Code à jour poussé** (commit `d38c816`) : annonces de MAJ + badge connectivité → Render redéploie automatiquement.
- ✅ **Installeur desktop 1.4.1** baké sur l'URL Render + clés de prod + bouton « Télécharger et installer ».

## B. Bloquants AVANT une vraie production (🔴)
1. 🔴 **Plan Render payant (« Starter »)** pour l'API : le plan gratuit **met le service en veille** (~50 s au réveil) et **les tâches planifiées — dont la sauvegarde de config — ne s'exécutent pas pendant la veille**. Un central qui dort n'est pas fiable pour des postes qui synchronisent.
2. 🔴 **Signature de l'installeur desktop** (certificat OV/EV ou Azure Trusted Signing) : sans elle, Windows SmartScreen affiche « éditeur inconnu » et l'auto-update peut être refusé. Config déjà prête (commentée) dans `electron-builder.yml`.
3. 🔴 **Données réelles + comptes** : la base Neon contient des **données de démo** (patients fictifs, comptes `Saris2026!`, `admin`/`Admin123!`). Pour la prod : repartir d'une base propre (ou purger la démo), créer les vrais comptes, **changer tous les mots de passe**.
4. 🔴 **Régénérer les secrets de prod** (`JWT_SECRET`, `TOTP_ENC_KEY`, `MESSAGE_ENC_KEY`) **avant** tout enrôlement 2FA / message réel — et les **reporter à l'identique** dans Render ET dans le build desktop (sinon 2FA/messagerie indéchiffrables). ⚠️ Les secrets actuels ont servi au seed de démo.

## C. À valider en conditions réelles
- ✅ **Chemin de synchro du poste PROUVÉ (2026-06-26)** : backend embarqué SQLite démarré → **synchronisé 505 enregistrements depuis le central Render/Neon en ligne** (0 conflit) → **connexion locale réussie** (comptes synchronisés) → données servies. Le moteur du poste fonctionne contre le central réel.
5. 🟡 **Test multi-poste** : 2 postes desktop hors-ligne → modifications locales → reconnexion → réconciliation LWW + supervision des conflits (testé en labo 1 poste, pas 2 postes concurrents).
6. 🟡 **Flux desktop « Télécharger et installer » la MAJ** : codé + typé, **jamais exécuté sur l'app installée**. À tester une fois.
7. 🟡 **Coque Electron de l'installeur 1.4.1** : le **backend embarqué** est prouvé ; reste à lancer le **`.exe` installé** pour valider la fenêtre, la bascule en ligne/hors-ligne du renderer et l'écran de 1er lancement.
8. 🟡 **Sauvegarde / restauration** : définir la stratégie (Neon a une rétention limitée en gratuit ; le cron de sauvegarde de config nécessite l'API éveillée → cf. point 1).

## D. Procédure par poste (installation desktop)
- ⬜ Installer `CMS SARIS-Setup-1.4.1.exe` (cliquer au-delà de SmartScreen tant que non signé — cf. point 2).
- ⬜ Au 1er lancement : **écran de configuration** → saisir l'**URL centrale** (`https://cms-saris-api.onrender.com`) + un **compte de synchro** (admin ou compte dédié avec `synchronisation.read/execute`).
- ⬜ Attendre la 1ʳᵉ synchro (la base locale se remplit depuis le central), puis l'app s'ouvre.

## E. Le jour de la bascule (ordre conseillé)
1. ⬜ Régénérer les secrets de prod (point 4) → mettre à jour Render → **rebuild desktop** avec ces secrets + l'URL.
2. ⬜ Passer l'API Render en **Starter** (point 1).
3. ⬜ **Signer** l'installeur (point 2).
4. ⬜ Préparer la base : purge démo / vraies données / vrais comptes (point 3).
5. ⬜ Vérifier le redéploiement Render du dernier push (annonce + badge **Live**).
6. ⬜ Installer + configurer chaque poste (section D), tester un flux clinique complet + une synchro.
7. ⬜ Régulariser le dépôt (le `README.md` et d'anciens docs sont supprimés dans l'arbre de travail — à committer ou restaurer).

---

## Verdict
- **Soutenance / démo en ligne** : prêt (réveiller le serveur avant, le dernier push étant en cours de déploiement). ✅
- **Production réelle chez SARIS** : prêt **après B (1→4)** et un passage de C en vert. Tant que B n'est pas fait, ce n'est PAS un déploiement de production fiable.
