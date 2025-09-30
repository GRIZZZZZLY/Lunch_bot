import { ApiResponse } from './api.service';
import { MenuItem, MenuStats } from './menu.service';
import { User } from '../hooks/useAuth';
import { Poll, PollStats, PopularItem } from './polls.service';

// Mock данные для тестирования
const MOCK_USERS: User[] = [
  {
    id: 1,
    telegramId: '123456789',
    username: 'testuser',
    firstName: 'Иван',
    lastName: 'Иванов',
    isAdmin: true,
    isActive: true,
    createdAt: '2025-09-29T10:00:00.000Z',
  },
  {
    id: 2,
    telegramId: '987654321',
    username: 'user2',
    firstName: 'Мария',
    isAdmin: false,
    isActive: true,
    createdAt: '2025-09-29T11:00:00.000Z',
  },
];

const MOCK_MENU_ITEMS: MenuItem[] = [
  // Пицца
  {
    id: 1,
    name: 'Пицца Маргарита',
    description: 'Классическая итальянская пицца с томатным соусом, моцареллой и базиликом',
    price: 850,
    category: 'Пицца',
    imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=300&h=300&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=300&h=300&fit=crop',
      'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=300&h=300&fit=crop',
      'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=300&h=300&fit=crop'
    ],
    isActive: true,
    createdAt: '2025-09-29T08:00:00.000Z',
    updatedAt: '2025-09-29T08:00:00.000Z',
  },
  {
    id: 7,
    name: 'Пицца Пепперони',
    description: 'Острая пицца с пепперони, сыром моцарелла и томатным соусом',
    price: 920,
    category: 'Пицца',
    imageUrl: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=300&h=300&fit=crop',
    isActive: true,
    createdAt: '2025-09-29T08:15:00.000Z',
    updatedAt: '2025-09-29T08:15:00.000Z',
  },
  {
    id: 8,
    name: 'Пицца Четыре сыра',
    description: 'Пицца с четырьмя видами сыра: моцарелла, горгонзола, пармезан, чеддер',
    price: 980,
    category: 'Пицца',
    imageUrl: 'https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=300&h=300&fit=crop',
    isActive: true,
    createdAt: '2025-09-29T08:30:00.000Z',
    updatedAt: '2025-09-29T08:30:00.000Z',
  },

  // Супы
  {
    id: 2,
    name: 'Борщ украинский',
    description: 'Традиционный борщ с говядиной, подается со сметаной',
    price: 350,
    category: 'Супы',
    imageUrl: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=300&h=300&fit=crop',
    isActive: true,
    createdAt: '2025-09-29T08:30:00.000Z',
    updatedAt: '2025-09-29T08:30:00.000Z',
  },
  {
    id: 9,
    name: 'Солянка мясная',
    description: 'Сытный суп с копченостями, солеными огурцами и оливками',
    price: 380,
    category: 'Супы',
    imageUrl: 'https://images.unsplash.com/photo-1563379091339-03246963d51a?w=300&h=300&fit=crop',
    isActive: true,
    createdAt: '2025-09-29T08:45:00.000Z',
    updatedAt: '2025-09-29T08:45:00.000Z',
  },
  {
    id: 10,
    name: 'Том Ям',
    description: 'Острый тайский суп с креветками, грибами и лемонграссом',
    price: 420,
    category: 'Супы',
    imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=300&h=300&fit=crop',
    isActive: true,
    createdAt: '2025-09-29T09:00:00.000Z',
    updatedAt: '2025-09-29T09:00:00.000Z',
  },

  // Салаты
  {
    id: 3,
    name: 'Цезарь с курицей',
    description: 'Салат с куриным филе, листьями салата, пармезаном и соусом цезарь',
    price: 450,
    category: 'Салаты',
    imageUrl: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=300&h=300&fit=crop',
    isActive: true,
    createdAt: '2025-09-29T09:00:00.000Z',
    updatedAt: '2025-09-29T09:00:00.000Z',
  },
  {
    id: 11,
    name: 'Греческий салат',
    description: 'Свежие овощи, фета, оливки, заправленные оливковым маслом',
    price: 380,
    category: 'Салаты',
    imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=300&h=300&fit=crop',
    isActive: true,
    createdAt: '2025-09-29T09:15:00.000Z',
    updatedAt: '2025-09-29T09:15:00.000Z',
  },
  {
    id: 12,
    name: 'Салат с лососем',
    description: 'Слабосолёный лосось с авокадо, рукколой и каперсами',
    price: 520,
    category: 'Салаты',
    imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=300&h=300&fit=crop',
    isActive: true,
    createdAt: '2025-09-29T09:30:00.000Z',
    updatedAt: '2025-09-29T09:30:00.000Z',
  },

  // Мясные блюда
  {
    id: 4,
    name: 'Стейк рибай',
    description: 'Говяжий стейк средней прожарки с овощами гриль',
    price: 1200,
    category: 'Мясные блюда',
    imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=300&h=300&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=300&h=300&fit=crop',
      'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=300&h=300&fit=crop',
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300&h=300&fit=crop'
    ],
    isActive: true,
    createdAt: '2025-09-29T09:30:00.000Z',
    updatedAt: '2025-09-29T09:30:00.000Z',
  },
  {
    id: 13,
    name: 'Котлеты по-киевски',
    description: 'Куриные котлеты с маслом и зеленью, в золотистой панировке',
    price: 680,
    category: 'Мясные блюда',
    imageUrl: 'https://images.unsplash.com/photo-1532636875304-0c89119d9b4d?w=300&h=300&fit=crop',
    isActive: true,
    createdAt: '2025-09-29T09:45:00.000Z',
    updatedAt: '2025-09-29T09:45:00.000Z',
  },
  {
    id: 14,
    name: 'Шашлык из баранины',
    description: 'Сочный шашлык из молодой баранины с луком и зеленью',
    price: 950,
    category: 'Мясные блюда',
    imageUrl: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=300&h=300&fit=crop',
    isActive: true,
    createdAt: '2025-09-29T10:00:00.000Z',
    updatedAt: '2025-09-29T10:00:00.000Z',
  },

  // Паста
  {
    id: 5,
    name: 'Паста Карбонара',
    description: 'Спагетти с беконом, яичным желтком и пармезаном',
    price: 650,
    category: 'Паста',
    imageUrl: 'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=300&h=300&fit=crop',
    isActive: true,
    createdAt: '2025-09-29T10:00:00.000Z',
    updatedAt: '2025-09-29T10:00:00.000Z',
  },
  {
    id: 15,
    name: 'Паста Болоньезе',
    description: 'Спагетти с мясным соусом по-болонски из говядины',
    price: 580,
    category: 'Паста',
    imageUrl: 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=300&h=300&fit=crop',
    isActive: true,
    createdAt: '2025-09-29T10:15:00.000Z',
    updatedAt: '2025-09-29T10:15:00.000Z',
  },
  {
    id: 16,
    name: 'Паста с морепродуктами',
    description: 'Лингвини с креветками, мидиями и кальмарами в сливочном соусе',
    price: 780,
    category: 'Паста',
    imageUrl: 'https://images.unsplash.com/photo-1589462733217-e34786a37abb?w=300&h=300&fit=crop',
    isActive: true,
    createdAt: '2025-09-29T10:30:00.000Z',
    updatedAt: '2025-09-29T10:30:00.000Z',
  },

  // Десерты
  {
    id: 6,
    name: 'Тирамису',
    description: 'Классический итальянский десерт с маскарпоне и кофе',
    price: 300,
    category: 'Десерты',
    isActive: false,
    createdAt: '2025-09-29T10:30:00.000Z',
    updatedAt: '2025-09-29T10:30:00.000Z',
  },
  {
    id: 17,
    name: 'Чизкейк Нью-Йорк',
    description: 'Нежный сырный торт с ягодным соусом',
    price: 280,
    category: 'Десерты',
    imageUrl: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=300&h=300&fit=crop',
    isActive: true,
    createdAt: '2025-09-29T10:45:00.000Z',
    updatedAt: '2025-09-29T10:45:00.000Z',
  },
  {
    id: 18,
    name: 'Шоколадный фондан',
    description: 'Горячий шоколадный кекс с жидкой начинкой',
    price: 320,
    category: 'Десерты',
    imageUrl: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=300&h=300&fit=crop',
    isActive: true,
    createdAt: '2025-09-29T11:00:00.000Z',
    updatedAt: '2025-09-29T11:00:00.000Z',
  },

  // Напитки
  {
    id: 19,
    name: 'Кофе латте',
    description: 'Эспрессо с взбитым молоком и нежной пенкой',
    price: 180,
    category: 'Напитки',
    imageUrl: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=300&h=300&fit=crop',
    isActive: true,
    createdAt: '2025-09-29T11:15:00.000Z',
    updatedAt: '2025-09-29T11:15:00.000Z',
  },
  {
    id: 20,
    name: 'Лимонад домашний',
    description: 'Освежающий лимонад с мятой и лаймом',
    price: 150,
    category: 'Напитки',
    imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=300&h=300&fit=crop',
    isActive: true,
    createdAt: '2025-09-29T11:30:00.000Z',
    updatedAt: '2025-09-29T11:30:00.000Z',
  },
  {
    id: 21,
    name: 'Смузи ягодное',
    description: 'Смузи из свежих ягод с йогуртом и мёдом',
    price: 220,
    category: 'Напитки',
    imageUrl: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=300&h=300&fit=crop',
    isActive: true,
    createdAt: '2025-09-29T11:45:00.000Z',
    updatedAt: '2025-09-29T11:45:00.000Z',
  },
];

