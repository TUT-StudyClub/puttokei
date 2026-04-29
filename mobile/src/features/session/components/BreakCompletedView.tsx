import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Circle,
  Defs,
  Ellipse,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
  Svg,
} from 'react-native-svg';
import { SizableText } from 'tamagui';

import { APP_COLORS } from '@/shared/lib/colors';

const INPUT_COLOR = APP_COLORS.input;

type HourglassGraphicProps = {
  size: number;
  rotation?: string;
  strokeColor?: string;
};

export function HourglassGraphic({
  size,
  rotation = '0deg',
  strokeColor = INPUT_COLOR,
}: HourglassGraphicProps) {
  return (
    <View
      style={[
        styles.hourglassGraphicWrap,
        {
          width: size,
          height: size * 1.18,
          transform: [{ rotate: rotation }],
        },
      ]}
    >
      <Svg width={size} height={size * 1.18} viewBox="0 0 200 236" fill="none">
        <Defs>
          <SvgLinearGradient id="sandGradient" x1="100" y1="129" x2="100" y2="191">
            <Stop offset="0" stopColor="#F4E9FF" />
            <Stop offset="1" stopColor="#B766EA" />
          </SvgLinearGradient>
          <SvgLinearGradient id="glassShade" x1="100" y1="48" x2="100" y2="123">
            <Stop offset="0" stopColor="#F0F0F0" />
            <Stop offset="1" stopColor="#FFFFFF" />
          </SvgLinearGradient>
        </Defs>
        <Path
          d="M43 18 H157 V43 C157 65 130 76 125 100 C120 124 157 139 157 164 V214 H43 V164 C43 139 80 124 75 100 C70 76 43 65 43 43 Z"
          fill="#FFFFFF"
          stroke="#FFFFFF"
          strokeWidth={18}
          strokeLinejoin="round"
        />
        <Path
          d="M43 18 H157 V43 C157 65 130 76 125 100 C120 124 157 139 157 164 V214 H43 V164 C43 139 80 124 75 100 C70 76 43 65 43 43 Z"
          fill="#FFFFFF"
          stroke={strokeColor}
          strokeWidth={8}
          strokeLinejoin="round"
        />
        <Path
          d="M64 62 C78 49 122 49 136 62 C132 82 114 96 103 109 C101 111 99 111 97 109 C86 96 68 82 64 62 Z"
          fill="url(#glassShade)"
        />
        <Path
          d="M96 109 C94 118 89 126 82 133 C93 129 107 129 118 133 C111 126 106 118 104 109 Z"
          fill="#F4F4F4"
        />
        <Path
          d="M64 173 C72 145 86 131 100 131 C114 131 128 145 136 173 C123 192 77 192 64 173 Z"
          fill="url(#sandGradient)"
        />
        <Ellipse cx={100} cy={72} rx={42} ry={21} fill="#EFEFEF" opacity={0.78} />
      </Svg>
    </View>
  );
}

const CONFETTI_PIECES = [
  { left: '0%', top: 18, width: 5, height: 10, color: '#DCE6FF', rotate: '-18deg' },
  { left: '8%', top: 50, width: 6, height: 10, color: '#F9CFD9', rotate: '8deg' },
  { left: '2%', top: 88, width: 5, height: 11, color: '#F6D7D2', rotate: '-7deg' },
  { left: '12%', top: 126, width: 5, height: 10, color: '#DCEBEE', rotate: '-34deg' },
  { left: '6%', top: 158, width: 8, height: 5, color: '#DDE5FF', rotate: '-3deg' },
  { left: '16%', top: 178, width: 6, height: 10, color: '#F7CDD8', rotate: '14deg' },
  { left: '21%', top: 28, width: 5, height: 11, color: '#F6D7D2', rotate: '-14deg' },
  { left: '18%', top: 72, width: 11, height: 6, color: '#DDF0F3', rotate: '-9deg' },
  { left: '24%', top: 148, width: 9, height: 5, color: '#DDE5FF', rotate: '2deg' },
  { left: '36%', top: 0, width: 10, height: 5, color: '#DDF0F3', rotate: '-9deg' },
  { left: '50%', top: 4, width: 6, height: 11, color: '#F7CDD8', rotate: '9deg' },
  { left: '64%', top: 0, width: 9, height: 5, color: '#DDE5FF', rotate: '5deg' },
  { left: '34%', top: 186, width: 9, height: 5, color: '#DDE5FF', rotate: '-5deg' },
  { left: '52%', top: 188, width: 5, height: 9, color: '#DDEBEE', rotate: '76deg' },
  { left: '66%', top: 184, width: 10, height: 5, color: '#F7CDD8', rotate: '9deg' },
  { left: '95%', top: 28, width: 5, height: 9, color: '#D9E3FF', rotate: '-22deg' },
  { left: '86%', top: 62, width: 7, height: 11, color: '#F9CFD9', rotate: '12deg' },
  { left: '92%', top: 98, width: 6, height: 10, color: '#F7CDD8', rotate: '10deg' },
  { left: '98%', top: 132, width: 5, height: 9, color: '#DDEBEE', rotate: '76deg' },
  { left: '86%', top: 166, width: 10, height: 5, color: '#DDF0F3', rotate: '7deg' },
  { left: '94%', top: 184, width: 10, height: 5, color: '#F7CDD8', rotate: '9deg' },
  { left: '78%', top: 36, width: 8, height: 11, color: '#F7CDD8', rotate: '12deg' },
  { left: '81%', top: 84, width: 9, height: 5, color: '#DDE5FF', rotate: '0deg' },
  { left: '78%', top: 142, width: 5, height: 10, color: '#DCEBEE', rotate: '15deg' },
] as const;

