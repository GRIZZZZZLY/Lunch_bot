import { verifyWebhookSecret } from '../../utils/webhook-secret';

describe('verifyWebhookSecret', () => {
  const expected = 'a'.repeat(64);

  it('accepts only an exact secret', () => {
    expect(verifyWebhookSecret(expected, expected)).toBe(true);
    expect(verifyWebhookSecret(`${expected.slice(0, -1)}b`, expected)).toBe(
      false
    );
  });

  it('rejects a missing or differently sized secret', () => {
    expect(verifyWebhookSecret(undefined, expected)).toBe(false);
    expect(verifyWebhookSecret('short', expected)).toBe(false);
  });
});
