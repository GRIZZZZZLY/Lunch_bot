# Quick Actions v2.0 - Детальная спецификация

## 🎯 Цель
Заменить дублирующие навигацию Quick Actions на контекстные функциональные действия с гибридным подходом.

---

## 📐 Архитектура компонента

### Структура на странице HomePage
```
HomePage
├── Header (Dynamic time-based greeting)
├── Hero Section (Active Poll Widget)
└── Quick Actions Section ⭐ ОБНОВЛЯЕМ
    ├── Hero Action (60% пространства)
    │   ├── Icon/Image
    │   ├── Title + Description
    │   ├── Statistics/Progress (опционально)
    │   └── Primary Button (GradientButton)
    ├── Secondary Actions Grid (2-3 кнопки)
    │   └── Compact cards с иконками
    └── Tertiary Action (опционально)
        └── Link-style button
```

---

## 📊 Типы данных

### ScenarioType
```typescript
type ScenarioType = 
  | 'active-not-voted'      // Активное голосование, пользователь не голосовал
  | 'active-voted'          // Активное голосование, пользователь проголосовал
  | 'no-active-poll'        // Нет активного голосования
  | 'poll-ended';           // Голосование недавно завершилось (5 мин)
```

### HeroAction
```typescript
interface HeroAction {
  title: string;
  description: string;
  icon?: React.ReactNode;
  imageUrl?: string;
  buttonText: string;
  buttonVariant: 'peach' | 'mint' | 'lavender' | 'coral' | 'butter';
  showShimmer?: boolean;
  badge?: {
    text: string;
    variant?: 'default' | 'live' | 'popular';
  };
  statistics?: {
    voteCount: number;
    percentage: number;
    showProgress: boolean;
    label?: string;
  };
  onClick: () => void;
  disabled?: boolean;
}
```

### SecondaryAction
```typescript
interface SecondaryAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient: 'peach' | 'mint' | 'lavender' | 'coral' | 'butter';
  onClick: () => void;
  disabled?: boolean;
}
```

### TertiaryAction
```typescript
interface TertiaryAction {
  text: string;
  icon: React.ReactNode;
  onClick: () => void;
}
```

### ScenarioConfig
```typescript
interface ScenarioConfig {
  hero: HeroAction;
  secondary: SecondaryAction[];
  tertiary?: TertiaryAction;
  layout: '2x50%' | '3x33%'; // для secondary grid
}
```

---

## 🎨 Визуальные спецификации

### Hero Action Card

**Размеры:**
- Высота: `auto` (минимум 240px)
- Padding: `24px 20px`
- Border radius: `16px`
- Gap между элементами: `16px`

**Компоненты:**
```tsx
<GlassCard intensity="high" hover className="relative overflow-hidden">
  {/* Gradient overlay */}
  <div className="absolute inset-0 bg-gradient-to-br from-peach-500/20 to-coral-500/20 -z-10" />
  
  {/* Shimmer effect (опционально) */}
  {showShimmer && (
    <div className="absolute inset-0 shimmer-effect -z-10" />
  )}
  
  <GlassCardContent className="relative py-6 px-5 space-y-4">
    {/* Badge в углу */}
    {badge && (
      <Badge className="absolute top-3 right-3" variant={badge.variant}>
        {badge.text}
      </Badge>
    )}
    
    {/* Icon или Image */}
    <div className="flex justify-center">
      {imageUrl ? (
        <img 
          src={imageUrl} 
          alt={title}
          className="size-20 rounded-xl object-cover ring-2 ring-white/20" 
        />
      ) : (
        <div className="size-16 rounded-xl bg-gradient-to-br from-peach-500 to-coral-500 flex items-center justify-center">
          {icon}
        </div>
      )}
    </div>
    
    {/* Title + Description */}
    <div className="text-center space-y-2">
      <h3 className="text-xl font-bold text-foreground">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground">
        {description}
      </p>
    </div>
    
    {/* Statistics/Progress (опционально) */}
    {statistics && (
      <div className="space-y-2">
        <Progress value={statistics.percentage} className="h-2" />
        <p className="text-xs text-center text-muted-foreground">
          {statistics.label || `👥 ${statistics.voteCount} голосов (${statistics.percentage}%)`}
        </p>
      </div>
    )}
    
    {/* Primary Button */}
    <GradientButton 
      variant={buttonVariant}
      size="lg" 
      className="w-full" 
      shimmer={showShimmer}
      onClick={onClick}
      disabled={disabled}
    >
      {buttonText}
      <ArrowRight className="size-5 ml-2" />
    </GradientButton>
  </GlassCardContent>
</GlassCard>
```

