Write-Host 'Checking OmniAgent health...' -ForegroundColor Cyan
Write-Host ''
try {
    $response = Invoke-RestMethod -Uri 'http://localhost:8000/health' -Method GET -TimeoutSec 5
    Write-Host 'Backend Status: HEALTHY' -ForegroundColor Green
    Write-Host "  Status: $($response.status)" -ForegroundColor White
    Write-Host "  Version: $($response.version)" -ForegroundColor White
    Write-Host "  Phase: $($response.phase)" -ForegroundColor White
    Write-Host "  Uptime Seconds: $($response.uptime_seconds)" -ForegroundColor White
} catch {
    Write-Host 'Backend Status: UNREACHABLE' -ForegroundColor Red
    Write-Host '  Make sure the backend is running (npm run dev:backend)' -ForegroundColor Yellow
}
