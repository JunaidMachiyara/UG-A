# PowerShell Script to Schedule Automatic Backups in Windows Task Scheduler
# Run this script as Administrator to set up automatic backups

param(
    [string]$ProjectPath = "D:\UG-A-Cursor"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Automatic Backup Scheduler Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "❌ This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "   Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

$backupScriptMorning = Join-Path $ProjectPath "scripts\backup-morning.bat"
$backupScriptEvening = Join-Path $ProjectPath "scripts\backup-evening.bat"
$nodePath = where.exe node

if (-not (Test-Path $backupScriptMorning)) {
    Write-Host "❌ Morning backup script not found: $backupScriptMorning" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $backupScriptEvening)) {
    Write-Host "❌ Evening backup script not found: $backupScriptEvening" -ForegroundColor Red
    exit 1
}

if (-not $nodePath) {
    Write-Host "❌ Node.js not found in PATH!" -ForegroundColor Red
    Write-Host "   Please install Node.js or add it to PATH" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Morning backup script found: $backupScriptMorning" -ForegroundColor Green
Write-Host "✅ Evening backup script found: $backupScriptEvening" -ForegroundColor Green
Write-Host "✅ Node.js found: $nodePath" -ForegroundColor Green
Write-Host ""

# Create scheduled tasks
$taskNameMorning = "UG-Inventory-Backup-Morning"
$taskNameEvening = "UG-Inventory-Backup-Evening"

# Remove existing tasks if they exist
Write-Host "Removing existing tasks (if any)..." -ForegroundColor Yellow
schtasks /Delete /TN $taskNameMorning /F 2>$null
schtasks /Delete /TN $taskNameEvening /F 2>$null

# Create Morning Backup Task (8:00 AM daily)
Write-Host "Creating Morning Backup Task (8:00 AM)..." -ForegroundColor Yellow
$morningAction = "cmd.exe /c `"$backupScriptMorning`""
# Add /RL HIGHEST for elevated privileges and configure to run missed tasks
$resultMorning = schtasks /Create /TN $taskNameMorning /TR $morningAction /SC DAILY /ST 08:00 /RU "SYSTEM" /RL HIGHEST /F 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Morning backup scheduled successfully!" -ForegroundColor Green
    # Configure task to run if missed (when computer was off)
    schtasks /Change /TN $taskNameMorning /ENABLE 2>&1 | Out-Null
    # Note: We'll need to manually set "Run task as soon as possible after a scheduled start is missed" via Task Scheduler GUI
    Write-Host "   ⚠️  Note: Enable 'Run task as soon as possible after missed start' in Task Scheduler" -ForegroundColor Yellow
} else {
    Write-Host "❌ Failed to create morning backup task" -ForegroundColor Red
    Write-Host "   Error: $resultMorning" -ForegroundColor Red
}

# Create Evening Backup Task (8:00 PM daily)
Write-Host "Creating Evening Backup Task (8:00 PM)..." -ForegroundColor Yellow
$eveningAction = "cmd.exe /c `"$backupScriptEvening`""
$resultEvening = schtasks /Create /TN $taskNameEvening /TR $eveningAction /SC DAILY /ST 20:00 /RU "SYSTEM" /RL HIGHEST /F 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Evening backup scheduled successfully!" -ForegroundColor Green
    # Configure task to run if missed (when computer was off)
    schtasks /Change /TN $taskNameEvening /ENABLE 2>&1 | Out-Null
    # Note: We'll need to manually set "Run task as soon as possible after a scheduled start is missed" via Task Scheduler GUI
    Write-Host "   ⚠️  Note: Enable 'Run task as soon as possible after missed start' in Task Scheduler" -ForegroundColor Yellow
} else {
    Write-Host "❌ Failed to create evening backup task" -ForegroundColor Red
    Write-Host "   Error: $resultEvening" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Scheduled Tasks:" -ForegroundColor Yellow
Write-Host "  • Morning Backup: Daily at 8:00 AM" -ForegroundColor White
Write-Host "  • Evening Backup: Daily at 8:00 PM" -ForegroundColor White
Write-Host ""
Write-Host "To view/manage tasks:" -ForegroundColor Yellow
Write-Host "  • Open Task Scheduler (taskschd.msc)" -ForegroundColor White
Write-Host "  • Look for: $taskNameMorning" -ForegroundColor White
Write-Host "  • Look for: $taskNameEvening" -ForegroundColor White
Write-Host ""
Write-Host "To test backup manually:" -ForegroundColor Yellow
Write-Host "  cd $ProjectPath" -ForegroundColor White
Write-Host "  npm run backup" -ForegroundColor White
Write-Host ""

