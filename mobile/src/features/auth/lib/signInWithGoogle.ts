/**
 * Google Sign In → Firebase credential の取得。
 *
 * @react-native-google-signin/google-signin で Google credential を取得し、
 * Firebase の GoogleAuthProvider.credential に変換してサインインする。
 * webClientId は app.json の extra.googleWebClientId から読み込む。
 */
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';

let configured = false;

function ensureConfigured(): void {
  if (configured) return;

  const webClientId = Constants.expoConfig?.extra?.googleWebClientId as string | undefined;
  if (!webClientId) {
    throw new Error('app.json の extra.googleWebClientId が未設定です');
  }

  GoogleSignin.configure({ webClientId });
  configured = true;
}

export async function signInWithGoogle(): Promise<void> {
  ensureConfigured();

  await GoogleSignin.hasPlayServices();
  const result = await GoogleSignin.signIn();

  if (result.type !== 'success' || !result.data.idToken) {
    throw new Error('Google Sign In: idToken が取得できませんでした');
  }

  const credential = auth.GoogleAuthProvider.credential(result.data.idToken);
  await auth().signInWithCredential(credential);
}
