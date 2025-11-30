# Netlify Debug Build Script
# Run this to get detailed build logs

Write-Host "Starting verbose build..." -ForegroundColor Cyan

# Set environment variables for detailed logging
$env:DEBUG = "*"
$env:CI = "true"
$env:NODE_OPTIONS = "--max-old-space-size=4096"

Write-Host "`nRunning npm install..." -ForegroundColor Yellow
npm install

Write-Host "`nRunning build with verbose output..." -ForegroundColor Yellow
npm run build -- --logLevel verbose 2>&1 | Tee-Object -FilePath build-log.txt

Write-Host "`nBuild complete. Check build-log.txt for details." -ForegroundColor Green
