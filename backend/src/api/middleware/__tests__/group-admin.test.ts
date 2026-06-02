import { groupAdminMiddleware } from '../group-admin';
import { GroupService } from '../../../services/group.service';

jest.mock('../../../services/group.service');

const mkRes = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe('groupAdminMiddleware', () => {
  beforeEach(() => jest.clearAllMocks());

  it('супер-админ НЕ пересекает границы группы: проверяется как обычный пользователь', async () => {
    (GroupService.isUserGroupAdmin as jest.Mock).mockResolvedValue(false);
    const req: any = { user: { id: 1, isAdmin: true }, query: { groupId: '5' }, params: {}, body: {} };
    const res = mkRes(); const next = jest.fn();
    await groupAdminMiddleware(req, res, next);
    expect(GroupService.isUserGroupAdmin).toHaveBeenCalledWith(1, 5);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('пускает per-group админа', async () => {
    (GroupService.isUserGroupAdmin as jest.Mock).mockResolvedValue(true);
    const req: any = { user: { id: 2, isAdmin: false }, query: { groupId: '5' }, params: {}, body: {} };
    const next = jest.fn();
    await groupAdminMiddleware(req, mkRes(), next);
    expect(GroupService.isUserGroupAdmin).toHaveBeenCalledWith(2, 5);
    expect(next).toHaveBeenCalled();
  });

  it('403 для не-админа группы', async () => {
    (GroupService.isUserGroupAdmin as jest.Mock).mockResolvedValue(false);
    const req: any = { user: { id: 3, isAdmin: false }, query: { groupId: '5' }, params: {}, body: {} };
    const res = mkRes(); const next = jest.fn();
    await groupAdminMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('400 если groupId отсутствует', async () => {
    const req: any = { user: { id: 3, isAdmin: false }, query: {}, params: {}, body: {} };
    const res = mkRes(); const next = jest.fn();
    await groupAdminMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('401 если пользователь не аутентифицирован', async () => {
    const req: any = { query: { groupId: '5' }, params: {}, body: {} };
    const res = mkRes(); const next = jest.fn();
    await groupAdminMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
