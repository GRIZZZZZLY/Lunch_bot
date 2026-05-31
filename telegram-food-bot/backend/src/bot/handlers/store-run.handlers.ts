import { BotContext } from '../../types/bot.types';
import { StoreRunService, StoreRunError } from '../../services/store-run.service';
import { UserService } from '../../services/user.service';
import { logger } from '../../utils/logger';

/**
 * Короткоживущий кэш исходного текста пользователя между
 * приёмом сообщения (когда активных забегов несколько) и
 * выбором конкретного забега через inline-кнопку.
 *
 * Ключ: internal user id. TTL 5 минут.
 */
interface PendingOrderText {
  text: string;
  expiresAt: number;
}

const PENDING_TTL_MS = 5 * 60 * 1000;
const pending = new Map<number, PendingOrderText>();

function putPending(userId: number, text: string): void {
  pending.set(userId, { text, expiresAt: Date.now() + PENDING_TTL_MS });
}

function takePending(userId: number): string | null {
  const entry = pending.get(userId);
  if (!entry) return null;
  pending.delete(userId);
  if (entry.expiresAt < Date.now()) return null;
  return entry.text;
}

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [userId, entry] of pending) {
    if (entry.expiresAt < now) pending.delete(userId);
  }
}, 60 * 1000).unref?.();

/**
 * Handler: текстовое сообщение в личке.
 *
 * Логика:
 * - Только private chat.
 * - Игнорирует команды (/...).
 * - Если у юзера нет активных COLLECTING-забегов — молча игнорирует
 *   (не перехватывая другие message handlers).
 * - Если один активный забег — парсит и добавляет позиции.
 * - Если несколько — отправляет inline-кнопки с выбором забега,
 *   текст откладывается в кэш до callback-а.
 */
export async function handleStoreRunTextMessage(ctx: BotContext): Promise<boolean> {
  const chat = ctx.chat;
  const text = ctx.message?.text;
  const tgUser = ctx.from;
  if (!chat || chat.type !== 'private') return false;
  if (!text || text.startsWith('/')) return false;
  if (!tgUser) return false;

  let dbUser;
  try {
    dbUser = await UserService.getUserByTelegramId(BigInt(tgUser.id));
  } catch (err) {
    logger.error('store-run text handler: failed to resolve user', { tgId: tgUser.id, err });
    return false;
  }
  if (!dbUser) return false;

  const runs = await StoreRunService.findCollectingRunsForParticipant(dbUser.id);
  if (runs.length === 0) return false;

  if (runs.length === 1) {
    const run = runs[0];
    await addParsedItemsToRun(ctx, run.id, text, dbUser.id);
    return true;
  }

  // Multiple active runs — ask which one
  putPending(dbUser.id, text);

  const runsWithInitiator = await Promise.all(
    runs.map(async (r) => {
      const full = await StoreRunService.getStoreRunById(r.id);
      return {
        id: r.id,
        storeName: r.storeName,
        initiatorName: full?.initiator?.firstName ?? 'коллега',
      };
    }),
  );

  await ctx.reply(
    `🛒 Куда добавить «${text.slice(0, 80)}${text.length > 80 ? '…' : ''}»?`,
    {
      reply_markup: {
        inline_keyboard: runsWithInitiator.map((r) => [
          {
            text: `${r.initiatorName} → ${r.storeName}`,
            callback_data: `storerun_addto:${r.id}`,
          },
        ]),
      },
    },
  );
  return true;
}

/**
 * Callback handler: storerun_addto:<runId>
 */
export async function handleStoreRunAddToCallback(
  ctx: BotContext,
  runId: number,
): Promise<void> {
  const tgUser = ctx.from;
  if (!tgUser) {
    await ctx.answerCallbackQuery('❌ Не удалось распознать пользователя. Перезапусти бота командой /start');
    return;
  }

  const dbUser = await UserService.getUserByTelegramId(BigInt(tgUser.id));
  if (!dbUser) {
    await ctx.answerCallbackQuery('Пользователь не найден');
    return;
  }

  const text = takePending(dbUser.id);
  if (!text) {
    await ctx.answerCallbackQuery('Сообщение устарело, напишите заново');
    return;
  }

  await ctx.answerCallbackQuery();
  await addParsedItemsToRun(ctx, runId, text, dbUser.id);
}

/**
 * Parse raw text and attach items to the given store run.
 */
async function addParsedItemsToRun(
  ctx: BotContext,
  runId: number,
  rawText: string,
  dbUserId: number,
): Promise<void> {
  const parsed = StoreRunService.parseTextOrder(rawText);
  if (parsed.length === 0) {
    await ctx.reply('Не смог распознать позиции. Попробуй через запятую: «Ред Булл, Сникерс».');
    return;
  }

  try {
    const items = await StoreRunService.addItemsBulk(runId, dbUserId, parsed);
    const run = await StoreRunService.getStoreRunById(runId);
    const storeLabel = run ? `«${run.storeName}»` : 'забег';
    const initiatorName = run?.initiator?.firstName ?? 'коллега';

    const itemsList = items.map((it) => `• ${it.name}`).join('\n');
    await ctx.reply(
      `✅ Добавил ${items.length} ${pluralize(items.length, 'позицию', 'позиции', 'позиций')} ` +
        `в забег ${initiatorName} ${storeLabel}:\n${itemsList}`,
    );
  } catch (err) {
    if (err instanceof StoreRunError) {
      await ctx.reply(`⚠️ ${err.message}`);
      return;
    }
    logger.error('store-run text handler: addItemsBulk failed', { runId, dbUserId, err });
    await ctx.reply('⚠️ Не получилось добавить — попробуй открыть Mini App.');
  }
}

function pluralize(n: number, one: string, few: string, many: string): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 19) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
