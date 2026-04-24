import { Request, Response } from 'express';
import { eventBus, SSEEventName, SSEEventMap } from '../../services/event-bus.service';
import { logger } from '../../utils/logger';

const HEARTBEAT_INTERVAL_MS = 25_000;
const MAX_CONNECTIONS_PER_POLL = 50;

/** Активные SSE соединения: pollId -> Set<Response> */
const activeConnections = new Map<number, Set<Response>>();

/**
 * Получить количество активных соединений (для мониторинга)
 */
export function getSSEConnectionCount(): {
  total: number;
  byPoll: Record<number, number>;
} {
  let total = 0;
  const byPoll: Record<number, number> = {};

  activeConnections.forEach((connections, pollId) => {
    byPoll[pollId] = connections.size;
    total += connections.size;
  });

  return { total, byPoll };
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
  static stream(req: Request, res: Response): void {
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

    const user = (req as any).user;
    const userId = user?.id;

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

    logger.info(`SSE client connected: poll=${pollId}, user=${userId}`, {
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
    const cleanup = (): void => {
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

      logger.info(`SSE client disconnected: poll=${pollId}, user=${userId}`, {
        totalConnections: getSSEConnectionCount().total,
      });

      if (!res.writableEnded) {
        res.end();
      }
    };

    req.on('close', cleanup);
    req.on('error', cleanup);
  }
}
