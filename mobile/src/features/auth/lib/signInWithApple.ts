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

import { AuthFlowCancelledError, isNativeAuthCancelledError } from './authErrors';

export async function signInWithApple(): Promise<void> {
  const rawNonce = generateNonce();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  const appleCredential = await signInWithAppleId(hashedNonce);

  if (!appleCredential.identityToken) {
    throw new Error('Apple Sign In: identityToken が取得できませんでした');
  }

  const credential = auth.AppleAuthProvider.credential(appleCredential.identityToken, rawNonce);

  await auth().signInWithCredential(credential);
}

async function signInWithAppleId(
  hashedNonce: string,
): Promise<AppleAuthentication.AppleAuthenticationCredential> {
  try {
    return await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (error) {
    if (isNativeAuthCancelledError(error)) {
      throw new AuthFlowCancelledError();
    }
    throw error;
  }
}

function generateNonce(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = Crypto.getRandomBytes(length);
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join('');
}
