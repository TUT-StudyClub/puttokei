import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Path, Svg } from 'react-native-svg';
import { SizableText } from 'tamagui';

import {
  addDaysToDateKey,
  getDateNumberLabel,
  getTokyoDateKey,
  getWeekDateKeys,
  parseDateKey,
} from '@/features/stats/lib/week';

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const;

type Props = {
  weekStart: string;
  onWeekChange: (weekStart: string) => void;
  selectedDateKey: string;
  onSelectDate: (dateKey: string) => void;
};

function ArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  const path = direction === 'left' ? 'M15 5 L8 12 L15 19' : 'M9 5 L16 12 L9 19';
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
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

export function WeekDateStrip({ weekStart, onWeekChange, selectedDateKey, onSelectDate }: Props) {
  const scrollRef = useRef<ScrollView | null>(null);
  const { width } = useWindowDimensions();
  const pageWidth = Math.max(252, width - 96);
  const todayKey = getTokyoDateKey();
  const pages = useMemo(
    () => [addDaysToDateKey(weekStart, -7), weekStart, addDaysToDateKey(weekStart, 7)],
    [weekStart],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ x: pageWidth, y: 0, animated: false });
  }, [pageWidth, weekStart]);

  const handleShiftWeek = useCallback(
    (days: number) => {
      onWeekChange(addDaysToDateKey(weekStart, days));
    },
    [onWeekChange, weekStart],
  );

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      if (offsetX < pageWidth * 0.5) {
        handleShiftWeek(-7);
        return;
      }
      if (offsetX > pageWidth * 1.5) {
        handleShiftWeek(7);
        return;
      }
      scrollRef.current?.scrollTo({ x: pageWidth, y: 0, animated: true });
    },
    [handleShiftWeek, pageWidth],
  );

  return (
    <View style={styles.root} testID="week-date-strip">
      <Pressable
        accessibilityRole="button"
        onPress={() => handleShiftWeek(-7)}
        style={styles.arrowButton}
        testID="week-date-prev"
      >
        <ArrowIcon direction="left" />
      </Pressable>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={pageWidth}
        decelerationRate="fast"
        contentOffset={{ x: pageWidth, y: 0 }}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        style={[styles.scroller, { width: pageWidth }]}
        testID="week-date-scroll"
      >
        {pages.map((pageStart) => (
          <View key={pageStart} style={[styles.page, { width: pageWidth }]}>
            {getWeekDateKeys(pageStart).map((dateKey) => {
              const date = parseDateKey(dateKey);
              const isToday = dateKey === todayKey;
              const isSelected = dateKey === selectedDateKey;
              const weekdayLabel = WEEKDAY_LABELS[date.getDay()] ?? '';
              return (
                <Pressable
                  key={dateKey}
                  accessibilityRole="button"
                  onPress={() => onSelectDate(dateKey)}
                  style={[
                    styles.dayCell,
                    isSelected ? styles.dayCellSelected : null,
                    isToday && !isSelected ? styles.dayCellToday : null,
                  ]}
                  testID={`week-date-${dateKey}`}
                >
                  <SizableText
                    style={[
                      styles.dayNumber,
                      isSelected ? styles.dayTextSelected : null,
                      isToday && !isSelected ? styles.dayTextToday : null,
                    ]}
                  >
                    {getDateNumberLabel(dateKey)}
                  </SizableText>
                  <SizableText
                    style={[
                      styles.weekday,
                      isSelected ? styles.dayTextSelected : null,
                      isToday && !isSelected ? styles.dayTextToday : null,
                    ]}
                  >
                    {weekdayLabel}
                  </SizableText>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        onPress={() => handleShiftWeek(7)}
        style={styles.arrowButton}
        testID="week-date-next"
      >
        <ArrowIcon direction="right" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrowButton: {
    width: 32,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroller: {
    flexGrow: 0,
  },
  page: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayCell: {
    width: 43,
    height: 58,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dayCellSelected: {
    backgroundColor: '#4B5CFF',
    borderColor: '#4B5CFF',
    borderWidth: 1.5,
  },
  dayCellToday: {
    backgroundColor: '#DDE5FF',
    borderColor: '#4B5CFF',
    borderWidth: 1.5,
  },
  dayNumber: {
    color: '#333333',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 22,
  },
  weekday: {
    color: '#B8B8B8',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 16,
  },
  dayTextSelected: {
    color: '#FFFFFF',
  },
  dayTextToday: {
    color: '#4B5CFF',
  },
});
