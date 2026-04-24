import type { PopularItem } from './polls.service';

export interface LunchDnaVoteHistoryItem {
  menuItemId: number;
  menuItemName: string;
  pollId: number;
  votedAt: string;
}

export interface LunchDnaInput {
  voteHistory: readonly LunchDnaVoteHistoryItem[];
  popularItems: readonly PopularItem[];
  totalPolls: number;
}

export type LunchDnaAxisKey =
  | 'stability'
  | 'novelty'
  | 'comfort'
  | 'price'
  | 'teamSync'
  | 'polarity';

export interface LunchDnaAxis {
  key: LunchDnaAxisKey;
  label: string;
  value: number;
}

export interface LunchDnaInfoCard {
  title: string;
  description: string;
}

export interface LunchDnaProfile {
  archetype: string;
  confidence: 'low' | 'medium' | 'high';
  confidenceLabel: string;
  summary: string;
  isFallback: boolean;
  historySampleSize: number;
  tags: string[];
  axes: LunchDnaAxis[];
  baseline: LunchDnaInfoCard;
  pulse: LunchDnaInfoCard;
}

const MIN_PROFILE_VOTES = 5;
const HIGH_CONFIDENCE_VOTES = 12;

const AXIS_LABELS: Record<LunchDnaAxisKey, string> = {
  stability: 'Стабильность',
  novelty: 'Открытость',
  comfort: 'Comfort',
  price: 'Цена',
  teamSync: 'Синхронность',
  polarity: 'Полярность',
};

const clamp = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

const toDishKey = (value: string): string => value.trim().toLowerCase();

const buildFallbackAxes = (): LunchDnaAxis[] =>
  (Object.keys(AXIS_LABELS) as LunchDnaAxisKey[]).map(key => ({
    key,
    label: AXIS_LABELS[key],
    value: 50,
  }));

const getConfidence = (voteCount: number): LunchDnaProfile['confidence'] => {
  if (voteCount >= HIGH_CONFIDENCE_VOTES) {
    return 'high';
  }

  if (voteCount >= MIN_PROFILE_VOTES) {
    return 'medium';
  }

  return 'low';
};

const getConfidenceLabel = (confidence: LunchDnaProfile['confidence']): string => {
  switch (confidence) {
    case 'high':
      return 'Высокая уверенность';
    case 'medium':
      return 'Уверенный сигнал';
    default:
      return 'Недостаточно данных';
  }
};

const getAxisValue = (axes: readonly LunchDnaAxis[], key: LunchDnaAxisKey): number =>
  axes.find(axis => axis.key === key)?.value ?? 50;

const buildPulseDescription = (
  history: readonly LunchDnaVoteHistoryItem[],
  novelty: number,
  stability: number
): string => {
  const recentSlice = history.slice(-3);
  const recentUnique = new Set(recentSlice.map(item => toDishKey(item.menuItemName))).size;

  if (recentSlice.length >= 3 && recentUnique === 1) {
    return 'Последние несколько голосований показывают, что ты держишься за один понятный выбор.';
  }

  if (novelty >= 65) {
    return 'Последние выборы говорят, что ты чаще пробуешь новое, чем держишься за привычное.';
  }

  if (stability >= 70) {
    return 'Сейчас твой паттерн особенно собранный: выбор выглядит устойчиво и последовательно.';
  }

  return 'Пока твой профиль держится в балансе между привычным выбором и небольшими экспериментами.';
};

const getArchetype = (axes: readonly LunchDnaAxis[]): { title: string; summary: string } => {
  const stability = getAxisValue(axes, 'stability');
  const novelty = getAxisValue(axes, 'novelty');
  const comfort = getAxisValue(axes, 'comfort');
  const teamSync = getAxisValue(axes, 'teamSync');
  const polarity = getAxisValue(axes, 'polarity');
  const price = getAxisValue(axes, 'price');

  if (teamSync >= 70 && stability >= 70 && polarity <= 35) {
    return {
      title: 'Архитектор обеда',
      summary:
        'Ты чаще выбираешь понятные блюда, хорошо попадаешь в taste baseline команды и редко голосуешь хаотично.',
    };
  }

  if (novelty >= 70 && polarity >= 55) {
    return {
      title: 'Исследователь меню',
      summary:
        'Твой профиль тянется к новизне: ты чаще обычного пробуешь новое и не боишься идти мимо общего тренда.',
    };
  }

  if (comfort >= 70 && stability >= 65 && novelty <= 40) {
    return {
      title: 'Верный классике',
      summary:
        'Ты держишься за проверенные comfort-блюда и редко меняешь курс без веской причины.',
    };
  }

  if (price >= 65 && stability >= 55) {
    return {
      title: 'Прагматик',
      summary:
        'Твой профиль выглядит рационально: ты избегаешь лишнего шума и выбираешь еду максимально осознанно.',
    };
  }

  if (polarity >= 70 && novelty >= 60 && teamSync <= 45) {
    return {
      title: 'Агент вкусового хаоса',
      summary:
        'Ты чаще обычного уходишь в редкие решения и собираешь профиль с ярко выраженным собственным курсом.',
    };
  }

  return {
    title: 'Тихий балансировщик',
    summary:
      'Твой профиль без экстремумов: ты держишь баланс между привычкой, любопытством и командным ритмом.',
  };
};

