/**
 * 🎨 ICON MAPPING - Эмодзи → Lucide React Icons
 * 
 * Централизованный маппинг эмодзи на профессиональные SVG иконки.
 * Используется для миграции от эмодзи к единой иконочной системе.
 * 
 * @version 2.0.0
 * @date 2025-11-10
 */

import {
  // Food & Dining
  Utensils,
  UtensilsCrossed,
  Coffee,
  Salad,
  Beef,
  Fish,
  Cake,
  IceCream,
  Cookie,
  Pizza,
  Soup,
  Sandwich,
  Drumstick,
  
  // People & Social
  Users,
  User,
  UserCircle,
  Crown,
  Award,
  
  // Status & Feedback
  Trophy,
  CheckCircle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  AlertTriangle,
  
  // Time & Schedule
  Clock,
  Calendar,
  Timer,
  
  // Money & Finance
  Wallet,
  DollarSign,
  CreditCard,
  Coins,
  Banknote,
  
  // Actions
  Plus,
  Minus,
  Edit,
  Edit2,
  Trash,
  Trash2,
  Share,
  Share2,
  Send,
  
  // Navigation
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ArrowLeft,
  
  // Emotions & Celebration
  Sparkles,
  Star,
  Heart,
  Flame,
  Zap,
  PartyPopper,
  
  // Communication
  Bell,
  BellRing,
  MessageCircle,
  MessageSquare,
  
  // Misc
  TrendingUp,
  TrendingDown,
  BarChart,
  PieChart,
  Target,
  Gift,
  ShoppingBag,
  Package,
  
  type LucideIcon,
} from 'lucide-react';

/**
 * 🍽️ КАТЕГОРИИ БЛЮД
 * Маппинг emoji категорий еды на Lucide иконки
 */
export const DISH_CATEGORY_ICONS: Record<string, LucideIcon> = {
  // Основные категории
  main: Utensils,              // 🍽️ → основное блюдо
  appetizer: UtensilsCrossed,  // 🥗 → закуски
  soup: Soup,                  // 🍲 → супы
  salad: Salad,                // 🥗 → салаты
  
  // Мясо и рыба
  meat: Beef,                  // 🥩 → мясо
  chicken: Drumstick,          // 🍗 → курица
  fish: Fish,                  // 🐟 → рыба
  
  // Быстрая еда
  pizza: Pizza,                // 🍕 → пицца
  sandwich: Sandwich,          // 🥪 → сэндвич
  burger: Sandwich,            // 🍔 → бургер (closest match)
  
  // Десерты
  dessert: Cake,               // 🍰 → десерт
  cake: Cake,                  // 🎂 → торт
  icecream: IceCream,          // 🍦 → мороженое
  cookie: Cookie,              // 🍪 → печенье
  
  // Напитки
  drink: Coffee,               // ☕ → напитки
  coffee: Coffee,              // ☕ → кофе
  
  // Дефолт
  default: Utensils,           // универсальная иконка
} as const;

/**
 * ✅ СТАТУСЫ И ОБРАТНАЯ СВЯЗЬ
 * Маппинг emoji статусов на Lucide иконки
 */
export const STATUS_ICONS: Record<string, LucideIcon> = {
  success: CheckCircle,        // ✅ → успех
  completed: CheckCircle2,     // ✔️ → завершено
  error: XCircle,              // ❌ → ошибка
  failed: XCircle,             // ❎ → провалено
  warning: AlertCircle,        // ⚠️ → предупреждение
  alert: AlertTriangle,        // 🚨 → тревога
  info: Info,                  // ℹ️ → информация
  pending: Clock,              // ⏳ → ожидание
} as const;

/**
 * 🏆 ДОСТИЖЕНИЯ И НАГРАДЫ
 */
export const ACHIEVEMENT_ICONS: Record<string, LucideIcon> = {
  trophy: Trophy,              // 🏆 → трофей
  crown: Crown,                // 👑 → корона
  award: Award,                // 🎖️ → награда
  star: Star,                  // ⭐ → звезда
  medal: Award,                // 🥇 → медаль
  winner: Trophy,              // 🥇 → победитель
} as const;

/**
 * 👥 ПОЛЬЗОВАТЕЛИ И РОЛИ
 */
export const USER_ICONS: Record<string, LucideIcon> = {
  user: User,                  // 👤 → пользователь
  users: Users,                // 👥 → группа
  avatar: UserCircle,          // 🧑 → аватар
  admin: Crown,                // 👑 → администратор
  responsible: Crown,          // 👨‍🍳 → ответственный
  participant: User,           // 🙋 → участник
} as const;

/**
 * ⏰ ВРЕМЯ И ДАТЫ
 */
export const TIME_ICONS: Record<string, LucideIcon> = {
  clock: Clock,                // ⏰ → часы
  time: Clock,                 // 🕐 → время
  timer: Timer,                // ⏱️ → таймер
  calendar: Calendar,          // 📅 → календарь
  schedule: Calendar,          // 📆 → расписание
} as const;

/**
 * 💰 ФИНАНСЫ
 */
