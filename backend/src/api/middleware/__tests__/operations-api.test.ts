import { NextFunction, Request, Response } from 'express';
import { operationsApiMiddleware } from '../operations-api';

function createResponse(): Response {
  const response = {
    status: jest.fn(),
    json: jest.fn(),
  } as unknown as Response;
  (response.status as jest.Mock).mockReturnValue(response);
  return response;
}

describe('operationsApiMiddleware', () => {
  const originalEnabled = process.env.ENABLE_OPERATIONS_API;
  const originalSecret = process.env.OPERATIONS_API_SECRET;

  afterEach(() => {
    process.env.ENABLE_OPERATIONS_API = originalEnabled;
    process.env.OPERATIONS_API_SECRET = originalSecret;
  });

  it('скрывает системные маршруты, когда они не включены', () => {
    process.env.ENABLE_OPERATIONS_API = 'false';
    const request = {
      header: jest.fn(),
    } as unknown as Request;
    const response = createResponse();
    const next = jest.fn() as NextFunction;

    operationsApiMiddleware(request, response, next);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('отклоняет неверный отдельный секрет', () => {
    process.env.ENABLE_OPERATIONS_API = 'true';
    process.env.OPERATIONS_API_SECRET = 'a'.repeat(64);
    const request = {
      header: jest.fn().mockReturnValue('b'.repeat(64)),
    } as unknown as Request;
    const response = createResponse();
    const next = jest.fn() as NextFunction;

    operationsApiMiddleware(request, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('пропускает запрос только с точным секретом', () => {
    const secret = 'c'.repeat(64);
    process.env.ENABLE_OPERATIONS_API = 'true';
    process.env.OPERATIONS_API_SECRET = secret;
    const request = {
      header: jest.fn().mockReturnValue(secret),
    } as unknown as Request;
    const response = createResponse();
    const next = jest.fn() as NextFunction;

    operationsApiMiddleware(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });
});
