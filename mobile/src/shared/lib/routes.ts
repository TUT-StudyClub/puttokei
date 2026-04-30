import type { Href } from 'expo-router';

function route(path: string): Href {
  return path as unknown as Href;
}

export const APP_ROUTES = {
  authOverview: route('/(auth)/overview'),
  authSignIn: route('/(auth)/sign-in'),
  authTutorialStepOne: route('/(auth)/tutorial-step-one'),
  authTutorialStepTwo: route('/(auth)/tutorial-step-two'),
  authTutorialStepThree: route('/(auth)/tutorial-step-three'),
  tabs: route('/(tabs)'),
  settings: route('/(tabs)/settings'),
  stats: route('/(tabs)/stats'),
} as const;

const RETURN_TO_ROUTES = new Set<string>(['/(tabs)/stats']);

export function resolveReturnToRoute(returnTo: string | undefined): Href {
  if (returnTo !== undefined && RETURN_TO_ROUTES.has(returnTo)) {
    return route(returnTo);
  }

  return APP_ROUTES.tabs;
}
