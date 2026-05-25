/**
 * Phase 3 (P2-3) — OpenTelemetry scaffold.
 *
 * Сейчас Sentry трейсит на 10% sample. OTel будет:
 *   - Auto-инструментировать HTTP/Express/Prisma/Redis/grammY.
 *   - Шлёт traces в OTLP collector → Tempo/Jaeger.
 *   - Корреляция с Loki (логи) и Prometheus (метрики).
 *
 * Этот файл — scaffold с feature-gate. По умолчанию NOOP, не тащит
 * @opentelemetry/* в bundle, пока OTEL_ENABLED=true не выставлен.
 *
 * Активация (когда установим пакеты + развернём collector):
 *   1. `npm install --save @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node \
 *        @opentelemetry/exporter-trace-otlp-http`
 *   2. В env: OTEL_ENABLED=true OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
 *   3. ИМПОРТИРОВАТЬ ЭТОТ ФАЙЛ ПЕРВЫМ в backend/src/index.ts (до dotenv даже):
 *        import './utils/telemetry'  // как побочный эффект, единожды.
 *      Иначе auto-инструментация не подменит require()'ed модули.
 *
 * Корреляция с Sentry: Sentry SDK >= 8 умеет OTel propagation — sentry-trace
 * и traceparent совместимы.
 */

import { logger } from './logger';

const OTEL_ENABLED = process.env.OTEL_ENABLED === 'true';

export interface TelemetryHandle {
  shutdown: () => Promise<void>;
}

const noopHandle: TelemetryHandle = {
  shutdown: async () => undefined,
};

/**
 * Динамическая инициализация — НЕ тащит OTel в bundle если флаг выключен.
 * Возвращает handle с shutdown для graceful exit.
 */
export async function initTelemetry(): Promise<TelemetryHandle> {
  if (!OTEL_ENABLED) {
    return noopHandle;
  }

  try {
    // Динамический require — fail-soft если пакеты не установлены.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Resource } = require('@opentelemetry/resources');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

    const endpoint =
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';

    const sdk = new NodeSDK({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]:
          process.env.OTEL_SERVICE_NAME ?? 'telegram-food-bot-backend',
        [SemanticResourceAttributes.SERVICE_VERSION]:
          process.env.npm_package_version ?? '0.0.0',
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
          process.env.NODE_ENV ?? 'development',
      }),
      traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
      instrumentations: [
        getNodeAutoInstrumentations({
          // Подавляем шумные HTTP outbounds (Telegram polling getUpdates).
          '@opentelemetry/instrumentation-http': {
            ignoreOutgoingRequestHook: (req: any) => {
              const host = req.host ?? req.hostname ?? '';
              return host.includes('api.telegram.org');
            },
          },
          // fs / dns тут не нужны.
          '@opentelemetry/instrumentation-fs': { enabled: false },
          '@opentelemetry/instrumentation-dns': { enabled: false },
        }),
      ],
    });

    sdk.start();
    logger.info('✅ OpenTelemetry SDK started', { endpoint });

    return {
      shutdown: async () => {
        try {
          await sdk.shutdown();
          logger.info('🔌 OpenTelemetry SDK shut down');
        } catch (err) {
          logger.error('OTel shutdown failed', { err: (err as Error).message });
        }
      },
    };
  } catch (err) {
    logger.warn('OTel пакеты не установлены или сломан init — продолжаем без telemetry', {
      err: (err as Error).message,
    });
    return noopHandle;
  }
}
