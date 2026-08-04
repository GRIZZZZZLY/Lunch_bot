/**
 * Аналитика бюджета. Единственное правило: чужие траты видит только сам
 * пользователь или админ.
 */
import {
  getBudgetInsights,
  getBudgetInsightsByUserId,
  getCategoryInsights,
} from '../../../api/controllers/insights.controller';
import { InsightsService } from '../../../services/insights.service';
import { mockRequest, mockResponse } from '../../helpers/http';
import { asServiceMock } from '../../helpers/mocks';
import type { AuthenticatedRequest } from '../../../types/api.types';

jest.mock('../../../services/insights.service', () => ({
  InsightsService: {
    getBudgetInsights: jest.fn(),
    getCategoryInsights: jest.fn(),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const insights = asServiceMock(InsightsService);

const USER = { id: 1, isAdmin: false };
const ADMIN = { id: 9, isAdmin: true };

const authRequest = (init: Parameters<typeof mockRequest>[0] = {}) =>
  mockRequest(init) as unknown as AuthenticatedRequest;

beforeEach(() => {
  jest.clearAllMocks();
  insights.getBudgetInsights.mockResolvedValue({ spent: 1500 });
  insights.getCategoryInsights.mockResolvedValue([{ category: 'Горячее' }]);
});

describe('GET /api/insights/budget', () => {
  it('отдаёт аналитику по id из токена', async () => {
    const res = mockResponse();

    await getBudgetInsights(authRequest({ user: USER }), res);

    expect(insights.getBudgetInsights).toHaveBeenCalledWith(1);
    expect(res.body).toMatchObject({ data: { spent: 1500 } });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await getBudgetInsights(authRequest(), res);

    expect(res.statusCode).toBe(401);
    expect(insights.getBudgetInsights).not.toHaveBeenCalled();
  });

  it('ошибка сервиса — 500', async () => {
    insights.getBudgetInsights.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await getBudgetInsights(authRequest({ user: USER }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/insights/budget/:userId', () => {
  it('свою аналитику пользователь получает', async () => {
    const res = mockResponse();

    await getBudgetInsightsByUserId(
      authRequest({ user: USER, params: { userId: '1' } }),
      res
    );

    expect(insights.getBudgetInsights).toHaveBeenCalledWith(1);
    expect(res.statusCode).toBe(200);
  });

  it('чужую — только админ', async () => {
    const res = mockResponse();

    await getBudgetInsightsByUserId(
      authRequest({ user: USER, params: { userId: '2' } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(insights.getBudgetInsights).not.toHaveBeenCalled();
  });

  /* Аналитика расходов — личные финансовые данные. Прежде их открывал
     глобальный флаг; такого понятия больше нет, а роль в группе права на чужой
     кошелёк не даёт. Доступ остался только к своим данным. */
  it('чужую аналитику не отдают никому, включая прежнего админа', async () => {
    const res = mockResponse();

    await getBudgetInsightsByUserId(
      authRequest({ user: ADMIN, params: { userId: '2' } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(insights.getBudgetInsights).not.toHaveBeenCalled();
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await getBudgetInsightsByUserId(authRequest({ params: { userId: '1' } }), res);

    expect(res.statusCode).toBe(401);
  });

  it('нечисловой userId — 400', async () => {
    const res = mockResponse();

    await getBudgetInsightsByUserId(
      authRequest({ user: USER, params: { userId: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('ошибка сервиса — 500', async () => {
    insights.getBudgetInsights.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await getBudgetInsightsByUserId(
      authRequest({ user: USER, params: { userId: '1' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/insights/categories', () => {
  it('отдаёт статистику по категориям', async () => {
    const res = mockResponse();

    await getCategoryInsights(authRequest({ user: USER }), res);

    expect(insights.getCategoryInsights).toHaveBeenCalledWith(1);
    expect(res.body).toMatchObject({ data: [{ category: 'Горячее' }] });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await getCategoryInsights(authRequest(), res);

    expect(res.statusCode).toBe(401);
  });

  it('ошибка сервиса — 500', async () => {
    insights.getCategoryInsights.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await getCategoryInsights(authRequest({ user: USER }), res);

    expect(res.statusCode).toBe(500);
  });
});
