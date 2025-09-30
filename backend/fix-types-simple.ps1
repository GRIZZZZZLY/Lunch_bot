# Simple script to fix telegramId types

Write-Host "Fixing telegramId types..." -ForegroundColor Cyan

# List of files to fix
$files = @(
    "src\api\middleware\telegram-auth.ts",
    "src\api\middleware\validate-init-data.ts",
    "src\bot\commands\help.ts",
    "src\bot\commands\menu.ts", 
    "src\bot\commands\startpoll.ts",
    "src\bot\handlers\poll.handlers.ts",
    "src\bot\middleware\auth.ts"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "Processing: $file" -ForegroundColor Yellow
        
        $content = Get-Content $file -Raw -Encoding UTF8
        
        # Replace patterns
        $content = $content -replace 'getUserByTelegramId\(user\.id\.toString\(\)\)', 'getUserByTelegramId(BigInt(user.id))'
        $content = $content -replace 'getUserByTelegramId\(user\.id\)', 'getUserByTelegramId(BigInt(user.id))'
        $content = $content -replace 'getUserByTelegramId\(telegramId\)', 'getUserByTelegramId(BigInt(telegramId))'
        $content = $content -replace 'isAdmin\(user\.id\.toString\(\)\)', 'isAdmin(BigInt(user.id))'
        
        Set-Content $file -Value $content -Encoding UTF8 -NoNewline
        Write-Host "  Done!" -ForegroundColor Green
    }
}

# Fix UserService
$userServiceFile = "src\services\user.service.ts"
if (Test-Path $userServiceFile) {
    Write-Host "Fixing UserService..." -ForegroundColor Yellow
    $content = Get-Content $userServiceFile -Raw -Encoding UTF8
    $content = $content -replace 'static async isAdmin\(telegramId: string\)', 'static async isAdmin(telegramId: bigint)'
    Set-Content $userServiceFile -Value $content -Encoding UTF8 -NoNewline
    Write-Host "  Done!" -ForegroundColor Green
}

Write-Host "`nAll fixes applied!" -ForegroundColor Green
