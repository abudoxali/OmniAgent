$ErrorActionPreference = 'Stop'

$backendDir = Join-Path $PSScriptRoot '..\apps\backend'
$venvPython = Join-Path $backendDir '.venv\Scripts\python.exe'
$distDir = Join-Path $backendDir 'dist'
$workDir = Join-Path $backendDir 'build\pyinstaller-work'
$specDir = Join-Path $backendDir 'build\pyinstaller-spec'

function Invoke-NativeOrThrow {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$ArgumentList
    )

    & $FilePath @ArgumentList
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($ArgumentList -join ' ')"
    }
}

if (-not (Test-Path $venvPython)) {
    throw "Backend virtual environment was not found at $venvPython. Run npm run install:all first."
}

Push-Location $backendDir

try {
    Write-Host 'Ensuring PyInstaller is available...' -ForegroundColor Yellow
    Invoke-NativeOrThrow $venvPython -m pip install pyinstaller==6.21.0

    if (Test-Path $distDir) {
        Remove-Item -LiteralPath $distDir -Recurse -Force
    }

    New-Item -ItemType Directory -Force -Path $workDir | Out-Null
    New-Item -ItemType Directory -Force -Path $specDir | Out-Null

    Write-Host 'Building bundled backend executable...' -ForegroundColor Cyan
    Invoke-NativeOrThrow $venvPython -m PyInstaller `
        --noconfirm `
        --clean `
        --onefile `
        --name OmniAgentBackend `
        --distpath $distDir `
        --workpath $workDir `
        --specpath $specDir `
        --hidden-import uvicorn.logging `
        --hidden-import uvicorn.loops.auto `
        --hidden-import uvicorn.protocols.http.auto `
        --hidden-import uvicorn.protocols.websockets.auto `
        --hidden-import uvicorn.lifespan.on `
        desktop_runtime.py

    $backendExe = Join-Path $distDir 'OmniAgentBackend.exe'
    if (-not (Test-Path $backendExe)) {
        throw "Bundled backend executable was not created at $backendExe."
    }
}
finally {
    Pop-Location
}

Write-Host 'Backend packaging complete!' -ForegroundColor Green
