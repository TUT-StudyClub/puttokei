import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Path, Svg } from 'react-native-svg';
import { SizableText } from 'tamagui';

import {
  addMonthsToMonthStartKey,
  getMonthCalendarDateKeys,
  getStudiedDateKeySet,
} from '@/features/stats/lib/monthlyReport';
import { addDaysToDateKey, getDateNumberLabel, getTokyoDateKey } from '@/features/stats/lib/week';
import type { WeeklyReportResponse } from '@/features/stats/types';

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const;
const MONTH_DAY_SLOT_HEIGHT = 38;
const MONTH_DAY_ROW_GAP = 2;
const MONTH_CALENDAR_ARROW_HEIGHT = 58;

function ArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  const path = direction === 'left' ? 'M15 5 L8 12 L15 19' : 'M9 5 L16 12 L9 19';
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path
        d={path}
        stroke="#C9C9C9"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

type MonthlyCalendarProps = {
  monthStart: string;
  reports: WeeklyReportResponse[];
  onMonthChange: (monthStart: string) => void;
};

export function MonthlyCalendar({ monthStart, reports, onMonthChange }: MonthlyCalendarProps) {
  const todayKey = getTokyoDateKey();
  const monthPrefix = monthStart.slice(0, 7);
  const cells = useMemo(() => getMonthCalendarDateKeys(monthStart), [monthStart]);
  const rows = useMemo(
    () =>
      Array.from({ length: Math.ceil(cells.length / 7) }, (_value, index) =>
        cells.slice(index * 7, index * 7 + 7),
      ),
    [cells],
  );
  const studiedDateKeys = useMemo(() => getStudiedDateKeySet(reports), [reports]);
  const monthCalendarArrowTop =
    (rows.length * (MONTH_DAY_SLOT_HEIGHT + MONTH_DAY_ROW_GAP) - MONTH_CALENDAR_ARROW_HEIGHT) / 2;

  return (
    <View style={styles.monthCalendarRoot} testID="stats-month-calendar">
      <View style={styles.calendarWeekdayRow}>
        {WEEKDAY_LABELS.map((weekday) => (
          <View key={weekday} style={styles.calendarWeekdayCell}>
            <SizableText style={styles.calendarWeekdayText}>{weekday}</SizableText>
          </View>
        ))}
      </View>
      <View style={styles.monthCalendarGridWrap}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onMonthChange(addMonthsToMonthStartKey(monthStart, -1))}
          style={[
            styles.monthCalendarArrow,
            styles.monthCalendarArrowLeft,
            { top: monthCalendarArrowTop },
          ]}
          testID="month-calendar-prev"
        >
          <ArrowIcon direction="left" />
        </Pressable>
        <View style={styles.monthCalendarGrid}>
          {rows.map((row, rowIndex) => (
            <View key={`month-week-${rowIndex}`} style={styles.calendarWeekRow}>
              {row.map((dateKey, dayIndex) => {
                if (dateKey === null) {
                  return <View key={`blank-${rowIndex}-${dayIndex}`} style={styles.monthDaySlot} />;
                }

                const isStudied = studiedDateKeys.has(dateKey);
                const previousDateKey = addDaysToDateKey(dateKey, -1);
                const nextDateKey = addDaysToDateKey(dateKey, 1);
                const hasPreviousStudied = studiedDateKeys.has(previousDateKey);
                const hasNextStudied = studiedDateKeys.has(nextDateKey);
                const hasPreviousInlineStudied =
                  hasPreviousStudied && previousDateKey.startsWith(monthPrefix) && dayIndex > 0;
                const hasNextInlineStudied =
                  hasNextStudied && nextDateKey.startsWith(monthPrefix) && dayIndex < 6;
                const isStreakDay = isStudied && (hasPreviousStudied || hasNextStudied);
                const isSingleStudiedDay = isStudied && !isStreakDay;
                const isFuture = dateKey > todayKey;
                const isToday = dateKey === todayKey;
                const studiedTestSuffix = isStreakDay
                  ? 'streak'
                  : isSingleStudiedDay
                    ? 'single'
                    : 'empty';

                return (
                  <View
                    key={dateKey}
                    style={styles.monthDaySlot}
                    testID={`month-day-${dateKey}-${studiedTestSuffix}`}
                  >
                    <View
                      style={[
                        styles.monthDayMarker,
                        isStreakDay ? styles.monthDayStreakMarker : null,
                        isStreakDay && !hasPreviousInlineStudied
                          ? styles.monthDayStreakStart
                          : null,
                        isStreakDay && hasPreviousInlineStudied && hasNextInlineStudied
                          ? styles.monthDayStreakMiddle
                          : null,
                        isStreakDay && !hasNextInlineStudied ? styles.monthDayStreakEnd : null,
                        isToday ? styles.monthDayTodayMarker : null,
                      ]}
                    >
                      <SizableText
                        style={[
                          styles.monthDayText,
                          isFuture && !isStudied ? styles.monthDayMutedText : null,
                          isStudied ? styles.monthDayStudiedText : null,
                        ]}
                      >
                        {getDateNumberLabel(dateKey)}
                      </SizableText>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => onMonthChange(addMonthsToMonthStartKey(monthStart, 1))}
          style={[
            styles.monthCalendarArrow,
            styles.monthCalendarArrowRight,
            { top: monthCalendarArrowTop },
          ]}
          testID="month-calendar-next"
        >
          <ArrowIcon direction="right" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  monthCalendarRoot: {
    alignItems: 'center',
    marginTop: 18,
  },
  calendarWeekdayRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  calendarWeekdayCell: {
    width: 38,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarWeekdayText: {
    color: '#333333',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  monthCalendarGridWrap: {
    position: 'relative',
    alignSelf: 'center',
    marginTop: 10,
  },
  monthCalendarGrid: {
    alignItems: 'center',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  monthCalendarArrow: {
    position: 'absolute',
    zIndex: 2,
    width: 38,
    height: MONTH_CALENDAR_ARROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCalendarArrowLeft: {
    left: -48,
  },
  monthCalendarArrowRight: {
    right: -48,
  },
  monthDaySlot: {
    width: 38,
    height: MONTH_DAY_SLOT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: MONTH_DAY_ROW_GAP,
  },
  monthDayMarker: {
    width: 38,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthDayStreakMarker: {
    backgroundColor: '#DDE5FF',
  },
  monthDayStreakStart: {
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  monthDayStreakMiddle: {
    borderRadius: 0,
  },
  monthDayStreakEnd: {
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  monthDayTodayMarker: {
    borderWidth: 1.8,
    borderColor: '#5367FF',
    borderRadius: 6,
  },
  monthDayText: {
    color: '#333333',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  monthDayMutedText: {
    color: '#CFCFCF',
  },
  monthDayStudiedText: {
    color: '#5367FF',
  },
});
