/**
 * 通知許可リクエストと FCM トークンを backend に登録する hook。
 *
 * 認証済（uid あり）かつ チュートリアル完了の状態でマウントされたとき、
 * 1) 通知 handler の登録、2) Android チャネル準備、3) 許可リクエスト、
 * 4) FCM トークン取得 → backend へ PUT、5) onTokenRefresh の購読
 * を行う。許可拒否やシミュレータ等で token が取れない場合はサイレントに
 * 終了する（UI 側で error を出さない）。
 */
import { useEffect } from 'react';

import { updateMyPushToken } from '@/features/settings/api/settingsApi';
import {
  ensureAndroidChannel,
  getFcmDeviceToken,
  installNotificationHandler,
  requestNotificationPermissions,
  subscribeFcmTokenRefresh,
} from '@/shared/lib/notifications';
import { useAuthStore } from '@/shared/stores/authStore';
import { useTutorialStore } from '@/shared/stores/tutorialStore';

export function useRegisterPushToken(): void {
  const uid = useAuthStore((s) => s.uid);
  const tutorialCompleted = useTutorialStore((s) => s.completed);

  useEffect(() => {
    if (uid === null || !tutorialCompleted) return;

    let unsubscribeRefresh: (() => void) | null = null;
    let cancelled = false;

    void (async () => {
      try {
        installNotificationHandler();
        await ensureAndroidChannel();
        const granted = await requestNotificationPermissions();
        if (!granted || cancelled) return;
        const token = await getFcmDeviceToken();
        if (cancelled) return;
        if (token !== null) {
          await updateMyPushToken(token);
        }
        if (cancelled) return;
        unsubscribeRefresh = subscribeFcmTokenRefresh((newToken) => {
          void updateMyPushToken(newToken).catch(() => undefined);
        });
      } catch {
        // 通知許可・トークン取得・登録のいずれかが失敗してもアプリは続行できるよう握り潰す
      }
    })();

    return () => {
      cancelled = true;
      if (unsubscribeRefresh !== null) unsubscribeRefresh();
    };
  }, [uid, tutorialCompleted]);
}
