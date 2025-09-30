# Fix critical compilation errors

Write-Host "Fixing critical errors..." -ForegroundColor Cyan

# Fix 1: poll.handlers.ts - Fix responsibleUser order (line 313-314)
Write-Host "`n1. Fixing responsibleUser declaration order..." -ForegroundColor Yellow
$file1 = "src\bot\handlers\poll.handlers.ts"
$content = Get-Content $file1 -Raw -Encoding UTF8

# Find and fix the responsibleUser issue
$pattern = '(?s)(\/\/ [^\r\n]+\r?\n\s+)const winnerMention = `\[.+?\r?\n\s+const responsibleUser = '
$replacement = '$1const responsibleUser = '

$content = $content -replace $pattern, $replacement

# Remove duplicate winnerMention declaration
$content = $content -replace '(?m)^\s+const winnerMention = `\[.+?telegramId\}\)`;\r?\n\s+const responsibleUser', '    const responsibleUser'

Set-Content $file1 -Value $content -Encoding UTF8 -NoNewline
Write-Host "  Done!" -ForegroundColor Green

# Fix 2: poll.service.ts - Fix status comparison (line 128)
Write-Host "`n2. Fixing poll status comparison..." -ForegroundColor Yellow
$file2 = "src\services\poll.service.ts"
$content2 = Get-Content $file2 -Raw -Encoding UTF8
$content2 = $content2 -replace '(?m)^\s+if \(\!poll\.status === ''ACTIVE''\) \{', '      if (poll.status !== ''ACTIVE'') {'
Set-Content $file2 -Value $content2 -Encoding UTF8 -NoNewline
Write-Host "  Done!" -ForegroundColor Green

# Fix 3: Remove isRouletteRun field usage
Write-Host "`n3. Removing isRouletteRun field..." -ForegroundColor Yellow
$content2 = Get-Content $file2 -Raw -Encoding UTF8
$content2 = $content2 -replace 'isRouletteRun: false,', '// isRouletteRun: false, // Field removed from schema'
$content2 = $content2 -replace 'isRouletteRun: true,', '// isRouletteRun: true, // Field removed from schema'
Set-Content $file2 -Value $content2 -Encoding UTF8 -NoNewline
Write-Host "  Done!" -ForegroundColor Green

# Fix 4: Fix results -> result in poll.service.ts
Write-Host "`n4. Fixing results field name..." -ForegroundColor Yellow
$content2 = Get-Content $file2 -Raw -Encoding UTF8
$content2 = $content2 -replace 'results:', 'result:'
Set-Content $file2 -Value $content2 -Encoding UTF8 -NoNewline
Write-Host "  Done!" -ForegroundColor Green

# Fix 5: Fix endTime -> check using duration
Write-Host "`n5. Fixing endTime field..." -ForegroundColor Yellow
$content2 = Get-Content $file2 -Raw -Encoding UTF8
$content2 = $content2 -replace '(?s)endTime: \{[^}]+\}', 'startedAt: { lte: new Date(Date.now() - 30 * 60 * 1000) }'
Set-Content $file2 -Value $content2 -Encoding UTF8 -NoNewline
Write-Host "  Done!" -ForegroundColor Green

# Fix 6: Fix vote.service.ts status checks
Write-Host "`n6. Fixing vote.service.ts..." -ForegroundColor Yellow
$file3 = "src\services\vote.service.ts"
$content3 = Get-Content $file3 -Raw -Encoding UTF8
$content3 = $content3 -replace "select: \{ status: 'ACTIVE'", "where: { status: 'ACTIVE' }, select: { id: true, status: true"
$content3 = $content3 -replace '(?m)^\s+if \(\!poll\.status === ''ACTIVE''\) \{', '      if (poll.status !== ''ACTIVE'') {'
$content3 = $content3 -replace 'isActive: false', "status: 'COMPLETED'"
Set-Content $file3 -Value $content3 -Encoding UTF8 -NoNewline
Write-Host "  Done!" -ForegroundColor Green

# Fix 7: Fix auth.ts status check
Write-Host "`n7. Fixing auth.ts..." -ForegroundColor Yellow
$file4 = "src\bot\middleware\auth.ts"
$content4 = Get-Content $file4 -Raw -Encoding UTF8
$content4 = $content4 -replace '(?m)^\s+if \(\!dbUser\?\.status === ''ACTIVE''\) \{', '    if (!dbUser?.isActive) {'
Set-Content $file4 -Value $content4 -Encoding UTF8 -NoNewline
Write-Host "  Done!" -ForegroundColor Green

# Fix 8: Fix group.service.ts - Remove GroupMember
Write-Host "`n8. Fixing group.service.ts..." -ForegroundColor Yellow
$file5 = "src\services\group.service.ts"
$content5 = Get-Content $file5 -Raw -Encoding UTF8
$content5 = $content5 -replace ', GroupMember', ''
$content5 = $content5 -replace 'prisma\.groupMember', '// prisma.groupMember // Model removed'
$content5 = $content5 -replace 'isActive:', "status: 'ACTIVE',"
$content5 = $content5 -replace 'data\.telegramId', 'BigInt(data.telegramId)'
$content5 = $content5 -replace 'where: \{ telegramId \}', 'where: { telegramId: BigInt(telegramId) }'
$content5 = $content5 -replace 'where: \{ telegramId:', 'where: { telegramId: BigInt('
$content5 = $content5 -replace '\},\s*\r?\n\s*update:', ') }, update:'
Set-Content $file5 -Value $content5 -Encoding UTF8 -NoNewline
Write-Host "  Done!" -ForegroundColor Green

Write-Host "`n===== All critical fixes applied! =====" -ForegroundColor Green
Write-Host "Run 'npm run build' to verify" -ForegroundColor Cyan
