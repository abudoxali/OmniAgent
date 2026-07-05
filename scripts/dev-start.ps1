Write-Host 'Starting Abud OmniAgent development servers...' -ForegroundColor Cyan
Write-Host 'Backend: http://localhost:8000' -ForegroundColor Yellow
Write-Host 'Desktop: Electron app' -ForegroundColor Yellow
Write-Host ''

$rootDir = Join-Path $PSScriptRoot '..'
Push-Location $rootDir
npm run dev
Pop-Location
