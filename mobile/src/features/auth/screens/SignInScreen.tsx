/**
 * スプラッシュ後に表示する概要案内兼サインイン待機画面。
 *
 * Apple / Google サインイン本実装は #32 で対応する。
 */
import { StatusBar } from 'expo-status-bar';
import { Image, ImageBackground, StyleSheet, View } from 'react-native';
import { SizableText } from 'tamagui';

const OVERVIEW_BACKGROUND = require('../../../../assets/images/overview-screen-background.png');
const TYPOGRAPHY_WHITE = require('../../../../assets/images/typography_white.png');

const DESCRIPTION =
  'インプットとアウトプットを\n無意識に繰り返すことで、気づいたら\n集中して勉強してしまうアプリです';

export function SignInScreen() {
  return (
    <ImageBackground
      source={OVERVIEW_BACKGROUND}
      style={styles.background}
      imageStyle={styles.backgroundImage}
      testID="sign-in-root"
    >
      <StatusBar style="dark" />
      <View pointerEvents="none" style={styles.softOverlay} />

      <View style={styles.content}>
        <View style={styles.heroBlock}>
          <View style={styles.logoRow} testID="sign-in-heading">
            <Image
              source={TYPOGRAPHY_WHITE}
              style={styles.logo}
              resizeMode="contain"
              testID="sign-in-logo"
            />
            <SizableText size="$8" style={styles.welcomeText} testID="sign-in-welcome">
              へようこそ
            </SizableText>
          </View>
          <SizableText size="$7" style={styles.description} testID="sign-in-description">
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
