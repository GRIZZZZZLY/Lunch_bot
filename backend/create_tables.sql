-- Create Poll table
CREATE TABLE IF NOT EXISTS "Poll" (
  "id" SERIAL PRIMARY KEY,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "createdBy" INTEGER NOT NULL,
  "groupId" INTEGER NOT NULL,
  "status" TEXT DEFAULT 'ACTIVE' NOT NULL,
  "duration" INTEGER NOT NULL,
  "startedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "endedAt" TIMESTAMP,
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE,
  FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE
);

-- Create Vote table
CREATE TABLE IF NOT EXISTS "Vote" (
  "id" SERIAL PRIMARY KEY,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "pollId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "menuItemId" INTEGER NOT NULL,
  FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE
);

-- Create unique constraint for user votes in a poll
CREATE UNIQUE INDEX IF NOT EXISTS "Vote_userId_pollId_key" ON "Vote"("userId", "pollId");

-- Create PollResult table
CREATE TABLE IF NOT EXISTS "PollResult" (
  "id" SERIAL PRIMARY KEY,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "pollId" INTEGER NOT NULL,
  "winnerMenuItemId" INTEGER,
  "responsibleUserId" INTEGER NOT NULL,
  "totalVotes" INTEGER NOT NULL,
  "rouletteData" JSONB NOT NULL,
  FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE,
  FOREIGN KEY ("winnerMenuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL,
  FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Create unique constraint for poll results
CREATE UNIQUE INDEX IF NOT EXISTS "PollResult_pollId_key" ON "PollResult"("pollId");

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "Poll_groupId_status_idx" ON "Poll"("groupId", "status");
CREATE INDEX IF NOT EXISTS "Poll_status_startedAt_idx" ON "Poll"("status", "startedAt");
CREATE INDEX IF NOT EXISTS "Vote_pollId_idx" ON "Vote"("pollId");
CREATE INDEX IF NOT EXISTS "Vote_userId_idx" ON "Vote"("userId");
CREATE INDEX IF NOT EXISTS "Vote_menuItemId_idx" ON "Vote"("menuItemId");
CREATE INDEX IF NOT EXISTS "PollResult_pollId_idx" ON "PollResult"("pollId");
