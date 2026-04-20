import { Tabs } from 'expo-router';
import { Circle, Path, Svg } from 'react-native-svg';

const ACTIVE_COLOR = '#4B5CFF';
const INACTIVE_COLOR = '#9CA3AF';

function TimerTabIcon({ color, size = 24 }: { color: string; size?: number }) {
  // 時計風: 円形の文字盤 + 短針 (12時方向) + 長針 (3時方向)
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.8} fill="none" />
      <Path d="M12 12 L12 7" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M12 12 L16 12" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function ReportTabIcon({ color, size = 24 }: { color: string; size?: number }) {
  // 棒グラフ風: 低い棒 + 高い棒を近接配置
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 20 V14 H12 V20"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M12 20 V8 H16 V20"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
      <Path d="M4 20 H20" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'none',
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'タイマー',
          tabBarIcon: ({ color }) => <TimerTabIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'レポート',
          tabBarIcon: ({ color }) => <ReportTabIcon color={color} />,
        }}
      />
      <Tabs.Screen name="history" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="session/[id]/input" options={{ href: null }} />
      <Tabs.Screen name="session/[id]/output" options={{ href: null }} />
      <Tabs.Screen name="session/[id]/break" options={{ href: null }} />
      <Tabs.Screen name="session/[id]/result" options={{ href: null }} />
    </Tabs>
  );
}
