# PowerShell script to fix telegramId type issues (string -> bigint)

Write-Host "===== Fixing telegramId Type Issues =====" -ForegroundColor Cyan

# Function to safely replace in file
function Replace-InFile {
    param(
        [string]$FilePath,
        [string]$Pattern,
        [string]$Replacement,
        [string]$Description
    )
    
    if (Test-Path $FilePath) {
        Write-Host "  Processing: $FilePath" -ForegroundColor Yellow
        try {
            $content = Get-Content $FilePath -Raw -Encoding UTF8
            $newContent = $content -replace $Pattern, $Replacement
            if ($content -ne $newContent) {
                Set-Content $FilePath -Value $newContent -Encoding UTF8 -NoNewline
                Write-Host "    ✓ $Description" -ForegroundColor Green
            } else {
                Write-Host "    - No changes needed" -ForegroundColor Gray
            }
        } catch {
            Write-Host "    ✗ Error: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "  ✗ File not found: $FilePath" -ForegroundColor Red
    }
}

Write-Host "`n1. Fixing API middleware files..." -ForegroundColor Cyan

# Fix telegram-auth.ts
Replace-InFile `
    -FilePath "src\api\middleware\telegram-auth.ts" `
    -Pattern 'getUserByTelegramId\(user\.id\)' `
    -Replacement 'getUserByTelegramId(BigInt(user.id))' `
    -Description "Fixed getUserByTelegramId call"

# Fix validate-init-data.ts
Replace-InFile `
    -FilePath "src\api\middleware\validate-init-data.ts" `
    -Pattern 'getUserByTelegramId\(telegramId\)' `
    -Replacement 'getUserByTelegramId(BigInt(telegramId))' `
    -Description "Fixed getUserByTelegramId call"

Write-Host "`n2. Fixing bot command files..." -ForegroundColor Cyan

# Fix help.ts
Replace-InFile `
    -FilePath "src\bot\commands\help.ts" `
    -Pattern 'getUserByTelegramId\(user\.id\.toString\(\)\)' `
    -Replacement 'getUserByTelegramId(BigInt(user.id))' `
    -Description "Fixed getUserByTelegramId call"

# Fix menu.ts
Replace-InFile `
    -FilePath "src\bot\commands\menu.ts" `
    -Pattern 'getUserByTelegramId\(user\.id\.toString\(\)\)' `
    -Replacement 'getUserByTelegramId(BigInt(user.id))' `
    -Description "Fixed getUserByTelegramId call"

# Fix startpoll.ts
Replace-InFile `
    -FilePath "src\bot\commands\startpoll.ts" `
    -Pattern 'getUserByTelegramId\(user\.id\.toString\(\)\)' `
    -Replacement 'getUserByTelegramId(BigInt(user.id))' `
    -Description "Fixed getUserByTelegramId call"

Write-Host "`n3. Fixing bot handler files..." -ForegroundColor Cyan

# Fix poll.handlers.ts
Replace-InFile `
    -FilePath "src\bot\handlers\poll.handlers.ts" `
    -Pattern 'getUserByTelegramId\(user\.id\.toString\(\)\)' `
    -Replacement 'getUserByTelegramId(BigInt(user.id))' `
    -Description "Fixed getUserByTelegramId call"

Replace-InFile `
    -FilePath "src\bot\handlers\poll.handlers.ts" `
    -Pattern 'isAdmin\(user\.id\.toString\(\)\)' `
    -Replacement 'isAdmin(BigInt(user.id))' `
    -Description "Fixed isAdmin call"

Write-Host "`n4. Fixing auth.ts middleware..." -ForegroundColor Cyan

Replace-InFile `
    -FilePath "src\bot\middleware\auth.ts" `
    -Pattern 'getUserByTelegramId\(user\.id\.toString\(\)\)' `
    -Replacement 'getUserByTelegramId(BigInt(user.id))' `
    -Description "Fixed getUserByTelegramId call"

Replace-InFile `
    -FilePath "src\bot\middleware\auth.ts" `
    -Pattern 'isAdmin\(user\.id\.toString\(\)\)' `
    -Replacement 'isAdmin(BigInt(user.id))' `
    -Description "Fixed isAdmin call"

Write-Host "`n5. Updating UserService method signatures..." -ForegroundColor Cyan

# Update isAdmin signature
Replace-InFile `
    -FilePath "src\services\user.service.ts" `
    -Pattern 'static async isAdmin\(telegramId: string\)' `
    -Replacement 'static async isAdmin(telegramId: bigint)' `
    -Description "Fixed isAdmin signature"

Write-Host "`n===== Type Fixes Completed =====" -ForegroundColor Green
Write-Host "Run 'npm run build' to verify fixes" -ForegroundColor Cyan
