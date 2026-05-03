import { Tabs } from 'expo-router';
import { Path, Svg } from 'react-native-svg';

const ACTIVE_COLOR = '#475FFF';
const INACTIVE_COLOR = '#9CA3AF';

const TIMER_ICON_COLOR = '#475FFF';

function TimerTabIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 39 39" fill="none">
      <Path
        d="M29.753 9.24695C32.1251 11.619 33.6014 14.7402 33.9302 18.0787C34.259 21.4172 33.4201 24.7665 31.5563 27.5558C29.6926 30.3451 26.9193 32.4018 23.7091 33.3756C20.4989 34.3494 17.0504 34.18 13.9511 32.8963C10.8518 31.6125 8.29351 29.2938 6.71214 26.3353C5.13077 23.3767 4.62415 19.9614 5.27861 16.6712C5.93307 13.381 7.70812 10.4195 10.3013 8.29135C12.8945 6.16318 16.1453 5 19.5 5"
        stroke={TIMER_ICON_COLOR}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path
        d="M19.5 19.5L29.25 9.75"
        stroke={TIMER_ICON_COLOR}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path d="M19.5 4.875V8.125" stroke={TIMER_ICON_COLOR} strokeWidth={3} strokeLinecap="round" />
      <Path
        d="M4.875 19.5L8.125 19.5"
        stroke={TIMER_ICON_COLOR}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path
        d="M19.5 30.875V34.125"
        stroke={TIMER_ICON_COLOR}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path
        d="M30.875 19.5L34.125 19.5"
        stroke={TIMER_ICON_COLOR}
        strokeWidth={3}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function ReportTabIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 39 39" fill="none">
      <Path d="M34.125 32.5H4.875" stroke={color} strokeWidth={3} strokeLinecap="round" />
      <Path
        d="M16.25 26V15C16.25 13.8954 15.3546 13 14.25 13H11.75C10.6454 13 9.75 13.8954 9.75 15V26"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path
        d="M29.25 26V8.5C29.25 7.39543 28.3546 6.5 27.25 6.5H24.75C23.6454 6.5 22.75 7.39543 22.75 8.5V26"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
      />
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
        tabBarStyle: { paddingTop: 10 },
        tabBarLabelStyle: { fontSize: 14, fontWeight: '600' },
        tabBarIconStyle: { marginBottom: 8 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'タイマー',
          tabBarIcon: () => <TimerTabIcon size={39} />,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            fontFamily: 'HiraginoSans-W6',
            color: TIMER_ICON_COLOR,
          },
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'レポート',
          tabBarIcon: () => <ReportTabIcon color="#9D9D9D" size={39} />,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            fontFamily: 'HiraginoSans-W6',
            color: '#676767',
          },
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
