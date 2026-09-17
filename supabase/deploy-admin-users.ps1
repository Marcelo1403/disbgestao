$ErrorActionPreference = "Stop"
$ProjectRef = "jrsjbcdahqpcgcvzdtfb"
Write-Host "Publicando Edge Function admin-users no projeto $ProjectRef..."
npx supabase@latest functions deploy admin-users --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Concluido. Atualize o Disb Gestao e teste a tela Usuarios."
