#
# Suite de tests exhaustive — Système rôles & permissions CMS SARIS
# Powershell version (Windows compatible)
#

$BASE = "http://localhost:3000"
$PASS = 0
$FAIL = 0
$FAILS = @()

function Test-Status {
  param([string]$Label, [int]$Expected, [int]$Got)
  if ($Got -eq $Expected) {
    Write-Host "  OK  $Label [HTTP $Got]" -ForegroundColor Green
    $script:PASS++
  } else {
    Write-Host "  KO  $Label  -- attendu $Expected, recu $Got" -ForegroundColor Red
    $script:FAIL++
    $script:FAILS += "$Label (attendu $Expected, recu $Got)"
  }
}

function Call-Api {
  param(
    [string]$Method,
    [string]$Path,
    [string]$Token = "",
    [object]$Body = $null
  )
  $headers = @{}
  if ($Token) { $headers["Authorization"] = "Bearer $Token" }
  try {
    if ($Body) {
      $bodyJson = $Body | ConvertTo-Json -Compress -Depth 10
      $r = Invoke-WebRequest -Uri "$BASE$Path" -Method $Method -Headers $headers `
        -ContentType "application/json" -Body $bodyJson -UseBasicParsing -ErrorAction Stop
    } else {
      $r = Invoke-WebRequest -Uri "$BASE$Path" -Method $Method -Headers $headers `
        -UseBasicParsing -ErrorAction Stop
    }
    return [int]$r.StatusCode
  } catch {
    # Tente de lire le code HTTP depuis l'exception (PS 5.1 et 7+)
    $resp = $_.Exception.Response
    if ($resp -ne $null) {
      try { return [int]$resp.StatusCode } catch {}
      try { return [int]$resp.StatusCode.value__ } catch {}
    }
    # Extraction depuis le message (format PS 5.1)
    if ($_.ErrorDetails.Message -match '"statusCode":(\d+)') { return [int]$Matches[1] }
    if ($_.Exception.Message -match '\((\d{3})\)') { return [int]$Matches[1] }
    return 0
  }
}

function Login {
  param([string]$User, [string]$Pass)
  $b = @{ login = $User; password = $Pass } | ConvertTo-Json -Compress
  try {
    $r = Invoke-RestMethod -Uri "$BASE/auth/login" -Method POST -ContentType "application/json" -Body $b
    return $r
  } catch {
    Write-Host "  Login failed for $User : $_" -ForegroundColor Red
    return $null
  }
}

# ─────────────────────────────────────────────────────────────────
Write-Host "TEST 1 - ADMIN_SYSTEME (admin / Admin123!)" -ForegroundColor Cyan
$adminLogin = Login -User "admin" -Pass "Admin123!"
$adminToken = $adminLogin.accessToken
$adminRT    = $adminLogin.refreshToken
$adminId    = $adminLogin.user.id
Write-Host "  user_id=$adminId, perms=$($adminLogin.user.permissions.Count)"

Test-Status "GET /admin/utilisateurs" 200 (Call-Api GET /admin/utilisateurs $adminToken)
Test-Status "GET /admin/roles"        200 (Call-Api GET /admin/roles        $adminToken)
Test-Status "GET /admin/audit/actions" 200 (Call-Api GET /admin/audit/actions $adminToken)
Test-Status "GET /admin/parametres"   200 (Call-Api GET /admin/parametres   $adminToken)
Test-Status "GET /synchronisation/status" 200 (Call-Api GET /synchronisation/status $adminToken)
Test-Status "GET /dashboard/overview" 200 (Call-Api GET /dashboard/overview $adminToken)
Test-Status "GET /referentiels/pathologies" 200 (Call-Api GET /referentiels/pathologies $adminToken)
Test-Status "GET /personnel"          200 (Call-Api GET /personnel          $adminToken)
# ADMIN_SYSTEME = super-administrateur : accès complet (y compris clinique)
Test-Status "GET /triage/visites (super-admin)" 200 (Call-Api GET /triage/visites $adminToken)
Test-Status "GET /consultations (super-admin)"  200 (Call-Api GET /consultations  $adminToken)
Test-Status "GET /patients (super-admin)"       200 (Call-Api GET /patients       $adminToken)
# Autorisé (consultation.create) → passe la garde ; visiteId bidon → 404 (pas 403)
Test-Status "POST /consultations (super-admin, visite introuvable)" 404 (Call-Api POST /consultations $adminToken @{visiteId="00000000-0000-0000-0000-000000000000"})
Test-Status "GET /delegations (super-admin)"    200 (Call-Api GET /delegations    $adminToken)

# ─────────────────────────────────────────────────────────────────
Write-Host "`nTEST 2 - ADMIN_MEDICAL (admin-medical / Saris2026!)" -ForegroundColor Cyan
$medLogin = Login -User "admin-medical" -Pass "Saris2026!"
$medToken = $medLogin.accessToken
Write-Host "  perms=$($medLogin.user.permissions.Count)"

Test-Status "GET /referentiels/pathologies" 200 (Call-Api GET /referentiels/pathologies $medToken)
Test-Status "GET /personnel"                200 (Call-Api GET /personnel                $medToken)
Test-Status "GET /delegations"              200 (Call-Api GET /delegations              $medToken)
Test-Status "GET /consultations (lecture)"  200 (Call-Api GET /consultations            $medToken)
Test-Status "GET /admin/audit/actions"      200 (Call-Api GET /admin/audit/actions      $medToken)
# BLOQUE
Test-Status "GET /admin/utilisateurs BLOQUE" 403 (Call-Api GET /admin/utilisateurs $medToken)
Test-Status "GET /admin/roles BLOQUE"        403 (Call-Api GET /admin/roles        $medToken)
Test-Status "POST /consultations BLOQUE"     403 (Call-Api POST /consultations     $medToken @{visiteId="00000000-0000-0000-0000-000000000000"})
Test-Status "PATCH /admin/parametres BLOQUE" 403 (Call-Api PATCH /admin/parametres/auth.tentatives_max $medToken @{valeur="3"})

# ─────────────────────────────────────────────────────────────────
Write-Host "`nTEST 3 - MEDECIN_CHEF (moukanda / Saris2026!)" -ForegroundColor Cyan
$medChefLogin = Login -User "moukanda" -Pass "Saris2026!"
$medChefToken = $medChefLogin.accessToken
Write-Host "  perms=$($medChefLogin.user.permissions.Count)"

Test-Status "GET /triage/visites"           200 (Call-Api GET /triage/visites           $medChefToken)
Test-Status "GET /consultations"            200 (Call-Api GET /consultations            $medChefToken)
Test-Status "GET /patients"                 200 (Call-Api GET /patients                 $medChefToken)
Test-Status "GET /bons-examen"              200 (Call-Api GET /bons-examen              $medChefToken)
Test-Status "GET /suivis-chroniques"        200 (Call-Api GET /suivis-chroniques        $medChefToken)
Test-Status "GET /evacuations"              200 (Call-Api GET /evacuations              $medChefToken)
Test-Status "GET /accidents-travail"        200 (Call-Api GET /accidents-travail        $medChefToken)
Test-Status "GET /referentiels/pathologies" 200 (Call-Api GET /referentiels/pathologies $medChefToken)
# BLOQUE
Test-Status "GET /admin/utilisateurs BLOQUE" 403 (Call-Api GET /admin/utilisateurs $medChefToken)
Test-Status "GET /admin/roles BLOQUE"        403 (Call-Api GET /admin/roles        $medChefToken)
Test-Status "GET /admin/audit/actions BLOQUE" 403 (Call-Api GET /admin/audit/actions $medChefToken)

