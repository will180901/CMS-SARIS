-- Suppression « pour moi » des notifications : drapeau par utilisateur sur NotificationLecture.
ALTER TABLE "NotificationLecture" ADD COLUMN "masque" BOOLEAN NOT NULL DEFAULT false;
