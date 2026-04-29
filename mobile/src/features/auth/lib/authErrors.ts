export class AuthFlowCancelledError extends Error {
  constructor() {
    super('認証がキャンセルされました');
    this.name = 'AuthFlowCancelledError';
  }
}

export function isAuthFlowCancelledError(error: unknown): error is AuthFlowCancelledError {
  return error instanceof AuthFlowCancelledError;
}

export function isNativeAuthCancelledError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const code = (error as { code?: unknown }).code;
  return code === 'ERR_REQUEST_CANCELED' || code === 'SIGN_IN_CANCELLED';
}
