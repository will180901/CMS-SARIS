import { Module } from '@nestjs/common'
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { ScheduleModule } from '@nestjs/schedule'
import { PrismaModule } from './prisma/prisma.module'
import { AuditInterceptor } from './common/interceptors/audit.interceptor'
import { SecurityModule } from './modules/security/security.module'
import { ReferentielsModule } from './modules/referentiels/referentiels.module'
import { PersonnelModule } from './modules/personnel/personnel.module'
import { PatientModule } from './modules/patient/patient.module'
import { TriageModule } from './modules/triage/triage.module'
import { ConsultationModule } from './modules/consultation/consultation.module'
import { AdminModule } from './modules/admin/admin.module'
import { BonExamenModule } from './modules/bon-examen/bon-examen.module'
import { BonPharmacieModule } from './modules/bon-pharmacie/bon-pharmacie.module'
import { EmployeModule } from './modules/employe/employe.module'
import { SortiesCritiquesModule } from './modules/sorties-critiques/sorties-critiques.module'
import { SuiviTraitementModule } from './modules/suivi-traitement/suivi-traitement.module'
import { DashboardModule } from './modules/dashboard/dashboard.module'
import { RapportsModule } from './modules/rapports/rapports.module'
import { NotificationModule } from './modules/notification/notification.module'
import { MessagerieModule } from './modules/messagerie/messagerie.module'
import { SyncModule } from './modules/sync/sync.module'
import { HealthController } from './health/health.controller'

/**
 * AppModule — module racine du monolithe NestJS CMS SARIS.
 *
 * Convention d'ajout :
 *   - Chaque module métier (SecurityModule, PatientsModule, etc.)
 *     est importé ici au fur et à mesure du développement.
 *   - Toujours placer ConfigModule et ThrottlerModule en premier.
 */
@Module({
  imports: [
    // Variables d'environnement (.env) disponibles globalement via ConfigService
    ConfigModule.forRoot({ isGlobal: true }),

    // Rate limiting global (100 requêtes / minute par IP), appliqué à TOUS les
    // endpoints via APP_GUARD ci-dessous. Nommé 'default' : c'est le nom que
    // @nestjs/throttler attend pour que @Throttle({ default: {...} }) (utilisé sur
    // les routes /auth/* et messagerie pour resserrer/desserrer la limite par route)
    // s'applique réellement — un autre nom rendrait ces surcharges silencieusement
    // inertes (elles ne matcheraient aucun throttler enregistré).
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000, // 1 minute en ms
        limit: 100,
      },
    ]),

    // Tâches planifiées (sauvegarde automatique quotidienne)
    ScheduleModule.forRoot(),

    // Accès Prisma (PrismaService) disponible dans tous les modules
    PrismaModule,

    // ── Modules métier (ajoutés au fur et à mesure) ───────────────────────
    SecurityModule, // Module 1 ✅
    ReferentielsModule, // Module 2 ✅
    PersonnelModule, // Module 3 — Personnel médical ✅
    PatientModule, // Module 4 — Dossier Patient ✅
    TriageModule, // Module 6 — Accueil & Triage ✅
    ConsultationModule, // Module 7 — Consultation & Actes ✅
    BonExamenModule, // Module 7 bis — Bons d'examen ✅
    BonPharmacieModule, // Module 7 ter — Bons de pharmacie (recueil) ✅
    EmployeModule, // Registre des employés SARIS (main-d'œuvre patiente) ✅
    SortiesCritiquesModule, // Module 8 — Évacuations ✅
    SuiviTraitementModule, // Suivi de traitement (contrôle d'état de santé) ✅
    AdminModule, // Administration système (utilisateurs, rôles, audit) ✅
    DashboardModule, // Dashboard KPIs ✅
    RapportsModule, // Rapports statistiques planifiés (recueil §6.1) ✅
    NotificationModule, // Notifications temps réel (cloche + SSE) ✅
    MessagerieModule, // Messagerie interne chiffrée entre agents ✅
    SyncModule, // Module 9 — Synchronisation offline-first ✅
  ],
  controllers: [HealthController], // Sonde publique /health (liveness)
  providers: [
    // Journalisation d'audit GLOBALE des mutations sur les controllers @Audit(...).
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    // Rate limiting GLOBAL — sans ce provider, ThrottlerModule.forRoot() ci-dessus
    // ne fait que déclarer la config : rien ne l'applique aux endpoints qui n'ont
    // pas leur propre @UseGuards(ThrottlerGuard). Avec APP_GUARD, tous les endpoints
    // héritent du plafond 'default' (100/min), personnalisable par route via
    // @Throttle({ default: {...} }) ou désactivable via @SkipThrottle().
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
