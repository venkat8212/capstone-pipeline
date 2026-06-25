# EPMS Sync & Build Script
# This script stages, commits, and pushes your changes to GitHub, and rebuilds your local Docker environment.

Write-Host "1. Staging local code changes..." -ForegroundColor Cyan
git add .

$commitMsg = Read-Host -Prompt "Enter commit message (Press Enter for default: 'style: update app theme')"
if ([string]::IsNullOrWhiteSpace($commitMsg)) {
    $commitMsg = "style: update app theme"
}

Write-Host "2. Committing changes..." -ForegroundColor Cyan
git commit -m $commitMsg

Write-Host "3. Pushing changes to GitHub (triggers Jenkins)..." -ForegroundColor Cyan
git push origin main

Write-Host "4. Rebuilding local Docker containers..." -ForegroundColor Cyan
docker compose up --build -d

Write-Host "Sync and deployment initiated successfully!" -ForegroundColor Green
