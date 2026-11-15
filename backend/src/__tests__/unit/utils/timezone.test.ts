import {
  isValidTimeZone,
  nextZonedRun,
  safeTimeZone,
  zonedLocalToUtc,
  zonedParts,
} from '../../../utils/timezone';

describe('timezone', () => {
  it('reads the wall clock of the zone', () => {
    // 2026-11-16 06:30 UTC is Monday 09:30 in Moscow and 11:30 in Almaty.
    const at = new Date('2026-11-16T06:30:00Z');
    expect(zonedParts(at, 'Europe/Moscow')).toEqual({
      date: '2026-11-16',
      time: '09:30',
      day: 1,
    });
    expect(zonedParts(at, 'Asia/Almaty').time).toBe('11:30');
  });

  it('crosses midnight into the next local day', () => {
    const at = new Date('2026-11-16T22:30:00Z');
    expect(zonedParts(at, 'Europe/Moscow')).toMatchObject({
      date: '2026-11-17',
      time: '01:30',
      day: 2,
    });
  });

  it('turns a local time into the right instant, with daylight saving', () => {
    expect(zonedLocalToUtc('2026-11-16', '09:00', 'Europe/Moscow').toISOString()).toBe(
      '2026-11-16T06:00:00.000Z'
    );
    // Berlin: UTC+1 in winter, UTC+2 in summer.
    expect(zonedLocalToUtc('2026-01-15', '09:00', 'Europe/Berlin').toISOString()).toBe(
      '2026-01-15T08:00:00.000Z'
    );
    expect(zonedLocalToUtc('2026-07-15', '09:00', 'Europe/Berlin').toISOString()).toBe(
      '2026-07-15T07:00:00.000Z'
    );
  });

  it('picks the same weekday later today when the time has not passed', () => {
    // Monday 09:30 Moscow; Monday 12:00 is still ahead.
    const now = new Date('2026-11-16T06:30:00Z');
    expect(nextZonedRun([1], '12:00', 'Europe/Moscow', now).toISOString()).toBe(
      '2026-11-16T09:00:00.000Z'
    );
  });

  it('skips to the next matching weekday when the time has passed', () => {
    const now = new Date('2026-11-16T06:30:00Z');
    expect(nextZonedRun([1, 3], '09:00', 'Europe/Moscow', now).toISOString()).toBe(
      '2026-11-18T06:00:00.000Z'
    );
  });

  it('runs at the group local time, not the server one', () => {
    // Same instant, same "09:00 on Monday" request, two groups.
    const now = new Date('2026-11-15T20:00:00Z');
    expect(nextZonedRun([1], '09:00', 'Europe/Moscow', now).toISOString()).toBe(
      '2026-11-16T06:00:00.000Z'
    );
    expect(nextZonedRun([1], '09:00', 'Asia/Almaty', now).toISOString()).toBe(
      '2026-11-16T04:00:00.000Z'
    );
  });

  it('validates names and falls back to Moscow', () => {
    expect(isValidTimeZone('Asia/Almaty')).toBe(true);
    expect(isValidTimeZone('Mars/Base')).toBe(false);
    expect(safeTimeZone('Mars/Base')).toBe('Europe/Moscow');
    expect(safeTimeZone(null)).toBe('Europe/Moscow');
    expect(safeTimeZone('Asia/Almaty')).toBe('Asia/Almaty');
  });
});
