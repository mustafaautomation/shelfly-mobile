import { formatDue, formatMoney, formatMoneyShort, formatQty, formatRelative, formatSigned, initials, plural } from '@/domain/format';

const now = new Date('2026-11-25T16:00:00.000Z');

describe('format', () => {
  it('formats money and quantities', () => {
    expect(formatMoney(123456)).toBe('$1,234.56');
    expect(formatMoneyShort(4_250_000)).toBe('$42.5k');
    expect(formatMoneyShort(98_000)).toBe('$980');
    expect(formatQty(1200, 'lb')).toBe('1,200 lb');
    expect(formatSigned(5)).toBe('+5');
    expect(formatSigned(-5)).toBe('−5');
  });

  it('describes time the way the floor talks', () => {
    expect(formatRelative('2026-11-25T15:59:40.000Z', now)).toBe('just now');
    expect(formatRelative('2026-11-25T15:20:00.000Z', now)).toBe('40 min ago');
    expect(formatRelative('2026-11-24T12:00:00.000Z', now)).toBe('yesterday');
    expect(formatRelative('2026-11-01T12:00:00.000Z', now)).toBe('Nov 1');
    expect(formatDue('2026-12-02', now)).toBe('Due Dec 2');
    expect(formatDue('2026-11-25', now)).toBe('Due today');
    expect(formatDue('2026-11-20', now)).toBe('5 days late');
    expect(formatDue(null, now)).toBe('No date');
  });

  it('builds initials and plurals', () => {
    expect(initials('Lena Ortiz')).toBe('LO');
    expect(plural(1, 'line')).toBe('1 line');
    expect(plural(3, 'line')).toBe('3 lines');
  });
});
