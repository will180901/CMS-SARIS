import { IsUUID } from 'class-validator'

export class SiteActifDto {
  @IsUUID()
  siteId: string
}
