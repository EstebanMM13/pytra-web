package com.estebanmm13.pytra;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.TimeZone;
import org.junit.Test;

public class DailyUsageCalculatorTest {

    private static final TimeZone MADRID = TimeZone.getTimeZone("Europe/Madrid");
    private static final String GAME = "com.example.game";
    private static final long MINUTE = 60_000L;
    /** 2026-11-01 00:00 in Madrid (UTC+1). */
    private static final long NOV_1 = DailyUsageCalculator.parseDayStart("2026-11-01", MADRID);
    private static final long NOV_3 = DailyUsageCalculator.parseDayStart("2026-11-03", MADRID);

    private DailyUsageCalculator calculator() {
        return new DailyUsageCalculator(MADRID, NOV_1, NOV_3, new HashSet<>(Arrays.asList(GAME)));
    }

    @Test
    public void parseDayStartUsesTheZonesMidnight() {
        assertEquals(1_793_487_600_000L, NOV_1); // 2026-10-31T23:00:00Z
        assertEquals(-1, DailyUsageCalculator.parseDayStart("2026-13-01", MADRID));
        assertEquals(-1, DailyUsageCalculator.parseDayStart("01/11/2026", MADRID));
    }

    @Test
    public void sumsTheSessionsOfADay() {
        DailyUsageCalculator calculator = calculator();
        calculator.onEvent(GAME, true, NOV_1 + 10 * 60 * MINUTE);
        calculator.onEvent(GAME, false, NOV_1 + 10 * 60 * MINUTE + 30 * MINUTE);
        calculator.onEvent(GAME, true, NOV_1 + 20 * 60 * MINUTE);
        calculator.onEvent(GAME, false, NOV_1 + 20 * 60 * MINUTE + 45 * MINUTE + 59_999);

        List<DailyUsageCalculator.DayUsage> days = calculator.result();

        assertEquals(1, days.size());
        assertEquals("2026-11-01", days.get(0).date);
        assertEquals(GAME, days.get(0).packageName);
        assertEquals(75, days.get(0).minutes);
    }

    @Test
    public void aSessionOverMidnightIsSplitBetweenBothDays() {
        DailyUsageCalculator calculator = calculator();
        long midnight = NOV_1 + 24 * 60 * MINUTE;
        calculator.onEvent(GAME, true, midnight - 30 * MINUTE);
        calculator.onEvent(GAME, false, midnight + 20 * MINUTE);

        List<DailyUsageCalculator.DayUsage> days = calculator.result();

        assertEquals(2, days.size());
        assertEquals("2026-11-01", days.get(0).date);
        assertEquals(30, days.get(0).minutes);
        assertEquals("2026-11-02", days.get(1).date);
        assertEquals(20, days.get(1).minutes);
    }

    @Test
    public void playBeforeTheRangeIsClippedAndOtherAppsOrOpenSessionsAreIgnored() {
        DailyUsageCalculator calculator = calculator();
        calculator.onEvent(GAME, true, NOV_1 - 60 * MINUTE);
        calculator.onEvent(GAME, false, NOV_1 + 15 * MINUTE);
        calculator.onEvent("com.whatsapp", true, NOV_1 + 60 * MINUTE);
        calculator.onEvent("com.whatsapp", false, NOV_1 + 120 * MINUTE);
        // A repeated resume does not restart the session; a pause without a resume is ignored.
        calculator.onEvent(GAME, false, NOV_1 + 200 * MINUTE);
        calculator.onEvent(GAME, true, NOV_1 + 300 * MINUTE);
        calculator.onEvent(GAME, true, NOV_1 + 310 * MINUTE);
        calculator.onEvent(GAME, false, NOV_1 + 320 * MINUTE);
        // Never paused: dropped.
        calculator.onEvent(GAME, true, NOV_1 + 400 * MINUTE);

        List<DailyUsageCalculator.DayUsage> days = calculator.result();

        assertEquals(1, days.size());
        assertEquals(35, days.get(0).minutes);
    }

    @Test
    public void lessThanAMinuteIsNotReported() {
        DailyUsageCalculator calculator = calculator();
        calculator.onEvent(GAME, true, NOV_1 + MINUTE);
        calculator.onEvent(GAME, false, NOV_1 + MINUTE + 59_000);

        assertTrue(calculator.result().isEmpty());
    }
}
