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

  it('選択日を中央に表示し、未学習の選択日は枠だけ、学習済み日は指定色で表示する', () => {
    const { getByTestId } = renderWithProvider(
      <WeekDateStrip
        weekStart="2026-05-10"
        onWeekChange={jest.fn()}
        selectedDateKey="2026-05-13"
        studiedDateKeys={['2026-05-12']}
        onSelectDate={jest.fn()}
      />,
    );

    const currentPageChildren = getByTestId('week-date-page-2026-05-13').props.children;
    const selectedBackgroundStyle = StyleSheet.flatten(
      getByTestId('week-date-2026-05-13-selected-background').props.style,
    );
    const studiedBackgroundStyle = StyleSheet.flatten(
      getByTestId('week-date-2026-05-12-studied-background').props.style,
    );

    expect(currentPageChildren[3].props.testID).toBe('week-date-2026-05-13');
    expect(currentPageChildren).toHaveLength(7);
    expect(selectedBackgroundStyle.left).toBe(-3);
    expect(selectedBackgroundStyle.right).toBe(-3);
    expect(selectedBackgroundStyle.backgroundColor).toBeUndefined();
    expect(selectedBackgroundStyle.borderColor).toBe('#475FFF');
    expect(selectedBackgroundStyle.borderWidth).toBe(3);
    expect(studiedBackgroundStyle.backgroundColor).toBe('#DBE3FF');
  });
});
