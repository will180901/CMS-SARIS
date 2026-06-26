# =============================================================================
#  CMS SARIS - Mise en place AUTOMATIQUE de la base de donnees locale (Windows)
# -----------------------------------------------------------------------------
#  - Installe PostgreSQL 16 (via winget) s'il est absent
#  - Cree la base "cms_saris_dev"
#  - Applique les migrations Prisma + le jeu de donnees de demonstration (seed)
#  - Affiche comment demarrer l'API
#
#  Identifiants attendus par le projet (apps/api/.env & packages/db/.env) :
#     utilisateur = postgres   mot de passe = postgres   port = 5432   base = cms_saris_dev
#
#  Lancement :   powershell -ExecutionPolicy Bypass -File .\setup-db.ps1
# =============================================================================

$ErrorActionPreference = 'Stop'
$root   = $PSScriptRoot
$PGUSER = 'postgres'
$PGPASS = 'postgres'
$PGDB   = 'cms_saris_dev'
$PGPORT = '5432'

function Find-Psql {
  $c = (Get-Command psql -ErrorAction SilentlyContinue).Source
  if ($c) { return $c }
  $f = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue |
       Sort-Object FullName -Descending | Select-Object -First 1
  if ($f) { return $f.FullName }
  return $null
}

Write-Host '== CMS SARIS - Base de donnees locale ==' -ForegroundColor Cyan

# --- 1. PostgreSQL present ? sinon installation -------------------------------
$psql = Find-Psql
if (-not $psql) {
  Write-Host "PostgreSQL n'est pas installe. Installation via winget..." -ForegroundColor Yellow
  Write-Host ">> IMPORTANT : si l'installeur demande un mot de passe, saisis 'postgres' et garde le port 5432." -ForegroundColor Yellow
  winget install -e --id PostgreSQL.PostgreSQL.16 --accept-package-agreements --accept-source-agreements
  $psql = Find-Psql
  if (-not $psql) {
    Write-Host "PostgreSQL n'a pas ete detecte apres l'installation." -ForegroundColor Red
    Write-Host "Termine l'installation (mot de passe 'postgres', port 5432), ouvre un NOUVEAU terminal, puis relance ce script." -ForegroundColor Red
    exit 1
  }
}
$env:Path = (Split-Path $psql) + ';' + $env:Path
Write-Host "psql : $psql" -ForegroundColor Green

# --- 2. Connexion ------------------------------------------------------------
$env:PGPASSWORD = $PGPASS
& psql -U $PGUSER -h localhost -p $PGPORT -d postgres -tAc 'SELECT 1' | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Connexion impossible (utilisateur '$PGUSER', port $PGPORT)." -ForegroundColor Red
  Write-Host "Verifie que le service PostgreSQL est demarre et que le mot de passe du superutilisateur est bien 'postgres'." -ForegroundColor Red
  Write-Host "(Sinon, change le mot de passe dans apps/api/.env et packages/db/.env pour qu'il corresponde.)" -ForegroundColor Red
  exit 1
}
Write-Host 'Connexion PostgreSQL OK.' -ForegroundColor Green

# --- 3. Creation de la base si absente --------------------------------------
$exists = (& psql -U $PGUSER -h localhost -p $PGPORT -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$PGDB'").Trim()
if ($exists -ne '1') {
  & psql -U $PGUSER -h localhost -p $PGPORT -d postgres -c "CREATE DATABASE $PGDB" | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Host "Echec de creation de la base '$PGDB'." -ForegroundColor Red; exit 1 }
  Write-Host "Base '$PGDB' creee." -ForegroundColor Green
} else {
  Write-Host "Base '$PGDB' deja presente." -ForegroundColor Green
}

# --- 4. Dependances + Prisma (generate / migrate / seed) ---------------------
Set-Location $root

Write-Host 'Installation des dependances (pnpm install)...' -ForegroundColor Cyan
pnpm install
if ($LASTEXITCODE -ne 0) { Write-Host 'Echec : pnpm install.' -ForegroundColor Red; exit 1 }

Write-Host 'Generation du client Prisma...' -ForegroundColor Cyan
pnpm --filter @cms-saris/db exec prisma generate
if ($LASTEXITCODE -ne 0) { Write-Host 'Echec : prisma generate.' -ForegroundColor Red; exit 1 }

Write-Host 'Application des migrations...' -ForegroundColor Cyan
pnpm --filter @cms-saris/db exec prisma migrate deploy
if ($LASTEXITCODE -ne 0) { Write-Host 'Echec : prisma migrate deploy.' -ForegroundColor Red; exit 1 }

Write-Host 'Donnees de demonstration (seed)...' -ForegroundColor Cyan
pnpm --filter @cms-saris/db run db:seed
if ($LASTEXITCODE -ne 0) { Write-Host 'Echec : seed.' -ForegroundColor Red; exit 1 }

# --- 5. Fin ------------------------------------------------------------------
Write-Host ''
Write-Host '== Base de donnees prete ! ==' -ForegroundColor Green
Write-Host "Demarrer l'API   :  pnpm --filter api start:dev   (-> http://localhost:3000)" -ForegroundColor Green
Write-Host "Lancer le bureau :  CMS SARIS (l'installeur ou win-unpacked\CMS SARIS.exe)" -ForegroundColor Green
