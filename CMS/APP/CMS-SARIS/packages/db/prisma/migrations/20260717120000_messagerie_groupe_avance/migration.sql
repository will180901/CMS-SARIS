-- Messagerie de groupe façon WhatsApp : photo/description de groupe, rôle
-- admin par participant, silencieux par conversation, messages système,
-- épinglage et transfert de message.

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "description" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "photoUrl" TEXT;

-- AlterTable
ALTER TABLE "ConversationParticipant" ADD COLUMN "estAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ConversationParticipant" ADD COLUMN "muted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'TEXTE';
ALTER TABLE "Message" ADD COLUMN "epingle" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Message" ADD COLUMN "transfere" BOOLEAN NOT NULL DEFAULT false;
