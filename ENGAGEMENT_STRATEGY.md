# 🚀 Стратегия вовлечённости: Монетизация, Социализация и Геймификация

## 📊 Анализ текущего состояния

### Реализованные возможности
- ✅ Система голосований с рулеткой
- ✅ Управление меню и категориями
- ✅ Система транзакций и расчётов (Budget Tracker)
- ✅ Push-уведомления
- ✅ Выбор ответственного (рулетка/волонтёр)
- ✅ Напоминания об оплате
- ✅ Mini App с современным UI

### Возможности для развития
- ⚠️ Отсутствие монетизации
- ⚠️ Ограниченная социализация (только голосование)
- ⚠️ Нет геймификации и системы мотивации
- ⚠️ Нет рейтингов и достижений
- ⚠️ Нет соревновательных механик

---

## 💰 Часть 1: МОНЕТИЗАЦИЯ

### 1.1 Бизнес-модель: Freemium + Enterprise

#### 🎯 FREE Tier (базовая функциональность)
**Что остаётся бесплатным:**
- ✅ Голосования (до 50/месяц на группу)
- ✅ Управление меню (до 30 блюд)
- ✅ Базовая статистика
- ✅ Выбор ответственного (рулетка)
- ✅ Напоминания об оплате (до 3 автоматических)

**Ограничения:**
- Максимум 1 активное голосование одновременно
- История голосований 30 дней
- Стандартная поддержка (community)

#### 💎 PREMIUM Tier (150₽/месяц на группу)
**Дополнительные возможности:**
- ✨ Неограниченные голосования
- ✨ Расширенное меню (до 200 блюд)
- ✨ Кастомные категории и теги
- ✨ Расширенная статистика (графики, тренды)
- ✨ Экспорт данных (CSV, Excel)
- ✨ Автоматические повторяющиеся голосования (по расписанию)
- ✨ Кастомизация внешнего вида Mini App
- ✨ Приоритетные уведомления
- ✨ История на 6 месяцев

#### 🏢 ENTERPRISE Tier (от 500₽/месяц)
**Для компаний 20+ человек:**
- 🔥 Всё из Premium +
- 🔥 Интеграция с корпоративными системами (1C, SAP)
- 🔥 Multi-группа управление
- 🔥 API доступ для автоматизации
- 🔥 Белый лейбл (свой брендинг)
- 🔥 Выделенная поддержка (SLA 2 часа)
- 🔥 Корпоративная аналитика
- 🔥 Система согласования бюджетов
- 🔥 Безлимитная история

### 1.2 Дополнительные revenue streams

#### A. Комиссия с заказов (Marketplace модель)
**Концепция:** Интеграция с доставкой еды
- Партнёрство с Яндекс.Еда, Delivery Club
- Бот предлагает заказать победившее блюдо напрямую
- Комиссия 3-5% с каждого заказа

**Техническая реализация:**
- API интеграции с партнёрами
- Affiliate tracking через deep links
- Автоматическое разделение счёта между участниками

#### B. Премиум фичи (a la carte)
**Разовые покупки без подписки:**
- 🎨 Премиум темы оформления (50₽)
- 📊 Детальный отчёт за период (30₽)
- 🎯 Boost голосования (реклама в других группах) (100₽)
- 🏆 Именной бейдж в профиле (20₽/месяц)

#### C. Корпоративные пакеты
**B2B продажи:**
- Пакет на 10 групп: 1000₽/месяц
- Пакет на 50 групп: 4000₽/месяц
- Volume licensing со скидками

### 1.3 Техническая реализация монетизации

#### Архитектура подписок

**Новые таблицы в schema.prisma:**

```prisma
model Subscription {
  id              Int       @id @default(autoincrement())
  groupId         Int       @unique @map("group_id")
  tier            String    @default("FREE")  // FREE, PREMIUM, ENTERPRISE
  status          String    @default("ACTIVE") // ACTIVE, EXPIRED, CANCELLED, TRIAL
  startedAt       DateTime  @default(now()) @map("started_at")
  expiresAt       DateTime? @map("expires_at")
  autoRenew       Boolean   @default(true) @map("auto_renew")
  paymentMethod   String?   @map("payment_method") // CARD, YOO_MONEY, etc
  price           Float?    // Paid price (for history)
  
  group           Group     @relation(fields: [groupId], references: [id])
  payments        Payment[]
  
  @@map("subscriptions")
}

model Payment {
  id              Int       @id @default(autoincrement())
  subscriptionId  Int       @map("subscription_id")
  amount          Float
  currency        String    @default("RUB")
  status          String    @default("PENDING") // PENDING, COMPLETED, FAILED, REFUNDED
  provider        String    // YOOKASSA, STRIPE, CLOUDPAYMENTS
  providerId      String?   @map("provider_id") // External transaction ID
  metadata        String?   // JSON with additional data
  createdAt       DateTime  @default(now()) @map("created_at")
  completedAt     DateTime? @map("completed_at")
  
  subscription    Subscription @relation(fields: [subscriptionId], references: [id])
  
  @@map("payments")
}

model FeatureUsage {
  id              Int       @id @default(autoincrement())
  groupId         Int       @map("group_id")
  feature         String    // POLL_CREATED, MENU_ITEM_ADDED, EXPORT_DATA, etc
  usedAt          DateTime  @default(now()) @map("used_at")
  metadata        String?   // JSON with feature-specific data
  
  group           Group     @relation(fields: [groupId], references: [id])
  
  @@index([groupId, feature])
  @@index([usedAt])
  @@map("feature_usage")
}
```

#### Middleware для проверки подписки

**backend/src/api/middleware/subscription.ts:**

```typescript
import { Request, Response, NextFunction } from 'express';
import { SubscriptionService } from '../../services/subscription.service';
import { logger } from '../../utils/logger';

export async function requireSubscription(
  tiers: ('FREE' | 'PREMIUM' | 'ENTERPRISE')[]
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const groupId = parseInt(req.body.groupId || req.query.groupId);
      
      if (!groupId) {
        return res.status(400).json({ error: 'Group ID required' });
      }
      
      const subscription = await SubscriptionService.getSubscription(groupId);
      
      if (!subscription || subscription.status !== 'ACTIVE') {
        return res.status(402).json({ 
          error: 'Subscription required',
          upgradeUrl: `/subscribe?group=${groupId}`
        });
      }
      
      if (!tiers.includes(subscription.tier as any)) {
        return res.status(403).json({ 
          error: 'Upgrade required',
          currentTier: subscription.tier,
          requiredTier: tiers,
          upgradeUrl: `/subscribe?group=${groupId}`
        });
      }
      
      req.subscription = subscription;
      next();
    } catch (error) {
      logger.error('Subscription check error:', error);
      next(error);
    }
  };
}

export async function checkFeatureLimit(feature: string, limit: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const groupId = parseInt(req.body.groupId || req.query.groupId);
      
      const usage = await SubscriptionService.getFeatureUsage(groupId, feature);
      
      if (usage >= limit) {
        return res.status(429).json({ 
          error: 'Feature limit reached',
          feature,
          limit,
          current: usage,
          upgradeUrl: `/subscribe?group=${groupId}`
        });
      }
      
      next();
    } catch (error) {
      logger.error('Feature limit check error:', error);
      next(error);
    }
  };
}
```

#### Сервис подписок

**backend/src/services/subscription.service.ts:**

