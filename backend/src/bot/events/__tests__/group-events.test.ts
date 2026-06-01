import { mapChatMemberStatusToRole } from '../group-events';

describe('mapChatMemberStatusToRole', () => {
  it('maps creator → CREATOR', () => {
    expect(mapChatMemberStatusToRole('creator')).toBe('CREATOR');
  });

  it('maps administrator → ADMIN', () => {
    expect(mapChatMemberStatusToRole('administrator')).toBe('ADMIN');
  });

  it('maps member and unknown → MEMBER', () => {
    expect(mapChatMemberStatusToRole('member')).toBe('MEMBER');
    expect(mapChatMemberStatusToRole('restricted')).toBe('MEMBER');
  });
});
