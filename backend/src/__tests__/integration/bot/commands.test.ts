/**
 * Команды бота: /start (с deep link), /menu, /app, /help.
 *
 * Проверяется решение, а не текст: какой экран Mini App откроет кнопка
 * (параметры в адресе web_app), есть ли web_app-кнопка вообще (в группах
 * Telegram её запрещает, а не-https адрес он отвергает вместе со всем
 * сообщением), какие кнопки получает админ, и что легло в базу.
 */
import { prisma } from '../../../database/client';
import { cleanDatabase } from '../helpers/fixtures';
import {
  type FakeTelegram,
  type TgUser,
  buttonsOf,
  createFakeTelegram,
  groupChat,
  message,
  privateChat,
  sentTo,
  webAppUrls,
} from '../helpers/bot';

let tg: FakeTelegram;

const APP = 'https://lunch.example.app';
const GROUP = groupChat(-100700, 'Команда');
const anna: TgUser = { id: 7001, first_name: 'Анна', username: 'anna' };

const originalWebAppUrl = process.env.WEBAPP_URL;
function setWebApp(url: string | undefined) {
  if (url === undefined) delete process.env.WEBAPP_URL;
  else process.env.WEBAPP_URL = url;
}

/** Единственный ответ бота в чат. */
function lastReplyTo(chatId: number) {
  const replies = sentTo(tg, chatId);
  expect(replies).toHaveLength(1);
  return replies[0];
}

async function say(from: TgUser, text: string, chat = privateChat(from)) {
  await tg.receive(message(from, chat, text));
  return lastReplyTo(chat.id);
}

/** Группа, голосование и автор голосования — для vote_-ссылок. */
async function pollInGroup(status = 'ACTIVE') {
  const group = await prisma.group.create({
    data: { telegramId: BigInt(GROUP.id), title: 'Команда' },
  });
  const author = await prisma.user.create({
    data: { telegramId: BigInt(7090), firstName: 'Автор' },
  });
  const dish = await prisma.menuItem.create({
    data: { name: 'Плов', groupId: group.id, createdBy: author.id },
  });
  const poll = await prisma.poll.create({
    data: { groupId: group.id, createdBy: author.id, status },
  });
  return { group, poll, dish };
}

beforeAll(async () => {
  tg = await createFakeTelegram();
});

beforeEach(async () => {
  await cleanDatabase();
  tg.reset();
  setWebApp(APP);
});

afterAll(async () => {
  setWebApp(originalWebAppUrl);
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('/start без параметров', () => {
  it('регистрирует нового пользователя', async () => {
    await say(anna, '/start');

    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(anna.id) } });
    expect(user).toMatchObject({ firstName: 'Анна', username: 'anna', isActive: true });
  });

  it.each([
    [APP, [APP]],
    ['http://lunch.example.app', []],
    ['https://localhost:5173', []],
    [undefined, []],
  ])('в личке при WEBAPP_URL=%s web_app-кнопки: %j', async (url, expected) => {
    setWebApp(url);

    const reply = await say(anna, '/start');

    expect(webAppUrls(reply)).toEqual(expected);
  });

  it('в группе web_app-кнопки нет даже с правильным адресом', async () => {
    const reply = await say(anna, '/start', GROUP);

    expect(webAppUrls(reply)).toEqual([]);
  });
});

