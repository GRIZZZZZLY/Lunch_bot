import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

/**
 * Типы SSE событий для real-time обновлений
 */
export interface SSEEventMap {
  poll_updated: PollUpdatedEvent;
  category_order_updated: CategoryOrderUpdatedEvent;
  responsible_selected: ResponsibleSelectedEvent;
}

export interface PollUpdatedEvent {
  pollId: number;
  type: 'vote_added' | 'vote_removed' | 'vote_changed' | 'poll_closed';
  userId?: number;
  timestamp: string;
}

export interface CategoryOrderUpdatedEvent {
  categoryOrderId: number;
  pollId: number;
  type: 'created' | 'updated' | 'finalized';
  timestamp: string;
}

export interface ResponsibleSelectedEvent {
  categoryOrderId: number;
  pollId: number;
  responsibleUserId: number;
  method: 'volunteer' | 'roulette' | 'auto';
  timestamp: string;
}

export type SSEEventName = keyof SSEEventMap;

/**
 * Типизированный EventBus для SSE событий.
 *
 * Singleton — один экземпляр на процесс.
 * Используется для передачи событий из сервисов (VoteService и т.д.)
 * в SSE контроллер, который стримит их клиентам.
 */
class EventBusService {
  private readonly emitter: EventEmitter;
  private static instance: EventBusService | null = null;

  private constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
    logger.info('EventBus initialized');
  }

  static getInstance(): EventBusService {
    if (!EventBusService.instance) {
      EventBusService.instance = new EventBusService();
    }
    return EventBusService.instance;
  }

  /**
   * Эмитить типизированное событие
   */
  emit<K extends SSEEventName>(
    eventName: K,
    data: SSEEventMap[K]
  ): void {
    logger.debug(`EventBus emit: ${eventName}`, { data });
    this.emitter.emit(eventName, data);
  }

  /**
   * Подписаться на типизированное событие
   */
  on<K extends SSEEventName>(
    eventName: K,
    listener: (data: SSEEventMap[K]) => void
  ): void {
    this.emitter.on(eventName, listener);
  }

  /**
   * Отписаться от типизированного события
   */
  off<K extends SSEEventName>(
    eventName: K,
    listener: (data: SSEEventMap[K]) => void
  ): void {
    this.emitter.off(eventName, listener);
  }

  /**
   * Количество слушателей для события
   */
  listenerCount(eventName: SSEEventName): number {
    return this.emitter.listenerCount(eventName);
  }

  /**
   * Сброс для тестов
   */
  static resetInstance(): void {
    if (EventBusService.instance) {
      EventBusService.instance.emitter.removeAllListeners();
      EventBusService.instance = null;
    }
  }
}

export const eventBus = EventBusService.getInstance();