---

### Secondary Actions Grid

**Layout 2x50%:**
```tsx
<div className="grid grid-cols-2 gap-3">
  {secondaryActions.map(action => (
    <GlassCard 
      key={action.id}
      intensity="medium" 
      hover 
      className="cursor-pointer"
      onClick={action.onClick}
    >
      <GlassCardContent className="py-4 px-3 text-center space-y-3">
        {/* Icon */}
        <div className={cn(
          "inline-flex items-center justify-center size-12 rounded-xl",
          "bg-gradient-to-br",
          getGradientClasses(action.gradient)
        )}>
          {React.cloneElement(action.icon, { className: "size-6 text-white" })}
        </div>
        
        {/* Text */}
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-1">
            {action.title}
          </h4>
          <p className="text-xs text-muted-foreground">
            {action.description}
          </p>
        </div>
      </GlassCardContent>
    </GlassCard>
  ))}
</div>
```

**Layout 3x33%:**
```tsx
<div className="grid grid-cols-3 gap-2">
  {compactActions.map(action => (
    <GlassCard 
      key={action.id}
      intensity="low" 
      hover 
      className="cursor-pointer"
      onClick={action.onClick}
    >
      <GlassCardContent className="py-3 px-2 space-y-2">
        {/* Icon */}
        <div className="flex justify-center">
          <div className={cn(
            "size-10 rounded-lg flex items-center justify-center",
            "bg-gradient-to-br",
            getGradientClasses(action.gradient)
          )}>
            {React.cloneElement(action.icon, { className: "size-5 text-white" })}
          </div>
        </div>
        
        {/* Title only */}
        <p className="text-xs font-semibold text-center text-foreground line-clamp-1">
          {action.title}
        </p>
      </GlassCardContent>
    </GlassCard>
  ))}
</div>
```

---

### Tertiary Action (Link-style)

```tsx
{tertiary && (
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={tertiary.onClick}
    className="w-full py-3 px-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors flex items-center justify-center gap-2"
  >
    {React.cloneElement(tertiary.icon, { className: "size-4 text-muted-foreground" })}
    <span className="text-sm text-muted-foreground">
      {tertiary.text}
    </span>
  </motion.button>
)}
```

---

## 🎭 Конфигурация сценариев

### Сценарий 1: active-not-voted

```typescript
const activeNotVotedConfig: ScenarioConfig = {
  hero: {
    title: 'Популярное',
    description: popularDish ? `${popularDish.name} - уже ${popularDish.voteCount} голосов!` : 'Загрузка...',
    imageUrl: popularDish?.imageUrl,
    icon: <Flame className="size-10 text-white" />,
    buttonText: 'Проголосовать за лидера',
    buttonVariant: 'coral',
    showShimmer: true,
    badge: {
      text: '🔥 Популярное',
      variant: 'popular'
    },
    statistics: {
      voteCount: popularDish?.voteCount || 0,
      percentage: popularDish?.percentage || 0,
      showProgress: true
    },
    onClick: handleVoteForPopular
  },
  secondary: [
    {
      id: 'random',
      title: 'Случайное',
      description: 'Выбрать за меня',
      icon: <Shuffle className="size-6" />,
      gradient: 'peach',
      onClick: handleRandomVote
    },
    {
      id: 'results',
      title: 'Результаты',
      description: 'Текущий расклад',
      icon: <BarChart3 className="size-6" />,
      gradient: 'lavender',
      onClick: handleShowResults
    }
  ],
  tertiary: {
    text: 'Напомнить позже',
    icon: <Clock className="size-4" />,
    onClick: handleSetReminder
  },
  layout: '2x50%'
};
```

---

### Сценарий 2: active-voted