```typescript
import { Subscription, Payment } from '@prisma/client';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import YooKassa from 'yookassa';

// Initialize payment provider
const yookassa = new YooKassa({
  shopId: process.env.YOOKASSA_SHOP_ID!,
  secretKey: process.env.YOOKASSA_SECRET_KEY!
});

export class SubscriptionService {
  
  // Get subscription for group
  static async getSubscription(groupId: number): Promise<Subscription | null> {
    const subscription = await prisma.subscription.findUnique({
      where: { groupId }
    });
    
    // Check if expired
    if (subscription && subscription.expiresAt && new Date() > subscription.expiresAt) {
      await this.expireSubscription(subscription.id);
      return null;
    }
    
    return subscription;
  }
  
  // Create subscription
  static async createSubscription(
    groupId: number,
    tier: 'FREE' | 'PREMIUM' | 'ENTERPRISE',
    durationDays: number = 30
  ): Promise<Subscription> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);
    
    return await prisma.subscription.create({
      data: {
        groupId,
        tier,
        status: tier === 'FREE' ? 'ACTIVE' : 'TRIAL',
        expiresAt: tier === 'FREE' ? null : expiresAt
      }
    });
  }
  
  // Create payment
  static async createPayment(
    subscriptionId: number,
    amount: number,
    returnUrl: string
  ): Promise<{ payment: Payment; confirmationUrl: string }> {
    
    // Create payment in YooKassa
    const yooPayment = await yookassa.createPayment({
      amount: {
        value: amount.toFixed(2),
        currency: 'RUB'
      },
      confirmation: {
        type: 'redirect',
        return_url: returnUrl
      },
      description: `Подписка на бота (Subscription #${subscriptionId})`,
      capture: true
    });
    
    // Save payment to DB
    const payment = await prisma.payment.create({
      data: {
        subscriptionId,
        amount,
        currency: 'RUB',
        status: 'PENDING',
        provider: 'YOOKASSA',
        providerId: yooPayment.id
      }
    });
    
    logger.info(`Payment created: ${payment.id} for subscription ${subscriptionId}`);
    
    return {
      payment,
      confirmationUrl: yooPayment.confirmation.confirmation_url
    };
  }
  
  // Webhook handler for payment status
  static async handlePaymentWebhook(providerId: string, status: string) {
    const payment = await prisma.payment.findFirst({
      where: { providerId },
      include: { subscription: true }
    });
    
    if (!payment) {
      logger.error(`Payment not found: ${providerId}`);
      return;
    }
    
    if (status === 'succeeded') {
      // Update payment
      await prisma.payment.update({
        where: { id: payment.id },
        data: { 
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });
      
      // Activate subscription
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      
      await prisma.subscription.update({
        where: { id: payment.subscriptionId },
        data: {
          status: 'ACTIVE',
          expiresAt,
          price: payment.amount
        }
      });
      
      logger.info(`Subscription activated: ${payment.subscriptionId}`);
    } else if (status === 'canceled') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED' }
      });
    }
  }
  
  // Track feature usage
  static async trackFeatureUsage(
    groupId: number, 
    feature: string,
    metadata?: any
  ): Promise<void> {
    await prisma.featureUsage.create({
      data: {
        groupId,
        feature,
        metadata: metadata ? JSON.stringify(metadata) : null
      }
    });
  }
  
  // Get feature usage count
  static async getFeatureUsage(
    groupId: number,
    feature: string,
    since?: Date
  ): Promise<number> {
    const startDate = since || new Date(new Date().setDate(1)); // Start of month
    
    return await prisma.featureUsage.count({
      where: {
        groupId,
        feature,
        usedAt: { gte: startDate }
      }
    });
  }
  
  // Check if feature is available
  static async canUseFeature(
    groupId: number,
    feature: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const subscription = await this.getSubscription(groupId);
    
    if (!subscription) {
      return { allowed: false, reason: 'No active subscription' };
    }
    
    // Feature limits by tier
    const limits: Record<string, Record<string, number>> = {
      FREE: {
        POLL_CREATED: 50,
        MENU_ITEM: 30,
        CONCURRENT_POLLS: 1
      },
      PREMIUM: {
        POLL_CREATED: 999999,
        MENU_ITEM: 200,
        CONCURRENT_POLLS: 5
      },
      ENTERPRISE: {
        POLL_CREATED: 999999,
        MENU_ITEM: 999999,
        CONCURRENT_POLLS: 999999
      }
    };
    
    const limit = limits[subscription.tier]?.[feature];
    
    if (limit === undefined) {
      return { allowed: true }; // No limit for this feature
    }
    
    const usage = await this.getFeatureUsage(groupId, feature);
    
    if (usage >= limit) {
      return { 
        allowed: false, 
        reason: `Limit reached: ${usage}/${limit}` 
      };
    }
    
    return { allowed: true };
  }
  
  // Expire subscription
  private static async expireSubscription(subscriptionId: number): Promise<void> {
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'EXPIRED' }
    });
    
    logger.info(`Subscription expired: ${subscriptionId}`);
  }
}
```

#### Frontend компонент подписки

**frontend/src/components/subscription/SubscriptionModal.tsx:**

```tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Zap, Crown } from 'lucide-react';
import { subscriptionService } from '../../services/subscription.service';

interface SubscriptionTier {
  id: 'FREE' | 'PREMIUM' | 'ENTERPRISE';
  name: string;
  price: number;
  interval: string;
  icon: React.ReactNode;
  features: string[];
  popular?: boolean;
}

const tiers: SubscriptionTier[] = [
  {
    id: 'FREE',
    name: 'Бесплатный',
    price: 0,
    interval: 'навсегда',
    icon: <Check className="w-6 h-6" />,
    features: [
      'До 50 голосований/месяц',
      'До 30 блюд в меню',
      'Базовая статистика',
      'Рулетка ответственных',
      'История 30 дней'
    ]
  },
  {
    id: 'PREMIUM',
    name: 'Премиум',
    price: 150,
    interval: 'в месяц',
    icon: <Zap className="w-6 h-6 text-yellow-500" />,
    popular: true,
    features: [
      'Неограниченные голосования',
      'До 200 блюд',
      'Расширенная аналитика',
      'Экспорт данных',
      'Автоматические голосования',
      'Кастомизация дизайна',
      'История 6 месяцев',
      'Приоритетная поддержка'
    ]
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: 500,
    interval: 'в месяц',
    icon: <Crown className="w-6 h-6 text-purple-500" />,
    features: [
      'Всё из Premium',
      'Multi-группа управление',
      'API доступ',
      'Интеграции с 1C/SAP',
      'Белый лейбл',
      'SLA 2 часа',
      'Безлимитная история',
      'Выделенный менеджер'
    ]
  }
];

export function SubscriptionModal({ groupId, onClose }: { groupId: number; onClose: () => void }) {
  const [loading, setLoading] = useState<string | null>(null);
  
  const handleSubscribe = async (tier: SubscriptionTier) => {
    if (tier.id === 'FREE') return;
    
    setLoading(tier.id);
    
    try {
      const { paymentUrl } = await subscriptionService.createSubscription(groupId, tier.id);
      
      // Open payment page
      window.Telegram.WebApp.openLink(paymentUrl);
    } catch (error) {
      console.error('Subscription error:', error);
      alert('Ошибка при создании подписки');
    } finally {
      setLoading(null);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-2">Выберите тариф</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Разблокируйте все возможности бота
          </p>
          
          <div className="grid md:grid-cols-3 gap-6">
            {tiers.map((tier) => (
              <motion.div
                key={tier.id}
                whileHover={{ scale: 1.02 }}
                className={`
                  relative rounded-xl border-2 p-6
                  ${tier.popular 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                    : 'border-gray-200 dark:border-gray-700'
                  }
                `}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Популярный
                  </div>
                )}
                
                <div className="flex items-center gap-2 mb-4">
                  {tier.icon}
                  <h3 className="text-xl font-bold">{tier.name}</h3>
                </div>
                
                <div className="mb-6">
                  <span className="text-4xl font-bold">{tier.price}₽</span>
                  <span className="text-gray-600 dark:text-gray-400 ml-2">
                    {tier.interval}
                  </span>
                </div>
                
                <ul className="space-y-3 mb-6">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <button
                  onClick={() => handleSubscribe(tier)}
                  disabled={tier.id === 'FREE' || loading === tier.id}
                  className={`
                    w-full py-3 rounded-lg font-semibold transition-colors
                    ${tier.id === 'FREE'
                      ? 'bg-gray-200 text-gray-500 cursor-default'
                      : tier.popular
                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                        : 'bg-gray-800 text-white hover:bg-gray-700'
                    }
                  `}
                >
                  {loading === tier.id ? 'Загрузка...' : 
                   tier.id === 'FREE' ? 'Текущий тариф' : 'Выбрать'}
                </button>
              </motion.div>
            ))}
          </div>
          
          <button
            onClick={onClose}
            className="mt-6 w-full py-2 text-gray-600 hover:text-gray-800"
          >
            Закрыть
          </button>
        </div>
      </motion.div>
    </div>
  );
}
```

### 1.4 Интеграция платёжных систем

#### YooKassa (Рекомендуется для РФ)

```bash
npm install yookassa
```

**backend/.env:**
```env
YOOKASSA_SHOP_ID=your_shop_id
YOOKASSA_SECRET_KEY=your_secret_key
```

#### Webhook endpoint

**backend/src/api/routes/webhook.routes.ts:**

```typescript
import { Router } from 'express';
import { SubscriptionService } from '../../services/subscription.service';