const MOCK_POLLS: Poll[] = [
  {
    id: 1,
    groupId: 1,
    title: 'Обед на сегодня',
    description: 'Выбираем что заказать на обед',
    isActive: false,
    endTime: '2025-09-29T14:00:00.000Z',
    createdAt: '2025-09-29T13:00:00.000Z',
    updatedAt: '2025-09-29T14:00:00.000Z',
    _count: { votes: 8 },
  },
  {
    id: 2,
    groupId: 1,
    title: 'Ужин в пятницу',
    description: 'Корпоративный ужин',
    isActive: true,
    endTime: '2025-09-29T18:00:00.000Z',
    createdAt: '2025-09-29T17:00:00.000Z',
    updatedAt: '2025-09-29T17:00:00.000Z',
    _count: { votes: 3 },
  },
];

class MockApiService {
  private delay(ms: number = 1000): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private createSuccessResponse<T>(data: T): ApiResponse<T> {
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  private createErrorResponse(error: string): ApiResponse<any> {
    return {
      success: false,
      error,
      timestamp: new Date().toISOString(),
    };
  }

  // Auth Methods
  async validateInitData(_initData: string): Promise<ApiResponse<{ user: User; token: string }>> {
    await this.delay(800);
    
    // Имитируем успешную авторизацию
    return this.createSuccessResponse({
      user: MOCK_USERS[0],
      token: 'mock_jwt_token_123456',
    });
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    await this.delay(500);
    return this.createSuccessResponse(MOCK_USERS[0]);
  }

  // Menu Methods
  async getAllMenuItems(): Promise<ApiResponse<MenuItem[]>> {
    await this.delay(600);
    return this.createSuccessResponse(MOCK_MENU_ITEMS);
  }

  async getActiveMenuItems(): Promise<ApiResponse<MenuItem[]>> {
    await this.delay(400);
    const activeItems = MOCK_MENU_ITEMS.filter(item => item.isActive);
    return this.createSuccessResponse(activeItems);
  }

  async getMenuItemById(id: number): Promise<ApiResponse<MenuItem>> {
    await this.delay(300);
    const item = MOCK_MENU_ITEMS.find(item => item.id === id);
    
    if (!item) {
      return this.createErrorResponse('Menu item not found');
    }
    
    return this.createSuccessResponse(item);
  }

  async createMenuItem(data: any): Promise<ApiResponse<MenuItem>> {
    await this.delay(1000);
    
    const newItem: MenuItem = {
      id: Math.max(...MOCK_MENU_ITEMS.map(i => i.id)) + 1,
      ...data,
      isActive: data.isActive ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    MOCK_MENU_ITEMS.push(newItem);
    return this.createSuccessResponse(newItem);
  }

  async updateMenuItem(id: number, data: any): Promise<ApiResponse<MenuItem>> {
    await this.delay(800);
    
    const index = MOCK_MENU_ITEMS.findIndex(item => item.id === id);
    if (index === -1) {
      return this.createErrorResponse('Menu item not found');
    }

    MOCK_MENU_ITEMS[index] = {
      ...MOCK_MENU_ITEMS[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };

    return this.createSuccessResponse(MOCK_MENU_ITEMS[index]);
  }

  async deleteMenuItem(id: number): Promise<ApiResponse<void>> {
    await this.delay(600);
    
    const index = MOCK_MENU_ITEMS.findIndex(item => item.id === id);
    if (index === -1) {
      return this.createErrorResponse('Menu item not found');
    }

    MOCK_MENU_ITEMS.splice(index, 1);
    return this.createSuccessResponse(undefined as any);
  }

  async toggleMenuItemStatus(id: number): Promise<ApiResponse<MenuItem>> {
    await this.delay(400);
    
    const item = MOCK_MENU_ITEMS.find(item => item.id === id);
    if (!item) {
      return this.createErrorResponse('Menu item not found');
    }

    item.isActive = !item.isActive;
    item.updatedAt = new Date().toISOString();

    return this.createSuccessResponse(item);
  }

  async getMenuCategories(): Promise<ApiResponse<string[]>> {
    await this.delay(300);
    
    const categories = [...new Set(MOCK_MENU_ITEMS
      .filter(item => item.category)
      .map(item => item.category!)
    )];
    
    return this.createSuccessResponse(categories);
  }

  async getMenuStats(): Promise<ApiResponse<MenuStats>> {
    await this.delay(500);
    
    const active = MOCK_MENU_ITEMS.filter(item => item.isActive);
    const categories = new Set(MOCK_MENU_ITEMS.filter(item => item.category).map(item => item.category));
    const totalPrice = MOCK_MENU_ITEMS.reduce((sum, item) => sum + (item.price || 0), 0);

    const stats: MenuStats = {
      total: MOCK_MENU_ITEMS.length,
      active: active.length,
      categories: categories.size,
      averagePrice: MOCK_MENU_ITEMS.length > 0 ? totalPrice / MOCK_MENU_ITEMS.length : 0,
    };

    return this.createSuccessResponse(stats);
  }

  // Polls Methods
  async getAllPolls(): Promise<ApiResponse<Poll[]>> {
    await this.delay(600);
    return this.createSuccessResponse(MOCK_POLLS);
  }

  async getActivePolls(): Promise<ApiResponse<Poll[]>> {
    await this.delay(400);
    const activePolls = MOCK_POLLS.filter(poll => poll.isActive);
    return this.createSuccessResponse(activePolls);
  }

  async getPollStats(): Promise<ApiResponse<PollStats>> {
    await this.delay(500);
    
    const stats: PollStats = {
      totalPolls: MOCK_POLLS.length,
      activePolls: MOCK_POLLS.filter(p => p.isActive).length,
      completedPolls: MOCK_POLLS.filter(p => !p.isActive).length,
      totalVotes: MOCK_POLLS.reduce((sum, p) => sum + p._count.votes, 0),
      averageParticipants: MOCK_POLLS.length > 0 
        ? MOCK_POLLS.reduce((sum, p) => sum + p._count.votes, 0) / MOCK_POLLS.length 
        : 0,
    };

    return this.createSuccessResponse(stats);
  }

  async getPopularItems(): Promise<ApiResponse<PopularItem[]>> {
    await this.delay(700);
    
    const popularItems: PopularItem[] = MOCK_MENU_ITEMS
      .filter(item => item.isActive)
      .map(item => ({
        ...item,
        voteCount: Math.floor(Math.random() * 20) + 1,
        winCount: Math.floor(Math.random() * 5),
        _count: {
          votes: Math.floor(Math.random() * 20) + 1,
          pollResults: Math.floor(Math.random() * 5),
        },
      }))
      .sort((a, b) => b.voteCount - a.voteCount)
      .slice(0, 10);

    return this.createSuccessResponse(popularItems);
  }

  async getPollResults(pollId: number): Promise<ApiResponse<any>> {
    await this.delay(600);
    
    const poll = MOCK_POLLS.find(p => p.id === pollId);
    if (!poll) {
      return this.createErrorResponse('Poll not found');
    }

    const result = {
      id: 1,
      pollId,
      winnerItemId: MOCK_MENU_ITEMS[0].id,
      responsibleId: MOCK_USERS[0].id,
      totalVotes: poll._count.votes,
      isRouletteRun: true,
      createdAt: new Date().toISOString(),
      poll,
      winnerItem: MOCK_MENU_ITEMS[0],
      responsible: MOCK_USERS[0],
    };

    return this.createSuccessResponse(result);
  }

  /**
   * Получение детального разбора голосов
   */
  async getPollVoteBreakdown(pollId: number): Promise<ApiResponse<any[]>> {
    await this.delay(500);
    
    const poll = MOCK_POLLS.find(p => p.id === pollId);
    if (!poll) {
      return this.createErrorResponse('Poll not found');
    }

    const breakdown = MOCK_MENU_ITEMS.map((item) => ({
      menuItemId: item.id,
      menuItem: item,
      voteCount: Math.floor(Math.random() * 5) + 1,
      percentage: Math.floor(Math.random() * 40) + 5,
      voters: MOCK_USERS.slice(0, Math.floor(Math.random() * 3) + 1)
    })).filter(item => item.voteCount > 0);

    return this.createSuccessResponse(breakdown);
  }

  /**
   * Получение категорий с подсчетом блюд
   */
  async getMenuCategoriesWithCount(): Promise<ApiResponse<Record<string, number>>> {
    await this.delay(300);
    
    const categoryCounts: Record<string, number> = {};
    MOCK_MENU_ITEMS.forEach(item => {
      if (item.category && item.isActive) {
        categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
      }
    });
    
    return this.createSuccessResponse(categoryCounts);
  }
}

export const mockApiService = new MockApiService();
