/**
 * Подпись ссылки на аватар: `<img src>` не несёт Bearer, поэтому доступ к
 * `/api/avatar/:fileId` держится только на HMAC от fileId и срока. Ссылка без
 * подписи и выдача подписанных ссылок проверены через API в
 * integration/api/auth-surface.routes.test.ts и user.routes.test.ts.
 */
import { signAvatarUrl, verifyAvatarSignature } from '../../../utils/avatar-url-signer';

const FILE_ID = 'AgACAgIAAxkBAAIB';

function partsOf(url: string): { exp: string; sig: string } {
  const query = new URL(url, 'https://example.com').searchParams;
  return { exp: query.get('exp')!, sig: query.get('sig')! };
}

let envBackup: NodeJS.ProcessEnv;

beforeEach(() => {
  envBackup = { ...process.env };
  process.env.JWT_SECRET = 'test-secret-for-avatar-signing-0123456789';
});

afterEach(() => {
  process.env = envBackup;
});

it('свежая подпись своего fileId принимается', () => {
  const { exp, sig } = partsOf(signAvatarUrl(FILE_ID));

  expect(verifyAvatarSignature(FILE_ID, exp, sig)).toEqual({ ok: true });
});

it.each<[string, () => [string, string | undefined, string | undefined]]>([
  ['подпись от другого fileId', () => {
    const { exp, sig } = partsOf(signAvatarUrl('someone-else-file-id'));
    return [FILE_ID, exp, sig];
  }],
  ['просроченная подпись', () => {
    const { exp, sig } = partsOf(signAvatarUrl(FILE_ID, -60));
    return [FILE_ID, exp, sig];
  }],
  ['продлённый вручную срок', () => {
    const { exp, sig } = partsOf(signAvatarUrl(FILE_ID));
    return [FILE_ID, String(Number(exp) + 3600), sig];
  }],
  ['подпись без exp', () => [FILE_ID, undefined, partsOf(signAvatarUrl(FILE_ID)).sig]],
])('%s отклоняется', (_name, attempt) => {
  expect(verifyAvatarSignature(...attempt()).ok).toBe(false);
});

it('подпись, снятая другим секретом, не проходит', () => {
  const { exp, sig } = partsOf(signAvatarUrl(FILE_ID));
  process.env.JWT_SECRET = 'a-completely-different-secret-value-here';

  expect(verifyAvatarSignature(FILE_ID, exp, sig).ok).toBe(false);
});
