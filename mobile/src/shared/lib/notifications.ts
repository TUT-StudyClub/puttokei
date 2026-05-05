/**
 * プッシュ通知（FCM）とローカル通知のセットアップ。
 *
 * - フェーズ完了時のローカル通知の予約・キャンセル（BR-40〜42）
 * - 通知許可の要求
 * - FCM device token の取得 / refresh 購読
 *
 * フォアグラウンドではバナーを抑止する（要件「バックグラウンド時のみプッシュ通知」）。
 * 抑止は `setNotificationHandler` の戻り値を全 false にすることで実現する。
 * バックグラウンド・タスクキル・画面ロック中は OS が予約発火するため届く。
 */
import messaging from '@react-native-firebase/messaging';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type SessionPhaseNotificationKind = 'input' | 'output' | 'break';

/**
 * 通知 data に乗せる route 情報。タップして開かれた時に
 * `SessionNotificationResponder` がこれを読み、適切な画面へ router.replace する。
 */
export type SessionPhaseNotificationRoute = {
  sessionId: string;
  inputMinutes: number;
  outputMinutes: number;
  breakMinutes: number;
};

const NOTIFICATION_CONTENT: Record<SessionPhaseNotificationKind, { title: string; body: string }> =
  {
    input: { title: 'インプットが終わりました', body: 'アウトプットを始めましょう' },
    output: {
      title: 'アウトプットが終わりました',
      body: 'アウトプットした内容を入力しましょう',
    },
    break: { title: '休憩が終わりました', body: '勉強を再開しましょう' },
  };

const ANDROID_DEFAULT_CHANNEL_ID = 'default';

let handlerInstalled = false;

/**
 * フォアグラウンド受信時にバナー / 音 / バッジを出さない handler を登録する。
 * 同じプロセス中で何度呼ばれても 1 回しか効かない idempotent 実装。
 */
export function installNotificationHandler(): void {
  if (handlerInstalled) return;
  handlerInstalled = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: false,
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Android で通知チャンネルを用意する。iOS では no-op。
 * importance を HIGH にし、サウンドを既定音にしてロック画面でも目立つようにする。
 */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_DEFAULT_CHANNEL_ID, {
    name: 'デフォルト',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
}

/**
 * 通知許可をユーザーに要求する。既に許可済みなら true、明示拒否なら false を返す。
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (current.canAskAgain === false) return false;
  const result = await Notifications.requestPermissionsAsync();
  return result.granted;
}

/**
 * FCM の device token を取得する。
 * シミュレータや APNs 未登録環境では null を返す（呼び出し側で握り潰す前提）。
 */
export async function getFcmDeviceToken(): Promise<string | null> {
  if (!Device.isDevice) return null;
  try {
    if (Platform.OS === 'ios') {
      await messaging().registerDeviceForRemoteMessages();
    }
    const token = await messaging().getToken();
    return token || null;
  } catch {
    return null;
  }
}

export function subscribeFcmTokenRefresh(listener: (token: string) => void): () => void {
  return messaging().onTokenRefresh(listener);
}

/**
 * フェーズ完了通知を delaySeconds 後に予約する。返り値は通知 id。
 * delaySeconds が 1 未満のときは 1 にクランプする。
 *
 * data に sessionId と各フェーズの minutes を埋めるため、ユーザーが通知をタップ
 * して開いたときに、フォアグラウンド側で次の画面へ router.replace できる。
 */
export async function scheduleSessionPhaseNotification(
  kind: SessionPhaseNotificationKind,
  route: SessionPhaseNotificationRoute,
  delaySeconds: number,
): Promise<string> {
  const content = NOTIFICATION_CONTENT[kind];
  const seconds = Math.max(1, Math.floor(delaySeconds));
  return Notifications.scheduleNotificationAsync({
    content: {
      title: content.title,
      body: content.body,
      sound: 'default',
      data: {
        kind,
        sessionId: route.sessionId,
        // expo-notifications の data はプリミティブを保存できるが、
        // OS によって数値が文字列化されるため最初から string で送って解釈ブレを避ける
        inputMinutes: String(route.inputMinutes),
        outputMinutes: String(route.outputMinutes),
        breakMinutes: String(route.breakMinutes),
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      channelId: ANDROID_DEFAULT_CHANNEL_ID,
    },
  });
}

export async function cancelScheduledNotification(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // 既にキャンセル済 / 存在しない場合は何もしない
  }
}

export async function cancelAllScheduledSessionNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
