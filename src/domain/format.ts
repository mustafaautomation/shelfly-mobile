const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const moneyShort = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const count = new Intl.NumberFormat('en-US');

export function formatMoney(cents: number): string {
  return money.format(cents / 100);
}

export function formatMoneyShort(cents: number): string {
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 10_000) return `$${(dollars / 1000).toFixed(1)}k`;
  return moneyShort.format(dollars);
}

export function formatCount(qty: number): string {
  return count.format(qty);
}

export function formatQty(qty: number, unit?: string): string {
  return unit ? `${count.format(qty)} ${unit}` : count.format(qty);
}

export function formatSigned(qty: number): string {
  return qty > 0 ? `+${count.format(qty)}` : `−${count.format(Math.abs(qty))}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `2026-12-02` or an ISO timestamp → `Dec 2`. Uses UTC so a date-only value never shifts a day. */
export function formatDay(iso: string): string {
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00.000Z` : iso);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

export function formatRelative(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const seconds = Math.round((now.getTime() - then) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDay(iso);
}

/** Expected date relative to today: "due Dec 2", "due today", "3 days late". */
export function formatDue(expectedOn: string | null, now: Date = new Date()): string {
  if (!expectedOn) return 'No date';
  const due = Date.parse(`${expectedOn}T00:00:00.000Z`);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.round((due - today) / 86_400_000);
  if (days === 0) return 'Due today';
  if (days < 0) return `${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} late`;
  return `Due ${formatDay(expectedOn)}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${count.format(n)} ${n === 1 ? one : many}`;
}
