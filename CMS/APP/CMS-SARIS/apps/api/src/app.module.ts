import { Module } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { ScheduleModule } from '@nestjs/schedule'
import { PrismaModule } from './prisma/prisma.module'
import { AuditInterceptor } from './common/interceptors/audit.interceptor'
import { SecurityModule }     from './modules/security/security.module'
import { ReferentielsModule } from './modules/referentiels/referentiels.module'
import { PersonnelModule }    from './modules/personnel/personnel.module'
import { PatientModule }      from './modules/patient/patient.module'
import { TriageModule }        from './modules/triage/triage.module'
import { ConsultationModule }  from './modules/consultation/consultation.module'
import { AdminModule }         from './modules/admin/admin.module'
import { BonExamenModule }     from './modules/bon-examen/bon-examen.module'
import { BonPharmacieModule }  from './modules/bon-pharmacie/bon-pharmacie.module'
import { EmployeModule }       from './modules/employe/employe.module'
import { SortiesCritiquesModule } from './modules/sorties-critiques/sorties-critiques.module'
import { DashboardModule }     from './modules/dashboard/dashboard.module'
import { NotificationModule }  from './modules/notification/notification.module'
import { MessagerieModule }    from './modules/messagerie/messagerie.module'
import { SyncModule }           from './modules/sync/sync.module'
import { HealthController }     from './health/health.controller'

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

    // Rate limiting global (100 requêtes / minute)
    // Le throttling strict du login sera appliqué dans SecurityModule
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60_000, // 1 minute en ms
        limit: 100,
      },
    ]),

    // Tâches planifiées (sauvegarde automatique quotidienne)
    ScheduleModule.forRoot(),

    // Accès Prisma (PrismaService) disponible dans tous les modules
    PrismaModule,

    // ── Modules métier (ajoutés au fur et à mesure) ───────────────────────
    SecurityModule,           // Module 1 ✅
    ReferentielsModule,       // Module 2 ✅
    PersonnelModule,          // Module 3 — Personnel médical ✅
    PatientModule,            // Module 4 — Dossier Patient ✅
    TriageModule,             // Module 6 — Accueil & Triage ✅
    ConsultationModule,       // Module 7 — Consultation & Actes ✅
    BonExamenModule,          // Module 7 bis — Bons d'examen ✅
    BonPharmacieModule,       // Module 7 ter — Bons de pharmacie (recueil) ✅
    EmployeModule,            // Registre des employés SARIS (main-d'œuvre patiente) ✅
    SortiesCritiquesModule,   // Module 8 — Évacuations ✅
    AdminModule,              // Administration système (utilisateurs, rôles, audit) ✅
    DashboardModule,          // Dashboard KPIs ✅
    NotificationModule,       // Notifications temps réel (cloche + SSE) ✅
    MessagerieModule,         // Messagerie interne chiffrée entre agents ✅
    SyncModule,               // Module 9 — Synchronisation offline-first ✅
  ],
  controllers: [HealthController],   // Sonde publique /health (liveness)
  providers: [
    // Journalisation d'audit GLOBALE des mutations sur les controllers @Audit(...).
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
