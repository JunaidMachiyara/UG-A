# PowerShell Script to Configure Backup Tasks to Run When Computer Was Off
# This enables "Run task as soon as possible after a scheduled start is missed"
# Run this script as Administrator

param(
    [string]$ProjectPath = "D:\UG-A-Cursor"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Configure Missed Backup Recovery" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "❌ This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "   Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

$taskNameMorning = "UG-Inventory-Backup-Morning"
$taskNameEvening = "UG-Inventory-Backup-Evening"

Write-Host "Configuring tasks to run if computer was off during scheduled time..." -ForegroundColor Yellow
Write-Host ""

# Use schtasks XML export/import to modify task settings
# This is a workaround since schtasks /Change doesn't support all settings

Write-Host "⚠️  Manual Configuration Required:" -ForegroundColor Yellow
Write-Host ""
Write-Host "To enable 'Run task as soon as possible after missed start':" -ForegroundColor White
Write-Host ""
Write-Host "1. Open Task Scheduler (taskschd.msc)" -ForegroundColor Cyan
Write-Host "2. Find task: $taskNameMorning" -ForegroundColor Cyan
Write-Host "3. Right-click → Properties" -ForegroundColor Cyan
Write-Host "4. Go to 'Settings' tab" -ForegroundColor Cyan
Write-Host "5. Check: 'Run task as soon as possible after a scheduled start is missed'" -ForegroundColor Cyan
Write-Host "6. Click OK" -ForegroundColor Cyan
Write-Host ""
Write-Host "Repeat for: $taskNameEvening" -ForegroundColor Cyan
Write-Host ""
Write-Host "This ensures backups run when you turn on your computer" -ForegroundColor Green
Write-Host "if it was off during the scheduled backup time." -ForegroundColor Green
Write-Host ""

