import { Request, Response } from 'express';
import { feedbackController } from '../../../api/controllers/feedback.controller';
import { feedbackService } from '../../../services/feedback.service';

jest.mock('../../../services/feedback.service', () => ({
  feedbackService: {
    sendToAdmin: jest.fn(),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

function makeRes(): Response & {
  json: jest.Mock;
  status: jest.Mock;
} {
  const res = {
    json: jest.fn(),
    status: jest.fn(),
  } as unknown as Response & {
    json: jest.Mock;
    status: jest.Mock;
  };

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);

  return res;
}

describe('FeedbackController Mini App API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends trimmed feedback using authenticated user identity, not spoofed body fields', async () => {
    (feedbackService.sendToAdmin as jest.Mock).mockResolvedValue(undefined);
    const req = {
      body: {
        firstName: 'Fake',
        message: '  Нужна помощь  ',
        userId: 999,
        username: 'fake_user',
      },
      user: {
        firstName: 'Igor',
        id: 5,
        telegramId: BigInt(123456789),
        username: 'real_user',
      },
    } as unknown as Request;
    const res = makeRes();

    await feedbackController.send(req, res);

    expect(feedbackService.sendToAdmin).toHaveBeenCalledWith({
      firstName: 'Igor',
      message: 'Нужна помощь',
      userId: 123456789,
      username: 'real_user',
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        id: expect.any(Number),
        createdAt: expect.any(String),
      },
    });
  });

  it('rejects empty feedback before calling the service', async () => {
    const req = {
      body: { message: '   ' },
      user: {
        firstName: 'Igor',
        id: 5,
        telegramId: BigInt(123456789),
        username: 'real_user',
      },
    } as unknown as Request;
    const res = makeRes();

    await feedbackController.send(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Message is required and must be a non-empty string',
    });
    expect(feedbackService.sendToAdmin).not.toHaveBeenCalled();
  });
});
