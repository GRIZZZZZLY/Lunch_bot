import crypto from 'crypto';

/**
 * Сравнивает секрет Telegram webhook за постоянное время.
 * Разная длина отклоняется до timingSafeEqual, чтобы избежать исключения.
 */
export function verifyWebhookSecret(
  receivedSecret: string | undefined,
  expectedSecret: string
): boolean {
  const received = Buffer.from(receivedSecret ?? '', 'utf8');
  const expected = Buffer.from(expectedSecret, 'utf8');

  return (
    received.length === expected.length &&
    crypto.timingSafeEqual(received, expected)
  );
}
