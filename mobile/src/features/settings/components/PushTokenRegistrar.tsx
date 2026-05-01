/**
 * 通知許可と FCM トークン登録を駆動するための非表示コンポーネント。
 *
 * AuthGate の中（認証済セッション）で 1 度だけ render することで、
 * 通知初期化を認証完了後に限定する。レンダリング自体は何もしない。
 */
import { useRegisterPushToken } from '@/features/settings/hooks/useRegisterPushToken';

export function PushTokenRegistrar() {
  useRegisterPushToken();
  return null;
}