describe('/start с deep link открывает нужный экран', () => {
  it.each([
    ['menu_-100700', { groupId: '-100700' }],
    ['add_-100700', { groupId: '-100700', action: 'add' }],
    ['storerun_42', { storeRunId: '42' }],
    ['poll_-100700', { groupId: '-100700', action: 'poll' }],
  ])('%s → web_app с параметрами %j', async (param, expectedQuery) => {
    const reply = await say(anna, `/start ${param}`);

    const urls = webAppUrls(reply);
    expect(urls).toHaveLength(1);
    const url = new URL(urls[0]);
    expect(url.origin).toBe(APP);
    expect(Object.fromEntries(url.searchParams)).toEqual(expectedQuery);
  });

  it('vote_<id> идущего голосования открывает это голосование', async () => {
    const { poll } = await pollInGroup();

    const reply = await say(anna, `/start vote_${poll.id}`);

    const urls = webAppUrls(reply);
    expect(urls).toHaveLength(1);
    expect(new URL(urls[0]).searchParams.get('pollId')).toBe(String(poll.id));
  });

  it.each([
    ['нечисловой id', async () => 'vote_abc'],
    ['голосования нет', async () => 'vote_987654'],
    ['голосование закрыто', async () => `vote_${(await pollInGroup('COMPLETED')).poll.id}`],
    ['человек уже проголосовал', async () => {
      const { poll, dish } = await pollInGroup();
      const me = await prisma.user.create({
        data: { telegramId: BigInt(anna.id), firstName: anna.first_name },
      });
      await prisma.vote.create({ data: { pollId: poll.id, userId: me.id, menuItemId: dish.id } });
      return `vote_${poll.id}`;
    }],
    ['нечисловой id забега', async () => 'storerun_x'],
  ])('%s — ответ без кнопки голосования', async (_label, makeParam) => {
    const param = await makeParam();

    const reply = await say(anna, `/start ${param}`);

    expect(webAppUrls(reply)).toEqual([]);
  });

  it('poll_ без пригодного адреса Mini App отвечает без web_app', async () => {
    setWebApp('http://localhost:5173');

    const reply = await say(anna, '/start poll_-100700');

    expect(webAppUrls(reply)).toEqual([]);
  });
});

// Регрессия: без WEBAPP_URL кнопка получала адрес «?groupId=…» или «», и Telegram отвергал всё сообщение.
describe('без WEBAPP_URL web_app-кнопок с негодным адресом быть не должно', () => {
  it.each(['/start menu_-100700', '/start add_-100700', '/start storerun_42', '/app', '/help'])(
    '%s',
    async text => {
      setWebApp(undefined);

      const reply = await say(anna, text);

      for (const url of webAppUrls(reply)) {
        expect(url.startsWith('https://')).toBe(true);
      }
    }
  );
});

describe('/menu', () => {
  it('в группе: кнопка — ссылка в личку бота на меню этой группы, не web_app', async () => {
    const reply = await say(anna, '/menu', GROUP);

    const buttons = buttonsOf(reply);
    expect(buttons.some(b => b.web_app)).toBe(false);
    expect(buttons.some(b => b.url?.includes(`start=menu_${GROUP.id}`))).toBe(true);
  });

  it('кнопки управления меню видит только админ бота', async () => {
    await prisma.user.create({
      data: { telegramId: BigInt(anna.id), firstName: anna.first_name, isAdmin: true },
    });
    const bob: TgUser = { id: 7002, first_name: 'Боб' };

    const adminReply = await say(anna, '/menu', GROUP);
    tg.reset();
    const memberReply = await say(bob, '/menu', GROUP);

    const adminCallbacks = buttonsOf(adminReply).map(b => b.callback_data);
    const memberCallbacks = buttonsOf(memberReply).map(b => b.callback_data);
    expect(adminCallbacks).toContain('quick_add_item');
    expect(memberCallbacks).not.toContain('quick_add_item');
  });

  it('в личке меню не показывается: оно живёт в группе', async () => {
    const reply = await say(anna, '/menu');

    expect(buttonsOf(reply)).toEqual([]);
  });

  it('команда в группе регистрирует группу и автора как участника', async () => {
    await say(anna, '/menu', GROUP);

    const member = await prisma.groupMember.findFirst({
      where: { group: { telegramId: BigInt(GROUP.id) }, user: { telegramId: BigInt(anna.id) } },
    });
    expect(member).toMatchObject({ isActive: true, role: 'MEMBER' });
  });
});

describe('/app и /help', () => {
  it.each(['/app', '/help'])('%s в личке даёт web_app на Mini App', async text => {
    const reply = await say(anna, text);

    expect(webAppUrls(reply)).toEqual([APP]);
  });

  it.each(['/app', '/help'])('%s в группе — без web_app', async text => {
    const reply = await say(anna, text, GROUP);

    expect(webAppUrls(reply)).toEqual([]);
  });
});
