import { apiService, ApiResponse } from './api.service';
import { mockApiService } from './mockApi.service';
import type { UserLastVote, TopDish, UserVoteStatus } from '../types/polls';

const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true';

export interface Poll {
  id: number;
  groupId: number;
  title: string;
  description?: string;
  isActive: boolean;
  status?: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  endTime?: string;
  messageId?: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    votes: number;
  };
}

export interface PollWithDetails extends Poll {
  group: {
    id: number;
    title: string;
    telegramId: string;
  };
  votes: Vote[];
  results: PollResult[];
}

export interface Vote {
  id: number;
  pollId: number;
  userId: number;
  menuItemId: number;
  createdAt: string;
  user: {
    id: number;
    firstName: string;
    lastName?: string;
    username?: string;
  };
  menuItem: {
    id: number;
    name: string;
    description?: string;
    price?: number;
  };
}

export interface PollResult {
  id: number;
  pollId: number;
  winnerItemId?: number;
  responsibleId?: number;
  totalVotes: number;
  isRouletteRun: boolean;
  createdAt: string;
  poll?: Poll;
  winnerItem?: {
    id: number;
    name: string;
    description?: string;
    price?: number;
  };
  responsible?: {
    id: number;
    firstName: string;
    lastName?: string;
    username?: string;
    telegramId: string;
  };
}

export interface PollStats {
  totalPolls: number;
  activePolls: number;
  completedPolls: number;
  totalVotes: number;
  averageParticipants: number;
}

export interface VoteBreakdown {
  menuItemId: number;
  menuItemName: string;
  votes: number;
  percentage: number;
  voters: Array<{
    id: number;
    firstName: string;
    username?: string;
  }>;
}

export interface PopularItem {
  id: number;
  name: string;
  description?: string;
  price?: number;
  voteCount: number;
  winCount: number;
  _count: {
    votes: number;
    pollResults: number;
  };
}

class PollsService {
  /**
   * Получение всех голосований
   */
  async getAllPolls(): Promise<ApiResponse<Poll[]>> {
    if (USE_MOCK_API) {
      return await mockApiService.getAllPolls();
    }
    return await apiService.get<Poll[]>('/polls');
  }

  /**
   * Получение активных голосований
   */
  async getActivePolls(): Promise<ApiResponse<Poll[]>> {
    console.log('📡 [PollsService] getActivePolls() called');
    const response = await apiService.get<Poll[]>('/polls/active');
    console.log('📥 [PollsService] getActivePolls() response:', {
      success: response.success,
      hasData: !!response.data,
      isArray: Array.isArray(response.data),
      dataLength: response.data?.length || 0,
      firstPollId: response.data?.[0]?.id,
      error: response.error,
      code: response.code
    });
    return response;
  }

  /**
   * Получение активного голосования в группе
   */
  async getActivePollInGroup(groupId: number): Promise<ApiResponse<PollWithDetails | null>> {
    console.log(`📡 [PollsService] Checking active poll for group ${groupId}`);
    try {
      const response = await apiService.get<PollWithDetails | null>(`/polls/active/${groupId}`);
      console.log('📥 [PollsService] Active poll response:', JSON.stringify({
        success: response.success,
        hasData: !!response.data,
        pollId: response.data?.id
      }, null, 2));
      return response;
    } catch (error: any) {
      console.error('❌ [PollsService] Get active poll error:', error);
      throw error;
    }
  }

  /**
   * Создание голосования из WebApp
   */
  async createPollFromWebApp(data: {
    groupId: number;
    duration: number;
    selectedMenuItems?: number[];
    title?: string;
  }): Promise<ApiResponse<{
    pollId: number;
    messageId: number;
    groupTitle: string;
    duration: number;
    menuItemsCount: number;
  }>> {
    console.log('📤 [PollsService] Creating poll from WebApp:', JSON.stringify(data, null, 2));
    try {
      const response = await apiService.post<any>('/polls/create-from-webapp', data);
      console.log('📥 [PollsService] Create poll response:', JSON.stringify({
        success: response.success,
        hasData: !!response.data,
        error: response.error,
        code: response.code
      }, null, 2));
      return response;
    } catch (error: any) {
      console.error('❌ [PollsService] Create poll error:', JSON.stringify({
        success: error.success,
        error: error.error,
        code: error.code,
        status: error.status
      }, null, 2));
      throw error;
    }
  }

  /**
   * Голосование за блюдо
   */
  async voteForItem(pollId: number, menuItemId: number): Promise<ApiResponse<Vote>> {
    return await apiService.post<Vote>(`/polls/${pollId}/vote`, { menuItemId });
  }

  /**
   * Отмена голоса
   */
  async removeVote(pollId: number): Promise<ApiResponse<void>> {
    return await apiService.delete<void>(`/polls/${pollId}/vote`);
  }