# ─────────────────────────────────────────────────────────────────
Write-Host "`nTEST 4 - INFIRMIER (batchi / Saris2026!)" -ForegroundColor Cyan
$infLogin = Login -User "batchi" -Pass "Saris2026!"
$infToken = $infLogin.accessToken
$infRT    = $infLogin.refreshToken
Write-Host "  perms=$($infLogin.user.permissions.Count)"

Test-Status "GET /triage/visites"     200 (Call-Api GET /triage/visites     $infToken)
Test-Status "GET /patients"           200 (Call-Api GET /patients           $infToken)
Test-Status "GET /consultations"      200 (Call-Api GET /consultations      $infToken)
Test-Status "GET /bons-examen"        200 (Call-Api GET /bons-examen        $infToken)
# BLOQUE
Test-Status "POST /consultations/x/diagnostics BLOQUE" 403 (Call-Api POST /consultations/00000000-0000-0000-0000-000000000000/diagnostics $infToken @{pathologieId="00000000-0000-0000-0000-000000000000";type="PRINCIPAL";certitude="CONFIRME"})
Test-Status "POST /consultations/x/ordonnances BLOQUE" 403 (Call-Api POST /consultations/00000000-0000-0000-0000-000000000000/ordonnances $infToken @{})
Test-Status "POST /bons-examen BLOQUE" 403 (Call-Api POST /bons-examen $infToken @{consultationId="00000000-0000-0000-0000-000000000000";indicationClinik="x";typesExamenIds=@("00000000-0000-0000-0000-000000000000")})
Test-Status "GET /admin/utilisateurs BLOQUE" 403 (Call-Api GET /admin/utilisateurs $infToken)

# ─────────────────────────────────────────────────────────────────
Write-Host "`nTEST 5 - INFIRMIER_DELEGUE (infirmier-delegue / Saris2026!)" -ForegroundColor Cyan
$delLogin = Login -User "infirmier-delegue" -Pass "Saris2026!"
$delToken = $delLogin.accessToken
Write-Host "  perms=$($delLogin.user.permissions.Count)"

Test-Status "GET /triage/visites"   200 (Call-Api GET /triage/visites   $delToken)
Test-Status "GET /delegations"      200 (Call-Api GET /delegations      $delToken)
# BLOQUE
Test-Status "POST /delegations BLOQUE" 403 (Call-Api POST /delegations $delToken @{medecinChefId="x";infirmierId="y";dateDebut="2026-01-01";dateFin="2026-12-31";perimetre="test"})
Test-Status "GET /admin/utilisateurs BLOQUE" 403 (Call-Api GET /admin/utilisateurs $delToken)

# ─────────────────────────────────────────────────────────────────
Write-Host "`nTEST 6 - AGENT_RH (agent-rh / Saris2026!)" -ForegroundColor Cyan
$rhLogin = Login -User "agent-rh" -Pass "Saris2026!"
$rhToken = $rhLogin.accessToken
Write-Host "  perms=$($rhLogin.user.permissions.Count)"

Test-Status "GET /personnel"           200 (Call-Api GET /personnel           $rhToken)
Test-Status "GET /referentiels/sites"  200 (Call-Api GET /referentiels/sites  $rhToken)
# BLOQUE
Test-Status "GET /triage/visites BLOQUE"     403 (Call-Api GET /triage/visites $rhToken)
Test-Status "GET /consultations BLOQUE"      403 (Call-Api GET /consultations $rhToken)
Test-Status "GET /admin/utilisateurs BLOQUE" 403 (Call-Api GET /admin/utilisateurs $rhToken)
Test-Status "GET /delegations BLOQUE"        403 (Call-Api GET /delegations $rhToken)

# ─────────────────────────────────────────────────────────────────
Write-Host "`nTEST 7 - Flux dynamique : modif rôle + auth/refresh" -ForegroundColor Cyan

# Récupérer l'ID du rôle INFIRMIER
$roles = Invoke-RestMethod -Uri "$BASE/admin/roles" -Headers @{Authorization="Bearer $adminToken"}
$infirmierRole = $roles | Where-Object { $_.code -eq "INFIRMIER" } | Select-Object -First 1
$infirmierRoleId = $infirmierRole.id
Write-Host "  INFIRMIER role_id=$infirmierRoleId"

# Re-login batchi pour avoir RT frais
$batchiLogin = Login -User "batchi" -Pass "Saris2026!"
$batchiTokenV1 = $batchiLogin.accessToken
$batchiRT = $batchiLogin.refreshToken

# Avant modif : batchi bloqué sur audit
Test-Status "Avant modif : batchi sur audit BLOQUE" 403 (Call-Api GET /admin/audit/actions $batchiTokenV1)

# Ajouter audit.read aux permissions de INFIRMIER
$newPerms = @($infirmierRole.permissions) + @("audit.read")
$body = @{ libelle = $infirmierRole.libelle; permissions = $newPerms }
Test-Status "PATCH /admin/roles INFIRMIER + audit.read" 200 (Call-Api PATCH "/admin/roles/$infirmierRoleId" $adminToken $body)

# Avec ancien JWT batchi → toujours 403 (token figé)
Test-Status "Apres modif, ANCIEN JWT batchi (toujours 403)" 403 (Call-Api GET /admin/audit/actions $batchiTokenV1)

# Refresh JWT batchi
$refreshResp = Invoke-RestMethod -Uri "$BASE/auth/refresh" -Method POST -ContentType "application/json" -Body (@{refreshToken=$batchiRT} | ConvertTo-Json -Compress)
$batchiTokenV2 = $refreshResp.accessToken
Write-Host "  JWT v2 obtenu (len=$($batchiTokenV2.Length))"

# Avec NOUVEAU JWT → 200
Test-Status "Apres refresh, NOUVEAU JWT batchi (200)" 200 (Call-Api GET /admin/audit/actions $batchiTokenV2)

# Cleanup : retirer audit.read
$cleanBody = @{ libelle = $infirmierRole.libelle; permissions = @($infirmierRole.permissions) }
Test-Status "Cleanup INFIRMIER (retire audit.read)" 200 (Call-Api PATCH "/admin/roles/$infirmierRoleId" $adminToken $cleanBody)

# ─────────────────────────────────────────────────────────────────
Write-Host "`nTEST 8 - Garde-fous" -ForegroundColor Cyan

# Self-désactivation interdite
Test-Status "Self-désactivation interdite" 409 (Call-Api PATCH "/admin/utilisateurs/$adminId/statut" $adminToken @{statut="DESACTIVE";motif="test"})

# ─────────────────────────────────────────────────────────────────
Write-Host "`nTEST 9 - Routes /auth" -ForegroundColor Cyan

