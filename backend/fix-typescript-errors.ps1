# PowerShell script to fix TypeScript errors in the project
# This script fixes schema mismatches between Prisma schema and code

Write-Host "===== Starting TypeScript Error Fixes =====" -ForegroundColor Cyan

# Fix 1: poll.handlers.ts - Line 47 - Wrong boolean comparison
Write-Host "Fix 1: Correcting boolean comparison in poll.handlers.ts..." -ForegroundColor Yellow
$file1 = "src\bot\handlers\poll.handlers.ts"
$content1 = Get-Content $file1 -Raw -Encoding UTF8
$content1 = $content1 -replace '(?m)^\s+if \(\!poll\.status === ''ACTIVE''\) \{', '    if (poll.status !== ''ACTIVE'') {'
Set-Content $file1 -Value $content1 -Encoding UTF8 -NoNewline
Write-Host "  ✓ Fixed boolean comparison" -ForegroundColor Green

# Fix 2: poll.handlers.ts - Remove undefined function call updatePollMessage
Write-Host "Fix 2: Commenting out undefined function updatePollMessage..." -ForegroundColor Yellow
$content1 = Get-Content $file1 -Raw -Encoding UTF8
$content1 = $content1 -replace '(?m)^\s+await updatePollMessage\(ctx, pollId\);', '    // await updatePollMessage(ctx, pollId); // TODO: Implement this function'
Set-Content $file1 -Value $content1 -Encoding UTF8 -NoNewline
Write-Host "  ✓ Commented out undefined function" -ForegroundColor Green

# Fix 3: poll.service.ts - Fix winnerItem to winnerMenuItem
Write-Host "Fix 3: Fixing field names in poll.service.ts..." -ForegroundColor Yellow
$file2 = "src\services\poll.service.ts"
$content2 = Get-Content $file2 -Raw -Encoding UTF8
$content2 = $content2 -replace 'winnerItem:', 'winnerMenuItem:'
$content2 = $content2 -replace 'responsible:', 'responsibleUser:'
Set-Content $file2 -Value $content2 -Encoding UTF8 -NoNewline
Write-Host "  ✓ Fixed field names" -ForegroundColor Green

# Fix 4: group.service.ts - Remove GroupMember import
Write-Host "Fix 4: Fixing GroupMember references in group.service.ts..." -ForegroundColor Yellow
$file3 = "src\services\group.service.ts"
$content3 = Get-Content $file3 -Raw -Encoding UTF8
$content3 = $content3 -replace ', GroupMember', ''
$content3 = $content3 -replace 'isActive:', 'status: ''ACTIVE'','
Set-Content $file3 -Value $content3 -Encoding UTF8 -NoNewline
Write-Host "  ✓ Fixed GroupMember imports" -ForegroundColor Green

# Fix 5: user.service.ts - Fix telegramId type from string to bigint
Write-Host "Fix 5: Fixing telegramId types in user.service.ts..." -ForegroundColor Yellow  
$file4 = "src\services\user.service.ts"
$content4 = Get-Content $file4 -Raw -Encoding UTF8
$content4 = $content4 -replace 'telegramId: string', 'telegramId: bigint'
$content4 = $content4 -replace 'telegramId: data\.telegramId', 'telegramId: BigInt(data.telegramId)'
Set-Content $file4 -Value $content4 -Encoding UTF8 -NoNewline
Write-Host "  ✓ Fixed telegramId types" -ForegroundColor Green

# Fix 6: auth.ts - Fix boolean comparison for poll.status
Write-Host "Fix 6: Fixing poll status checks in auth.ts..." -ForegroundColor Yellow
$file5 = "src\bot\middleware\auth.ts"  
$content5 = Get-Content $file5 -Raw -Encoding UTF8
$content5 = $content5 -replace '(?m)^\s+if \(\!poll\.status === ''ACTIVE''\) \{', '    if (poll.status !== ''ACTIVE'') {'
$content5 = $content5 -replace '(?m)^\s+if \(\!user\.status === ''ACTIVE''\) \{', '    if (!user.isActive) {'
Set-Content $file5 -Value $content5 -Encoding UTF8 -NoNewline
Write-Host "  ✓ Fixed poll status checks" -ForegroundColor Green

Write-Host "`n===== TypeScript Error Fixes Completed =====" -ForegroundColor Green
Write-Host "Please run 'npm run build' to verify the fixes" -ForegroundColor Cyan
