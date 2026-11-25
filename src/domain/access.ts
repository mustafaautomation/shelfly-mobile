import type { Plan, PoStatus, SeatRole } from '@/domain/model';

export function canWrite(role: SeatRole | null | undefined): boolean {
  return role === 'owner' || role === 'warehouse_staff' || role === 'super_admin';
}

export function canManage(role: SeatRole | null | undefined): boolean {
  return role === 'owner' || role === 'super_admin';
}

/** Warehouse staff live on the scanner. Owners, admins and viewers get stock by location instead. */
export function isFloorRole(role: SeatRole | null | undefined): boolean {
  return role === 'warehouse_staff';
}

export function roleLabel(role: SeatRole | null | undefined): string {
  if (role === 'owner') return 'Owner';
  if (role === 'warehouse_staff') return 'Warehouse staff';
  if (role === 'super_admin') return 'Super admin';
  if (role === 'viewer') return 'Viewer';
  return 'No seat';
}

export function lockedReason(role: SeatRole | null | undefined): string {
  if (role === 'viewer') return 'Viewers can look, not post. Ask an owner for a warehouse seat to change stock.';
  return 'Your seat cannot change stock in this workspace.';
}

export function planLabel(plan: Plan): string {
  return plan === 'pro' ? 'Pro' : 'Starter';
}

export function poStatusLabel(status: PoStatus): string {
  if (status === 'draft') return 'Draft';
  if (status === 'sent') return 'Sent';
  if (status === 'partial') return 'Partial';
  return 'Received';
}

export function canReceive(status: PoStatus): boolean {
  return status === 'sent' || status === 'partial';
}