Test-Status "GET /auth/me (JWT requis)" 200 (Call-Api GET /auth/me $adminToken)

$freshLogin = Login -User "admin" -Pass "Admin123!"
Test-Status "POST /auth/refresh (RT valide)" 200 (Call-Api POST /auth/refresh "" @{refreshToken=$freshLogin.refreshToken})
Test-Status "POST /auth/refresh (RT invalide)" 401 (Call-Api POST /auth/refresh "" @{refreshToken="invalide-token-xxx"})
Test-Status "GET /admin/utilisateurs sans token" 401 (Call-Api GET /admin/utilisateurs "")

# ─────────────────────────────────────────────────────────────────
Write-Host "`nTEST 10 - Separation update/delete sur reentites a statut" -ForegroundColor Cyan
# CRITIQUE SECURITE : un utilisateur ayant seulement *.update NE DOIT PAS
# pouvoir desactiver (toggle statut) une entite. Cette action exige *.delete.

# Pre-requis : admin doit avoir role.create et role.update pour preparer le test
$adminPerms = $adminLogin.user.permissions
if (-not ($adminPerms -contains "role.create") -or -not ($adminPerms -contains "role.update")) {
  Write-Host "  SKIP TEST 10 : admin n'a pas role.create/role.update (perdu via UI ?)" -ForegroundColor Yellow
  Write-Host "                 Reactivez ces permissions dans Roles > ADMIN_SYSTEME via l'UI." -ForegroundColor Yellow
} else {

# Approche idempotente : on garde le role TEST_UPDATE_ONLY ET l'user test_update_only
# d'une execution a l'autre. Au cleanup on desactive juste l'user ; le role est conserve.
# Granularite par service : le role a TOUS les *.update referentiels (pour modifier),
# AUCUN *.delete (pour ne pas pouvoir toggler le statut), et UNIQUEMENT site.create
# parmi les creations (pour prouver la separation create par service).
$testRolePerms = @(
  "referentiel.read",
  "referentiel.site.create",
  "referentiel.site.update", "referentiel.motif.update", "referentiel.pathologie.update",
  "referentiel.medicament.update", "referentiel.categorie.update", "referentiel.examen.update",
  "personnel.read",   "personnel.create",   "personnel.update"
)
$existingRoles = Invoke-RestMethod -Uri "$BASE/admin/roles" -Headers @{Authorization="Bearer $adminToken"}
$existingTestRole = $existingRoles | Where-Object { $_.code -eq "TEST_UPDATE_ONLY" } | Select-Object -First 1
if ($existingTestRole) {
  $testRoleId = $existingTestRole.id
  # Re-aligner les permissions du role test (au cas ou un autre test l'aurait modifie)
  Invoke-RestMethod -Uri "$BASE/admin/roles/$testRoleId" -Method PATCH -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{libelle="Test - update seul"; permissions=$testRolePerms} | ConvertTo-Json -Compress -Depth 5) | Out-Null
} else {
  $createdRole = Invoke-RestMethod -Uri "$BASE/admin/roles" -Method POST -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{code="TEST_UPDATE_ONLY"; libelle="Test - update seul"; permissions=$testRolePerms} | ConvertTo-Json -Compress -Depth 5)
  $testRoleId = $createdRole.id
}
Write-Host "  Role test id=$testRoleId"

# Cree un utilisateur de test si necessaire (la creation utilisateur n'a pas de DELETE,
# donc on rend l'operation idempotente : si l'user existe, on reactive et on remet les roles).
$siteId = (Invoke-RestMethod -Uri "$BASE/referentiels/sites" -Headers @{Authorization="Bearer $adminToken"})[0].id
$existingUsers = Invoke-RestMethod -Uri "$BASE/admin/utilisateurs?search=test_update_only" -Headers @{Authorization="Bearer $adminToken"}
$existingUser = $existingUsers | Where-Object { $_.login -eq "test_update_only" } | Select-Object -First 1
if ($existingUser) {
  $testUserId = $existingUser.id
  # Reactive le compte et remet le mdp pour pouvoir se logger
  Invoke-RestMethod -Uri "$BASE/admin/utilisateurs/$testUserId/statut" -Method PATCH -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{statut="ACTIF"} | ConvertTo-Json -Compress) | Out-Null
  Invoke-RestMethod -Uri "$BASE/admin/utilisateurs/$testUserId/reset-password" -Method POST -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{nouveauMotDePasse="TestUpdate123!"; forcerChangement=$false} | ConvertTo-Json -Compress) | Out-Null
  Invoke-RestMethod -Uri "$BASE/admin/utilisateurs/$testUserId/roles" -Method PATCH -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{roleIds=@($testRoleId)} | ConvertTo-Json -Compress) | Out-Null
} else {
  $testUserBody = @{
    login              = "test_update_only"
    email              = "test_update_only@cms-saris.local"
    motDePasseInitial  = "TestUpdate123!"
    siteId             = $siteId
    roleIds            = @($testRoleId)
  }
  $createdUser = Invoke-RestMethod -Uri "$BASE/admin/utilisateurs" -Method POST -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body ($testUserBody | ConvertTo-Json -Compress -Depth 5)
  $testUserId = $createdUser.id
}

