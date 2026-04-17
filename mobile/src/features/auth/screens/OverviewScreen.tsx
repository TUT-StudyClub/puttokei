/**
 * スプラッシュ後に表示する概要説明画面。
 *
 * 一定時間表示したあと、チュートリアル Step1 へ自動遷移する。
 */
import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Image, ImageBackground, StyleSheet, View } from 'react-native';
import { SizableText } from 'tamagui';

const OVERVIEW_BACKGROUND = require('../../../../assets/images/overview-screen-background.png');
const TYPOGRAPHY_WHITE = require('../../../../assets/images/typography_white.png');

export const OVERVIEW_SCREEN_DURATION_MS = 2500;
const TUTORIAL_STEP_ONE_ROUTE = '/(auth)/tutorial-step-one' as unknown as Href;

const DESCRIPTION =
  'インプットとアウトプットを\n無意識に繰り返すことで、気づいたら\n集中して勉強してしまうアプリです';

export function OverviewScreen() {
  const router = useRouter();

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      router.replace(TUTORIAL_STEP_ONE_ROUTE);
    }, OVERVIEW_SCREEN_DURATION_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [router]);

  return (
    <ImageBackground
      source={OVERVIEW_BACKGROUND}
      style={styles.background}
      imageStyle={styles.backgroundImage}
      testID="overview-root"
    >
      <StatusBar style="dark" />
      <View pointerEvents="none" style={styles.softOverlay} />

      <View style={styles.content}>
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
  softOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(236, 242, 247, 0.16)',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 40,
    paddingBottom: 28,
    paddingLeft: 40,
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
});
