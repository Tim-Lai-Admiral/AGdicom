# 统一验证脚本：PATH 刷新 + npm test + npm run build
$ErrorActionPreference = 'Stop'
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')
$npm = 'npm.cmd'
if (-not (Get-Command $npm -ErrorAction SilentlyContinue)) { $npm = 'C:\Program Files\nodejs\npm.cmd' }

Write-Host '== npm test =='
& $npm test
if ($LASTEXITCODE -ne 0) { Write-Host "TEST FAILED ($LASTEXITCODE)"; exit $LASTEXITCODE }

Write-Host '== npm run build =='
& $npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "BUILD FAILED ($LASTEXITCODE)"; exit $LASTEXITCODE }

Write-Host '== verify OK =='
exit 0