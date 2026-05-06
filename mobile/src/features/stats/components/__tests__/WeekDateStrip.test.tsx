import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import {
  WEEK_DATE_STRIP_ARROW_BUTTON_WIDTH,
  WEEK_DATE_STRIP_HORIZONTAL_OUTSET,
  WEEK_DATE_STRIP_LAYOUT_GUTTER_WIDTH,
  WEEK_DATE_STRIP_STATUS_BACKGROUND_SELECTED_OVERLAP,
  WeekDateStrip,
} from '@/features/stats/components/WeekDateStrip';

function renderWithProvider(ui: ReactNode) {
  return render(
    <TamaguiProvider config={config} defaultTheme="light">
      {ui}
    </TamaguiProvider>,
  );
}

describe('WeekDateStrip', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-04T00:00:00Z'));
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
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

    const expectedPageWidth = 345 - WEEK_DATE_STRIP_LAYOUT_GUTTER_WIDTH * 2;
    const scrollerStyle = StyleSheet.flatten(getByTestId('week-date-scroll').props.style);
    const stripStyle = StyleSheet.flatten(getByTestId('week-date-strip').props.style);
    const prevArrowSlotStyle = StyleSheet.flatten(getByTestId('week-date-prev-slot').props.style);
    const nextArrowSlotStyle = StyleSheet.flatten(getByTestId('week-date-next-slot').props.style);
    const prevArrowStyle = StyleSheet.flatten(getByTestId('week-date-prev').props.style);
    const nextArrowStyle = StyleSheet.flatten(getByTestId('week-date-next').props.style);
    const selectedDay = getByTestId('week-date-2026-05-09');
    const selectedDayStyle = StyleSheet.flatten(selectedDay.props.style);
    const dayNumberStyle = StyleSheet.flatten(
      getByTestId('week-date-2026-05-09-number').props.style,
    );
    const weekdayStyle = StyleSheet.flatten(
      getByTestId('week-date-2026-05-09-weekday').props.style,
    );

    expect(stripStyle.marginHorizontal).toBe(-WEEK_DATE_STRIP_HORIZONTAL_OUTSET);
    expect(prevArrowSlotStyle.width).toBe(WEEK_DATE_STRIP_LAYOUT_GUTTER_WIDTH);
    expect(prevArrowSlotStyle.alignItems).toBe('center');
    expect(nextArrowSlotStyle.width).toBe(WEEK_DATE_STRIP_LAYOUT_GUTTER_WIDTH);
    expect(nextArrowSlotStyle.alignItems).toBe('center');
    expect(prevArrowStyle.width).toBe(WEEK_DATE_STRIP_ARROW_BUTTON_WIDTH);
    expect(nextArrowStyle.width).toBe(WEEK_DATE_STRIP_ARROW_BUTTON_WIDTH);
    expect(scrollerStyle.width).toBe(expectedPageWidth);
    expect(selectedDayStyle.width).toBeCloseTo(expectedPageWidth / 7);
    expect(dayNumberStyle.fontFamily).toBe('HiraginoSans-W6');
    expect(dayNumberStyle.fontWeight).toBe('700');
    expect(weekdayStyle.fontFamily).toBe('HiraginoSans-W6');
    expect(weekdayStyle.fontWeight).toBe('700');
  });

  it('日付と曜日は学習済みを青、未来日をグレー、それ以外を黒で表示する', () => {
    const { getByTestId } = renderWithProvider(
      <WeekDateStrip
        weekStart="2026-05-03"
        onWeekChange={jest.fn()}
        selectedDateKey="2026-05-04"
        studiedDateKeys={['2026-05-03']}
        onSelectDate={jest.fn()}
      />,
    );

    const pastNumberStyle = StyleSheet.flatten(
      getByTestId('week-date-2026-05-02-number').props.style,
    );
    const pastWeekdayStyle = StyleSheet.flatten(
      getByTestId('week-date-2026-05-02-weekday').props.style,
    );
    const todayNumberStyle = StyleSheet.flatten(
      getByTestId('week-date-2026-05-04-number').props.style,
    );
    const futureNumberStyle = StyleSheet.flatten(
      getByTestId('week-date-2026-05-05-number').props.style,
    );
    const futureWeekdayStyle = StyleSheet.flatten(
      getByTestId('week-date-2026-05-05-weekday').props.style,
    );
    const studiedNumberStyle = StyleSheet.flatten(
      getByTestId('week-date-2026-05-03-number').props.style,
    );
    const studiedWeekdayStyle = StyleSheet.flatten(
      getByTestId('week-date-2026-05-03-weekday').props.style,
    );

    expect(pastNumberStyle.color).toBe('#333333');
    expect(pastWeekdayStyle.color).toBe('#333333');
    expect(todayNumberStyle.color).toBe('#333333');
    expect(futureNumberStyle.color).toBe('#B8B8B8');
    expect(futureWeekdayStyle.color).toBe('#B8B8B8');
    expect(studiedNumberStyle.color).toBe('#475FFF');
    expect(studiedWeekdayStyle.color).toBe('#475FFF');
  });

  it('今日は特別表示せず、未学習の選択日も青枠で表示する', () => {
    const { getByTestId } = renderWithProvider(
      <WeekDateStrip
        weekStart="2026-05-03"
        onWeekChange={jest.fn()}
        selectedDateKey="2026-05-06"
        studiedDateKeys={['2026-05-03']}
        onSelectDate={jest.fn()}
      />,
    );

    const todayStyle = StyleSheet.flatten(getByTestId('week-date-2026-05-04').props.style);
    const selectedBackgroundStyle = StyleSheet.flatten(
      getByTestId('week-date-2026-05-06-selected-background').props.style,
    );

    expect(todayStyle.backgroundColor).toBeUndefined();
    expect(todayStyle.borderColor).toBeUndefined();
    expect(todayStyle.borderWidth).toBeUndefined();
    expect(selectedBackgroundStyle.backgroundColor).toBeUndefined();
    expect(selectedBackgroundStyle.borderColor).toBe('#475FFF');
    expect(selectedBackgroundStyle.borderWidth).toBe(3);
    expect(selectedBackgroundStyle.top).toBe(0);
    expect(selectedBackgroundStyle.bottom).toBe(0);
  });

  it('選択日の強調を無効にすると青枠を表示しない', () => {
    const { getByTestId, queryByTestId } = renderWithProvider(
      <WeekDateStrip
        weekStart="2026-05-03"
        onWeekChange={jest.fn()}
        selectedDateKey="2026-05-06"
        studiedDateKeys={['2026-05-06']}
        onSelectDate={jest.fn()}
        showSelectedDateHighlight={false}
      />,
    );

    const studiedBackgroundStyle = StyleSheet.flatten(
      getByTestId('week-date-2026-05-06-studied-background').props.style,
    );

    expect(queryByTestId('week-date-2026-05-06-selected-background')).toBeNull();
    expect(studiedBackgroundStyle.backgroundColor).toBe('#DBE3FF');
    expect(studiedBackgroundStyle.borderColor).toBeUndefined();
    expect(studiedBackgroundStyle.borderWidth).toBeUndefined();
  });

  it('未学習の選択日は中央に表示し、隣の学習済み日を枠の下へ重ねる', () => {
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
    const previousStudiedBackgroundStyle = StyleSheet.flatten(
      getByTestId('week-date-2026-05-12-studied-background').props.style,
    );

    expect(currentPageChildren[3].props.testID).toBe('week-date-2026-05-13');
    expect(currentPageChildren).toHaveLength(7);
    expect(selectedBackgroundStyle.left).toBe(0);
    expect(selectedBackgroundStyle.right).toBe(0);
    expect(selectedBackgroundStyle.top).toBe(0);
    expect(selectedBackgroundStyle.bottom).toBe(0);
    expect(selectedBackgroundStyle.backgroundColor).toBeUndefined();
    expect(selectedBackgroundStyle.borderColor).toBe('#475FFF');
    expect(selectedBackgroundStyle.borderWidth).toBe(3);
    expect(previousStudiedBackgroundStyle.left).toBe(0);
    expect(previousStudiedBackgroundStyle.right).toBe(
      -WEEK_DATE_STRIP_STATUS_BACKGROUND_SELECTED_OVERLAP,
    );
    expect(previousStudiedBackgroundStyle.top).toBe(0);
    expect(previousStudiedBackgroundStyle.bottom).toBe(0);
    expect(previousStudiedBackgroundStyle.backgroundColor).toBe('#DBE3FF');
  });

  it('学習済みの選択日は青枠にし、隣の学習済み日を枠の下へ重ねる', () => {
    const { getByTestId } = renderWithProvider(
      <WeekDateStrip
        weekStart="2026-05-10"
        onWeekChange={jest.fn()}
        selectedDateKey="2026-05-13"
        studiedDateKeys={['2026-05-12', '2026-05-13']}
        onSelectDate={jest.fn()}
      />,
    );

    const selectedBackgroundStyle = StyleSheet.flatten(
      getByTestId('week-date-2026-05-13-selected-background').props.style,
    );
    const previousStudiedBackgroundStyle = StyleSheet.flatten(
      getByTestId('week-date-2026-05-12-studied-background').props.style,
    );

    expect(selectedBackgroundStyle.backgroundColor).toBe('#DBE3FF');
    expect(selectedBackgroundStyle.borderColor).toBe('#475FFF');
    expect(selectedBackgroundStyle.borderWidth).toBe(3);
    expect(selectedBackgroundStyle.top).toBe(0);
    expect(selectedBackgroundStyle.bottom).toBe(0);
    expect(previousStudiedBackgroundStyle.left).toBe(0);
    expect(previousStudiedBackgroundStyle.right).toBe(
      -WEEK_DATE_STRIP_STATUS_BACKGROUND_SELECTED_OVERLAP,
    );
    expect(previousStudiedBackgroundStyle.top).toBe(0);
    expect(previousStudiedBackgroundStyle.bottom).toBe(0);
  });

  it('選択日の翌日が学習済みの場合も選択枠の下へ重ねる', () => {
    const { getByTestId } = renderWithProvider(
      <WeekDateStrip
        weekStart="2026-05-10"
        onWeekChange={jest.fn()}
        selectedDateKey="2026-05-13"
        studiedDateKeys={['2026-05-13', '2026-05-14']}
        onSelectDate={jest.fn()}
      />,
    );

    const nextStudiedBackgroundStyle = StyleSheet.flatten(
      getByTestId('week-date-2026-05-14-studied-background').props.style,
    );

    expect(nextStudiedBackgroundStyle.left).toBe(
      -WEEK_DATE_STRIP_STATUS_BACKGROUND_SELECTED_OVERLAP,
    );
    expect(nextStudiedBackgroundStyle.right).toBe(0);
    expect(nextStudiedBackgroundStyle.top).toBe(0);
    expect(nextStudiedBackgroundStyle.bottom).toBe(0);
    expect(nextStudiedBackgroundStyle.backgroundColor).toBe('#DBE3FF');
  });
});