function ConfettiBurst() {
  return (
    <View style={styles.confettiLayer} pointerEvents="none">
      {CONFETTI_PIECES.map((piece, index) => (
        <View
          key={index}
          style={[
            styles.confettiPiece,
            {
              left: piece.left,
              top: piece.top,
              width: piece.width,
              height: piece.height,
              backgroundColor: piece.color,
              transform: [{ rotate: piece.rotate }],
            },
          ]}
        />
      ))}
      <Svg width={26} height={26} viewBox="0 0 36 36" style={styles.confettiSmile}>
        <Circle cx={18} cy={18} r={12} stroke="#FFFFFF" strokeWidth={3} fill="none" />
        <Circle cx={14} cy={15} r={1.8} fill="#FFFFFF" />
        <Circle cx={22} cy={15} r={1.8} fill="#FFFFFF" />
        <Path
          d="M13 21 C15.6 25 20.4 25 23 21"
          stroke="#FFFFFF"
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
      <Svg width={28} height={34} viewBox="0 0 28 34" style={styles.confettiBulb}>
        <Path
          d="M14 2 C7.8 2 4 6.2 4 11.2 C4 14.5 5.7 16.7 8.1 19.2 C9.2 20.4 9.8 21.8 9.8 23.2 H18.2 C18.2 21.8 18.8 20.4 19.9 19.2 C22.3 16.7 24 14.5 24 11.2 C24 6.2 20.2 2 14 2 Z"
          stroke="#FFFFFF"
          strokeWidth={3}
          strokeLinejoin="round"
          fill="none"
        />
        <Path d="M10 27 H18" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
        <Path d="M11 32 H17" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
      </Svg>
      <Svg width={28} height={28} viewBox="0 0 38 38" style={styles.confettiStarLeft}>
        <Path
          d="M19 4 L23 15 L34 15 L25 22 L29 34 L19 27 L9 34 L13 22 L4 15 L15 15 Z"
          stroke="#FFFFFF"
          strokeWidth={3}
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
      <Svg width={30} height={30} viewBox="0 0 42 42" style={styles.confettiStarRight}>
        <Path
          d="M21 5 L25 16 L36 16 L27 23 L31 36 L21 29 L11 36 L15 23 L6 16 L17 16 Z"
          stroke="#FFFFFF"
          strokeWidth={3}
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

function CompletionSticker() {
  return (
    <View style={styles.stickerStage}>
      <ConfettiBurst />
      <HourglassGraphic size={118} rotation="17deg" />
    </View>
  );
}

type BreakCompletedViewProps = {
  currentLoop: number;
  onNextCycle: () => void;
};

export function BreakCompletedView({ currentLoop, onNextCycle }: BreakCompletedViewProps) {
  return (
    <View style={styles.completedContent} testID="break-completed-view">
      <View style={styles.completedStack}>
        <ExpoLinearGradient
          colors={['#FF5DA2', '#5A6BFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.completedGradientBorder}
        >
          <View style={styles.completedWhiteBorder}>
            <View style={styles.completedCard} testID="break-complete-card">
              <SizableText style={styles.completedTitle}>お疲れ様でした！</SizableText>
              <SizableText style={styles.completedTitle}>
                記念すべき{currentLoop}サイクル目です！
              </SizableText>

              <CompletionSticker />

              <Pressable
                accessibilityRole="button"
                onPress={onNextCycle}
                style={({ pressed }) => [
                  styles.nextCycleButton,
                  pressed ? styles.buttonPressed : null,
                ]}
                testID="break-next-cycle-button"
              >
                <SizableText style={styles.nextCycleButtonText}>次のサイクルへ</SizableText>
              </Pressable>
            </View>
          </View>
        </ExpoLinearGradient>

        <View style={styles.resultNoticeCard}>
          <SizableText style={styles.resultNoticeText}>結果を確認できます。</SizableText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  completedContent: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 8,
    paddingBottom: 8,
  },
  completedStack: {
    alignItems: 'center',
    width: '100%',
  },
  completedGradientBorder: {
    zIndex: 1,
    width: '87%',
    borderRadius: 24,
    padding: 8,
  },
  completedWhiteBorder: {
    width: '100%',
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  completedCard: {
    alignItems: 'center',
    width: '100%',
    minHeight: 348,
    paddingTop: 30,
    paddingRight: 18,
    paddingBottom: 24,
    paddingLeft: 18,
    borderRadius: 16,
    backgroundColor: '#303133',
    overflow: 'hidden',
  },
  completedTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 26,
    textAlign: 'center',
  },
  stickerStage: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 196,
    marginTop: 10,
    marginBottom: 14,
    overflow: 'hidden',
  },
  hourglassGraphicWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  confettiLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  confettiPiece: {
    position: 'absolute',
    borderRadius: 3,
  },
  confettiSmile: {
    position: 'absolute',
    top: 30,
    left: '10%',
  },
  confettiBulb: {
    position: 'absolute',
    top: 72,
    right: '7%',
  },
  confettiStarLeft: {
    position: 'absolute',
    top: 120,
    left: '5%',
  },
  confettiStarRight: {
    position: 'absolute',
    top: 132,
    right: '8%',
  },
  nextCycleButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 190,
    height: 56,
    paddingHorizontal: 22,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 16,
  },
  nextCycleButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
  },
  resultNoticeCard: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '76%',
    minHeight: 56,
    marginTop: -14,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    borderRadius: 14,
    backgroundColor: '#303133',
  },
  resultNoticeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },
  buttonPressed: {
    opacity: 0.72,
  },
});