const buildTags = (axes: readonly LunchDnaAxis[]): string[] => {
  const stability = getAxisValue(axes, 'stability');
  const novelty = getAxisValue(axes, 'novelty');
  const comfort = getAxisValue(axes, 'comfort');
  const teamSync = getAxisValue(axes, 'teamSync');
  const polarity = getAxisValue(axes, 'polarity');

  const tags: string[] = [];

  if (stability >= 70) tags.push('любит проверенное');
  if (novelty >= 65) tags.push('тянется к новому');
  if (comfort >= 65) tags.push('comfort-first');
  if (teamSync >= 65) tags.push('часто совпадает с группой');
  if (polarity >= 60) tags.push('любит редкие выборы');

  return tags.slice(0, 3);
};

export function buildLunchDna(input: LunchDnaInput): LunchDnaProfile {
  const history = [...input.voteHistory].sort((left, right) =>
    left.votedAt.localeCompare(right.votedAt)
  );
  const confidence = getConfidence(history.length);

  if (history.length < MIN_PROFILE_VOTES) {
    return {
      archetype: 'Профиль формируется',
      confidence,
      confidenceLabel: getConfidenceLabel(confidence),
      summary:
        'Чтобы собрать Lunch DNA, нужно ещё 3–5 голосований. Пока рано делать сильные выводы.',
      isFallback: true,
      historySampleSize: history.length,
      tags: ['пока мало данных'],
      axes: buildFallbackAxes(),
      baseline: {
        title: 'Taste baseline',
        description:
          'Сначала нужно накопить больше реальных голосов, чтобы увидеть устойчивый вкусовой профиль.',
      },
      pulse: {
        title: 'Taste drift',
        description:
          'Пока данных мало: любые выводы о смещении вкуса будут слишком шумными.',
      },
    };
  }

  const voteCountByDish = history.reduce<Record<string, number>>((accumulator, item) => {
    const key = toDishKey(item.menuItemName);
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});

  const topDishCounts = Object.values(voteCountByDish).sort((left, right) => right - left);
  const topThreeVotes = topDishCounts.slice(0, 3).reduce((sum, current) => sum + current, 0);
  const uniqueDishCount = Object.keys(voteCountByDish).length;
  const popularDishNames = new Set(input.popularItems.map(item => toDishKey(item.name)));
  const popularChoiceCount = history.filter(item =>
    popularDishNames.has(toDishKey(item.menuItemName))
  ).length;

  const stability = clamp((topThreeVotes / history.length) * 100);
  const novelty = clamp((uniqueDishCount / history.length) * 100);
  const teamSync = clamp((popularChoiceCount / history.length) * 100);
  const comfort = clamp(stability * 0.55 + teamSync * 0.45);
  const price = 50;
  const polarity = clamp(100 - teamSync * 0.65 - stability * 0.35 + novelty * 0.2);

  const axes: LunchDnaAxis[] = [
    { key: 'stability', label: AXIS_LABELS.stability, value: stability },
    { key: 'novelty', label: AXIS_LABELS.novelty, value: novelty },
    { key: 'comfort', label: AXIS_LABELS.comfort, value: comfort },
    { key: 'price', label: AXIS_LABELS.price, value: price },
    { key: 'teamSync', label: AXIS_LABELS.teamSync, value: teamSync },
    { key: 'polarity', label: AXIS_LABELS.polarity, value: polarity },
  ];

  const archetype = getArchetype(axes);

  return {
    archetype: archetype.title,
    confidence,
    confidenceLabel: getConfidenceLabel(confidence),
    summary: archetype.summary,
    isFallback: false,
    historySampleSize: history.length,
    tags: buildTags(axes),
    axes,
    baseline: {
      title: 'Taste baseline',
      description:
        teamSync >= 65
          ? 'Твой выбор часто совпадает с популярным ядром группы — ты хорошо чувствуешь общий ритм команды.'
          : 'Твой выбор заметно отличается от общего ядра команды — это делает профиль более самостоятельным.',
    },
    pulse: {
      title: 'Taste drift',
      description: buildPulseDescription(history, novelty, stability),
    },
  };
}