# Login avec l'utilisateur de test
$testLogin = Login -User "test_update_only" -Pass "TestUpdate123!"
if (-not $testLogin) {
  Write-Host "  Login test_update_only echoue, skip TEST 10" -ForegroundColor Yellow
} else {
  $testToken = $testLogin.accessToken
  Write-Host "  test_update_only perms=$($testLogin.user.permissions.Count)"

  # Recupere un site existant pour tester
  $someSite = (Invoke-RestMethod -Uri "$BASE/referentiels/sites" -Headers @{Authorization="Bearer $testToken"})[0]
  Test-Status "GET /referentiels/sites (update_only)" 200 (Call-Api GET /referentiels/sites $testToken)
  # PATCH /sites/:id (modif champ metier) = 200 (a update)
  Test-Status "PATCH /sites/:id avec libelle (update_only)" 200 (Call-Api PATCH "/referentiels/sites/$($someSite.id)" $testToken @{libelle=$someSite.libelle})
  # PATCH /sites/:id/statut (toggle) = 403 (manque .delete)
  $newStatut = if ($someSite.statut -eq 'ACTIF') { 'INACTIF' } else { 'ACTIF' }
  Test-Status "PATCH /sites/:id/statut BLOQUE (update_only sans delete)" 403 (Call-Api PATCH "/referentiels/sites/$($someSite.id)/statut" $testToken @{statut=$newStatut})

  # Idem pour motif/pathologie/medicament/categorie/examen
  $someMotif = (Invoke-RestMethod -Uri "$BASE/referentiels/motifs" -Headers @{Authorization="Bearer $testToken"})[0]
  if ($someMotif) {
    Test-Status "PATCH /motifs/:id/statut BLOQUE (update_only)" 403 (Call-Api PATCH "/referentiels/motifs/$($someMotif.id)/statut" $testToken @{statut="INACTIF"})
  }
  $somePatho = (Invoke-RestMethod -Uri "$BASE/referentiels/pathologies" -Headers @{Authorization="Bearer $testToken"})[0]
  if ($somePatho) {
    Test-Status "PATCH /pathologies/:id/statut BLOQUE (update_only)" 403 (Call-Api PATCH "/referentiels/pathologies/$($somePatho.id)/statut" $testToken @{statut="INACTIVE"})
  }
  $someMed = (Invoke-RestMethod -Uri "$BASE/referentiels/medicaments" -Headers @{Authorization="Bearer $testToken"})[0]
  if ($someMed) {
    Test-Status "PATCH /medicaments/:id/statut BLOQUE (update_only)" 403 (Call-Api PATCH "/referentiels/medicaments/$($someMed.id)/statut" $testToken @{statut="INACTIF"})
  }
  $someCat = (Invoke-RestMethod -Uri "$BASE/referentiels/categories-patient" -Headers @{Authorization="Bearer $testToken"})[0]
  if ($someCat) {
    Test-Status "PATCH /categories-patient/:id/statut BLOQUE (update_only)" 403 (Call-Api PATCH "/referentiels/categories-patient/$($someCat.id)/statut" $testToken @{statut="INACTIVE"})
  }
  $someExa = (Invoke-RestMethod -Uri "$BASE/referentiels/types-examen" -Headers @{Authorization="Bearer $testToken"})[0]
  if ($someExa) {
    Test-Status "PATCH /types-examen/:id/statut BLOQUE (update_only)" 403 (Call-Api PATCH "/referentiels/types-examen/$($someExa.id)/statut" $testToken @{statut="INACTIF"})
  }

  # Personnel : update_only ne peut pas desactiver un agent
  $somePers = (Invoke-RestMethod -Uri "$BASE/personnel" -Headers @{Authorization="Bearer $testToken"})[0]
  if ($somePers) {
    Test-Status "PATCH /personnel/:id/statut BLOQUE (update_only sans delete)" 403 (Call-Api PATCH "/personnel/$($somePers.id)/statut" $testToken @{statut="INACTIF"})
  }
  # NB : les sous-traitants ont desormais leurs propres permissions
  # (sous_traitant.*) — leur separation est couverte par le TEST 14.

  # ── GRANULARITE PAR SERVICE (nouvelle fonctionnalite de securite) ──
  # Le role a referentiel.site.create mais AUCUN autre *.create.
  # Le PermissionsGuard s'execute AVANT la validation du body :
  #   - service AUTORISE : le guard laisse passer -> ValidationPipe -> 400 (body vide invalide)
  #   - service REFUSE   : le guard bloque AVANT la validation -> 403
  # On prouve ainsi la separation sans creer de donnees parasites.
  Test-Status "POST /sites AUTORISE par site.create (400 valid, pas 403)" 400 (Call-Api POST "/referentiels/sites" $testToken @{})
  Test-Status "POST /motifs BLOQUE (pas de motif.create)" 403 (Call-Api POST "/referentiels/motifs" $testToken @{libelle="x"})
  Test-Status "POST /pathologies BLOQUE (pas de pathologie.create)" 403 (Call-Api POST "/referentiels/pathologies" $testToken @{libelle="x"})
  Test-Status "POST /medicaments BLOQUE (pas de medicament.create)" 403 (Call-Api POST "/referentiels/medicaments" $testToken @{nom="x"})
  Test-Status "POST /categories-patient BLOQUE (pas de categorie.create)" 403 (Call-Api POST "/referentiels/categories-patient" $testToken @{libelle="x"})
  Test-Status "POST /types-examen BLOQUE (pas de examen.create)" 403 (Call-Api POST "/referentiels/types-examen" $testToken @{libelle="x"})

  # CONTRE-EPREUVE : ADMIN_MEDICAL (qui a .delete) peut bien toggler
  $adminMedToken = (Login -User "admin-medical" -Pass "Saris2026!").accessToken
  $revertStatut = $someSite.statut
  Test-Status "PATCH /sites/:id/statut OK (admin-medical avec .delete)" 200 (Call-Api PATCH "/referentiels/sites/$($someSite.id)/statut" $adminMedToken @{statut=$revertStatut})
}

# Cleanup minimal : on desactive l'user de test. On NE TOUCHE PAS au role TEST_UPDATE_ONLY
# ni a la liste des roles de l'user — ainsi la prochaine execution retrouve un etat propre :
# user existe avec uniquement TEST_UPDATE_ONLY, juste DESACTIVE. On le reactive en haut.
Invoke-RestMethod -Uri "$BASE/admin/utilisateurs/$testUserId/statut" -Method PATCH -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{statut="DESACTIVE";motif="cleanup test 10"} | ConvertTo-Json -Compress) | Out-Null

} # fin du else "admin a role.create"

# ─────────────────────────────────────────────────────────────────
Write-Host "`nTEST 11 - Flux complet Utilisateurs (CUD + reset + statut + audit)" -ForegroundColor Cyan

$siteId        = (Invoke-RestMethod -Uri "$BASE/referentiels/sites" -Headers @{Authorization="Bearer $adminToken"})[0].id
$rolesAll      = Invoke-RestMethod -Uri "$BASE/admin/roles" -Headers @{Authorization="Bearer $adminToken"}
$infRoleId     = ($rolesAll | Where-Object { $_.code -eq "INFIRMIER" } | Select-Object -First 1).id
$adminMedRoleId = ($rolesAll | Where-Object { $_.code -eq "ADMIN_MEDICAL" } | Select-Object -First 1).id

# Cleanup eventuel
$existing = Invoke-RestMethod -Uri "$BASE/admin/utilisateurs?search=test_flux" -Headers @{Authorization="Bearer $adminToken"}
$existingU = $existing | Where-Object { $_.login -eq "test_flux" } | Select-Object -First 1
if ($existingU) {
  Invoke-RestMethod -Uri "$BASE/admin/utilisateurs/$($existingU.id)/statut" -Method PATCH -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{statut="DESACTIVE";motif="cleanup"} | ConvertTo-Json -Compress) | Out-Null
}

# 11.1 Creation : OK
$createBody = @{
  login              = "test_flux"
  email              = "test_flux_$(Get-Random)@cms-saris.local"
  motDePasseInitial  = "TestFlux123!"
  siteId             = $siteId
  roleIds            = @($infRoleId)
}
$createBodyJson = $createBody | ConvertTo-Json -Compress -Depth 5
if ($existingU) {
  # Reactiver et reset au lieu de creer
  Invoke-RestMethod -Uri "$BASE/admin/utilisateurs/$($existingU.id)/statut" -Method PATCH -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{statut="ACTIF"} | ConvertTo-Json -Compress) | Out-Null
  Invoke-RestMethod -Uri "$BASE/admin/utilisateurs/$($existingU.id)/reset-password" -Method POST -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{nouveauMotDePasse="TestFlux123!"; forcerChangement=$false} | ConvertTo-Json -Compress) | Out-Null
  Invoke-RestMethod -Uri "$BASE/admin/utilisateurs/$($existingU.id)/roles" -Method PATCH -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{roleIds=@($infRoleId)} | ConvertTo-Json -Compress) | Out-Null
  $newUserId = $existingU.id
  Write-Host "  Reuse utilisateur existant id=$newUserId" -ForegroundColor Yellow
} else {
  $newUser = Invoke-RestMethod -Uri "$BASE/admin/utilisateurs" -Method POST -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body $createBodyJson
  $newUserId = $newUser.id
  Write-Host "  Cree utilisateur id=$newUserId"
}

