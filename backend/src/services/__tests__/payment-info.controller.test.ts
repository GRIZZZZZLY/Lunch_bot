/* Реквизиты для переводов приходят от одного человека, а показываются другим:
   ссылку из чужого профиля нажимает тот, кто платит. Поэтому формат проверяет
   сервер, а не только форма. */
import type { Request, Response } from 'express';
import { UserController } from '../../api/controllers/user.controller';
import { UserService } from '../user.service';

jest.mock('../user.service', () => ({
  UserService: { updatePaymentInfo: jest.fn() },
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

function call(body: unknown) {
  const req = { body, user: { id: 1 } } as unknown as Request;
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { json, status } as unknown as Response;
  return { req, res, json, status };
}

beforeEach(() => {
  jest.clearAllMocks();
  (UserService.updatePaymentInfo as jest.Mock).mockResolvedValue({
    paymentCard: null,
    paymentPhone: null,
    paymentDetails: null,
  });
});

describe('PUT /api/user/payment-info — проверка формата', () => {
  /* Регрессия. Проверка была `typeof === 'string'`: прямой вызов API принимал
     любую строку как реквизит, по которому людям предлагают отправить деньги. */
  it('отвергает ссылку с опасной схемой', async () => {
    const { req, res, status } = call({ paymentCard: 'javascript:alert(1)' });

    await UserController.updatePaymentInfo(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(UserService.updatePaymentInfo).not.toHaveBeenCalled();
  });

  it('отвергает то, что не является ссылкой', async () => {
    const { req, res, status } = call({ paymentCard: 'просто текст' });

    await UserController.updatePaymentInfo(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(UserService.updatePaymentInfo).not.toHaveBeenCalled();
  });

  it('отвергает телефон без нужного числа цифр', async () => {
    const { req, res, status } = call({ paymentPhone: '123' });

    await UserController.updatePaymentInfo(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(UserService.updatePaymentInfo).not.toHaveBeenCalled();
  });

  it('пропускает верные реквизиты', async () => {
    const { req, res, status } = call({
      paymentPhone: '+7 900 123-45-67',
      paymentCard: 'https://www.tinkoff.ru/rm/abc',
      paymentDetails: 'Т-Банк',
    });

    await UserController.updatePaymentInfo(req, res);

    expect(status).not.toHaveBeenCalledWith(400);
    expect(UserService.updatePaymentInfo).toHaveBeenCalledWith(1, {
      paymentPhone: '+7 900 123-45-67',
      paymentCard: 'https://www.tinkoff.ru/rm/abc',
      paymentDetails: 'Т-Банк',
    });
  });

  /* Регрессия. Сервис различает undefined («не трогать») и пустую строку
     («очистить»), а клиент слал undefined — ключ выпадал из JSON, сервер
     сохранял прежнее значение, и убрать свои реквизиты было нельзя вовсе. */
  it('null очищает поле, а отсутствующий ключ его не трогает', async () => {
    const { req, res } = call({ paymentPhone: null });

    await UserController.updatePaymentInfo(req, res);

    expect(UserService.updatePaymentInfo).toHaveBeenCalledWith(1, {
      paymentPhone: '',
      paymentCard: undefined,
      paymentDetails: undefined,
    });
  });

  it('пустая строка тоже очищает и не спотыкается о проверку формата', async () => {
    const { req, res, status } = call({ paymentCard: '', paymentPhone: '' });

    await UserController.updatePaymentInfo(req, res);

    expect(status).not.toHaveBeenCalledWith(400);
    expect(UserService.updatePaymentInfo).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ paymentCard: '', paymentPhone: '' }),
    );
  });
});
