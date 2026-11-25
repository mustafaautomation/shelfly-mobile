import { ShelflyError } from '@/domain/errors';
import {
  applyAdjust,
  applyReceive,
  applyTransfer,
  isLowStock,
  poStatusAfterReceipt,
  remainingToReceive,
  stockLevelRatio,
} from '@/domain/stock';

describe('stock math', () => {
  it('receives whole positive quantities only', () => {
    expect(applyReceive(10, 5)).toBe(15);
    expect(() => applyReceive(10, 0)).toThrow(ShelflyError);
    expect(() => applyReceive(10, 1.5)).toThrow('whole number');
  });

  it('lets an adjustment go negative only with a reason', () => {
    expect(applyAdjust(4, -2)).toBe(2);
    expect(() => applyAdjust(4, -6)).toThrow('explicit adjust reason');
    expect(applyAdjust(4, -6, 'Cycle count found a short case')).toBe(-2);
    expect(() => applyAdjust(4, 0, 'x')).toThrow('cannot be zero');
  });

  it('never overdraws the transfer source', () => {
    expect(applyTransfer(10, 2, 10)).toEqual({ source: 0, dest: 12 });
    expect(() => applyTransfer(3, 0, 4)).toThrow('enough on-hand');
    expect(() => applyTransfer(3, 0, 0)).toThrow('greater than zero');
  });

  it('flags low stock at or below the reorder point', () => {
    expect(isLowStock(8, 8)).toBe(true);
    expect(isLowStock(9, 8)).toBe(false);
  });

  it('works out purchase order progress', () => {
    expect(remainingToReceive(10, 4)).toBe(6);
    expect(remainingToReceive(10, 12)).toBe(0);
    expect(poStatusAfterReceipt([{ qtyOrdered: 5, qtyReceived: 5 }, { qtyOrdered: 2, qtyReceived: 1 }])).toBe('partial');
    expect(poStatusAfterReceipt([{ qtyOrdered: 5, qtyReceived: 5 }])).toBe('received');
    expect(poStatusAfterReceipt([])).toBe('partial');
  });

  it('fills a stock bar against twice the reorder point', () => {
    expect(stockLevelRatio(0, 10)).toBe(0);
    expect(stockLevelRatio(10, 10)).toBe(0.5);
    expect(stockLevelRatio(50, 10)).toBe(1);
    expect(stockLevelRatio(3, 0)).toBe(1);
  });
});