const router = Router();

router.post('/yookassa', async (req, res) => {
  try {
    const { object } = req.body;
    
    if (object.status === 'succeeded' || object.status === 'canceled') {
      await SubscriptionService.handlePaymentWebhook(
        object.id,
        object.status
      );
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
```

---

## 👥 Часть 2: СОЦИАЛИЗАЦИЯ

### 2.1 Система рейтингов

#### Концепция многомерного рейтинга

**Типы рейтингов:**

1. **Гастрономический рейтинг** 🍽️
   - Основан на выборе популярных блюд
   - +10 XP за голосование
   - +50 XP если твой выбор победил
   - Бонус за первое голосование дня: +20 XP

2. **Рейтинг ответственности** 🎯
   - За выполнение роли ответственного
   - +100 XP за успешную организацию заказа
   - +50 XP за волонтёрство (без рулетки)
   - Штраф -30 XP за отказ от ответственности

3. **Социальный рейтинг** 🤝
   - За активность и помощь команде
   - +25 XP за добавление нового блюда в меню
   - +15 XP за оплату в срок
   - +40 XP за напоминание о голосовании другим

4. **Рейтинг открывателя** 🔍
   - За исследование новых блюд
   - +30 XP за голос за новое блюдо (в первый раз)
   - +60 XP если новое блюдо победило
   - Ачивка "Первопроходец" за 10 новых блюд

#### Техническая реализация рейтингов

**Расширение schema.prisma:**

```prisma
model UserStats {
  id                    Int      @id @default(autoincrement())
  userId                Int      @unique @map("user_id")
  totalXP               Int      @default(0) @map("total_xp")
  level                 Int      @default(1)
  gastroRating          Int      @default(0) @map("gastro_rating")
  responsibleRating     Int      @default(0) @map("responsible_rating")
  socialRating          Int      @default(0) @map("social_rating")
  explorerRating        Int      @default(0) @map("explorer_rating")
  
  pollsParticipated     Int      @default(0) @map("polls_participated")
  pollsWon              Int      @default(0) @map("polls_won")
  timesResponsible      Int      @default(0) @map("times_responsible")
  timesVolunteer        Int      @default(0) @map("times_volunteer")
  menuItemsAdded        Int      @default(0) @map("menu_items_added")
  paymentsOnTime        Int      @default(0) @map("payments_on_time")
  newDishesDiscovered   Int      @default(0) @map("new_dishes_discovered")
  
  currentStreak         Int      @default(0) @map("current_streak")
  longestStreak         Int      @default(0) @map("longest_streak")
  lastVoteDate          DateTime? @map("last_vote_date")
  
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")
  
  user                  User     @relation(fields: [userId], references: [id])
  xpHistory             XPHistory[]
  achievements          UserAchievement[]
  
  @@map("user_stats")
}

model XPHistory {
  id          Int       @id @default(autoincrement())
  userId      Int       @map("user_id")
  amount      Int       // Can be negative
  reason      String
  category    String    // GASTRO, RESPONSIBLE, SOCIAL, EXPLORER
  metadata    String?   // JSON with context
  earnedAt    DateTime  @default(now()) @map("earned_at")
  
  user        User      @relation(fields: [userId], references: [id])
  stats       UserStats @relation(fields: [userId], references: [userId])
  
  @@index([userId])
  @@index([earnedAt])
  @@map("xp_history")
}

model Achievement {
  id          Int       @id @default(autoincrement())
  key         String    @unique
  title       String
  description String
  icon        String    // Emoji or icon name
  category    String
  rarity      String    // COMMON, RARE, EPIC, LEGENDARY
  xpReward    Int       @map("xp_reward")
  requirement String    // JSON with requirement logic
  
  users       UserAchievement[]
  
  @@map("achievements")
}

model UserAchievement {
  id              Int       @id @default(autoincrement())
  userId          Int       @map("user_id")
  achievementId   Int       @map("achievement_id")
  unlockedAt      DateTime  @default(now()) @map("unlocked_at")
  progress        Float     @default(0) // 0-100% for progressive achievements
  
  user            User      @relation(fields: [userId], references: [id])
  stats           UserStats @relation(fields: [userId], references: [userId])
  achievement     Achievement @relation(fields: [achievementId], references: [id])
  
  @@unique([userId, achievementId])
  @@map("user_achievements")
}

// Update User model to add relations
model User {
  // ... existing fields
  stats           UserStats?
  xpHistory       XPHistory[]
  achievements    UserAchievement[]
}
```

#### Сервис геймификации

**backend/src/services/gamification.service.ts:**

```typescript
import { prisma } from '../database/client';
import { logger } from '../utils/logger';

export class GamificationService {
  
  // Calculate level from XP (exponential curve)
  static calculateLevel(xp: number): number {
    return Math.floor(Math.sqrt(xp / 100)) + 1;
  }
  
  // XP needed for next level
  static xpForNextLevel(level: number): number {
    return Math.pow(level, 2) * 100;
  }
  
  // Award XP
  static async awardXP(
    userId: number,
    amount: number,
    reason: string,
    category: 'GASTRO' | 'RESPONSIBLE' | 'SOCIAL' | 'EXPLORER',
    metadata?: any
  ): Promise<void> {
    
    // Get or create user stats
    let stats = await prisma.userStats.findUnique({ where: { userId } });
    
    if (!stats) {
      stats = await prisma.userStats.create({
        data: { userId }
      });
    }
    
    // Add XP
    const newTotalXP = stats.totalXP + amount;
    const newLevel = this.calculateLevel(newTotalXP);
    const leveledUp = newLevel > stats.level;
    
    // Update stats
    const updates: any = {
      totalXP: newTotalXP,
      level: newLevel
    };
    
    // Update category rating
    switch (category) {
      case 'GASTRO':
        updates.gastroRating = stats.gastroRating + amount;
        break;
      case 'RESPONSIBLE':
        updates.responsibleRating = stats.responsibleRating + amount;
        break;
      case 'SOCIAL':
        updates.socialRating = stats.socialRating + amount;
        break;
      case 'EXPLORER':
        updates.explorerRating = stats.explorerRating + amount;
        break;
    }
    
    await prisma.$transaction([
      // Update stats
      prisma.userStats.update({
        where: { userId },
        data: updates
      }),
      
      // Create XP history entry
      prisma.xPHistory.create({
        data: {
          userId,
          amount,
          reason,
          category,
          metadata: metadata ? JSON.stringify(metadata) : null
        }
      })
    ]);
    
    // Check for new achievements
    await this.checkAchievements(userId);
    
    // Notify if leveled up
    if (leveledUp) {
      await this.notifyLevelUp(userId, newLevel);
    }
    
    logger.info(`Awarded ${amount} XP to user ${userId}: ${reason}`);
  }
  
  // Update streak
  static async updateStreak(userId: number): Promise<void> {
    const stats = await prisma.userStats.findUnique({ where: { userId } });
    
    if (!stats) return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastVote = stats.lastVoteDate ? new Date(stats.lastVoteDate) : null;
    lastVote?.setHours(0, 0, 0, 0);
    
    let newStreak = stats.currentStreak;
    
    if (!lastVote) {
      // First vote ever
      newStreak = 1;
    } else {
      const daysDiff = Math.floor((today.getTime() - lastVote.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 0) {
        // Already voted today
        return;
      } else if (daysDiff === 1) {
        // Consecutive day
        newStreak++;
        
        // Bonus XP for streak milestones
        if (newStreak % 7 === 0) {
          await this.awardXP(
            userId,
            50,
            `Серия ${newStreak} дней!`,
            'SOCIAL',
            { streakMilestone: newStreak }
          );
        }
      } else {
        // Streak broken
        newStreak = 1;
      }
    }
    
    await prisma.userStats.update({
      where: { userId },
      data: {
        currentStreak: newStreak,
        longestStreak: Math.max(newStreak, stats.longestStreak),
        lastVoteDate: new Date()
      }
    });
  }
  
  // Check and unlock achievements
  static async checkAchievements(userId: number): Promise<void> {
    const stats = await prisma.userStats.findUnique({
      where: { userId },
      include: {
        achievements: { include: { achievement: true } }
      }
    });
    
    if (!stats) return;
    
    // Get all achievements
    const allAchievements = await prisma.achievement.findMany();
    
    // Check each achievement
    for (const achievement of allAchievements) {
      // Skip if already unlocked
      if (stats.achievements.some(a => a.achievementId === achievement.id)) {
        continue;
      }
      
      // Parse requirement
      const req = JSON.parse(achievement.requirement);
      
      // Check if requirement met
      const unlocked = this.checkAchievementRequirement(stats, req);
      
      if (unlocked) {
        await this.unlockAchievement(userId, achievement.id);
      }
    }
  }
  
  // Check if achievement requirement is met
  private static checkAchievementRequirement(stats: any, requirement: any): boolean {
    const { type, stat, value } = requirement;
    
    switch (type) {
      case 'stat_gte':
        return stats[stat] >= value;
      case 'stat_lte':
        return stats[stat] <= value;
      case 'level':
        return stats.level >= value;
      case 'streak':
        return stats.currentStreak >= value;
      default:
        return false;
    }
  }
  
  // Unlock achievement
  static async unlockAchievement(userId: number, achievementId: number): Promise<void> {
    const achievement = await prisma.achievement.findUnique({
      where: { id: achievementId }
    });
    
    if (!achievement) return;
    
    await prisma.$transaction([
      // Create user achievement
      prisma.userAchievement.create({
        data: {
          userId,
          achievementId,
          progress: 100
        }
      }),
      
      // Award XP
      prisma.xPHistory.create({
        data: {
          userId,
          amount: achievement.xpReward,
          reason: `Получена ачивка: ${achievement.title}`,
          category: 'SOCIAL'
        }
      }),
      
      // Update total XP
      prisma.userStats.update({
        where: { userId },
        data: {
          totalXP: { increment: achievement.xpReward }
        }
      })
    ]);
    
    // Send notification
    await this.notifyAchievement(userId, achievement);
    
    logger.info(`Achievement unlocked: ${achievement.key} for user ${userId}`);
  }
  
  // Get leaderboard
  static async getLeaderboard(
    category: 'TOTAL' | 'GASTRO' | 'RESPONSIBLE' | 'SOCIAL' | 'EXPLORER',
    limit: number = 10
  ): Promise<any[]> {
    const orderBy: any = {};
    
    switch (category) {
      case 'TOTAL':
        orderBy.totalXP = 'desc';
        break;
      case 'GASTRO':
        orderBy.gastroRating = 'desc';
        break;
      case 'RESPONSIBLE':
        orderBy.responsibleRating = 'desc';
        break;
      case 'SOCIAL':
        orderBy.socialRating = 'desc';
        break;
      case 'EXPLORER':
        orderBy.explorerRating = 'desc';
        break;
    }
    
    return await prisma.userStats.findMany({
      take: limit,
      orderBy,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            username: true
          }
        }
      }
    });
  }
  
  // Notifications
  private static async notifyLevelUp(userId: number, newLevel: number): Promise<void> {
    // Implementation depends on notification service
    logger.info(`User ${userId} leveled up to ${newLevel}`);
  }
  
  private static async notifyAchievement(userId: number, achievement: any): Promise<void> {
    // Implementation depends on notification service
    logger.info(`User ${userId} unlocked achievement: ${achievement.title}`);
  }
}
```

### 2.2 Система достижений (Ачивки)

#### Примеры достижений

**Гастрономические:**
- 🍽️ **"Первый укус"** - Проголосовать впервые (10 XP)
- 🎯 **"Знаток вкуса"** - 10 побед подряд (100 XP) [RARE]
- 🌟 **"Гурман"** - Попробовать все категории блюд (150 XP) [EPIC]
- 👑 **"Легенда стола"** - 100 участий в голосованиях (500 XP) [LEGENDARY]

**Ответственности:**
- 🤝 **"Помощник"** - Стать ответственным впервые (50 XP)
- ⚡ **"Волонтёр"** - 5 раз вызваться добровольно (200 XP) [RARE]
- 💪 **"Организатор года"** - 50 раз быть ответственным (1000 XP) [LEGENDARY]

**Социальные:**
- 📱 **"Рано встаёт"** - Проголосовать первым 10 раз (75 XP)
- 🔥 **"Стример"** - Серия 7 дней подряд (100 XP) [RARE]
- 🏆 **"Марафонец"** - Серия 30 дней (500 XP) [EPIC]
- 💳 **"Честный плательщик"** - 20 оплат в срок (150 XP) [RARE]

**Исследовательские:**
- 🔍 **"Первопроходец"** - Попробовать 10 новых блюд (80 XP)
- 🌍 **"Искатель приключений"** - Попробовать 50 новых блюд (300 XP) [EPIC]
- 📝 **"Шеф-редактор"** - Добавить 10 блюд в меню (200 XP) [RARE]

**Скрытые (Easter Eggs):**
- 🎰 **"Везунчик"** - Выиграть 3 рулетки подряд (250 XP) [EPIC]
- 🎭 **"Изменчивый"** - Изменить голос 5 раз за одно голосование (50 XP)
- 🌙 **"Ночной дозор"** - Проголосовать после 23:00 (30 XP)
- 🐌 **"Опоздун"** - Проголосовать за 1 минуту до закрытия 5 раз (100 XP)

#### База достижений

**backend/src/database/seeders/seed-achievements.ts:**

```typescript
import { prisma } from '../client';

const achievements = [
  // Gastro
  {
    key: 'FIRST_VOTE',
    title: 'Первый укус',
    description: 'Проголосуйте впервые',
    icon: '🍽️',
    category: 'GASTRO',
    rarity: 'COMMON',
    xpReward: 10,
    requirement: JSON.stringify({ type: 'stat_gte', stat: 'pollsParticipated', value: 1 })
  },
  {
    key: 'TASTE_EXPERT',
    title: 'Знаток вкуса',
    description: 'Выиграйте 10 голосований подряд',
    icon: '🎯',
    category: 'GASTRO',
    rarity: 'RARE',
    xpReward: 100,
    requirement: JSON.stringify({ type: 'stat_gte', stat: 'pollsWon', value: 10 })
  },
  {
    key: 'GOURMET',
    title: 'Гурман',
    description: 'Попробуйте все категории блюд',
    icon: '🌟',
    category: 'GASTRO',
    rarity: 'EPIC',
    xpReward: 150,
    requirement: JSON.stringify({ type: 'custom', logic: 'all_categories_tried' })
  },
  {
    key: 'TABLE_LEGEND',
    title: 'Легенда стола',
    description: 'Примите участие в 100 голосованиях',
    icon: '👑',
    category: 'GASTRO',
    rarity: 'LEGENDARY',
    xpReward: 500,
    requirement: JSON.stringify({ type: 'stat_gte', stat: 'pollsParticipated', value: 100 })
  },
  
  // Responsible
  {
    key: 'FIRST_RESPONSIBLE',
    title: 'Помощник',
    description: 'Станьте ответственным впервые',
    icon: '🤝',
    category: 'RESPONSIBLE',
    rarity: 'COMMON',
    xpReward: 50,
    requirement: JSON.stringify({ type: 'stat_gte', stat: 'timesResponsible', value: 1 })
  },
  {
    key: 'VOLUNTEER',
    title: 'Волонтёр',
    description: 'Вызовитесь добровольно 5 раз',
    icon: '⚡',
    category: 'RESPONSIBLE',
    rarity: 'RARE',
    xpReward: 200,
    requirement: JSON.stringify({ type: 'stat_gte', stat: 'timesVolunteer', value: 5 })
  },
  {
    key: 'ORGANIZER_YEAR',
    title: 'Организатор года',
    description: 'Будьте ответственным 50 раз',
    icon: '💪',
    category: 'RESPONSIBLE',
    rarity: 'LEGENDARY',
    xpReward: 1000,
    requirement: JSON.stringify({ type: 'stat_gte', stat: 'timesResponsible', value: 50 })
  },
  
  // Social
  {
    key: 'EARLY_BIRD',
    title: 'Рано встаёт',
    description: 'Проголосуйте первым 10 раз',
    icon: '📱',
    category: 'SOCIAL',
    rarity: 'COMMON',
    xpReward: 75,
    requirement: JSON.stringify({ type: 'custom', logic: 'first_vote_count_10' })
  },
  {
    key: 'WEEK_STREAK',
    title: 'Стример',
    description: 'Серия 7 дней подряд',
    icon: '🔥',
    category: 'SOCIAL',
    rarity: 'RARE',
    xpReward: 100,
    requirement: JSON.stringify({ type: 'streak', value: 7 })
  },
  {
    key: 'MONTH_STREAK',
    title: 'Марафонец',
    description: 'Серия 30 дней подряд',
    icon: '🏆',
    category: 'SOCIAL',
    rarity: 'EPIC',
    xpReward: 500,
    requirement: JSON.stringify({ type: 'streak', value: 30 })
  },
  {
    key: 'HONEST_PAYER',
    title: 'Честный плательщик',
    description: 'Оплатите в срок 20 раз',
    icon: '💳',
    category: 'SOCIAL',
    rarity: 'RARE',
    xpReward: 150,
    requirement: JSON.stringify({ type: 'stat_gte', stat: 'paymentsOnTime', value: 20 })
  },
  
  // Explorer
  {
    key: 'PIONEER',
    title: 'Первопроходец',
    description: 'Попробуйте 10 новых блюд',
    icon: '🔍',
    category: 'EXPLORER',
    rarity: 'COMMON',
    xpReward: 80,
    requirement: JSON.stringify({ type: 'stat_gte', stat: 'newDishesDiscovered', value: 10 })
  },
  {
    key: 'ADVENTURER',
    title: 'Искатель приключений',
    description: 'Попробуйте 50 новых блюд',
    icon: '🌍',
    category: 'EXPLORER',
    rarity: 'EPIC',
    xpReward: 300,
    requirement: JSON.stringify({ type: 'stat_gte', stat: 'newDishesDiscovered', value: 50 })
  },
  {
    key: 'CHEF_EDITOR',
    title: 'Шеф-редактор',
    description: 'Добавьте 10 блюд в меню',
    icon: '📝',
    category: 'EXPLORER',
    rarity: 'RARE',
    xpReward: 200,
    requirement: JSON.stringify({ type: 'stat_gte', stat: 'menuItemsAdded', value: 10 })
  },
  
  // Hidden
  {
    key: 'LUCKY_STREAK',
    title: 'Везунчик',
    description: 'Выиграйте рулетку 3 раза подряд',
    icon: '🎰',
    category: 'SOCIAL',
    rarity: 'EPIC',
    xpReward: 250,
    requirement: JSON.stringify({ type: 'custom', logic: 'roulette_wins_streak_3' })
  },
  {
    key: 'INDECISIVE',
    title: 'Изменчивый',
    description: 'Измените свой голос 5 раз за одно голосование',
    icon: '🎭',
    category: 'SOCIAL',
    rarity: 'COMMON',
    xpReward: 50,
    requirement: JSON.stringify({ type: 'custom', logic: 'vote_changes_5' })
  },
  {
    key: 'NIGHT_OWL',
    title: 'Ночной дозор',
    description: 'Проголосуйте после 23:00',
    icon: '🌙',
    category: 'SOCIAL',
    rarity: 'COMMON',
    xpReward: 30,
    requirement: JSON.stringify({ type: 'custom', logic: 'late_night_vote' })
  },
  {
    key: 'LATE_VOTER',
    title: 'Опоздун',
    description: 'Проголосуйте за минуту до закрытия 5 раз',
    icon: '🐌',
    category: 'SOCIAL',
    rarity: 'RARE',
    xpReward: 100,
    requirement: JSON.stringify({ type: 'custom', logic: 'last_minute_votes_5' })
  }
];

export async function seedAchievements() {
  console.log('Seeding achievements...');
  
  for (const achievement of achievements) {
    await prisma.achievement.upsert({
      where: { key: achievement.key },
      update: achievement,
      create: achievement
    });
  }
  
  console.log(`Seeded ${achievements.length} achievements`);
}
```

### 2.3 Лидерборды и соревнования

#### Типы лидербордов

1. **Глобальный** - все пользователи
2. **Групповой** - в рамках одной группы
3. **Недельный** - сброс каждую неделю
4. **Сезонный** - кварт альные соревнования

#### Frontend компонент Leaderboard

**frontend/src/components/social/Leaderboard.tsx:**

```tsx
import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Crown, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { gamificationService } from '../../services/gamification.service';

interface LeaderboardEntry {
  rank: number;
  user: {
    id: number;
    firstName: string;
    lastName?: string;
    username?: string;
  };
  level: number;
  totalXP: number;
  gastroRating: number;
  responsibleRating: number;
  socialRating: number;
  explorerRating: number;
}

type Category = 'TOTAL' | 'GASTRO' | 'RESPONSIBLE' | 'SOCIAL' | 'EXPLORER';

const categories = [
  { id: 'TOTAL', name: 'Общий', icon: '🏆' },
  { id: 'GASTRO', name: 'Гастрономия', icon: '🍽️' },
  { id: 'RESPONSIBLE', name: 'Ответственность', icon: '🎯' },
  { id: 'SOCIAL', name: 'Социальный', icon: '🤝' },
  { id: 'EXPLORER', name: 'Исследователь', icon: '🔍' }
];

export function Leaderboard() {
  const [selectedCategory, setSelectedCategory] = useState<Category>('TOTAL');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadLeaderboard();
  }, [selectedCategory]);
  
  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const data = await gamificationService.getLeaderboard(selectedCategory);
      setLeaderboard(data);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Medal className="w-6 h-6 text-orange-600" />;
      default:
        return <span className="text-gray-500 font-bold">{rank}</span>;
    }
  };
  
  const getScore = (entry: LeaderboardEntry) => {
    switch (selectedCategory) {
      case 'TOTAL':
        return entry.totalXP;
      case 'GASTRO':
        return entry.gastroRating;
      case 'RESPONSIBLE':
        return entry.responsibleRating;
      case 'SOCIAL':
        return entry.socialRating;
      case 'EXPLORER':
        return entry.explorerRating;
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Category Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id as Category)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap
              transition-colors
              ${selectedCategory === cat.id
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }
            `}
          >
            <span>{cat.icon}</span>
            <span className="font-medium">{cat.name}</span>
          </button>
        ))}
      </div>
      
      {/* Leaderboard */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto" />
          </div>
        ) : (
          leaderboard.map((entry, index) => (
            <motion.div
              key={entry.user.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="
                flex items-center gap-4 p-4 rounded-xl
                bg-white dark:bg-gray-800
                border border-gray-200 dark:border-gray-700
                hover:shadow-lg transition-shadow
              "
            >
              {/* Rank */}
              <div className="flex-shrink-0 w-10 flex items-center justify-center">
                {getRankIcon(entry.rank)}
              </div>
              
              {/* User Info */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">
                  {entry.user.firstName} {entry.user.lastName || ''}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Уровень {entry.level}
                </div>
              </div>
              
              {/* Score */}
              <div className="text-right">
                <div className="font-bold text-lg">
                  {getScore(entry).toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  XP
                </div>
              </div>
              
              {/* Trend (if available) */}
              <div className="flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
            </motion.div>
          ))
        )}
      </div>
      
      {/* Footer */}
      <div className="text-center text-sm text-gray-500 dark:text-gray-400">
        Обновляется каждые 5 минут
      </div>
    </div>
  );
}
```

---

## 🎮 Часть 3: ГЕЙМИФИКАЦИЯ

### 3.1 Ежедневные задания (Daily Quests)

#### Концепция

**Типы заданий:**
- 📱 Базовые (каждый день) - за голосование
- 🎯 Случайные (3 в день) - разнообразные задачи
- 🏆 Недельные - долгосрочные цели
- 🌟 Специальные события

#### Примеры заданий

**Ежедневные:**
- ✅ Проголосуйте в любом голосовании (+20 XP)
- ✅ Проголосуйте до 12:00 (+30 XP)
- ✅ Поменяйте голос хотя бы раз (+15 XP)

**Случайные:**
- 🎯 Попробуйте новое блюдо (+40 XP)
- 🎯 Станьте ответственным (+50 XP)
- 🎯 Добавьте блюдо в меню (+35 XP)
- 🎯 Оплатите долг (+25 XP)
- 🎯 Пригласите нового участника (+60 XP)

**Недельные:**
- 🏆 Участвуйте в 5 голосованиях (+ 150 XP)
- 🏆 Попробуйте 10 разных блюд (+200 XP)
- 🏆 Будьте в топ-3 лидерборда группы (+300 XP)

#### Техническая реализация

**Расширение schema.prisma:**

```prisma
model Quest {
  id          Int       @id @default(autoincrement())
  key         String    @unique
  title       String
  description String
  type        String    // DAILY, RANDOM, WEEKLY, EVENT
  category    String
  xpReward    Int       @map("xp_reward")
  requirement String    // JSON with requirement logic
  duration    Int       // Days quest is active (1 for daily, 7 for weekly)
  rarity      String    @default("COMMON")
  
  userQuests  UserQuest[]
  
  @@map("quests")
}

model UserQuest {
  id          Int       @id @default(autoincrement())
  userId      Int       @map("user_id")
  questId     Int       @map("quest_id")
  status      String    @default("ACTIVE") // ACTIVE, COMPLETED, EXPIRED
  progress    Int       @default(0)
  target      Int       // Target for completion
  startedAt   DateTime  @default(now()) @map("started_at")
  completedAt DateTime? @map("completed_at")
  expiresAt   DateTime  @map("expires_at")
  
  user        User      @relation(fields: [userId], references: [id])
  quest       Quest     @relation(fields: [questId], references: [id])
  
  @@unique([userId, questId, startedAt])
  @@map("user_quests")
}

// Update User model
model User {
  // ... existing fields
  quests      UserQuest[]
}
```

**Сервис квестов:**

**backend/src/services/quest.service.ts:**

```typescript
import { prisma } from '../database/client';
import { GamificationService } from './gamification.service';

export class QuestService {
  
  // Assign daily quests to user
  static async assignDailyQuests(userId: number): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Check if already assigned today
    const existing = await prisma.userQuest.findFirst({
      where: {
        userId,
        startedAt: { gte: today },
        quest: { type: 'DAILY' }
      }
    });
    
    if (existing) return; // Already assigned
    
    // Get all daily quests
    const dailyQuests = await prisma.quest.findMany({
      where: { type: 'DAILY' }
    });
    
    // Assign base daily quest
    const baseQuest = dailyQuests.find(q => q.key === 'DAILY_VOTE');
    if (baseQuest) {
      await prisma.userQuest.create({
        data: {
          userId,
          questId: baseQuest.id,
          target: 1,
          expiresAt: tomorrow
        }
      });
    }
    
    // Assign 3 random quests
    const randomQuests = await prisma.quest.findMany({
      where: { type: 'RANDOM' }
    });
    
    const selected = this.getRandomItems(randomQuests, 3);
    
    for (const quest of selected) {
      const req = JSON.parse(quest.requirement);
      await prisma.userQuest.create({
        data: {
          userId,
          questId: quest.id,
          target: req.target || 1,
          expiresAt: tomorrow
        }
      });
    }
  }
  
  // Assign weekly quests
  static async assignWeeklyQuests(userId: number): Promise<void> {
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);
    
    // Check if already assigned this week
    const existing = await prisma.userQuest.findFirst({
      where: {
        userId,
        quest: { type: 'WEEKLY' },
        status: 'ACTIVE'
      }
    });
    
    if (existing) return;
    
    // Get weekly quests
    const weeklyQuests = await prisma.quest.findMany({
      where: { type: 'WEEKLY' }
    });
    
    // Assign 2 random weekly quests
    const selected = this.getRandomItems(weeklyQuests, 2);
    
    for (const quest of selected) {
      const req = JSON.parse(quest.requirement);
      await prisma.userQuest.create({
        data: {
          userId,
          questId: quest.id,
          target: req.target || 1,
          expiresAt: weekEnd
        }
      });
    }
  }
  
  // Update quest progress
  static async updateQuestProgress(
    userId: number,
    questKey: string,
    increment: number = 1
  ): Promise<void> {
    
    const userQuest = await prisma.userQuest.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        quest: { key: questKey },
        expiresAt: { gte: new Date() }
      },
      include: { quest: true }
    });
    
    if (!userQuest) return;
    
    const newProgress = userQuest.progress + increment;
    
    if (newProgress >= userQuest.target) {
      // Quest completed!
      await prisma.userQuest.update({
        where: { id: userQuest.id },
        data: {
          progress: newProgress,
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });
      
      // Award XP
      await GamificationService.awardXP(
        userId,
        userQuest.quest.xpReward,
        `Выполнено задание: ${userQuest.quest.title}`,
        userQuest.quest.category as any
      );
      
      // Notify user
      await this.notifyQuestComplete(userId, userQuest.quest);
    } else {
      // Update progress
      await prisma.userQuest.update({
        where: { id: userQuest.id },
        data: { progress: newProgress }
      });
    }
  }
  
  // Get user's active quests
  static async getUserQuests(userId: number): Promise<any[]> {
    return await prisma.userQuest.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        expiresAt: { gte: new Date() }
      },
      include: { quest: true },
      orderBy: { startedAt: 'desc' }
    });
  }
  
  // Expire old quests
  static async expireOldQuests(): Promise<void> {
    await prisma.userQuest.updateMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lt: new Date() }
      },
      data: { status: 'EXPIRED' }
    });
  }
  
  // Helper: Get random items from array
  private static getRandomItems<T>(array: T[], count: number): T[] {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }
  
  private static async notifyQuestComplete(userId: number, quest: any): Promise<void> {
    // Implementation via notification service
    console.log(`Quest completed by user ${userId}: ${quest.title}`);
  }
}
```

### 3.2 Сезоны и временные события

#### Сезонная система

**Концепция:**
- Каждый сезон длится 3 месяца
- Уникальные награды за сезон
- Рейтинг сбрасывается, но не полностью (soft reset)
- Тематические события (Новый год, лето, etc)

#### Специальные события

**Примеры:**
- 🎄 **"Новогоднее застолье"** (декабрь) - двойной XP за новогодние блюда
- 🍕 **"Пицца фест"** - неделя пиццы с бонусами
- 🥗 **"Неделя здорового питания"** - бонусы за салаты и ЗОЖ
- 🎉 **"День рождения бота"** - все квесты дают +50% XP

### 3.3 Виртуальная валюта (Coins)

#### Концепция

**Coins** - внутриигровая валюта для покупки косметики

**Заработок:**
- За level up: 50 coins
- За ачивки: 25-200 coins
- За недельные квесты: 100 coins
- Ежедневный бонус: 10 coins

**Траты:**
- 🎨 Темы оформления: 200 coins
- 🏷️ Именные бейджи: 150 coins
- 🎭 Кастомные эмодзи: 50 coins
- 🔊 Звуки уведомлений: 100 coins

---

## 📈 Часть 4: ПРИМЕРЫ УСПЕШНЫХ ПРАКТИК

### 4.1 Успешные кейсы геймификации

#### Duolingo
**Что взять:**
- ✅ Streak система (наша уже есть, расширить)
- ✅ Ежедневные цели с визуализацией
- ✅ Лиги и соревнования
- ✅ Сердца (lives) → у нас можно голоса за день

#### Habitica
**Что взять:**
- ✅ RPG механика с уровнями
- ✅ Damage от пропущенных заданий
- ✅ Boss fights (группо вые события)

#### Telegram Stars & TON
**Что взять:**
- ✅ Интеграция с Telegram Stars для доната
- ✅ TON wallet для premium платежей
- ✅ NFT бейджи для топ игроков (опционально)

### 4.2 Метрики успеха

**KPI для отслеживания:**

**Engagement:**
- DAU (Daily Active Users)
- Retention D1/D7/D30
- Session length
- Votes per user per week

**Monetization:**
- Conversion Free → Premium
- ARPU (Average Revenue Per User)
- Churn rate
- LTV (Lifetime Value)

**Social:**
- Leaderboard participation
- Achievement unlock rate
- Quest completion rate
- Referrals per user

---

## ⚠️ Часть 5: АНАЛИЗ РИСКОВ

### 5.1 Технические риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| **Производительность БД при росте пользователей** | Высокая | Критическое | - Индексация таблиц<br>- Переход на PostgreSQL<br>- Кэширование Redis |
| **Сложность расчёта XP и рейтингов** | Средняя | Высокое | - Фоновые джобы (Bull Queue)<br>- Денормализация данных<br>- Batch processing |
| **Интеграция платёжных систем** | Средняя | Критическое | - Использовать готовые SDK<br>- Тестирование на sandbox<br>- Fallback методы оплаты |
| **Безопасность транзакций** | Низкая | Критическое | - Валидация на сервере<br>- Rate limiting<br>- Логирование всех операций |
| **Масштабирование при вирусном росте** | Низкая | Высокое | - Docker + Kubernetes<br>- Load balancing<br>- CDN для статики |

### 5.2 Бизнес риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| **Низкая конверсия в Premium** | Высокая | Высокое | - A/B тесты ценообразования<br>- Trial период 14 дней<br>- Показать value раньше paywall |
| **Отток пользователей из-за paywall** | Средняя | Среднее | - Freemium модель с хорошим free tier<br>- Постепенное ограничение функций<br>- Геймификация бесплатна |
| **Балансировка геймификации (не слишком много/мало)** | Высокая | Среднее | - A/B тесты систем наград<br>- Опросы пользователей<br>- Аналитика engagement |
| **Читерство и эксплойты** | Средняя | Среднее | - Server-side валидация<br>- Анти-чит система<br>- Мануальная модерация топ игроков |
| **Юридические риски (GDPR, персональные данные)** | Низкая | Критическое | - Политика конфиденциальности<br>- Согласие на обработку<br>- Right to be forgotten |

### 5.3 UX риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| **Перегруженность интерфейса** | Высокая | Высокое | - Постепенное раскрытие функций<br>- Onboarding tutorial<br>- Настройки видимости элементов |
| **Уведомления спамят** | Высокая | Среднее | - Группировка уведомлений<br>- Настройки частоты<br>- Smart timing |
| **Усталость от геймификации (gamification fatigue)** | Средняя | Среднее | - Опциональность участия<br>- Разнообразие механик<br>- Периоды отдыха |
| **Сложность понимания систем** | Средняя | Высокое | - Tooltips и подсказки<br>- FAQ и help center<br>- Видео туториалы |

---

## 🗺️ Часть 6: ROADMAP ПОЭТАПНОГО ВНЕДРЕНИЯ

### Phase 1: MVP Геймификации (2-3 недели)

**Приоритет: Базовые системы**

✅ **Неделя 1-2: Backend Foundation**
- [ ] Создать schema для UserStats, XP History, Achievements
- [ ] Реализовать GamificationService
- [ ] Реализовать базовые ачивки (10 штук)
- [ ] Система начисления XP за действия
- [ ] Интеграция с существующими сервисами (poll, vote)
- [ ] Unit тесты для core логики

✅ **Неделя 2-3: Frontend MVP**
- [ ] Компонент профиля с уровнем и XP
- [ ] Страница достижений (unlocked/locked)
- [ ] Базовый лидерборд (топ-10)
- [ ] Уведомления о новых ачивках
- [ ] Анимации level up

**Ожидаемый результат:**
- Пользователи видят свой прогресс
- Базовая мотивация через ачивки
- Первичный engagement boost

### Phase 2: Социализация (2-3 недели)

✅ **Неделя 4-5: Рейтинги и Лидерборды**
- [ ] Мульти-категорийные рейтинги
- [ ] Глобальный и групповой лидерборды
- [ ] Система streak (серии дней)
- [ ] Визуализация прогресса
- [ ] Сравнение с друзьями

✅ **Неделя 5-6: Расширенные Ачивки**
- [ ] Добавить 20+ новых ачивок
- [ ] Система редкости (Common/Rare/Epic/Legendary)
- [ ] Прогрессивные ачивки (10/50/100)
- [ ] Скрытые ачивки (Easter Eggs)
- [ ] Showcase любимых ачивок в профиле

**Ожидаемый результат:**
- Здоровая конкуренция между пользователями
- Retention через streak механику
- Увеличение частоты использования

### Phase 3: Монетизация MVP (2-3 недели)

✅ **Неделя 7-8: Subscription System**
- [ ] Schema для Subscription, Payment
- [ ] SubscriptionService + feature limits
- [ ] Middleware для проверки подписок
- [ ] Интеграция YooKassa/CloudPayments
- [ ] Webhook обработка платежей
- [ ] Admin панель для управления подписками

✅ **Неделя 8-9: Premium Features & UI**
- [ ] Subscription Modal в frontend
- [ ] Paywall для premium функций
- [ ] Страница с тарифами
- [ ] Визуальная дифференциация free/premium
- [ ] Trial период логика (14 дней)

**Ожидаемый результат:**
- Первые платные пользователи
- Feedback о ценности premium
- Данные для оптимизации pricing

### Phase 4: Расширенная Геймификация (3-4 недели)

✅ **Неделя 10-11: Daily Quests**
- [ ] Schema для Quest, UserQuest
- [ ] QuestService
- [ ] Ежедневные задания (базовые + 3 случайных)
- [ ] Недельные квесты
- [ ] UI для отображения квестов
- [ ] Прогресс-бары и уведомления

✅ **Неделя 11-13: Coins & Cosmetics**
- [ ] Виртуальная валюта (Coins)
- [ ] Магазин косметики
- [ ] Кастомные темы оформления
- [ ] Именные бейджи
- [ ] Звуки уведомлений
- [ ] Preview перед покупкой

✅ **Неделя 13-14: Сезоны и События**
- [ ] Сезонная система (3 месяца)
- [ ] Soft reset рейтингов
- [ ] Временные события
- [ ] Тематические квесты
- [ ] Сезонные награды

**Ожидаемый результат:**
- Максимальный engagement
- Ежедневная активность через квесты
- Long-term retention через сезоны

### Phase 5: Оптимизация и Масштабирование (ongoing)

✅ **Постоянная работа:**
- [ ] A/B тестирование систем наград
- [ ] Балансировка экономики (XP, Coins)
- [ ] Анализ метрик и KPI
- [ ] Добавление новых ачивок и квестов
- [ ] Оптимизация производительности
- [ ] Античит системы
- [ ] Сбор feedback и итерации

**Инструменты мониторинга:**
- Google Analytics / Mixpanel для событий
- Sentry для ошибок (уже есть)
- Custom dashboard для метрик геймификации

---

## 📊 Часть 7: ОЦЕНКА РЕСУРСОВ

### 7.1 Временные затраты

| Фаза | Длительность | Сложность |
|------|--------------|-----------|
| Phase 1: MVP Геймификации | 2-3 недели | Средняя |
| Phase 2: Социализация | 2-3 недели | Средняя |
| Phase 3: Монетизация MVP | 2-3 недели | Высокая |
| Phase 4: Расширенная геймификация | 3-4 недели | Высокая |
| Phase 5: Оптимизация | Постоянно | Средняя |
| **ИТОГО:** | **12-16 недель** | |

### 7.2 Технический стек (дополнения)

**Backend:**
- ✅ Bull Queue - для фоновых задач
- ✅ Redis - для кэширования
- ✅ YooKassa SDK - платежи

**Frontend:**
- ✅ Recharts - графики статистики
- ✅ Confetti - анимации праздников
- ✅ React Joyride - onboarding туры

**Infrastructure:**
- ✅ PostgreSQL вместо SQLite (для production)
- ✅ PM2 - process manager
- ✅ Nginx - reverse proxy

### 7.3 Команда (рекомендации)

Для быстрого внедрения:
- 1 Backend разработчик (full-time)
- 1 Frontend разработчик (full-time)
- 1 UI/UX дизайнер (part-time)
- 1 QA тестировщик (part-time)
- 1 Project Manager/Product Owner

---

## 🎯 Часть 8: МЕТРИКИ УСПЕХА

### KPI Phase 1-2 (Геймификация + Социализация)

**Engagement:**
- DAU +30% за первый месяц
- Session length +40%
- Votes per user per week +50%

**Социальные:**
- 70% пользователей разблокировали хотя бы 1 ачивку
- 40% пользователей в топ-10 лидерборда группы
- Streak 7+ дней у 20% активных пользователей

### KPI Phase 3 (Монетизация)

**Conversion:**
- Free → Trial: 15-20%
- Trial → Paid: 25-30%
- Общая конверсия Free → Paid: 5-10%

**Revenue:**
- MRR (Monthly Recurring Revenue): 50,000₽ через 3 месяца
- ARPU: 150-200₽
- Churn rate < 5% per month

### KPI Phase 4 (Расширенная геймификация)

**Retention:**
- D1: 60%
- D7: 40%
- D30: 25%

**Quest engagement:**
- 80% пользователей выполняют хотя бы 1 квест в день
- 50% выполняют недельные квесты

---

## 💡 ВЫВОДЫ И РЕКОМЕНДАЦИИ

### Что делать В ПЕРВУЮ ОЧЕРЕДЬ:

1. **Phase 1: MVP Геймификации** (2-3 недели)
   - Минимальные риски
   - Быстрый результат
   - Фундамент для всего остального

2. **A/B тестирование** всех новых фич
   - 50% пользователей видят новую систему
   - Сравнение метрик с контрольной группой
   - Решение на основе данных

3. **User Research**
   - Опросы текущих пользователей
   - Интервью с активными юзерами
   - Feedback формы в боте

### Что НЕ делать:

❌ **Не внедрять всё сразу** - перегрузка пользователей  
❌ **Не делать paywall агрессивным** - оттолкнёт аудиторию  
❌ **Не игнорировать баланс** - слишком легко/сложно = падение интереса  
❌ **Не забывать про тестирование** - баги убьют engagement  

### Финальный совет:

**Начните с малого, соберите данные, итерируйте.** Геймификация и монетизация - это не "set and forget", а постоянный процесс оптимизации. Слушайте пользователей, анализируйте метрики, и корректируйте курс.

---

## 📚 ПРИЛОЖЕНИЯ

### A. Полный список файлов для создания

**Backend:**
```
backend/src/
├── services/
│   ├── gamification.service.ts
│   ├── subscription.service.ts
│   └── quest.service.ts
├── api/
│   ├── controllers/
│   │   ├── gamification.controller.ts
│   │   ├── subscription.controller.ts
│   │   └── quest.controller.ts
│   ├── routes/
│   │   ├── gamification.routes.ts
│   │   ├── subscription.routes.ts
│   │   ├── quest.routes.ts
│   │   └── webhook.routes.ts
│   └── middleware/
│       └── subscription.ts
├── database/
│   └── seeders/
│       ├── seed-achievements.ts
│       └── seed-quests.ts
└── types/
    ├── gamification.types.ts
    ├── subscription.types.ts
    └── quest.types.ts
```

**Frontend:**
```
frontend/src/
├── components/
│   ├── gamification/
│   │   ├── ProfileCard.tsx
│   │   ├── LevelProgress.tsx
│   │   ├── AchievementCard.tsx
│   │   └── XPNotification.tsx
│   ├── social/
│   │   ├── Leaderboard.tsx
│   │   ├── LeaderboardEntry.tsx
│   │   └── StreakCounter.tsx
│   ├── subscription/
│   │   ├── SubscriptionModal.tsx
│   │   ├── TierCard.tsx
│   │   └── Paywall.tsx
│   └── quests/
│       ├── QuestList.tsx
│       ├── QuestCard.tsx
│       └── QuestProgress.tsx
├── pages/
│   ├── ProfilePage.tsx
│   ├── AchievementsPage.tsx
│   ├── LeaderboardPage.tsx
│   ├── QuestsPage.tsx
│   └── SubscriptionPage.tsx
└── services/
    ├── gamification.service.ts
    ├── subscription.service.ts
    └── quest.service.ts
```

### B. SQL Migration примеры

**001_add_gamification.sql:**
```sql
-- User Stats
CREATE TABLE user_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  total_xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  gastro_rating INTEGER DEFAULT 0,
  responsible_rating INTEGER DEFAULT 0,
  social_rating INTEGER DEFAULT 0,
  explorer_rating INTEGER DEFAULT 0,
  polls_participated INTEGER DEFAULT 0,
  polls_won INTEGER DEFAULT 0,
  times_responsible INTEGER DEFAULT 0,
  times_volunteer INTEGER DEFAULT 0,
  menu_items_added INTEGER DEFAULT 0,
  payments_on_time INTEGER DEFAULT 0,
  new_dishes_discovered INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_vote_date DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- XP History
CREATE TABLE xp_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  category TEXT NOT NULL,
  metadata TEXT,
  earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_xp_history_user ON xp_history(user_id);
CREATE INDEX idx_xp_history_date ON xp_history(earned_at);

-- Achievements
CREATE TABLE achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL,
  rarity TEXT NOT NULL,
  xp_reward INTEGER NOT NULL,
  requirement TEXT NOT NULL
);

-- User Achievements
CREATE TABLE user_achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  achievement_id INTEGER NOT NULL,
  unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  progress REAL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (achievement_id) REFERENCES achievements(id),
  UNIQUE(user_id, achievement_id)
);
```

### C. Environment Variables

```env
# Payment (YooKassa)
YOOKASSA_SHOP_ID=your_shop_id
YOOKASSA_SECRET_KEY=your_secret_key

# Redis (для кэширования)
REDIS_URL=redis://localhost:6379

# Feature Flags
ENABLE_GAMIFICATION=true
ENABLE_SUBSCRIPTIONS=true
ENABLE_QUESTS=true

# Subscription Pricing
PREMIUM_PRICE=150
ENTERPRISE_PRICE=500
TRIAL_DAYS=14
```

---

**Дата создания:** 2025-10-25  
**Версия:** 1.0  
**Автор:** Claude (Factory AI)  
**Статус:** Готово к обсуждению и имплементации

