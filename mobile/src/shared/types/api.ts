/**
 * バックエンド API レスポンスの共通型。
 * 個別エンドポイントの型は features 側で定義する。
 */

import type { z } from 'zod';

export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: unknown[];
};

export type Cursor = string | null;

export type Paginated<T> = {
  items: T[];
  next_cursor: Cursor;
};

export type InferZod<T extends z.ZodTypeAny> = z.infer<T>;