  /**
   * Завершение голосования (только для админов)
   */
  async completePoll(pollId: number): Promise<ApiResponse<PollResult>> {
    return await apiService.patch<PollResult>(`/polls/${pollId}/complete`, {});
  }

  /**
   * Получение голосования по ID
   */
  async getPollById(id: number): Promise<ApiResponse<PollWithDetails>> {
    console.log('📡 [PollsService] getPollById() called with ID:', id);
    const response = await apiService.get<PollWithDetails>(`/polls/${id}`);
    console.log('📥 [PollsService] getPollById() response:', {
      success: response.success,
      hasData: !!response.data,
      pollId: response.data?.id,
      status: response.data?.status,
      error: response.error,
      code: response.code
    });
    return response;
  }

  /**
   * Получение истории голосований с пагинацией
   */
  async getPollHistory(params?: {
    limit?: number;
    offset?: number;
    groupId?: number;
  }): Promise<ApiResponse<{
    polls: Poll[];
    total: number;
    limit: number;
    offset: number;
    hasNext: boolean;
  }>> {
    const queryParams = new URLSearchParams();
    
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.groupId) queryParams.append('groupId', params.groupId.toString());

    const queryString = queryParams.toString();
    const url = queryString ? `/polls/history?${queryString}` : '/polls/history';
    
