# puttokei 契約参照

## セッションと判定のライフサイクル

- `sessions.status`: `input`, `output`, `judging`, `judged`, `cancelled`
- `judgments.verdict`: `correct`, `partial`, `incorrect`, `rejected`
- 1 セッションに対して output と judgment はそれぞれ 1 件を想定する

## API 一覧

- `POST /api/v1/auth/verify`
- `POST /api/v1/sessions`
- `GET /api/v1/sessions/{id}`
- `PATCH /api/v1/sessions/{id}`
- `GET /api/v1/sessions`
- `POST /api/v1/sessions/{id}/output`
- `GET /api/v1/sessions/{id}/judgment`
- `GET /api/v1/judgments`
- `GET /api/v1/judgments/{id}`
- `GET /api/v1/stats/summary`
- `GET /api/v1/stats/daily`
- `GET /api/v1/stats/weekly`
- `GET /api/v1/stats/monthly`
- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me/settings`
- `DELETE /api/v1/users/me`
- `GET /health`
- `GET /health/ready`

## DB の期待値

- `users`: Firebase UID と紐づく内部ユーザ
- `user_settings`: タイマー初期値と通知設定
- `sessions`: 学習 1 サイクル
- `outputs`: 送信されたアウトプット本文
- `judgments`: 判定結果、スコア、項目別フィードバック、使用モデル情報
- `rate_limit_logs`: レートリミット監視用ログ

設計書では PostgreSQL、UUID 主キー、必要箇所の論理削除、Alembic マイグレーションを前提にしている。

## LLM の契約

- LLM 応答は `verdict` `score` `items` `advice` を持つ JSON
- 不明な内容は推測で断定しない
- フィードバックは高校生でも読める平易な日本語
- 学習と無関係な入力は拒否できるようにする
- 保存前にバックエンドでバリデーションする

## 認証と通知

- クライアントは Firebase 経由で Apple / Google サインイン
- API には `Authorization: Bearer <token>` で Firebase ID Token を送る
- バックエンドは Firebase Admin SDK で検証する
- 未登録ユーザはサーバー側で自動作成する
- FCM はフェーズ遷移や判定完了通知に使う

## CI / CD の期待値

- backend CI: Ruff、型チェック、pytest、Docker ビルド確認
- mobile CI: lint / format、`tsc --noEmit`、Jest、Expo Doctor
- backend CD: Cloud Run、イメージ push、マイグレーション、スモークテスト
- mobile CD: EAS Build、EAS Submit、EAS Update

実ファイルがまだ無い段階では、コマンドや workflow が実装済みだと決め打ちしない。毎回ローカルの設定を確認する。
