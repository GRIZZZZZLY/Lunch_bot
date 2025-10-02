# Script to add missing methods to service files

Write-Host "Adding missing methods to services..." -ForegroundColor Cyan

# 1. Add methods to VoteService
$voteServicePath = "src\services\vote.service.ts"
$voteContent = Get-Content $voteServicePath -Raw

# Insert createVote method after class declaration
$createVoteMethod = @"

  /**
   * Создание нового голоса
   */
  static async createVote(data: CreateVoteData): Promise<Vote> {
    try {
      const vote = await prisma.vote.create({
        data: {
          pollId: data.pollId,
          userId: data.userId,
          menuItemId: data.menuItemId,
        },
      });
      logger.info(``Vote created: user `${data.userId} voted for item `${data.menuItemId} in poll `${data.pollId}``);
      return vote;
    } catch (error) {
      logger.error('Error creating vote:', error);
      throw new Error('Failed to create vote');
    }
  }

  /**
   * Обновление существующего голоса
   */
  static async updateVote(voteId: number, menuItemId: number): Promise<Vote> {
    try {
      const vote = await prisma.vote.update({
        where: { id: voteId },
        data: {
          menuItemId,
          updatedAt: new Date(),
        },
      });
      logger.info(``Vote updated: vote `${voteId} changed to item `${menuItemId}``);
      return vote;
    } catch (error) {
      logger.error('Error updating vote:', error);
      throw new Error('Failed to update vote');
    }
  }

  /**
   * Получение детальной разбивки голосов по блюдам
   */
  static async getVoteBreakdown(pollId: number): Promise<Array<{
    menuItemId: number;
    menuItemName: string;
    votes: number;
    percentage: number;
    voters: Array<{ id: number; firstName: string; username?: string }>;
  }>> {
    try {
      const votes = await prisma.vote.findMany({
        where: { pollId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              username: true,
            },
          },
          menuItem: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      const totalVotes = votes.length;
      const breakdown = new Map<number, {
        menuItemName: string;
        votes: number;
        voters: Array<{ id: number; firstName: string; username?: string }>;
      }>();

      votes.forEach(vote => {
        const existing = breakdown.get(vote.menuItemId) || {
          menuItemName: vote.menuItem.name,
          votes: 0,
          voters: [],
        };
        existing.votes++;
        existing.voters.push({
          id: vote.user.id,
          firstName: vote.user.firstName,
          username: vote.user.username || undefined,
        });
        breakdown.set(vote.menuItemId, existing);
      });

      return Array.from(breakdown.entries())
        .map(([menuItemId, data]) => ({
          menuItemId,
          menuItemName: data.menuItemName,
          votes: data.votes,
          percentage: totalVotes > 0 ? Math.round((data.votes / totalVotes) * 100) : 0,
          voters: data.voters,
        }))
        .sort((a, b) => b.votes - a.votes);
    } catch (error) {
      logger.error('Error getting vote breakdown:', error);
      throw new Error('Failed to get vote breakdown');
    }
  }
"@

# Check if methods already exist
if ($voteContent -notmatch "static async createVote") {
    $voteContent = $voteContent -replace "export class VoteService \{", "export class VoteService {$createVoteMethod"
    [System.IO.File]::WriteAllText((Resolve-Path $voteServicePath), $voteContent, [System.Text.UTF8Encoding]::new($false))
    Write-Host "✓ Added methods to VoteService" -ForegroundColor Green
} else {
    Write-Host "✓ VoteService methods already exist" -ForegroundColor Yellow
}

# 2. Add methods to UserService
$userServicePath = "src\services\user.service.ts"
$userContent = Get-Content $userServicePath -Raw

$createUserMethod = @"

  /**
   * Создание нового пользователя
   */
  static async createUser(data: CreateUserData): Promise<User> {
    try {
      const user = await prisma.user.create({
        data: {
          telegramId: BigInt(data.telegramId),
          username: data.username,
          firstName: data.firstName,
          lastName: data.lastName,
          isAdmin: false,
          isActive: true,
        },
      });

      logger.info(``User created: `${user.telegramId} (`${user.firstName})``);
      return user;
    } catch (error) {
      logger.error('Error creating user:', error);
      throw new Error('Failed to create user');
    }
  }
"@

if ($userContent -notmatch "static async createUser") {
    $userContent = $userContent -replace "export class UserService \{", "export class UserService {$createUserMethod"
    [System.IO.File]::WriteAllText((Resolve-Path $userServicePath), $userContent, [System.Text.UTF8Encoding]::new($false))
    Write-Host "✓ Added createUser to UserService" -ForegroundColor Green
} else {
    Write-Host "✓ UserService.createUser already exists" -ForegroundColor Yellow
}

# 3. Add methods to PollService
$pollServicePath = "src\services\poll.service.ts"
$pollContent = Get-Content $pollServicePath -Raw

$savePollResultMethod = @"

  /**
   * Сохранение результата рулетки
   */
  static async savePollResult(data: {
    pollId: number;
    winnerMenuItemId?: number;
    responsibleUserId: number;
    totalVotes: number;
    rouletteData?: string;
  }): Promise<any> {
    try {
      const existing = await prisma.pollResult.findUnique({
        where: { pollId: data.pollId },
      });

      if (existing) {
        const result = await prisma.pollResult.update({
          where: { pollId: data.pollId },
          data: {
            responsibleUserId: data.responsibleUserId,
            updatedAt: new Date(),
          },
          include: {
            poll: true,
            winnerMenuItem: true,
            responsibleUser: true,
          },
        });
        logger.info(``Poll result updated for poll `${data.pollId}``);
        return result;
      } else {
        const result = await prisma.pollResult.create({
          data: {
            pollId: data.pollId,
            winnerMenuItemId: data.winnerMenuItemId,
            responsibleUserId: data.responsibleUserId,
            totalVotes: data.totalVotes,
          },
          include: {
            poll: true,
            winnerMenuItem: true,
            responsibleUser: true,
          },
        });
        logger.info(``Poll result created for poll `${data.pollId}``);
        return result;
      }
    } catch (error) {
      logger.error('Error saving poll result:', error);
      throw new Error('Failed to save poll result');
    }
  }
"@

if ($pollContent -notmatch "static async savePollResult") {
    # Find last method before closing brace
    $pollContent = $pollContent -replace "(\s+)}\s*$", "$savePollResultMethod`n`$1}"
    [System.IO.File]::WriteAllText((Resolve-Path $pollServicePath), $pollContent, [System.Text.UTF8Encoding]::new($false))
    Write-Host "✓ Added savePollResult to PollService" -ForegroundColor Green
} else {
    Write-Host "✓ PollService.savePollResult already exists" -ForegroundColor Yellow
}

Write-Host "`nDone! All missing methods added." -ForegroundColor Cyan
