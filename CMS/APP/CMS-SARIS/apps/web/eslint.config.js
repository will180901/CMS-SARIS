import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Règles issues du React Compiler (eslint-plugin-react-hooks v7) : le projet n'utilise PAS le compilateur,
      // elles ne protègent donc de rien qui s'exécute ; elles signalent des écritures que le compilateur
      // refuserait d'optimiser. Gardées en AVERTISSEMENTS (elles restent visibles) pour préparer une adoption
      // éventuelle, sans bloquer pour des motifs de code qui fonctionnent (ex. recopier une prop dans un état
      // local à son changement). `rules-of-hooks` et `exhaustive-deps`, eux, restent des erreurs.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/incompatible-library': 'warn',
      // Rechargement à chaud : un fichier qui exporte un composant ET autre chose se recharge en entier au lieu
      // d'être remplacé à chaud. Gêne de développement, pas de défaut du produit.
      'react-refresh/only-export-components': 'warn',
    },
  },
])
