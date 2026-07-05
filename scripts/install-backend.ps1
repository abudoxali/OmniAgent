$ErrorActionPreference = 'Stop'

Write-Host 'Installing backend dependencies...' -ForegroundColor Cyan

$backendDir = Join-Path $PSScriptRoot '..\apps\backend'
$pythonLauncher = Get-Command py -ErrorAction SilentlyContinue

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

if (-not $pythonLauncher) {
    throw "Python launcher 'py' was not found. Install Python 3.11+ and ensure the Windows launcher is available."
}

Push-Location $backendDir

try {
    if (-not (Test-Path '.venv\Scripts\python.exe')) {
        Write-Host 'Creating virtual environment...' -ForegroundColor Yellow
        Invoke-NativeOrThrow py -3 -m venv .venv
    }

    $venvPython = Join-Path $backendDir '.venv\Scripts\python.exe'

    if (-not (Test-Path $venvPython)) {
        throw 'Virtual environment creation failed. Expected .venv\Scripts\python.exe.'
    }

    Write-Host 'Upgrading pip...' -ForegroundColor Yellow
    Invoke-NativeOrThrow $venvPython -m pip install --upgrade pip

    Write-Host 'Installing requirements...' -ForegroundColor Yellow
    Invoke-NativeOrThrow $venvPython -m pip install -r requirements.txt
}
finally {
    Pop-Location
}

Write-Host 'Backend installation complete!' -ForegroundColor Green