```typescript
const activeVotedConfig: ScenarioConfig = {
  hero: {
    title: 'Результаты Live',
    description: 'Текущий расклад голосования с живым обновлением',
    icon: <TrendingUp className="size-10 text-white" />,
    buttonText: 'Посмотреть подробнее',
    buttonVariant: 'lavender',
    badge: {
      text: '🔴 Live',
      variant: 'live'
    },
    onClick: handleShowResults
  },
  secondary: [
    {
      id: 'change-vote',
      title: 'Изменить',
      description: 'Переголосовать',
      icon: <RefreshCw className="size-6" />,
      gradient: 'mint',
      onClick: () => navigate('/voting')
    },
    {
      id: 'invite',
      title: 'Пригласить',
      description: 'Поделиться ботом',
      icon: <Share2 className="size-6" />,
      gradient: 'coral',
      onClick: handleInviteFriend
    }
  ],
  tertiary: {
    text: 'Напомнить о завершении',
    icon: <Bell className="size-4" />,
    onClick: handleSetEndReminder
  },
  layout: '2x50%'
};
```

---

### Сценарий 3: no-active-poll

```typescript
const noActivePollConfig: ScenarioConfig = {
  hero: {
    title: 'Повторить прошлое',
    description: lastPoll 
      ? `Голосование от ${formatDate(lastPoll.createdAt)}` 
      : 'Запустить голосование как в прошлый раз',
    icon: <Repeat className="size-10 text-white" />,
    buttonText: 'Запустить голосование',
    buttonVariant: 'peach',
    showShimmer: true,
    onClick: handleRepeatLastPoll,
    disabled: !lastPoll
  },
  secondary: [
    {
      id: 'my-stats',
      title: 'Моя статистика',
      description: 'История выборов',
      icon: <User className="size-5" />,
      gradient: 'lavender',
      onClick: () => navigate('/profile')
    },
    {
      id: 'top-dish',
      title: 'Топ блюдо',
      description: 'Самое популярное',
      icon: <Star className="size-5" />,
      gradient: 'butter',
      onClick: handleShowTopDish
    },
    {
      id: 'invite',
      title: 'Пригласить',
      description: 'Друга',
      icon: <Share2 className="size-5" />,
      gradient: 'mint',
      onClick: handleInviteFriend
    }
  ],
  layout: '3x33%'
};
```

---

### Сценарий 4: poll-ended

```typescript
const pollEndedConfig: ScenarioConfig = {
  hero: {
    title: 'Победитель',
    description: winnerDish ? winnerDish.name : 'Голосование завершено!',
    imageUrl: winnerDish?.imageUrl,
    icon: <Trophy className="size-10 text-white" />,
    buttonText: 'Подробнее о победителе',
    buttonVariant: 'butter',
    badge: {
      text: '🏆 Победитель',
      variant: 'default'
    },
    statistics: {
      voteCount: winnerDish?.voteCount || 0,
      percentage: winnerDish?.percentage || 0,
      showProgress: true,
      label: `🏆 Победил с ${winnerDish?.percentage}% голосов!`
    },
    onClick: handleShowWinner
  },
  secondary: [
    {
      id: 'full-stats',
      title: 'Статистика',
      description: 'Все результаты',
      icon: <BarChart3 className="size-6" />,
      gradient: 'lavender',
      onClick: () => navigate('/stats')
    },
    {
      id: 'repeat-this',
      title: 'Повторить',
      description: 'Такое же',
      icon: <Repeat className="size-6" />,
      gradient: 'mint',
      onClick: handleRepeatThisPoll
    }
  ],
  tertiary: {
    text: 'Оставить отзыв о блюде',
    icon: <MessageSquare className="size-4" />,
    onClick: handleLeaveFeedback
  },
  layout: '2x50%'
};
```

---

## 🔄 Логика переключения сценариев

```typescript
// Определение текущего сценария
const getCurrentScenario = (): ScenarioType => {
  const hasActivePoll = !!activePoll && activePoll.status === 'active';
  const hasVoted = activePoll ? checkIfUserVoted(activePoll.id) : false;
  const isPollEnded = activePoll?.status === 'ended';
  const recentlyEnded = isPollEnded && isWithinMinutes(activePoll.endedAt, 5);
  
  if (recentlyEnded) return 'poll-ended';
  if (hasActivePoll && !hasVoted) return 'active-not-voted';
  if (hasActivePoll && hasVoted) return 'active-voted';
  return 'no-active-poll';
};

// Получение конфигурации для сценария
const getScenarioConfig = (scenario: ScenarioType): ScenarioConfig => {
  switch (scenario) {
    case 'active-not-voted':
      return activeNotVotedConfig;
    case 'active-voted':
      return activeVotedConfig;
    case 'poll-ended':
      return pollEndedConfig;
    case 'no-active-poll':
    default:
      return noActivePollConfig;
  }
};

// Использование
const scenario = getCurrentScenario();
const config = getScenarioConfig(scenario);
```

