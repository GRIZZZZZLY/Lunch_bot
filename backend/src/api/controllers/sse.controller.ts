import { Request, Response } from 'express';
import { eventBus, SSEEventName, SSEEventMap } from '../../services/event-bus.service';
import { GroupService } from '../../services/group.service';
import { PollService } from '../../services/poll.service';
import { logger } from '../../utils/logger';

const HEARTBEAT_INTERVAL_MS = 25_000;
const MAX_CONNECTIONS_PER_POLL = 50;
const MAX_CONNECTIONS_PER_USER = 5;
const MAX_CONNECTIONS_TOTAL = 500;

/** Активные SSE соединения: pollId -> Set<Response> */
const activeConnections = new Map<number, Set<Response>>();
const userConnections = new Map<number, Set<Response>>();

/**
 * Получить количество активных соединений (для мониторинга)
 */
/** Персональные потоки (деньги): userId -> Set<Response>. */
const personalConnections = new Map<number, Set<Response>>();

export function getSSEConnectionCount(): {
  total: number;
  byPoll: Record<number, number>;
  personal: number;
} {
  let total = 0;
  const byPoll: Record<number, number> = {};

  activeConnections.forEach((connections, pollId) => {
    byPoll[pollId] = connections.size;
    total += connections.size;
  });

  /* Персональные потоки тоже в total: иначе метрика недооценивает нагрузку и
     лимит MAX_CONNECTIONS_TOTAL считался бы по половине соединений. */
  let personal = 0;
  personalConnections.forEach((connections) => {
    personal += connections.size;
  });

  return { total: total + personal, byPoll, personal };
}

/**
 * Отправить SSE сообщение клиенту
 */
function sendSSEMessage(
  res: Response,
  event: string,
  data: unknown
): boolean {
  try {
    if (res.writableEnded || res.destroyed) {
      return false;
    }
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    return true;
  } catch (error) {
    logger.error('Failed to send SSE message:', error);
    return false;
  }
}

/**
 * SSE endpoint: GET /api/polls/:pollId/stream
 *
 * Стримит real-time события для конкретного poll.
 * Требует аутентификации через telegramAuthMiddleware.
 */
