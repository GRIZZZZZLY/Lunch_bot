@echo off
set DATABASE_URL=postgresql://foodbot:foodbot_password@localhost:5432/foodbot_db
npx prisma db push --schema="C:\BOT_V2\telegram-food-bot\backend\prisma\schema.prisma"
