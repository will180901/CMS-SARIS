/**
 * Exécuté avant chaque fichier de test (setupFiles jest), AVANT l'import de l'application :
 * l'API se connecte à la base de test. ConfigModule ne remplace pas une variable déjà
 * définie par celle du fichier .env — la base de développement n'est donc jamais touchée.
 */
import { urlBaseTest } from './base-test'

process.env['DATABASE_URL'] = urlBaseTest()
process.env['NODE_ENV'] = 'test'
