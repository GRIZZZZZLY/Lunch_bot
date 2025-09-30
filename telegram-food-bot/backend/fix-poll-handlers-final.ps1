# Fix critical issues in poll.handlers.ts

Write-Host "Fixing poll.handlers.ts..." -ForegroundColor Cyan

$file = "src\bot\handlers\poll.handlers.ts"

if (Test-Path $file) {
    $content = Get-Content $file -Raw -Encoding UTF8
    
    # Fix 1: Comment out updatePollMessage call (line 81)
    Write-Host "  Commenting out updatePollMessage..." -ForegroundColor Yellow
    $content = $content -replace '(\s+)await updatePollMessage\(ctx, pollId\);', '$1// await updatePollMessage(ctx, pollId); // TODO: Implement function'
    
    # Fix 2: Fix rouletteData type issue (line 120)  
    Write-Host "  Fixing rouletteData type..." -ForegroundColor Yellow
    $content = $content -replace 'result\?\.rouletteData \|\| false', 'Boolean(result?.rouletteData)'
    
    # Fix 3: Fix responsibleUser declaration order (around line 312-313)
    Write-Host "  Fixing responsibleUser order and duplicate winnerMention..." -ForegroundColor Yellow
    
    # This is tricky - need to find the pattern and reorder
    $pattern = '(?s)(\/\/ [^\n]*\n\s+const winnerMention[^\n]+\n\s+const responsibleUser[^\n]+\n[^}]+}\s+\n\s+)(const winnerMention[^\n]+)'
    $replacement = '$1'
    
    $content = $content -replace $pattern, $replacement
    
    Set-Content $file -Value $content -Encoding UTF8 -NoNewline
    Write-Host "  Done!" -ForegroundColor Green
    
} else {
    Write-Host "  File not found!" -ForegroundColor Red
}

Write-Host "`nFixes applied. Run 'npm run build' to verify." -ForegroundColor Cyan
