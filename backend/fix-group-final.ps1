# Final fix for group.service.ts - Remove all syntax errors

Write-Host "Final fix for group.service.ts..." -ForegroundColor Cyan

$file = "src\services\group.service.ts"

$content = Get-Content $file -Raw -Encoding UTF8

# Fix all instances of "status: 'ACTIVE', true"
$content = $content -replace "status: 'ACTIVE', true", "status: 'ACTIVE'"

# Fix comment lines with groupMember - just remove them entirely
$lines = $content -Split "`r?`n"
$filteredLines = $lines | Where-Object { $_ -notmatch '^\s*//.*prisma\.groupMember' }
$content = $filteredLines -join "`r`n"

Set-Content $file -Value $content -Encoding UTF8 -NoNewline

Write-Host "  Fixed all syntax errors!" -ForegroundColor Green
Write-Host "Run 'npm run dev' to test" -ForegroundColor Cyan
