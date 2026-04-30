/**
 * サインイン画面。
 *
 * Apple / Google サインインボタンから `useSignIn` 経由で Firebase credential
 * を取得し、onIdTokenChanged → authStore → AuthGate で (tabs) へ遷移する。
 * "あとで" ボタンはサインインをスキップして (tabs) へ直行する dev 確認導線。
 */
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback } from 'react';
import { Image, ImageBackground, Pressable, SafeAreaView, StyleSheet, View } from 'react-native';
import { Path, Svg } from 'react-native-svg';
import { SizableText } from 'tamagui';

import { useSignIn } from '../hooks/useSignIn';
import { APP_ROUTES } from '@/shared/lib/routes';

const SIGN_IN_BACKGROUND = require('../../../../assets/images/overview-screen-background.png');
const TYPOGRAPHY_WHITE = require('../../../../assets/images/typography_white.png');

function AppleLogo({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="#FFFFFF">
      <Path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </Svg>
  );
}

function GoogleLogo({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

export function SignInScreen() {
  const router = useRouter();
  const { loading, error, signInWithApple, signInWithGoogle, clearError } = useSignIn();

  const handleSkip = useCallback(() => {
    router.replace(APP_ROUTES.tabs);
  }, [router]);

  return (
    <ImageBackground
      source={SIGN_IN_BACKGROUND}
      style={styles.background}
      imageStyle={styles.backgroundImage}
      testID="sign-in-root"
    >
      <StatusBar style="light" />
      <View pointerEvents="none" style={styles.softOverlay} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.hero}>
            <Image
              source={TYPOGRAPHY_WHITE}
              style={styles.logo}
              resizeMode="contain"
              testID="sign-in-logo"
            />
            <SizableText style={styles.title} testID="sign-in-title">
              {'アカウントを作って\n学習の成果を振り返りましょう'}
            </SizableText>
          </View>

          <View style={styles.actionArea}>
            <SizableText style={styles.caption} testID="sign-in-caption">
              会員登録後レポート機能を使用できます
            </SizableText>

            {error ? (
              <Pressable onPress={clearError} testID="sign-in-error">
                <SizableText style={styles.errorText}>{error}</SizableText>
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.appleButton,
                pressed ? styles.buttonPressed : null,
                loading ? styles.buttonDisabled : null,
              ]}
              onPress={signInWithApple}
              disabled={loading}
              testID="sign-in-apple"
            >
              <AppleLogo />
              <SizableText style={styles.appleButtonText}>Appleで続ける</SizableText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.googleButton,
                pressed ? styles.buttonPressed : null,
                loading ? styles.buttonDisabled : null,
              ]}
              onPress={signInWithGoogle}
              disabled={loading}
              testID="sign-in-google"
            >
              <View style={styles.googleIconCircle}>
                <GoogleLogo />
              </View>
              <SizableText style={styles.googleButtonText}>Googleで続ける</SizableText>
            </Pressable>

            <SizableText style={styles.termsText} testID="sign-in-terms">
              利用規約・プライバシーポリシー
            </SizableText>
          </View>

          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.skipButton, pressed ? styles.skipButtonPressed : null]}
            onPress={handleSkip}
            testID="sign-in-skip"
          >
            <SizableText style={styles.skipButtonText}>あとで</SizableText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  backgroundImage: {
    resizeMode: 'cover',
  },
  safeArea: {
    flex: 1,
  },
  softOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20, 28, 48, 0.28)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 24,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 224,
    height: 53,
    marginBottom: 32,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 28,
    letterSpacing: 0.24,
    textAlign: 'center',
    textShadowColor: 'rgba(20, 28, 48, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  actionArea: {
    gap: 12,
  },
  caption: {
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 6,
  },
  errorText: {
    color: '#FFB4B4',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    textAlign: 'center',
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderRadius: 999,
    backgroundColor: '#000000',
  },
  appleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderRadius: 999,
    backgroundColor: '#4B5CFF',
  },
  googleIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  termsText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 4,
  },
  skipButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 16,
  },
  skipButtonPressed: {
    opacity: 0.7,
  },
  skipButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
});
