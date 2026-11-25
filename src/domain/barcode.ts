/**
 * Barcode matching for the scanner. Cameras report UPC-A codes as 12 digits on iOS and
 * as 13-digit EAN-13 with a leading zero on some Android devices, and people type SKUs in
 * any case. Everything is compared in one normalised form.
 */
export function normalizeCode(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, '');
  if (/^\d+$/.test(trimmed)) {
    const stripped = trimmed.replace(/^0+/, '');
    return stripped.length > 0 ? stripped : '0';
  }
  return trimmed.toUpperCase();
}

export function codesMatch(a: string, b: string): boolean {
  if (!a.trim() || !b.trim()) return false;
  return normalizeCode(a) === normalizeCode(b);
}

export interface Codeable {
  sku: string;
  barcode: string;
}

export function findByCode<T extends Codeable>(
  items: T[],
  raw: string,
): { item: T; matchedBy: 'barcode' | 'sku' } | null {
  const code = raw.trim();
  if (!code) return null;
  const byBarcode = items.find((item) => item.barcode && codesMatch(item.barcode, code));
  if (byBarcode) return { item: byBarcode, matchedBy: 'barcode' };
  const bySku = items.find((item) => normalizeCode(item.sku) === normalizeCode(code));
  if (bySku) return { item: bySku, matchedBy: 'sku' };
  return null;
}

/** Shelfly links (`shelfly://item/<id>` or `https://shelfly-app.quvantic.com/item/<id>`) printed on shelf labels. */
export function itemIdFromLink(raw: string): string | null {
  const match = raw.trim().match(/^(?:shelfly:\/\/|https:\/\/shelfly-app\.quvantic\.com\/)item\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}
