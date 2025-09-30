# Fix poll.handlers.ts syntax errors
$filePath = "src\bot\handlers\poll.handlers.ts"
$content = Get-Content $filePath -Raw -Encoding UTF8

# Fix 1: Add try block and poll variable declaration
$pattern1 = 'async function updatePollMessage\(ctx: CallbackQueryContext<BotContext>, pollId: number\): Promise<void> \{\s+if \(\!poll\) return;'
$replacement1 = @'
async function updatePollMessage(ctx: CallbackQueryContext<BotContext>, pollId: number): Promise<void> {
  try {
    const poll = await PollService.getPollById(pollId);
    if (!poll) return;
'@
$content = $content -replace $pattern1, $replacement1

# Save the file
$content | Set-Content $filePath -Encoding UTF8 -NoNewline

Write-Host "Fixed poll.handlers.ts successfully!" -ForegroundColor Green
