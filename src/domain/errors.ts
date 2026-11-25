export type ShelflyErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'invalid'
  | 'stock'
  | 'offline'
  | 'network';

export class ShelflyError extends Error {
  readonly code: ShelflyErrorCode;

  constructor(code: ShelflyErrorCode, message: string) {
    super(message);
    this.name = 'ShelflyError';
    this.code = code;
  }
}

export function messageOf(error: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
