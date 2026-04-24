import { Redirect } from 'expo-router';

import { StatsScreen } from '@/features/stats/screens/StatsScreen';
import { useAuthStore } from '@/shared/stores/authStore';

export default function StatsTab() {
  const uid = useAuthStore((s) => s.uid);

  if (uid === null) {
    return (
      <Redirect
        href={{
          pathname: '/(auth)/sign-in',
          params: { returnTo: '/(tabs)/stats' },
        }}
      />
    );
  }

  return <StatsScreen />;
}
