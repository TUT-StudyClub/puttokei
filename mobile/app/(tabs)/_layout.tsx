import { type Href, Tabs, useRouter } from 'expo-router';
import { Path, Rect, Svg } from 'react-native-svg';

import { useAuthStore } from '@/shared/stores/authStore';

const ACTIVE_COLOR = '#4B5CFF';
const INACTIVE_COLOR = '#9CA3AF';
const SIGN_IN_ROUTE = '/(auth)/sign-in' as unknown as Href;

function TimerTabIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 2 H15"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Path
        d="M5 5 H19 V8 C19 11 15.5 12 15.5 14 C15.5 16 19 17 19 20 V23 H5 V20 C5 17 8.5 16 8.5 14 C8.5 12 5 11 5 8 Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function ReportTabIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x={3}
        y={13}
        width={4}
        height={8}
        rx={1}
        stroke={color}
        strokeWidth={1.8}
        fill="none"
      />
      <Rect
        x={10}
        y={8}
        width={4}
        height={13}
        rx={1}
        stroke={color}
        strokeWidth={1.8}
        fill="none"
      />
      <Rect
        x={17}
        y={3}
        width={4}
        height={18}
        rx={1}
        stroke={color}
        strokeWidth={1.8}
        fill="none"
      />
    </Svg>
  );
}

export default function TabsLayout() {
  const router = useRouter();
  const uid = useAuthStore((s) => s.uid);

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
        listeners={{
          tabPress: (event) => {
            // 未認証の場合はレポートを開かずサインイン画面へ誘導する
            if (uid === null) {
              event.preventDefault();
              router.push(SIGN_IN_ROUTE);
            }
          },
        }}
      />
      <Tabs.Screen name="history" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
