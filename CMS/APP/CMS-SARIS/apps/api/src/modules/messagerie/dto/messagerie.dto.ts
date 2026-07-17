import {
  IsString, IsNotEmpty, IsUUID, MaxLength, IsOptional, IsArray, ArrayMinSize, ArrayMaxSize, IsBoolean,
} from 'class-validator'
import { Transform } from 'class-transformer'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)

export class StartConversationDto {
  @IsUUID()
  destinataireId!: string
}

export class CreateGroupDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Le titre du groupe est requis' })
  @MaxLength(120)
  titre!: string

  @IsArray()
  @ArrayMinSize(1, { message: 'Sélectionnez au moins un participant' })
  @ArrayMaxSize(50, { message: 'Un groupe est limité à 50 participants' })
  @IsUUID('all', { each: true })
  participantIds!: string[]
}

export class SendMessageDto {
  // Optionnel : un message peut ne contenir qu'une (ou plusieurs) pièce(s) jointe(s).
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  contenu?: string

  // Optionnel : id du message cité (réponse).
  @IsOptional()
  @IsUUID()
  replyToId?: string
}

export class UpdateMessageDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Le message ne peut pas être vide' })
  @MaxLength(5000)
  contenu!: string
}

export class ReactDto {
  @IsString()
  @IsNotEmpty({ message: 'Emoji requis' })
  @MaxLength(16)
  emoji!: string
}

// ── Gestion de groupe ─────────────────────────────────────────────────────────

export class AddParticipantsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Sélectionnez au moins un participant' })
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  participantIds!: string[]
}

export class SetAdminDto {
  @IsBoolean()
  estAdmin!: boolean
}

export class UpdateGroupDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Le nom du groupe est requis' })
  @MaxLength(120)
  titre?: string

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  description?: string
}

export class MuteDto {
  @IsBoolean()
  muted!: boolean
}

export class LeaveConversationDto {
  // Requis uniquement quand le créateur quitte un groupe qui a d'autres membres :
  // désigne l'administrateur secondaire qui hérite du rôle d'administrateur principal.
  @IsOptional()
  @IsUUID()
  newPrincipalId?: string
}

export class ForwardMessageDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Sélectionnez au moins une conversation' })
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  conversationIds!: string[]
}
