/**
 * Offline Queue Service
 * 
 * Хранит действия пользователя когда offline и синхронизирует при восстановлении сети
 * 
 * Use cases:
 * - User голосует offline → Queue сохраняет → Syncs when online
 * - User лайкает блюдо offline → Queue → Syncs
 * - User оставляет комментарий → Queue → Syncs
 * 
 * Benefits:
 * - User never loses actions
 * - Seamless offline/online transition
 * - Better UX (no "network error" frustrations)
 */

import localforage from 'localforage';

// Типы действий которые можно делать offline
export enum OfflineActionType {
  VOTE = 'VOTE',
  LIKE = 'LIKE',
  COMMENT = 'COMMENT',
  RATE = 'RATE',
}

export interface OfflineAction {
  id: string;
  type: OfflineActionType;
  payload: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

class OfflineQueueService {
  private queueKey = 'offline_action_queue';
  private isProcessing = false;
  private onlineListener: (() => void) | null = null;

  constructor() {
    // Настраиваем localforage для offline storage
    localforage.config({
      name: 'TelegramFoodBot',
      storeName: 'offline_queue',
      description: 'Queue for offline actions',
    });

    // Подписываемся на события online/offline
    this.setupNetworkListeners();
  }

  /**
   * Добавить действие в queue
   */
  async addToQueue(
    type: OfflineActionType,
    payload: any,
    maxRetries: number = 3
  ): Promise<void> {
    const action: OfflineAction = {
      id: `${type}_${Date.now()}_${Math.random()}`,
      type,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries,
    };

    const queue = await this.getQueue();
    queue.push(action);
    await localforage.setItem(this.queueKey, queue);

    console.log('[OfflineQueue] Action added:', action);

    // Если online, сразу пытаемся обработать
    if (navigator.onLine) {
      await this.processQueue();
    }
  }

  /**
   * Получить текущую queue
   */
  private async getQueue(): Promise<OfflineAction[]> {
    const queue = await localforage.getItem<OfflineAction[]>(this.queueKey);
    return queue || [];
  }

  /**
   * Обработать queue (синхронизация с сервером)
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      console.log('[OfflineQueue] Already processing');
      return;
    }

    if (!navigator.onLine) {
      console.log('[OfflineQueue] Offline, skipping processing');
      return;
    }

    this.isProcessing = true;
    const queue = await this.getQueue();

    console.log(`[OfflineQueue] Processing ${queue.length} actions`);

    const failedActions: OfflineAction[] = [];

    for (const action of queue) {
      try {
        await this.executeAction(action);
        console.log('[OfflineQueue] Action executed:', action.id);
      } catch (error) {
        console.error('[OfflineQueue] Action failed:', action.id, error);
        
        // Retry logic
        if (action.retryCount < action.maxRetries) {
          action.retryCount++;
          failedActions.push(action);
        } else {
          console.error('[OfflineQueue] Action exceeded max retries:', action.id);
          // Можно отправить в dead letter queue или показать user
        }
      }
    }

    // Сохраняем только failed actions
    await localforage.setItem(this.queueKey, failedActions);
    this.isProcessing = false;

    if (failedActions.length === 0) {
      console.log('[OfflineQueue] All actions synced! ✅');
    } else {
      console.warn(`[OfflineQueue] ${failedActions.length} actions failed, will retry`);
    }
  }

  /**
   * Выполнить конкретное действие (отправить на сервер)
   */
  private async executeAction(action: OfflineAction): Promise<void> {
    // TODO: Интегрировать с API service
    
    switch (action.type) {
      case OfflineActionType.VOTE:
        // await voteService.vote(action.payload);
        console.log('[OfflineQueue] Executing VOTE:', action.payload);
        break;
        
      case OfflineActionType.LIKE:
        // await menuService.like(action.payload);
        console.log('[OfflineQueue] Executing LIKE:', action.payload);
        break;
        
      case OfflineActionType.COMMENT:
        // await commentService.create(action.payload);
        console.log('[OfflineQueue] Executing COMMENT:', action.payload);
        break;
        
      case OfflineActionType.RATE:
        // await ratingService.rate(action.payload);
        console.log('[OfflineQueue] Executing RATE:', action.payload);
        break;
        
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }

    // Имитация API call
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Получить количество pending actions
   */
  async getPendingCount(): Promise<number> {
    const queue = await this.getQueue();
    return queue.length;
  }

  /**
   * Очистить queue (для testing/debug)
   */
  async clearQueue(): Promise<void> {
    await localforage.removeItem(this.queueKey);
    console.log('[OfflineQueue] Queue cleared');
  }

  /**
   * Настроить network listeners
   */
  private setupNetworkListeners() {
    // Когда становимся online - обрабатываем queue
    this.onlineListener = () => {
      console.log('[OfflineQueue] Network is online, processing queue...');
      this.processQueue();
    };

    window.addEventListener('online', this.onlineListener);

    window.addEventListener('offline', () => {
      console.log('[OfflineQueue] Network is offline');
    });
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.onlineListener) {
      window.removeEventListener('online', this.onlineListener);
    }
  }
}

// Singleton instance
export const offlineQueue = new OfflineQueueService();
