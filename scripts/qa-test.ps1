$ErrorActionPreference = "Stop"

Write-Host "Starting Automated QA Test for OmniAgent..." -ForegroundColor Cyan

# 1. Check if backend is running
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -Method Get -ErrorAction Stop
    Write-Host "✅ Backend is healthy. Version: $($health.version)" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend is not reachable at http://127.0.0.1:8000. Is it running?" -ForegroundColor Red
    exit 1
}

# 2. Check Provider Configuration
try {
    $providers = Invoke-RestMethod -Uri "http://127.0.0.1:8000/models/providers" -Method Get -ErrorAction Stop
    $active = $providers.active_provider
    Write-Host "✅ Active Provider: $active" -ForegroundColor Green
    
    $activeProviderObj = $providers.providers | Where-Object { $_.id -eq $active }
    
    if ($active -eq "lmstudio" -and $activeProviderObj) {
        Write-Host "✅ LM Studio Base URL: $($activeProviderObj.base_url)" -ForegroundColor Green
        Write-Host "✅ LM Studio Model: $($activeProviderObj.selected_model)" -ForegroundColor Green
        
        # Verify it's gemma 4
        if ($activeProviderObj.selected_model -match "gemma-4") {
            Write-Host "✅ Model is Gemma-4 as expected." -ForegroundColor Green
        } else {
            Write-Host "⚠️ Warning: Expected gemma-4, but found $($activeProviderObj.selected_model)." -ForegroundColor Yellow
        }
    } else {
        Write-Host "⚠️ Warning: Active provider is not LM Studio." -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed to get provider configuration: $_" -ForegroundColor Red
    exit 1
}

# 3. Run Provider Test
Write-Host "Running Provider Test (/models/test)..." -ForegroundColor Cyan
try {
    $testBody = @{ provider = $active } | ConvertTo-Json
    $testResult = Invoke-RestMethod -Uri "http://127.0.0.1:8000/models/test" -Method Post -Body $testBody -ContentType "application/json" -ErrorAction Stop
    if ($testResult.status -eq "ok") {
        Write-Host "✅ Provider Test Passed! Model: $($testResult.model), Latency: $($testResult.latency_ms)ms" -ForegroundColor Green
    } else {
        Write-Host "❌ Provider Test Failed: $($testResult.error)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Failed to run provider test: $_" -ForegroundColor Red
    exit 1
}

# 4. End-to-End AI Run Test
Write-Host "Running End-to-End AI Agent Test (/agent/run)..." -ForegroundColor Cyan
try {
    $body = @{
        prompt = "This is a brief automated test. Please reply with exactly 'OK'."
    } | ConvertTo-Json
    
    $runResult = Invoke-RestMethod -Uri "http://127.0.0.1:8000/agent/run" -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop
    
    if ($runResult.status -eq "ok") {
        Write-Host "✅ End-to-End AI Agent Test Passed!" -ForegroundColor Green
        Write-Host "✅ AI Response Preview: $($runResult.output_preview)" -ForegroundColor Green
    } else {
        Write-Host "❌ End-to-End AI Agent Test Failed: $($runResult.error)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Failed to run AI agent test: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n🎉 All QA Tests Passed Successfully!" -ForegroundColor Green
exit 0
