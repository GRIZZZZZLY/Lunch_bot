import { Request, Response } from 'express';
import {
  deleteSchedule,
  getGroupSchedule,
  toggleSchedule,
} from '../../../api/controllers/recurring-poll.controller';
import { RecurringPollService } from '../../../services/recurring-poll.service';
import { GroupService } from '../../../services/group.service';

jest.mock('../../../services/recurring-poll.service', () => ({
  RecurringPollService: {
    getById: jest.fn(),
    getByGroupId: jest.fn(),
    checkAdminAccess: jest.fn(),
    deleteRecurring: jest.fn(),
    toggleEnabled: jest.fn(),
  },
}));

jest.mock('../../../services/group.service', () => ({
  GroupService: {
    isUserGroupMember: jest.fn(),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

function makeRes(): Response & {
  json: jest.Mock;
  status: jest.Mock;
} {
  const res = {
    json: jest.fn(),
    status: jest.fn(),
  } as unknown as Response & {
    json: jest.Mock;
    status: jest.Mock;
  };

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

describe('Recurring poll authorization by schedule owner group', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not delete a schedule when the user administers another group', async () => {
    (RecurringPollService.getById as jest.Mock).mockResolvedValue({
      id: 99,
      groupId: 2,
    });
    (RecurringPollService.checkAdminAccess as jest.Mock).mockResolvedValue(false);

    const req = {
      params: { id: '99' },
      query: { groupId: '1' },
      user: { id: 7 },
    } as unknown as Request;
    const res = makeRes();

    await deleteSchedule(req, res);

    expect(RecurringPollService.checkAdminAccess).toHaveBeenCalledWith(7, 2);
    expect(RecurringPollService.deleteRecurring).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('does not toggle a schedule when body groupId points to another group', async () => {
    (RecurringPollService.getById as jest.Mock).mockResolvedValue({
      id: 99,
      groupId: 2,
    });
    (RecurringPollService.checkAdminAccess as jest.Mock).mockResolvedValue(false);

    const req = {
      params: { id: '99' },
      body: { groupId: 1, isEnabled: false },
      user: { id: 7 },
    } as unknown as Request;
    const res = makeRes();

    await toggleSchedule(req, res);

    expect(RecurringPollService.checkAdminAccess).toHaveBeenCalledWith(7, 2);
    expect(RecurringPollService.toggleEnabled).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('Reading a schedule is open to group members', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the schedule to a plain member — the team needs to know the auto-start time', async () => {
    const req = { params: { groupId: '2' }, user: { id: 7 } } as unknown as Request;
    const res = makeRes();
    (GroupService.isUserGroupMember as jest.Mock).mockResolvedValue(true);
    (RecurringPollService.getByGroupId as jest.Mock).mockResolvedValue({
      id: 1,
      groupId: 2,
      timeOfDay: '11:30',
    });

    await getGroupSchedule(req, res);

    expect(GroupService.isUserGroupMember).toHaveBeenCalledWith(7, 2);
    expect(RecurringPollService.checkAdminAccess).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { id: 1, groupId: 2, timeOfDay: '11:30' },
    });
  });

  it('still refuses an outsider', async () => {
    const req = { params: { groupId: '2' }, user: { id: 7 } } as unknown as Request;
    const res = makeRes();
    (GroupService.isUserGroupMember as jest.Mock).mockResolvedValue(false);

    await getGroupSchedule(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(RecurringPollService.getByGroupId).not.toHaveBeenCalled();
  });
});
