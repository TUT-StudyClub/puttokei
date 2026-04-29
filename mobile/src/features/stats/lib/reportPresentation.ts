import { isApiError } from '@/shared/lib/api';

export function getReportErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.problem?.detail ?? error.problem?.title ?? 'レポートの取得に失敗しました。';
  }
  return 'レポートの取得に失敗しました。';
}
