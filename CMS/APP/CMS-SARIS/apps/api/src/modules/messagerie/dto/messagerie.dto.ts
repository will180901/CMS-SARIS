import {
  IsString, IsNotEmpty, IsUUID, MaxLength, IsOptional, IsArray, ArrayMinSize, ArrayMaxSize,
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