    return await apiService.get<any>(url);
  }

  /**
   * Получение результатов голосования
   */
  async getPollResults(pollId: number): Promise<ApiResponse<PollResult>> {
    if (USE_MOCK_API) {
      return await mockApiService.getPollResults(pollId);
    }
    return await apiService.get<PollResult>(`/polls/${pollId}/results`);
  }

  /**
   * Получение детального разбора голосов
   */
  async getPollVoteBreakdown(pollId: number): Promise<ApiResponse<VoteBreakdown[]>> {
    if (USE_MOCK_API) {
      return await mockApiService.getPollVoteBreakdown(pollId);
    }
    return await apiService.get<VoteBreakdown[]>(`/polls/${pollId}/breakdown`);
  }

  /**
   * Получение голосов пользователя
   */
  async getUserVotes(userId?: number): Promise<ApiResponse<Vote[]>> {
    const url = userId ? `/polls/votes/user/${userId}` : '/polls/votes/my';
    return await apiService.get<Vote[]>(url);
  }

  /**
   * Получение статистики голосований
   */
  async getPollStats(): Promise<ApiResponse<PollStats>> {
    if (USE_MOCK_API) {
      return await mockApiService.getPollStats();
    }
    return await apiService.get<PollStats>('/polls/stats');
  }

  /**
   * Получение популярных блюд
   */
  async getPopularItems(limit: number = 10): Promise<ApiResponse<PopularItem[]>> {
    if (USE_MOCK_API) {
      return await mockApiService.getPopularItems();
    }
    return await apiService.get<PopularItem[]>(`/polls/popular-items?limit=${limit}`);
  }

  /**
   * Получение статистики участия пользователя
   */
  async getUserParticipationStats(userId?: number): Promise<ApiResponse<{
    totalVotes: number;
    totalPolls: number;
    participationRate: number;
    favoriteItems: Array<{
      itemId: number;
      itemName: string;
      voteCount: number;
    }>;
    recentActivity: Array<{
      pollId: number;
      pollTitle: string;
      votedAt: string;
      itemName: string;
    }>;
  }>> {
    const url = userId ? `/polls/user-stats/${userId}` : '/polls/user-stats/my';
    return await apiService.get<any>(url);
  }

  /**
   * Получение тенденций голосований
   */
  async getPollTrends(days: number = 30): Promise<ApiResponse<{
    dailyStats: Array<{
      date: string;
      pollsCount: number;
      votesCount: number;
      participantsCount: number;
    }>;
    topCategories: Array<{
      category: string;
      pollsCount: number;
      avgParticipants: number;
    }>;
    peakHours: Array<{
      hour: number;
      votesCount: number;
    }>;
  }>> {
    return await apiService.get<any>(`/polls/trends?days=${days}`);
  }

  /**
   * Поиск голосований
   */
  async searchPolls(query: string): Promise<ApiResponse<Poll[]>> {
    return await apiService.get<Poll[]>(`/polls/search?q=${encodeURIComponent(query)}`);
  }

  /**
   * Сравнение результатов нескольких голосований
   */
  async comparePolls(pollIds: number[]): Promise<ApiResponse<{
    polls: Poll[];
    comparison: Array<{
      itemId: number;
      itemName: string;
      results: Array<{
        pollId: number;
        votes: number;
        percentage: number;
        position: number;
      }>;
    }>;
  }>> {
    return await apiService.post<any>('/polls/compare', { pollIds });
  }

  /**
   * Экспорт данных голосований
   */
  async exportPollData(pollId: number, format: 'json' | 'csv' = 'json'): Promise<any> {
    const response = await apiService.get(`/polls/${pollId}/export?format=${format}`, {
      responseType: 'blob'
    });
    return response;
  }

  /**
   * Форматирование времени до окончания голосования
   */
  formatTimeRemaining(endTime: string): string {
    const now = new Date();
    const end = new Date(endTime);
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) {
      return 'Завершено';
    }

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}д ${hours % 24}ч`;
    } else if (hours > 0) {
      return `${hours}ч ${minutes % 60}м`;
    } else {
      return `${minutes}м`;
    }
  }

  /**
   * Форматирование даты голосования
   */
  formatPollDate(dateString: string): string {
    return new Date(dateString).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Вычисление процента участия
   */
  calculateParticipationRate(votes: number, totalMembers: number): number {
    if (totalMembers === 0) return 0;
    return Math.round((votes / totalMembers) * 100);
  }

  /**
   * Группировка голосований по статусу
   */
  groupPollsByStatus(polls: Poll[]): {
    active: Poll[];
    completed: Poll[];
    upcoming: Poll[];
  } {
    const now = new Date();
    
    return polls.reduce(
      (groups, poll) => {
        if (poll.isActive) {
          if (poll.endTime && new Date(poll.endTime) > now) {
            groups.active.push(poll);
          } else {
            groups.active.push(poll);
          }
        } else {
          groups.completed.push(poll);
        }
        return groups;
      },
      { active: [] as Poll[], completed: [] as Poll[], upcoming: [] as Poll[] }
    );
  }

  /**
   * Сортировка голосований
   */
  sortPolls(
    polls: Poll[], 
    sortBy: 'date' | 'votes' | 'title' = 'date',
    order: 'asc' | 'desc' = 'desc'
  ): Poll[] {
    return [...polls].sort((a, b) => {
      let aValue: string | number | Date;
      let bValue: string | number | Date;

      switch (sortBy) {
        case 'date':
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
        case 'votes':
          aValue = a._count.votes;
          bValue = b._count.votes;
          break;
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return order === 'asc' ? -1 : 1;
      if (aValue > bValue) return order === 'asc' ? 1 : -1;
      return 0;
    });
  }

  /**
   * Получить последний голос пользователя
   */
  async getLastVote(): Promise<ApiResponse<UserLastVote | null>> {
    console.log('📡 [PollsService] getLastVote() called');
    const response = await apiService.get<UserLastVote | null>('/polls/my-last-vote');
    console.log('📥 [PollsService] getLastVote() response:', {
      success: response.success,
      hasData: !!response.data,
      error: response.error
    });
    return response;
  }

  /**
   * Оценить прошлый выбор
   */
  async rateLastVote(pollId: number, rating: 'like' | 'dislike'): Promise<ApiResponse<void>> {
    console.log('📡 [PollsService] rateLastVote() called', { pollId, rating });
    const response = await apiService.post<void>(`/polls/${pollId}/rate`, { rating });
    console.log('📥 [PollsService] rateLastVote() response:', {
      success: response.success,
      error: response.error
    });
    return response;
  }

  /**
   * Получить самое популярное блюдо
   */
  async getTopDish(): Promise<ApiResponse<TopDish>> {
    console.log('📡 [PollsService] getTopDish() called');
    const response = await apiService.get<TopDish>('/menu/top-dish');
    console.log('📥 [PollsService] getTopDish() response:', {
      success: response.success,
      hasData: !!response.data,
      error: response.error
    });
    return response;
  }

  /**
   * Проверить статус голоса в текущем голосовании
   */
  async getUserVoteStatus(pollId: number): Promise<ApiResponse<UserVoteStatus>> {
    console.log('📡 [PollsService] getUserVoteStatus() called', { pollId });
    const response = await apiService.get<UserVoteStatus>(`/polls/${pollId}/my-vote-status`);
    console.log('📥 [PollsService] getUserVoteStatus() response:', {
      success: response.success,
      hasVoted: response.data?.hasVoted,
      error: response.error
    });
    return response;
  }

  /**
   * Быстрый голос (повторить прошлый выбор)
   */
  async quickVote(pollId: number, menuItemId: number): Promise<ApiResponse<Vote>> {
    console.log('📡 [PollsService] quickVote() called', { pollId, menuItemId });
    const response = await apiService.post<Vote>(`/polls/${pollId}/quick-vote`, { menuItemId });
    console.log('📥 [PollsService] quickVote() response:', {
      success: response.success,
      hasData: !!response.data,
      error: response.error
    });
    return response;
  }

  /**
   * Случайный голос (рулетка)
   */
  async randomVote(pollId: number): Promise<ApiResponse<Vote>> {
    console.log('📡 [PollsService] randomVote() called', { pollId });
    const response = await apiService.post<Vote>(`/polls/${pollId}/random-vote`, {});
    console.log('📥 [PollsService] randomVote() response:', {
      success: response.success,
      hasData: !!response.data,
      selectedItem: response.data?.menuItem?.name,
      error: response.error
    });
    return response;
  }
}

export const pollsService = new PollsService();
