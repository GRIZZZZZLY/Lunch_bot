import { apiService, ApiResponse } from './api.service';

const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true';

export interface Poll {
  id: number;
  groupId: number;
  title?: string;
  description?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  duration: number;
  startedAt: string;
  endedAt?: string;
  endTime?: string; // Alias for endedAt (used in frontend)
  messageId?: number;
  selectedMenuItemIds?: string; // JSON array of menu item IDs selected for this poll
  isMultiSelect?: boolean;
  maxSelections?: number;
  createdAt: string;
  updatedAt: string;
  _count?: {
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
  result?: PollResult;
}

export interface Vote {
  id: number;
  pollId: number;
  userId: number;
  menuItemId: number;
  createdAt: string;
  user: {
    id: number;
    telegramId?: string | number;
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
  winnerMenuItemId?: number;
  responsibleUserId?: number;
  totalVotes: number;
  isRouletteRun: boolean;
  createdAt: string;
  rouletteData?: string | null;
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
  winnerMenuItem?: PollResult['winnerItem'];
  responsibleUser?: PollResult['responsible'];
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

export interface UserParticipationStats {
  totalVotes: number;
  totalPolls: number;
  participationRate: number;
  favoriteItems: Array<{
    itemId: number;
    itemName: string;
    voteCount: number;
    percentage: number;
  }>;
  recentActivity: Array<{
    pollId: number;
    pollTitle: string;
    votedAt: string;
    itemName: string;
  }>;
}

export interface PollResultsData {
  result: PollResult;
  breakdown: VoteBreakdown[];
}

export interface PopularItem {
  id: number;
  name: string;
  menuItemName?: string;
  description?: string;
  price?: number;
  voteCount: number;
  totalVotes?: number;
  winCount: number;
  percentage?: number;
  imageUrl?: string;
  _count: {
    votes: number;
    pollResults: number;
  };
}

// Multi-Winner Voting Types
export interface VoterSnapshot {
  userId: number;
  firstName: string;
  lastName?: string;
  username?: string;
}

export interface Winner {
  menuItemId: number;
  menuItemName: string;
  menuItemSnapshot: {
    price?: number;
    imageUrl?: string;
  };
  voterIds: number[];
  voters: VoterSnapshot[];
  voteCount: number;
  votedAt: string[];
}

export interface BringOwnGroup {
  voterIds: number[];
  voters: VoterSnapshot[];
  count: number;
}

export interface SkippedGroup {
  voterIds: number[];
  voters: VoterSnapshot[];
  count: number;
}

export interface TieBreak {
  method: 'earliest' | 'alphabetical';
  appliedTo: number[];
  reason: string;
}

export interface ResultMeta {
  primaryWinnerId: number | null;
  tieBreak?: TieBreak;
  completedAt: string;
  completedBy: number;
  params: {
    minVotes: number;
    maxWinners: number | null;
  };
}

export interface MultiWinnerResultData {
  version: 1;
  mode: 'multi-winner';
  winners: Winner[];
  bringOwn: BringOwnGroup;
  skipped: SkippedGroup;
  meta: ResultMeta;
}

class PollsService {
  private normalizePollResult(result: PollResult): PollResult {
    return {
      ...result,
      winnerItem: result.winnerItem ?? result.winnerMenuItem,
      responsible: result.responsible ?? result.responsibleUser,
    };
  }

  private normalizePollResultsData(data: PollResultsData | PollResult): PollResultsData {
    if ('result' in data) {
      return {
        result: this.normalizePollResult(data.result),
        breakdown: data.breakdown ?? [],
      };
    }

    return {
      result: this.normalizePollResult(data),
      breakdown: [],
    };
  }

  /**
   * Получение всех голосований
   */
  async getAllPolls(): Promise<ApiResponse<Poll[]>> {
    if (USE_MOCK_API) {
      const { mockApiService } = await import('./mockApi.service');
      return await mockApiService.getAllPolls();
    }
    return await apiService.get<Poll[]>('/polls');
  }

  /**
   * Получение активных голосований
   */
  async getActivePolls(): Promise<ApiResponse<Poll[]>> {
    return await apiService.get<Poll[]>('/polls/active');
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
    isMultiSelect?: boolean;
    maxSelections?: number;
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
   * Голосование за несколько блюд (множественный выбор)
   */
  async voteForMultipleItems(pollId: number, menuItemIds: number[]): Promise<ApiResponse<Vote[]>> {
    return await apiService.post<Vote[]>(`/polls/${pollId}/vote-multiple`, { menuItemIds });
  }

  /**
   * Получение голосов пользователя в голосовании
   */
  async getUserVotes(pollId: number): Promise<ApiResponse<{ menuItemIds: number[] }>> {
    return await apiService.get<{ menuItemIds: number[] }>(`/votes/${pollId}/user`);
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
   * Отмена голосования (только для админов)
   */
  async cancelPoll(pollId: number, reason?: string): Promise<ApiResponse<Poll>> {
    return await apiService.patch<Poll>(`/polls/${pollId}/cancel`, { reason });
  }

  /**
   * Завершение голосования с множественными победителями
   * 
   * @param pollId - ID голосования
   * @param options - Параметры завершения
   * @returns PollResult + расшифрованный resultData
   */
  async completePollMultiWinner(
    pollId: number,
    options?: {
      minVotes?: number;
      maxWinners?: number | null;
      tieBreakMethod?: 'earliest' | 'alphabetical';
    }
  ): Promise<ApiResponse<{
    pollResult: PollResult;
    resultData: MultiWinnerResultData;
  }>> {
    return await apiService.patch<any>(
      `/polls/${pollId}/complete-multi`,
      options || {}
    );
  }

  /**
   * Получение голосования по ID
   */
  async getPollById(id: number): Promise<ApiResponse<PollWithDetails>> {
    return await apiService.get<PollWithDetails>(`/polls/${id}`);
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
  async getPollResults(pollId: number): Promise<ApiResponse<PollResultsData>> {
    if (USE_MOCK_API) {
      const { mockApiService } = await import('./mockApi.service');
      const response = await mockApiService.getPollResults(pollId);
      return response.success && response.data
        ? { ...response, data: this.normalizePollResultsData(response.data) }
        : response;
    }
    const response = await apiService.get<PollResultsData | PollResult>(`/polls/${pollId}/results`);
    return response.success && response.data
      ? { ...response, data: this.normalizePollResultsData(response.data) }
      : response as ApiResponse<PollResultsData>;
  }

  /**
   * Получение детального разбора голосов
   */
  async getPollVoteBreakdown(pollId: number): Promise<ApiResponse<VoteBreakdown[]>> {
    if (USE_MOCK_API) {
      const { mockApiService } = await import('./mockApi.service');
      return await mockApiService.getPollVoteBreakdown(pollId);
    }
    const response = await this.getPollResults(pollId);
    return response.success
      ? { ...response, data: response.data?.breakdown ?? [] }
      : { ...response, data: undefined };
  }

  /**
   * Получение всех голосов пользователя (история голосов)
   */
  async getAllUserVotes(userId?: number): Promise<ApiResponse<Vote[]>> {
    const url = userId ? `/polls/votes/user/${userId}` : '/polls/votes/my';
    return await apiService.get<Vote[]>(url);
  }

  /**
   * Получение статистики голосований
   */
  async getPollStats(groupId?: number): Promise<ApiResponse<PollStats>> {
    if (USE_MOCK_API) {
      const { mockApiService } = await import('./mockApi.service');
      return await mockApiService.getPollStats();
    }
    const url = groupId ? `/polls/stats?groupId=${groupId}` : '/polls/stats';
    return await apiService.get<PollStats>(url);
  }

  /**
   * Получение популярных блюд
   */
  async getPopularItems(limit: number = 10): Promise<ApiResponse<PopularItem[]>> {
    if (USE_MOCK_API) {
      const { mockApiService } = await import('./mockApi.service');
      return await mockApiService.getPopularItems();
    }
    return await apiService.get<PopularItem[]>(`/polls/popular-items?limit=${limit}`);
  }

  /**
   * Получение статистики участия пользователя
   */
  async getUserParticipationStats(userId?: number): Promise<ApiResponse<UserParticipationStats>> {
    const url = userId ? `/polls/user-stats/${userId}` : '/polls/user-stats/my';
    return await apiService.get<any>(url);
  }

  /**
   * Получение последнего завершённого голосования
   * Используется для функции "Повторить вчерашнее"
   */
  async getLastCompleted(groupId?: number): Promise<ApiResponse<Poll | null>> {
    const url = groupId
      ? `/polls/last-completed?groupId=${groupId}`
      : '/polls/last-completed';
    return await apiService.get<Poll | null>(url);
  }

  /**
   * Повторить голосование (создать копию)
   * Доступно только для админов
   */
  async repeatPoll(pollId: number): Promise<ApiResponse<Poll>> {
    return await apiService.post<Poll>(`/polls/repeat/${pollId}`);
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
    const response = await this.getPollResults(pollId);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to export poll data');
    }

    if (format === 'csv') {
      const rows = [
        ['menuItemId', 'menuItemName', 'votes', 'percentage', 'voters'],
        ...response.data.breakdown.map(item => [
          item.menuItemId,
          item.menuItemName,
          item.votes,
          item.percentage,
          item.voters.map(voter => voter.firstName).join(', '),
        ]),
      ];
      return rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    }

    return response.data;
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
        if (poll.status === 'ACTIVE') {
          // ✅ FIX: Проверяем не истекло ли время
          if (poll.endTime && new Date(poll.endTime) <= now) {
            groups.completed.push(poll); // Истекшие в completed
          } else {
            groups.active.push(poll); // Активные в active
          }
        } else if (poll.status === 'COMPLETED' || poll.status === 'CANCELLED') {
          groups.completed.push(poll); // Завершенные в completed
        } else {
          // Будущие голосования (если будет такой статус)
          groups.upcoming.push(poll);
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
          aValue = a._count?.votes || 0;
          bValue = b._count?.votes || 0;
          break;
        case 'title':
          aValue = (a.title || '').toLowerCase();
          bValue = (b.title || '').toLowerCase();
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
   * Создание нового голосования
   */
  async createPoll(data: { groupId: number; duration?: number; title?: string }): Promise<ApiResponse<Poll>> {
    try {
      if (USE_MOCK_API) {
        const { mockApiService } = await import('./mockApi.service');
        return await mockApiService.createPoll(data);
      }

      return await apiService.post<Poll>('/polls', data);
    } catch (error) {
      console.error('Error creating poll:', error);
      throw error;
    }
  }

  /**
   * Завершение голосования
   */
  async closePoll(pollId: number): Promise<ApiResponse<PollResult>> {
    try {
      if (USE_MOCK_API) {
        const { mockApiService } = await import('./mockApi.service');
        return await mockApiService.closePoll(pollId);
      }

      return await this.completePoll(pollId);
    } catch (error) {
      console.error('Error closing poll:', error);
      throw error;
    }
  }

  /**
   * Голосование за блюдо
   */
  async vote(pollId: number, menuItemId: number): Promise<ApiResponse<Vote>> {
    try {
      if (USE_MOCK_API) {
        const { mockApiService } = await import('./mockApi.service');
        return await mockApiService.vote(pollId, menuItemId);
      }

      return await apiService.post<Vote>(`/polls/${pollId}/vote`, { menuItemId });
    } catch (error) {
      console.error('Error voting:', error);
      throw error;
    }
  }

  /**
   * Получение последнего завершённого голосования сегодня
   */
  async getTodayCompletedPoll(groupId: number): Promise<ApiResponse<PollWithDetails | null>> {
    try {
      const response = await apiService.get<PollWithDetails | null>(`/polls/today-completed/${groupId}`);
      return response;
    } catch (error) {
      console.error('Error fetching today completed poll:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }
}

export const pollsService = new PollsService();
