/**
 * Inventaire des routes PROTÉGÉES de l'API, lu dans l'application elle-même (contrôleurs
 * et décorateurs @RequirePermissions) — pas une liste tenue à la main qui oublierait
 * la prochaine route ajoutée.
 */
import { RequestMethod } from '@nestjs/common'
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { ModulesContainer } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { REQUIRE_PERMISSIONS_KEY } from '../../src/common/decorators/require-permissions.decorator'

export interface RouteProtegee {
  methode: 'get' | 'post' | 'put' | 'patch' | 'delete'
  chemin: string
  permissions: string[]
  mode: 'ANY' | 'ALL'
}

interface MetaPermissions {
  permissions: string[]
  mode: 'ANY' | 'ALL'
}

const METHODES: Partial<Record<RequestMethod, RouteProtegee['methode']>> = {
  [RequestMethod.GET]: 'get',
  [RequestMethod.POST]: 'post',
  [RequestMethod.PUT]: 'put',
  [RequestMethod.PATCH]: 'patch',
  [RequestMethod.DELETE]: 'delete',
}

/** Identifiant bidon pour les paramètres d'URL : les gardes passent AVANT toute
 *  validation, un refus de droit tombe donc avant qu'on cherche l'enregistrement. */
const ID_BIDON = '00000000-0000-4000-8000-000000000000'

const chemins = (v: unknown): string[] =>
  Array.isArray(v) ? (v as string[]) : typeof v === 'string' ? [v] : ['']

export function routesProtegees(app: NestExpressApplication): RouteProtegee[] {
  const routes: RouteProtegee[] = []
  for (const module of app.get(ModulesContainer).values()) {
    for (const wrapper of module.controllers.values()) {
      const classe = wrapper.metatype as (new (...a: never[]) => object) | null
      if (!classe) continue
      const metaClasse = Reflect.getMetadata(
        REQUIRE_PERMISSIONS_KEY,
        classe,
      ) as MetaPermissions | undefined
      const prototype = classe.prototype as Record<string, unknown>
      for (const nom of Object.getOwnPropertyNames(prototype)) {
        const methode = prototype[nom]
        if (nom === 'constructor' || typeof methode !== 'function') continue
        const cheminMethode: unknown = Reflect.getMetadata(
          PATH_METADATA,
          methode,
        )
        if (cheminMethode === undefined) continue
        const verbe =
          METHODES[
            Reflect.getMetadata(METHOD_METADATA, methode) as RequestMethod
          ]
        // Même règle que PermissionsGuard : la méthode l'emporte sur la classe.
        const meta =
          (Reflect.getMetadata(REQUIRE_PERMISSIONS_KEY, methode) as
            | MetaPermissions
            | undefined) ?? metaClasse
        if (!verbe || !meta?.permissions?.length) continue
        for (const prefixe of chemins(
          Reflect.getMetadata(PATH_METADATA, classe),
        ))
          for (const suffixe of chemins(cheminMethode)) {
            const chemin = ('/' + [prefixe, suffixe].filter(Boolean).join('/'))
              .replace(/\/+/g, '/')
              .replace(/:[A-Za-z0-9_]+(\([^)]*\))?\??/g, ID_BIDON)
            routes.push({ methode: verbe, chemin, ...meta })
          }
      }
    }
  }
  return routes
}

/** Le compte a-t-il le droit d'appeler cette route (même règle que PermissionsGuard) ? */
export function autorise(
  route: RouteProtegee,
  permissions: Set<string>,
): boolean {
  return route.mode === 'ALL'
    ? route.permissions.every((p) => permissions.has(p))
    : route.permissions.some((p) => permissions.has(p))
}
