/**
 * スプラッシュ後に表示する概要説明画面。
 *
 * 「はじめる」ボタン押下時に Firebase Anonymous Auth で匿名ユーザーを作成してから
 * チュートリアル Step1 へ遷移する。匿名 sign-in をユーザーアクション起点にすることで、
 * 退会後やログアウト後に裏で匿名ユーザーが自動再作成される現象を防いでいる。
 */
import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, ImageBackground, Pressable, SafeAreaView, StyleSheet, View } from 'react-native';
import { SizableText } from 'tamagui';

import {
  OVERVIEW_ACTION_BUTTON_HEIGHT,
  TUTORIAL_ROUTE_TRANSITION_DELAY_MS,
} from '@/features/auth/screens/tutorialConfig';
import { ensureAnonymousSession } from '@/shared/lib/firebase';

const OVERVIEW_BACKGROUND = require('../../../../assets/images/backgrounds/overview.jpg');
const TYPOGRAPHY_WHITE = require('../../../../assets/images/logos/typography_white.png');

const TUTORIAL_STEP_ONE_ROUTE = '/(auth)/tutorial-step-one' as unknown as Href;

const DESCRIPTION =
  'インプットとアウトプットを\n無意識に繰り返すことで、気づいたら\n集中して勉強してしまうアプリです';

export function OverviewScreen() {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleNavigation = useCallback(() => {
    if (isNavigating) return;

    setIsNavigating(true);
    navigationTimeoutRef.current = setTimeout(() => {
      void (async () => {
        try {
          // 匿名 sign-in は本ボタン押下を起点に Firebase Auth 上のユーザーを作成する。
          // 既に currentUser が存在する場合 (Apple/Google 復帰直後など) は内部で
          // early return するため二重作成は起きない。
          await ensureAnonymousSession();
          router.replace(TUTORIAL_STEP_ONE_ROUTE);
        } catch {
          // ネットワーク障害などで sign-in に失敗した場合はボタン押下をやり直せるよう
          // isNavigating を戻す。エラーメッセージ表示の追加は別 Issue で扱う。
          setIsNavigating(false);
        }
      })();
    }, TUTORIAL_ROUTE_TRANSITION_DELAY_MS);
  }, [isNavigating, router]);

  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current !== null) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

  return (
    <ImageBackground
      source={OVERVIEW_BACKGROUND}
      style={styles.background}
      imageStyle={styles.backgroundImage}
      testID="overview-root"
    >
      <StatusBar style="dark" />
      <View pointerEvents="none" style={styles.softOverlay} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.heroBlock} testID="overview-heading">
            <View style={styles.logoRow}>
              <View style={styles.logoShadow}>
                <Image
                  source={TYPOGRAPHY_WHITE}
                  style={styles.logo}
                  resizeMode="contain"
                  testID="overview-logo"
                />
              </View>
              <SizableText style={styles.welcomeText} testID="overview-welcome">
                へようこそ
              </SizableText>
            </View>
            <SizableText style={styles.description} testID="overview-description">
              {DESCRIPTION}
            </SizableText>
          </View>

          <View style={styles.actionArea}>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.primaryButton,
                pressed ? styles.primaryButtonPressed : null,
              ]}
              disabled={isNavigating}
              onPress={scheduleNavigation}
              testID="overview-next"
            >
              <SizableText style={styles.primaryButtonText}>はじめる</SizableText>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  backgroundImage: {
    resizeMode: 'cover',
  },
  softOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(236, 242, 247, 0.16)',
  },
  content: {
    flex: 1,
  },
  heroBlock: {
    position: 'absolute',
    top: '37.53%',
    left: '11.4%',
    right: '5%',
    overflow: 'visible',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    marginBottom: 40,
  },
  logoShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  logo: {
    width: 188,
    height: 44,
  },
  welcomeText: {
    marginBottom: 0,
    marginLeft: 9,
    color: '#FFFFFF',
    fontFamily: 'HiraginoSans-W6',
    fontSize: 24,
    lineHeight: 22,
    letterSpacing: 0,
    textShadowColor: 'rgba(73, 81, 93, 0.22)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 18,
  },
  description: {
    color: '#FFFFFF',
    fontFamily: 'HiraginoSans-W6',
    fontSize: 15,
    lineHeight: 30,
    letterSpacing: 0.24,
    textShadowColor: 'rgba(73, 81, 93, 0.22)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 18,
  },
  actionArea: {
    position: 'absolute',
    top: '78%',
    left: '13.2%',
    right: '12.9%',
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: OVERVIEW_ACTION_BUTTON_HEIGHT,
    borderRadius: 20,
    backgroundColor: '#475FFF',
  },
  primaryButtonPressed: {
    opacity: 0.92,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: 'HiraginoSans-W6',
    fontSize: 16,
    lineHeight: 20,
  },
});
