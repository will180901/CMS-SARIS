import { Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

/**
 * JwtAuthGuard — protège une route avec le JWT Bearer.
 *
 * Usage : @UseGuards(JwtAuthGuard)
 * Peuple request.user via JwtStrategy.validate().
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
