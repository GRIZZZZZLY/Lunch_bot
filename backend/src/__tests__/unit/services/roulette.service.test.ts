import { RouletteService } from '../../../services/roulette.service';
import { VoteService } from '../../../services/vote.service';

jest.mock('../../../services/vote.service', () => ({
  VoteService: {
    getVoters: jest.fn(),
    getMostPopularMenuItem: jest.fn(),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

describe('RouletteService.runRoulette', () => {
  const roulette = new RouletteService();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('выбирает ответственного из голосовавших', async () => {
    (VoteService.getVoters as jest.Mock).mockResolvedValue([
      { userId: 1, userName: 'Alice', menuItemId: 1, menuItemName: 'Пицца' },
      { userId: 2, userName: 'Bob', menuItemId: 2, menuItemName: 'Бургер' },
      { userId: 3, userName: 'Charlie', menuItemId: 1, menuItemName: 'Пицца' },
    ]);
    (VoteService.getMostPopularMenuItem as jest.Mock).mockResolvedValue({ menuItemId: 1, votes: 2 });

    const result = await roulette.runRoulette(1);

    // Math.random = 0.5 из трёх голосовавших выбирает второго.
    expect(result).toMatchObject({
      responsibleUserId: 2,
      responsibleUserName: 'Bob',
      winnerMenuItemId: 1,
      totalVotes: 3,
    });
  });

  it('без голосов рулетка не крутится', async () => {
    (VoteService.getVoters as jest.Mock).mockResolvedValue([]);

    await expect(roulette.runRoulette(1)).rejects.toThrow();
  });

  it('единственный голосовавший становится ответственным', async () => {
    (VoteService.getVoters as jest.Mock).mockResolvedValue([
      { userId: 1, userName: 'Alice', menuItemId: 1, menuItemName: 'Пицца' },
    ]);
    (VoteService.getMostPopularMenuItem as jest.Mock).mockResolvedValue({ menuItemId: 1, votes: 1 });

    const result = await roulette.runRoulette(1);

    expect(result).toMatchObject({ responsibleUserId: 1, responsibleUserName: 'Alice', totalVotes: 1 });
  });

  it('без популярного блюда победитель не задан', async () => {
    (VoteService.getVoters as jest.Mock).mockResolvedValue([
      { userId: 1, userName: 'Alice', menuItemId: null, menuItemName: null },
    ]);
    (VoteService.getMostPopularMenuItem as jest.Mock).mockResolvedValue(null);

    const result = await roulette.runRoulette(1);

    expect(result.winnerMenuItemId).toBeUndefined();
    expect(result.winnerMenuItemName).toBeUndefined();
  });
});
