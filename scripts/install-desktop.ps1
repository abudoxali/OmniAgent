Write-Host 'Installing desktop dependencies...' -ForegroundColor Cyan
$desktopDir = Join-Path $PSScriptRoot '..\apps\desktop'
Push-Location $desktopDir
npm install
Pop-Location
Write-Host 'Desktop installation complete!' -ForegroundColor Green
