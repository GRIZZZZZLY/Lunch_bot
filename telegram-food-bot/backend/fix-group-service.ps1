# Fix group.service.ts syntax errors

Write-Host "Fixing group.service.ts..." -ForegroundColor Cyan

$file = "src\services\group.service.ts"
$backup = "src\services\group.service.ts.backup2"

# Backup first
Copy-Item $file $backup -Force
Write-Host "  Backup created: $backup" -ForegroundColor Gray

$content = Get-Content $file -Raw -Encoding UTF8

# Fix double BigInt
$content = $content -replace 'BigInt\(\s*BigInt\(', 'BigInt('

# Fix where clause with missing closing paren
$content = $content -replace 'where: \{ telegramId: BigInt\(\s*([^)]+)\s*\}\s*,', 'where: { telegramId: BigInt($1) },'

# Fix status with extra true
$content = $content -replace "status: 'ACTIVE',\s*true,", "isActive: true,"

# Fix all commented groupMember references - just remove the lines
$content = $content -replace '(?m)^\s*\/\/ prisma\.groupMember.*$\r?\n', ''

Set-Content $file -Value $content -Encoding UTF8 -NoNewline

Write-Host "  Fixed!" -ForegroundColor Green
Write-Host "Run 'npm run build' to verify" -ForegroundColor Cyan
