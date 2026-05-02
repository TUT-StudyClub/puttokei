import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import { WeekDateStrip } from '@/features/stats/components/WeekDateStrip';

function renderWithProvider(ui: ReactNode) {
  return render(
    <TamaguiProvider config={config} defaultTheme="light">
      {ui}
    </TamaguiProvider>,
  );
}

describe('WeekDateStrip', () => {
  afterEach(() => {
    cleanup();
  });

  it('表示領域に合わせて週ページと日付セルを縮める', () => {
    const { getByTestId } = renderWithProvider(
      <WeekDateStrip
        weekStart="2026-05-03"
        onWeekChange={jest.fn()}
        selectedDateKey="2026-05-09"
        onSelectDate={jest.fn()}
      />,
    );

    act(() => {
      fireEvent(getByTestId('week-date-strip'), 'layout', {
        nativeEvent: { layout: { width: 345, height: 58, x: 0, y: 0 } },
      });
    });

    const scrollerStyle = StyleSheet.flatten(getByTestId('week-date-scroll').props.style);
    const selectedDayStyle = StyleSheet.flatten(getByTestId('week-date-2026-05-09').props.style);

    expect(scrollerStyle.width).toBe(281);
    expect(selectedDayStyle.width).toBeCloseTo(281 / 7);
  });
});