---

## 🎬 Анимации

### 1. Hero Card появление
```tsx
<motion.div
  initial={{ opacity: 0, y: 30, scale: 0.95 }}
  animate={{ opacity: 1, y: 0, scale: 1 }}
  transition={{ 
    type: "spring", 
    stiffness: 300, 
    damping: 25,
    delay: 0.2 
  }}
>
  {/* Hero Card */}
</motion.div>
```

### 2. Live Badge pulse
```tsx
<Badge className="animate-pulse bg-red-500 text-white">
  🔴 Live
</Badge>

// Или в Tailwind config:
keyframes: {
  'pulse-glow': {
    '0%, 100%': { 
      boxShadow: '0 0 5px rgba(255, 0, 0, 0.5)' 
    },
    '50%': { 
      boxShadow: '0 0 20px rgba(255, 0, 0, 0.8)' 
    }
  }
}
```

### 3. Shimmer Effect
```css
/* В globals.css */
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.shimmer-effect {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.1) 50%,
    transparent 100%
  );
  animation: shimmer 2s infinite;
  pointer-events: none;
}
```

### 4. Confetti
```tsx
import Confetti from 'react-confetti';

{showConfetti && (
  <Confetti
    numberOfPieces={200}
    recycle={false}
    colors={['#FF7851', '#5CAE87', '#8B5CF6', '#FF5A4A', '#FFBF1F']}
    width={window.innerWidth}
    height={window.innerHeight}
  />
)}
```

### 5. Progress Bar анимация
```tsx
<motion.div
  initial={{ width: 0 }}
  animate={{ width: `${percentage}%` }}
  transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
  className="h-full bg-gradient-to-r from-peach-500 to-coral-500 rounded-full"
/>
```

---

## 🔧 Handler функции (заглушки для реализации)

```typescript
// 1. Повторить последнее голосование
const handleRepeatLastPoll = async () => {
  haptic.medium();
  // TODO: Загрузить последнее голосование
  // TODO: Показать модалку с preview
  // TODO: При подтверждении - создать новое голосование
};

// 2. Случайный выбор
const handleRandomVote = async () => {
  haptic.medium();
  // TODO: Выбрать случайное блюдо
  // TODO: Показать модалку с выбранным
  // TODO: При подтверждении - проголосовать + конфетти
};

// 3. Голосовать за популярное
const handleVoteForPopular = async () => {
  haptic.medium();
  // TODO: Получить текущего лидера
  // TODO: Показать модалку подтверждения
  // TODO: Проголосовать
};

// 4. Показать результаты
const handleShowResults = () => {
  haptic.medium();
  // TODO: Открыть bottom sheet с результатами
  // TODO: Настроить auto-refresh каждые 5 сек
};

// 5. Установить напоминание
const handleSetReminder = () => {
  haptic.light();
  // TODO: Показать bottom sheet с выбором времени
  // TODO: Сохранить в localStorage
  // TODO: Настроить уведомление через Telegram API
};

// 6. Пригласить друга
const handleInviteFriend = () => {
  haptic.medium();
  // TODO: Сгенерировать реферальную ссылку
  // TODO: Открыть Telegram share
};

// 7. Показать победителя (детально)
const handleShowWinner = () => {
  haptic.medium();
  // TODO: Открыть модалку с деталями победителя
  // TODO: Показать конфетти
};

// 8. Повторить завершенное голосование
const handleRepeatThisPoll = async () => {
  haptic.medium();
  // TODO: Взять текущее завершенное голосование
  // TODO: Создать новое с теми же параметрами
};

// 9. Оставить отзыв
const handleLeaveFeedback = () => {
  haptic.light();
  // TODO: Открыть форму отзыва
};

// 10. Показать топ блюдо недели
const handleShowTopDish = () => {
  haptic.medium();
  // TODO: Загрузить статистику за неделю
  // TODO: Показать модалку с топ блюдом
};
```

---

## 📦 Необходимые модалки/sheets

### 1. RepeatPollModal
```tsx
interface RepeatPollModalProps {
  isOpen: boolean;
  onClose: () => void;
  pollData: {
    menuItems: MenuItem[];
    duration: number;
    title?: string;
    createdAt: Date;
  };
  onConfirm: () => Promise<void>;
}
```

