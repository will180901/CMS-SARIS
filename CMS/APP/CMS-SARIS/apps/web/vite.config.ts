import fs from "fs"
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { VitePWA } from "vite-plugin-pwa"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const apiUrl = env["VITE_API_URL"] ?? "http://localhost:3000"
  // Version affichée dans l'UI (Paramètres → À propos) : lue depuis package.json au
  // build, jamais dupliquée en dur — évite la dérive entre les deux.
  const pkgVersion = (JSON.parse(fs.readFileSync(path.resolve(__dirname, "package.json"), "utf-8")) as { version: string }).version
  // Origine de l'API pour le cache runtime (lecture hors-ligne des GET déjà vus).
  let apiOrigin = "http://localhost:3000"
  try { apiOrigin = new URL(apiUrl).origin } catch { /* garde la valeur par défaut */ }

  // Build « desktop » (Electron, `--mode desktop`) : le frontend est chargé localement
  // via le schéma app:// → chemins RELATIFS, et PAS de service worker PWA (inutile et
  // source de conflits de cache hors navigateur).
  const isDesktop = mode === "desktop"

  return {
    base: isDesktop ? "./" : "/",
    define: {
      __APP_VERSION__: JSON.stringify(pkgVersion),
    },
    plugins: [
      react(),
      tailwindcss(),
      ...(isDesktop ? [] : [VitePWA({
        registerType: "autoUpdate",
        injectRegister: "auto",
        // MISE A JOUR IMMEDIATE. Par defaut, un nouveau service worker ATTEND que TOUS les
        // onglets du site soient fermes avant de prendre la main : un simple rechargement,
        // meme force, continue de servir l'ancienne version. En pratique on deploie, on
        // recharge, on ne voit rien changer — et on conclut que le correctif n'a pas ete
        // fait. C'est arrive plusieurs fois.
        //
        //  fait prendre la main au nouveau worker sans attendre ; 
        // lui rattache les onglets deja ouverts. Le premier rechargement apres un deploiement
        // sert donc la nouvelle version.
        // PWA désactivée en dev (évite les surprises de cache pendant le HMR) ;
        // active dès qu'on build / preview.
        devOptions: { enabled: false },
        includeAssets: ["favicon.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png"],
        manifest: {
          name: "CMS SARIS — Centre médical",
          short_name: "CMS SARIS",
          description:
            "Système de gestion du centre médical SARIS — fonctionne hors-ligne.",
          lang: "fr",
          theme_color: "#4E8BA4",
          background_color: "#ffffff",
          display: "standalone",
          orientation: "portrait-primary",
          start_url: "/",
          scope: "/",
          icons: [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          // MISE A JOUR IMMEDIATE APRES DEPLOIEMENT.
          //
          // Par defaut, un nouveau service worker ATTEND que TOUS les onglets du site
          // soient fermes avant de prendre la main. Un rechargement, meme force, continue
          // donc de servir l'ancienne version : on deploie, on recharge, on ne voit rien
          // changer — et on en conclut que le correctif n'a pas ete fait. C'est arrive
          // plusieurs fois, sur les badges de site puis sur l'apercu des rapports.
          //
          // `skipWaiting` fait prendre la main au nouveau worker sans attendre ;
          // `clientsClaim` lui rattache les onglets deja ouverts. Le premier rechargement
          // apres un deploiement sert desormais la nouvelle version.
          //
          // Contrepartie assumee : un onglet reste ouvert pendant un deploiement peut voir
          // ses ressources changer sous lui. Pour cette application — interne, rechargee
          // souvent — c'est bien moins couteux que de croire un correctif absent.
          // (`clientsClaim` etait deja present plus bas : seul `skipWaiting` manquait,
          //  et c'est LUI qui evitait au nouveau worker d'attendre la fermeture des onglets.)
          skipWaiting: true,
          // App shell : tout le bundle est pré-caché → l'application se charge
          // intégralement même sans réseau.
          globPatterns: ["**/*.{js,css,html,svg,woff,woff2,ttf,png,ico}"],
          // Précache des gros assets offline-first : sprite emoji Apple (~4,4 Mo) +
          // bundle applicatif (~3 Mo). Défaut workbox = 2 Mio → build en échec sinon.
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          // SPA : toute navigation inconnue retombe sur index.html (déjà pré-caché).
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/api/, /\/health$/],
          runtimeCaching: [
            {
              // Lecture des données API (GET) : réseau d'abord, repli sur le
              // dernier cache connu hors-ligne. Exclut /health, /auth et le flux SSE.
              //
              // EXPRESSION REGULIERE, ET SURTOUT PAS UNE FONCTION.
              //
              // Workbox SERIALISE `urlPattern` en TEXTE dans sw.js. Une fonction qui
              // referencait `apiOrigin` — variable de ce fichier de configuration —
              // arrivait donc dans le worker sans cette variable :
              //
              //     sw.js  Uncaught ReferenceError: apiOrigin is not defined
              //
              // Et comme le routeur plante AVANT de repondre, le worker cassait TOUTE
              // requete : chargement des morceaux de code differes compris. L'application
              // paraissait alors morte — des boutons sans effet, un ecran qui ne change
              // pas — sans aucun rapport apparent avec le cache.
              //
              // Une expression reguliere, elle, se serialise litteralement : rien a
              // resoudre a l'execution, donc rien qui puisse manquer. Les exclusions
              // passent par une assertion negative, et le filtre GET par `method`.
              urlPattern: new RegExp(
                "^" +
                  apiOrigin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
                  "/(?!health|auth|notifications/stream)",
              ),
              method: "GET",
              handler: "NetworkFirst",
              options: {
                cacheName: "saris-api-get",
                networkTimeoutSeconds: 5,
                expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 7 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // Polices / images statiques.
              urlPattern: ({ request }) =>
                request.destination === "font" || request.destination === "image",
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "saris-assets",
                expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              // ffmpeg.wasm (cœur ~30 Mo + glue) : NON pré-caché (trop lourd),
              // mais mis en cache au 1er usage → découpe vidéo dispo hors-ligne ensuite.
              urlPattern: ({ url }) => url.pathname.includes("/ffmpeg/"),
              handler: "CacheFirst",
              options: {
                cacheName: "saris-ffmpeg",
                expiration: { maxEntries: 6, maxAgeSeconds: 60 * 60 * 24 * 180 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      })]),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // ffmpeg.wasm crée un Worker via `new URL(..., import.meta.url)` : on évite le
    // pré-bundling esbuild qui casserait la résolution du worker en dev.
    optimizeDeps: {
      exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
    },
  }
})
