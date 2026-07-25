import { Request, Response } from 'express';
import { AdminController } from '../../../api/controllers/admin.controller';
import { GroupService } from '../../../services/group.service';
import { AdminService } from '../../../services/admin.service';

function createResponse(): Response {
  const response = {
    status: jest.fn(),
    json: jest.fn(),
  } as unknown as Response;
  (response.status as jest.Mock).mockReturnValue(response);
  return response;
}

describe('AdminController: права на изменение группы', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('глобальный администратор без роли в группе не назначает её администратора', async () => {
    jest.spyOn(GroupService, 'isUserGroupAdmin').mockResolvedValue(false);
    const toggleAdmin = jest
      .spyOn(AdminService.prototype, 'toggleAdmin')
      .mockRejectedValue(new Error('не должен вызываться'));
    const request = {
      params: { userId: '2' },
      query: { groupId: '10' },
      body: { isAdmin: true },
      user: { id: 1, isAdmin: true },
    } as unknown as Request;
    const response = createResponse();

    await new AdminController().toggleAdmin(request, response);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(toggleAdmin).not.toHaveBeenCalled();
  });

  it('администратор другой группы не списывает чужой долг', async () => {
    jest.spyOn(GroupService, 'isUserGroupAdmin').mockResolvedValue(false);
    const forgiveDebt = jest
      .spyOn(AdminService.prototype, 'forgiveDebt')
      .mockRejectedValue(new Error('не должен вызываться'));
    const request = {
      params: { debtId: '30' },
      query: { groupId: '20' },
      body: {},
      user: { id: 1, isAdmin: false },
    } as unknown as Request;
    const response = createResponse();

    await new AdminController().forgiveDebt(request, response);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(forgiveDebt).not.toHaveBeenCalled();
  });
});