# 11.2 Creation avec login deja pris → 409
Test-Status "POST /admin/utilisateurs login deja pris" 409 (Call-Api POST /admin/utilisateurs $adminToken @{
  login="test_flux"; email="other_$(Get-Random)@cms-saris.local"; motDePasseInitial="OtherUser1!";
  siteId=$siteId; roleIds=@($infRoleId)
})

# 11.3 Creation avec mot de passe trop faible → 400
Test-Status "POST /admin/utilisateurs mdp invalide (trop court)" 400 (Call-Api POST /admin/utilisateurs $adminToken @{
  login="test_weak_$(Get-Random)"; email="weak_$(Get-Random)@cms-saris.local"; motDePasseInitial="abc";
  siteId=$siteId; roleIds=@($infRoleId)
})

# 11.4 Creation avec mot de passe sans majuscule → 400
Test-Status "POST /admin/utilisateurs mdp sans majuscule" 400 (Call-Api POST /admin/utilisateurs $adminToken @{
  login="test_nomaj_$(Get-Random)"; email="nomaj_$(Get-Random)@cms-saris.local"; motDePasseInitial="weakpassword1";
  siteId=$siteId; roleIds=@($infRoleId)
})

# 11.5 Creation sans aucun role → 400
Test-Status "POST /admin/utilisateurs sans role" 400 (Call-Api POST /admin/utilisateurs $adminToken @{
  login="test_norole_$(Get-Random)"; email="norole_$(Get-Random)@cms-saris.local"; motDePasseInitial="GoodPass123!";
  siteId=$siteId; roleIds=@()
})

# 11.6 Set roles (changement) : OK
Test-Status "PATCH /admin/utilisateurs/:id/roles (change roles)" 200 (Call-Api PATCH "/admin/utilisateurs/$newUserId/roles" $adminToken @{roleIds=@($adminMedRoleId)})

# 11.7 Reset password : OK
Test-Status "POST /admin/utilisateurs/:id/reset-password" 200 (Call-Api POST "/admin/utilisateurs/$newUserId/reset-password" $adminToken @{nouveauMotDePasse="NewSafePass1!"; forcerChangement=$true})

# 11.8 Reset password avec mdp trop faible → 400
Test-Status "POST /admin/utilisateurs/:id/reset-password mdp invalide" 400 (Call-Api POST "/admin/utilisateurs/$newUserId/reset-password" $adminToken @{nouveauMotDePasse="abc"})

# 11.9 Set statut DESACTIVE : OK
Test-Status "PATCH /admin/utilisateurs/:id/statut DESACTIVE" 200 (Call-Api PATCH "/admin/utilisateurs/$newUserId/statut" $adminToken @{statut="DESACTIVE"; motif="test flux"})

# 11.10 Re-activation : OK
Test-Status "PATCH /admin/utilisateurs/:id/statut ACTIF" 200 (Call-Api PATCH "/admin/utilisateurs/$newUserId/statut" $adminToken @{statut="ACTIF"})

# 11.11 Acces utilisateur (non admin) aux endpoints admin → 403
$infirmierToken = (Login -User "batchi" -Pass "Saris2026!").accessToken
Test-Status "POST /admin/utilisateurs (infirmier) BLOQUE" 403 (Call-Api POST /admin/utilisateurs $infirmierToken @{
  login="hack_$(Get-Random)"; email="hack@cms-saris.local"; motDePasseInitial="Hackerman1!";
  siteId=$siteId; roleIds=@($infRoleId)
})
Test-Status "POST /admin/utilisateurs/x/reset-password (infirmier) BLOQUE" 403 (Call-Api POST "/admin/utilisateurs/$newUserId/reset-password" $infirmierToken @{nouveauMotDePasse="GoodPass123!"})
Test-Status "PATCH /admin/utilisateurs/x/roles (infirmier) BLOQUE" 403 (Call-Api PATCH "/admin/utilisateurs/$newUserId/roles" $infirmierToken @{roleIds=@($infRoleId)})

# 11.12 Audit : verifier qu'on retrouve les actions emises ci-dessus
$auditLogs = Invoke-RestMethod -Uri "$BASE/admin/audit/actions?utilisateurId=$adminId&module=utilisateur&limit=50" -Headers @{Authorization="Bearer $adminToken"}
$hasCreate = ($auditLogs | Where-Object { $_.action -eq "CREATE" -or $_.action -eq "SET_ROLES" -or $_.action -eq "SET_STATUT" -or $_.action -eq "RESET_PASSWORD" }).Count
if ($hasCreate -gt 0) {
  Write-Host "  OK  Audit retrouve $hasCreate actions sur utilisateur" -ForegroundColor Green
  $script:PASS++
} else {
  Write-Host "  KO  Audit n'a retrouve aucune action sur utilisateur" -ForegroundColor Red
  $script:FAIL++
}

# 11.13 Cleanup : desactiver l'user de test pour ne pas polluer
Invoke-RestMethod -Uri "$BASE/admin/utilisateurs/$newUserId/statut" -Method PATCH -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{statut="DESACTIVE";motif="cleanup test 11"} | ConvertTo-Json -Compress) | Out-Null

# ─────────────────────────────────────────────────────────────────
Write-Host "`nTEST 12 - Derogations de permissions par utilisateur (GRANT / REVOKE)" -ForegroundColor Cyan
# Effectif = (permissions des roles + GRANTs) - REVOKEs. Le JWT reste fige
# jusqu'au /auth/refresh (comme pour les roles).

# Re-login batchi (INFIRMIER) pour un refresh token frais
$bLogin   = Login -User "batchi" -Pass "Saris2026!"
$bId      = $bLogin.user.id
$bTokenV1 = $bLogin.accessToken
$bRT      = $bLogin.refreshToken
Write-Host "  batchi id=$bId perms(role)=$($bLogin.user.permissions.Count)"

# 12.1 Lecture de la ventilation par l'admin
Test-Status "GET /utilisateurs/:id/permissions (admin)" 200 (Call-Api GET "/admin/utilisateurs/$bId/permissions" $adminToken)

# 12.2 Etat initial : batchi n'a PAS audit.read, mais A visite.read (via INFIRMIER)
Test-Status "Avant derog : batchi audit BLOQUE" 403 (Call-Api GET /admin/audit/actions $bTokenV1)
Test-Status "Avant derog : batchi triage OK"    200 (Call-Api GET /triage/visites $bTokenV1)

# 12.3 PUT derogations : GRANT audit.read + REVOKE visite.read
$putBody = @{ grants = @("audit.read"); revokes = @("visite.read"); motif = "test derogation E2E" }
Test-Status "PUT /utilisateurs/:id/permissions (grant+revoke)" 200 (Call-Api PUT "/admin/utilisateurs/$bId/permissions" $adminToken $putBody)

# 12.4 Ancien JWT batchi : toujours fige (token non rafraichi)
Test-Status "Apres derog, ANCIEN JWT audit (toujours 403)" 403 (Call-Api GET /admin/audit/actions $bTokenV1)

