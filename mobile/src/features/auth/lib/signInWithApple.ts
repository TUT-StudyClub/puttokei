/**
 * Apple Sign In → Firebase credential の取得。
 *
 * expo-apple-authentication で Apple ID credential を取得し、
 * Firebase の OAuthProvider('apple.com') credential に変換してサインインする。
 * nonce はリプレイ攻撃防止のため毎回生成する。
 */
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import auth from '@react-native-firebase/auth';

export async function signInWithApple(): Promise<void> {
  const rawNonce = generateNonce();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  const appleCredential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!appleCredential.identityToken) {
    throw new Error('Apple Sign In: identityToken が取得できませんでした');
  }

  const credential = auth.AppleAuthProvider.credential(
    appleCredential.identityToken,
    rawNonce,
  );

  await auth().signInWithCredential(credential);
}

function generateNonce(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = Crypto.getRandomBytes(length);
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join('');
}
