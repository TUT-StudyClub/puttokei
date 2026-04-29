import { render } from '@testing-library/react-native';

import StatsTab from '../stats';

jest.mock('@/features/stats/screens/StatsScreen', () => ({
  StatsScreen: () => {
    const { Text } = require('react-native');
    return <Text testID="stats-screen">stats-screen</Text>;
  },
}));

describe('StatsTab', () => {
  it('StatsScreen を描画する', () => {
    const screen = render(<StatsTab />);

    expect(screen.getByTestId('stats-screen')).toBeTruthy();
  });
});
