import express from 'express';
import request from 'supertest';
import { apiConfig } from '../../config/api.config';
import { corsMiddleware } from '../../api/middleware/cors';
import {
  errorHandler,
  notFoundHandler,
} from '../../api/middleware/error-handler';
import { requestIdMiddleware } from '../../api/middleware/request-id';

describe('HTTP boundary middleware', () => {
  it('returns 413 with a request id when the JSON body is too large', async () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.use(express.json({ limit: '1kb' }));
    app.post('/api/body', (_req, res) => res.sendStatus(204));
    app.use(errorHandler);

    const response = await request(app)
      .post('/api/body')
      .send({ value: 'x'.repeat(2_000) });

    expect(response.status).toBe(413);
    expect(response.body).toMatchObject({
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
    });
    expect(response.body.traceId).toEqual(expect.any(String));
  });

  it('returns 400 for malformed JSON without exposing parser details', async () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.use(express.json());
    app.post('/api/body', (_req, res) => res.sendStatus(204));
    app.use(errorHandler);

    const response = await request(app)
      .post('/api/body')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      status: 400,
      code: 'INVALID_REQUEST_BODY',
      detail: 'Request body is malformed',
    });
    expect(response.text).not.toContain('SyntaxError');
  });

  it('returns 403 for a forbidden browser origin', async () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.use('/api', corsMiddleware);
    app.get('/api/ping', (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);

    const response = await request(app)
      .get('/api/ping')
      .set('Origin', 'https://forbidden.example');

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('AUTHORIZATION_ERROR');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows idempotency and operations headers in CORS preflight', async () => {
    const configuredOrigins = Array.isArray(apiConfig.cors.origin)
      ? apiConfig.cors.origin
      : [apiConfig.cors.origin];
    const allowedOrigin = configuredOrigins[0];
    const app = express();
    app.use(requestIdMiddleware);
    app.use('/api', corsMiddleware);
    app.options('/api/write', (_req, res) => res.sendStatus(204));
    app.use(notFoundHandler);
    app.use(errorHandler);

    const response = await request(app)
      .options('/api/write')
      .set('Origin', allowedOrigin)
      .set('Access-Control-Request-Method', 'POST')
      .set(
        'Access-Control-Request-Headers',
        'content-type,idempotency-key,x-operations-secret'
      );

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-headers']).toContain(
      'Idempotency-Key'
    );
    expect(response.headers['access-control-allow-headers']).toContain(
      'X-Operations-Secret'
    );
  });
});
