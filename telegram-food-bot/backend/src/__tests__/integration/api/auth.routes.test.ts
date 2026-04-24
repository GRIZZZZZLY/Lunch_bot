import request from 'supertest';
import { createTestApp } from '../helpers/testApp';
import { cleanDatabase, createTestUser } from '../helpers/fixtures';
import { generateTelegramInitData, generateInvalidInitData } from '../helpers/authHelper';

const app = createTestApp();

describe('POST /api/auth/validate', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  describe('Success cases', () => {
    it('should validate telegram initData and return user', async () => {
      // Создаём пользователя в БД
      const user = await createTestUser({
        telegramId: BigInt(123456789),
        firstName: 'Test',
        username: 'testuser',
      });

      // Устанавливаем env переменную для пропуска валидации в тестах
      process.env.SKIP_TELEGRAM_VALIDATION = 'true';

      const initData = generateTelegramInitData(Number(user.telegramId));

      const response = await request(app)
        .post('/api/auth/validate')
        .send({ initData })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id', user.id);
      expect(response.body.user).toHaveProperty('telegramId');
      expect(response.body.user).toHaveProperty('firstName', 'Test');
    });

    it('should create new user if not exists', async () => {
      process.env.SKIP_TELEGRAM_VALIDATION = 'true';

      const newUserId = 987654321;
      const initData = generateTelegramInitData(newUserId);

      const response = await request(app)
        .post('/api/auth/validate')
        .send({ initData })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('firstName', 'Test');
      expect(response.body.user.telegramId).toBeTruthy();
    });
  });

  describe('Validation errors', () => {
    it('should return 400 if initData is missing', async () => {
      const response = await request(app)
        .post('/api/auth/validate')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 if initData has invalid signature', async () => {
      // Подделанная подпись — это не bad request, а провал аутентификации (401)
      process.env.SKIP_TELEGRAM_VALIDATION = 'false';

      const invalidInitData = generateInvalidInitData();

      const response = await request(app)
        .post('/api/auth/validate')
        .send({ initData: invalidInitData })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return 400 if initData is not a string', async () => {
      const response = await request(app)
        .post('/api/auth/validate')
        .send({ initData: 12345 })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string initData', async () => {
      const response = await request(app)
        .post('/api/auth/validate')
        .send({ initData: '' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle very long initData', async () => {
      const longInitData = 'a'.repeat(10000);

      const response = await request(app)
        .post('/api/auth/validate')
        .send({ initData: longInitData })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });
});