export class SSEController {
  static async stream(req: Request, res: Response): Promise<void> {
    const rawPollId = req.params.pollId;
    const pollId = parseInt(
      Array.isArray(rawPollId) ? rawPollId[0] : rawPollId,
      10
    );

    if (isNaN(pollId) || pollId <= 0) {
      res.status(400).json({
        success: false,
        error: 'Invalid poll ID',
        code: 'INVALID_POLL_ID',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const user = (req as any).user;
    const pollGroupId = await PollService.getPollGroupId(pollId);
    if (!pollGroupId) {
      res.status(404).json({
        success: false,
        error: 'Poll not found',
        code: 'POLL_NOT_FOUND',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (
      !user?.isAdmin &&
      !(await GroupService.isUserGroupMember(user.id, pollGroupId))
    ) {
      res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'FORBIDDEN',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Проверяем лимит соединений на poll
    const existingConnections = activeConnections.get(pollId);
    if (existingConnections && existingConnections.size >= MAX_CONNECTIONS_PER_POLL) {
      logger.warn(`SSE connection limit reached for poll ${pollId}`, {
        current: existingConnections.size,
        max: MAX_CONNECTIONS_PER_POLL,
      });
      res.status(503).json({
        success: false,
        error: 'Too many connections for this poll',
        code: 'CONNECTION_LIMIT',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const userId = user?.id as number;
    const totalConnections = getSSEConnectionCount().total;
    const existingUserConnections = userConnections.get(userId);

    if (
      totalConnections >= MAX_CONNECTIONS_TOTAL ||
      (existingUserConnections?.size ?? 0) >= MAX_CONNECTIONS_PER_USER
    ) {
      logger.warn('SSE connection limit reached', {
        pollId,
        totalConnections,
        userConnections: existingUserConnections?.size ?? 0,
      });
      res.setHeader('Retry-After', '30');
      res.status(503).json({
        success: false,
        error: 'Too many streaming connections',
        code: 'CONNECTION_LIMIT',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Настраиваем SSE заголовки
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Отключаем буферизацию nginx/ngrok
    });

    // Отправляем начальное событие подключения
    sendSSEMessage(res, 'connected', {
      pollId,
      userId,
      timestamp: new Date().toISOString(),
    });

    // Регистрируем соединение
    if (!activeConnections.has(pollId)) {
      activeConnections.set(pollId, new Set());
    }
    activeConnections.get(pollId)!.add(res);
    if (!userConnections.has(userId)) {
      userConnections.set(userId, new Set());
    }
    userConnections.get(userId)!.add(res);

    logger.info('SSE client connected', {
      pollId,
      totalConnections: getSSEConnectionCount().total,
    });

    // Heartbeat для поддержания соединения
    const heartbeatTimer = setInterval(() => {
      const sent = sendSSEMessage(res, 'heartbeat', {
        timestamp: new Date().toISOString(),
      });
      if (!sent) {
        cleanup();
      }
    }, HEARTBEAT_INTERVAL_MS);

    // Слушатели EventBus для этого poll
    const eventListeners: Array<{
      event: SSEEventName;
      handler: (data: SSEEventMap[SSEEventName]) => void;
    }> = [];

    const subscribeToEvent = <K extends SSEEventName>(eventName: K): void => {
      const handler = (data: SSEEventMap[K]): void => {
        // Фильтруем события только для этого poll
        if ('pollId' in data && data.pollId !== pollId) {
          return;
        }
        sendSSEMessage(res, eventName, data);
      };

      eventBus.on(eventName, handler);
      eventListeners.push({
        event: eventName,
        handler: handler as (data: SSEEventMap[SSEEventName]) => void,
      });
    };

    // Подписываемся на все релевантные события
    subscribeToEvent('poll_updated');
    subscribeToEvent('category_order_updated');
    subscribeToEvent('responsible_selected');

    // Cleanup при отключении клиента
    let cleanedUp = false;
    const cleanup = (): void => {
      if (cleanedUp) return;
      cleanedUp = true;
      clearInterval(heartbeatTimer);

      // Отписываемся от EventBus
      eventListeners.forEach(({ event, handler }) => {
        eventBus.off(event, handler);
      });

      // Удаляем соединение из реестра
      const connections = activeConnections.get(pollId);
      if (connections) {
        connections.delete(res);
        if (connections.size === 0) {
          activeConnections.delete(pollId);
        }
      }

      const connectionsForUser = userConnections.get(userId);
      if (connectionsForUser) {
        connectionsForUser.delete(res);
        if (connectionsForUser.size === 0) {
          userConnections.delete(userId);
        }
      }

      logger.info('SSE client disconnected', {
        pollId,
        totalConnections: getSSEConnectionCount().total,
      });

      if (!res.writableEnded) {
        res.end();
      }
    };

    req.on('close', cleanup);
    req.on('error', cleanup);
  }

  /**
   * SSE endpoint: GET /api/sse/me/stream
   *
   * Персональный поток денежных событий. Привязан к пользователю, а не к опросу:
   * бюджет показывает «мои долги / вам должны», а магазинная транзакция опроса
   * может не иметь вовсе. Авторизация тривиальна — поток отдаётся владельцу
   * токена и никому больше, и фильтр по audience гарантирует, что чужой переход
   * сюда не попадёт.
   */
  static async streamMe(req: Request, res: Response): Promise<void> {
    const user = (req as any).user;
    const userId = user?.id as number;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const openForUser =
      (personalConnections.get(userId)?.size ?? 0) +
      (userConnections.get(userId)?.size ?? 0);
    if (
      getSSEConnectionCount().total >= MAX_CONNECTIONS_TOTAL ||
      openForUser >= MAX_CONNECTIONS_PER_USER
    ) {
      logger.warn('Personal SSE connection limit reached', { userId, openForUser });
      res.setHeader('Retry-After', '30');
      res.status(503).json({
        success: false,
        error: 'Too many streaming connections',
        code: 'CONNECTION_LIMIT',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    sendSSEMessage(res, 'connected', { userId, timestamp: new Date().toISOString() });

    if (!personalConnections.has(userId)) {
      personalConnections.set(userId, new Set());
    }
    personalConnections.get(userId)!.add(res);
    logger.info('Personal SSE client connected', {
      userId,
      totalConnections: getSSEConnectionCount().total,
    });

    const heartbeatTimer = setInterval(() => {
      if (!sendSSEMessage(res, 'heartbeat', { timestamp: new Date().toISOString() })) {
        cleanup();
      }
    }, HEARTBEAT_INTERVAL_MS);

    /* Фильтр по адресату: событие уходит только тем двоим, кого касается. */
    const onDebtUpdated = (data: SSEEventMap['debt_updated']): void => {
      if (!data.audience.includes(userId)) return;
      sendSSEMessage(res, 'debt_updated', data);
    };
    eventBus.on('debt_updated', onDebtUpdated);

    let cleanedUp = false;
    const cleanup = (): void => {
      if (cleanedUp) return;
      cleanedUp = true;
      clearInterval(heartbeatTimer);
      eventBus.off('debt_updated', onDebtUpdated);

      const connections = personalConnections.get(userId);
      if (connections) {
        connections.delete(res);
        if (connections.size === 0) personalConnections.delete(userId);
      }

      logger.info('Personal SSE client disconnected', {
        userId,
        totalConnections: getSSEConnectionCount().total,
      });
      if (!res.writableEnded) res.end();
    };

    req.on('close', cleanup);
    req.on('error', cleanup);
  }
}
