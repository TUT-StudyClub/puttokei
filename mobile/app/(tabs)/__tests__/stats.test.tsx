import { render } from '@testing-library/react-native';

import StatsTab from '../stats';

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require('react-native');
    return <Text testID="stats-redirect">{href}</Text>;
  },
}));

jest.mock('@/features/stats/screens/StatsScreen', () => ({
  StatsScreen: () => {
    const { Text } = require('react-native');
    return <Text testID="stats-screen">stats-screen</Text>;
  },
}));

const originalDev = __DEV__;

describe('StatsTab', () => {
  afterEach(() => {
    Object.defineProperty(global, '__DEV__', {
      configurable: true,
      value: originalDev,
    });
  });

  it('ローカル開発時は sign-in へリダイレクトする', () => {
    Object.defineProperty(global, '__DEV__', {
      configurable: true,
      value: true,
    });

    const screen = render(<StatsTab />);

    expect(screen.getByText('/(auth)/sign-in')).toBeTruthy();
  });

  it('ローカル開発以外では StatsScreen を表示する', () => {
    Object.defineProperty(global, '__DEV__', {
      configurable: true,
      value: false,
    });

    const screen = render(<StatsTab />);

    expect(screen.getByTestId('stats-screen')).toBeTruthy();
  });
});
