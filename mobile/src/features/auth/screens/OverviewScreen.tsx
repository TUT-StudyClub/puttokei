/**
 * スプラッシュ後に表示する概要説明画面。
 *
 * ボタン操作でチュートリアル Step1 へ遷移する。
 */
import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, ImageBackground, Pressable, SafeAreaView, StyleSheet, View } from 'react-native';
import { SizableText } from 'tamagui';

import {
  TUTORIAL_ACTION_AREA_BOTTOM_OFFSET,
  TUTORIAL_ACTION_BUTTON_HEIGHT,
  TUTORIAL_ONE_BUTTON_ACTION_AREA_RESERVE,
  TUTORIAL_ROUTE_TRANSITION_DELAY_MS,
} from '@/features/auth/screens/tutorialConfig';

const OVERVIEW_BACKGROUND = require('../../../../assets/images/overview-screen-background.png');
const TYPOGRAPHY_WHITE = require('../../../../assets/images/typography_white.png');

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
      router.replace(TUTORIAL_STEP_ONE_ROUTE);
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
          <View style={styles.heroContainer}>
            <View style={styles.heroBlock}>
              <View style={styles.logoRow} testID="overview-heading">
                <Image
                  source={TYPOGRAPHY_WHITE}
                  style={styles.logo}
                  resizeMode="contain"
                  testID="overview-logo"
                />
                <SizableText size="$8" style={styles.welcomeText} testID="overview-welcome">
                  へようこそ
                </SizableText>
              </View>
              <SizableText size="$7" style={styles.description} testID="overview-description">
                {DESCRIPTION}
              </SizableText>
            </View>
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
              <SizableText size="$5" style={styles.primaryButtonText}>
                はじめる
              </SizableText>
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
    position: 'relative',
    paddingRight: 40,
    paddingBottom: TUTORIAL_ONE_BUTTON_ACTION_AREA_RESERVE,
    paddingLeft: 40,
  },
  heroContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  heroBlock: {
    width: '100%',
    maxWidth: 312,
    alignSelf: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 224,
    height: 53,
  },
  welcomeText: {
    marginBottom: 3,
    marginLeft: 10,
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '700',
    lineHeight: 31,
    letterSpacing: 0.24,
    textShadowColor: 'rgba(73, 81, 93, 0.22)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 18,
  },
  description: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 31,
    letterSpacing: 0.24,
    textShadowColor: 'rgba(73, 81, 93, 0.22)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 18,
  },
  actionArea: {
    position: 'absolute',
    right: 40,
    bottom: TUTORIAL_ACTION_AREA_BOTTOM_OFFSET,
    left: 40,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: TUTORIAL_ACTION_BUTTON_HEIGHT,
    borderRadius: 18,
    backgroundColor: '#4B5CFF',
  },
  primaryButtonPressed: {
    opacity: 0.92,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
});
