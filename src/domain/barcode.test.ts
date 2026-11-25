import { codesMatch, findByCode, itemIdFromLink, normalizeCode } from '@/domain/barcode';

const items = [
  { id: 'a', sku: 'NW-PK-12', barcode: '840011000017' },
  { id: 'b', sku: 'HB-FL-PH', barcode: '' },
];

describe('barcodes', () => {
  it('normalises UPC-A and EAN-13 to the same code', () => {
    expect(normalizeCode(' 0840011000017 ')).toBe('840011000017');
    expect(codesMatch('0840011000017', '840011000017')).toBe(true);
    expect(codesMatch('840011000017', '840011000018')).toBe(false);
    expect(codesMatch('', '')).toBe(false);
  });

  it('matches barcodes first, then SKUs in any case', () => {
    expect(findByCode(items, '0840011000017')).toEqual({ item: items[0], matchedBy: 'barcode' });
    expect(findByCode(items, 'hb-fl-ph')).toEqual({ item: items[1], matchedBy: 'sku' });
    expect(findByCode(items, 'nothing')).toBeNull();
    expect(findByCode(items, '   ')).toBeNull();
  });

  it('reads shelf-label links', () => {
    expect(itemIdFromLink('shelfly://item/prd_eth_12')).toBe('prd_eth_12');
    expect(itemIdFromLink('https://shelfly-app.quvantic.com/item/prd_cup')).toBe('prd_cup');
    expect(itemIdFromLink('https://example.com/item/prd_cup')).toBeNull();
  });
});
