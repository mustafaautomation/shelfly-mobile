import { matchesSearch } from '@/domain/search';

const bags = { sku: 'NW-PK-12', name: '12oz Kraft Bags', barcode: '840011000017', category: 'Packaging' };

describe('catalog search', () => {
  it('matches SKU, name, category and barcode', () => {
    expect(matchesSearch(bags, '')).toBe(true);
    expect(matchesSearch(bags, 'pk-12')).toBe(true);
    expect(matchesSearch(bags, 'kraft')).toBe(true);
    expect(matchesSearch(bags, 'packaging')).toBe(true);
    expect(matchesSearch(bags, '0840011000017')).toBe(true);
    expect(matchesSearch(bags, 'oat milk')).toBe(false);
  });
});