# 12.5 Refresh -> nouveau JWT reflete les derogations
$bRefresh = Invoke-RestMethod -Uri "$BASE/auth/refresh" -Method POST -ContentType "application/json" -Body (@{refreshToken=$bRT} | ConvertTo-Json -Compress)
$bTokenV2 = $bRefresh.accessToken
$bRT2     = $bRefresh.refreshToken
Test-Status "Apres refresh : audit ACCORDE (GRANT)" 200 (Call-Api GET /admin/audit/actions $bTokenV2)
Test-Status "Apres refresh : triage REVOQUE (REVOKE)" 403 (Call-Api GET /triage/visites $bTokenV2)

# 12.6 La ventilation reflete bien les derogations
$bd = Invoke-RestMethod -Uri "$BASE/admin/utilisateurs/$bId/permissions" -Headers @{Authorization="Bearer $adminToken"}
if (($bd.grants.code -contains "audit.read") -and ($bd.revokes.code -contains "visite.read") -and (-not ($bd.effective -contains "visite.read")) -and ($bd.effective -contains "audit.read")) {
  Write-Host "  OK  Ventilation coherente (grant=audit.read, revoke=visite.read, effectif a jour)" -ForegroundColor Green
  $script:PASS++
} else {
  Write-Host "  KO  Ventilation incoherente : grants=$($bd.grants.code) revokes=$($bd.revokes.code)" -ForegroundColor Red
  $script:FAIL++
  $script:FAILS += "TEST 12.6 ventilation incoherente"
}

# 12.7 Validations : conflit grant+revoke sur le meme code -> 400
Test-Status "PUT conflit grant=revoke BLOQUE" 400 (Call-Api PUT "/admin/utilisateurs/$bId/permissions" $adminToken @{ grants=@("audit.read"); revokes=@("audit.read") })
# 12.8 Code inconnu -> 400
Test-Status "PUT code inconnu BLOQUE" 400 (Call-Api PUT "/admin/utilisateurs/$bId/permissions" $adminToken @{ grants=@("permission.bidon.inexistante") })

# 12.9 Permission requise : batchi (sans manage_permissions) ne peut pas gerer les derogations
Test-Status "PUT derogations (batchi) BLOQUE" 403 (Call-Api PUT "/admin/utilisateurs/$bId/permissions" $bTokenV2 @{ grants=@("audit.read") })
Test-Status "POST bulk (batchi) BLOQUE" 403 (Call-Api POST "/admin/utilisateurs/permissions/bulk" $bTokenV2 @{ utilisateurIds=@($bId); code="audit.read"; mode="GRANT" })

# 12.10 Garde-fou : l'admin ne peut pas se retirer une permission vitale (auto-castration / dernier admin)
Test-Status "PUT self-revoke manage_permissions BLOQUE" 409 (Call-Api PUT "/admin/utilisateurs/$adminId/permissions" $adminToken @{ revokes=@("utilisateur.manage_permissions") })
Test-Status "PUT self-revoke role.update BLOQUE"        409 (Call-Api PUT "/admin/utilisateurs/$adminId/permissions" $adminToken @{ revokes=@("role.update") })

# 12.11 Assignation GROUPEE (bulk) : accorder audit.read a batchi + agent-rh
$rhLogin2 = Login -User "agent-rh" -Pass "Saris2026!"
$rhId     = $rhLogin2.user.id
$rhRT     = $rhLogin2.refreshToken
Test-Status "POST bulk GRANT audit.read (2 users)" 200 (Call-Api POST "/admin/utilisateurs/permissions/bulk" $adminToken @{ utilisateurIds=@($bId, $rhId); code="audit.read"; mode="GRANT"; motif="bulk E2E" })
# agent-rh apres refresh peut consulter l'audit
$rhRefresh = Invoke-RestMethod -Uri "$BASE/auth/refresh" -Method POST -ContentType "application/json" -Body (@{refreshToken=$rhRT} | ConvertTo-Json -Compress)
Test-Status "agent-rh apres bulk : audit ACCORDE" 200 (Call-Api GET /admin/audit/actions $rhRefresh.accessToken)

# 12.12 Bulk RESET : nettoyage des derogations (retour au comportement des roles)
Test-Status "POST bulk RESET audit.read (2 users)" 200 (Call-Api POST "/admin/utilisateurs/permissions/bulk" $adminToken @{ utilisateurIds=@($bId, $rhId); code="audit.read"; mode="RESET" })
Test-Status "POST bulk RESET visite.read (batchi)" 200 (Call-Api POST "/admin/utilisateurs/permissions/bulk" $adminToken @{ utilisateurIds=@($bId); code="visite.read"; mode="RESET" })

# 12.13 Apres RESET + refresh : batchi retrouve exactement ses droits de role
$bRefresh2 = Invoke-RestMethod -Uri "$BASE/auth/refresh" -Method POST -ContentType "application/json" -Body (@{refreshToken=$bRT2} | ConvertTo-Json -Compress)
$bTokenV3  = $bRefresh2.accessToken
Test-Status "Apres RESET : triage de nouveau OK" 200 (Call-Api GET /triage/visites $bTokenV3)
Test-Status "Apres RESET : audit de nouveau BLOQUE" 403 (Call-Api GET /admin/audit/actions $bTokenV3)

# 12.14 La ventilation ne contient plus aucune derogation
$bdFinal = Invoke-RestMethod -Uri "$BASE/admin/utilisateurs/$bId/permissions" -Headers @{Authorization="Bearer $adminToken"}
if (($bdFinal.grants.Count -eq 0) -and ($bdFinal.revokes.Count -eq 0)) {
  Write-Host "  OK  Aucune derogation residuelle apres RESET" -ForegroundColor Green
  $script:PASS++
} else {
  Write-Host "  KO  Derogations residuelles : grants=$($bdFinal.grants.Count) revokes=$($bdFinal.revokes.Count)" -ForegroundColor Red
  $script:FAIL++
  $script:FAILS += "TEST 12.14 derogations residuelles"
}

# ─────────────────────────────────────────────────────────────────
Write-Host "`nTEST 13 - Garde-fou dernier administrateur systeme" -ForegroundColor Cyan
$rolesA   = Invoke-RestMethod -Uri "$BASE/admin/roles" -Headers @{Authorization="Bearer $adminToken"}
$sysId    = ($rolesA | Where-Object { $_.code -eq "ADMIN_SYSTEME" } | Select-Object -First 1).id
$medId    = ($rolesA | Where-Object { $_.code -eq "ADMIN_MEDICAL" } | Select-Object -First 1).id
$siteId13 = (Invoke-RestMethod -Uri "$BASE/referentiels/sites" -Headers @{Authorization="Bearer $adminToken"})[0].id

