import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
      <Stack.Screen name="overview" options={{ animation: 'fade' }} />
      <Stack.Screen name="tutorial-step-one" options={{ animation: 'fade' }} />
      <Stack.Screen name="tutorial-step-two" options={{ animation: 'fade' }} />
      <Stack.Screen name="tutorial-step-three" options={{ animation: 'fade' }} />
      <Stack.Screen name="sign-in" options={{ animation: 'none' }} />
    </Stack>
  );
}