### 2. RandomVoteModal
```tsx
interface RandomVoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  dish: MenuItem;
  onConfirm: () => Promise<void>;
  showConfetti: boolean;
}
```

### 3. ResultsBottomSheet
```tsx
interface ResultsBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  pollId: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // default 5000ms
}
```

### 4. ReminderBottomSheet
```tsx
interface ReminderBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  options: { label: string; minutes: number }[];
  onSelect: (minutes: number) => void;
}
```

---

## 🔌 API методы (нужно добавить)

```typescript
// В polls.service.ts

export const pollsService = {
  // ... существующие методы
  
  /**
   * Получить последнее завершенное голосование
   */
  async getLastCompletedPoll(): Promise<Poll | null> {
    try {
      const response = await api.get('/polls/last-completed');
      return response.data;
    } catch (error) {
      console.error('Failed to get last completed poll:', error);
      return null;
    }
  },
  
  /**
   * Получить текущего лидера активного голосования
   */
  async getCurrentLeader(pollId: string): Promise<MenuItem & { voteCount: number; percentage: number } | null> {
    try {
      const response = await api.get(`/polls/${pollId}/leader`);
      return response.data;
    } catch (error) {
      console.error('Failed to get current leader:', error);
      return null;
    }
  },
  
  /**
   * Повторить голосование (создать новое с теми же параметрами)
   */
  async repeatPoll(pollId: string): Promise<Poll> {
    const response = await api.post(`/polls/${pollId}/repeat`);
    return response.data;
  }
};
```

---

## ✅ Checklist реализации

### Подготовка
- [ ] Добавить импорты иконок: Repeat, Trophy, MessageSquare, TrendingUp, RefreshCw, Share2, Bell, Shuffle, Flame, Star, Zap
- [ ] Создать типы: ScenarioType, HeroAction, SecondaryAction, TertiaryAction, ScenarioConfig
- [ ] Добавить состояния для модалок

### Логика сценариев
- [ ] Реализовать getCurrentScenario()
- [ ] Создать конфигурации для всех 4 сценариев
- [ ] Реализовать getScenarioConfig()
- [ ] Добавить проверку checkIfUserVoted()
- [ ] Добавить проверку isWithinMinutes()

### UI компоненты
- [ ] Создать HeroActionCard
- [ ] Создать SecondaryActionsGrid
- [ ] Создать TertiaryActionButton
- [ ] Добавить shimmer эффект (CSS)
- [ ] Настроить градиенты

### Handler функции
- [ ] handleRepeatLastPoll()
- [ ] handleRandomVote()
- [ ] handleVoteForPopular()
- [ ] handleShowResults()
- [ ] handleSetReminder()
- [ ] handleInviteFriend()
- [ ] handleShowWinner()
- [ ] handleRepeatThisPoll()
- [ ] handleLeaveFeedback()
- [ ] handleShowTopDish()

### Модалки/Sheets
- [ ] RepeatPollModal
- [ ] RandomVoteModal с конфетти
- [ ] PopularVoteModal
- [ ] ResultsBottomSheet с auto-refresh
- [ ] ReminderBottomSheet

### API
- [ ] Добавить getLastCompletedPoll() в backend
- [ ] Добавить getCurrentLeader() в backend
- [ ] Добавить repeatPoll() в backend
- [ ] Протестировать все API методы

### Анимации
- [ ] Hero появление (spring animation)
- [ ] Live badge pulse
- [ ] Shimmer эффект
- [ ] Конфетти (react-confetti)
- [ ] Progress bar анимация

### Тестирование
- [ ] Проверить сценарий 1: active-not-voted
- [ ] Проверить сценарий 2: active-voted
- [ ] Проверить сценарий 3: no-active-poll
- [ ] Проверить сценарий 4: poll-ended
- [ ] Проверить переключение между сценариями
- [ ] Проверить все модалки
- [ ] Проверить haptic feedback
- [ ] Проверить thumb zones на мобильных
- [ ] Проверить dark/light theme

### Финализация
- [ ] Обновить документацию
- [ ] Добавить комментарии в код
- [ ] Code review
- [ ] Commit изменений

---

**Создано:** 07.10.2025  
**Статус:** Готово к реализации  
**Приоритет:** Высокий ⭐