# Pre-nettoyage : pour que le garde-fou "dernier admin" s'applique, `admin` doit
# etre le SEUL ADMIN_SYSTEME actif. On desactive donc tout autre compte admin
# actif qui trainerait (comptes de test residuels d'anciennes sessions).
$allUsers13   = Invoke-RestMethod -Uri "$BASE/admin/utilisateurs" -Headers @{Authorization="Bearer $adminToken"}
$autresAdmins = $allUsers13 | Where-Object { ($_.roles.code -contains "ADMIN_SYSTEME") -and ($_.id -ne $adminId) -and ($_.statut -eq "ACTIF") }
foreach ($a in $autresAdmins) {
  Invoke-RestMethod -Uri "$BASE/admin/utilisateurs/$($a.id)/statut" -Method PATCH -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{statut="DESACTIVE";motif="pre-cleanup test 13 (isoler le dernier admin)"} | ConvertTo-Json -Compress) | Out-Null
}

# Role TEST_ASSIGN : possede assign_role mais PAS ADMIN_SYSTEME (isole le garde-fou
# "dernier admin" du garde-fou "auto-castration assign_role").
$taPerms = @("utilisateur.read","utilisateur.assign_role","role.read")
$taRole = $rolesA | Where-Object { $_.code -eq "TEST_ASSIGN" } | Select-Object -First 1
if ($taRole) {
  $taId = $taRole.id
  Invoke-RestMethod -Uri "$BASE/admin/roles/$taId" -Method PATCH -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{libelle="Test - assignation"; permissions=$taPerms} | ConvertTo-Json -Compress -Depth 5) | Out-Null
} else {
  $taId = (Invoke-RestMethod -Uri "$BASE/admin/roles" -Method POST -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{code="TEST_ASSIGN"; libelle="Test - assignation"; permissions=$taPerms} | ConvertTo-Json -Compress -Depth 5)).id
}

# 13.1 NEG setRoles : admin (seul ADMIN_SYSTEME actif) tente de se retirer le role -> 409
Test-Status "setRoles : retirer ADMIN_SYSTEME au dernier admin BLOQUE" 409 (Call-Api PATCH "/admin/utilisateurs/$adminId/roles" $adminToken @{roleIds=@($taId)})
$adminAfter = Invoke-RestMethod -Uri "$BASE/admin/utilisateurs/$adminId" -Headers @{Authorization="Bearer $adminToken"}
if ($adminAfter.roles.code -contains "ADMIN_SYSTEME") {
  Write-Host "  OK  admin conserve bien ADMIN_SYSTEME" -ForegroundColor Green; $script:PASS++
} else {
  Write-Host "  KO  admin a PERDU ADMIN_SYSTEME ! (restauration automatique)" -ForegroundColor Red; $script:FAIL++; $script:FAILS += "TEST 13.1 admin a perdu ADMIN_SYSTEME"
  # Filet de securite : on restaure le role ADMIN_SYSTEME a l'admin (le JWT courant
  # reste valide meme si la BDD a change, car le JWT est fige).
  try { Invoke-RestMethod -Uri "$BASE/admin/utilisateurs/$adminId/roles" -Method PATCH -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{roleIds=@($sysId)} | ConvertTo-Json -Compress) | Out-Null; Write-Host "       admin restaure en ADMIN_SYSTEME" -ForegroundColor Yellow } catch {}
}

# Cree/reactive un 2e admin pour le test POSITIF
$ex2 = Invoke-RestMethod -Uri "$BASE/admin/utilisateurs?search=test_admin2" -Headers @{Authorization="Bearer $adminToken"}
$u2  = $ex2 | Where-Object { $_.login -eq "test_admin2" } | Select-Object -First 1
if ($u2) {
  $u2Id = $u2.id
  Invoke-RestMethod -Uri "$BASE/admin/utilisateurs/$u2Id/statut" -Method PATCH -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{statut="ACTIF"} | ConvertTo-Json -Compress) | Out-Null
  Invoke-RestMethod -Uri "$BASE/admin/utilisateurs/$u2Id/roles" -Method PATCH -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{roleIds=@($sysId)} | ConvertTo-Json -Compress) | Out-Null
} else {
  $u2Id = (Invoke-RestMethod -Uri "$BASE/admin/utilisateurs" -Method POST -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{login="test_admin2"; email="test_admin2_$(Get-Random)@cms-saris.local"; motDePasseInitial="AdminTwo123!"; siteId=$siteId13; roleIds=@($sysId)} | ConvertTo-Json -Compress -Depth 5)).id
}

# 13.2 POS setRoles : retirer ADMIN_SYSTEME a test_admin2 quand 2 admins existent -> 200
Test-Status "setRoles : retirer ADMIN_SYSTEME quand 2 admins OK" 200 (Call-Api PATCH "/admin/utilisateurs/$u2Id/roles" $adminToken @{roleIds=@($medId)})

# Operateur non-admin (utilisateur.update) pour tester le garde-fou de statut
$opPerms = @("utilisateur.read","utilisateur.update")
$opRole = (Invoke-RestMethod -Uri "$BASE/admin/roles" -Headers @{Authorization="Bearer $adminToken"}) | Where-Object { $_.code -eq "TEST_OPERATEUR" } | Select-Object -First 1
if ($opRole) {
  $opId = $opRole.id
  Invoke-RestMethod -Uri "$BASE/admin/roles/$opId" -Method PATCH -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{libelle="Test - operateur"; permissions=$opPerms} | ConvertTo-Json -Compress -Depth 5) | Out-Null
} else {
  $opId = (Invoke-RestMethod -Uri "$BASE/admin/roles" -Method POST -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{code="TEST_OPERATEUR"; libelle="Test - operateur"; permissions=$opPerms} | ConvertTo-Json -Compress -Depth 5)).id
}
$exOp = Invoke-RestMethod -Uri "$BASE/admin/utilisateurs?search=test_operateur" -Headers @{Authorization="Bearer $adminToken"}
$uOp  = $exOp | Where-Object { $_.login -eq "test_operateur" } | Select-Object -First 1
if ($uOp) {
  $opUserId = $uOp.id
  Invoke-RestMethod -Uri "$BASE/admin/utilisateurs/$opUserId/statut" -Method PATCH -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{statut="ACTIF"} | ConvertTo-Json -Compress) | Out-Null
  Invoke-RestMethod -Uri "$BASE/admin/utilisateurs/$opUserId/reset-password" -Method POST -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{nouveauMotDePasse="OperateurX1!"; forcerChangement=$false} | ConvertTo-Json -Compress) | Out-Null
  Invoke-RestMethod -Uri "$BASE/admin/utilisateurs/$opUserId/roles" -Method PATCH -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{roleIds=@($opId)} | ConvertTo-Json -Compress) | Out-Null
} else {
  $opUserId = (Invoke-RestMethod -Uri "$BASE/admin/utilisateurs" -Method POST -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{login="test_operateur"; email="test_operateur_$(Get-Random)@cms-saris.local"; motDePasseInitial="OperateurX1!"; siteId=$siteId13; roleIds=@($opId)} | ConvertTo-Json -Compress -Depth 5)).id
}
$opLogin = Login -User "test_operateur" -Pass "OperateurX1!"
$opToken = $opLogin.accessToken

# 13.3 NEG setStatut : un operateur tente de desactiver le DERNIER admin -> 409
Test-Status "setStatut : desactiver le dernier admin (par operateur) BLOQUE" 409 (Call-Api PATCH "/admin/utilisateurs/$adminId/statut" $opToken @{statut="DESACTIVE"; motif="test"})

