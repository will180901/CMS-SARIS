import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { VitePWA } from "vite-plugin-pwa"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const apiUrl = env["VITE_API_URL"] ?? "http://localhost:3000"
  // Origine de l'API pour le cache runtime (lecture hors-ligne des GET déjà vus).
  let apiOrigin = "http://localhost:3000"
  try { apiOrigin = new URL(apiUrl).origin } catch { /* garde la valeur par défaut */ }

  // Build « desktop » (Electron, `--mode desktop`) : le frontend est chargé localement
  // via le schéma app:// → chemins RELATIFS, et PAS de service worker PWA (inutile et
  // source de conflits de cache hors navigateur).
  const isDesktop = mode === "desktop"

  return {
    base: isDesktop ? "./" : "/",
    plugins: [
      react(),
      tailwindcss(),
      ...(isDesktop ? [] : [VitePWA({
        registerType: "autoUpdate",
        injectRegister: "auto",
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
          // App shell : tout le bundle est pré-caché → l'application se charge
          // intégralement même sans réseau.
          globPatterns: ["**/*.{js,css,html,svg,woff,woff2,ttf,png,ico}"],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          // SPA : toute navigation inconnue retombe sur index.html (déjà pré-caché).
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/api/, /\/health$/],
          runtimeCaching: [
            {
              // Lecture des données API (GET) : réseau d'abord, repli sur le
              // dernier cache connu hors-ligne. Exclut /health, /auth et le flux SSE.
              urlPattern: ({ url, request }) =>
                url.origin === apiOrigin &&
                request.method === "GET" &&
                !url.pathname.startsWith("/health") &&
                !url.pathname.startsWith("/auth") &&
                !url.pathname.startsWith("/notifications/stream"),
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
