-- AlterTable
ALTER TABLE "PreferenceUtilisateur" ADD COLUMN     "notifApp" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "destinataireId" TEXT,
    "siteId" TEXT,
    "requiredPermission" TEXT,
    "type" TEXT NOT NULL,
    "niveau" TEXT NOT NULL DEFAULT 'INFO',
    "titre" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entiteType" TEXT,
    "entiteId" TEXT,
    "lien" TEXT,
    "createdById" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLecture" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLecture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_destinataireId_idx" ON "Notification"("destinataireId");

-- CreateIndex
CREATE INDEX "Notification_siteId_idx" ON "Notification"("siteId");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "NotificationLecture_utilisateurId_idx" ON "NotificationLecture"("utilisateurId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLecture_notificationId_utilisateurId_key" ON "NotificationLecture"("notificationId", "utilisateurId");

-- AddForeignKey
ALTER TABLE "NotificationLecture" ADD CONSTRAINT "NotificationLecture_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
