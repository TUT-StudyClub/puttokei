import { useCallback, useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
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
  parseDateKey,
} from '@/features/stats/lib/week';

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const;
export const WEEK_DATE_STRIP_ARROW_BUTTON_WIDTH = 32;
export const WEEK_DATE_STRIP_DAY_CELL_MAX_WIDTH = 43;
export const WEEK_DATE_STRIP_HORIZONTAL_INSET = 24;

type Props = {
  weekStart: string;
  onWeekChange: (weekStart: string) => void;
  selectedDateKey: string;
  onSelectDate: (dateKey: string) => void;
  studiedDateKeys?: readonly string[];
};

function ArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  const path = direction === 'left' ? 'M15 5 L8 12 L15 19' : 'M9 5 L16 12 L9 19';
  const preserveAspectRatio = direction === 'left' ? 'xMinYMid meet' : 'xMaxYMid meet';
  return (
    <Svg width={200} height={24} viewBox="0 0 24 24" fill="none" preserveAspectRatio={preserveAspectRatio}>
      <Path
        d={path}
        stroke="#C9C9C9"
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function getCenteredDateKeys(centerDateKey: string): string[] {
  return Array.from({ length: 7 }, (_value, index) => addDaysToDateKey(centerDateKey, index - 3));
}

export function WeekDateStrip({
  weekStart,
  onWeekChange,
  selectedDateKey,
  onSelectDate,
  studiedDateKeys = [],
}: Props) {
  const { width } = useWindowDimensions();
  const [stripWidth, setStripWidth] = useState(0);
  const fallbackStripWidth = Math.max(0, width - WEEK_DATE_STRIP_HORIZONTAL_INSET * 2);
  const resolvedStripWidth = stripWidth > 0 ? stripWidth : fallbackStripWidth;
  const pageWidth = Math.max(0, resolvedStripWidth - WEEK_DATE_STRIP_ARROW_BUTTON_WIDTH * 2);
  const dayCellWidth = Math.min(WEEK_DATE_STRIP_DAY_CELL_MAX_WIDTH, pageWidth / 7);
  const todayKey = getTokyoDateKey();
  const studiedDateKeySet = useMemo(() => new Set(studiedDateKeys), [studiedDateKeys]);
  const centeredDateKeys = useMemo(() => getCenteredDateKeys(selectedDateKey), [selectedDateKey]);

  const handleShiftWeek = useCallback(
    (days: number) => {
      onWeekChange(addDaysToDateKey(weekStart, days));
    },
    [onWeekChange, weekStart],
  );

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setStripWidth(event.nativeEvent.layout.width);
  }, []);

  return (
    <View onLayout={handleLayout} style={styles.root} testID="week-date-strip">
      <Pressable
        accessibilityRole="button"
        hitSlop={{ left: 18, right: 18, top: 8, bottom: 8 }}
        onPress={() => handleShiftWeek(-7)}
        style={[styles.arrowButton, styles.arrowButtonLeft]}
        testID="week-date-prev"
      >
        <ArrowIcon direction="left" />
      </Pressable>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={pageWidth}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: 0 }}
        style={[styles.scroller, { width: pageWidth }]}
        testID="week-date-scroll"
      >
        <View
          key={selectedDateKey}
          style={[styles.page, { width: pageWidth }]}
          testID={`week-date-page-${selectedDateKey}`}
        >
          {centeredDateKeys.map((dateKey) => {
            const date = parseDateKey(dateKey);
            const isToday = dateKey === todayKey;
            const isSelected = dateKey === selectedDateKey;
            const isStudied = studiedDateKeySet.has(dateKey);
            const weekdayLabel = WEEKDAY_LABELS[date.getDay()] ?? '';
            return (
              <Pressable
                key={dateKey}
                accessibilityRole="button"
                onPress={() => onSelectDate(dateKey)}
                style={[
                  styles.dayCell,
                  { width: dayCellWidth },
                  isToday && !isSelected && !isStudied ? styles.dayCellToday : null,
                ]}
                testID={`week-date-${dateKey}`}
              >
                {isSelected || isStudied ? (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.dayCellStatusBackground,
                      isStudied ? styles.dayCellStudiedBackground : null,
                      isSelected ? styles.dayCellSelectedBackground : null,
                    ]}
                    testID={
                      isSelected
                        ? `week-date-${dateKey}-selected-background`
                        : `week-date-${dateKey}-studied-background`
                    }
                  />
                ) : null}
                <SizableText
                  style={[
                    styles.dayNumber,
                    isSelected || isStudied ? styles.dayTextHighlighted : null,
                    isToday && !isSelected && !isStudied ? styles.dayTextToday : null,
                  ]}
                >
                  {getDateNumberLabel(dateKey)}
                </SizableText>
                <SizableText
                  style={[
                    styles.weekday,
                    isSelected || isStudied ? styles.dayTextHighlighted : null,
                    isToday && !isSelected && !isStudied ? styles.dayTextToday : null,
                  ]}
                >
                  {weekdayLabel}
                </SizableText>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        hitSlop={{ left: 18, right: 18, top: 8, bottom: 8 }}
        onPress={() => handleShiftWeek(7)}
        style={[styles.arrowButton, styles.arrowButtonRight]}
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
    width: WEEK_DATE_STRIP_ARROW_BUTTON_WIDTH,
    height: 52,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  arrowButtonLeft: {
    alignItems: 'flex-start',
  },
  arrowButtonRight: {
    alignItems: 'flex-end',
  },
  scroller: {
    flexGrow: 0,
    overflow: 'visible',
  },
  page: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'visible',
  },
  dayCell: {
    width: 43,
    height: 58,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    overflow: 'visible',
  },
  dayCellStatusBackground: {
    position: 'absolute',
    left: -3,
    right: -3,
    bottom: -1,
    height: 62,
    borderRadius: 6,
  },
  dayCellStudiedBackground: {
    backgroundColor: '#DBE3FF',
  },
  dayCellSelectedBackground: {
    borderColor: '#475FFF',
    borderWidth: 3,
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
  dayTextHighlighted: {
    color: '#475FFF',
    fontFamily: 'HiraginoSans-W6',
  },
  dayTextToday: {
    color: '#4B5CFF',
  },
});