export const FINANCE_ICONS: Record<string, LucideIcon> = {
  wallet: Wallet,              // 💰 → кошелек
  money: DollarSign,           // 💵 → деньги
  payment: CreditCard,         // 💳 → оплата
  coins: Coins,                // 🪙 → монеты
  cash: Banknote,              // 💴 → наличные
  budget: Wallet,              // 💼 → бюджет
} as const;

/**
 * ✏️ ДЕЙСТВИЯ
 */
export const ACTION_ICONS: Record<string, LucideIcon> = {
  add: Plus,                   // ➕ → добавить
  plus: Plus,                  // ➕ → плюс
  remove: Minus,               // ➖ → убрать
  minus: Minus,                // ➖ → минус
  edit: Edit2,                 // ✏️ → редактировать
  delete: Trash2,              // 🗑️ → удалить
  share: Share2,               // 📤 → поделиться
  send: Send,                  // 📨 → отправить
  gift: Gift,                  // 🎁 → подарок
  package: Package,            // 📦 → пакет
} as const;

/**
 * 🎉 ЭМОЦИИ И ПРАЗДНОВАНИЕ
 */
export const EMOTION_ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,          // ✨ → искры
  star: Star,                  // ⭐ → звезда
  heart: Heart,                // ❤️ → сердце
  fire: Flame,                 // 🔥 → огонь
  zap: Zap,                    // ⚡ → молния
  party: PartyPopper,          // 🎉 → праздник
  celebrate: Sparkles,         // 🎊 → праздновать
} as const;

/**
 * 📊 СТАТИСТИКА И АНАЛИТИКА
 */
export const ANALYTICS_ICONS: Record<string, LucideIcon> = {
  trending: TrendingUp,        // 📈 → тренд вверх
  trendingUp: TrendingUp,      // 📈 → рост
  trendingDown: TrendingDown,  // 📉 → падение
  chart: BarChart,             // 📊 → график
  pie: PieChart,               // 🥧 → круговая диаграмма
  target: Target,              // 🎯 → цель
  popular: TrendingUp,         // 🔥 → популярное
} as const;

/**
 * 🔔 УВЕДОМЛЕНИЯ
 */
export const NOTIFICATION_ICONS: Record<string, LucideIcon> = {
  bell: Bell,                  // 🔔 → колокольчик
  notification: BellRing,      // 🔔 → уведомление
  alert: BellRing,             // 🚨 → оповещение
  message: MessageCircle,      // 💬 → сообщение
  chat: MessageSquare,         // 💭 → чат
} as const;

/**
 * 🎯 ОБЪЕДИНЕННЫЙ МАППИНГ
 * Все иконки в одном месте для быстрого доступа
 */
export const ICON_MAP = {
  ...DISH_CATEGORY_ICONS,
  ...STATUS_ICONS,
  ...ACHIEVEMENT_ICONS,
  ...USER_ICONS,
  ...TIME_ICONS,
  ...FINANCE_ICONS,
  ...ACTION_ICONS,
  ...EMOTION_ICONS,
  ...ANALYTICS_ICONS,
  ...NOTIFICATION_ICONS,
} as const;

/**
 * 🔧 UTILITY FUNCTIONS
 */

/**
 * Получить иконку по ключу с fallback
 */
export const getIcon = (key: string, fallback: LucideIcon = Utensils): LucideIcon => {
  return ICON_MAP[key as keyof typeof ICON_MAP] || fallback;
};

/**
 * Получить иконку категории блюда
 */
export const getDishCategoryIcon = (category: string): LucideIcon => {
  return DISH_CATEGORY_ICONS[category] || DISH_CATEGORY_ICONS.default;
};

/**
 * Получить иконку статуса
 */
export const getStatusIcon = (status: string): LucideIcon => {
  return STATUS_ICONS[status] || STATUS_ICONS.info;
};

/**
 * Проверить, существует ли иконка для ключа
 */
export const hasIcon = (key: string): boolean => {
  return key in ICON_MAP;
};

/**
 * 🎨 EMOJI → ICON MIGRATION GUIDE
 * 
 * Используйте этот маппинг для замены эмодзи на иконки:
 * 
 * @example
 * // ❌ СТАРОЕ:
 * <span>🍽️</span>
 * 
 * // ✅ НОВОЕ:
 * import { getDishCategoryIcon } from '@/lib/iconMapping';
 * const Icon = getDishCategoryIcon('main');
 * <Icon className={`${ICON_SIZES.lg} text-peach-500`} />
 * 
 * @example
 * // ❌ СТАРОЕ:
 * <span>✅</span>
 * 
 * // ✅ НОВОЕ:
 * import { STATUS_ICONS } from '@/lib/iconMapping';
 * <STATUS_ICONS.success className={`${ICON_SIZES.md} text-mint-500`} />
 */

/**
 * 📝 TYPE EXPORTS
 */
export type IconCategory = 
  | 'dish'
  | 'status'
  | 'achievement'
  | 'user'
  | 'time'
  | 'finance'
  | 'action'
  | 'emotion'
  | 'analytics'
  | 'notification';

export type IconKey = keyof typeof ICON_MAP;
