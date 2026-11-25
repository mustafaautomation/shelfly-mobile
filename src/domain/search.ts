import { normalizeCode } from '@/domain/barcode';
import type { ItemSummary } from '@/domain/types';

/** Search matches SKU, name, barcode (with or without a leading zero) and category, like the web catalog. */
export function matchesSearch(item: Pick<ItemSummary, 'sku' | 'name' | 'barcode' | 'category'>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (/^\d{6,}$/.test(q) && item.barcode && normalizeCode(item.barcode) === normalizeCode(q)) return true;
  return [item.sku, item.name, item.barcode, item.category].some((field) => field.toLowerCase().includes(q));
}
