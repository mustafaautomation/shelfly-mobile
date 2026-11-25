import { ShelflyError } from '@/domain/errors';

/** Same rules as the web app's lib/stock.ts and the apply_movement SQL function. */
export function assertWhole(qty: number, label: string): void {
  if (!Number.isInteger(qty)) {
    throw new ShelflyError('stock', `${label} must be a whole number.`);
  }
}

export function applyReceive(onHand: number, qty: number): number {
  assertWhole(onHand, 'On-hand quantity');
  assertWhole(qty, 'Receive quantity');
  if (qty <= 0) throw new ShelflyError('stock', 'Receive quantity must be greater than zero.');
  return onHand + qty;
}

/** On-hand may go negative only when the caller gives a non-blank reason. */
export function applyAdjust(onHand: number, delta: number, reason?: string | null): number {
  assertWhole(onHand, 'On-hand quantity');
  assertWhole(delta, 'Adjustment');
  if (delta === 0) throw new ShelflyError('stock', 'Adjustment cannot be zero.');
  const next = onHand + delta;
  if (next < 0 && !reason?.trim()) {
    throw new ShelflyError('stock', 'Stock cannot go negative without an explicit adjust reason.');
  }
  return next;
}

export function applyTransfer(
  sourceOnHand: number,
  destOnHand: number,
  qty: number,
): { source: number; dest: number } {
  assertWhole(sourceOnHand, 'Source on-hand');
  assertWhole(destOnHand, 'Destination on-hand');
  assertWhole(qty, 'Transfer quantity');
  if (qty <= 0) throw new ShelflyError('stock', 'Transfer quantity must be greater than zero.');
  if (sourceOnHand < qty) {
    throw new ShelflyError('stock', 'Source location does not have enough on-hand stock to transfer.');
  }
  return { source: sourceOnHand - qty, dest: destOnHand + qty };
}

export function isLowStock(onHand: number, reorderPoint: number): boolean {
  return onHand <= reorderPoint;
}

export function remainingToReceive(qtyOrdered: number, qtyReceived: number): number {
  return Math.max(0, qtyOrdered - qtyReceived);
}

export function poStatusAfterReceipt(lines: { qtyOrdered: number; qtyReceived: number }[]): 'partial' | 'received' {
  if (lines.length === 0) return 'partial';
  return lines.every((line) => line.qtyOrdered > 0 && line.qtyReceived >= line.qtyOrdered) ? 'received' : 'partial';
}

/** 0..1 fill for a stock bar: full at twice the reorder point, so "low" sits at the halfway mark. */
export function stockLevelRatio(onHand: number, reorderPoint: number): number {
  if (onHand <= 0) return 0;
  const target = Math.max(reorderPoint * 2, 1);
  return Math.min(1, onHand / target);
}