# Cleanup : desactiver les comptes de test (idempotence)
Invoke-RestMethod -Uri "$BASE/admin/utilisateurs/$u2Id/statut" -Method PATCH -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{statut="DESACTIVE";motif="cleanup test 13"} | ConvertTo-Json -Compress) | Out-Null
Invoke-RestMethod -Uri "$BASE/admin/utilisateurs/$opUserId/statut" -Method PATCH -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{statut="DESACTIVE";motif="cleanup test 13"} | ConvertTo-Json -Compress) | Out-Null

# ─────────────────────────────────────────────────────────────────
Write-Host "`nTEST 14 - Granularite onglets : sous-traitants & rattachements patient" -ForegroundColor Cyan
# Sous-traitants separes du personnel medical (sous_traitant.*) et rattachements
# patient separes de patient.update (patient.rattachement.manage).
$siteId14 = (Invoke-RestMethod -Uri "$BASE/referentiels/sites" -Headers @{Authorization="Bearer $adminToken"})[0].id

# Role TEST_SEP : ecritures personnel + patient, MAIS ni sous_traitant.* ni
# patient.rattachement.manage. Permet d'isoler les deux separations.
$sepPerms = @("personnel.read","personnel.create","personnel.update","patient.read","patient.create","patient.update")
$sepRole = (Invoke-RestMethod -Uri "$BASE/admin/roles" -Headers @{Authorization="Bearer $adminToken"}) | Where-Object { $_.code -eq "TEST_SEP" } | Select-Object -First 1
if ($sepRole) {
  $sepId = $sepRole.id
  Invoke-RestMethod -Uri "$BASE/admin/roles/$sepId" -Method PATCH -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{libelle="Test - separation"; permissions=$sepPerms} | ConvertTo-Json -Compress -Depth 5) | Out-Null
} else {
  $sepId = (Invoke-RestMethod -Uri "$BASE/admin/roles" -Method POST -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{code="TEST_SEP"; libelle="Test - separation"; permissions=$sepPerms} | ConvertTo-Json -Compress -Depth 5)).id
}
$exSep = Invoke-RestMethod -Uri "$BASE/admin/utilisateurs?search=test_separation" -Headers @{Authorization="Bearer $adminToken"}
$uSep  = $exSep | Where-Object { $_.login -eq "test_separation" } | Select-Object -First 1
if ($uSep) {
  $sepUserId = $uSep.id
  Invoke-RestMethod -Uri "$BASE/admin/utilisateurs/$sepUserId/statut" -Method PATCH -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{statut="ACTIF"} | ConvertTo-Json -Compress) | Out-Null
  Invoke-RestMethod -Uri "$BASE/admin/utilisateurs/$sepUserId/reset-password" -Method POST -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{nouveauMotDePasse="SepUser123!"; forcerChangement=$false} | ConvertTo-Json -Compress) | Out-Null
  Invoke-RestMethod -Uri "$BASE/admin/utilisateurs/$sepUserId/roles" -Method PATCH -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{roleIds=@($sepId)} | ConvertTo-Json -Compress) | Out-Null
} else {
  $sepUserId = (Invoke-RestMethod -Uri "$BASE/admin/utilisateurs" -Method POST -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{login="test_separation"; email="test_separation_$(Get-Random)@cms-saris.local"; motDePasseInitial="SepUser123!"; siteId=$siteId14; roleIds=@($sepId)} | ConvertTo-Json -Compress -Depth 5)).id
}
$sepToken = (Login -User "test_separation" -Pass "SepUser123!").accessToken

# ── Sous-traitants : separes du personnel ──
Test-Status "GET /personnel (test_sep, a personnel.read)" 200 (Call-Api GET /personnel $sepToken)
Test-Status "GET /sous-traitants BLOQUE (pas de sous_traitant.read)" 403 (Call-Api GET /sous-traitants $sepToken)
Test-Status "POST /sous-traitants BLOQUE (pas de sous_traitant.create)" 403 (Call-Api POST /sous-traitants $sepToken @{nom="X"})
Test-Status "POST /personnel AUTORISE (400 valid, pas 403)" 400 (Call-Api POST /personnel $sepToken @{})

# Contre-epreuve : AGENT_RH a sous_traitant.* (preserve)
$rhTok14 = (Login -User "agent-rh" -Pass "Saris2026!").accessToken
Test-Status "GET /sous-traitants OK (agent-rh)" 200 (Call-Api GET /sous-traitants $rhTok14)
Test-Status "POST /sous-traitants AUTORISE agent-rh (400 valid, pas 403)" 400 (Call-Api POST /sous-traitants $rhTok14 @{})

# ── Rattachements patient : separes de patient.update ──
$pat = Invoke-RestMethod -Uri "$BASE/patients" -Headers @{Authorization="Bearer $sepToken"}
if ($pat -and $pat.Count -gt 0) {
  $pid14 = $pat[0].id
  Test-Status "GET /patients (test_sep, a patient.read)" 200 (Call-Api GET /patients $sepToken)
  Test-Status "POST /patients/:id/allergies AUTORISE (400 valid, pas 403)" 400 (Call-Api POST "/patients/$pid14/allergies" $sepToken @{})
  Test-Status "POST /patients/:id/rattachements-ad BLOQUE (pas de rattachement.manage)" 403 (Call-Api POST "/patients/$pid14/rattachements-ad" $sepToken @{cdiId="x";typeLien="CONJOINT";dateDebut="2026-01-01"})
  Test-Status "POST /patients/:id/rattachements-st BLOQUE (pas de rattachement.manage)" 403 (Call-Api POST "/patients/$pid14/rattachements-st" $sepToken @{societeId="00000000-0000-0000-0000-000000000000";dateDebut="2026-01-01"})

  # Contre-epreuve : MEDECIN_CHEF a patient.rattachement.manage
  $mcTok14 = (Login -User "moukanda" -Pass "Saris2026!").accessToken
  Test-Status "POST /patients/:id/rattachements-ad AUTORISE medecin-chef (400 valid, pas 403)" 400 (Call-Api POST "/patients/$pid14/rattachements-ad" $mcTok14 @{})
} else {
  Write-Host "  SKIP tests rattachements : aucun patient en base" -ForegroundColor Yellow
}

# Cleanup
Invoke-RestMethod -Uri "$BASE/admin/utilisateurs/$sepUserId/statut" -Method PATCH -Headers @{Authorization="Bearer $adminToken"} -ContentType "application/json" -Body (@{statut="DESACTIVE";motif="cleanup test 14"} | ConvertTo-Json -Compress) | Out-Null

# ─────────────────────────────────────────────────────────────────
Write-Host "`n═══════════════════════════════════════════════"
$TOTAL = $PASS + $FAIL
if ($FAIL -eq 0) {
  Write-Host "Tous les tests passent : $PASS/$TOTAL" -ForegroundColor Green
} else {
  Write-Host "Echec : $FAIL/$TOTAL" -ForegroundColor Red
  Write-Host "Echecs :" -ForegroundColor Red
  foreach ($f in $FAILS) {
    Write-Host "  - $f" -ForegroundColor Red
  }
}
exit $FAIL
